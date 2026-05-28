# Session-handoff state

**Last updated:** 2026-05-28, end of session 2.

The next session begins by reading this file. Skip rebuilding context that is already validated below.

---

## What is true right now

- Local repo: `/Users/jacobl/projects/ribosome` is on `main`, in sync with `origin/main`.
- Demo repo: `jacoblewisau/ribosome-test` is the session-1 reference. Public, branch-protected (strict: typecheck/test/verify required; enforce_admins; linear history; no force pushes or deletions). **Do not iterate on it**; preserve as the validated baseline.
- Eval suite: **24/24** against `evals/baseline.json` (schema `ribosome.eval.baseline`, version `"1"`).
- Unit tests: 45/45 (`npm test`).
- `npm run setup:check` returns all-green on `ribosome-test`.
- `npm run setup` is the parallel programmatic bootstrap orchestrator (`scripts/setup-bootstrap.ts`).
- The chain has been demonstrated end-to-end multiple times:
  - Session 1 on ribosome-test (PR #2 the chain-validation tweak).
  - Session 2 on ribosome-test-3 (PR #2 the README casing fix). Both scouts succeeded via `workflow_run` post-merge.

## What was validated, and where the eval traps live

Eight commits live on `ribosome-test/main`. Each earned its place:

| PR / commit | Earned story |
|---|---|
| `b8e1eae` (PR #7) | /setup rebuild — parallel programmatic orchestrator. R8 (orchestrator exists), T8 (gh auth setup-git), TR7 (no --source=.), TR8 (no --body). |
| `2db5330` (PR #6) | docs: session-1 handoff (STATE + goals). |
| `69df84f` (PR #5) | setup skill warns about GitHub-Free private branch-protection 403. |
| `30c2888` (PR #4) | Agent prompts return-inline contract. T7. |
| `26b7a6f` (PR #3) | Scouts need id-token: write. TR6. |
| `e463b73` (PR #2) | The chain works end-to-end on a fresh repo with branch protection. |
| `079fe4c` (pre-protection) | Scout push-trigger fix. TR5 + R7 tightened. |

Eval invariants total: 20 (session 1) + 4 (session 2) = 24. Do not remove them.

## Open work — pick one or wait for a fresh brief

- `goals/setup-skill-rebuild.md` is **complete**. Reference; not a TODO.
- `setup-runs.md` is the gitignored iteration log; useful context for any future /setup work.

Possible next directions (no goal pinned):

1. **Slack integration end-to-end exercise.** `slack.md` documents four shapes; none have been wired into `ribosome.yml`. Pick one (recommend incoming webhook), wire it, validate the chain posts story/spec/PR notifications.
2. **App-install verification probe.** Iteration 2 discovered the action emits `"Claude Code is not installed on this repository"` as a clear error when the App is missing. Wire `setup-check.ts` to dispatch a minimal workflow and parse this signal so `claude_app=unknown` becomes `claude_app=ok` / `claude_app=not_installed`.
3. **Behavioural eval mode** (the plan's outstanding work from session 1). Real chain runs scored against a behavioural baseline. ~$5-9/run; design how often.
4. **Custom branded GitHub App via manifest flow.** Researched in session 2 grey-area #2; deferred because the official App is fine. Revisit if Ribosome ships as a plugin (`goal #3 in handoff`).
5. **Package Ribosome as a Claude Code plugin** (per session 1's handoff doc): `plugin_marketplaces` install path for other repos.

## What not to do

- Don't iterate on `jacoblewisau/ribosome-test` (the demo). Use throwaway names (`ribosome-test-N`).
- Don't touch chain internals (`researcher`, `builder`, `validator`, `pr-shepherd`). Out of scope unless explicitly briefed.
- Don't rework eval mechanics. Adding new invariants is fine; reshaping the runner is not.
- Don't spawn `ribosome.yml` chain runs to test orchestrator changes. The chain costs $5-9 per run; iterate locally on the Max subscription.

## Useful pointers

- `npm run setup -- --help`: orchestrator CLI surface.
- `npm run setup:check`: idempotent gap report (note: `claude_app=missing` is a known false negative; the endpoint requires App-JWT auth which user tokens lack).
- `npm run eval`: 24-task structural eval.
- Cost reference: Opus 4.7 ~$5-9 per chain run; Haiku 4.5 ~$0.10-0.30 per scout; Sonnet 4.6 ~$1-3 per scout.

## Memories worth re-reading at session start

- `~/.claude/memory/user_role.md` — Jacob's profile.
- `~/.claude/projects/-Users-jacobl-Downloads/memory/MEMORY.md` — auto-memory index.
- Specifically the feedback memories on `no-em-dashes`, `no-emoji`, `first-principles`.
