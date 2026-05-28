---
name: setup
description: Bootstraps a fresh Ribosome repo on GitHub end to end via the `npm run setup` orchestrator. Walks the maintainer through the one unavoidable manual step (Claude App install). Idempotent; re-running on a bootstrapped repo is a sub-5s no-op. Target: ready to open an Issue in under 10 minutes from `git clone`.
---

You are running the `setup` skill in Ribosome. Your job: take a fresh checkout of this repo and get it to the point where an operator can open an Issue and the chain takes over.

You are the FIRST thing a new maintainer runs after `git clone`. The operator (non-coder, GitHub UI only) never runs you; you exist for the maintainer.

## How to run

The bootstrap is one command. The orchestrator does everything programmatic in parallel and waits at the two human-gated steps (Claude App install, ANTHROPIC_API_KEY if not already on the local machine).

```
npm run setup -- --repo <repo-name> --visibility public --seed-issue
```

That command:

1. Verifies preflight (gh CLI installed and authenticated, in a git repo, on `main`).
2. Creates the GitHub remote and pushes `main`.
3. Fans out, **in parallel**: label batch (five `ribo:*` labels), Actions enablement, visibility flip if needed, ANTHROPIC_API_KEY source detection, Claude App install URL pre-opened in the browser.
4. Waits for the first `checks.yml` run on `main` to complete.
5. Applies branch protection (strict status checks `typecheck`/`test`/`verify`, linear history, no force pushes or deletions, `enforce_admins=true`).
6. Waits for the Claude App to be detected via `GET /repos/{owner}/{repo}/installation` and for `ANTHROPIC_API_KEY` to be detected via `gh secret list`.
7. Opens a seed `[tweak]` Issue (only when `--seed-issue` is passed) so the chain has its first input.

Every step emits one `key=value` line on stderr at start and at end. The final JSON summary lands on stdout. Both are readable by humans and parsers.

## Flags

| Flag | Default | Effect |
|---|---|---|
| `--repo NAME` | required | Repository name under your gh-authenticated user (or `--owner`). |
| `--owner OWNER` | gh-authenticated user | Override the owner (use for org repos). |
| `--visibility public\|private` | `public` | `private` only works on Pro+ tiers (branch protection requires public on Free). |
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

The orchestrator opens `https://github.com/apps/claude/installations/new` in the browser and waits for `GET /repos/{owner}/{repo}/installation` to start returning the Claude App. Click Install, choose the repo, click Install again.

### ANTHROPIC_API_KEY creation

The Anthropic Admin API supports managing existing keys but **API key creation is still console-only**. If the operator already has a key on the local machine (env var `$ANTHROPIC_API_KEY` or file `~/.config/anthropic/key`), the orchestrator pipes it via stdin so the value never appears on the CLI or process listing. If neither source exists, the orchestrator prints the console URL and waits for the operator to run `gh secret set ANTHROPIC_API_KEY --repo <repo>` in another terminal.

## What you do

You are the skill the maintainer triggers when `/setup` is invoked. Your job:

1. Read the current state via `npm run setup:check`. If everything is `=ok`, congratulate the maintainer and stop.
2. Otherwise, walk the maintainer through `npm run setup -- ...`. Pick the right flags from their answers to at most three questions: repo name, visibility, whether to open a seed Issue.
3. Stream the orchestrator's stderr lines back to the maintainer (they are parseable; you can render them as a progress list).
4. When the orchestrator pauses at the Claude App install, tell the maintainer plainly what to do in the browser.
5. When the orchestrator pauses at `ANTHROPIC_API_KEY`, tell the maintainer how to set it (env, file, or `gh secret set` interactive).
6. When the orchestrator finishes, run `npm run setup:check` once more and confirm every line is `ok`. Open the Issues page URL in their browser.

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
