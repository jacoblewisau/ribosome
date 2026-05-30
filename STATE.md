# Session-handoff state

**Last updated:** 2026-05-30, end of session 5.

The next session begins by reading this file. Skip rebuilding context that is already validated below.

---

## What is true right now

- Local repo: `/Users/jacobl/projects/ribosome`, on `main` in sync with origin. `origin` is `git@github.com:jacoblewisau/ribosome` (public). Do not reference the deleted `ribosome-test` remote.
- **Eval suite: 41/41** against `evals/baseline.json`. Unit tests **52/52**. Typecheck clean.
- **The repo is operational and behaviourally validated.** The auth secret and the Claude App are set; the chain has run live here. The full operator-as-non-coder pipeline (all three slices) is shipped and merged to `main`.

## What session 5 shipped

The **operator-as-non-coder** goal (`goals/operator-as-non-coder.md`): the operator is a domain expert who does not code. The chain assumed well-formed Issues and evaluable gates; both are false for him. Three slices fix that, end to end.

- **Slice 1 (PR #1) - the coaching layer.** `operator-translation` skill (triage domain-vs-engineering; three buckets ask / decide / inform-only; translate-to-consequence; bounded interview; brevity guardrail; anti-rubber-stamp + default-to-autonomy). `decision-records` skill (ADR convention, three altitudes, three-criteria gate, propose-through-gate, promotion path). Seeded `CONTEXT.md`, `docs/adr/0001`-`0002`. spec-writer enriched + OPERATOR gate-2 reframed. Evals R12 / T11 / TR11 / T12.
- **Slice 2 (PR #3) - the planner / transcription layer.** `planner` skill decomposes a `ribo:project` Issue into sequenced child Feature Issues (tracer-bullet first), files them as native sub-issues per ADR-0002, starts only the first. `project.yml` Issue Form (fourth template). Coordinator routing + ribosome.yml trigger + `ribo:project` label + OPERATOR decomposition gate. Evals R13 / T13 / TR12.
- **Slice 3 (PR #20/#21) - gate-1 coaching.** story-writer enriched with the same protocol at gate 1: Needs-you / inform-only buckets (same labels as gate 2, the cross-gate "polish"), reframed "Open questions", anti-over-ask guardrail (gate 1 is where over-asking is most tempting). OPERATOR gate-1 reframed. Eval T14.
- **allowed_bots fix (PR #12).** Found by the live run: claude-code-action blocks bot-initiated runs by default, so the planner's auto-start aborted. Fixed on `ribosome.yml` and all 7 scouts (name the Claude bot, not `*`). ADR-0003; evals TR13 / TR14.
- **test-author reconciliation + validator binding (PR #20).** Removed stale `test-author` references (the role was deleted in session 4; the builder writes the acceptance test). Gave the validator teeth: it flags acceptance tests that pass without binding the criterion (Important, or Critical when the test is the only evidence). Eval R14.

## Live test - validated end to end

The first real chain runs on this repo (Projects #6 and #13, since closed) confirmed by observation: the planner decomposes well, triages and translates the privacy decision into a plain-language choice, files native sub-issues, records a decision as a gated ADR PR, and the bot-applied `ribo:feature` label auto-starts the first child chain (which now clears the actor check after the allowed_bots fix). The one bug (allowed_bots) was found live and fixed.

## Open work

1. **Behavioural eval mode** (~$5-9/run, or subscription quota on OAuth). Structural eval (41/41) confirms the prompts carry the protocol; only a live run proves the agents *behave* (ask well, do not over-ask, do not slide into recommending). This session's live Projects were the first instances; a repeatable cadence is still undefined.
2. **Slack integration end-to-end** (carried from session 4; documented, not wired).
3. The planner's "advance to the next slice when the previous one merges" is a future enhancement; today it starts only the first slice.

## What not to do

- Do not reference `ribosome-test` as a remote; it is deleted.
- Do not rework the eval runner; adding invariants is fine, reshaping is not.
- Do not spawn `ribosome.yml` chain runs casually to test; each costs ~$5-9 (or quota on OAuth). Iterate locally; cancel a live run once it has shown what you need.
- Do not write to `docs/adr/` or `CONTEXT.md` system-wide from an autonomous producer without the gate; the maintainer authors ADRs directly during design (see decision-records).
- Do not use `allowed_bots: "*"` (public-repo risk per the action docs); name the Claude bot.

## Useful pointers

- `goals/operator-as-non-coder.md`: the full vision, settled decisions, all three slice build definitions.
- `docs/adr/`: 0001 (adopt ADRs), 0002 (sub-issues roadmap + fallback), 0003 (allowed_bots).
- `docs/tutorial.html`: the interactive operator tutorial (linked from OPERATOR.md and README).
- `npm run eval`: 41-task structural eval. `npm test`: 52 unit tests.
- Cost reference: Opus 4.8 ~$5-9 per chain run; Haiku scout ~$0.10-0.30; Sonnet scout ~$1-3.

## Memories worth re-reading at session start

- `~/.claude/memory/user_role.md` - Jacob designs ambitious software but does not hand-code; surface decisions in plain language, never assume he can answer architecture questions, keep it brief (volume makes him rubber-stamp).
- Project memory store: keep STATE.md current as part of every landed change (do not make the operator ask); primary-source verification; no em-dashes; no emoji.
