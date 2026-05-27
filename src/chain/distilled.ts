/**
 * Distilled store helper.
 *
 * Phase 4.5 deliverable. Pure TypeScript, used by scripts and the
 * acceptance test. Subagents and the `dream` skill operate against
 * the same file paths directly via Read/Write tools; this module
 * centralises the layout and shape conversions.
 *
 * The distilled store is the durable, cross-chain compression of what
 * Ribosome has learned. The live store (Phase 2.5) holds per-chain
 * state; distilled holds patterns that span chains. Per plan §10,
 * only the Dreaming pass writes to distilled. Agents read it.
 *
 * Storage: `.claude/memory/distilled/<timestamp>/`
 *   - store.json     (canonical: DistilledStore, version "1")
 *   - <item-id>.md   (one per item, human-friendly, gitignored)
 *   - MEMORY.md      (per-store index for the human reading it)
 *
 * The repo-root `MEMORY.md` is the OPERATOR-FACING digest, committed.
 * It is regenerated from the latest distilled store on every dream pass.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

export type DistilledCategory =
  | "pattern"
  | "anti-pattern"
  | "operator-preference"
  | "domain-invariant"
  | "eval-trap";

export interface DistilledItem {
  id: string;
  category: DistilledCategory;
  title: string;
  body: string;
  evidence: string[];
  confidence: number;
  reference_count: number;
  first_seen: string;
  last_referenced?: string;
}

export interface DistilledStore {
  version: "1";
  generated_at: string;
  schema: "ribosome.distilled.store";
  source_chains: string[];
  items: DistilledItem[];
}

function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, ".claude"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("chain/distilled: no .claude/ directory found in any parent");
    }
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const DISTILLED_ROOT = join(REPO_ROOT, ".claude", "memory", "distilled");
const ARCHIVE_ROOT = join(REPO_ROOT, ".claude", "memory", "distilled.archive");
const ROOT_MEMORY_MD = join(REPO_ROOT, "MEMORY.md");

export function distilledRoots() {
  return { DISTILLED_ROOT, ARCHIVE_ROOT, ROOT_MEMORY_MD };
}

/**
 * List timestamps of every distilled store currently in place.
 * Sorted, newest last. Excludes hidden files like .gitkeep.
 */
export function listDistilledTimestamps(): string[] {
  if (!existsSync(DISTILLED_ROOT)) return [];
  return readdirSync(DISTILLED_ROOT)
    .filter((entry) => {
      if (entry.startsWith(".")) return false;
      return statSync(join(DISTILLED_ROOT, entry)).isDirectory();
    })
    .sort();
}

/** Return the path to the latest distilled store, or undefined. */
export function latestDistilledPath(): string | undefined {
  const stamps = listDistilledTimestamps();
  if (stamps.length === 0) return undefined;
  return join(DISTILLED_ROOT, stamps[stamps.length - 1]!);
}

/** Load the latest distilled store. Returns undefined if none exists. */
export function readLatestDistilled(): DistilledStore | undefined {
  const path = latestDistilledPath();
  if (path === undefined) return undefined;
  const storeJson = join(path, "store.json");
  if (!existsSync(storeJson)) return undefined;
  return readDistilledFromDir(path);
}

/** Load a specific distilled store by its directory path. */
export function readDistilledFromDir(dir: string): DistilledStore {
  const storeJson = join(dir, "store.json");
  if (!existsSync(storeJson)) {
    throw new Error(`chain/distilled: no store.json at ${storeJson}`);
  }
  const raw = readFileSync(storeJson, "utf8");
  const store = JSON.parse(raw) as DistilledStore;
  if (store.version !== "1") {
    throw new Error(`chain/distilled: unsupported version "${store.version}" (expected "1")`);
  }
  return store;
}

/**
 * Write a new distilled store at `.claude/memory/distilled/<timestamp>/`.
 * Also writes one markdown file per item and a per-store MEMORY.md
 * index. Returns the absolute path to the new directory.
 *
 * If a previous distilled store exists at the latest path, it is
 * archived to `.claude/memory/distilled.archive/<old-timestamp>/` so
 * a bad dream pass can be rolled back by symlink swap.
 */
export function writeDistilled(store: Omit<DistilledStore, "version" | "schema">): string {
  const full: DistilledStore = {
    version: "1",
    schema: "ribosome.distilled.store",
    ...store,
  };

  // Archive the previous latest, if any.
  const prior = latestDistilledPath();
  if (prior !== undefined) {
    const priorStamp = prior.split("/").pop()!;
    archive(priorStamp);
  }

  // Generate timestamp directory.
  const timestamp = full.generated_at
    .replace(/[:.]/g, "-")
    .replace("T", "T")
    .replace("Z", "Z");
  const newDir = join(DISTILLED_ROOT, timestamp);
  mkdirSync(newDir, { recursive: true });

  // Canonical JSON
  writeFileSync(join(newDir, "store.json"), JSON.stringify(full, null, 2) + "\n");

  // Per-item markdown
  for (const item of full.items) {
    const md = itemToMarkdown(item);
    writeFileSync(join(newDir, `${item.id}.md`), md);
  }

  // Per-store MEMORY.md
  writeFileSync(join(newDir, "MEMORY.md"), storeToMemoryIndex(full));

  // Update repo-root MEMORY.md (operator-facing committed digest).
  writeFileSync(ROOT_MEMORY_MD, storeToRootMemory(full));

  return newDir;
}

/**
 * Remove an item by id from the latest distilled store. Used by the
 * /forget reply handler (Phase 3 wires the GitHub comment to this).
 * Writes a NEW distilled timestamp so the rollback path is preserved.
 * Throws if no current store exists or the id is not present.
 */
export function forgetItem(id: string, reason: string): string {
  const current = readLatestDistilled();
  if (current === undefined) {
    throw new Error("chain/distilled: nothing to forget; no distilled store exists");
  }
  if (!current.items.some((i) => i.id === id)) {
    throw new Error(`chain/distilled: item id "${id}" not found in latest store`);
  }
  const next: Omit<DistilledStore, "version" | "schema"> = {
    generated_at: new Date().toISOString(),
    source_chains: current.source_chains,
    items: current.items.filter((i) => i.id !== id),
  };
  const newDir = writeDistilled(next);
  // Drop a tombstone note so the forget is auditable.
  writeFileSync(join(newDir, `_forget-${id}.md`), forgetTombstone(id, reason));
  return newDir;
}

/** Increment reference_count + update last_referenced on an item. */
export function citeItem(id: string): void {
  const current = readLatestDistilled();
  if (current === undefined) return;
  const idx = current.items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  current.items[idx] = {
    ...current.items[idx]!,
    reference_count: (current.items[idx]!.reference_count ?? 0) + 1,
    last_referenced: new Date().toISOString(),
  };
  // Write back to the existing latest path (in place).
  const path = latestDistilledPath()!;
  writeFileSync(join(path, "store.json"), JSON.stringify(current, null, 2) + "\n");
}

function archive(timestamp: string): void {
  mkdirSync(ARCHIVE_ROOT, { recursive: true });
  // We "archive" by copy + leave-in-place. Symlink would be cleaner
  // on POSIX but breaks on Windows; a plain copy is portable.
  const from = join(DISTILLED_ROOT, timestamp);
  const to = join(ARCHIVE_ROOT, timestamp);
  if (existsSync(to)) return;
  copyDirSync(from, to);
}

function copyDirSync(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const fromPath = join(from, entry);
    const toPath = join(to, entry);
    const st = statSync(fromPath);
    if (st.isDirectory()) {
      copyDirSync(fromPath, toPath);
    } else {
      writeFileSync(toPath, readFileSync(fromPath));
    }
  }
}

function itemToMarkdown(item: DistilledItem): string {
  const ref = item.last_referenced ?? "never";
  return [
    `# ${item.title}`,
    "",
    `- **id**: \`${item.id}\``,
    `- **category**: ${item.category}`,
    `- **confidence**: ${item.confidence.toFixed(2)}`,
    `- **first seen**: ${item.first_seen}`,
    `- **reference count**: ${item.reference_count}`,
    `- **last referenced**: ${ref}`,
    `- **evidence**:`,
    ...item.evidence.map((e) => `  - ${e}`),
    "",
    item.body,
    "",
  ].join("\n");
}

function storeToMemoryIndex(store: DistilledStore): string {
  const byCategory = new Map<DistilledCategory, DistilledItem[]>();
  for (const item of store.items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }
  const lines: string[] = [
    `# Distilled store ${store.generated_at}`,
    "",
    `Schema: \`${store.schema}\` v${store.version}.`,
    `Compressed from chains: ${store.source_chains.join(", ")}.`,
    `${store.items.length} items.`,
    "",
  ];
  const order: DistilledCategory[] = [
    "pattern",
    "anti-pattern",
    "operator-preference",
    "domain-invariant",
    "eval-trap",
  ];
  for (const cat of order) {
    const items = byCategory.get(cat) ?? [];
    if (items.length === 0) continue;
    lines.push(`## ${cat} (${items.length})`);
    lines.push("");
    for (const item of items.sort((a, b) => b.reference_count - a.reference_count)) {
      lines.push(`- [${item.title}](./${item.id}.md) (\`${item.id}\`, refs=${item.reference_count}, conf=${item.confidence.toFixed(2)})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function storeToRootMemory(store: DistilledStore): string {
  const lines: string[] = [
    `# MEMORY.md`,
    "",
    `This file is the human-readable digest of what Ribosome has`,
    `learned about this codebase. It is regenerated automatically`,
    `by the \`dream\` skill from \`.claude/memory/distilled/<timestamp>/\`.`,
    `Do not hand-edit; use \`npm run dream:forget <id>\` to drop`,
    `an item, or accept a rule-miner PR against \`CLAUDE.md\` to`,
    `promote one. The actual distilled store is gitignored; this`,
    `digest is committed so the operator can read it without`,
    `running anything.`,
    "",
    `Not to be confused with Claude Code's own \`MEMORY.md\` at`,
    `\`~/.claude/projects/<project>/memory/MEMORY.md\` which is a`,
    `different system.`,
    "",
    `Generated: ${store.generated_at}`,
    `Source chains: ${store.source_chains.join(", ")}`,
    `Item count: ${store.items.length}`,
    "",
  ];
  const order: DistilledCategory[] = [
    "pattern",
    "anti-pattern",
    "operator-preference",
    "domain-invariant",
    "eval-trap",
  ];
  for (const cat of order) {
    const items = store.items
      .filter((i) => i.category === cat)
      .sort((a, b) => b.reference_count - a.reference_count);
    if (items.length === 0) continue;
    lines.push(`## ${cat}`);
    lines.push("");
    for (const item of items) {
      lines.push(`### ${item.title}`);
      lines.push("");
      lines.push(`*id: \`${item.id}\`, refs: ${item.reference_count}, confidence: ${item.confidence.toFixed(2)}*`);
      lines.push("");
      lines.push(item.body);
      lines.push("");
      if (item.evidence.length > 0) {
        lines.push(`Evidence: ${item.evidence.join(", ")}`);
        lines.push("");
      }
    }
  }
  return lines.join("\n");
}

function forgetTombstone(id: string, reason: string): string {
  return [
    `# Forget tombstone: ${id}`,
    "",
    `Forgotten at: ${new Date().toISOString()}`,
    `Reason: ${reason}`,
    "",
    `Item removed from the live distilled store. The previous store is`,
    `archived at \`.claude/memory/distilled.archive/\` for rollback.`,
  ].join("\n");
}

/** Test-only purge. Same safety token as the chain state helper. */
export function _purgeForTests(confirm: "I-KNOW-WHAT-I-AM-DOING"): void {
  if (confirm !== "I-KNOW-WHAT-I-AM-DOING") {
    throw new Error("chain/distilled: purge requires confirmation token");
  }
  for (const root of [DISTILLED_ROOT, ARCHIVE_ROOT]) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (entry.startsWith(".")) continue;
      const p = join(root, entry);
      if (!statSync(p).isDirectory()) continue;
      removeDir(p);
    }
  }
}

function removeDir(dir: string): void {
  const stack: string[] = [dir];
  const dirs: string[] = [];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (!existsSync(cur)) continue;
    const st = statSync(cur);
    if (st.isDirectory()) {
      dirs.push(cur);
      for (const child of readdirSync(cur)) stack.push(join(cur, child));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:fs").unlinkSync(cur);
    }
  }
  dirs.sort((a, b) => b.length - a.length);
  for (const d of dirs) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("node:fs").rmdirSync(d);
  }
}
