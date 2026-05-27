# Ribosome

Ribosome is a Claude Code workflow that turns a GitHub Issue into a merged
pull request through a coordinated chain of specialised subagents and
skills. It is built for a non coder operator (the GitHub UI is the whole
interface) and a proactive posture (background scouts open Issues for
failing tests, dependency rot, coverage gaps, and doc drift; Phase 4
deliverable). The name is from the molecular machine that reads an
instruction (mRNA) and synthesises a new working object (a protein). The
design document is at `/Users/jacobl/research/software-factory/PLAN.md`.

If you are the operator, read `OPERATOR.md` and stop there; it is the
whole manual and it is two pages long. If you are the maintainer, read
`CLAUDE.md` next for the architectural rules, then the plan. Phase 3
(GitHub interface) ships with this commit; Phase 4 (proactive scouts)
and Phase 6 (mechanical scope hooks) are the next planned phases.

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

The workflow uses Claude Opus 4.7 for every step. A full six-step chain
(researcher, story-writer, spec-writer, builder, test-author / validator,
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

Shipped:
- Three Issue templates (Feature, Bug, Tweak).
- One workflow file (`.github/workflows/ribosome.yml`) handling all six
  slash commands via job-level `if:` conditionals.
- Sticky-comment state machine on each Issue.
- `pr-shepherd` subagent that opens draft PRs.

Deferred (with rationale in the plan):
- Playwright screenshots on PRs. Plan §13 Q3 flagged this as
  fallback-eligible; Phase 3 ships text-only. A follow-on phase adds
  screenshots.
- Proactive scouts (CI watcher, dep scanner, coverage scout, doc drift,
  shepherd, dreamer-digest). Phase 4 deliverable. The dream skill is
  ready; the scout that posts a weekly digest Issue is not yet wired.
- Mid-run resumption from a partial chain step. If a workflow run times
  out mid-builder, the maintainer intervenes manually. Phase 6 will add
  resumption via the `ribosome/<id>` branch state.
- Eval harness on PRs touching `.claude/**`. Phase 5 deliverable.

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
