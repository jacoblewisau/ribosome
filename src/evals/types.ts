/**
 * Eval harness types. Phase 5 deliverable.
 *
 * Plan §11: twelve seeded tasks, scored (PASS + 0.5*PASS_SLOW)/12,
 * three buckets (routine 5, tricky 4, trap 3). Plan §12 acceptance:
 * PRs touching .claude/** are blocked on a score drop > 1 task.
 *
 * This implementation runs tasks in STRUCTURAL mode: each task is a
 * predicate against files in the repo. No Claude API calls; runs
 * in milliseconds; deterministic. The behavioural mode envisioned
 * by the plan (a real chain run per task at $5-9 each) is documented
 * in .claude/skills/setup/SKILL.md as a future opt-in, not wired
 * here.
 */

export type TaskCategory = "routine" | "tricky" | "trap";
export type CheckResult = "PASS" | "FAIL" | "PASS_SLOW";

export interface TaskDefinition {
  id: string;
  category: TaskCategory;
  name: string;
  rationale: string;
  /** Predicate runs synchronously against files in the repo. */
  check: () => CheckResult | { result: CheckResult; reason: string };
}

export interface TaskResult {
  id: string;
  category: TaskCategory;
  name: string;
  rationale: string;
  result: CheckResult;
  reason?: string;
  durationMs: number;
}

export interface EvalReport {
  version: "1";
  schema: "ribosome.eval.report";
  generated_at: string;
  totalTasks: number;
  pass: number;
  fail: number;
  passSlow: number;
  score: number;
  results: TaskResult[];
}

export interface Baseline {
  version: "1";
  schema: "ribosome.eval.baseline";
  recorded_at: string;
  /** PASS count (out of totalTasks) at baseline. */
  pass: number;
  totalTasks: number;
  score: number;
  notes?: string;
}
