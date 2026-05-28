/**
 * Eval runner unit tests. The 12 seeded tasks run against the real
 * repo (TASKS reads .claude/, CLAUDE.md, etc.), so the assertion
 * "all 12 pass" is also a regression test for the chain itself.
 *
 * Plan §11/§12 acceptance is verified at the workflow level (eval.yml
 * gates merges); these tests verify the scoring formula, the gate
 * logic, and the runner's error handling.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadBaseline,
  regressesAgainst,
  renderReport,
  runEval,
  writeBaseline,
} from "./runner";
import { TASKS } from "./tasks";
import type { TaskDefinition, Baseline } from "./types";

describe("Phase 5 eval runner", () => {
  describe("scoring formula", () => {
    it("computes (pass + 0.5*passSlow) / total", () => {
      const tasks: TaskDefinition[] = [
        { id: "a", category: "routine", name: "a", rationale: "", check: () => "PASS" },
        { id: "b", category: "routine", name: "b", rationale: "", check: () => "PASS" },
        { id: "c", category: "routine", name: "c", rationale: "", check: () => "PASS_SLOW" },
        { id: "d", category: "routine", name: "d", rationale: "", check: () => "FAIL" },
      ];
      const report = runEval(tasks);
      expect(report.totalTasks).toBe(4);
      expect(report.pass).toBe(2);
      expect(report.passSlow).toBe(1);
      expect(report.fail).toBe(1);
      // (2 + 0.5*1) / 4 = 2.5 / 4 = 0.625
      expect(report.score).toBeCloseTo(0.625, 5);
    });

    it("returns score 1.0 when all tasks pass", () => {
      const tasks: TaskDefinition[] = [
        { id: "a", category: "routine", name: "a", rationale: "", check: () => "PASS" },
        { id: "b", category: "routine", name: "b", rationale: "", check: () => "PASS" },
      ];
      const report = runEval(tasks);
      expect(report.score).toBe(1);
    });

    it("captures a thrown error from a check as FAIL with the message in reason", () => {
      const tasks: TaskDefinition[] = [
        {
          id: "boom",
          category: "trap",
          name: "boom",
          rationale: "",
          check: () => {
            throw new Error("kapow");
          },
        },
      ];
      const report = runEval(tasks);
      expect(report.fail).toBe(1);
      expect(report.results[0]!.result).toBe("FAIL");
      expect(report.results[0]!.reason).toContain("kapow");
    });

    it("preserves the reason when a check returns a structured FAIL", () => {
      const tasks: TaskDefinition[] = [
        {
          id: "x",
          category: "trap",
          name: "x",
          rationale: "",
          check: () => ({ result: "FAIL" as const, reason: "the specific thing was missing" }),
        },
      ];
      const report = runEval(tasks);
      expect(report.results[0]!.reason).toBe("the specific thing was missing");
    });
  });

  describe("gate logic (regressesAgainst)", () => {
    const baseline = (pass: number, total: number): Baseline => ({
      version: "1",
      schema: "ribosome.eval.baseline",
      recorded_at: "2026-05-28T00:00:00.000Z",
      pass,
      totalTasks: total,
      score: pass / total,
    });

    it("does not regress when current matches baseline", () => {
      const tasks: TaskDefinition[] = Array.from({ length: 12 }, (_, i) => ({
        id: `t${i}`,
        category: "routine" as const,
        name: `t${i}`,
        rationale: "",
        check: () => "PASS" as const,
      }));
      const report = runEval(tasks);
      const r = regressesAgainst(report, baseline(12, 12));
      expect(r.regressed).toBe(false);
      expect(r.drop).toBe(0);
    });

    it("tolerates a single-task drop (plan: drop > 1 task blocks)", () => {
      const tasks: TaskDefinition[] = Array.from({ length: 12 }, (_, i) => ({
        id: `t${i}`,
        category: "routine" as const,
        name: `t${i}`,
        rationale: "",
        check: () => (i === 0 ? "FAIL" : "PASS") as "FAIL" | "PASS",
      }));
      const report = runEval(tasks);
      expect(report.pass).toBe(11);
      const r = regressesAgainst(report, baseline(12, 12));
      expect(r.regressed).toBe(false);
      expect(r.drop).toBe(1);
    });

    it("blocks on a two-task drop", () => {
      const tasks: TaskDefinition[] = Array.from({ length: 12 }, (_, i) => ({
        id: `t${i}`,
        category: "routine" as const,
        name: `t${i}`,
        rationale: "",
        check: () => (i < 2 ? "FAIL" : "PASS") as "FAIL" | "PASS",
      }));
      const report = runEval(tasks);
      expect(report.pass).toBe(10);
      const r = regressesAgainst(report, baseline(12, 12));
      expect(r.regressed).toBe(true);
      expect(r.drop).toBe(2);
      expect(r.reason).toContain("dropped by 2");
    });

    it("blocks when totalTasks changes (cannot compare)", () => {
      const tasks: TaskDefinition[] = Array.from({ length: 11 }, (_, i) => ({
        id: `t${i}`,
        category: "routine" as const,
        name: `t${i}`,
        rationale: "",
        check: () => "PASS" as const,
      }));
      const report = runEval(tasks);
      const r = regressesAgainst(report, baseline(12, 12));
      expect(r.regressed).toBe(true);
      expect(r.reason).toContain("totalTasks changed");
    });
  });

  describe("baseline I/O", () => {
    it("loadBaseline returns undefined for a missing file", () => {
      expect(loadBaseline("/tmp/nonexistent-baseline-xyz.json")).toBeUndefined();
    });

    it("writeBaseline + loadBaseline round-trips", () => {
      const dir = mkdtempSync(join(tmpdir(), "ribosome-eval-baseline-"));
      try {
        const path = join(dir, "baseline.json");
        const tasks: TaskDefinition[] = [
          { id: "a", category: "routine", name: "a", rationale: "", check: () => "PASS" },
        ];
        const report = runEval(tasks);
        writeBaseline(path, report, "test");
        const loaded = loadBaseline(path)!;
        expect(loaded.pass).toBe(1);
        expect(loaded.totalTasks).toBe(1);
        expect(loaded.notes).toBe("test");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("loadBaseline rejects an unknown schema/version", () => {
      const dir = mkdtempSync(join(tmpdir(), "ribosome-eval-baseline-"));
      try {
        const path = join(dir, "baseline.json");
        writeFileSync(path, JSON.stringify({ version: "999", schema: "nope" }));
        expect(() => loadBaseline(path)).toThrow();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("the seeded tasks against current repo", () => {
    it("every task passes (this is also the chain's regression guard)", () => {
      const report = runEval(TASKS);
      const failures = report.results.filter((r) => r.result === "FAIL");
      if (failures.length > 0) {
        const lines = failures.map((f) => `  ${f.id}: ${f.reason}`).join("\n");
        // eslint-disable-next-line no-console
        console.error(`Eval failures (${failures.length}):\n${lines}`);
      }
      // The total grows as the chain surface grows; the invariant is
      // "every task passes", not a fixed count.
      expect(report.totalTasks).toBeGreaterThanOrEqual(12);
      expect(report.pass).toBe(report.totalTasks);
      expect(report.fail).toBe(0);
      expect(report.score).toBe(1);
    });
  });

  describe("renderReport", () => {
    it("produces a human-readable text block grouped by category", () => {
      const tasks: TaskDefinition[] = [
        { id: "R1", category: "routine", name: "r", rationale: "", check: () => "PASS" },
        { id: "T1", category: "tricky", name: "t", rationale: "", check: () => ({ result: "FAIL" as const, reason: "because" }) },
        { id: "TR1", category: "trap", name: "trap1", rationale: "", check: () => "PASS" },
      ];
      const report = runEval(tasks);
      const text = renderReport(report);
      expect(text).toContain("ROUTINE (1)");
      expect(text).toContain("TRICKY (1)");
      expect(text).toContain("TRAP (1)");
      expect(text).toContain("[FAIL] T1");
      expect(text).toContain("reason: because");
    });
  });
});
