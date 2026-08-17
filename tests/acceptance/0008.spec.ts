/**
 * Acceptance test for chain 0008.
 *
 * Spec: specs/0008.md (ribo:tweak, no story gate)
 *
 * Machine-readable contract (CLAUDE.md rule 4) that stops the README branch-
 * protection checklist from drifting away from the real workflow job names:
 *   - the required-check names the README tells the maintainer to require must
 *     each be an actual job `name:` in .github/workflows/checks.yml (guards
 *     against phantom names like "lint" or "acceptance tests" returning),
 *   - and all three real job names (typecheck, test, verify) must be present.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// Vitest runs with cwd at the repo root (same convention as 0006.spec.ts).
function readRepo(relativeToRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), relativeToRepoRoot), "utf8");
}

// Indented `name:` lines are job names; the column-0 `name: checks` workflow
// name is not indented and is therefore excluded.
function jobNames(yml: string): Set<string> {
  const names = new Set<string>();
  for (const [, name] of yml.matchAll(/^\s+name:\s*(\S+)\s*$/gm)) {
    if (name !== undefined) names.add(name);
  }
  return names;
}

// Backtick-quoted, job-name-shaped tokens on the "Require status checks" bullet.
// Paths and commands (`.github/...`, `npm test`) are not single job names.
function requiredChecks(readme: string): string[] {
  const marker = "- [ ] Require status checks to pass before merging";
  const start = readme.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const rest = readme.slice(start + marker.length);
  const end = rest.indexOf("- [ ]");
  const bullet = end === -1 ? rest : rest.slice(0, end);
  return [...bullet.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1])
    .filter((t): t is string => t !== undefined && /^[a-z][a-z0-9-]*$/.test(t));
}

describe("chain 0008 acceptance: README required checks match checks.yml jobs", () => {
  const jobs = jobNames(readRepo(".github/workflows/checks.yml"));
  const required = requiredChecks(readRepo("README.md"));

  it("names every required check as a real checks.yml job", () => {
    for (const name of required) expect([...jobs]).toContain(name);
  });

  it("names all three real job names (typecheck, test, verify)", () => {
    expect(new Set(required)).toEqual(new Set(["typecheck", "test", "verify"]));
  });
});
