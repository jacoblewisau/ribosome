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

const AGENT_FILES = [
  ".claude/agents/researcher.md",
  ".claude/agents/builder.md",
  ".claude/agents/validator.md",
  ".claude/agents/test-author.md",
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
    name: "all five agent files declare name and description in frontmatter",
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
    name: "all seven scout workflows exist with schedule or trigger",
    rationale:
      "If a scout's workflow file is missing or has no trigger, the scout never fires on its intended cadence.",
    check: () => {
      const missing: string[] = [];
      for (const s of SCOUT_NAMES) {
        const path = `.github/workflows/scout-${s}.yml`;
        if (!existsSync(path)) {
          missing.push(`${path} missing`);
          continue;
        }
        const yml = readFile(path);
        // Either schedule:, push:, pull_request:, or workflow_dispatch: is acceptable
        if (!/^\s*(schedule|push|pull_request|workflow_dispatch):/m.test(yml)) {
          missing.push(`${path} has no recognised trigger`);
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
