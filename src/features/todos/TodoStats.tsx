import { verifyAttrs } from "../../verify/core/contract";

export interface TodoStatsProps {
  total: number;
  done: number;
  active: number;
  overdue: number;
}

/**
 * TodoStats. Renders the four counts. The contract attributes here
 * are what the `TodoStats/inconsistent-counts` probe in the verify
 * specs deliberately makes inconsistent: that probe forces a fixture
 * where `total !== done + active` and confirms the dom-contract
 * verifier (plus the unit's invariant `counts-add-up`) flags it.
 *
 * `overdue` is independent of total/done/active (a done todo cannot
 * be overdue, so overdue is bounded above by active; not validated
 * here because TodoApp is authoritative on the count).
 */
export function TodoStats({ total, done, active, overdue }: TodoStatsProps) {
  const attrs = verifyAttrs("TodoStats", {
    total,
    done,
    active,
    overdue,
  });

  return (
    <p {...attrs} role="status">
      <span data-verify-field="total">{total} total</span>
      {" / "}
      <span data-verify-field="done">{done} done</span>
      {" / "}
      <span data-verify-field="active">{active} active</span>
      {" / "}
      <span data-verify-field="overdue">{overdue} overdue</span>
    </p>
  );
}
