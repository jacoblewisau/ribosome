# Ribosome

Ribosome is a Claude Code workflow that turns a GitHub Issue into a merged
pull request through a coordinated chain of specialised subagents and
skills. It is built for a non coder operator (the GitHub UI is the whole
interface) and a proactive posture (background scouts open Issues for
failing tests, dependency rot, coverage gaps, and doc drift). The name is
from the molecular machine that reads an
instruction (mRNA) and synthesises a new working object (a protein). The
design document is at `/Users/jacobl/research/software-factory/PLAN.md`.

If you are the operator, read `OPERATOR.md` and stop there; it is the
whole manual and it is two pages long. For a guided, clickable version, open
`docs/tutorial.html` in a browser. If you are the maintainer, read
`CLAUDE.md` next for the architectural rules, then the plan. All phases
through 6 have shipped (foundations, the chain, the verify schema, live
memory, the GitHub workflow, proactive scouts, the dream pass, the
structural eval harness, and the enforcement hooks); open work is
incremental and tracked in `STATE.md`.

## Local setup

```
git clone <this repo>
cd ribosome
git config core.hooksPath .claude/hooks
npm ci
```

The hook config is per-clone; setting it once after cloning wires the
pre-commit secrets guard.

## GitHub setup (one time, by the maintainer)

These steps turn the repo into a Ribosome-enabled workflow. The operator
does none of this.

1. **Install the Claude GitHub App** on this repository:
   https://github.com/apps/claude . The app needs **Contents: read & write**,
   **Issues: read & write**, **Pull requests: read & write**. The Ribosome
   workflow assumes the official app; if you fork it to your own GitHub App
   for branded comments, mirror the same permissions.

2. **Add the `ANTHROPIC_API_KEY` secret** to the repo: Settings -> Secrets
   and variables -> Actions -> New repository secret. Get the key from
   https://console.anthropic.com . The Ribosome workflow reads this as
   `secrets.ANTHROPIC_API_KEY`.

3. **Apply the branch protection rules below** to `main` before the first
   chain run. Each rule has a reason behind it. (Repeat the checklist on
   any other long-lived branch.)

4. **Confirm the workflow is enabled**: Settings -> Actions -> General ->
   "Allow all actions and reusable workflows" (or at minimum allow
   `anthropics/claude-code-action`).

5. **Open the first Issue** using one of the templates (Feature, Bug, or
   Tweak). The bot acknowledges within a minute.

## Cost expectation

The workflow uses Claude Opus 4.8 for every step. A full six-step chain
(researcher, story-writer, spec-writer, builder, validator,
pr-shepherd) is roughly $5 to $9 in API tokens. Each `/approve` advances
one step. The maintainer can switch to Sonnet by editing the `--model`
flag in `.github/workflows/ribosome.yml`. See `MEMORY.md` and the dream
skill for what the maintainer keeps; Opus is recommended for the dream
nightly cron during the first months of operation.

## Branch protection (apply on first push)

Apply these to `main` in Settings -> Branches -> Branch protection rules,
or via `gh api`. Each rule has a reason.

- [ ] Require a pull request before merging to `main`. (Stops direct
      pushes that bypass the validator.)
- [ ] Require at least one approving review on every PR. (For Ribosome
      PRs, the operator is the reviewer; this enforces the third human
      gate.)
- [ ] Require status checks to pass before merging. Include at minimum:
      typecheck, lint, unit tests, acceptance tests, contract verify.
      (Phase 2 wired the checks; this enforces them at merge time.)
- [ ] Require conversation resolution before merging. (Forces the
      operator to acknowledge each validator finding.)
- [ ] Require linear history. (Merge conflicts surface as conflicts, not
      as silent rebases.)
- [ ] Block force pushes to `main`. (Non-negotiable. Ribosome never
      force pushes; this stops a human mistake too.)
- [ ] Block deletions of `main`. (Same reason.)
- [ ] Restrict who can push to `main` to: nobody directly. All changes
      go through PRs. (Includes the maintainer.)
- [ ] Require signed commits if the maintainer has signing set up.
      (Optional, but recommended once the repo holds real work.)
- [ ] Do not allow bypassing the above for any role, including admins.
      (The point of branch protection is that it is not bypassable in
      the heat of an incident.)

## What is and is not in Phase 3

Shipped and demonstrated end-to-end on a real GitHub repo
(jacoblewisau/ribosome-test 2026-05-28):
- Three Issue templates (Feature, Bug, Tweak).
- One workflow file (`.github/workflows/ribosome.yml`) handling all six
  slash commands via job-level `if:` conditionals.
- Sticky-comment state machine on each Issue (JSON inside HTML
  comments).
- `pr-shepherd` subagent that opens draft PRs.
- The `setup` skill walks a maintainer through the GitHub configuration
  on a fresh checkout; `npm run setup:check` reports state.
- The `checks.yml` workflow runs `npm test`, `npm run typecheck`, and
  `npm run verify` on every push and PR so branch protection has
  named status checks to require.

What the live demo showed (chain 0005, "rename heading to My Todos"):
- Issue opened with `ribo:feature` label triggered the workflow within
  ~10 seconds.
- Researcher + story-writer ran (~7:48 wall clock) and posted a
  structured story with gate 1 instructions.
- `/approve` triggered spec-writer (~3:09); spec posted with gate 2.
- `/approve` triggered the build cascade (builder + validator +
  pr-shepherd) (~6:47); draft PR #2 opened on branch
  `ribosome/0005` with a clean validator report and the acceptance
  test for the change.
- Total wall clock from Issue to draft PR: ~17 minutes of chain work,
  plus operator approval time. Estimated cost: $5 to $8 on Opus 4.8.

Deferred (the one item still outstanding):
- Playwright screenshots on PRs. Plan §13 Q3 flagged this as
  fallback-eligible; the chain ships text-only PRs today. The
  browser-evidence work (project Issue #34) adds per-screen screenshots;
  until it lands, a PR carries the validator report and a plain-language
  summary, not screenshots.

The other items deferred here have since shipped: the proactive scouts (CI
watcher, dep scanner, coverage scout, doc drift, shepherd, dreamer-digest;
Phase 4), the structural eval harness on PRs touching `.claude/**` (Phase 5),
and the enforcement hooks (Phase 6). Mid-run resumption via the
`ribosome/<id>` branch remains a deliberate non-goal: each invocation is
scoped to one gate transition, so a single failure leaves the Issue
recoverable.

What this live run uncovered as bugs (now fixed):
1. The coordinator skill filtered bot comments using
   `gh issue view --json` which strips the `[bot]` suffix from
   `author.login`; switched to `gh api ... --jq '.[] | select(.user.type
   == "Bot")'` which is robust regardless of login format.
2. The Claude Code Action ran with default permissions that deny most
   tool calls; the workflow's `claude_args` now passes an explicit
   `--allowedTools` allowlist scoped to `Read,Write,Edit,Glob,Grep`
   and `Bash(gh:*),Bash(git:*),Bash(npm:*),...` so Claude can do its
   work without per-call denials.
3. Issue templates declare default labels but the labels themselves
   are not auto-created; the `setup` skill now documents the
   `gh label create` block to run once per repo before the first
   Issue.

## Inspection commands (maintainer only)

```
npm run chain:list           # list every chain on disk
npm run chain:show 0003      # detailed view of one chain
npm run dream:show           # the latest distilled store summary
npm run dream:forget <id>    # remove a distilled item
npm run memory:snapshot      # commit current memory state for audit
```

The operator uses none of these. The maintainer uses them for inspection
and intervention.
