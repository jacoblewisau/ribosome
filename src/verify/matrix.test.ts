import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { _resetRegistryForTests, getUnits, registerVerifier } from "./core/registry";
import { runFixture } from "./core/runner";
import { schemaVerifier } from "./verifiers/schema";
import { invariantsVerifier } from "./verifiers/invariants";
import { domContractVerifier } from "./verifiers/dom-contract";
import { a11yVerifier } from "./verifiers/a11y";
import type { FixtureResult, VerifyReport } from "./core/types";

const REPORT_PATH = resolve(__dirname, "../../tests/verify/last-run.json");

// Collected during the run; written in afterAll.
const collected: FixtureResult[] = [];

beforeAll(async () => {
  _resetRegistryForTests();
  registerVerifier(schemaVerifier);
  registerVerifier(invariantsVerifier);
  registerVerifier(domContractVerifier);
  registerVerifier(a11yVerifier);

  await import("./specs/TodoApp.verify");
  await import("./specs/TodoStats.verify");
  await import("./specs/todos.feature.verify");
});

afterAll(() => {
  const totals = {
    units: new Set(collected.map((r) => r.unitId)).size,
    fixtures: collected.length,
    pass: collected.filter((r) => r.verdict === "PASS" && !r.probe).length,
    fail: collected.filter((r) => r.verdict === "FAIL").length,
    blocked: collected.filter((r) => r.verdict === "BLOCKED").length,
    skip: collected.filter((r) => r.verdict === "SKIP").length,
    probes: collected.filter((r) => r.probe).length,
  };
  const report: VerifyReport = {
    version: "1",
    generated_at: new Date().toISOString(),
    schema: "ribosome.verify.report",
    totals,
    results: collected,
  };
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
});

describe("verify matrix", () => {
  it("every unit declares at least one probe fixture", () => {
    const units = getUnits();
    expect(units.length).toBeGreaterThan(0);
    for (const unit of units) {
      const hasProbe = unit.fixtures.some((f) => f.probe === true);
      expect(hasProbe, `unit "${unit.name}" has no probe fixture; happy-path-only suites are rejected`).toBe(true);
    }
  });

  it("runs every fixture and reports verdicts", async () => {
    // Soft expectations collect failures across the entire matrix
    // instead of bailing at the first failing fixture. The validator
    // depends on a complete report; partial runs hide downstream
    // problems behind upstream ones.
    const units = getUnits();
    let probesSeen = 0;
    for (const unit of units) {
      for (const fixture of unit.fixtures) {
        const result = await runFixture(unit, fixture);
        collected.push(result);
        if (result.probe) {
          probesSeen += 1;
          expect.soft(result.verdict, `probe ${unit.name}/${fixture.name} verdict`).toBe("PASS");
        } else {
          if (result.verdict !== "PASS") {
            // eslint-disable-next-line no-console
            console.error(
              `[verify matrix] non-probe failure: ${unit.name}/${fixture.name} verdict=${result.verdict}`,
              JSON.stringify(result.checks.filter((c) => c.status === "fail"), null, 2)
            );
          }
          expect.soft(result.verdict, `${unit.name}/${fixture.name} verdict`).toBe("PASS");
        }
      }
    }
    expect(probesSeen).toBeGreaterThan(0);
  });
});
