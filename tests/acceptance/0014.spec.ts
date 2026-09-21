/**
 * Acceptance test for chain 0014.
 *
 * Spec: specs/0014.md (ribo:tweak fast-path; no story)
 *
 * Pins the eight same-major dependency bumps in both manifests, so a future
 * lockfile rewrite that reverts any of them fails here. For each package:
 *   - package.json declares the caret floor at the new target (criterion 1),
 *   - package-lock.json resolves node_modules/<pkg> to the pinned version
 *     (criterion 2), so the two files agree and npm ci stays consistent.
 *
 * It reads the two JSON files from disk rather than importing them, so the
 * test asserts the on-disk manifests an operator (or npm ci) would see. This
 * mirrors tests/acceptance/0006.spec.ts.
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
  packages: Record<string, { version?: string }>;
}

const bumps: ReadonlyArray<{
  name: string;
  section: "dependencies" | "devDependencies";
  target: string;
}> = [
  { name: "react", section: "dependencies", target: "19.3.0" },
  { name: "react-dom", section: "dependencies", target: "19.3.0" },
  { name: "@testing-library/dom", section: "devDependencies", target: "10.4.2" },
  { name: "@testing-library/react", section: "devDependencies", target: "16.3.3" },
  { name: "@types/node", section: "devDependencies", target: "25.9.8" },
  { name: "@types/react", section: "devDependencies", target: "19.3.0" },
  { name: "@types/react-dom", section: "devDependencies", target: "19.3.0" },
  { name: "playwright", section: "devDependencies", target: "1.63.0" },
];

describe("chain 0014 acceptance: same-major dependency bumps", () => {
  const pkg = readRepoJson("package.json") as PackageJson;
  const lock = readRepoJson("package-lock.json") as PackageLock;

  for (const { name, section, target } of bumps) {
    it(`package.json declares ${name} at "^${target}"`, () => {
      expect(pkg[section][name]).toBe(`^${target}`);
    });

    it(`package-lock.json resolves ${name} to ${target}`, () => {
      const entry = lock.packages[`node_modules/${name}`];
      expect(entry).toBeDefined();
      if (entry === undefined) {
        throw new Error(`node_modules/${name} missing from package-lock.json`);
      }
      expect(entry.version).toBe(target);
    });
  }
});
