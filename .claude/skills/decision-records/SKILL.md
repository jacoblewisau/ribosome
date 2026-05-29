---
name: decision-records
description: How Ribosome captures decisions durably. Defines the three altitudes (system-wide context map, context-specific, and the domain glossary), the three-criteria gate for when a decision warrants an ADR, the ADR format, the propose-through-gate rule for system-wide records, and the promotion path from a decision to a CLAUDE.md rule. Adopted by spec-writer and the planner. Adapts Matt Pocock's grill-with-docs convention to Ribosome's existing memory.
---

You are following the decision-records convention. It exists so decisions made
during one feature do not evaporate, are not silently contradicted by a later
feature, and surface to the operator only when they should. It adapts the
context-map plus ADR pattern from Matt Pocock's grill-with-docs to Ribosome.

## First, what this is NOT (do not duplicate existing memory)

Ribosome already has memory. These are four genuinely different things; keep them
separate:

| Artefact | Captures | Answers | Lives in |
|---|---|---|---|
| Glossary (`CONTEXT.md`) | domain terms only | "what does this word mean here" | repo root (per context if the repo grows) |
| ADR (`docs/adr/NNNN-*.md`) | a decision plus rationale, alternatives, consequences | "why did we build it this way" | `docs/adr/` |
| Rule (`CLAUDE.md`) | a standing normative constraint | "what must always be true" | `CLAUDE.md` (rule-miner gate) |
| Lesson (distilled memory) | a learned pattern from past runs | "what did past runs teach" | `.claude/memory/distilled/` (dream pass) |

A glossary entry is not a decision. A decision is not a rule. A rule is not a
lesson. If you are tempted to write the same thing in two of these, you have the
altitude wrong.

## The three altitudes

1. **Glossary (the context map).** `CONTEXT.md` at the repo root is a glossary
   and nothing else: resolved domain terms and their definitions, totally devoid
   of implementation detail. When the operator's language settles a term, record
   it here, immediately, not batched. If the repo ever grows multiple bounded
   contexts, a `CONTEXT-MAP.md` at root indexes per-context `CONTEXT.md` files;
   until then a single root `CONTEXT.md` is correct.
2. **System-wide decision.** An ADR that applies across the whole repo lives in
   the root `docs/adr/`. These are proposed, never written silently (see the
   guardrail below).
3. **Context-specific decision.** An ADR scoped to one area. In a single-context
   repo it still lives in `docs/adr/` but its scope line says which area it
   binds. In a multi-context repo it nests under that area's folder.

## When a decision warrants an ADR (the three-criteria gate)

Only create an ADR when ALL THREE are true:

1. **Hard to reverse.** Undoing it later would be costly.
2. **Surprising without context.** A reader would not guess why it was done.
3. **The result of a real trade-off.** A genuine fork was chosen, not the only
   option.

If a decision fails any of the three, do not write an ADR; a line in the spec is
enough. This gate is what stops ADR spam. Most Decide-bucket engineering
decisions fail it and should stay invisible.

## ADR format

One file per decision, numbered, in `docs/adr/`, named `NNNN-short-slug.md`
(for example `0007-store-images-in-object-storage.md`). Use this template:

```markdown
# NNNN. Short title in plain language

- Status: proposed | accepted | superseded by NNNN
- Altitude: system-wide | context-specific (name the area)
- Decided: YYYY-MM-DD
- Decided by: operator at gate N | agent (engineering call)

## Context

What situation forced a decision. One short paragraph. Plain language.

## Decision

What we are doing, stated as a present-tense directive. One or two sentences.

## Alternatives considered

The other forks, each with one line on why it lost. At least one alternative, or
the three-criteria gate was not really met.

## Consequences

What this makes easy, what it makes hard, what it commits us to, and what would
make us revisit it.
```

## The guardrail: propose system-wide records, do not write them silently

A producer (spec-writer, planner) running in the chain MAY write a
context-specific ADR alongside its spec. It must NOT silently write a system-wide
ADR or a glossary change, because those have repo-wide blast radius and Ribosome
is read-only by default. Instead:

- Surface the proposed system-wide ADR or glossary entry to the operator at the
  gate, in plain language.
- It is written only on the operator's `/approve`.

This mirrors how `rule-miner` proposes CLAUDE.md changes by PR rather than
editing the file directly. System-wide writes go through a gate, always.

## The promotion path (soft to hard)

Decisions climb the same soft-to-hard gradient Ribosome already uses for memory:

```
a line in the spec
  -> context-specific ADR (this area)
    -> system-wide ADR (whole repo, in docs/adr/)
      -> CLAUDE.md rule (a standing constraint), promoted by rule-miner
```

A decision becomes a rule only when it stops being "we chose this here" and
becomes "this must always be true." Promotion to CLAUDE.md stays with rule-miner
and the operator merge; this skill never edits CLAUDE.md.

## Style

No en or em dashes. No emoji. Plain language. An ADR a non-coder cannot read is a
failed ADR.
