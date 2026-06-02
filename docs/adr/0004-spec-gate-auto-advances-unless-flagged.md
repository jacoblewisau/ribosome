# 0004. The spec gate auto-advances unless the plan flags something sensitive

- Status: accepted
- Altitude: system-wide
- Decided: 2026-06-02
- Decided by: operator decision (native-GitHub automation goal), maintainer build

## Context

The operator is a non-coder who reviews every gate. CLAUDE.md rule 6 fixes the
chain at "three human gates, not seven": story approval, spec approval, PR
merge. In practice gate 2 (the spec) is the one the operator reliably
rubber-stamps: OPERATOR.md itself tells him "you do not need to understand every
detail", and his own working note is that volume makes him approve to get
through. A gate that is always waved through is friction without safety, and
each `/approve` he must type is the annoyance this automation set out to remove.

The expensive errors (wrong assumptions) are cheapest to catch at gate 1 (the
story), which is untouched. The genuinely risky things a plan can introduce are
a small, enumerable set.

## Decision

Gate 2 becomes exception-only. The spec-writer names any sensitive-category
flags it detected; the coordinator runs a deterministic decision
(`scripts/triage.ts spec-gate`, backed by the unit-tested `src/chain/triage.ts`)
and:

- holds gate 2 for the operator when any flag is present, listing the flagged
  decision in plain language;
- otherwise auto-advances to the builder, records
  `gate_state.spec: "auto-approved"` (distinct from `"approved"` so the audit
  trail and the Mission Control board show it was not an explicit human yes),
  and posts a one-line notice.

The operator keeps the veto: `/changes` during an auto-advanced build pulls it
back to a held gate 2. The flag categories (the only things that force a stop)
are: new persistent storage of personal data, a new third-party service, a new
outbound email sender, a new dependency, anything touching authentication, and
anything touching payments.

The related Slice C decision (a `ribo:tweak` skips the story and spec gates
entirely and the PR merge is its only gate, with an escalation to the story gate
when the change exceeds 3 files or 40 lines, or trips a sensitive flag) shares
the same `triage.ts` module and is recorded here as part of the same posture
change.

## Alternatives considered

- Keep an explicit `/approve` on every gate, and only make approval easier
  (one-tap). Rejected by the operator: the rubber-stamped gate is the annoyance;
  making it faster does not remove it. The veto plus the flag list preserve the
  safety the gate actually provided.
- Auto-advance after a silence window (silent consent on all gates). Rejected as
  too broad for now: it would weaken the story gate too, where errors are
  cheapest to catch. Auto-advance is scoped to the spec gate and to tweaks.
- Put the hold/advance logic in the coordinator prose. Rejected: a one-boolean
  decision belongs in unit-tested code (CLAUDE.md rule 1 smell test), not in an
  LLM prompt that can drift.

## Consequences

Makes easy: the common path loses an interruption (roughly halves the
operator's approvals) without weakening the gate that catches expensive
mistakes. Softens the LETTER of rule 6 (a fixed three gates becomes a
risk-tiered one-to-three) while keeping its INTENT (few gates, not seven). The
softening is bounded: the story gate is untouched, the flag list forces a stop
on exactly the categories OPERATOR.md already says are worth flagging, and the
veto survives. Commits us to: the `triage.ts` contract and the structural
invariants that the flag list and the auto-approved/pull-back wiring stay
present. Revisit if: an auto-advanced build ever reaches the operator with
something he would have stopped, which would mean the flag list is too narrow.

## Sources

The build definition at `docs/explorations/native-github-bundle-build-def.md`
and the operator's two decisions on 2026-06-02 (build the native-GitHub bundle;
auto-advance the spec gate unless flagged). `src/chain/triage.ts` and its tests
are the executable form of the decision.
