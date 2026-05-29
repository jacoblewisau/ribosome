---
name: setup
description: Bootstraps a fresh Ribosome repo on GitHub end to end via the `npm run setup` orchestrator. Walks the maintainer through the one unavoidable manual step (Claude App install). Idempotent; re-running on a bootstrapped repo is a sub-5s no-op. Target: ready to open an Issue in under 10 minutes from `git clone`.
---

You are running the `setup` skill in Ribosome. Your job: take a fresh checkout of this repo and get it to the point where an operator can open an Issue and the chain takes over.

You are the FIRST thing a new maintainer runs after `git clone`. The operator (non-coder, GitHub UI only) never runs you; you exist for the maintainer.

## How to run

The bootstrap is one command. The orchestrator does everything programmatic in parallel and waits at the two human-gated steps (Claude App install, auth secret if not already on the local machine).

```
npm run setup -- --repo <repo-name> --visibility public --seed-issue
```

The default `--auth oauth` draws from your Claude Pro/Max subscription quota: every chain step on every Issue is covered by your subscription, zero incremental API spend. The action authenticates with `CLAUDE_CODE_OAUTH_TOKEN`, generated via `claude setup-token`.

If you want pay-per-token API billing instead (no subscription, or hard spend caps via the Anthropic console), pass `--auth api`. The action authenticates with `ANTHROPIC_API_KEY`.

Both shapes are wired into every workflow (`ribosome.yml` and all 7 `scout-*.yml`); the action uses whichever secret is populated. Switching modes later is just setting the other secret (no workflow edits needed).

That command:

1. Verifies preflight (gh CLI installed and authenticated, in a git repo, on `main`).
2. Creates the GitHub remote and pushes `main`.
3. Fans out, **in parallel**: label batch (five `ribo:*` labels), Actions enablement, visibility flip if needed, ANTHROPIC_API_KEY source detection, Claude App install URL pre-opened in the browser.
4. Waits for the first `checks.yml` run on `main` to complete.
5. Applies branch protection (strict status checks `typecheck`/`test`/`verify`, linear history, no force pushes or deletions, `enforce_admins=true`).
6. Opens the Claude App install URL and waits a fixed interval for you to install it, then proceeds (a user token cannot verify a GitHub App install, so the orchestrator does not block on it; the first chain run surfaces any missing-App failure). Separately waits for the auth secret to be detected via `gh secret list`.
7. Opens a seed `[tweak]` Issue (only when `--seed-issue` is passed) so the chain has its first input.

Every step emits one `key=value` line on stderr at start and at end. The final JSON summary lands on stdout. Both are readable by humans and parsers.

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--repo NAME` | required | Repository name under your gh-authenticated user (or `--owner`). |
| `--owner OWNER` | gh-authenticated user | Override the owner (use for org repos). |
| `--visibility public\|private` | `public` | `private` only works on Pro+ tiers (branch protection requires public on Free). |
| `--auth oauth\|api` | `oauth` | Authentication path. `oauth` uses Pro/Max subscription quota (recommended); `api` uses pay-per-token. |
| `--seed-issue` | off | After bootstrap, open the seed `[tweak]` Issue and stop. The chain takes over from there. |
| `--no-open-browser` | off | Suppress `open` for the Claude App install URL. Useful in headless contexts. |
| `--timeout-min N` | `5` | Per-step timeout for the waits (first-checks-run, App install, secret set). |

## What the operator sees

Once `npm run setup` finishes successfully, the operator can open `https://github.com/<owner>/<repo>/issues/new/choose`, pick the Feature or Tweak template, fill in plain-language fields, and submit. From that point, the chain runs autonomously through three gates:

1. **Gate 1**: bot posts the story; operator replies `/approve` or `/changes ...`.
2. **Gate 2**: bot posts the spec; operator replies `/approve` or `/changes ...`.
3. **Gate 3**: bot opens a draft PR with validator report; operator merges with the green button.

All of that is documented in `OPERATOR.md`.

## What the bootstrap does not automate

These are the irreducibly manual steps. The orchestrator waits at each; do not paper over them.

### Claude GitHub App install

The Claude App must be installed on the new repo. There is **no programmatic install path** for a GitHub App (the `repository_ids` URL parameter does not exist for App installation; the manifest flow is a 3-step handshake that is more complex than the official App for a single-repo install).

The orchestrator opens `https://github.com/apps/claude/installations/new` in the browser and waits a fixed interval for you to install it. A user token cannot confirm a GitHub App install (`GET /repos/{owner}/{repo}/installation` needs App-JWT auth, and `GET /user/installations` needs an app-authorized token; both return 403 for a `gh` user token), so the orchestrator proceeds after the wait rather than blocking on a check that can never pass. Click Install, choose the repo, click Install again. If the App is not actually installed, the first chain run fails clearly at the action's token-exchange step.

### Auth secret (OAuth token or API key)

The Anthropic Admin API supports managing existing keys/tokens but **issuance is still console-only or via `claude setup-token`**. The orchestrator never reads the secret value; it only confirms presence via `gh secret list`.

**OAuth path** (`--auth oauth`, the default):
- Detection order: `$CLAUDE_CODE_OAUTH_TOKEN` env var, then `~/.config/claude/oauth-token` file, then interactive prompt.
- If neither local source exists, the orchestrator prints the howto and waits for the operator to run `claude setup-token | gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo <repo>` in another terminal. The pipe keeps the token off the CLI and out of shell history.

**API path** (`--auth api`):
- Detection order: `$ANTHROPIC_API_KEY` env var, then `~/.config/anthropic/key` file, then interactive prompt.
- If neither local source exists, the operator gets the key at https://console.anthropic.com/settings/keys and runs `gh secret set ANTHROPIC_API_KEY --repo <repo>`.

In both modes, the value is piped via stdin to `gh secret set` so it never appears on the CLI or process listing.

## What you do

You are the skill the maintainer triggers when `/setup` is invoked. Your job:

1. Read the current state via `npm run setup:check`. If every line is `=ok`, congratulate the maintainer and stop. Treat `claude_app=unknown` as an acceptable terminal state, not a gap: a user token cannot verify the App install, so `unknown` is the honest best case (the first chain run is what actually confirms it).
2. Otherwise, walk the maintainer through `npm run setup -- ...`. Pick the right flags from their answers to at most four questions: repo name, visibility, auth mode (oauth for Pro/Max subscribers, api for pay-per-token), whether to open a seed Issue.
3. Stream the orchestrator's stderr lines back to the maintainer (they are parseable; you can render them as a progress list).
4. When the orchestrator pauses at the Claude App install, tell the maintainer plainly what to do in the browser.
5. When the orchestrator pauses at the auth secret step, tell the maintainer how to set it based on the chosen `--auth` mode (env, file, or interactive `gh secret set` paste / `claude setup-token` pipe).
6. When the orchestrator finishes, run `npm run setup:check` once more and confirm every line is `ok` (a `claude_app=unknown` line is expected and acceptable, per step 1 above). Open the Issues page URL in their browser.

## What you do not do

- You do not commit anything. Setup is config; the maintainer commits intentionally.
- You do not store `ANTHROPIC_API_KEY` anywhere except as a repo secret. Do not write it to a file, do not paste it back into chat, do not log it. The orchestrator follows the same rule.
- You do not modify any agent or skill file during setup. Setup configures the GitHub side; the chain's body is unchanged.
- You do not iterate on `jacoblewisau/ribosome-test` (the session-1 reference). Use fresh names like `ribosome-test-2`.

## See also

- `.claude/skills/setup/slack.md`: Slack integration options (incoming webhook, bot app, workflow builder, official GitHub-Slack app) with trade-offs and copy-paste snippets.
- `scripts/setup-bootstrap.ts`: the orchestrator source. Inputs, steps, and the DAG in code.
- `scripts/setup-check.ts`: the idempotent gap report. Reads-only; never mutates.
- `goals/setup-skill-rebuild.md`: the design brief that drove this rewrite.
- `OPERATOR.md`: what the operator sees after bootstrap.

## Style

No en or em dashes. No emoji. Plain English. Each instruction is one command or one click. After each, wait for the orchestrator's stderr line confirming the step before moving on.
