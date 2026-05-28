# Goal — rebuild `/setup` for one-shot, parallel, programmatic bootstrap

**Status:** queued. Begin in a fresh Claude Code session after `STATE.md` is read.
**Authored:** 2026-05-28, end of session 1.
**Driver:** the validation session (PRs #2, #3, #4 on `jacoblewisau/ribosome-test`) proved the chain works but exposed how brittle the current `setup` skill is.

---

## Outcome (the falsifiable acceptance criterion)

A maintainer in a fresh clone runs `/setup`, answers at most three questions (repo name, public-or-private, optional Slack workspace), and the skill drives the bootstrap to completion.

Acceptance is **two consecutive iteration runs** on fresh disposable test repos (`jacoblewisau/ribosome-test-2`, then `-3`) where:

1. `npm run setup:check` returns **all green** (zero `missing` items).
2. A seed `[tweak]` Issue has been opened, the chain has run end-to-end, and the resulting PR has been **squash-merged**.
3. `scout-ci-watcher` and `scout-coverage-scout` fired via `workflow_run` and completed = success after the merge.
4. Wall-clock from `/setup` start to merged PR is **under 10 minutes** on a normal connection. Time it. Record actuals in `setup-runs.md`.
5. The **only** manual step in the run is the Claude GitHub App browser install (or the equivalent for a custom branded App, if research finds that path is faster). Every other step is programmatic.

---

## Verification parameters

| Check | Tool | Pass criterion |
|---|---|---|
| Setup gate sweep | `npm run setup:check` | all lines = `ok` |
| Time-to-ready per iteration | `setup-runs.md` (gitignored) | logged actuals, < 10 min |
| Eval suite | `npm run eval` | 20/20 baseline holds; new traps added per failure |
| Unit tests | `npm test` | 45/45 (current) plus any orchestrator tests added |
| Idempotency | re-run `/setup` on bootstrapped repo | sub-5s no-op, one green summary line |
| Skill body length | `wc -l .claude/skills/setup/SKILL.md` | < 300 lines (CLAUDE.md rule 5) |
| CI progress legibility | grep CI logs | every step emits one parseable `key=value` status line |

---

## Constraints

- **Iterate on the Max subscription in Claude Code.** Do **not** spawn `ribosome.yml` chain runs to test setup-skill changes; the chain costs API per run. Only invoke the chain end-to-end for the final acceptance check on each iteration repo. Budget the validation: ~$5–9 per iteration end-to-end run × 2 iterations ≈ $10–20.
- **Steps with no inter-dependency MUST run in parallel.** Concretely: after `gh repo create --push`, these must dispatch concurrently:
  - label batch (5 labels in one parallel `gh label create`)
  - visibility flip (`gh repo edit --visibility public` if Free-tier + private + branch-protection wanted)
  - secret-source detection (env var → file → keychain probe)
  - Claude App install URL pre-open (browser-launch with the install URL)
  - first-checks-run watcher (poll `gh run list --workflow checks.yml`)

  Branch protection joins on **first-checks-run completion** (status check contexts must exist). Seed Issue joins on **App install + secret set**.

- **Idempotent.** Each step checks current state before acting. Re-running is safe and fast.
- **Plain English in operator-visible prose.** No en/em dashes. No emoji.
- **Programmatic-first.** Only fall back to "open this browser tab" for steps that genuinely have no API. The Claude App install is the only known unavoidable one; research the rest before assuming.
- **Never echo the API key in chat.** Detection order:
  1. `$ANTHROPIC_API_KEY` env var
  2. `~/.config/anthropic/key` file (single line, key only)
  3. macOS Keychain entry (only if the operator pre-authorizes a one-time read)
  4. Interactive `gh secret set ANTHROPIC_API_KEY --repo <repo>` paste (the operator types it in the gh prompt, not in chat)

  The skill never reads the key value itself; it only confirms presence via `gh secret list`.

---

## Parallel-dispatch DAG (concrete)

```
              /setup invoked
                    │
                    ▼
       gh repo create --push  (sequential; everything else depends on this)
                    │
                    ▼
    ┌───────────────┼─────────────────┬─────────────────┬──────────────────┐
    ▼               ▼                 ▼                 ▼                  ▼
 labels         visibility       secret source     App install URL    first checks
 batch          flip if          detection          browser-opened     run watcher
                Free+private     (env→file→
                                 keychain)
    │               │                 │                 │                  │
    └───────────────┴────────┬────────┴─────────────────┴──────────────────┘
                             │
                             ▼
                     branch protection
                     (after first-checks-run; needs contexts to exist)
                             │
                             │   joins:  App installed (user)
                             │           ANTHROPIC_API_KEY secret set
                             ▼
                       seed [tweak] Issue
                             │
                             ▼
                   chain drives to merged PR
                             │
                             ▼
                   scouts fire via workflow_run
                             │
                             ▼
                    iteration complete
```

---

## Grey areas — research, cite source, do not assume

These are the questions session 1 didn't answer cleanly. Each needs a primary-source citation in the resulting code/skill comments.

### 1. Programmatic Claude App install paths

- Source to check: `https://github.com/apps/claude` documentation; GitHub Apps manifest API (`https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-using-url-parameters` and `https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/creating-a-github-app-from-a-manifest`).
- Specifically: does the official App support a pre-approved installation flow? Can an installation token be bootstrapped server-side?
- Goal: minimise clicks. Best case is one-click install; today it is several (repo selection, install, confirm).

### 2. Custom branded App via manifest as a faster path

- The manifest flow lets a repo define an App's permissions/events in YAML and offer a single-click "Create this App" URL. Could Ribosome ship one?
- Trade-offs: branding control + reduced friction vs. losing the official App's centrally-managed maintenance.

### 3. Anthropic API key creation via API

- Check `https://docs.anthropic.com/en/api/admin-api` (or successor) for org-admin endpoints. If a workspace-scoped key API exists, prefer it for test repos so spend caps are enforceable.
- If UI-only, document the click path and time it; that becomes part of the "10-minute" budget honestly.

### 4. Branch protection: legacy API vs rulesets in 2026

- Personal accounts: still use `PUT /repos/{owner}/{repo}/branches/{branch}/protection`?
- Org accounts: rulesets (`/repos/{owner}/{repo}/rulesets`) are newer; do they supersede the legacy endpoint? Are there migration deadlines?
- Decide which `/setup` should prefer in 2026.

### 5. GitHub Actions enablement on fresh repos

- Defaults: enabled by default on personal accounts, sometimes disabled at org level.
- Programmatic enable: `PUT /repos/{owner}/{repo}/actions/permissions` with `{ "enabled": true, "allowed_actions": "all" }` (verify).
- Add to `setup:check` as a gate so it fails fast on locked-down orgs.

### 6. `gh secret set` non-interactive paths

- `--body "<value>"` — value on command line; echoes to shell history. Bad.
- `--body-file <path>` — reads from file; OK if the operator authorizes a one-shot file.
- stdin pipe `echo "$VAR" | gh secret set NAME --repo R` — never echoes to TTY. Best for keychain + env-var paths.
- Confirm none of these end up in process listings (`ps`) — value-on-CLI does, others don't.

### 7. Slack integration shape

Compare four shapes for posting long PR/validator reports:

| Shape | Setup time | Buttons / slash | Pretty thread | Cost | Recommended for |
|---|---|---|---|---|---|
| (a) Incoming webhook | ~5 min | no | basic | free | "just notify me" |
| (b) Slack app with bot token | ~15 min | yes (can do `/approve` from Slack) | yes | free until distribution | full chain remote-control |
| (c) Slack workflow builder | ~10 min | limited buttons | basic | free | no-code teams |
| (d) Official GitHub-Slack app | ~3 min | comments on Issues/PRs | yes | free | ambient awareness, complementary |

Deliverable: `.claude/skills/setup/slack.md` documents all four with copy-paste-ready snippets. Recommended primary path: (b) with optional (d) layered for ambient signal.

---

## Deliverables

- `/Users/jacobl/projects/ribosome/.claude/skills/setup/SKILL.md` — rewritten. Parallel-dispatch contract. Single source of truth for the bootstrap walk-through. Stays under 300 lines.
- `/Users/jacobl/projects/ribosome/scripts/setup-bootstrap.ts` — new. Orchestrator that fans out independent steps and joins on dependencies. Returns a structured progress object; emits one `key=value` line per step start/end.
- `/Users/jacobl/projects/ribosome/scripts/setup-check.ts` — extended. New detection for any new failure modes surfaced during iteration (Actions disabled at org level, rulesets vs legacy protection, etc). Preserve existing `key=value` output format so existing skill readers still work.
- `/Users/jacobl/projects/ribosome/.claude/skills/setup/slack.md` — new. Slack integration options with trade-offs and copy-paste-ready snippets. Linked from `SKILL.md`.
- Eval invariants for any new failure shape surfaced during iteration. Continue the `R8+`, `T8+`, `TR7+` numbering. Rule-numbers are stable (CLAUDE.md convention).
- Tests for the new orchestrator. Suggested location: `src/chain/setup.test.ts` (or `scripts/setup-bootstrap.test.ts` if that fits the existing test layout better).
- `setup-runs.md` (gitignored artifact) — append-only log of iteration timings and friction notes. One block per iteration.

---

## Iteration mode

```
loop:
  N = next available integer ≥ 2
  test_repo = "jacoblewisau/ribosome-test-{N}"

  start_time = now()
  /setup --repo $test_repo --visibility public
  end_time_to_ready = now()

  open seed [tweak] Issue
  drive through three gates → merged PR
  end_time_to_merged = now()

  confirm scouts succeeded post-merge

  append to setup-runs.md:
    - iteration N
    - time-to-ready: $(end_time_to_ready - start_time)
    - time-to-merged: $(end_time_to_merged - start_time)
    - friction notes: what surprised me, what failed, what I worked around

  fix friction in skill or scripts on a feature branch
  delete or archive $test_repo
  N += 1

stop when:
  - two consecutive iterations meet all five outcome criteria
  - "what surprised me" is empty for both
```

After every iteration, surface a **what surprised me** note. Add eval traps for anything that could regress.

---

## Stop condition

Two consecutive fresh-repo runs reach all-green `setup:check` + merged seed PR + scout success, both under 10 min, with the only manual step being the Claude App browser install (or a researched-and-justified custom App equivalent). At that point `/setup` is shippable.

---

## Non-goals

- Touching the chain itself (`researcher`, `builder`, `validator`, etc.). Out of scope.
- Reworking eval mechanics. Just add invariants where appropriate.
- Modifying the operator-facing `OPERATOR.md` beyond pointing to `/setup`.

---

## Notes

- Do **not** iterate on `jacoblewisau/ribosome-test`. Preserve it as the session-1 reference. The four PRs merged into it (the seed tweak, the scout OIDC fix, the agent-prompt fix, and the chain-validation tweak baseline) are the validated baseline behaviour the new `/setup` should reproduce.
- Be proactive. Solve your own problems. Research before assuming. Same discipline as session 1.
- The grey-area discipline (cite a source, do not rely on training-data recall) was what caught the five real bugs in session 1. Maintain it.
