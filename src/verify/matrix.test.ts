import { describe, it, expect, beforeAll } from "vitest";

import { _resetRegistryForTests, getUnits, registerVerifier } from "./core/registry";
import { runFixture } from "./core/runner";
import { schemaVerifier } from "./verifiers/schema";
import { invariantsVerifier } from "./verifiers/invariants";
import { domContractVerifier } from "./verifiers/dom-contract";
import { a11yVerifier } from "./verifiers/a11y";

// Importing the specs is what triggers registration.
// Side-effectful by design.
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
    const units = getUnits();
    let nonProbeFailures = 0;
    let probesSeen = 0;
    for (const unit of units) {
      for (const fixture of unit.fixtures) {
        const result = await runFixture(unit, fixture);
        if (result.probe) {
          probesSeen += 1;
          // Probes are always PASS at the verdict level (their internal
          // checks may include "probe" status entries).
          expect(result.verdict, `probe ${unit.name}/${fixture.name} verdict`).toBe("PASS");
        } else {
          if (result.verdict !== "PASS") {
            nonProbeFailures += 1;
            // eslint-disable-next-line no-console
            console.error(
              `[verify matrix] non-probe failure: ${unit.name}/${fixture.name} verdict=${result.verdict}`,
              JSON.stringify(result.checks, null, 2)
            );
          }
          expect(result.verdict, `${unit.name}/${fixture.name} verdict`).toBe("PASS");
        }
      }
    }
    expect(probesSeen).toBeGreaterThan(0);
    expect(nonProbeFailures).toBe(0);
  });
});
