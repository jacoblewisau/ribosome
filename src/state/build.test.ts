/**
 * Tests for the STATE.md fragment assembler. The point of the fragment
 * pattern is that each change writes its own file, so the assembler must be
 * deterministic and order-stable regardless of readdir order.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildState, GENERATED_BANNER, HEADER_FRAGMENT } from "./build.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "state-build-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function frag(name: string, body: string): void {
  writeFileSync(join(dir, name), body);
}

describe("buildState", () => {
  it("leads with the generated banner so the file is not hand-edited", () => {
    frag(HEADER_FRAGMENT, "# Session-handoff state\n\nHeader body.");
    const out = buildState(dir);
    expect(out.startsWith(GENERATED_BANNER)).toBe(true);
  });

  it("includes the curated header verbatim before the shipped log", () => {
    frag(HEADER_FRAGMENT, "# Session-handoff state\n\nCurrent truth here.");
    frag("2026-06-01-alpha.md", "### 2026-06-01 - Alpha\n\nDid alpha.");
    const out = buildState(dir);
    const headerIdx = out.indexOf("Current truth here.");
    const logIdx = out.indexOf("## Shipped log");
    expect(headerIdx).toBeGreaterThan(-1);
    expect(logIdx).toBeGreaterThan(headerIdx);
  });

  it("orders fragments newest-first by filename, independent of write order", () => {
    frag(HEADER_FRAGMENT, "# Head");
    frag("2026-05-30-older.md", "### older\n\nOld.");
    frag("2026-06-02-newer.md", "### newer\n\nNew.");
    const out = buildState(dir);
    expect(out.indexOf("New.")).toBeLessThan(out.indexOf("Old."));
  });

  it("excludes README.md and the header from the shipped log", () => {
    frag(HEADER_FRAGMENT, "# Head\n\nHEADER_MARKER");
    frag("README.md", "READExME_MARKER explaining the pattern");
    frag("2026-06-01-real.md", "### real\n\nREAL_MARKER");
    const out = buildState(dir);
    expect(out).toContain("REAL_MARKER");
    expect(out).not.toContain("READExME_MARKER");
    // header appears once (as the header), not duplicated in the log
    expect(out.split("HEADER_MARKER").length - 1).toBe(1);
  });

  it("is deterministic: same inputs produce identical output", () => {
    frag(HEADER_FRAGMENT, "# Head");
    frag("2026-06-01-a.md", "### a\n\nA");
    frag("2026-06-02-b.md", "### b\n\nB");
    expect(buildState(dir)).toBe(buildState(dir));
  });

  it("handles an empty log without throwing", () => {
    frag(HEADER_FRAGMENT, "# Head only");
    const out = buildState(dir);
    expect(out).toContain("No shipped-log fragments yet.");
  });
});
