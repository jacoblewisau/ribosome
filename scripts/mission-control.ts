#!/usr/bin/env node
/**
 * scripts/mission-control.ts
 *
 * Wraps src/chain/mission-control.ts (the pure renderer) for the coordinator
 * and the shepherd. The render logic stays in the module; this script owns the
 * I/O (gh calls, stdin), so the operator-facing board never drifts in wording.
 *
 * Modes:
 *   --upsert [--updated T]    gather every open (and recently closed) chain via
 *                             gh, render the board, and edit (or create) the one
 *                             ribo:in-flight Issue. ONE command, no shell piping
 *                             or file redirection, so it is robust inside the
 *                             Action sandbox and costs the agent a single turn.
 *   --upsert --dry-run        print { title, body } instead of editing (for a
 *                             read-only smoke test).
 *   --demo [--md]             render a built-in sample (no stdin, no gh).
 *   (default)                 read a JSON array of chain inputs on stdin and
 *                             print { title, body } (or --md for body only).
 *
 * The coordinator rebuilds the board as the last action of every chain step
 * with: node --experimental-strip-types scripts/mission-control.ts --upsert
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  parseStateMarker,
  renderMissionControl,
  toRow,
  type ChainInput,
} from "../src/chain/mission-control.ts";

const CHAIN_LABELS = ["ribo:feature", "ribo:bug", "ribo:tweak", "ribo:project"];

const DEMO: ChainInput[] = [
  { issue: 41, title: "Dark mode toggle", current_step: "spec-writer", gate_state: { spec: "pending" }, waiting: "2 days" },
  { issue: 44, title: "Fix login redirect", current_step: "pr-shepherd", gate_state: { pr: "pending" }, waiting: "1 day" },
  { issue: 46, title: "Weekly report email", current_step: "planner", gate_state: { roadmap: "pending" }, waiting: "4 hours" },
  { issue: 39, title: "Export to CSV", current_step: "builder", gate_state: { spec: "approved" } },
  { issue: 47, title: "Tooltip wording", current_step: "builder", gate_state: { spec: "auto-approved" } },
  { issue: 40, title: "Add dark logo", current_step: "completed" },
];

function gh(args: string[]): string {
  // execFileSync, not a shell: no quoting/escaping pitfalls, no redirection.
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

function repoSlug(): string {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  return gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).trim();
}

/** A short, human "waiting" hint from an ISO timestamp. */
function humanAge(iso: string): string | undefined {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return undefined;
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins <= 1) return "just now";
  if (mins < 60) return `${mins} minutes`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Gather every chain's state via gh: open chains (current stage from the
 *  sticky marker) plus chains closed in the last 7 days (the Done section). */
function gatherInputs(): ChainInput[] {
  const repo = repoSlug();
  const inputs: ChainInput[] = [];
  const hasChainLabel = (labels: { name: string }[]) => labels.some((l) => CHAIN_LABELS.includes(l.name));

  // List all open issues with their labels and filter in-process. Multiple gh
  // `--label` flags are AND-ed, so asking for all four chain labels at once
  // matches nothing; filtering here is the OR we actually want.
  const open = (
    JSON.parse(
      gh(["issue", "list", "--state", "open", "--json", "number,title,updatedAt,labels", "--limit", "200"])
    ) as { number: number; title: string; updatedAt: string; labels: { name: string }[] }[]
  ).filter((iss) => hasChainLabel(iss.labels));

  for (const iss of open) {
    let marker: ReturnType<typeof parseStateMarker> = null;
    try {
      const bodies = JSON.parse(
        gh(["api", `repos/${repo}/issues/${iss.number}/comments`, "--jq", '[.[] | select(.user.type=="Bot") | .body]'])
      ) as string[];
      for (let i = bodies.length - 1; i >= 0 && !marker; i--) {
        marker = parseStateMarker(bodies[i]);
      }
    } catch {
      marker = null;
    }
    inputs.push({
      issue: iss.number,
      title: iss.title,
      current_step: marker?.current_step,
      gate_state: marker?.gate_state,
      waiting: humanAge(iss.updatedAt),
    });
  }

  // Done this week: chains closed in the last 7 days. Best-effort; if the
  // search fails the board still renders the open chains.
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const closed = (
      JSON.parse(
        gh(["issue", "list", "--state", "closed", "--search", `closed:>=${since}`, "--json", "number,title,labels", "--limit", "100"])
      ) as { number: number; title: string; labels: { name: string }[] }[]
    ).filter((iss) => hasChainLabel(iss.labels));
    for (const iss of closed) {
      inputs.push({ issue: iss.number, title: iss.title, current_step: "completed" });
    }
  } catch {
    /* closed search is best-effort */
  }

  return inputs;
}

function defaultStamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function upsert(updatedAt: string, dryRun: boolean): void {
  const rows = gatherInputs().map(toRow);
  const { title, body } = renderMissionControl(rows, { updatedAt });
  if (dryRun) {
    process.stdout.write(JSON.stringify({ title, body }, null, 2) + "\n");
    return;
  }
  const found = gh([
    "issue", "list", "--label", "ribo:in-flight", "--state", "open", "--json", "number", "--jq", ".[0].number",
  ]).trim();
  if (found) {
    gh(["issue", "edit", found, "--title", title, "--body", body]);
    process.stdout.write(`updated board issue #${found}: ${title}\n`);
  } else {
    const url = gh(["issue", "create", "--title", title, "--label", "ribo:in-flight,ribo:shepherd", "--body", body]).trim();
    const num = (url.match(/(\d+)\s*$/) || [])[1];
    if (num) {
      try {
        gh(["issue", "pin", num]);
      } catch {
        /* pin is best-effort: not all plans/permissions allow it */
      }
    }
    process.stdout.write(`created board issue ${url}: ${title}\n`);
  }
}

function loadStdinInputs(demo: boolean): ChainInput[] {
  if (demo) return DEMO;
  let raw = "";
  try {
    raw = readFileSync(0, "utf8").trim();
  } catch {
    raw = "";
  }
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("mission-control: stdin must be a JSON array of chain inputs");
  }
  return parsed as ChainInput[];
}

const argv = process.argv.slice(2);
const updIdx = argv.indexOf("--updated");
const updatedAt = updIdx >= 0 ? argv[updIdx + 1] : undefined;

if (argv.includes("--upsert")) {
  upsert(updatedAt ?? defaultStamp(), argv.includes("--dry-run"));
} else {
  const out = renderMissionControl(loadStdinInputs(argv.includes("--demo")).map(toRow), { updatedAt });
  process.stdout.write(argv.includes("--md") ? out.body + "\n" : JSON.stringify(out) + "\n");
}
