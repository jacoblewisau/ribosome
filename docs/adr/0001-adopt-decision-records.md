# 0001. Adopt decision records and a domain glossary

- Status: accepted
- Altitude: system-wide
- Decided: 2026-05-29
- Decided by: maintainer in session 5

## Context

Ribosome's operator designs ambitious software but does not code, and cannot
evaluate the engineering decisions made inside a chain run. Two gaps followed.
First, decisions made for one feature evaporated: they lived implicitly in a
spec and in per-chain live memory, so a later feature could silently contradict
an earlier choice. Second, the operator's domain language (the terms only he
knows precisely) was never captured, so the chain could not reliably speak in
his terms. The repo had no glossary and no decision log; CLAUDE.md held standing
rules and the distilled store held learned lessons, but neither is a record of a
specific decision and its rationale.

## Decision

Adopt the context-map plus ADR convention (adapted from Matt Pocock's
grill-with-docs) at three altitudes: a root `CONTEXT.md` glossary for domain
terms, numbered ADRs in `docs/adr/` for decisions, and the existing `CLAUDE.md`
for standing rules. Decisions are captured at the altitude that fits and may be
promoted upward (spec line, then context-specific ADR, then system-wide ADR,
then a CLAUDE.md rule via rule-miner). The convention is documented in
`.claude/skills/decision-records/SKILL.md`.

## Alternatives considered

- **Keep decisions in specs only.** Rejected: no cross-feature continuity; a
  later feature cannot see an earlier decision.
- **Put everything in CLAUDE.md.** Rejected: CLAUDE.md is for standing rules and
  is bounded to 100-300 lines and gated by rule-miner; it is the wrong altitude
  and the wrong write path for routine decisions.
- **Use the distilled memory store.** Rejected: distilled memory captures
  learned patterns from past runs, not deliberate decisions with rationale and
  alternatives. Different artefact, different writer (the Dreaming pass).

## Consequences

Makes easy: decision continuity across features, a glossary the chain can speak
from, and a clear promotion path from soft to hard memory. Makes harder: there
is one more place to look, and producers must triage what is worth an ADR (the
three-criteria gate exists to keep this small). Commits us to: spec-writer (and
later the planner) proposing system-wide ADRs and glossary entries through the
gate rather than writing them silently. Revisit if: ADRs proliferate past the
three-criteria gate, or the glossary starts accumulating implementation detail.
