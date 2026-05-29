# Session-handoff state

**Last updated:** 2026-05-30, end of session 5.

The next session begins by reading this file. Skip rebuilding context that is already validated below.

---

## What is true right now

- Local repo: `/Users/jacobl/projects/ribosome`. `origin` is `git@github.com:jacoblewisau/ribosome` (public). Do not reference the deleted `ribosome-test` remote.
- **Eval suite: 37/37** against `evals/baseline.json` (schema `ribosome.eval.baseline`, version `"1"`). 11 routine + 12 tricky baseline grew to 13 routine / 13 tricky / 11 trap = 37.
- Unit tests: **52/52** (`npm test`). Typecheck clean (`npm run typecheck`).
- The big new thing this session: the **operator-as-non-coder** goal (`goals/operator-as-non-coder.md`). Slices 1 and 2 are shipped; slice 3 remains.

## What session 5 built

The premise (from the goal doc): the operator is a domain expert who does not code and "does not know what he does not know." The chain assumed well-formed Issues and evaluable gates; both are false for him. Two slices fix that.

**Slice 1 (merged, PR #1) - the coaching layer:**

| Artefact | What |
|---|---|
| `.claude/skills/operator-translation/SKILL.md` | The protocol: triage (domain vs engineering), three buckets (ask / decide / inform-only), translate-to-consequence, the bounded interview, a **brevity guardrail** (volume is a rubber-stamp trigger for this operator), and two named guardrails (anti-rubber-stamp, default-to-autonomy). |
| `.claude/skills/decision-records/SKILL.md` | ADR convention adapted from Matt Pocock's grill-with-docs: three altitudes (glossary / context-specific / system-wide), the three-criteria ADR gate, the format, propose-through-gate, and the promotion path to a CLAUDE.md rule. Distinct from CLAUDE.md rules and distilled lessons. |
| `CONTEXT.md`, `docs/adr/0001`, `docs/adr/0002` | Seeded glossary; first ADR (adopt ADRs); ADR-0002 (roadmap uses native sub-issues). |
| `spec-writer` enrichment, `OPERATOR.md` gate-2 reframe | Gate 2 is now a conversation, not a finished-brief drop. |
| Evals R12, T11, TR11, T12 | Guard the protocol and the brevity discipline. |

**Slice 2 (PR #3, assume merged) - the planner / transcription layer:**

| Artefact | What |
|---|---|
| `.claude/skills/planner/SKILL.md` | Turns a `ribo:project` Issue into a sequenced set of small child Feature Issues (tracer-bullet first) via a bounded interview; on `/approve` files them as native sub-issues per ADR-0002, labelling only the first slice `ribo:feature`. |
| `.github/ISSUE_TEMPLATE/project.yml` | The guided "Project" Issue Form (5 fields, auto-applies `ribo:project`). Chosen via a prototype (A2 over A1; sub-issues B2 over task-list B1). |
| coordinator, `ribosome.yml`, `setup-bootstrap.ts`, `OPERATOR.md` | Route `ribo:project` to the planner (not the feature chain); planner `/approve` + `/changes` gate rows; let the label through the workflow `if:`; seed the `ribo:project` label; document the fourth template + the decomposition gate. |
| Evals R13, T13, TR12 | Guard the scaffolding, the routing, and the propose-then-create-on-approve + sub-issue fallback. |

## OPEN RISK - read before relying on slice 2

**The planner's auto-start of the first slice is NOT yet validated and could fail silently.** Root cause (verified from GitHub docs): events triggered by the default `GITHUB_TOKEN` do not create new workflow runs; only a GitHub App installation token or a PAT does. The planner starts slice 1 by labelling the child `ribo:feature` and relying on the `labeled` trigger.

- The action auto-generates a **GitHub App installation token** when no `github_token` is passed (Ribosome's config), and App-token events DO trigger workflows - so this should work.
- UNVERIFIED (could not confirm from primary docs): whether the planner's **Bash `gh` call** uses the App token or the ambient `GITHUB_TOKEN` injected by Actions. If the latter, the child chain never starts and the failure is silent.

**Before trusting it:** run one cheap `ribo:project` Issue and watch whether the first child's workflow run queues in the Actions tab. Consider hardening the planner so its closing comment tells the operator to nudge if the child shows no bot reply within ~2 minutes (turns a silent stall into a visible hiccup). Tracked in PR #3's "honest caveat".

## Open work

1. **Validate the slice-2 trigger** (above). Highest priority before slice 3 leans on the Project flow.
2. **Slice 3:** story-writer enrichment + inform-only polish across gates (in the goal doc).
3. **Behavioural eval mode** (~$5-9/run, or subscription quota on OAuth): the only thing that verifies the coaching and planner actually *behave*, which structural eval cannot. The trigger validation above is a concrete first instance.
4. Slack integration end-to-end (carried from session 4; documented, not wired).

## What not to do

- Do not reference `ribosome-test` as a remote; it is deleted.
- Do not rely on slice-2's auto-start in production until the trigger is validated.
- Do not rework the eval runner; adding invariants is fine, reshaping is not.
- Do not spawn `ribosome.yml` chain runs casually to test; each costs ~$5-9 (or quota on OAuth). Iterate locally.
- Do not write to `docs/adr/` or `CONTEXT.md` system-wide from an autonomous producer without the gate; the maintainer authors ADRs directly during design (see decision-records).

## Useful pointers

- `goals/operator-as-non-coder.md`: the full vision, the settled decisions, both slice build definitions, and the resolved shapes.
- `docs/adr/`: 0001 (adopt ADRs), 0002 (sub-issues roadmap mechanism + fallback).
- `npm run eval`: 37-task structural eval. `npm test`: 52 unit tests.
- Cost reference: Opus 4.8 ~$5-9 per chain run; Haiku scout ~$0.10-0.30; Sonnet scout ~$1-3.

## Memories worth re-reading at session start

- `~/.claude/memory/user_role.md` - Jacob designs ambitious software but does not hand-code; surface decisions in plain language, never assume he can answer architecture questions, and keep it brief (volume makes him rubber-stamp).
- The feedback memories on `no-em-dashes`, `no-emoji`, `first-principles`, `primary-source-verification`. Session 5 leaned hard on primary-source verification (the GitHub trigger rule, the Issue-forms and sub-issues APIs).
