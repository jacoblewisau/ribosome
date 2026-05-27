/**
 * Verify runner. mount -> act -> verify -> verdict.
 *
 * Renders one fixture, runs its act() if present, then iterates every
 * registered verifier and collects checks. The verdict aggregates:
 *   - PASS    : every non-probe check is ok (or warn).
 *   - FAIL    : at least one non-probe check is fail.
 *   - BLOCKED : a verifier threw or could not observe; distinct from FAIL.
 *   - SKIP    : reserved; the unit declared zero fixtures.
 *
 * Probe checks are recorded but never elevate the verdict. A probe
 * fixture whose checks all pass is a quiet success; one whose checks
 * fail is the expected outcome that proves the harness catches bugs.
 *
 * Every result includes a DOM snapshot: every `data-verify-*` attribute
 * on the unit's root element at observation time, with the prefix
 * stripped. The validator reads this snapshot instead of the source.
 */

import { render } from "@testing-library/react";
import type { Check, Fixture, FixtureResult, VerifiableUnit } from "./types";
import { getVerifiers } from "./registry";

export async function runFixture(
  unit: VerifiableUnit,
  fixture: Fixture
): Promise<FixtureResult> {
  const started = performance.now();
  const startedISO = new Date().toISOString();
  const checks: Check[] = [];
  const isProbe = fixture.probe === true;

  let container: HTMLElement | null = null;
  try {
    const { container: c } = render(fixture.render());
    container = c;
  } catch (err) {
    return {
      unitId: unit.name,
      fixtureId: fixture.name,
      probe: isProbe,
      verdict: isProbe ? "PASS" : "BLOCKED",
      blockedReason: isProbe ? undefined : `render threw: ${(err as Error).message}`,
      durationMs: performance.now() - started,
      timestamp: startedISO,
      checks: [
        {
          verifier: "runner",
          status: isProbe ? "probe" : "fail",
          reason: `render threw: ${(err as Error).message}`,
        },
      ],
      domSnapshot: {},
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

  const domSnapshot = snapshotContract(container, unit.name);
  const { verdict, blockedReason } = verdictOf(checks, isProbe);

  return {
    unitId: unit.name,
    fixtureId: fixture.name,
    probe: isProbe,
    verdict,
    blockedReason,
    durationMs: performance.now() - started,
    timestamp: startedISO,
    checks,
    domSnapshot,
  };
}

function verdictOf(
  checks: ReadonlyArray<Check>,
  isProbe: boolean
): { verdict: FixtureResult["verdict"]; blockedReason?: string } {
  if (isProbe) return { verdict: "PASS" };
  let hasFail = false;
  let blockedReason: string | undefined;
  for (const c of checks) {
    if (c.status === "fail") {
      hasFail = true;
      if (c.verifier === "runner") {
        blockedReason = c.reason;
      }
    }
  }
  if (blockedReason) return { verdict: "BLOCKED", blockedReason };
  if (hasFail) return { verdict: "FAIL" };
  return { verdict: "PASS" };
}

/**
 * Walk the unit's root and collect every `data-verify-*` attribute as a
 * key->value map with the `data-verify-` prefix stripped. The map is
 * the contract surface the validator consults.
 */
function snapshotContract(container: HTMLElement, unitName: string): Record<string, string> {
  const root = container.querySelector(`[data-verify-unit="${unitName}"]`);
  if (!root) return {};
  const snap: Record<string, string> = {};
  for (const attr of Array.from(root.attributes)) {
    if (attr.name.startsWith("data-verify-")) {
      snap[attr.name.slice("data-verify-".length)] = attr.value;
    }
  }
  return snap;
}
