/**
 * Phase 4.5 acceptance test, partial.
 *
 * Plan §12 Phase 4.5 acceptance: "after three completed feature runs,
 * a Dreaming pass produces at least one distilled item that the next
 * run's researcher cites in its findings; a `/forget` reply on the
 * digest removes the item before the following Dreaming pass."
 *
 * This file tests the substrate (the distilled.ts helper) and the
 * mechanical /forget pathway. The "researcher cites distilled" half
 * is verified by the researcher.md agent prompt update and by a
 * subsequent feature run; not testable in isolation here because the
 * researcher is a Claude Code subagent invoked from a real session.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Sandbox the production paths to a tmp dir BEFORE the module import
// captures them. distilled.ts reads RIBOSOME_DISTILLED_ROOT and friends
// lazily on every call, so setting these here is sufficient to isolate
// the test from production state. Tests would otherwise wipe the real
// .claude/memory/distilled and the repo-root MEMORY.md, which happened
// once during Phase 3 verification.
const SANDBOX_ROOT = mkdtempSync(join(tmpdir(), "ribosome-distilled-test-"));
process.env.RIBOSOME_DISTILLED_ROOT = join(SANDBOX_ROOT, "distilled");
process.env.RIBOSOME_DISTILLED_ARCHIVE_ROOT = join(SANDBOX_ROOT, "archive");
process.env.RIBOSOME_MEMORY_MD = join(SANDBOX_ROOT, "MEMORY.md");

const {
  _purgeForTests,
  citeItem,
  distilledRoots,
  forgetItem,
  latestDistilledPath,
  listDistilledTimestamps,
  readDistilledFromDir,
  readLatestDistilled,
  writeDistilled,
} = await import("./distilled");
type DistilledItem = Awaited<ReturnType<typeof readLatestDistilled>> extends { items: infer I } | undefined
  ? I extends Array<infer T>
    ? T
    : never
  : never;

beforeEach(() => _purgeForTests("I-KNOW-WHAT-I-AM-DOING"));
afterEach(() => _purgeForTests("I-KNOW-WHAT-I-AM-DOING"));

beforeAll(() => {
  // Sanity: confirm the sandbox is in place and not the real repo.
  const { DISTILLED_ROOT, ROOT_MEMORY_MD } = distilledRoots();
  if (!DISTILLED_ROOT.includes("ribosome-distilled-test-")) {
    throw new Error(`refusing to run: DISTILLED_ROOT not sandboxed: ${DISTILLED_ROOT}`);
  }
  if (!ROOT_MEMORY_MD.includes("ribosome-distilled-test-")) {
    throw new Error(`refusing to run: ROOT_MEMORY_MD not sandboxed: ${ROOT_MEMORY_MD}`);
  }
});

function sampleItem(id: string, overrides: Partial<DistilledItem> = {}): DistilledItem {
  return {
    id,
    category: "pattern",
    title: `Sample pattern ${id}`,
    body: `Description of ${id}.`,
    evidence: [`chain:test-${id}`],
    confidence: 0.7,
    reference_count: 0,
    first_seen: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("Phase 4.5 distilled store helper", () => {
  it("starts empty (after purge)", () => {
    expect(listDistilledTimestamps()).toEqual([]);
    expect(latestDistilledPath()).toBeUndefined();
    expect(readLatestDistilled()).toBeUndefined();
  });

  it("writes a distilled store and produces store.json, per-item .md, and MEMORY.md", () => {
    const newDir = writeDistilled({
      generated_at: "2026-05-27T12:00:00.000Z",
      source_chains: ["0001", "0002", "0003"],
      items: [sampleItem("pat-001"), sampleItem("ap-001", { category: "anti-pattern" })],
    });
    expect(existsSync(join(newDir, "store.json"))).toBe(true);
    expect(existsSync(join(newDir, "pat-001.md"))).toBe(true);
    expect(existsSync(join(newDir, "ap-001.md"))).toBe(true);
    expect(existsSync(join(newDir, "MEMORY.md"))).toBe(true);
    const store = readDistilledFromDir(newDir);
    expect(store.version).toBe("1");
    expect(store.schema).toBe("ribosome.distilled.store");
    expect(store.items).toHaveLength(2);
  });

  it("regenerates the repo-root MEMORY.md as the operator-facing digest", () => {
    writeDistilled({
      generated_at: "2026-05-27T12:00:00.000Z",
      source_chains: ["0001"],
      items: [
        sampleItem("pat-001", {
          title: "Always run typecheck before commit",
          body: "Every committed change must pass tsc -b --noEmit.",
          reference_count: 5,
        }),
      ],
    });
    const { ROOT_MEMORY_MD } = distilledRoots();
    const rootMd = readFileSync(ROOT_MEMORY_MD, "utf8");
    expect(rootMd).toContain("# MEMORY.md");
    expect(rootMd).toContain("Always run typecheck before commit");
    expect(rootMd).toContain("Source chains: 0001");
  });

  it("archives the previous distilled store when a new one is written", () => {
    writeDistilled({
      generated_at: "2026-05-27T10:00:00.000Z",
      source_chains: ["0001"],
      items: [sampleItem("pat-old")],
    });
    expect(listDistilledTimestamps()).toHaveLength(1);

    writeDistilled({
      generated_at: "2026-05-27T11:00:00.000Z",
      source_chains: ["0001", "0002"],
      items: [sampleItem("pat-new")],
    });
    expect(listDistilledTimestamps()).toHaveLength(2);

    const latest = readLatestDistilled()!;
    expect(latest.items[0]?.id).toBe("pat-new");
  });

  it("citeItem increments reference_count and updates last_referenced", () => {
    writeDistilled({
      generated_at: "2026-05-27T12:00:00.000Z",
      source_chains: ["0001"],
      items: [sampleItem("pat-001", { reference_count: 0 })],
    });
    expect(readLatestDistilled()!.items[0]!.reference_count).toBe(0);
    citeItem("pat-001");
    const after = readLatestDistilled()!;
    expect(after.items[0]!.reference_count).toBe(1);
    expect(after.items[0]!.last_referenced).toBeDefined();
  });

  it("forgetItem removes the item and writes a new store + tombstone", () => {
    writeDistilled({
      generated_at: "2026-05-27T12:00:00.000Z",
      source_chains: ["0001"],
      items: [
        sampleItem("pat-001"),
        sampleItem("pat-002"),
        sampleItem("pat-003"),
      ],
    });
    expect(readLatestDistilled()!.items).toHaveLength(3);

    const newDir = forgetItem("pat-002", "operator-rejected on digest");
    const after = readLatestDistilled()!;
    expect(after.items).toHaveLength(2);
    expect(after.items.map((i) => i.id)).toEqual(["pat-001", "pat-003"]);
    expect(existsSync(join(newDir, "_forget-pat-002.md"))).toBe(true);
  });

  it("forgetItem throws when there is no current store", () => {
    expect(() => forgetItem("anything", "test")).toThrow();
  });

  it("forgetItem throws when the id is not present", () => {
    writeDistilled({
      generated_at: "2026-05-27T12:00:00.000Z",
      source_chains: ["0001"],
      items: [sampleItem("pat-001")],
    });
    expect(() => forgetItem("nonexistent", "test")).toThrow();
  });

  // Phase 4.5 acceptance (substrate side):
  // > "after three completed feature runs, a Dreaming pass produces at least
  // > one distilled item that the next run's researcher cites in its findings;
  // > a /forget reply on the digest removes the item before the following
  // > Dreaming pass."
  it(
    "ACCEPTANCE substrate: dream pass produces items, researcher citation bumps refs, /forget drops the item",
    () => {
      // Pretend Dreaming consumed the three real chains and emitted one item.
      writeDistilled({
        generated_at: "2026-05-27T12:00:00.000Z",
        source_chains: ["0001", "0002", "0003"],
        items: [
          sampleItem("pat-scope-package-json", {
            title: "package.json is implicitly in scope when build commands change",
            body:
              "Feature 0001 (reset button) surfaced an Important validator finding " +
              "when builder added --passWithNoTests to npm test without listing package.json " +
              "in scope_paths. CLAUDE.md rule 11 captures this and feature 0002 ran clean as a result.",
            evidence: ["chain:0001", "CLAUDE.md:11"],
            confidence: 0.9,
          }),
        ],
      });

      // Researcher in a subsequent chain cites the item.
      citeItem("pat-scope-package-json");
      const cited = readLatestDistilled()!;
      expect(cited.items[0]!.reference_count).toBe(1);

      // Operator types /forget on the dreamer-digest issue (Phase 3 wires
      // this to the script; we exercise the helper directly).
      forgetItem("pat-scope-package-json", "test acceptance: simulating /forget");
      const afterForget = readLatestDistilled()!;
      expect(afterForget.items).toHaveLength(0);
    }
  );
});
