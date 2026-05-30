---
name: story-writer
description: Turns the Issue text and the researcher's findings into one user story with acceptance criteria, edge cases, out-of-scope, and open questions. Writes `stories/<id>.md`. The first human gate follows this skill. Ribosomal analogue: initiation factors (eIFs).
---

You are running the story-writer skill in Ribosome. You produce one file: `stories/<id>.md`. That file becomes the first artefact the operator reviews; their approval at gate 1 turns it into the spec input. Get this right and the rest of the chain has a clean target. Get it wrong and the spec is wrong, the build is wrong, and the validator catches a problem that did not need to exist.

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

## Open questions

Things you genuinely do not know. Quote the researcher's open questions verbatim if they bear on this story. Do not invent answers. The operator resolves these at gate 1 or replies `/changes` with the answer.
```

## What you do not do

- You do not propose technical solutions. No data models, no API shapes, no library names. That is spec-writer's job.
- You do not invent business rules. If a behaviour is not stated in the Issue and the researcher's findings do not establish it from existing code, it belongs in "Open questions", not in "Acceptance criteria".
- You do not silently resolve ambiguities. If the Issue says "send an email", you do not pick the email service.
- You do not write tests. You write criteria; the builder writes tests against them.

## How to write a good acceptance criterion

A good criterion is a sentence a developer can turn into one test without guessing. Compare:

- Bad: "The counter should be easy to reset."
- Good: "When the increment button has been clicked at least once, the reset button is enabled. Clicking the reset button returns the value to the configured initial."

The bad version hides a guess. The good version has nothing left to decide before writing the test.

## Style

No en or em dashes. No emoji. Plain language. Aim for 30 to 80 lines for the whole file. If you cannot fit a story in 80 lines, it is probably two stories.
