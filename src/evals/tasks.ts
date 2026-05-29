/**
 * The 12 seeded eval tasks. Structural checks against the chain's
 * definitions. Each task ties to a known failure mode the chain
 * has hit (or would hit) and would be caught at PR time.
 *
 * Categories per plan §11:
 *   - routine (5): should always pass; catches deletion of foundational pieces
 *   - tricky (4): less obvious invariants that real bugs have lived in
 *   - trap (3): would catch a regression that has been considered (or rejected)
 *
 * The plan's behavioural set (12 task descriptions for actual chain runs at
 * $5-9 each) is referenced in the dream/setup skill bodies and remains
 * future opt-in work.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import type { CheckResult, TaskDefinition } from "./types.ts";

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

function isExecutable(path: string): boolean {
  if (!existsSync(path)) return false;
  const mode = statSync(path).mode;
  // owner-exec bit
  return (mode & 0o100) !== 0;
}

function frontmatterHas(path: string, keys: string[]): boolean {
  const content = readFile(path);
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  const frontmatter = m[1]!;
  return keys.every((k) => new RegExp(`^${k}:\\s*\\S`, "m").test(frontmatter));
}

function pass(): CheckResult {
  return "PASS";
}

function fail(reason: string): { result: CheckResult; reason: string } {
  return { result: "FAIL", reason };
}

// test-author was removed from the chain in session 4 (2026-05-29). The
// agent was a stub never implemented; builder writes the acceptance test
// as part of its `scope_paths` work, and the validator's Coverage matrix
// section verifies criteria coverage. Removing a redundant agent aligns
// with the scope_discipline block added to builder.md the same day.
const AGENT_FILES = [
  ".claude/agents/researcher.md",
  ".claude/agents/builder.md",
  ".claude/agents/validator.md",
  ".claude/agents/pr-shepherd.md",
];

const SKILL_FILES = [
  ".claude/skills/coordinator/SKILL.md",
  ".claude/skills/story-writer/SKILL.md",
  ".claude/skills/spec-writer/SKILL.md",
  ".claude/skills/verify-contracts/SKILL.md",
  ".claude/skills/rule-miner/SKILL.md",
  ".claude/skills/dream/SKILL.md",
];

const SIX_SLASH_COMMANDS = [
  "/approve",
  "/changes",
  "/cancel",
  "/explain",
  "/keep",
  "/forget",
];

const SCOUT_NAMES = [
  "ci-watcher",
  "dep-scanner",
  "coverage-scout",
  "doc-drift",
  "shepherd",
  "rule-miner",
  "dreamer-digest",
];

const MECHANICAL_SCOUTS = ["ci-watcher", "dep-scanner", "coverage-scout", "shepherd"];
const JUDGMENT_SCOUTS = ["doc-drift", "rule-miner", "dreamer-digest"];

export const TASKS: ReadonlyArray<TaskDefinition> = [
  // -------- Routine (5): should always pass --------
  {
    id: "R1",
    category: "routine",
    name: "block-secrets pre-commit hook exists and is executable",
    rationale:
      "Phase 0 foundation. If this hook is missing or non-executable, secret leakage is one accidental commit away.",
    check: () => {
      if (!isExecutable(".claude/hooks/block-secrets.sh")) {
        return fail(".claude/hooks/block-secrets.sh is missing or not executable");
      }
      if (!isExecutable(".claude/hooks/pre-commit")) {
        return fail(".claude/hooks/pre-commit shim is missing or not executable");
      }
      return pass();
    },
  },
  {
    id: "R2",
    category: "routine",
    name: "enforce-scope hook exists, is executable, and is registered",
    rationale:
      "Phase 6 mechanism for preventing builder scope creep. If the hook is unregistered, rules 11 and 13 lose their teeth.",
    check: () => {
      if (!isExecutable(".claude/hooks/enforce-scope.sh")) {
        return fail(".claude/hooks/enforce-scope.sh is missing or not executable");
      }
      const settings = readFile(".claude/settings.json");
      if (!settings.includes("enforce-scope.sh")) {
        return fail(".claude/settings.json does not reference enforce-scope.sh");
      }
      return pass();
    },
  },
  {
    id: "R3",
    category: "routine",
    name: "all chain agent files declare name and description in frontmatter",
    rationale:
      "Claude Code requires both. A missing field means the agent silently fails to register on session start.",
    check: () => {
      const missing = AGENT_FILES.filter(
        (p) => !frontmatterHas(p, ["name", "description"])
      );
      if (missing.length > 0) {
        return fail(`missing name or description: ${missing.join(", ")}`);
      }
      return pass();
    },
  },
  {
    id: "R4",
    category: "routine",
    name: "all six skill files declare a description in frontmatter",
    rationale:
      "Without a description, Claude has no signal for when to auto-load the skill.",
    check: () => {
      const missing = SKILL_FILES.filter(
        (p) => !frontmatterHas(p, ["description"])
      );
      if (missing.length > 0) {
        return fail(`missing description: ${missing.join(", ")}`);
      }
      return pass();
    },
  },
  {
    id: "R5",
    category: "routine",
    name: "CLAUDE.md is at least 100 lines",
    rationale:
      "Plan rule 5 bounds CLAUDE.md between 100 and 300 lines. A file shorter than 100 is almost certainly mid-edit or accidentally truncated.",
    check: () => {
      const lines = readFile("CLAUDE.md").split("\n").length;
      if (lines < 100) return fail(`CLAUDE.md is ${lines} lines (< 100)`);
      return pass();
    },
  },

  // -------- Tricky (4): less obvious invariants --------
  {
    id: "T1",
    category: "tricky",
    name: "ribosome.yml workflow if: clause covers all six slash commands",
    rationale:
      "If even one slash command is missing from the routing condition, the operator can post it and nothing happens; they get no feedback.",
    check: () => {
      const yml = readFile(".github/workflows/ribosome.yml");
      const missing = SIX_SLASH_COMMANDS.filter(
        (cmd) => !yml.includes(`'${cmd}'`) && !yml.includes(`"${cmd}"`)
      );
      if (missing.length > 0) {
        return fail(`missing slash command in workflow if: ${missing.join(", ")}`);
      }
      return pass();
    },
  },
  {
    id: "T2",
    category: "tricky",
    name: "enforce-scope hook handles MultiEdit (not only Write/Edit)",
    rationale:
      "MultiEdit was added to Claude Code after the original Write/Edit pair. A scope hook that misses MultiEdit lets a multi-file rewrite slip through.",
    check: () => {
      const hook = readFile(".claude/hooks/enforce-scope.sh");
      if (!/Write\|Edit\|MultiEdit/.test(hook)) {
        return fail("enforce-scope.sh case statement does not include MultiEdit");
      }
      const settings = readFile(".claude/settings.json");
      if (!settings.includes("MultiEdit")) {
        return fail(".claude/settings.json matcher does not include MultiEdit");
      }
      return pass();
    },
  },
  {
    id: "T3",
    category: "tricky",
    name: "validator agent cites the verify schema name and version",
    rationale:
      "The validator's verdicts depend on the verify report's schema. If the validator does not refuse on schema mismatch, a wrong-version report would be silently consumed.",
    check: () => {
      const v = readFile(".claude/agents/validator.md");
      if (!v.includes("ribosome.verify.report")) {
        return fail("validator prompt does not name the verify schema");
      }
      // Looser match: the literal string "1" appears in any quoted form
      // alongside the word "version" within ~50 characters.
      if (!/version[^a-zA-Z\n]{0,50}["`']1["`']/.test(v)) {
        return fail("validator prompt does not pin to version \"1\" near the word version");
      }
      return pass();
    },
  },
  {
    id: "T4",
    category: "tricky",
    name: "dream skill body documents the .dream-active marker",
    rationale:
      "The enforce-distilled-write hook blocks all writes to distilled unless the marker exists. If the dream skill body forgets to manage the marker, every dream pass fails at the first write.",
    check: () => {
      const d = readFile(".claude/skills/dream/SKILL.md");
      if (!d.includes(".dream-active")) {
        return fail("dream SKILL.md does not mention the .dream-active marker");
      }
      if (!/touch.*\.dream-active/.test(d) || !/rm.*\.dream-active/.test(d)) {
        return fail("dream SKILL.md does not show both touch and rm of the marker");
      }
      return pass();
    },
  },

  // -------- Trap (3): catch a regression that has been considered --------
  {
    id: "TR1",
    category: "trap",
    name: "no file in .claude/ uses --dangerously-skip-permissions",
    rationale:
      "Phase 3 deliberately chose --allowedTools over --dangerously-skip-permissions. The auto-mode classifier blocked the bypass once already; this trap catches a re-introduction.",
    check: () => {
      const grep = execSyncSafe(
        `grep -r --include='*.md' --include='*.yml' --include='*.json' --include='*.sh' 'dangerously-skip-permissions' .claude/`
      );
      if (grep.trim().length > 0) {
        return fail(`--dangerously-skip-permissions found:\n${grep.trim()}`);
      }
      return pass();
    },
  },
  {
    id: "TR2",
    category: "trap",
    name: "CLAUDE.md does not exceed 300 lines",
    rationale:
      "Rule 5 bounds CLAUDE.md. Drift above 300 causes context pollution; this trap forces a prune.",
    check: () => {
      const lines = readFile("CLAUDE.md").split("\n").length;
      if (lines > 300) return fail(`CLAUDE.md is ${lines} lines (> 300)`);
      return pass();
    },
  },
  {
    id: "TR3",
    category: "trap",
    name: "pr-shepherd does NOT have Write or Edit in its tools allowlist",
    rationale:
      "pr-shepherd opens draft PRs via gh; it has no business editing source. If Write/Edit appear in its frontmatter tools field, the read-only-by-default rule (rule 2) is violated.",
    check: () => {
      const m = readFile(".claude/agents/pr-shepherd.md").match(
        /^---\n([\s\S]*?)\n---/
      );
      if (!m) return fail("pr-shepherd.md has no frontmatter");
      const fm = m[1]!;
      const toolsMatch = fm.match(/^tools:\s*(.+)$/m);
      if (!toolsMatch) return fail("pr-shepherd.md frontmatter has no tools field");
      const tools = toolsMatch[1]!;
      if (/\bWrite\b/.test(tools) || /\bEdit\b/.test(tools)) {
        return fail(`pr-shepherd tools list includes Write/Edit: ${tools}`);
      }
      return pass();
    },
  },

  // -------- Phase 4 additions: seven scouts --------
  {
    id: "R6",
    category: "routine",
    name: "all seven scout skills exist with description frontmatter",
    rationale:
      "Each scout's behaviour is its skill body. A missing skill means the workflow's `/scout-name` invocation fails on the action's first turn.",
    check: () => {
      const missing: string[] = [];
      for (const s of SCOUT_NAMES) {
        const path = `.claude/skills/${s}/SKILL.md`;
        if (!existsSync(path)) {
          missing.push(`${path} missing`);
          continue;
        }
        if (!frontmatterHas(path, ["description"])) {
          missing.push(`${path} has no description`);
        }
      }
      if (missing.length > 0) return fail(missing.join("; "));
      return pass();
    },
  },
  {
    id: "R7",
    category: "routine",
    name: "all seven scout workflows exist with an action-supported trigger",
    rationale:
      "If a scout's workflow file is missing or has no trigger, the scout never fires on its intended cadence. `anthropics/claude-code-action@v1` in agent mode supports only workflow_dispatch, repository_dispatch, schedule, and workflow_run (push is rejected at runtime with 'Unsupported event type: push'; see scout-ci-watcher header comment).",
    check: () => {
      const missing: string[] = [];
      for (const s of SCOUT_NAMES) {
        const path = `.github/workflows/scout-${s}.yml`;
        if (!existsSync(path)) {
          missing.push(`${path} missing`);
          continue;
        }
        const yml = readFile(path);
        if (
          !/^\s*(schedule|workflow_dispatch|workflow_run|repository_dispatch):/m.test(
            yml
          )
        ) {
          missing.push(`${path} has no action-supported trigger`);
        }
      }
      if (missing.length > 0) return fail(missing.join("; "));
      return pass();
    },
  },
  {
    id: "T5",
    category: "tricky",
    name: "every scout workflow uses an --allowedTools allowlist (no implicit bypass)",
    rationale:
      "Phase 3 learned: without --allowedTools, the action's permission gates deny everything and Claude exhausts max-turns. Without an allowlist a scout is silently broken on first run.",
    check: () => {
      const missing: string[] = [];
      for (const s of SCOUT_NAMES) {
        const yml = readFile(`.github/workflows/scout-${s}.yml`);
        if (!/--allowedTools/.test(yml)) {
          missing.push(`scout-${s}.yml missing --allowedTools`);
        }
      }
      if (missing.length > 0) return fail(missing.join("; "));
      return pass();
    },
  },
  {
    id: "T6",
    category: "tricky",
    name: "scout cost discipline: mechanical scouts use Haiku, judgment scouts use Sonnet",
    rationale:
      "Haiku is roughly 5x cheaper than Sonnet. Using Sonnet for mechanical work (dep diffs, log grep) wastes budget; using Haiku for judgment (doc-drift) misses subtleties. Catches model-string drift in either direction.",
    check: () => {
      const wrong: string[] = [];
      for (const s of MECHANICAL_SCOUTS) {
        const yml = readFile(`.github/workflows/scout-${s}.yml`);
        if (!/--model\s+claude-haiku-4-5/.test(yml)) {
          wrong.push(`${s} should use claude-haiku-4-5`);
        }
      }
      for (const s of JUDGMENT_SCOUTS) {
        const yml = readFile(`.github/workflows/scout-${s}.yml`);
        if (!/--model\s+claude-sonnet-4-6/.test(yml)) {
          wrong.push(`${s} should use claude-sonnet-4-6`);
        }
      }
      if (wrong.length > 0) return fail(wrong.join("; "));
      return pass();
    },
  },
  {
    id: "T7",
    category: "tricky",
    name: "agent prompts do not direct use of tools not in their allowlist",
    rationale:
      "Earned 2026-05-28 from chain 0005 run 1: researcher.md and validator.md both said 'Write your findings ... using the Write tool' but their tools frontmatter excluded Write. The researcher fell back to inline output (per Claude Code's subagent system reminder), the coordinator misdiagnosed an enforce-scope block, and the chain stalled before story-writer. Invariant: if Write is not in the agent's tools allowlist, the prompt body must not contain the literal 'the Write tool' as an instruction.",
    check: () => {
      const offenders: string[] = [];
      for (const path of AGENT_FILES) {
        const content = readFile(path);
        const m = content.match(/^---\n([\s\S]*?)\n---/);
        if (!m) continue;
        const fm = m[1]!;
        const toolsMatch = fm.match(/^tools:\s*(.+)$/m);
        if (!toolsMatch) continue;
        const tools = toolsMatch[1]!;
        const hasWrite = /\bWrite\b/.test(tools);
        if (hasWrite) continue;
        const body = content.slice(m[0].length);
        if (/using the Write tool|via the Write tool/i.test(body)) {
          offenders.push(`${path} directs Write but tools allowlist excludes it`);
        }
      }
      if (offenders.length > 0) return fail(offenders.join("; "));
      return pass();
    },
  },
  {
    id: "R8",
    category: "routine",
    name: "setup-bootstrap.ts exists and is non-empty",
    rationale:
      "The orchestrator is the source of truth for the bootstrap DAG. If it disappears or is truncated, `/setup` no longer works.",
    check: () => {
      const path = "scripts/setup-bootstrap.ts";
      if (!existsSync(path)) return fail(`${path} is missing`);
      const content = readFile(path);
      if (content.length < 1000) return fail(`${path} is suspiciously short (${content.length} bytes)`);
      if (!content.includes("step_repo_create") || !content.includes("step_branch_protect")) {
        return fail(`${path} missing one of the canonical step functions`);
      }
      return pass();
    },
  },
  {
    id: "T8",
    category: "tricky",
    name: "setup-bootstrap.ts calls gh auth setup-git before pushing",
    rationale:
      "Earned 2026-05-28 iteration 1: HTTPS push to a fresh repo failed with 'Device not configured' because git had no credential helper for github.com. `gh auth setup-git` is idempotent and configures gh as the helper. If a future refactor drops this call, every fresh-clone bootstrap regresses for users without SSH keys.",
    check: () => {
      const content = readFile("scripts/setup-bootstrap.ts");
      if (!/gh\(\["auth",\s*"setup-git"\]\)|"auth",\s*"setup-git"/.test(content)) {
        return fail("scripts/setup-bootstrap.ts does not invoke `gh auth setup-git`");
      }
      return pass();
    },
  },
  {
    id: "TR7",
    category: "trap",
    name: "setup-bootstrap.ts must not use `gh repo create --source=.`",
    rationale:
      "Earned 2026-05-28 iteration 1: `gh repo create --source=. --push` fails with 'Unable to add remote origin' when the local checkout already has an origin pointing somewhere else (e.g., the iteration-N test repo when iterating from a working ribosome checkout). The orchestrator creates without --source and pushes directly so the local origin is preserved.",
    check: () => {
      const content = readFile("scripts/setup-bootstrap.ts");
      // Strip single-line and block comments before matching so historical
      // notes in comments don't trigger false positives.
      const code = content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter(l => !/^\s*\/\//.test(l) && !/^\s*\*/.test(l))
        .join("\n");
      if (/--source=\./.test(code)) {
        return fail("scripts/setup-bootstrap.ts uses --source=. in executable code; clashes with existing local origin");
      }
      return pass();
    },
  },
  {
    id: "TR8",
    category: "trap",
    name: "setup-bootstrap.ts must not use `gh secret set --body`",
    rationale:
      "`--body` puts the secret value on the command line, which means it ends up in the shell's history and in the process listing (ps). The orchestrator pipes via stdin (spawnSync input:) so the value never leaves the process. Catches a regression where someone replaces the pipe with `--body` for terseness. Match is scoped to gh-secret-set call sites only; `gh issue create --body` (for Issue body text) is allowed.",
    check: () => {
      const content = readFile("scripts/setup-bootstrap.ts");
      // Look for any literal occurrence of `gh secret set` in close proximity
      // to `--body`. Conservative pattern: same line or within ~200 chars.
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (/"secret"\s*,\s*"set"/.test(line) || /gh\s+secret\s+set/.test(line)) {
          // Look in this line and the next 5 lines for --body.
          const window = lines.slice(i, i + 6).join("\n");
          if (/"--body"|--body[\s"]/.test(window)) {
            return fail(`scripts/setup-bootstrap.ts uses --body for gh secret set near line ${i + 1}`);
          }
        }
      }
      return pass();
    },
  },
  {
    id: "T9",
    category: "tricky",
    name: "every claude-code-action invocation passes both auth inputs",
    rationale:
      "Earned 2026-05-28 session 2 follow-up: workflows originally passed only `anthropic_api_key`, forcing operators to pay per chain step even if they had a Pro/Max subscription. Dual-input wiring lets the operator pick either auth path at setup time and switch later by setting the other secret. If a workflow drops one input, that auth path becomes unreachable.",
    check: () => {
      const workflowFiles = [
        ".github/workflows/ribosome.yml",
        ...SCOUT_NAMES.map(s => `.github/workflows/scout-${s}.yml`),
      ];
      const missing: string[] = [];
      for (const path of workflowFiles) {
        if (!existsSync(path)) {
          missing.push(`${path} missing`);
          continue;
        }
        const yml = readFile(path);
        // Skip workflows that don't invoke the action at all (e.g., checks.yml).
        if (!/uses:\s*anthropics\/claude-code-action/.test(yml)) continue;
        if (!/claude_code_oauth_token:\s*\$\{\{\s*secrets\.CLAUDE_CODE_OAUTH_TOKEN/.test(yml)) {
          missing.push(`${path} lacks claude_code_oauth_token input`);
        }
        if (!/anthropic_api_key:\s*\$\{\{\s*secrets\.ANTHROPIC_API_KEY/.test(yml)) {
          missing.push(`${path} lacks anthropic_api_key input`);
        }
      }
      if (missing.length > 0) return fail(missing.join("; "));
      return pass();
    },
  },
  {
    id: "TR9",
    category: "trap",
    name: "setup-bootstrap.ts must default --auth to 'oauth', not 'api'",
    rationale:
      "Subscription quota is the recommended path; API spend is a fallback for users without Max. The default should always prefer subscription so operators don't pay by accident. Catches a regression where someone flips the default to api.",
    check: () => {
      const content = readFile("scripts/setup-bootstrap.ts");
      // Strip comments before matching so historical notes don't trigger.
      const code = content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter(l => !/^\s*\/\//.test(l) && !/^\s*\*/.test(l))
        .join("\n");
      // The default appears in parseArgs as `auth: "oauth"`. Match the
      // literal initializer.
      if (!/auth:\s*"oauth"/.test(code)) {
        return fail("scripts/setup-bootstrap.ts does not default auth to 'oauth'");
      }
      // Also confirm the type union exists and lists both modes.
      if (!/AuthMode\s*=\s*"oauth"\s*\|\s*"api"/.test(code)) {
        return fail("scripts/setup-bootstrap.ts AuthMode union does not list both 'oauth' and 'api'");
      }
      return pass();
    },
  },
  {
    id: "R10",
    category: "routine",
    name: "builder.md contains an explicit scope_discipline block",
    rationale:
      "Earned 2026-05-29 from session-3 agent-behaviour review: Opus 4.6+ has a documented tendency to overengineer (Anthropic prompting docs, 'Overeagerness' section). Builder runs on Opus 4.7 by default. The scope_discipline block instructs the builder to stay within spec.scope_paths and avoid speculative features, refactors, or abstractions. If a refactor drops this block, the operator may start seeing PRs that touch more than the Issue asked for.",
    check: () => {
      const content = readFile(".claude/agents/builder.md");
      if (!/<scope_discipline>/.test(content) || !/<\/scope_discipline>/.test(content)) {
        return fail("builder.md missing <scope_discipline>...</scope_discipline> block");
      }
      // Require at least three of the four canonical bullets so a token-level
      // gut of the block still trips the trap.
      const bullets = ["Scope:", "Documentation:", "Defensive coding:", "Abstractions:"];
      const present = bullets.filter(b => content.includes(b));
      if (present.length < 3) {
        return fail(`builder.md scope_discipline block missing bullets; found only: ${present.join(", ")}`);
      }
      return pass();
    },
  },
  {
    id: "R11",
    category: "routine",
    name: "validator.md uses coverage-first language with confidence levels",
    rationale:
      "Earned 2026-05-29 from session-3 agent-behaviour review: Opus 4.6+ may suppress real findings when prompted with 'be conservative' or 'do not invent issues' (Anthropic prompting docs, 'Code review harnesses' section). Validator's job at the finding stage is coverage; filtering happens downstream (the operator reviews the PR). If a refactor reverts to filter-first language, Critical bugs may silently never reach the operator.",
    check: () => {
      const content = readFile(".claude/agents/validator.md");
      // Required: the coverage-first framing and per-finding confidence annotation.
      if (!/coverage/i.test(content)) {
        return fail("validator.md does not mention 'coverage'");
      }
      if (!/confidence:\s*high\s*\|\s*medium\s*\|\s*low/i.test(content)) {
        return fail("validator.md does not document the confidence: high | medium | low annotation on findings");
      }
      // Forbidden: the suppressive 'do not invent issues' phrasing the doc
      // warns against.
      if (/do not invent issues/i.test(content)) {
        return fail("validator.md still contains 'do not invent issues' phrasing; replace with coverage-first language");
      }
      return pass();
    },
  },
  {
    id: "T10",
    category: "tricky",
    name: "researcher and validator prompts include a fenced JSON state contract",
    rationale:
      "Earned 2026-05-29 from session-3 review: previously the coordinator parsed agent prose via regex (e.g. matching 'Status: clean'). One wording drift broke the state machine silently. Each read-only subagent now ends its reply with a fenced ```json block the coordinator parses as the source of truth. The prompt body documents this contract so the model emits it consistently. If the contract section is removed, the coordinator's JSON.parse will throw and the chain will fail with a clear error.",
    check: () => {
      const offenders: string[] = [];
      for (const path of [".claude/agents/researcher.md", ".claude/agents/validator.md"]) {
        const content = readFile(path);
        if (!/State contract/i.test(content)) {
          offenders.push(`${path} missing "State contract" section heading`);
          continue;
        }
        // Look for a fenced ```json block in the body.
        if (!/```json[\s\S]*?```/.test(content)) {
          offenders.push(`${path} missing fenced \`\`\`json block`);
          continue;
        }
        if (!/"agent":/.test(content) || !/"chain_id":/.test(content)) {
          offenders.push(`${path} state-contract block missing "agent" or "chain_id" fields`);
        }
      }
      if (offenders.length > 0) return fail(offenders.join("; "));
      return pass();
    },
  },
  {
    id: "TR10",
    category: "trap",
    name: "ribosome.yml pins the chain to claude-opus-4-8 (the current latest Opus)",
    rationale:
      "The chain runs Opus by default. As of 2026-05-29, the latest Opus is 4.8 (per Anthropic prompting docs: 'The exact model string for Claude Opus 4.8 is claude-opus-4-8'). 4.8 has documented strengths in long-horizon agentic work, literal instruction following, and higher precision in code review. Catches a regression where someone reverts to 4.7 (which is now one version behind) or drops the --model flag entirely (which would default to whatever the action's pinned default is, breaking reproducibility). Update this invariant when a newer Opus ships and Ribosome migrates.",
    check: () => {
      const yml = readFile(".github/workflows/ribosome.yml");
      if (!/--model\s+claude-opus-4-8/.test(yml)) {
        return fail(".github/workflows/ribosome.yml does not pin --model claude-opus-4-8");
      }
      // Forbid the older version explicitly so a half-edit (changing the
      // string in only one place) trips the trap.
      if (/--model\s+claude-opus-4-7/.test(yml)) {
        return fail(".github/workflows/ribosome.yml still references claude-opus-4-7 somewhere");
      }
      return pass();
    },
  },
  {
    id: "TR4",
    category: "trap",
    name: "no scout workflow uses --dangerously-skip-permissions",
    rationale:
      "Bypass mode would defeat the per-scout allowlist discipline T5 enforces. Catches a re-introduction.",
    check: () => {
      const offenders: string[] = [];
      for (const s of SCOUT_NAMES) {
        const yml = readFile(`.github/workflows/scout-${s}.yml`);
        if (/dangerously-skip-permissions/.test(yml)) {
          offenders.push(`scout-${s}.yml`);
        }
      }
      if (offenders.length > 0) return fail(`bypass found in: ${offenders.join(", ")}`);
      return pass();
    },
  },
  {
    id: "TR6",
    category: "trap",
    name: "every scout workflow grants `id-token: write` permission",
    rationale:
      "Earned 2026-05-28 in production: after the workflow_run trigger fix landed, every scout failed at the action's first invocation with 'Could not fetch an OIDC token. Did you remember to add id-token: write to your workflow permissions?'. The action retries 3x then aborts. The docs imply id-token is only needed for OIDC federation, but the action's actual code path requires it even with anthropic_api_key set. ribosome.yml already has it (line 26); scouts must too.",
    check: () => {
      const missing: string[] = [];
      for (const s of SCOUT_NAMES) {
        const yml = readFile(`.github/workflows/scout-${s}.yml`);
        // Match `id-token: write` (with optional comment) inside the
        // permissions block. Conservative: look for the literal anywhere
        // in the file since each scout's permissions block is the only
        // place these keys appear.
        if (!/id-token:\s*write/.test(yml)) {
          missing.push(`scout-${s}.yml lacks id-token: write`);
        }
      }
      if (missing.length > 0) return fail(missing.join("; "));
      return pass();
    },
  },
  {
    id: "TR5",
    category: "trap",
    name: "no scout workflow uses `on: push:` (agent mode rejects push)",
    rationale:
      "Earned 2026-05-28 in production: scout-ci-watcher and scout-coverage-scout originally shipped with `on: push:` and the action failed every push with 'Unsupported event type: push'. The previous R7 invariant whitelisted push, so eval never caught it. Use workflow_run for 'after CI completes' semantics.",
    check: () => {
      const offenders: string[] = [];
      for (const s of SCOUT_NAMES) {
        const yml = readFile(`.github/workflows/scout-${s}.yml`);
        // Match `on: push:` either inline (`on: { push: ... }`) or as a key
        // under a multi-line `on:` block. Conservative: match `push:` at
        // the start of a line within the `on:` block.
        const onBlock = yml.match(/^on:\s*\n([\s\S]*?)(?=^\S|\Z)/m);
        if (onBlock && /^\s*push:/m.test(onBlock[1]!)) {
          offenders.push(`scout-${s}.yml has on: push:`);
        }
      }
      if (offenders.length > 0) return fail(offenders.join("; "));
      return pass();
    },
  },
  {
    id: "R12",
    category: "routine",
    name: "operator-translation and decision-records skills exist with name and description frontmatter",
    rationale:
      "Earned 2026-05-30 (session 5, slice 1 of the operator-as-non-coder goal). The coaching protocol and the decision-capture convention are skills the spec-writer (and later the planner) reference by name. If either file is missing or loses its frontmatter, Claude has no signal to load it, spec-writer's references dangle, and gate 2 reverts to a rubber-stamp for a non-coder operator.",
    check: () => {
      const files = [
        ".claude/skills/operator-translation/SKILL.md",
        ".claude/skills/decision-records/SKILL.md",
      ];
      const missing = files.filter(
        (p) => !existsSync(p) || !frontmatterHas(p, ["name", "description"])
      );
      if (missing.length > 0) {
        return fail(`missing or lacking name/description frontmatter: ${missing.join(", ")}`);
      }
      return pass();
    },
  },
  {
    id: "T11",
    category: "tricky",
    name: "spec-writer references the coaching skills and carries the three-bucket Decisions-captured protocol",
    rationale:
      "Earned 2026-05-30 (session 5, slice 1). The structural guarantee that gate 2 triages and translates rather than dropping a finished brief at a non-coder operator. spec-writer must reference operator-translation and decision-records and expose the three buckets (Needs you / inform-only / ADR proposed) under a Decisions captured section. Structural eval cannot confirm the model behaves, only that the protocol words are present; if a refactor strips them, gate 2 silently reverts to a rubber-stamp.",
    check: () => {
      const content = readFile(".claude/skills/spec-writer/SKILL.md");
      const needles = [
        "operator-translation",
        "decision-records",
        "Decisions captured",
        "Needs you",
        "inform-only",
        "ADR proposed",
      ];
      const missing = needles.filter((n) => !content.includes(n));
      if (missing.length > 0) {
        return fail(`spec-writer.md missing: ${missing.join(", ")}`);
      }
      return pass();
    },
  },
  {
    id: "TR11",
    category: "trap",
    name: "decision-records keeps the three-criteria ADR gate and the propose-through-gate guardrail",
    rationale:
      "Earned 2026-05-30 (session 5, slice 1). Two regressions would breach Ribosome's read-only-by-default guardrail. First, dropping the three-criteria ADR gate (hard to reverse / surprising / real trade-off) lets ADRs proliferate. Second, dropping the rule that system-wide records are proposed and written only on operator approval lets a producer silently write a repo-wide decision or glossary change. Both must stay in the decision-records skill, and spec-writer must keep its matching do-not line.",
    check: () => {
      const dr = readFile(".claude/skills/decision-records/SKILL.md");
      if (!/hard to reverse/i.test(dr) || !/surprising/i.test(dr) || !/trade-off/i.test(dr)) {
        return fail("decision-records.md missing one of the three ADR criteria (hard to reverse / surprising / trade-off)");
      }
      if (!/written only on/i.test(dr) || !/\/approve/.test(dr)) {
        return fail("decision-records.md missing the propose-through-gate rule (written only on /approve)");
      }
      const spec = readFile(".claude/skills/spec-writer/SKILL.md");
      if (!/do not silently write a system-wide ADR/i.test(spec)) {
        return fail("spec-writer.md dropped the 'do not silently write a system-wide ADR' guardrail line");
      }
      return pass();
    },
  },
  {
    id: "T12",
    category: "tricky",
    name: "operator-translation carries a brevity / volume discipline",
    rationale:
      "Earned 2026-05-30 (session 5, slice 1). The operator skims under volume and approves to get through; a wall of text is a rubber-stamp trigger just as surely as an unanswerable question. The coaching protocol must keep the brevity discipline (lead with one thing, ask the few highest-stakes decisions, short questions, readable in under a minute). If a refactor drops it, the protocol defeats the jargon failure but reintroduces the volume failure.",
    check: () => {
      const content = readFile(".claude/skills/operator-translation/SKILL.md");
      if (!/brevity/i.test(content)) {
        return fail("operator-translation.md no longer mentions brevity");
      }
      if (!/rubber-stamp/i.test(content)) {
        return fail("operator-translation.md brevity discipline must tie volume to the rubber-stamp failure");
      }
      if (!/under a minute|too much to read|wall of text|skims/i.test(content)) {
        return fail("operator-translation.md missing the volume-discipline framing");
      }
      return pass();
    },
  },
];

// Lazy execSync to avoid pulling node:child_process at module load
// in environments where it is unavailable (unlikely here, but cheap).
import { execSync } from "node:child_process";
function execSyncSafe(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    const err = e as { stdout?: Buffer | string };
    return err.stdout ? err.stdout.toString() : "";
  }
}
