/**
 * Acceptance test for chain 0008.
 *
 * Story: none (ribo:tweak fast-path).
 * Spec:  specs/0008.md
 *
 * Pins the patch/minor group bump from Issue #87 in both manifests, so a future
 * lockfile rewrite that reverts any of the four fails here. For each package it
 * asserts three things:
 *   - package.json declares the tightened caret range in the correct map,
 *   - package-lock.json resolves node_modules/<pkg> to the target version,
 *   - the lockfile root range matches package.json, so the two files agree and
 *     npm ci stays consistent.
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
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface PackageLock {
  packages: Record<
    string,
    {
      version?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }
  >;
}

type ManifestMap = "dependencies" | "devDependencies";

interface Bump {
  pkg: string;
  map: ManifestMap;
  range: string;
  resolved: string;
}

const bumps: Bump[] = [
  { pkg: "react", map: "dependencies", range: "^19.2.7", resolved: "19.2.7" },
  {
    pkg: "react-dom",
    map: "dependencies",
    range: "^19.2.7",
    resolved: "19.2.7",
  },
  {
    pkg: "@types/react",
    map: "devDependencies",
    range: "^19.2.17",
    resolved: "19.2.17",
  },
  {
    pkg: "playwright",
    map: "devDependencies",
    range: "^1.61.1",
    resolved: "1.61.1",
  },
];

describe("chain 0008 acceptance: patch/minor group bump (Issue #87)", () => {
  for (const { pkg, map, range, resolved } of bumps) {
    it(`package.json declares ${pkg} at "${range}" in ${map}`, () => {
      const manifest = readRepoJson("package.json") as PackageJson;
      expect(manifest[map][pkg]).toBe(range);
    });

    it(`package-lock.json resolves ${pkg} to ${resolved} and agrees with package.json`, () => {
      const lock = readRepoJson("package-lock.json") as PackageLock;

      const entry = lock.packages[`node_modules/${pkg}`];
      expect(entry).toBeDefined();
      if (entry === undefined) {
        throw new Error(`node_modules/${pkg} missing from package-lock.json`);
      }
      expect(entry.version).toBe(resolved);

      const rootEntry = lock.packages[""];
      expect(rootEntry).toBeDefined();
      if (rootEntry === undefined) {
        throw new Error("root entry missing from package-lock.json");
      }
      expect(rootEntry[map]?.[pkg]).toBe(range);
    });
  }
});
