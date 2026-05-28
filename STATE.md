# Session-handoff state

**Last updated:** 2026-05-28, end of session 1.

The next session begins by reading this file plus `goals/setup-skill-rebuild.md`. Skip rebuilding context that is already validated below.

---

## What is true right now

- Local repo: `/Users/jacobl/projects/ribosome` is on `main`, in sync with `origin/main`.
- Test repo: `jacoblewisau/ribosome-test` exists, is **public**, **branch-protected** (strict status checks: `typecheck`, `test`, `verify`; `enforce_admins`; linear history; no force pushes; no deletions). Do **not** iterate on it; preserve it as the validated session-1 baseline.
- Eval suite: 20/20 against `evals/baseline.json` (schema `ribosome.eval.baseline`, version `"1"`).
- Unit tests: 45/45 (`npm test`).
- `npm run setup:check` returns all-green on `ribosome-test`.
- The chain has demonstrated end-to-end: Issue labeled `ribo:tweak` → story (gate 1) → `/approve` → spec (gate 2) → `/approve` → draft PR → validator clean → squash-merge → scouts fire via `workflow_run` → succeed.

## What was validated in session 1 (do not re-validate)

Four PRs merged into `jacoblewisau/ribosome-test`. Each had an earned story:

| PR | Commit | What it proved |
|---|---|---|
| `e463b73` (PR #2) | session-1 chain validation tweak | The full chain works end-to-end on a fresh repo with branch protection. |
| `26b7a6f` (PR #3) | scout OIDC permission fix | Scouts need `id-token: write` even with `anthropic_api_key` set. Locked by eval `TR6`. |
| `30c2888` (PR #4) | agent prompt return-inline contract | Read-only subagents (researcher, validator) cannot say "use the Write tool" if Write is not in their tools allowlist. Locked by eval `T7`. |
| `079fe4c` (pre-protection) | scout push-trigger fix | `claude-code-action@v1` rejects `on: push:`. Scouts use `workflow_run` + `workflow_dispatch`. Locked by eval `TR5`; `R7` tightened to action-supported triggers only. |

Three new eval invariants are in place. Do not remove them.

## Open work — the only thing the next session does

`/goal` per `goals/setup-skill-rebuild.md`. The short version of the stop condition:

> Two consecutive fresh-repo runs (`ribosome-test-2`, then `-3`) hit
> all-green `setup:check` + squash-merged seed PR + scout success,
> both under 10 min, with the Claude App browser install as the only
> manual step.

Full brief in the goals file. Read it before starting.

## What not to do

- Don't touch `jacoblewisau/ribosome-test`. Preserve the demo.
- Don't touch chain internals (`researcher`, `builder`, `validator`, `pr-shepherd`, etc.). Out of scope for the next session.
- Don't rework eval mechanics. Adding new invariants is fine; reshaping the runner is not.
- Don't spawn `ribosome.yml` chain runs to test `/setup` changes (each run costs $5–9 in API). Use the Max subscription to iterate locally; only fire the chain for the per-iteration end-to-end acceptance check.
- Don't recreate the four session-1 fixes. They're committed and trap-protected.

## Useful pointers

- Local-only feature branch with a queued patch: `fix/setup-skill-private-protection` (commit `156a312`). Already pushed to origin. Worth landing via a PR before the next session begins, but doesn't block the next goal.
- `goals/setup-skill-rebuild.md` — the brief for the next session.
- `setup-runs.md` — gitignored artifact the next session creates and appends to per iteration.
- Cost reference: Opus 4.7 ~$5–9 per chain run; Haiku 4.5 ~$0.10–0.30 per scout invocation; Sonnet 4.6 ~$1–3 per scout invocation.

## Memories worth re-reading at session start

- `~/.claude/memory/user_role.md` — Jacob's profile.
- `~/.claude/projects/-Users-jacobl-Downloads/memory/MEMORY.md` — auto-memory index.
- Specifically the feedback memories on `no-em-dashes`, `no-emoji`, and `first-principles`.
