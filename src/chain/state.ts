/**
 * Chain state helper.
 *
 * Phase 2.5 deliverable. Pure TypeScript, no React, no test dependencies.
 *
 * Manages the live store at `.claude/memory/live/<id>/` per the layout
 * documented in `.claude/memory/ACCESS.md`. This module is used by
 * scripts (chain-show, the acceptance test, future scout scripts in
 * Phase 4) and the orchestrator. Subagents themselves use Read / Write
 * / Edit tools directly against the documented file paths; they do not
 * call this module. Keeping the helper out of the agent loop avoids
 * coupling agents to an internal API that could drift.
 *
 * Anthropic's "Building Effective Agents" essay: "start with simple
 * prompts and optimize before moving to multi-step systems." This
 * helper is the minimum surface that satisfies the Phase 2.5
 * acceptance test (`builder writes an in-flight note that the
 * validator reads back; restarting the builder mid-run picks up the
 * note`). It is deliberately small.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Chain identifier. Convention: zero-padded sequential numeric string
 * (e.g. "0001"). Test ids may use a non-numeric prefix to avoid
 * colliding with real chain runs.
 */
export type ChainId = string;

/** Role names mirror the agents and skills the chain invokes. */
export type Role =
  | "researcher"
  | "story-writer"
  | "spec-writer"
  | "builder"
  | "validator"
  | "pr-shepherd";

export type ChainPath = "full" | "docs-only" | "dep-bump" | "test-backfill";

export type GateState =
  | "pending"
  | "approved"
  | "auto-approved"
  | "changes-requested"
  | "phase-skipped";

export interface ChainStateGates {
  story: GateState;
  spec: GateState;
  pr: GateState;
}

/**
 * The chain.json shape, version 1. Versioned so future migrations can
 * detect older shapes and convert.
 */
export interface ChainState {
  version: "1";
  id: ChainId;
  issue: string;
  path: ChainPath;
  path_reason: string;
  current_step: Role | "completed" | "coordinator";
  gate_state: ChainStateGates;
  validator_status?: "clean" | "needs-fix" | "blocked";
  started_at: string;
  completed_at?: string;
  /** Free-form notes the coordinator can add about the run. */
  notes?: string[];
}

/**
 * Locate the repo root by walking up from the current working
 * directory. Stops at the first directory containing `.claude/`.
 * Throws if not found. Using cwd instead of import.meta.url keeps the
 * module portable between ESM and CJS execution contexts.
 */
/**
 * Map a legacy gate_state shape (with `1_story` / `2_spec` / `3_pr`
 * key names where values are free-form approval text) to the version
 * 1 normalised shape. Presence of any of those keys is the signal
 * that the file predates the version field.
 */
function normaliseGateState(raw: unknown): ChainState["gate_state"] {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return { story: "pending", spec: "pending", pr: "pending" };
  }
  const r = raw as Record<string, unknown>;
  const summarise = (v: unknown): GateState => {
    if (typeof v !== "string") return "pending";
    const lower = v.toLowerCase();
    // "auto-approved" (spec gate auto-advanced, ADR-0005) is deliberately
    // distinct from "approved"; match it before the approved check so the
    // audit trail keeps the distinction instead of collapsing to "pending".
    if (lower.startsWith("auto-approved")) return "auto-approved";
    if (lower.startsWith("approved")) return "approved";
    if (lower.includes("changes")) return "changes-requested";
    if (lower.includes("skip")) return "phase-skipped";
    return "pending";
  };
  return {
    story: summarise(r.story ?? r["1_story"]),
    spec: summarise(r.spec ?? r["2_spec"]),
    pr: summarise(r.pr ?? r["3_pr"]),
  };
}

function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, ".claude"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("chain/state: no .claude/ directory found in any parent of " + start);
    }
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const LIVE_ROOT = join(REPO_ROOT, ".claude", "memory", "live");

/**
 * Build the on-disk path for a chain run. Used by every operation in
 * this module so the layout is centrally controlled.
 */
export function chainDir(id: ChainId): string {
  if (!/^[\w-]+$/.test(id)) {
    throw new Error(`chain/state: invalid id "${id}" (allowed: [\\w-]+)`);
  }
  return join(LIVE_ROOT, id);
}

/**
 * Canonical file paths under a chain's working area. Centralised so
 * the agent prompts and the scripts cite the same names.
 */
export function pathsFor(id: ChainId): {
  dir: string;
  chain: string;
  inFlight: (role: Role) => string;
  final: (role: Role) => string;
} {
  const dir = chainDir(id);
  return {
    dir,
    chain: join(dir, "chain.json"),
    inFlight: (role) => join(dir, `${role}.inflight.md`),
    final: (role) => join(dir, `${role}.md`),
  };
}

/**
 * Initialise a chain. Creates the directory, writes the initial
 * chain.json. Returns the state. Idempotent if the chain already exists
 * (returns the existing state unchanged).
 */
export function initChain(
  id: ChainId,
  init: { issue: string; path: ChainPath; path_reason: string }
): ChainState {
  const paths = pathsFor(id);
  if (existsSync(paths.chain)) {
    return readChain(id);
  }
  mkdirSync(paths.dir, { recursive: true });
  const state: ChainState = {
    version: "1",
    id,
    issue: init.issue,
    path: init.path,
    path_reason: init.path_reason,
    current_step: "researcher",
    gate_state: { story: "pending", spec: "pending", pr: "pending" },
    started_at: new Date().toISOString(),
  };
  writeFileSync(paths.chain, JSON.stringify(state, null, 2) + "\n");
  return state;
}

/**
 * Read the current chain state. Throws if the chain does not exist.
 * Tolerant of chain.json files written before the version field
 * existed (treats them as v1 and normalises the shape on next write).
 * Refuses to load files with a known-different version.
 */
export function readChain(id: ChainId): ChainState {
  const paths = pathsFor(id);
  if (!existsSync(paths.chain)) {
    throw new Error(`chain/state: no chain at ${paths.chain}`);
  }
  const raw = readFileSync(paths.chain, "utf8");
  const parsed = JSON.parse(raw) as Partial<ChainState> & Record<string, unknown>;
  if (parsed.version !== undefined && parsed.version !== "1") {
    throw new Error(`chain/state: unsupported version "${parsed.version}" (expected "1")`);
  }
  // Normalise legacy shape: missing version, missing gate_state defaults.
  const state: ChainState = {
    version: "1",
    id: (parsed.id as string) ?? id,
    issue: (parsed.issue as string) ?? "(unknown issue)",
    path: (parsed.path as ChainState["path"]) ?? "full",
    path_reason: (parsed.path_reason as string) ?? "",
    current_step: (parsed.current_step as ChainState["current_step"]) ?? "coordinator",
    gate_state: normaliseGateState(parsed.gate_state),
    validator_status: parsed.validator_status as ChainState["validator_status"] | undefined,
    started_at: (parsed.started_at as string) ?? new Date(0).toISOString(),
    completed_at: parsed.completed_at as string | undefined,
    notes: parsed.notes as string[] | undefined,
  };
  return state;
}

/**
 * Atomically patch chain.json. Reads, applies the patch, writes back.
 * Concurrent writes are not supported; Phase 2.5 assumes one chain
 * orchestrator at a time. Future phases may add advisory locking.
 */
export function updateChain(id: ChainId, patch: Partial<ChainState>): ChainState {
  const current = readChain(id);
  const next: ChainState = { ...current, ...patch, version: "1", id: current.id };
  const paths = pathsFor(id);
  writeFileSync(paths.chain, JSON.stringify(next, null, 2) + "\n");
  return next;
}

/**
 * Write an in-flight note for a role. Used by long-running roles
 * (typically `builder`) to checkpoint progress mid-task. Overwrites
 * any existing in-flight note. To preserve history, call
 * archiveInFlight first.
 */
export function writeInFlight(id: ChainId, role: Role, content: string): void {
  const paths = pathsFor(id);
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.inFlight(role), content);
}

/** Read an in-flight note. Returns undefined if not present. */
export function readInFlight(id: ChainId, role: Role): string | undefined {
  const paths = pathsFor(id);
  const p = paths.inFlight(role);
  if (!existsSync(p)) return undefined;
  return readFileSync(p, "utf8");
}

/**
 * Promote the in-flight note to the final report path and remove the
 * in-flight file. Called when the role completes successfully. If no
 * in-flight note exists, throws.
 */
export function finalize(id: ChainId, role: Role, finalContent?: string): void {
  const paths = pathsFor(id);
  const finalPath = paths.final(role);
  if (finalContent !== undefined) {
    writeFileSync(finalPath, finalContent);
    return;
  }
  const inFlight = readInFlight(id, role);
  if (inFlight === undefined) {
    throw new Error(
      `chain/state: cannot finalize ${role} on ${id}; no in-flight note and no content provided`
    );
  }
  writeFileSync(finalPath, inFlight);
}

/** Read a role's final report. Returns undefined if not present. */
export function readFinal(id: ChainId, role: Role): string | undefined {
  const paths = pathsFor(id);
  const p = paths.final(role);
  if (!existsSync(p)) return undefined;
  return readFileSync(p, "utf8");
}

/**
 * Detect whether a role is currently mid-run. A role is "mid-run" if
 * an in-flight note exists and is newer than the final report (or no
 * final report exists). The validator uses this to refuse to verdict
 * against incomplete state.
 */
export function isMidRun(id: ChainId, role: Role): boolean {
  const paths = pathsFor(id);
  const inFlight = paths.inFlight(role);
  if (!existsSync(inFlight)) return false;
  const final = paths.final(role);
  if (!existsSync(final)) return true;
  const inFlightStat = statSync(inFlight).mtimeMs;
  const finalStat = statSync(final).mtimeMs;
  return inFlightStat > finalStat;
}

/** List every chain id present on disk. Sorted lexicographically. */
export function listChains(): ChainId[] {
  if (!existsSync(LIVE_ROOT)) return [];
  return readdirSync(LIVE_ROOT)
    .filter((entry) => {
      const p = join(LIVE_ROOT, entry);
      return existsSync(join(p, "chain.json"));
    })
    .sort();
}

/**
 * Remove a chain entirely. Test-only convenience; not exposed via any
 * CLI. Callers must pass a confirmation token to prevent accidental
 * use in production-shaped code.
 */
export function _purgeForTests(id: ChainId, confirm: "I-KNOW-WHAT-I-AM-DOING"): void {
  if (confirm !== "I-KNOW-WHAT-I-AM-DOING") {
    throw new Error("chain/state: purge requires confirmation token");
  }
  const dir = chainDir(id);
  if (!existsSync(dir)) return;
  // Manual recursive delete to avoid depending on rmSync semantics
  // across Node versions.
  const stack: string[] = [dir];
  const dirs: string[] = [];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const st = statSync(cur);
    if (st.isDirectory()) {
      dirs.push(cur);
      for (const child of readdirSync(cur)) stack.push(join(cur, child));
    } else {
      // Unlink file
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:fs").unlinkSync(cur);
    }
  }
  // Remove directories deepest first
  dirs.sort((a, b) => b.length - a.length);
  for (const d of dirs) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("node:fs").rmdirSync(d);
  }
}
