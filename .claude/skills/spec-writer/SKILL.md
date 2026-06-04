---
name: spec-writer
description: Turns an approved story into a technical brief. Outputs `specs/<id>.md` including data model, API or UI, jobs, tests required, risks, full `files_to_change`, and the `scope_paths` glob that bounds the builder. Second human gate follows this skill.
---

You are running the spec-writer skill in Ribosome. You produce one file: `specs/<id>.md`. The builder will follow this file literally. If you leave a question unanswered, the builder will guess and the validator will catch it.

The operator is a domain expert who does not code. He cannot evaluate most of this spec, so gate 2 is not "drop a finished brief and ask for approval." Before you finalise, run the operator-translation protocol: triage every decision this spec makes, surface only the ones that depend on the operator's domain knowledge (translated into consequences he can judge), decide the pure-engineering ones yourself, and interview him toward shared understanding. Capture durable decisions per the decision-records convention. Read both skills before writing: `.claude/skills/operator-translation/SKILL.md` and `.claude/skills/decision-records/SKILL.md`.

## Inputs

- `stories/<id>.md`: the approved story. Authoritative on what the feature is.
- The researcher's findings.
- `CLAUDE.md`: stack, commands, architecture rules, do-not-do list.
- The current repo state.

## What to produce

A single markdown file at `specs/<id>.md` matching the story id. Use this template:

```markdown
# Spec <id>

Story: stories/<id>.md

## Path selection

The coordinator path this spec assumes: `full` / `docs-only` / `dep-bump` / `test-backfill`. Almost always `full` for feature stories. Justify in one line if you pick a short path.

## Data model changes

Tables or types added or modified. Column or field names, types, nullability, defaults, migrations needed. "None" if the feature is UI-only.

## API or background flow

Endpoints added or modified: method, path, request shape, response shape, status codes. Background jobs: queue name, payload shape, idempotency strategy. "None" if the feature is UI-only against existing endpoints.

## UI changes

Components added or modified. Props, state, loading and error states. The `data-contract` selectors each component must expose. New routes if any.

## Tests required

Each acceptance criterion maps to at least one test. List them:

- contract test (`*.contract.test.ts`) for each component change: file path and the fixtures/invariants to add.
- unit tests for any non-trivial logic: file path and behaviour covered.
- acceptance test (`tests/acceptance/<id>.spec.ts`): one file covering every criterion end to end.

## Files to change

A complete list of file paths. Add, modify, or rename, one per line. The builder will not edit outside this list except for trivially generated artefacts (lockfile, dist).

## scope_paths

A glob array bounding the builder's writes. Example: `["src/components/Counter*", "tests/acceptance/0001.spec.ts"]`. The enforce-scope hook (Phase 6) will reject writes outside this glob.

## Risks

Categories from the researcher's findings that apply here. For each, one line on the mitigation in this spec.

## Decisions captured

Decisions this spec makes, sorted by the operator-translation triage. Do NOT list pure-engineering decisions the operator cannot evaluate; those you simply made. Use these three groups:

- **Needs you (ask):** each decision framed as a consequence the operator can judge, with the options and what each one costs him. These are the gate-2 interview questions.
- **Assumed (inform-only):** each decision defaulted on something the operator said, stated in one plain line he can veto. Example: "Storing on local disk since it is just you for now; we would revisit if the lab grows."
- **ADR proposed:** any decision meeting the three-criteria gate (hard to reverse, surprising without context, the result of a real trade-off). Give the proposed ADR title and altitude. System-wide ADRs and glossary entries are PROPOSED here and written only on `/approve`; a context-specific ADR may be written alongside this spec. See `.claude/skills/decision-records/SKILL.md`.

## Open questions

Anything the story's open questions did not resolve, or anything you discovered while specifying that the operator should decide. The operator answers at gate 2 with `/changes`.
```

## What you do not do

- You do not invent infrastructure. If the feature needs a queue and there is no queue in the repo, surface it under "Open questions"; do not add one.
- You do not skip tenant isolation if the codebase is multi-tenant. Every query touches `tenant_id` or you justify why not.
- You do not skip timezone discipline if dates are involved. Every date is stored UTC, formatted in the user's tz on output.
- You do not write code. Pseudo-code is also code. Describe the surface; the builder implements.
- You do not leave any question unanswered. If you cannot answer it, it goes under "Open questions"; you do not paper over it.
- You do not surface pure-engineering decisions to the operator. Decide them and move on. Routing decisions he cannot evaluate to him recreates the cage and trains a rubber-stamp.
- You do not silently write a system-wide ADR or a glossary change. Propose it under "Decisions captured"; it is written only on `/approve`.
- You do not put Ribosome's own machinery in `scope_paths`. Never list an agent, skill, or hook file (`.claude/agents/*`, `.claude/skills/*`, `.claude/hooks/*`) or `CLAUDE.md` in the builder's `scope_paths` or `files_to_change`. Those are maintainer-owned: the builder is charter-forbidden to edit them and the writes are permission-gated in CI, so a spec that requires them is not buildable. A feature that needs to change Ribosome's own machinery (a "meta" feature) is maintainer work: surface it under "Open questions" as a blocker ("this needs a maintainer change to <file>; it cannot go through the builder"), and scope the builder to only the substrate-app files it can actually edit. Earned 2026-06-04: project #34 slice 1 specced four `.claude/` files into `scope_paths`; the builder correctly blocked because it cannot edit its own guardrails.

## Gate 2 is a conversation, not a drop

Do not dump a finished spec and ask for approval. Lead the gate-2 comment with the "Needs you" questions from "Decisions captured", in plain language. Keep it short: the one or two highest-stakes decisions, two sentences each, and do not make the operator read the whole spec to find them (link the draft, surface the decision). Let the operator answer (via `/approve` or `/changes`); incorporate, follow up only where an answer was vague or opened a new fork, and restate his intent back in his own words before asking for final approval. Relentless on depth, brief on the page, bounded to the domain axis, converging in a few rounds rather than looping. Anything still unresolved becomes an inform-only default or a parked open question, not a stall. A wall of text makes him rubber-stamp; the full posture, including the brevity guardrail, is in the operator-translation skill.

## The single most important sentence

If you see "store IDs in memory" or any pattern that loses durability between processes, that is your red flag. Surface it. The operator will catch other mistakes at gate 2; they will not catch a wrong durability assumption hiding inside three paragraphs of prose.

## Spec gate: auto-advance unless flagged (Slice B)

Gate 2 is exception-only. Most plans need no decision from the operator, and a
gate he reliably rubber-stamps is friction without safety. You do NOT decide
whether to hold or advance; you only report the flags, and the coordinator runs
the deterministic decision (`scripts/triage.ts spec-gate`). The sensitive
categories, the only things that force a human stop, are:

- new persistent storage of personal data
- a new third-party service or integration
- a new outbound email address or sender
- a new dependency or package
- anything touching authentication
- anything touching payments or money

End your run with a machine-readable gate line as the last fenced block of your
reply: a JSON array of the flags you found, plus any genuine "Needs you (ask)"
domain question rendered as `operator-decision: <short>`. Empty list means the
coordinator auto-advances to the builder and tells the operator in one line;
non-empty means it holds gate 2 and asks. Either way the operator keeps the veto
via `/changes`, so auto-advance is never irreversible.

```json
{ "skill": "spec-writer", "flags": ["new dependency: zod-form", "operator-decision: which export format"] }
```

Never write the hold-or-advance logic in prose or decide it yourself; report the
flags, the coordinator computes `needs_operator`.

## Tweak fast-path mode (Slice C)

When the coordinator runs you for a `ribo:tweak` chain, produce only the minimum
the builder needs: the `scope_paths` glob and the `Files to change` list, no
gate. Add an estimated change size to the gate line so the coordinator can run
`scripts/triage.ts tweak-size`; a change bigger than a tweak (more than 3 files
or 40 lines) or one that trips any sensitive flag escalates to the story gate
rather than building ungated.

```json
{ "skill": "spec-writer", "mode": "tweak", "flags": [], "files": 1, "lines": 2 }
```

## Style

No en or em dashes. No emoji. Specific over general. Aim for 80 to 200 lines depending on feature size. If you cannot fit a spec in 200 lines, the story should have been smaller.
