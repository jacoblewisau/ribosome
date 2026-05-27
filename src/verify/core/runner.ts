/**
 * Verify runner. mount -> act -> verify -> verdict.
 *
 * Renders one fixture, runs its act() if present, then iterates every
 * registered verifier and collects checks. The verdict aggregates:
 *   - PASS    : every non-probe check is ok (or warn).
 *   - FAIL    : at least one non-probe check is fail.
 *   - BLOCKED : a verifier threw or could not observe; distinct from FAIL.
 *   - SKIP    : reserved; not yet used.
 *
 * Probe checks are recorded but never elevate the verdict. A probe
 * fixture whose checks all pass is a quiet success; one whose checks
 * fail is the *expected* outcome that proves the harness catches bugs.
 */

import { render } from "@testing-library/react";
import type { Check, Fixture, FixtureResult, VerifiableUnit } from "./types";
import { getVerifiers } from "./registry";

export async function runFixture(
  unit: VerifiableUnit,
  fixture: Fixture
): Promise<FixtureResult> {
  const started = performance.now();
  const checks: Check[] = [];
  const isProbe = fixture.probe === true;

  let container: HTMLElement | null = null;
  try {
    const { container: c } = render(fixture.render());
    container = c;
  } catch (err) {
    return {
      unit: unit.name,
      fixture: fixture.name,
      probe: isProbe,
      verdict: isProbe ? "PASS" : "BLOCKED",
      checks: [
        {
          verifier: "runner",
          status: isProbe ? "probe" : "fail",
          reason: `render threw: ${(err as Error).message}`,
        },
      ],
      durationMs: performance.now() - started,
    };
  }

  if (fixture.act) {
    try {
      await fixture.act(container);
    } catch (err) {
      checks.push({
        verifier: "runner",
        status: isProbe ? "probe" : "fail",
        reason: `act threw: ${(err as Error).message}`,
      });
    }
  }

  for (const verifier of getVerifiers()) {
    try {
      const produced = await verifier.run(container, unit, fixture);
      // If this is a probe fixture, demote any non-ok status to "probe"
      // so the matrix output marks it as expected adversarial behaviour.
      const adjusted = isProbe
        ? produced.map((c) => (c.status === "ok" || c.status === "warn" ? c : { ...c, status: "probe" as const }))
        : produced;
      checks.push(...adjusted);
    } catch (err) {
      checks.push({
        verifier: verifier.name,
        status: "fail",
        reason: `verifier threw: ${(err as Error).message}`,
      });
    }
  }

  const verdict = verdictOf(checks, isProbe);
  return {
    unit: unit.name,
    fixture: fixture.name,
    probe: isProbe,
    verdict,
    checks,
    durationMs: performance.now() - started,
  };
}

function verdictOf(checks: ReadonlyArray<Check>, isProbe: boolean): FixtureResult["verdict"] {
  // Probes always PASS at the verdict level; the checks array records
  // their internal state for the dashboard.
  if (isProbe) return "PASS";
  let hasFail = false;
  let hasBlocked = false;
  for (const c of checks) {
    if (c.status === "fail") hasFail = true;
    if (c.verifier === "runner" && c.status === "fail") hasBlocked = true;
  }
  if (hasFail || hasBlocked) return hasBlocked ? "BLOCKED" : "FAIL";
  return "PASS";
}
