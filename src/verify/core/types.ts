/**
 * Verify core types.
 *
 * Faithful reimplementation of the verifiable-React pattern from
 * cwc-workshops/how-we-claude-code/phase-3-verify. The names and shapes
 * track that workshop on purpose; the validator depends on them.
 */

import type { ZodTypeAny } from "zod";
import type { ReactElement } from "react";

/** Verdict applied to a fixture run. */
export type Verdict = "PASS" | "FAIL" | "BLOCKED" | "SKIP";

/** Status of a single check within a fixture run. */
export type CheckStatus = "ok" | "fail" | "warn" | "probe";

/** One structured assertion result emitted by a verifier. */
export interface Check {
  verifier: string;
  status: CheckStatus;
  reason?: string;
  /** Optional structured detail for debugging or display. */
  detail?: unknown;
}

/**
 * Fixture: a named, reproducible render configuration. `act` optionally
 * drives interaction after mount. `probe: true` marks an adversarial
 * case designed to surface a failure; the matrix runner records the
 * outcome but does not fail CI on probe failures.
 */
export interface Fixture<TProps = unknown> {
  name: string;
  /** Props passed to the unit's component, or () => element for full control. */
  render: () => ReactElement;
  /** Optional imperative steps after mount. Returns a promise that resolves when done. */
  act?: (container: HTMLElement) => Promise<void> | void;
  /** Optional explicit invariants for this fixture (in addition to the unit's defaults). */
  invariants?: Array<(dom: HTMLElement) => boolean | string>;
  /** Adversarial fixture: surfaces failures, does not fail CI. */
  probe?: boolean;
  /** Mark the props field. Not all fixtures need props (TodoApp wraps state internally). */
  props?: TProps;
}

/**
 * VerifiableUnit: a component or feature module registered for verification.
 * The name is the addressable identifier (used in /verify/:unit/:fixture
 * once the dashboard is wired in Phase 3).
 */
export interface VerifiableUnit<TProps = unknown> {
  name: string;
  /** Zod schema for the unit's props. Used by the schema verifier. */
  props: ZodTypeAny;
  fixtures: ReadonlyArray<Fixture<TProps>>;
}

/**
 * Verifier: pluggable. Receives the mounted DOM and the unit, returns
 * a list of checks. The runner aggregates checks across verifiers to
 * compute the verdict.
 */
export interface Verifier {
  name: string;
  /**
   * Run against the mounted container and the unit. May read fixture
   * state to know whether this is a probe (so the verifier can record
   * an expected failure differently).
   */
  run: (
    container: HTMLElement,
    unit: VerifiableUnit,
    fixture: Fixture
  ) => Check[] | Promise<Check[]>;
}

/** Result of running one fixture across all registered verifiers. */
export interface FixtureResult {
  unit: string;
  fixture: string;
  probe: boolean;
  verdict: Verdict;
  checks: Check[];
  /** Wall time for this fixture run in milliseconds. */
  durationMs: number;
}

/** Result of running the full matrix. */
export interface MatrixResult {
  totalUnits: number;
  totalFixtures: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  probeFailuresExpected: number;
  results: FixtureResult[];
}
