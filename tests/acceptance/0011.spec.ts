/**
 * Acceptance test for chain 0011.
 *
 * Spec:  specs/0011.md
 * Issue: #72 (doc-drift: CLAUDE.md Stack table claimed an `engines` field in
 *        package.json that was absent).
 *
 * Pins the fix so a future package.json rewrite that drops the field fails
 * here:
 *   - engines is present (criterion a),
 *   - engines.node is a string (criterion b),
 *   - engines.node === ">=22", the value that makes the CLAUDE.md Stack-table
 *     claim accurate (criterion c).
 *
 * It reads package.json from disk rather than importing it, so the test asserts
 * the on-disk manifest a maintainer or nvm would see (chain 0006 convention).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

function readRepoJson(relativeToRepoRoot: string): unknown {
  // Vitest runs with cwd at the repo root (see hooks.test.ts for the same
  // convention), so the manifest path resolves from there.
  return JSON.parse(
    readFileSync(resolve(process.cwd(), relativeToRepoRoot), "utf8"),
  );
}

interface PackageJson {
  engines?: { node?: unknown };
}

describe("chain 0011 acceptance: package.json declares Node engines", () => {
  it("engines is present", () => {
    const pkg = readRepoJson("package.json") as PackageJson;
    expect(pkg.engines).toBeDefined();
  });

  it("engines.node is a string", () => {
    const pkg = readRepoJson("package.json") as PackageJson;
    expect(typeof pkg.engines?.node).toBe("string");
  });

  it('engines.node === ">=22"', () => {
    const pkg = readRepoJson("package.json") as PackageJson;
    expect(pkg.engines?.node).toBe(">=22");
  });
});
