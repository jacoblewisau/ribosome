# Session-handoff state

**Last updated:** 2026-05-29, end of session 4.

The next session begins by reading this file. Skip rebuilding context that is already validated below.

---

## What is true right now

- Local repo: `/Users/jacobl/projects/ribosome` is on `main`, in sync with `origin/main` (`061f601`).
- **Canonical remote changed this session.** `origin` is now `git@github.com:jacoblewisau/ribosome` (public), created session 4 to replace the deleted `ribosome-test`. The full commit history lives there. `ribosome-test` is gone; do not reference it as a remote.
- Eval suite: **30/30** against `evals/baseline.json` (schema `ribosome.eval.baseline`, version `"1"`).
- Unit tests: **52/52** (`npm test`).
- Typecheck clean (`npm run typecheck`).
- `npm run setup -- --help` prints the `--auth oauth|api` flag (oauth default).
- `npm run setup:check` reports honestly: `claude_app=unknown` is now an expected, acceptable line (see session-4 work below), not a gap.

## What session 4 did

Two parallel efforts ran this session (the second session has since been closed).

**Agent-behaviour and model work (commits `289bc02`, `5c9b824`, `cb948d6`):**

| Commit | What |
|---|---|
| `cb948d6` | Chain pinned to `claude-opus-4-8` + xhigh effort (builder, validator, `ribosome.yml`). New trap TR10 locks the 4.8 pin. |
| `5c9b824` | Agent-behaviour tightening, items 1-4 from the session-3 review: `test-author` agent removed (was a stub; builder writes the acceptance test), researcher/validator JSON state contracts, validator coverage-first language, builder `<scope_discipline>` anti-overeagerness block. New invariants R10, R11, T10. |
| `289bc02` | Queued the goal: `goals/agent-behaviour-tightening.md`. |

These four added invariants took the baseline 26 -> 30. See `src/evals/tasks.ts` rationales (R10, R11, T10, TR10) for the earned stories. Do not remove them.

**setup-check honesty fix + decision notes (commits `3158dcb`, `7c520b5`, `061f601`):**

| Commit | What |
|---|---|
| `3158dcb` | `setup-check.ts` no longer stamps a false-negative `claude_app=missing` on healthy repos. New pure classifier `src/setup/claude-app.ts` (+ `claude-app.test.ts`, 7 cases) returns `ok` only on a genuine positive signal, else `unknown`. `setup/SKILL.md` aligned. |
| `7c520b5` | `goals/app-install-detection.md`: decision note. The session-3 "probe via parseable error string" premise was FALSIFIED from primary source. |
| `061f601` | `goals/plugin-packaging.md`: plugin packaging draft + the plugin-vs-bootstrap split decision. |

## Eval invariants: 30 total. Where the traps live

Counts by session: 20 (s1) + 4 (s2: T9, TR9, plus session-2 set) + 4 (s4: R10, R11, T10, TR10) reaching 30. The category split is 10 routine / 10 tricky / 10 trap. Adding new invariants is fine; reshaping the runner is not.

A suggested 31st invariant (guarding the `claude_app` honesty fix) is parked in `goals/app-install-detection.md`. It was deliberately NOT added this session to avoid colliding with the concurrent eval edits; add it when convenient. The fix is already covered by `src/setup/claude-app.test.ts`.

## Two decisions waiting on the maintainer

1. **App-install deep check** (`goals/app-install-detection.md`). A user token cannot verify App install for free (both GitHub API paths 403; the action emits no parseable "not installed" string). The honest `unknown` fix shipped. Open question: accept `unknown` (recommended), or build an opt-in `--probe-app` run-conclusion check (paid, ambiguous)?
2. **Plugin packaging** (`goals/plugin-packaging.md`). Plugins cannot ship GitHub Actions workflows, and the chain runs in the target repo's CI, so only the `/setup` tooling benefits from being a plugin. Open question: build a thin `ribosome-setup` plugin at all? Discussed live with the maintainer end of session 4.

## Open work — pick one or wait for a fresh brief

Still-valid candidates from prior sessions (none pinned):

1. **Slack integration end-to-end exercise.** `.claude/skills/setup/slack.md` documents four shapes; none wired into `ribosome.yml`. Needs a live webhook secret + a paid chain run to validate end-to-end.
2. **App-install `--probe-app`** (only if decision 1 above says yes).
3. **Plugin packaging** (only if decision 2 above says yes).
4. **Behavioural eval mode** (~$5-9/run; design cadence).
5. **Custom branded GitHub App via manifest flow** (deferred; the official App is fine).

## What not to do

- Don't reference `ribosome-test` as a remote; it is deleted.
- Don't touch chain internals (`researcher`, `builder`, `validator`, `pr-shepherd`) unless explicitly briefed.
- Don't rework eval-runner mechanics; adding invariants is fine.
- Don't spawn `ribosome.yml` chain runs to test changes locally; the chain costs $5-9 per run. Iterate locally on the Max subscription.
- Don't reintroduce the App-JWT-only `claude_app` probe; it produces the false negative the session-4 fix removed.

## Useful pointers

- `npm run setup -- --help`: orchestrator CLI surface.
- `npm run setup:check`: idempotent gap report. `claude_app=unknown` is expected and acceptable (a user token cannot verify the App install).
- `npm run eval`: 30-task structural eval.
- `npm test`: 52 unit tests.
- Cost reference: Opus 4.8 ~$5-9 per chain run; Haiku 4.5 ~$0.10-0.30 per scout; Sonnet 4.6 ~$1-3 per scout.

## Memories worth re-reading at session start

- `~/.claude/memory/user_role.md` — Jacob's profile.
- The feedback memories on `no-em-dashes`, `no-emoji`, `first-principles`, `primary-source-verification`. Session 4 leaned hard on primary-source verification (it falsified the App-install probe premise) and on not deferring to a prior session's unverified claim.
