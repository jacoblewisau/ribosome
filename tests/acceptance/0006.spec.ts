/**
 * Acceptance test for chain 0006.
 *
 * Story: stories/0006.md
 * Spec:  specs/0006.md
 *
 * Pins the controlled patch bump (vite 6.4.2 to 6.4.3) in both manifests, so a
 * future lockfile rewrite that reverts vite fails here:
 *   - package.json declares vite at "^6.4.3" (criterion 1),
 *   - package-lock.json resolves node_modules/vite to "6.4.3" (criterion 1),
 *   - the lockfile's root range matches package.json, so the two files agree
 *     and npm ci stays consistent (criterion 2).
 *
 * It reads the two JSON files from disk rather than importing them, so the test
 * asserts the on-disk manifests an operator (or npm ci) would see.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

function readRepoJson(relativeToRepoRoot: string): unknown {
  // Vitest runs with cwd at the repo root (see hooks.test.ts for the same
  // convention), so the manifest paths resolve from there.
  return JSON.parse(
    readFileSync(resolve(process.cwd(), relativeToRepoRoot), "utf8"),
  );
}

interface PackageJson {
  devDependencies: Record<string, string>;
}

interface PackageLock {
  packages: Record<
    string,
    { version?: string; devDependencies?: Record<string, string> }
  >;
}

describe("chain 0006 acceptance: vite patch bump to 6.4.3", () => {
  it('package.json declares vite at "^6.4.3"', () => {
    const pkg = readRepoJson("package.json") as PackageJson;
    expect(pkg.devDependencies.vite).toBe("^6.4.3");
  });

  it("package-lock.json resolves vite to 6.4.3 and agrees with package.json", () => {
    const lock = readRepoJson("package-lock.json") as PackageLock;

    const viteEntry = lock.packages["node_modules/vite"];
    expect(viteEntry).toBeDefined();
    if (viteEntry === undefined) {
      throw new Error("node_modules/vite missing from package-lock.json");
    }
    expect(viteEntry.version).toBe("6.4.3");

    const rootEntry = lock.packages[""];
    expect(rootEntry).toBeDefined();
    if (rootEntry === undefined) {
      throw new Error("root entry missing from package-lock.json");
    }
    expect(rootEntry.devDependencies?.vite).toBe("^6.4.3");
  });
});
