/**
 * STATE.md builder. Phase: conflict-free-state (session 6).
 *
 * STATE.md was a single hot file that every landed change rewrote (Rule 15),
 * so concurrent PRs always conflicted on it (the classic shared-changelog
 * problem). The fix is the news-fragment pattern: each change adds a uniquely
 * named fragment under `state.d/`, and STATE.md is ASSEMBLED from those
 * fragments plus a small curated header. Two PRs adding different fragments
 * never touch the same file, so they never conflict.
 *
 * `.gitattributes merge=union` is local defense-in-depth only: GitHub's
 * web/API merge does not honor user-defined merge drivers (verified
 * 2026-06-02), so the fragment pattern, not the merge driver, is the fix.
 *
 * This module is pure (dir in, string out) so it is unit-testable without
 * touching the real repo. `scripts/state-build.ts` is the CLI wrapper.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The curated header fragment: current truth, open work, what-not-to-do. */
export const HEADER_FRAGMENT = "0000-current.md";

/** Non-fragment files in state.d/ that are not part of the assembled output. */
const NON_FRAGMENTS = new Set(["README.md", HEADER_FRAGMENT]);

export const GENERATED_BANNER = [
  "<!-- GENERATED FILE - do not edit by hand.",
  "     STATE.md is assembled from state.d/ by `npm run state:build`.",
  "     To record a change, add a fragment state.d/<id>-<slug>.md; never edit",
  "     STATE.md directly. Feature PRs add a fragment and do not rebuild STATE.md,",
  "     so they never collide on it (the rebuild is serial). See",
  "     goals/conflict-free-state.md. -->",
].join("\n");

/**
 * Assemble STATE.md from the fragments in `dir`.
 *
 * Layout: banner, then the curated header (0000-current.md verbatim), then a
 * "Shipped log" section with every other fragment, newest first (fragment
 * filenames sort lexically; a `YYYY-MM-DD-` or zero-padded `<id>-` prefix
 * keeps them ordered).
 */
export function buildState(dir: string): string {
  const all = readdirSync(dir).filter((f) => f.endsWith(".md"));

  const header = all.includes(HEADER_FRAGMENT)
    ? readFileSync(join(dir, HEADER_FRAGMENT), "utf8").trim()
    : "";

  const fragments = all
    .filter((f) => !NON_FRAGMENTS.has(f))
    .sort()
    .reverse(); // newest (lexically largest prefix) first

  const parts: string[] = [GENERATED_BANNER, ""];
  if (header) parts.push(header, "");
  parts.push("## Shipped log", "");
  if (fragments.length === 0) {
    parts.push("_No shipped-log fragments yet._", "");
  }
  for (const f of fragments) {
    parts.push(readFileSync(join(dir, f), "utf8").trim(), "");
  }

  return parts.join("\n").trimEnd() + "\n";
}
