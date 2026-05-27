import type { Check, Verifier } from "../core/types";

/**
 * Invariants verifier. Runs every predicate in `fixture.invariants`
 * against the mounted DOM. A predicate returns `true` (ok), `false`
 * (fail with a generic reason), or a string (fail with that reason).
 */
export const invariantsVerifier: Verifier = {
  name: "invariants",
  run: (container, _unit, fixture): Check[] => {
    const list = fixture.invariants ?? [];
    if (list.length === 0) {
      return [
        {
          verifier: "invariants",
          status: "warn",
          reason: "no invariants declared for this fixture",
        },
      ];
    }
    const checks: Check[] = [];
    list.forEach((predicate, i) => {
      let result: boolean | string;
      try {
        result = predicate(container);
      } catch (err) {
        checks.push({
          verifier: "invariants",
          status: "fail",
          reason: `invariant[${i}] threw: ${(err as Error).message}`,
        });
        return;
      }
      if (result === true) {
        checks.push({ verifier: "invariants", status: "ok" });
      } else if (result === false) {
        checks.push({
          verifier: "invariants",
          status: "fail",
          reason: `invariant[${i}] returned false`,
        });
      } else {
        checks.push({
          verifier: "invariants",
          status: "fail",
          reason: `invariant[${i}]: ${result}`,
        });
      }
    });
    return checks;
  },
};
