/**
 * Eval runner. Walks the 12 seeded tasks, runs each predicate,
 * produces a structured report. Pure TypeScript; no Claude calls.
 *
 * Score formula per plan §11: (PASS + 0.5*PASS_SLOW) / totalTasks.
 * In structural mode PASS_SLOW is always 0; the formula reduces to
 * PASS/totalTasks. PASS_SLOW is reserved for a future behavioural
 * mode where a slow-but-correct chain run still partially counts.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Baseline, EvalReport, TaskDefinition, TaskResult } from "./types.ts";
import { TASKS } from "./tasks.ts";

export function runEval(tasks: ReadonlyArray<TaskDefinition> = TASKS): EvalReport {
  const results: TaskResult[] = [];

  for (const task of tasks) {
    const started = performance.now();
    let result: TaskResult;
    try {
      const raw = task.check();
      if (typeof raw === "string") {
        result = {
          id: task.id,
          category: task.category,
          name: task.name,
          rationale: task.rationale,
          result: raw,
          durationMs: performance.now() - started,
        };
      } else {
        result = {
          id: task.id,
          category: task.category,
          name: task.name,
          rationale: task.rationale,
          result: raw.result,
          reason: raw.reason,
          durationMs: performance.now() - started,
        };
      }
    } catch (err) {
      result = {
        id: task.id,
        category: task.category,
        name: task.name,
        rationale: task.rationale,
        result: "FAIL",
        reason: `check threw: ${(err as Error).message}`,
        durationMs: performance.now() - started,
      };
    }
    results.push(result);
  }

  const pass = results.filter((r) => r.result === "PASS").length;
  const fail = results.filter((r) => r.result === "FAIL").length;
  const passSlow = results.filter((r) => r.result === "PASS_SLOW").length;
  const totalTasks = results.length;
  const score = (pass + 0.5 * passSlow) / totalTasks;

  return {
    version: "1",
    schema: "ribosome.eval.report",
    generated_at: new Date().toISOString(),
    totalTasks,
    pass,
    fail,
    passSlow,
    score,
    results,
  };
}

/**
 * Compute whether a report regresses against a baseline. The plan's
 * acceptance is: "A regression (score drop > 1 task) blocks merge."
 *
 * "Score drop > 1 task" interpretation: baseline.pass - current.pass > 1.
 * If baseline = 12 and current = 11, drop = 1 (allowed).
 * If baseline = 12 and current = 10, drop = 2 (blocked).
 */
export function regressesAgainst(report: EvalReport, baseline: Baseline): {
  regressed: boolean;
  drop: number;
  reason: string;
} {
  if (report.totalTasks !== baseline.totalTasks) {
    return {
      regressed: true,
      drop: 0,
      reason: `totalTasks changed (baseline=${baseline.totalTasks}, current=${report.totalTasks}); cannot compare`,
    };
  }
  const drop = baseline.pass - report.pass;
  if (drop > 1) {
    return {
      regressed: true,
      drop,
      reason: `pass count dropped by ${drop} tasks (baseline=${baseline.pass}, current=${report.pass})`,
    };
  }
  return {
    regressed: false,
    drop,
    reason: drop === 0 ? "no regression" : `drop of ${drop} task is within tolerance`,
  };
}

export function loadBaseline(path: string): Baseline | undefined {
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Baseline;
  if (parsed.version !== "1" || parsed.schema !== "ribosome.eval.baseline") {
    throw new Error(`baseline at ${path} has unexpected version/schema`);
  }
  return parsed;
}

export function writeBaseline(path: string, report: EvalReport, notes?: string): void {
  const baseline: Baseline = {
    version: "1",
    schema: "ribosome.eval.baseline",
    recorded_at: new Date().toISOString(),
    pass: report.pass,
    totalTasks: report.totalTasks,
    score: report.score,
    notes,
  };
  writeFileSync(path, JSON.stringify(baseline, null, 2) + "\n");
}

/** Human-readable text rendering for stdout / PR comments. */
export function renderReport(report: EvalReport): string {
  const lines: string[] = [];
  lines.push(`Ribosome eval report (schema ${report.schema} v${report.version})`);
  lines.push(`Generated: ${report.generated_at}`);
  lines.push(`Score: ${report.pass}/${report.totalTasks} = ${report.score.toFixed(3)}`);
  lines.push(`  pass: ${report.pass}`);
  lines.push(`  fail: ${report.fail}`);
  lines.push(`  pass-slow: ${report.passSlow}`);
  lines.push("");
  for (const cat of ["routine", "tricky", "trap"] as const) {
    const subset = report.results.filter((r) => r.category === cat);
    if (subset.length === 0) continue;
    lines.push(`${cat.toUpperCase()} (${subset.length}):`);
    for (const r of subset) {
      const marker = r.result === "PASS" ? "OK" : r.result === "PASS_SLOW" ? "OK-slow" : "FAIL";
      lines.push(`  [${marker}] ${r.id}  ${r.name}`);
      if (r.reason) lines.push(`         reason: ${r.reason}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
