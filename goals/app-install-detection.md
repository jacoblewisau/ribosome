# Goal — decide how (or whether) to deep-verify the Claude App install

**Status:** decision needed from the maintainer. The honest fix is already shipped (commit `3158dcb`); this doc is about whether to go further.
**Authored:** 2026-05-29, session 4.
**Driver:** the session-3 handoff queued "App-install verification probe" (open work item 2), premised on the claim that `anthropics/claude-code-action` emits a clean, parseable error string (`"Claude Code is not installed on this repository"`) when the App is missing, which `setup-check.ts` could dispatch a probe workflow to read. Primary-source verification falsified that premise. This doc records what is actually true and the real options.

The primary references (all verified live on 2026-05-29, not from training-data recall):
- `anthropics/claude-code-action`, `src/github/token.ts`: on a failed App token exchange it logs `App token exchange failed: <status> <statusText> - <error.message>` to stderr and throws `new Error(error.message ?? "Unknown error")`. The human-readable text comes from the Anthropic backend, not the action.
- Two authenticated `gh search code` queries against `anthropics/claude-code-action` for `"Claude Code is not installed"` and `"not installed on this repository"`: zero results.
- GitHub REST API, tested live with the maintainer's `gh` user token:
  - `GET /repos/{owner}/{repo}/installation` requires App-JWT auth (401/403 for a user token).
  - `GET /user/installations` returns 403: `"You must authenticate with an access token authorized to a GitHub App in order to list installations"`.

---

## What was wrong, and what shipped

`setup-check.ts` probed `GET /repos/{owner}/{repo}/installation` and grepped for `"app_slug": "claude"`. That endpoint needs App-JWT auth, so with a normal `gh` user token it always failed and the check stamped `claude_app=missing` on every healthy repo. The setup skill keys completion off `=ok` lines, so a permanent `=missing` read as an unclosable setup gap. The orchestrator (`setup-bootstrap.ts step_app_install_wait`) had already learned this and proceeds honestly; only `setup-check.ts` had drifted.

Commit `3158dcb` fixed the false negative:
- `src/setup/claude-app.ts`: a pure classifier returning `ok` only on a genuine positive signal (the installation API succeeds and names the `claude` slug, which can happen inside a correctly-authed Actions run), otherwise `unknown` with an honest reason and a manage-installs hint. Never `missing`.
- `setup-check.ts` wired to it; emits a tri-state `claude_app` line.
- `setup/SKILL.md`: `claude_app=unknown` is now documented as an acceptable terminal state, and the prose that described the dead endpoint as a working check is corrected.

Regression coverage: `src/setup/claude-app.test.ts` (7 cases), including a guard that no classification ever renders `claude_app=missing`.

## The hard constraint

A plain user token cannot deterministically confirm that a specific GitHub App is installed on a specific repo. Both free API paths are closed to it (see references). This is a GitHub design constraint, not a Ribosome bug. So `unknown` is the honest best case for a local, free, user-token check. There is no cheap deterministic answer.

## Options for a real deep check (the open decision)

If `unknown` is not good enough and you want `setup-check` (or a separate command) to actually answer "is the App installed?", these are the only viable mechanisms. None is free-and-deterministic.

1. **Accept `unknown`; do nothing more.** Recommended default. The first real chain run is the authoritative test: if the App is missing, the action fails clearly at token exchange. Cost: zero. Downside: the maintainer learns install state at first Issue, not at setup time.

2. **Run-conclusion probe (opt-in, paid).** Add a `workflow_dispatch`-only probe workflow that invokes the action with a trivial prompt on Haiku and an `--allowedTools` allowlist. A new `npm run setup:check -- --probe-app` dispatches it, waits, and reads the run conclusion: success implies installed-and-working; failure-at-token-exchange implies missing-or-bad-token. Cost: a few cents and 1 to 3 minutes per probe. Caveats: the signal is the run conclusion, not a parseable string (the string does not exist); failure is ambiguous (a bad or expired auth secret also fails token exchange, so this conflates "App missing" with "auth bad"); needs a live dispatch to validate, so it cannot be fully unit-tested offline. If chosen, keep it opt-in so the default `setup:check` stays fast and free.

3. **Bot-activity heuristic (free, one-directional).** Search the repo for prior activity by the Claude bot account (a PR or comment author). Presence is a strong positive; absence proves nothing (a freshly installed App has no activity yet). Requires confirming the exact bot login from primary source first (not yet verified). Useful only as an additional positive signal layered on option 1.

My recommendation: ship nothing further now (option 1 is already in place and honest). If you later want setup-time confidence, option 2 as an explicit `--probe-app` flag is the only real answer, and it must be framed as "did a real run succeed," not "is the App installed," because of the auth-vs-install ambiguity.

## Suggested eval invariant (deferred, not added)

A trap guarding this fix was intentionally NOT added this session, because it would require editing `src/evals/tasks.ts` and regenerating `evals/baseline.json`, the two files your concurrent session-4 work is actively changing (merge-conflict risk). The unit tests already cover the regression. When your eval work settles, consider adding:

> `setup-check.ts` must not stamp a binary `claude_app=missing`; it must route through `classifyClaudeApp` and be able to emit `claude_app=unknown`.

Concretely: assert `scripts/setup-check.ts` imports `classifyClaudeApp` from `src/setup/claude-app.ts` and does not contain the literal `claude_app=missing` framing. This locks the honesty fix against a future revert to the App-JWT-only probe.

## What is deferred to a babysat moment

If you choose option 2, the live validation (one real probe dispatch against a repo with a known App state) needs a target repo and costs a few cents; it should be run interactively, not unattended. There is nothing to validate live for option 1.
