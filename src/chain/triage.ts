/**
 * Gate triage. Slices B and C of the native-GitHub bundle.
 *
 * Two decisions the chain must make mechanically rather than by LLM whim, so
 * they never drift:
 *
 *  - Spec gate (Slice B): given the sensitive-category flags the spec-writer
 *    detected, decide whether to HOLD the spec gate for the operator or
 *    AUTO-ADVANCE to the builder. Any flag holds; an empty list advances.
 *  - Tweak size (Slice C): given the size of a tweak's change, decide whether
 *    it is small enough for the no-gate fast-path or must ESCALATE to the
 *    story gate.
 *
 * The judgment (reading the spec, naming the flags, measuring the change) is
 * the agent's; the decision is code. Pure: no I/O. The CLI wrapper is
 * scripts/triage.ts.
 */

/**
 * The categories that force a human stop at the spec gate. If the spec-writer
 * finds any of these, the operator is asked before the build proceeds. This
 * list is the contract; it is mirrored in plain language in the spec-writer
 * skill and in OPERATOR.md, and the eval suite checks the three do not drift.
 */
export const FLAG_CATEGORIES = [
  "personal-data", // new persistent storage of personal data
  "third-party-service", // a new third-party service or integration
  "email-sender", // a new outbound email address or sender
  "new-dependency", // a new package or dependency
  "auth", // anything touching authentication
  "payments", // anything touching payments or money
] as const;

export type FlagCategory = (typeof FLAG_CATEGORIES)[number];

export interface SpecGateDecision {
  /** True -> hold gate 2 for the operator. False -> auto-advance to builder. */
  needs_operator: boolean;
  /** The cleaned list of reasons the gate is held (empty when auto-advancing). */
  flags: string[];
}

/**
 * Decide the spec gate. Any non-empty flag list holds the gate for the
 * operator; an empty list auto-advances. The operator keeps the veto via
 * `/changes` regardless (handled by the coordinator), so auto-advance is never
 * irreversible.
 */
export function decideSpecGate(
  flags: ReadonlyArray<string> | null | undefined
): SpecGateDecision {
  const clean = (flags ?? []).map((f) => String(f).trim()).filter((f) => f.length > 0);
  return { needs_operator: clean.length > 0, flags: clean };
}

/**
 * The size budget for the tweak fast-path. A change within BOTH limits skips
 * the story and spec gates (the PR merge is the only gate). Over either limit,
 * the change escalates to the story gate so a mis-filed large change cannot
 * slip through ungated. Starting values; tune from the first real tweaks.
 */
export const TWEAK_BUDGET = { files: 3, lines: 40 } as const;

export interface TweakSizeDecision {
  withinBudget: boolean;
  escalate: boolean;
  reason: string;
}

/**
 * Decide whether a change is tweak-sized. Fails safe: an unknown (non-finite)
 * size escalates to the story gate rather than slipping onto the fast-path.
 */
export function evaluateTweakSize(change: {
  files: number;
  lines: number;
}): TweakSizeDecision {
  if (!Number.isFinite(change.files) || !Number.isFinite(change.lines)) {
    return {
      withinBudget: false,
      escalate: true,
      reason: "unknown change size; escalate to the story gate to be safe",
    };
  }
  const overFiles = change.files > TWEAK_BUDGET.files;
  const overLines = change.lines > TWEAK_BUDGET.lines;
  if (overFiles || overLines) {
    const parts: string[] = [];
    if (overFiles) parts.push(`${change.files} files over ${TWEAK_BUDGET.files}`);
    if (overLines) parts.push(`${change.lines} lines over ${TWEAK_BUDGET.lines}`);
    return {
      withinBudget: false,
      escalate: true,
      reason: `bigger than a tweak (${parts.join(", ")}); escalate to the story gate`,
    };
  }
  return {
    withinBudget: true,
    escalate: false,
    reason: `within the tweak budget (at most ${TWEAK_BUDGET.files} files and ${TWEAK_BUDGET.lines} lines)`,
  };
}
