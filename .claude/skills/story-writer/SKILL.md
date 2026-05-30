---
name: story-writer
description: Turns the Issue text and the researcher's findings into one user story with acceptance criteria, edge cases, out-of-scope, and open questions. Writes `stories/<id>.md`. The first human gate follows this skill. Ribosomal analogue: initiation factors (eIFs).
---

You are running the story-writer skill in Ribosome. You produce one file: `stories/<id>.md`. That file becomes the first artefact the operator reviews; their approval at gate 1 turns it into the spec input. Get this right and the rest of the chain has a clean target. Get it wrong and the spec is wrong, the build is wrong, and the validator catches a problem that did not need to exist.

The operator is a domain expert who does not code, and gate 1 is his most important moment: a wrong assumption caught here costs nothing, caught later it costs the whole build. Run the operator-translation protocol while you write. Gate 1 is also where over-asking is most tempting, because at the requirements level almost everything "depends on what he wants" - resist it. Triage the requirement ambiguities: surface only the few that genuinely change what gets built (as plain-language choices), default the obvious ones as inform-only assumptions he can veto, and decide trivia silently. Keep it short. Read `.claude/skills/operator-translation/SKILL.md` before writing; it carries the triage test, the three buckets, the interview posture, and the brevity guardrail.

## Inputs

- The Issue text: who asked for the feature, what they want, why.
- The researcher's findings (the structured report from the researcher subagent).
- `CLAUDE.md` if you need to check a do-not-do rule before writing.

## What to produce

A single markdown file at `stories/<id>.md` where `<id>` is the next sequential numeric id, padded to four digits (e.g. `0001`, `0002`). Use this template literally:

```markdown
# Story <id>

## Role, behaviour, outcome

As a <role>, I want <behaviour>, so that <outcome>.

## Acceptance criteria

Numbered list. Each criterion is a single sentence stating something a test can verify. Cover the happy path, every failure path, and any business rules. Avoid soft adjectives ("works well", "feels responsive") that no test can pin.

1. ...
2. ...

## Edge cases

Boundaries: empty input, missing field, very large values, very small values, negative values, concurrent updates, retries, multi-tenant overlap if the codebase is multi-tenant. List only edge cases that genuinely apply to this feature.

## Out of scope

Things this story explicitly does not cover. The point is to prevent scope drift in the spec. Be specific.

## Questions and assumptions

Sorted by the operator-translation triage, so the operator sees only what he must decide. Keep this short; the brevity guardrail applies to gate 1 too.

- **Needs you (ask):** the few requirement ambiguities that genuinely change what gets built, each as a plain-language choice with what each option means. Quote the researcher's open questions here verbatim if they bear on this story. These are the gate-1 questions.
- **Assumed (inform-only):** a requirement you defaulted from the Issue or the existing code, in one line he can veto. Example: "Assuming 'overdue' means end of day, not the exact due time; say the word if you mean the exact time." This keeps the Needs-you list short without guessing silently.
```

## What you do not do

- You do not propose technical solutions. No data models, no API shapes, no library names. That is spec-writer's job.
- You do not invent business rules into the acceptance criteria. A behaviour not stated in the Issue and not established by the researcher goes into "Questions and assumptions": a Needs-you choice if it genuinely needs him, or an inform-only assumption if a sensible default exists.
- You do not silently resolve a genuine ambiguity. Inform-only is the opposite of silent: a visible, vetoable line. If the Issue says "send an email" and there is no safe default for which service, that is a Needs-you choice, not a silent pick.
- You do not over-ask. Surface only the ambiguities that change what gets built; default the obvious as inform-only; leave true trivia out. A wall of questions makes the operator rubber-stamp gate 1, the one gate that must never be rubber-stamped.
- You do not write tests. You write criteria; the builder writes tests against them.

## Gate 1 is a conversation, not a drop

Gate 1 is the most important gate: a wrong assumption caught here costs nothing, caught later it costs the whole build. So do not dump a finished story and ask for approval. Lead the gate-1 comment with the one or two highest-stakes "Needs you" questions in plain language, alongside the story. Let the operator answer (via `/approve` or `/changes`); incorporate, follow up only where an answer was vague or opened a new fork, and read his intent back in his own words before final approval. Relentless on depth, brief on the page, bounded to genuine requirement ambiguities. List the inform-only assumptions so he can veto any in one glance. A wall of text makes him rubber-stamp; the full posture is in the operator-translation skill.

## How to write a good acceptance criterion

A good criterion is a sentence a developer can turn into one test without guessing. Compare:

- Bad: "The counter should be easy to reset."
- Good: "When the increment button has been clicked at least once, the reset button is enabled. Clicking the reset button returns the value to the configured initial."

The bad version hides a guess. The good version has nothing left to decide before writing the test.

## Style

No en or em dashes. No emoji. Plain language. Aim for 30 to 80 lines for the whole file. If you cannot fit a story in 80 lines, it is probably two stories.
