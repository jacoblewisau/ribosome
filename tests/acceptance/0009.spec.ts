/**
 * Acceptance test for chain 0009.
 *
 * Issue: #71 (ribo:tweak)
 * Spec:  specs/0009.md
 *
 * Reads README.md from disk and asserts the stale "dream nightly cron"
 * sentence was corrected:
 *   - the stale phrase "nightly cron" is gone,
 *   - the corrected clause "manually by the maintainer" landed,
 *   - the dream skill reference is preserved. The phrase wraps across two
 *     lines in the source ("the dream\nskill"), so we assert the contiguous
 *     substring "the dream" per the spec.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const readmePath = resolve(here, "../../README.md");
const readme = readFileSync(readmePath, "utf8");

describe("chain 0009 acceptance: corrected dream cost-expectation sentence", () => {
  it('no longer contains the stale phrase "nightly cron"', () => {
    expect(readme).not.toContain("nightly cron");
  });

  it('contains the corrected clause "manually by the maintainer"', () => {
    expect(readme).toContain("manually by the maintainer");
  });

  it('preserves the dream skill reference (substring "the dream")', () => {
    expect(readme).toContain("the dream");
  });
});
