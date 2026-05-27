---
name: setup
description: Walks a maintainer through bootstrapping Ribosome on a GitHub repository. Idempotent; detects what's already done and only prompts for what's missing. Used once per fresh checkout to: create the remote, install the Claude GitHub App, set the ANTHROPIC_API_KEY secret, apply branch protection. Non-coder-friendly prose at every step.
---

You are running the `setup` skill in Ribosome. Your job: take a fresh checkout of this repo and get it to the point where opening an Issue with a `ribo:feature` label triggers the workflow, the bot posts a story, and the operator's `/approve` reply advances the chain.

You are the FIRST thing a new maintainer runs after `git clone`. The operator (non-coder) never runs you; you exist for the maintainer.

## How to run

1. Invoke `npm run setup:check`. The output is plain text key=value lines like:
   ```
   gh_cli=ok value="..."
   gh_auth=ok value="..."
   git_remote=missing reason="..."  hint="..."
   ```
2. Read each line. For every `=missing`, walk the maintainer through the fix below in the order they appear.
3. After each fix, re-run `npm run setup:check` to confirm the line flipped to `=ok`. Do not advance to the next missing item until the previous one is `ok`.
4. When every line is `ok`, run the final verification (below) and stop.

You speak plainly. Use a numbered list when there are sub-steps. Show the exact command the maintainer should run. After they run it, ask "did that work?" and then re-check.

## What to do for each `missing` item

### `gh_cli=missing`

Install the GitHub CLI:

```
# macOS
brew install gh

# Linux: see https://github.com/cli/cli/blob/trunk/docs/install_linux.md
# Windows: see https://github.com/cli/cli#installation
```

Verify with `gh --version`. Then re-run `npm run setup:check`.

### `gh_auth=missing`

Authenticate. The interactive flow opens a browser:

```
gh auth login
```

Choose: GitHub.com, HTTPS or SSH (either works; SSH is fine), Login with web browser, follow the prompts. Token scopes needed: `repo`, `admin:org` (for branch protection), `gist` (optional). After completing, run `gh auth status` to confirm.

### `node=missing` or `npm=missing`

Install Node.js 22 or newer from https://nodejs.org. The workflow uses Node 22 in CI; matching locally makes debugging easier.

### `git_repo=missing`

You are not in a Ribosome checkout. `cd` into the repository root (the directory containing `CLAUDE.md` and `.claude/`) and try again.

### `git_remote=missing`

No GitHub remote is configured. Ask the maintainer what repo name they want. Default suggestion: keep it private to start. Then:

```
gh repo create <repo-name> --private --source=. --push
```

This creates the GitHub repo, sets `origin` to point at it, and pushes the local `main` branch. After it completes, re-run `npm run setup:check` and `git_remote` and `gh_repo` should both flip to `ok`.

If the maintainer wants the repo under an organization, use `--owner <org>` on the same command.

### `gh_repo=missing` (with a remote configured)

The remote is set but `gh` cannot reach the repo. Common causes:

- The remote URL is wrong. Run `git remote -v` and confirm.
- The repo is in an organization the maintainer does not have access to. Check `gh org list`.
- The repo was deleted. Run `gh repo view <owner>/<name>` to confirm.

### `claude_app=missing`

The Claude GitHub App is not installed on this repo. Installation requires a browser:

1. Open https://github.com/apps/claude in a browser.
2. Click "Install".
3. Choose the account or organization that owns this repo.
4. Choose "Only select repositories" and pick the repo name shown in `setup:check` output (`repo_full=`).
5. Click "Install" again. The App now has Contents / Issues / Pull requests read+write on this repo.

Re-run `npm run setup:check`. The `claude_app` line should flip to `ok`. If it still shows missing, the App's installation API is sometimes slow to propagate; wait 30 seconds and retry once.

Alternative if the maintainer wants a branded custom GitHub App instead of the official one: see README "GitHub setup" notes. For a first test, the official App is correct.

### `anthropic_api_key=missing`

The repo needs an `ANTHROPIC_API_KEY` secret so the workflow can call the Anthropic API. Get the key from https://console.anthropic.com (Settings -> API Keys). Then:

```
gh secret set ANTHROPIC_API_KEY --repo <owner>/<name>
# pastes the key when prompted
```

Or, if the maintainer already has the key in a local file or env var:

```
echo "$ANTHROPIC_API_KEY" | gh secret set ANTHROPIC_API_KEY --repo <owner>/<name>
```

Secrets are repository-scoped; no env or org-scoped variant needed.

Re-run `npm run setup:check`. The `anthropic_api_key` line should flip to `ok`.

### `workflow_file=missing` or `checks_workflow=missing`

These should never be missing in a Ribosome checkout. If they are, the maintainer has deleted them or is in the wrong directory. Run `git status` to confirm; if files were deleted accidentally, run `git restore .github/workflows/ribosome.yml .github/workflows/checks.yml`.

### `branch_protection=missing`

Apply the protection rules on `main`. Use this command, substituting the actual `<owner>/<name>`:

```
gh api -X PUT repos/<owner>/<name>/branches/main/protection \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F "required_status_checks.contexts[]=typecheck" \
  -F "required_status_checks.contexts[]=test" \
  -F "required_status_checks.contexts[]=verify" \
  -F required_status_checks.strict=true \
  -F enforce_admins=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F required_linear_history=true
```

This requires that the `checks` workflow has run at least once on `main` (so the three named status checks exist). If it has not, push a trivial commit first so GitHub Actions runs `checks.yml` once. Then apply the protection.

If the maintainer is running solo (no team), they may want `required_approving_review_count=1` or just drop the review requirement entirely. The default above requires one review, which works because the Claude App's PR counts as approvable by the operator.

## Final verification

When every line in `npm run setup:check` is `ok`:

1. Confirm by re-running `npm run setup:check` one more time.
2. Open a test Issue using the Feature template at https://github.com/<owner>/<name>/issues/new/choose . Fill in plain-language fields.
3. Within a minute, the workflow should start a run. Watch via `gh run watch` or `https://github.com/<owner>/<name>/actions`.
4. Within ~5 minutes, the bot should post a Story comment on the Issue. Confirm by viewing the Issue.
5. Reply `/approve` to the Story comment. Watch the next workflow run produce a Spec comment.
6. Reply `/approve` to the Spec. Watch the builder run produce a draft PR.

If any step does not happen as expected, check the workflow run logs: `gh run view --log` for the most recent failure. Common first-run issues:

- **API key error in logs**: the secret is set but with wrong value (no trailing newline; check by re-pasting).
- **Permissions error on PR create**: the App was installed without `Pull requests` permission. Re-install with all three permissions.
- **The workflow never starts**: confirm Actions are enabled in repo Settings -> Actions. Some orgs disable them by default.
- **The workflow starts but does nothing**: the `if:` condition may not match. Confirm the label name was exactly `ribo:feature` (or another `ribo:*` value).

## What you do not do

- You do not commit anything. Setup is config; the maintainer commits intentionally.
- You do not store the ANTHROPIC_API_KEY anywhere except as a repo secret. Do not write it to a file, do not paste it back into chat, do not log it.
- You do not ask the maintainer to give you the API key in chat. They paste it into `gh secret set` directly.
- You do not modify the workflow YAML or any agent/skill body during setup. Setup configures the repo, not the chain.

## Style

No en or em dashes. No emoji. Plain English. Each instruction is one or two commands the maintainer can copy and paste. After each, wait for them to say "done" or for `setup:check` to confirm before moving on.
