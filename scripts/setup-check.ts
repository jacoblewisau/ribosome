#!/usr/bin/env node
/**
 * scripts/setup-check.ts
 *
 * Idempotent setup checks for Ribosome on a GitHub repo. Runs a series
 * of `gh` and `git` queries and prints a structured status block. Used
 * by the `setup` skill: the skill reads this output, decides what is
 * missing, and walks the operator through the next missing step in
 * plain language.
 *
 * Output format is plain text key=value lines so the skill's prose can
 * parse it without choking on quotes.
 *
 * Invoked via: npm run setup:check
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { classifyClaudeApp, formatClaudeAppLine } from "../src/setup/claude-app.ts";

type Check =
  | { ok: true; value: string }
  | { ok: false; reason: string };

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function tryRun(cmd: string): Check {
  try {
    return { ok: true, value: run(cmd) };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.split("\n")[0] || "unknown" };
  }
}

function printCheck(name: string, c: Check, hint?: string): void {
  if (c.ok) {
    console.log(`${name}=ok value=${JSON.stringify(c.value)}`);
  } else {
    console.log(`${name}=missing reason=${JSON.stringify(c.reason)}` + (hint ? ` hint=${JSON.stringify(hint)}` : ""));
  }
}

// 1. gh CLI installed
const ghVersion = tryRun("gh --version | head -1");
printCheck("gh_cli", ghVersion, "install gh: brew install gh OR https://cli.github.com");

// 2. gh authenticated
const ghAuth = tryRun("gh auth status 2>&1 | grep -E 'Logged in to' | head -1");
printCheck("gh_auth", ghAuth, "run: gh auth login");

// 3. node + npm available (the workflow needs them at runtime; the operator's local machine also for memory:snapshot)
const node = tryRun("node --version");
printCheck("node", node, "install node 22+");

const npm = tryRun("npm --version");
printCheck("npm", npm, "node ships with npm");

// 4. local git repo with a main branch
const isGitRepo = existsSync(".git");
if (!isGitRepo) {
  printCheck("git_repo", { ok: false, reason: "not a git repo" }, "run: git init --initial-branch=main");
} else {
  const branch = tryRun("git rev-parse --abbrev-ref HEAD");
  printCheck("git_repo", branch, "(local main branch expected; current branch shown)");
}

// 5. remote configured
const remote = tryRun("git remote get-url origin 2>/dev/null");
printCheck("git_remote", remote, "the setup skill will create a remote with gh repo create");

// 6. detect if this remote is a real GitHub repo (pingable)
let ghRepoFull = "";
if (remote.ok) {
  // Convert SSH/HTTPS to owner/repo
  const m = remote.value.match(/[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (m) {
    ghRepoFull = `${m[1]}/${m[2]}`;
    const repoCheck = tryRun(`gh repo view ${ghRepoFull} --json name --jq .name`);
    printCheck("gh_repo", repoCheck, "remote URL parsed but gh cannot reach the repo");
  } else {
    printCheck("gh_repo", { ok: false, reason: "could not parse owner/repo from remote URL" });
  }
} else {
  printCheck("gh_repo", { ok: false, reason: "no remote configured" });
}

// 7. Auth secret set. The workflows accept either CLAUDE_CODE_OAUTH_TOKEN
//    (Pro/Max subscription quota; recommended) or ANTHROPIC_API_KEY (pay-
//    per-token). Either one is sufficient. Earned 2026-05-28 session 2
//    follow-up: previously hardcoded ANTHROPIC_API_KEY only, hiding the
//    OAuth path from operators who could have used their subscription.
if (ghRepoFull) {
  const all = tryRun(`gh secret list --repo ${ghRepoFull} 2>&1`);
  if (!all.ok) {
    printCheck("auth_secret", { ok: false, reason: "cannot list secrets" }, "gh permissions?");
  } else {
    const hasOauth = /^CLAUDE_CODE_OAUTH_TOKEN/m.test(all.value);
    const hasApi = /^ANTHROPIC_API_KEY/m.test(all.value);
    if (hasOauth && hasApi) {
      printCheck("auth_secret", { ok: true, value: "both (oauth preferred)" });
    } else if (hasOauth) {
      printCheck("auth_secret", { ok: true, value: "oauth (CLAUDE_CODE_OAUTH_TOKEN)" });
    } else if (hasApi) {
      printCheck("auth_secret", { ok: true, value: "api (ANTHROPIC_API_KEY)" });
    } else {
      printCheck(
        "auth_secret",
        { ok: false, reason: "no auth secret set (need CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY)" },
        "oauth (recommended): claude setup-token | gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo " + ghRepoFull +
        "    OR    api: gh secret set ANTHROPIC_API_KEY --repo " + ghRepoFull
      );
    }
  }
} else {
  printCheck("auth_secret", { ok: false, reason: "cannot check without remote" });
}

// 8. Claude GitHub App installed. A user token cannot deterministically
//    verify this: GET /repos/{owner}/{repo}/installation needs App-JWT auth
//    and GET /user/installations needs an app-authorized token; both 403 for
//    a gh user token (verified 2026-05-29). So we do a best-effort positive
//    probe and otherwise report an honest `unknown` rather than the old
//    false-negative `missing`, which scared operators on healthy repos and
//    contradicted the orchestrator's already-honest stance. See
//    src/setup/claude-app.ts for the full constraint.
if (ghRepoFull) {
  const probe = tryRun(`gh api repos/${ghRepoFull}/installation 2>&1`);
  console.log(
    formatClaudeAppLine(
      classifyClaudeApp({
        hasRemote: true,
        installationApiOk: probe.ok,
        installationApiBody: probe.ok ? probe.value : probe.reason,
      })
    )
  );
} else {
  console.log(
    formatClaudeAppLine(
      classifyClaudeApp({ hasRemote: false, installationApiOk: false, installationApiBody: "" })
    )
  );
}

// 9. workflow file exists locally
const workflowExists = existsSync(".github/workflows/ribosome.yml");
printCheck("workflow_file", workflowExists ? { ok: true, value: ".github/workflows/ribosome.yml" } : { ok: false, reason: "missing" }, "the workflow should exist in this repo");

const checksExists = existsSync(".github/workflows/checks.yml");
printCheck("checks_workflow", checksExists ? { ok: true, value: ".github/workflows/checks.yml" } : { ok: false, reason: "missing" }, "named status checks for branch protection");

// 10. branch protection
if (ghRepoFull) {
  // Capture the full API response so we can distinguish "not configured" from
  // "blocked by GitHub plan" (Free tier on private repos returns 403 with
  // 'Upgrade to GitHub Pro or make this repository public to enable this feature.').
  // Earned 2026-05-28: applying protection on a fresh private repo failed
  // until the repo was made public; the setup skill needs to surface this.
  const protectionRaw = tryRun(`gh api repos/${ghRepoFull}/branches/main/protection 2>&1`);
  const value = protectionRaw.ok ? protectionRaw.value : protectionRaw.reason;
  if (protectionRaw.ok && /"required_status_checks"|"required_pull_request_reviews"/.test(value)) {
    printCheck("branch_protection", { ok: true, value: "configured" });
  } else if (/Upgrade to GitHub Pro/i.test(value)) {
    printCheck(
      "branch_protection",
      { ok: false, reason: "blocked by GitHub Free on private repos" },
      "GitHub Free does not allow branch protection on private repos; either `gh repo edit " + ghRepoFull + " --visibility public --accept-visibility-change-consequences` or upgrade to GitHub Pro"
    );
  } else {
    printCheck(
      "branch_protection",
      { ok: false, reason: "not configured" },
      "apply via the setup skill or gh api PUT /repos/.../branches/main/protection"
    );
  }
} else {
  printCheck("branch_protection", { ok: false, reason: "cannot check without remote" });
}

// 11. summary
console.log("---");
console.log("repo_full=" + JSON.stringify(ghRepoFull || ""));
