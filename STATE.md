# Session-handoff state

**Last updated:** 2026-06-02, end of session 6.

The next session begins by reading this file. Skip rebuilding context that is already validated below.

---

## What is true right now

- Local repo: `/Users/jacobl/projects/ribosome`, on `main` in sync with origin. `origin` is `git@github.com:jacoblewisau/ribosome` (public). Do not reference the deleted `ribosome-test` remote.
- **Eval suite: 48/48** against `evals/baseline.json`. Unit tests **82/82** (+ 2 verify-matrix). Typecheck clean.
- **The repo is operational and behaviourally validated.** The auth secret and the Claude App are set; the chain has run live here. The full operator-as-non-coder pipeline (all three slices) is shipped and merged to `main`.
- **Session 6 work is in the working tree, not yet committed** (the native-GitHub automation bundle, below). Code + structural evals pass; the skill-prose behaviour is eval-gated but not yet live-run.

## What session 5 shipped

The **operator-as-non-coder** goal (`goals/operator-as-non-coder.md`): the operator is a domain expert who does not code. The chain assumed well-formed Issues and evaluable gates; both are false for him. Three slices fix that, end to end.

- **Slice 1 (PR #1) - the coaching layer.** `operator-translation` skill (triage domain-vs-engineering; three buckets ask / decide / inform-only; translate-to-consequence; bounded interview; brevity guardrail; anti-rubber-stamp + default-to-autonomy). `decision-records` skill (ADR convention, three altitudes, three-criteria gate, propose-through-gate, promotion path). Seeded `CONTEXT.md`, `docs/adr/0001`-`0002`. spec-writer enriched + OPERATOR gate-2 reframed. Evals R12 / T11 / TR11 / T12.
- **Slice 2 (PR #3) - the planner / transcription layer.** `planner` skill decomposes a `ribo:project` Issue into sequenced child Feature Issues (tracer-bullet first), files them as native sub-issues per ADR-0002, starts only the first. `project.yml` Issue Form (fourth template). Coordinator routing + ribosome.yml trigger + `ribo:project` label + OPERATOR decomposition gate. Evals R13 / T13 / TR12.
- **Slice 3 (PR #20/#21) - gate-1 coaching.** story-writer enriched with the same protocol at gate 1: Needs-you / inform-only buckets (same labels as gate 2, the cross-gate "polish"), reframed "Open questions", anti-over-ask guardrail (gate 1 is where over-asking is most tempting). OPERATOR gate-1 reframed. Eval T14.
- **allowed_bots fix (PR #12).** Found by the live run: claude-code-action blocks bot-initiated runs by default, so the planner's auto-start aborted. Fixed on `ribosome.yml` and all 7 scouts (name the Claude bot, not `*`). ADR-0003; evals TR13 / TR14.
- **test-author reconciliation + validator binding (PR #20).** Removed stale `test-author` references (the role was deleted in session 4; the builder writes the acceptance test). Gave the validator teeth: it flags acceptance tests that pass without binding the criterion (Important, or Critical when the test is the only evidence). Eval R14.

## What session 6 shipped (working tree, uncommitted)

The **native-GitHub automation bundle** (`docs/explorations/native-github-bundle-build-def.md`):
make the operator loop boringly effortless without new infrastructure. The
operator chose GitHub-native, read-only, no n8n (see
`~/.claude/.../memory/prefers-boring-native-simplicity.md`). Three slices, all
verified programmatically (typecheck + 82 unit tests + 48-eval gate green).

- **Slice A - live Mission Control.** One pinned `ribo:in-flight` Issue, rebuilt
  from scratch on every chain step, laid out as an inbox (Needs you / Working /
  Done this week) with the needs-you count in the title. New pure renderer
  `src/chain/mission-control.ts` (20 unit tests) wrapped by
  `scripts/mission-control.ts` (`npm run chain:board`); coordinator and shepherd
  both rebuild via the one renderer (shepherd's hand-built table retired).
  OPERATOR.md points at the board. Evals R15 / T15 / TR15.
- **Slice B - spec gate auto-advances unless flagged.** Gate 2 is exception-only:
  the spec-writer names sensitive-category flags, the coordinator runs the
  deterministic `scripts/triage.ts spec-gate` (backed by `src/chain/triage.ts`,
  10 unit tests) and either holds (any flag) or auto-advances, recording
  `gate_state.spec: "auto-approved"` (distinct from `approved` for an honest
  audit trail). Operator keeps the veto via a `/changes` pull-back row. OPERATOR
  gate-2 reframed. ADR-0004. Evals R16 / T16 / TR16.
- **Slice C - tweak = merge-only.** `ribo:tweak` skips the story and spec gates
  (the PR merge is the only gate), with an escape hatch: over the tweak-size
  budget (3 files / 40 lines) or any sensitive flag escalates to the story gate
  (`scripts/triage.ts tweak-size`). OPERATOR tweak bullet + gate-3 reframed.
  Eval TR17.

Parked deliberately (in the build-def): Slack/n8n push, one-tap buttons, the
daily standup, approve-from-email, PR-review-button gates, the Projects board.

## Live test - validated end to end

The first real chain runs on this repo (Projects #6 and #13, since closed) confirmed by observation: the planner decomposes well, triages and translates the privacy decision into a plain-language choice, files native sub-issues, records a decision as a gated ADR PR, and the bot-applied `ribo:feature` label auto-starts the first child chain (which now clears the actor check after the allowed_bots fix). The one bug (allowed_bots) was found live and fixed.

## Open work

1. **Behavioural eval mode** (~$5-9/run, or subscription quota on OAuth). Structural eval (48/48) confirms the prompts carry the protocol; only a live run proves the agents *behave* (ask well, do not over-ask, do not slide into recommending). Session 6's bundle especially wants a live run: the auto-advance branch and the tweak fast-path change live behaviour, and only a real chain proves the coordinator wires the triage CLIs and rebuilds the board correctly. The deterministic logic is unit-tested; the agent prose is eval-gated.
2. **Slack integration: declined for the operator surface** (session 6). The operator chose read-only GitHub-native simplicity over the Slack/n8n push channel. Still available as a future opt-in upgrade, but not the recommended path.
3. The planner's "advance to the next slice when the previous one merges" is a future enhancement; today it starts only the first slice.
4. **Commit session 6.** The native-GitHub bundle is in the working tree only; it has not been committed or PR'd. Branch + PR it (it touches coordinator/spec-writer/shepherd skills, OPERATOR.md, src/chain, scripts, evals, ADR-0004).

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
