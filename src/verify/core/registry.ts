/**
 * Verify registry. Central place units and verifiers register
 * themselves. Importing a spec file (`*.verify.ts`) is what triggers
 * registration. The matrix runner walks the registry; new units and
 * verifiers appear in the matrix without harness code changes.
 */

import type { Verifier, VerifiableUnit } from "./types";

const _units = new Map<string, VerifiableUnit>();
const _verifiers = new Map<string, Verifier>();

export function registerUnit(unit: VerifiableUnit): void {
  if (_units.has(unit.name)) {
    throw new Error(`verify: duplicate unit name "${unit.name}"`);
  }
  _units.set(unit.name, unit);
}

export function registerVerifier(verifier: Verifier): void {
  if (_verifiers.has(verifier.name)) {
    throw new Error(`verify: duplicate verifier name "${verifier.name}"`);
  }
  _verifiers.set(verifier.name, verifier);
}

export function getUnits(): ReadonlyArray<VerifiableUnit> {
  return Array.from(_units.values());
}

export function getVerifiers(): ReadonlyArray<Verifier> {
  return Array.from(_verifiers.values());
}

export function getUnit(name: string): VerifiableUnit | undefined {
  return _units.get(name);
}

/**
 * Reset the registry. Test-only. Vitest re-imports specs in each test
 * file context; if we share registry state across files the duplicate
 * check above triggers spuriously. The matrix.test.ts entry point
 * resets at the top of its file.
 */
export function _resetRegistryForTests(): void {
  _units.clear();
  _verifiers.clear();
}
