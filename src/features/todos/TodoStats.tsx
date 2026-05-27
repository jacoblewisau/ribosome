import { verifyAttrs } from "../../verify/core/contract";

export interface TodoStatsProps {
  total: number;
  done: number;
  active: number;
}

/**
 * TodoStats. Renders the three counts. The contract attributes here
 * are what the `TodoStats/inconsistent-counts` probe in the verify
 * specs deliberately makes inconsistent: that probe forces a fixture
 * where `total !== done + active` and confirms the dom-contract
 * verifier (plus the unit's invariant `counts-add-up`) flags it.
 */
export function TodoStats({ total, done, active }: TodoStatsProps) {
  const attrs = verifyAttrs("TodoStats", {
    total,
    done,
    active,
  });

  return (
    <p {...attrs} role="status">
      <span data-verify-field="total">{total} total</span>
      {" / "}
      <span data-verify-field="done">{done} done</span>
      {" / "}
      <span data-verify-field="active">{active} active</span>
    </p>
  );
}
