#!/usr/bin/env node
/**
 * scripts/mission-control.ts
 *
 * Wraps src/chain/mission-control.ts for the coordinator and the shepherd.
 * Deterministic formatting, so the operator-facing board never drifts.
 *
 * The caller gathers the open (and recently closed) chain Issues, parses each
 * sticky state marker, and pipes a JSON array of chain inputs on stdin:
 *
 *   [{ "issue": 41, "title": "Dark mode", "current_step": "spec-writer",
 *      "gate_state": { "spec": "pending" }, "waiting": "2 days" }, ...]
 *
 * Output (stdout):
 *   default      -> { "title": "...", "body": "..." }   (JSON, for `gh issue edit`)
 *   --md         -> the body markdown only
 *   --demo       -> render a built-in sample (no stdin needed)
 *   --updated T  -> stamp the footer with timestamp T
 *
 * Usage from the coordinator (rebuild the pinned ribo:in-flight Issue):
 *   printf '%s' "$ROWS_JSON" \
 *     | node --experimental-strip-types scripts/mission-control.ts --updated "$(date -u '+%Y-%m-%d %H:%M UTC')" \
 *     > /tmp/board.json
 *   gh issue edit "$BOARD" --title "$(jq -r .title /tmp/board.json)" \
 *     --body "$(jq -r .body /tmp/board.json)"
 */

import { readFileSync } from "node:fs";
import { renderMissionControl, toRow, type ChainInput } from "../src/chain/mission-control.ts";

const DEMO: ChainInput[] = [
  { issue: 41, title: "Dark mode toggle", current_step: "spec-writer", gate_state: { spec: "pending" }, waiting: "2 days" },
  { issue: 44, title: "Fix login redirect", current_step: "pr-shepherd", gate_state: { pr: "pending" }, waiting: "1 day" },
  { issue: 46, title: "Weekly report email", current_step: "planner", gate_state: { roadmap: "pending" }, waiting: "4 hours" },
  { issue: 39, title: "Export to CSV", current_step: "builder", gate_state: { spec: "approved" } },
  { issue: 47, title: "Tooltip wording", current_step: "builder", gate_state: { spec: "auto-approved" } },
  { issue: 40, title: "Add dark logo", current_step: "completed" },
];

function parseArgs(argv: string[]): { md: boolean; demo: boolean; updatedAt?: string } {
  const md = argv.includes("--md");
  const demo = argv.includes("--demo");
  const i = argv.indexOf("--updated");
  const updatedAt = i >= 0 ? argv[i + 1] : undefined;
  return { md, demo, updatedAt };
}

function loadInputs(demo: boolean): ChainInput[] {
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

const { md, demo, updatedAt } = parseArgs(process.argv.slice(2));
const inputs = loadInputs(demo);
const out = renderMissionControl(inputs.map(toRow), { updatedAt });

process.stdout.write(md ? out.body + "\n" : JSON.stringify(out) + "\n");
