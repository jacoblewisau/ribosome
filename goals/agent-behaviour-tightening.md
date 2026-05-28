# Goal — tighten agent behaviour (items 1-4 from session-3 review)

**Status:** queued for the next session.
**Authored:** 2026-05-29, end of session 3.
**Driver:** the claude-code-guide subagent review (session 3) found four behavioural gaps in Ribosome's five subagents. Each is a real risk to the operator's experience. None are caught by today's eval suite.

The primary references are:
- The session-3 review (in the conversation transcript; not separately stored).
- Anthropic's prompting best-practices doc: `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices`.
- Claude Code subagent spec: `https://docs.anthropic.com/en/docs/claude-code/sub-agents`.

---

## Why this matters for the non-coder operator

The operator never reads `.claude/agents/`. But the agents shape every PR the operator sees. Each of these fixes is for the operator's benefit, not the maintainer's:

| Item | What the operator gets out of it |
|---|---|
| 1. test-author resolved | No silent stalls when the chain reaches a stub agent. The PR either lands or fails with a clear message — not an ambiguous half-state. |
| 2. JSON contracts | Fewer chain stalls caused by prose-parsing drift. When the validator says "clean," the coordinator advances reliably. |
| 3. Validator coverage | Critical bugs don't get filtered out before they reach the PR. The operator sees the real Critical-finding count, not a sanitised one. |
| 4. Anti-overeagerness on builder | Smaller, focused diffs the operator can review and trust. No "while I was in there, I refactored the auth flow" surprises. |

If any of these four drifts in a future change, the operator's experience degrades silently. Eval traps lock the contract.

**Out of scope by design:** anything that changes what the operator types or sees in the GitHub UI. `OPERATOR.md` stays untouched. The three operator-visible gates and six slash commands stay exactly as they are.

---

## Items, in order

### Item 1: resolve `test-author`

Today `.claude/agents/test-author.md` is a stub ("Stub. Phase 1 deliverable.") but `.claude/skills/coordinator/SKILL.md` line 44 invokes it. The chain has worked end-to-end so far because the builder also has Write within `scope_paths` and writes the acceptance test as part of its work. Test-author is functionally redundant today.

**Two acceptable resolutions; the executor picks based on which is cleaner:**

A. **Remove test-author from the dispatch.** Delete the agent file. Update the coordinator's dispatch table at line 44 to drop the test-author step. Document in the table that builder writes acceptance tests as part of its scope_paths. Update the eval (R3, R6 in `src/evals/tasks.ts`) so AGENT_FILES no longer references test-author.

B. **Write a real test-author prompt.** Substantive instructions: read the approved story, write `tests/acceptance/<id>.spec.ts` against the acceptance criteria before builder runs (TDD-style). Move the test-writing responsibility off builder (which should focus on implementation only). Constrain scope to `tests/acceptance/**` via the prompt body (not the unsupported `writes_to:` frontmatter field) and the existing `enforce-scope.sh` hook.

Either is valid. Pick the one that produces a cleaner chain. Document the choice in the commit message.

**Verification for item 1:** the dispatch table in `coordinator/SKILL.md` no longer references a stub. Either test-author is gone or its prompt is substantive (>200 lines, with explicit inputs/outputs).

### Item 2: fenced JSON contract block on every read-only subagent output

`researcher` and `validator` return findings inline (per session 2's T7 invariant). Today the coordinator parses their reply text via prose regex (e.g. matching "Status: clean"). One word change in the agent's prompt drift breaks the state machine silently.

**Required shape:** every reply from `researcher` and `validator` ends with a fenced JSON block the coordinator parses. The block is for state-machine consumption; the prose above remains for the operator-visible comment.

Suggested schema (executor refines):

```json
{
  "agent": "validator",
  "chain_id": "0006",
  "verdict": "clean",
  "findings": { "critical": 0, "important": 0, "minor": 3 },
  "files_audited": ["src/...", "tests/..."],
  "coverage_complete": true
}
```

For researcher:

```json
{
  "agent": "researcher",
  "chain_id": "0006",
  "files_involved": ["src/..."],
  "open_questions": ["..."],
  "memory_citations": ["MEMORY.md#..."]
}
```

Update `coordinator/SKILL.md` to:
- Parse the JSON block via a single regex (`/```json\n([\s\S]*?)\n```/`)
- Use the JSON as the source of truth for advancement decisions
- Use prose for what gets posted on the Issue

**Citation for why this is the right pattern:** Anthropic's prompting doc, "Structure prompts with XML tags" + "Long context prompting" sections, recommend explicit structural markers. JSON is a stronger structural commitment than markdown sections.

**Verification for item 2:** new eval `T10` checks that researcher.md and validator.md prompts include the literal substring "```json" near their output section, AND the coordinator's parsing path references a JSON regex.

### Item 3: validator coverage vs filter

Current validator prompt (line 49 of `.claude/agents/validator.md`): "You do not invent issues to look thorough. If the implementation is clean, say so."

Anthropic's prompting doc, section "Code review harnesses," documents that Opus 4.6+ will follow conservative language faithfully and may suppress real findings:

> "When a review prompt says things like 'only report high-severity issues,' 'be conservative,' or 'don't nitpick,' Claude Opus 4.8 may follow that instruction more faithfully than earlier models did: it may investigate the code just as thoroughly, identify the bugs, and then not report findings it judges to be below your stated bar."

The doc's recommended replacement:

> "Report every issue you find, including ones you are uncertain about or consider low-severity. Do not filter for importance or confidence at this stage - a separate verification step will do that. Your goal here is coverage: it is better to surface a finding that later gets filtered out than to silently drop a real bug. For each finding, include your confidence level and an estimated severity so a downstream filter can rank them."

**Action:** replace validator's "do not invent issues" guidance with this coverage-first pattern. Keep the "if the implementation is clean, say so" — the operator still needs to see clean reports. Add a `confidence: high|medium|low` field to each finding so the coordinator (or operator) can filter at presentation time.

**Citation:** quote the doc URL in the validator prompt as the source of the change.

**Verification for item 3:** grep `.claude/agents/validator.md` for the literal "coverage" or "confidence" — both should now appear.

### Item 4: anti-overeagerness on builder

Per the prompting doc's "Overeagerness" section, Opus 4.6+ tends to add features, refactor, and create abstractions beyond what was asked. Builder runs on Opus 4.7 (per `ribosome.yml` line 105).

Recommended doc-verbatim block to add to `.claude/agents/builder.md`:

```text
<scope_discipline>
Avoid over-engineering. Only make changes that are directly requested by
the spec or clearly necessary for it to work. Keep solutions simple and
focused:

- Scope: do not add features, refactor code, or make improvements beyond
  the spec's scope_paths. A bug fix does not need surrounding code
  cleaned up. A simple feature does not need extra configurability.
- Documentation: do not add docstrings, comments, or type annotations to
  code you did not change. Only add comments where the logic is not
  self-evident.
- Defensive coding: do not add error handling, fallbacks, or validation
  for scenarios that cannot happen. Trust internal code and framework
  guarantees. Only validate at system boundaries.
- Abstractions: do not create helpers, utilities, or abstractions for
  one-time operations. Do not design for hypothetical future
  requirements. The minimum complexity needed for the spec is the right
  amount.

The validator will flag scope creep as Critical. Builder, do not give
the validator anything to flag.
</scope_discipline>
```

The XML wrapping is intentional, per the doc's "Structure prompts with XML tags" guidance.

**Citation:** include the source URL in the prompt body.

**Verification for item 4:** grep `.claude/agents/builder.md` for `scope_discipline` — should now appear.

---

## Verification (stop condition)

All of:

1. Item 1 resolved (test-author removed from dispatch OR has a substantive prompt; the eval reflects whichever).
2. Item 2 resolved (fenced JSON contracts in researcher.md + validator.md; coordinator parses them).
3. Item 3 resolved (validator prompt updated to coverage-first language with confidence levels).
4. Item 4 resolved (anti-overeagerness block in builder.md).
5. Eval suite grows by at least 2 new invariants (candidates: T10 JSON contracts; R10 builder anti-overeagerness language present; R11 validator coverage-first language present). Pick the two most falsifiable.
6. `npm test`: 45/45 still passing.
7. `npm run eval`: all green, baseline updated to reflect the new count.

---

## Constraints

- **Subscription only.** Do not invoke `ribosome.yml` chain runs to test these changes. All verification is structural (grep, eval, unit tests). The chain itself is not exercised; these are agent-prompt and coordinator-skill edits.
- **Use search tools to verify any claim about Claude Code, Claude API, or Anthropic doc behaviour.** Cite primary sources. The session-3 review caught a real validator-behaviour bug by citing the Anthropic doc; maintain that discipline.
- **No emoji. No en or em dashes.** Plain prose.
- **Do not touch operator-facing surfaces.** `OPERATOR.md`, the six slash commands, the three gates stay exactly as they are. The operator's experience is upstream of these changes; they should not notice the rewrite happened, except that PRs get better.

---

## Non-goals

- Touching scout skills or scout workflows.
- Changing the auth path (oauth/api dual-mode is locked from session 3).
- Changing the orchestrator (`scripts/setup-bootstrap.ts`) except where the coordinator/SKILL.md needs new parsing logic.
- Re-running the chain to validate end-to-end. The chain works (sessions 1 and 2 proved it); these changes are surgical to the agents, not architectural.

---

## Suggested execution order

1. Item 4 first (smallest; ~15 min). Pure additive prompt change.
2. Item 3 next (~30 min). Replacement language, citation, confidence-field addition.
3. Item 1 (decide path A vs B, then ~30 min for path A, ~1-2 hr for path B).
4. Item 2 last (largest; ~2-3 hr). Touches researcher, validator, AND coordinator parsing.
5. Eval invariants added as each item lands (incremental commits, optional).
6. Final: rebaseline `evals/baseline.json`, run `npm test` + `npm run eval --gate evals/baseline.json`, confirm all green.

Total estimate: 4-6 hr of focused work. No remote pushes required; lands as a local commit (or PR to whatever remote you've set by then).
