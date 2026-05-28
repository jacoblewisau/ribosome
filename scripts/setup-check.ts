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

// 7. ANTHROPIC_API_KEY secret set
if (ghRepoFull) {
  const secretList = tryRun(`gh secret list --repo ${ghRepoFull} 2>&1 | grep -E '^ANTHROPIC_API_KEY' || echo MISSING`);
  if (secretList.ok && secretList.value !== "MISSING") {
    printCheck("anthropic_api_key", secretList, undefined);
  } else {
    printCheck("anthropic_api_key", { ok: false, reason: "secret not set" }, "run: gh secret set ANTHROPIC_API_KEY --repo " + ghRepoFull);
  }
} else {
  printCheck("anthropic_api_key", { ok: false, reason: "cannot check without remote" });
}

// 8. Claude GitHub App installed (we can detect via the app's pulls API; absence is harder to confirm without listing user installations)
if (ghRepoFull) {
  // The most reliable detection is to look for any prior PR opened by claude[bot] OR to check the installations API.
  // Listing app installations requires admin scope. Simpler: check for a previous comment by claude[bot] across issues.
  const claudeUserCheck = tryRun(`gh api repos/${ghRepoFull}/installation 2>&1 | head -5 | grep -E '"app_slug": "claude"' || echo MISSING`);
  if (claudeUserCheck.ok && claudeUserCheck.value !== "MISSING") {
    printCheck("claude_app", { ok: true, value: "installed" });
  } else {
    printCheck("claude_app", { ok: false, reason: "not detected (or installation API unavailable)" }, "install at https://github.com/apps/claude");
  }
} else {
  printCheck("claude_app", { ok: false, reason: "cannot check without remote" });
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
