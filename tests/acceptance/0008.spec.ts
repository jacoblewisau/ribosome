/**
 * Acceptance test for chain 0008 (ribo:tweak, doc-drift).
 *
 * Story: none (ribo:tweak fast-path)
 * Spec:  specs/0008.md
 * Issue: #62
 *
 * Pins the corrected README wording so the browser-evidence doc-drift cannot
 * silently recur. Reads README.md from the repo root (resolved from this test
 * file via node:url + node:path, matching the project's ESM convention) and
 * asserts the four acceptance criteria from specs/0008.md:
 *   - the stale "text-only PRs today" claim is gone (criterion 1),
 *   - the "Deferred (the one item still outstanding)" heading is gone
 *     (criterion 2),
 *   - the browser-evidence work is recorded as shipped, citing project Issue
 *     #34 and the embedded captured screens (criterion 3),
 *   - the surrounding mid-run resumption non-goal sentence survives the rewrite
 *     (criterion 4).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const thisDir = dirname(fileURLToPath(import.meta.url));
const readmePath = resolve(thisDir, "../../README.md");
const readme = readFileSync(readmePath, "utf8");

describe("chain 0008 acceptance: README browser-evidence drift removed", () => {
  it("no longer claims the chain ships text-only PRs (criterion 1)", () => {
    expect(readme).not.toContain("the chain ships text-only PRs today");
  });

  it('no longer has the "Deferred (the one item still outstanding)" heading (criterion 2)', () => {
    expect(readme).not.toContain("Deferred (the one item still outstanding)");
  });

  it("records the browser-evidence work as shipped (criterion 3)", () => {
    expect(readme).toContain("project Issue #34");
    expect(readme).toContain("embeds each captured screen");
  });

  it("preserves the mid-run resumption non-goal sentence (criterion 4)", () => {
    expect(readme).toContain("remains a deliberate non-goal");
  });
});
