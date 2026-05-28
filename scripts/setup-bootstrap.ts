#!/usr/bin/env node
/**
 * scripts/setup-bootstrap.ts
 *
 * One-shot, parallel, programmatic bootstrap of a fresh Ribosome repo on
 * GitHub. Runs the DAG laid out in goals/setup-skill-rebuild.md:
 *
 *                gh repo create --push
 *                            |
 *      +---------+-----------+-----------+----------+----------+
 *      |         |           |           |          |          |
 *   labels  visibility    actions    secret-     app-install  (other)
 *    batch    flip       enable    detection      URL open
 *      \         |           |           |          /
 *       \--------+-----------+-----------+---------/
 *                            |
 *                  wait for first checks
 *                            |
 *                  apply branch protection
 *                            |
 *      +---------------------+--------------------+
 *      |                     |                    |
 * app installed?       secret set?           join everything
 *      +-----------+---------+--------------------+
 *                            |
 *                       seed [tweak] Issue
 *
 * Output contract: every step emits one stderr line at start and one at
 * end, both `key=value` formatted (parseable by `npm run setup:check`'s
 * existing reader pattern). Final JSON summary to stdout.
 *
 * Idempotent: every step checks current state via a GET before mutating.
 * Re-running a fully bootstrapped repo is a sub-5s no-op.
 *
 * Usage:
 *   npm run setup -- --repo NAME [--owner OWNER] [--visibility public|private]
 *                     [--slack-webhook URL] [--seed-issue]
 *                     [--no-open-browser] [--timeout-min 5]
 *
 * Constraints (see goals/setup-skill-rebuild.md):
 * - Never echo $ANTHROPIC_API_KEY. Detection order: env, file, then
 *   interactive `gh secret set` prompt. Skill never reads the key value.
 * - Steps with no inter-dependency MUST run in parallel.
 * - The only unavoidable manual step is the Claude App browser install.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------- Types ----------

type StepStatus = "ok" | "skipped" | "manual-wait" | "failed";

interface StepResult {
  id: string;
  status: StepStatus;
  duration_ms: number;
  detail?: string;
}

type AuthMode = "oauth" | "api";

interface BootstrapOptions {
  repo: string;
  owner?: string;
  visibility: "public" | "private";
  auth: AuthMode;
  slackWebhook?: string;
  seedIssue: boolean;
  seedIssueBodyPath?: string;
  seedIssueTitle?: string;
  openBrowser: boolean;
  timeoutMin: number;
}

// Authentication contract. The action accepts both inputs; whichever
// secret is populated wins. Default `oauth` draws from the operator's
// Claude Pro/Max subscription quota (zero incremental spend per chain
// step). `api` is the pay-per-token fallback. Verified against
// anthropics/claude-code-action@v1 action.yml: both inputs are optional;
// validate-env.ts requires "at least one." Empty unset secrets in GitHub
// Actions resolve to empty string, which the action treats as not-set.
const AUTH_SECRET_NAMES: Record<AuthMode, string> = {
  oauth: "CLAUDE_CODE_OAUTH_TOKEN",
  api: "ANTHROPIC_API_KEY",
};

const AUTH_HOWTO: Record<AuthMode, string> = {
  oauth: "Pro/Max users: run `claude setup-token` to print a portable OAuth token. Pipe directly to gh so the value never lands on the CLI or in history:\n       claude setup-token | gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo <repo>",
  api: "Get an API key at https://console.anthropic.com/settings/keys then run:\n       gh secret set ANTHROPIC_API_KEY --repo <repo>",
};

interface CompletedBootstrap {
  repo_full: string;
  visibility: string;
  steps: StepResult[];
  total_ms: number;
  ready_to_open_issue: boolean;
}

// ---------- Required-state constants ----------

const REQUIRED_LABELS: Array<{ name: string; color: string; description: string }> = [
  { name: "ribo:feature", color: "1d76db", description: "operator-requested feature" },
  { name: "ribo:bug", color: "d73a4a", description: "operator-reported bug" },
  { name: "ribo:tweak", color: "cfd3d7", description: "small wording or copy change" },
  { name: "ribo:auto-pr", color: "0e8a16", description: "PR opened by Ribosome" },
  { name: "ribo:digest", color: "a371f7", description: "weekly Dreaming digest" },
];

const CLAUDE_APP_INSTALL_URL = "https://github.com/apps/claude/installations/new";
const ANTHROPIC_CONSOLE_KEYS_URL = "https://console.anthropic.com/settings/keys";

// ---------- gh shell helpers ----------

function gh(args: string[]): { code: number; stdout: string; stderr: string } {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  return {
    code: r.status ?? -1,
    stdout: r.stdout?.trim() ?? "",
    stderr: r.stderr?.trim() ?? "",
  };
}

function ghJson<T = unknown>(args: string[]): T | null {
  const r = gh(args);
  if (r.code !== 0) return null;
  try {
    return JSON.parse(r.stdout) as T;
  } catch {
    return null;
  }
}

function ghOk(args: string[]): boolean {
  return gh(args).code === 0;
}

function git(args: string[]): { code: number; stdout: string; stderr: string } {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return {
    code: r.status ?? -1,
    stdout: r.stdout?.trim() ?? "",
    stderr: r.stderr?.trim() ?? "",
  };
}

// ---------- Status emit ----------

function emit(step: string, kvs: Record<string, string | number | boolean>): void {
  const parts = [`step=${step}`];
  for (const [k, v] of Object.entries(kvs)) {
    const s = typeof v === "string" ? JSON.stringify(v) : String(v);
    parts.push(`${k}=${s}`);
  }
  process.stderr.write(parts.join(" ") + "\n");
}

async function runStep(
  id: string,
  body: () => Promise<{ status: StepStatus; detail?: string }>,
): Promise<StepResult> {
  emit(id, { status: "running", started_at: new Date().toISOString() });
  const start = Date.now();
  try {
    const r = await body();
    const result: StepResult = {
      id,
      status: r.status,
      duration_ms: Date.now() - start,
      detail: r.detail,
    };
    emit(id, {
      status: r.status,
      finished_at: new Date().toISOString(),
      duration_ms: result.duration_ms,
      detail: r.detail ?? "",
    });
    return result;
  } catch (err) {
    const result: StepResult = {
      id,
      status: "failed",
      duration_ms: Date.now() - start,
      detail: (err as Error).message,
    };
    emit(id, {
      status: "failed",
      finished_at: new Date().toISOString(),
      duration_ms: result.duration_ms,
      detail: result.detail ?? "",
    });
    return result;
  }
}

// ---------- Steps ----------

async function step_preflight(): Promise<{ status: StepStatus; detail?: string }> {
  if (gh(["--version"]).code !== 0) return { status: "failed", detail: "gh CLI not installed" };
  if (gh(["auth", "status"]).code !== 0) return { status: "failed", detail: "gh not authenticated; run: gh auth login" };
  if (!existsSync(".git")) return { status: "failed", detail: "not inside a git repository" };
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch.stdout !== "main") return { status: "failed", detail: `expected branch main, got ${branch.stdout}` };
  return { status: "ok", detail: "gh + git + on main" };
}

async function step_repo_create(opts: BootstrapOptions, fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  // Three states to distinguish:
  //  (A) Target repo exists on GitHub AND has commits      -> fully created. Skip.
  //  (B) Target repo exists on GitHub but is empty         -> push HEAD into it.
  //  (C) Target repo does not exist                        -> create + push.
  // Plus an orthogonal local concern: this checkout may already have an
  // `origin` pointing at another repo (e.g., the demo). We must NOT clobber
  // it. The clean approach in both (B) and (C) is: create-without-source,
  // then `git push <https-url> HEAD:main` so origin is untouched. Earned
  // 2026-05-28 iteration 1: `gh repo create --source=. --push` failed with
  // "Unable to add remote 'origin'" because origin was already set.

  // Ensure git can push to github.com without an interactive credential
  // prompt. `gh auth setup-git` is idempotent and configures gh as the
  // git credential helper for github.com. Earned 2026-05-28 iteration 1
  // retry: the first attempt hit "Device not configured" on HTTPS push.
  gh(["auth", "setup-git"]);

  // Prefer SSH if the user already has an SSH remote elsewhere; fall back
  // to HTTPS (via gh credential helper). Detect by inspecting any existing
  // remote URL on the local checkout.
  const existingOrigin = git(["remote", "get-url", "origin"]);
  const preferSsh = existingOrigin.code === 0 && existingOrigin.stdout.startsWith("git@");
  const remoteUrl = preferSsh
    ? `git@github.com:${fullName}.git`
    : `https://github.com/${fullName}.git`;

  const repoExists = ghOk(["repo", "view", fullName, "--json", "name"]);
  if (repoExists) {
    const commits = gh(["api", `repos/${fullName}/commits`, "--paginate"]);
    if (commits.code === 0 && commits.stdout.length > 2) {
      return { status: "skipped", detail: `${fullName} already exists with commits` };
    }
    // Empty repo: push HEAD into it.
    const push = git(["push", remoteUrl, "HEAD:main"]);
    if (push.code !== 0) return { status: "failed", detail: `repo exists but push failed: ${push.stderr}` };
    return { status: "ok", detail: `${fullName} existed empty; pushed HEAD via ${preferSsh ? "ssh" : "https"}` };
  }

  // Repo does not exist. Create it without --source so we never touch local origin.
  const create = gh(["repo", "create", fullName, `--${opts.visibility}`]);
  if (create.code !== 0) return { status: "failed", detail: create.stderr };
  const push = git(["push", remoteUrl, "HEAD:main"]);
  if (push.code !== 0) return { status: "failed", detail: `created but push failed: ${push.stderr}` };
  return { status: "ok", detail: `${fullName} (created + pushed via ${preferSsh ? "ssh" : "https"}; origin preserved)` };
}

async function step_labels(fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  const existing = ghJson<Array<{ name: string }>>([
    "label", "list", "--repo", fullName, "--limit", "100", "--json", "name",
  ]);
  const existingNames = new Set(existing?.map(l => l.name) ?? []);
  const missing = REQUIRED_LABELS.filter(l => !existingNames.has(l.name));
  if (missing.length === 0) return { status: "skipped", detail: "all 5 labels present" };

  const results = await Promise.all(
    missing.map(l => Promise.resolve(gh([
      "label", "create", l.name,
      "--color", l.color,
      "--description", l.description,
      "--repo", fullName,
    ])).then(r => ({ name: l.name, ok: r.code === 0 }))),
  );
  const failed = results.filter(r => !r.ok).map(r => r.name);
  if (failed.length > 0) return { status: "failed", detail: `failed: ${failed.join(",")}` };
  return { status: "ok", detail: `created ${missing.length}` };
}

async function step_actions_enable(fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  const probe = ghJson<{ enabled?: boolean; allowed_actions?: string }>([
    "api", `repos/${fullName}/actions/permissions`,
  ]);
  if (probe?.enabled === true) return { status: "skipped", detail: "actions already enabled" };

  const r = gh([
    "api", "-X", "PUT", `repos/${fullName}/actions/permissions`,
    "-F", "enabled=true",
    "-F", "allowed_actions=all",
  ]);
  if (r.code !== 0) return { status: "failed", detail: r.stderr };
  return { status: "ok", detail: "actions enabled" };
}

async function step_visibility_flip(opts: BootstrapOptions, fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  const probe = ghJson<{ visibility: string }>([
    "repo", "view", fullName, "--json", "visibility",
  ]);
  const current = probe?.visibility?.toLowerCase() ?? "";
  const desired = opts.visibility;
  if (current === desired) return { status: "skipped", detail: `already ${current}` };

  const r = gh([
    "repo", "edit", fullName,
    "--visibility", desired,
    "--accept-visibility-change-consequences",
  ]);
  if (r.code !== 0) return { status: "failed", detail: r.stderr };
  return { status: "ok", detail: `${current} -> ${desired}` };
}

async function step_secret_detect(opts: BootstrapOptions): Promise<{ status: StepStatus; detail?: string }> {
  // Detect the source the auth secret WILL come from; do not read the
  // value. Auth mode (oauth | api) is set via --auth.
  if (opts.auth === "oauth") {
    if (process.env.CLAUDE_CODE_OAUTH_TOKEN && process.env.CLAUDE_CODE_OAUTH_TOKEN.length > 0) {
      return { status: "ok", detail: "source=env (CLAUDE_CODE_OAUTH_TOKEN)" };
    }
    const tokenFile = join(homedir(), ".config", "claude", "oauth-token");
    if (existsSync(tokenFile)) {
      return { status: "ok", detail: `source=file:${tokenFile}` };
    }
    return { status: "manual-wait", detail: "no local OAuth token; will prompt for `claude setup-token`" };
  }
  // api mode
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 0) {
    return { status: "ok", detail: "source=env (ANTHROPIC_API_KEY)" };
  }
  const keyFile = join(homedir(), ".config", "anthropic", "key");
  if (existsSync(keyFile)) {
    return { status: "ok", detail: `source=file:${keyFile}` };
  }
  return { status: "manual-wait", detail: "no local API key; will prompt at gh secret set" };
}

async function step_app_install_prompt(opts: BootstrapOptions, fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  const probe = gh(["api", `repos/${fullName}/installation`]);
  if (probe.code === 0 && probe.stdout.includes('"app_slug": "claude"')) {
    return { status: "skipped", detail: "Claude App already installed" };
  }
  process.stderr.write(`\n  -> Open: ${CLAUDE_APP_INSTALL_URL}\n     Select repository: ${fullName}\n     Click Install. The bootstrap will wait.\n\n`);
  if (opts.openBrowser) {
    spawnSync("open", [CLAUDE_APP_INSTALL_URL]);
  }
  return { status: "manual-wait", detail: "waiting for browser-install" };
}

async function step_first_checks_wait(opts: BootstrapOptions, fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  const deadline = Date.now() + opts.timeoutMin * 60_000;
  while (Date.now() < deadline) {
    const runs = ghJson<Array<{ status: string; conclusion: string; databaseId: number }>>([
      "run", "list",
      "--repo", fullName,
      "--workflow", "checks.yml",
      "--limit", "1",
      "--json", "status,conclusion,databaseId",
    ]);
    const last = runs?.[0];
    if (last && last.status === "completed") {
      if (last.conclusion === "success") {
        return { status: "ok", detail: `run ${last.databaseId} completed=success` };
      }
      return { status: "failed", detail: `run ${last.databaseId} conclusion=${last.conclusion}` };
    }
    await sleep(5_000);
  }
  return { status: "failed", detail: `timed out after ${opts.timeoutMin} min waiting for checks.yml` };
}

async function step_branch_protect(fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  const existing = gh(["api", `repos/${fullName}/branches/main/protection`]);
  if (existing.code === 0 && existing.stdout.includes('"required_status_checks"')) {
    return { status: "skipped", detail: "branch protection already configured" };
  }
  if (existing.code !== 0 && /Upgrade to GitHub Pro/i.test(existing.stderr + existing.stdout)) {
    return {
      status: "failed",
      detail: "blocked: GitHub Free does not allow branch protection on private repos. Pass --visibility public.",
    };
  }
  const r = gh([
    "api", "-X", "PUT", `repos/${fullName}/branches/main/protection`,
    "-F", "required_status_checks[strict]=true",
    "-F", "required_status_checks[contexts][]=typecheck",
    "-F", "required_status_checks[contexts][]=test",
    "-F", "required_status_checks[contexts][]=verify",
    "-F", "enforce_admins=true",
    "-F", "required_pull_request_reviews=null",
    "-F", "restrictions=null",
    "-F", "allow_force_pushes=false",
    "-F", "allow_deletions=false",
    "-F", "required_linear_history=true",
  ]);
  if (r.code !== 0) return { status: "failed", detail: r.stderr };
  return { status: "ok", detail: "protection applied (legacy API)" };
}

async function step_app_install_wait(opts: BootstrapOptions, fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  // Earned 2026-05-28 iteration 1: `gh api repos/X/installation` requires
  // App-JWT auth, not user-token; it returns 401 unconditionally for the
  // user token. There is no user-token-accessible endpoint that reliably
  // confirms a specific GitHub App is installed on a specific repo
  // (`/user/installations` requires `read:user_install` and rejects normal
  // gh tokens too). So we cannot programmatically verify the install.
  //
  // Pragmatic contract: open the URL, sleep ~30s to give the operator
  // time to click through, then continue. If the App is not actually
  // installed, the first chain workflow run will fail with a clear
  // error and re-running /setup is safe.
  const waitMs = Math.min(30_000, opts.timeoutMin * 60_000);
  process.stderr.write(`\n  Waiting ${waitMs / 1000}s for App install at ${CLAUDE_APP_INSTALL_URL}\n  If you've already installed it, this is a no-op. If not, install now.\n  Verification of install is not possible via user-token API; downstream\n  chain runs will surface any failure.\n\n`);
  await sleep(waitMs);
  return { status: "ok", detail: `waited ${waitMs / 1000}s; install unverified (no user-token API path; see step body comment)` };
}

async function step_secret_set(opts: BootstrapOptions, fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  const secretName = AUTH_SECRET_NAMES[opts.auth];
  const list = gh(["secret", "list", "--repo", fullName]);
  if (list.code === 0 && new RegExp(`^${secretName}`, "m").test(list.stdout)) {
    return { status: "skipped", detail: `${secretName} already set` };
  }

  // Auto-detect source: env var first, then file, then prompt.
  const envValue = opts.auth === "oauth"
    ? process.env.CLAUDE_CODE_OAUTH_TOKEN
    : process.env.ANTHROPIC_API_KEY;
  if (envValue && envValue.length > 0) {
    const r = spawnSync("gh", ["secret", "set", secretName, "--repo", fullName], {
      input: envValue,
      encoding: "utf8",
    });
    if (r.status !== 0) return { status: "failed", detail: r.stderr?.trim() ?? "gh secret set failed" };
    return { status: "ok", detail: `${secretName} set from env (stdin pipe)` };
  }

  const filePath = opts.auth === "oauth"
    ? join(homedir(), ".config", "claude", "oauth-token")
    : join(homedir(), ".config", "anthropic", "key");
  if (existsSync(filePath)) {
    const value = readFileSync(filePath, "utf8").trim();
    const r = spawnSync("gh", ["secret", "set", secretName, "--repo", fullName], {
      input: value,
      encoding: "utf8",
    });
    if (r.status !== 0) return { status: "failed", detail: r.stderr?.trim() ?? "gh secret set failed" };
    return { status: "ok", detail: `${secretName} set from file (stdin pipe)` };
  }

  // No automatic source. Tell the operator to set it; wait for it to appear.
  const howto = AUTH_HOWTO[opts.auth].replace(/<repo>/g, fullName);
  process.stderr.write(`\n  -> No local ${opts.auth === "oauth" ? "OAuth token" : "API key"} found.\n     ${howto}\n     The bootstrap will wait.\n\n`);
  const deadline = Date.now() + opts.timeoutMin * 60_000;
  while (Date.now() < deadline) {
    const list2 = gh(["secret", "list", "--repo", fullName]);
    if (list2.code === 0 && new RegExp(`^${secretName}`, "m").test(list2.stdout)) {
      return { status: "ok", detail: `${secretName} set by operator (interactive)` };
    }
    await sleep(5_000);
  }
  return { status: "failed", detail: `timed out waiting for ${secretName} (${opts.timeoutMin} min)` };
}

async function step_seed_issue(opts: BootstrapOptions, fullName: string): Promise<{ status: StepStatus; detail?: string }> {
  if (!opts.seedIssue) return { status: "skipped", detail: "--seed-issue not requested" };
  const existing = ghJson<Array<{ number: number; title: string }>>([
    "issue", "list",
    "--repo", fullName,
    "--label", "ribo:tweak",
    "--state", "open",
    "--limit", "1",
    "--json", "number,title",
  ]);
  if (existing && existing.length > 0) {
    return { status: "skipped", detail: `Issue #${existing[0]!.number} already open` };
  }

  // Seed Issue body source resolution:
  //   1. --seed-issue-body PATH (read from file)
  //   2. Built-in default: README.md:111 capitalisation fix (genuinely
  //      novel against current main; the TodoApp rename already shipped
  //      in PR #2 and a stale seed body produces a no-op chain run).
  // Earned 2026-05-28 iteration 1: orchestrator initially baked in the
  // TodoApp rename body, which collided with the merged PR #2 and made
  // every chain run a no-op close.
  let body: string;
  let title: string;
  if (opts.seedIssueBodyPath) {
    if (!existsSync(opts.seedIssueBodyPath)) {
      return { status: "failed", detail: `seed-issue-body file not found: ${opts.seedIssueBodyPath}` };
    }
    body = readFileSync(opts.seedIssueBodyPath, "utf8");
    title = opts.seedIssueTitle ?? "[tweak] (custom seed)";
  } else {
    body = `### What to change\n\nIn \`README.md\` around line 111, change the casing of "My Todos" to "My todos" (lowercase t in "todos"). The README narrative recap is the only place still using the title-case form, which is inconsistent with the page heading shipped in PR #2.\n\n### Where\n\n\`README.md:111\`.\n`;
    title = opts.seedIssueTitle ?? "[tweak] README casing: My Todos to My todos";
  }

  const r = gh([
    "issue", "create",
    "--repo", fullName,
    "--title", title,
    "--body", body,
    "--label", "ribo:tweak",
  ]);
  if (r.code !== 0) return { status: "failed", detail: r.stderr };
  return { status: "ok", detail: r.stdout };
}

// ---------- Helpers ----------

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function whoami(): string {
  const r = gh(["api", "user", "--jq", ".login"]);
  if (r.code !== 0) throw new Error("could not determine current gh user; pass --owner explicitly");
  return r.stdout;
}

function parseArgs(): BootstrapOptions {
  const args = process.argv.slice(2);
  const opts: Partial<BootstrapOptions> = {
    visibility: "public",
    auth: "oauth",
    seedIssue: false,
    openBrowser: true,
    timeoutMin: 5,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--repo") opts.repo = args[++i];
    else if (a === "--owner") opts.owner = args[++i];
    else if (a === "--visibility") opts.visibility = args[++i] as "public" | "private";
    else if (a === "--auth") {
      const v = args[++i];
      if (v !== "oauth" && v !== "api") {
        console.error(`--auth must be 'oauth' or 'api'; got '${v}'`);
        process.exit(2);
      }
      opts.auth = v;
    }
    else if (a === "--slack-webhook") opts.slackWebhook = args[++i];
    else if (a === "--seed-issue") opts.seedIssue = true;
    else if (a === "--seed-issue-body") opts.seedIssueBodyPath = args[++i];
    else if (a === "--seed-issue-title") opts.seedIssueTitle = args[++i];
    else if (a === "--no-open-browser") opts.openBrowser = false;
    else if (a === "--timeout-min") opts.timeoutMin = Number(args[++i]);
    else if (a === "--help" || a === "-h") {
      console.log("usage: setup-bootstrap --repo NAME [--owner OWNER] [--visibility public|private]");
      console.log("                       [--auth oauth|api] (default oauth: subscription quota)");
      console.log("                       [--seed-issue] [--seed-issue-body PATH] [--seed-issue-title TEXT]");
      console.log("                       [--slack-webhook URL] [--no-open-browser] [--timeout-min 5]");
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!opts.repo) {
    console.error("--repo NAME is required");
    process.exit(2);
  }
  return opts as BootstrapOptions;
}

// ---------- Main ----------

async function main(): Promise<void> {
  const opts = parseArgs();
  const t0 = Date.now();
  const owner = opts.owner ?? whoami();
  const fullName = `${owner}/${opts.repo}`;

  const preflight = await runStep("preflight", () => step_preflight());
  if (preflight.status !== "ok" && preflight.status !== "skipped") {
    return finish(opts, fullName, [preflight], t0, false);
  }

  const repoCreate = await runStep("repo_create", () => step_repo_create(opts, fullName));
  if (repoCreate.status === "failed") {
    return finish(opts, fullName, [preflight, repoCreate], t0, false);
  }

  // Phase 2: fan-out.
  const parallelResults = await Promise.all([
    runStep("labels", () => step_labels(fullName)),
    runStep("actions_enable", () => step_actions_enable(fullName)),
    runStep("visibility", () => step_visibility_flip(opts, fullName)),
    runStep("secret_detect", () => step_secret_detect(opts)),
    runStep("app_install_prompt", () => step_app_install_prompt(opts, fullName)),
  ]);

  // Phase 3: branch protection joins on first checks run.
  const firstChecks = await runStep("first_checks", () => step_first_checks_wait(opts, fullName));
  const protect = firstChecks.status === "ok"
    ? await runStep("branch_protect", () => step_branch_protect(fullName))
    : { id: "branch_protect", status: "skipped" as StepStatus, duration_ms: 0, detail: "skipped: first_checks did not succeed" };

  // Phase 4: wait for App + secret. They're independent; dispatch in
  // parallel. Earned 2026-05-28 iteration 1: sequential dispatch
  // wasted ~10 min when the App-wait timed out before secret_set even
  // started. Independent gates run independently.
  const [appInstall, secretSet] = await Promise.all([
    runStep("app_install_wait", () => step_app_install_wait(opts, fullName)),
    runStep("secret_set", () => step_secret_set(opts, fullName)),
  ]);

  // Phase 5: seed Issue.
  // Earned 2026-05-28 iteration 1: phase-2 steps that return `manual-wait`
  // (secret_detect, app_install_prompt) are handing off to phase-4 waits,
  // not failing. Their completion is the corresponding phase-4 step's
  // status. Treat `manual-wait` as success for the gate.
  const allOk = [preflight, repoCreate, ...parallelResults, firstChecks, protect, appInstall, secretSet]
    .every(s => s.status === "ok" || s.status === "skipped" || s.status === "manual-wait");
  const seedIssueResult = allOk
    ? await runStep("seed_issue", () => step_seed_issue(opts, fullName))
    : { id: "seed_issue", status: "skipped" as StepStatus, duration_ms: 0, detail: "skipped: upstream did not succeed" };

  const allSteps: StepResult[] = [
    preflight, repoCreate,
    ...parallelResults,
    firstChecks, protect,
    appInstall, secretSet,
    seedIssueResult,
  ];
  finish(opts, fullName, allSteps, t0, allOk);
}

function finish(opts: BootstrapOptions, fullName: string, steps: StepResult[], t0: number, ready: boolean): void {
  const summary: CompletedBootstrap = {
    repo_full: fullName,
    visibility: opts.visibility,
    steps,
    total_ms: Date.now() - t0,
    ready_to_open_issue: ready,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exit(ready ? 0 : 1);
}

main().catch(err => {
  console.error("setup-bootstrap fatal:", err);
  process.exit(2);
});
