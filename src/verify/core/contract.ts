/**
 * DOM contract helpers.
 *
 * Every verifiable component emits `data-verify-*` attributes on the
 * element that represents the unit's surface. `verifyAttrs` is the
 * canonical helper that produces those attributes from a state object.
 *
 * Convention:
 *   - `data-verify-unit` is the addressable name of the unit.
 *   - All other `data-verify-<key>` attributes are the unit's observable
 *     state, serialised to strings (numbers, booleans, enum strings).
 *
 * The dom-contract verifier reads these attributes; the validator reads
 * the verifier output. The source code is never the source of truth for
 * behaviour.
 */

/**
 * Build the standard data-verify-* attribute bag. Stringifies all values
 * using `String(v)`. Boolean -> "true" / "false". Numbers -> decimal.
 * Null and undefined values are skipped (not emitted).
 *
 * The return is a plain Record<string, string> so React accepts it
 * directly via spread. The convention rather than the type is what
 * keeps the data-verify-unit key present on every output.
 */
export function verifyAttrs<T extends Record<string, unknown>>(
  unit: string,
  state: T
): Record<string, string> {
  const out: Record<string, string> = {
    "data-verify-unit": unit,
  };
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === undefined) continue;
    out[`data-verify-${key}`] = String(value);
  }
  return out;
}
