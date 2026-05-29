/**
 * Classify the Claude GitHub App install state from signals a *user token*
 * can actually obtain.
 *
 * Root constraint (verified 2026-05-29 against anthropics/claude-code-action
 * and the GitHub REST API): a plain user token CANNOT deterministically
 * confirm that a specific GitHub App is installed on a specific repo.
 *   - `GET /repos/{owner}/{repo}/installation` requires App-JWT auth; it
 *     returns 401/403 for a user token.
 *   - `GET /user/installations` requires an app-authorized user-to-server
 *     token; a `gh` CLI user token gets 403 ("You must authenticate with an
 *     access token authorized to a GitHub App").
 * The action itself emits no parseable "App not installed" string: an
 * uninstalled App surfaces only as a backend-supplied token-exchange failure
 * thrown from `src/github/token.ts` at chain runtime.
 *
 * Therefore: report `ok` only on a genuine positive signal; otherwise report
 * `unknown` (NEVER a false-negative `missing`). Absence of a positive signal
 * is not evidence of absence. This mirrors the orchestrator's already-honest
 * stance in scripts/setup-bootstrap.ts (step_app_install_wait), which
 * `setup-check.ts` had drifted out of sync with.
 */

export interface ClaudeAppProbe {
  /** Whether a GitHub remote was resolved at all. */
  hasRemote: boolean;
  /** Did `gh api repos/{owner}/{repo}/installation` exit 0 (HTTP 200)? */
  installationApiOk: boolean;
  /** stdout on success, or the error text on failure. */
  installationApiBody: string;
}

export type ClaudeAppState = "ok" | "unknown";

export interface ClaudeAppStatus {
  state: ClaudeAppState;
  /** Present when state === "ok". */
  value?: string;
  /** Present when state === "unknown". */
  reason?: string;
  hint?: string;
}

const MANAGE_URL = "https://github.com/apps/claude/installations";

export function classifyClaudeApp(probe: ClaudeAppProbe): ClaudeAppStatus {
  if (!probe.hasRemote) {
    return { state: "unknown", reason: "cannot check without a remote" };
  }
  // The only positive signal available: the installation endpoint succeeded
  // AND names the Claude app slug. This works only when the caller holds an
  // App-JWT or app-authorized token (e.g. inside a correctly-configured
  // Actions run); a normal user token cannot produce it.
  if (
    probe.installationApiOk &&
    /"app_slug"\s*:\s*"claude"/.test(probe.installationApiBody)
  ) {
    return { state: "ok", value: "installed (verified via installation API)" };
  }
  return {
    state: "unknown",
    reason:
      "cannot verify App installation with a user token (GitHub requires an App-JWT or app-authorized token; absence here is not evidence the App is missing)",
    hint:
      "manage installs at " +
      MANAGE_URL +
      " ; the first chain run surfaces a clear failure if the App is not installed",
  };
}

/** Render a ClaudeAppStatus as the script's `key=value` status line. */
export function formatClaudeAppLine(status: ClaudeAppStatus): string {
  if (status.state === "ok") {
    return `claude_app=ok value=${JSON.stringify(status.value ?? "")}`;
  }
  const hint = status.hint ? ` hint=${JSON.stringify(status.hint)}` : "";
  return `claude_app=unknown reason=${JSON.stringify(status.reason ?? "")}${hint}`;
}
