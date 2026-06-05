/**
 * Unit tests for the pure browser-evidence helpers. The browser orchestration
 * (Playwright) lives in scripts/capture-evidence.ts and is verified by running
 * it; everything testable without a browser is proven here.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_VIEWPORT,
  DISABLE_ANIMATIONS_CSS,
  evidencePaths,
  makeManifest,
  makeScene,
  mergeEvidenceIntoReport,
  normalizeSnapshot,
  parseSceneSet,
} from "./evidence";
import type { VerifyReport } from "./types";

describe("evidencePaths", () => {
  it("puts both files under evidence/<id>/ (a non-gitignored path)", () => {
    expect(evidencePaths("0008", "empty")).toEqual({
      screenshot: "evidence/0008/empty.png",
      snapshot: "evidence/0008/empty.txt",
    });
  });

  it("sanitises ids and scene names to safe, stable segments", () => {
    expect(evidencePaths("0008", "Empty First Load")).toEqual({
      screenshot: "evidence/0008/empty-first-load.png",
      snapshot: "evidence/0008/empty-first-load.txt",
    });
  });

  it("throws on an empty segment rather than writing to evidence//", () => {
    expect(() => evidencePaths("0008", "   ")).toThrow();
    expect(() => evidencePaths("", "empty")).toThrow();
  });
});

describe("normalizeSnapshot", () => {
  it("strips trailing whitespace, trims blank ends, and ends with one newline", () => {
    expect(normalizeSnapshot("  My todos  \n\n\n")).toBe("My todos\n");
  });

  it("is idempotent (re-capturing identical content is byte-identical)", () => {
    const once = normalizeSnapshot("My todos\nall active done overdue\n");
    expect(normalizeSnapshot(once)).toBe(once);
  });

  it("normalises CRLF and never returns an empty string", () => {
    expect(normalizeSnapshot("a\r\nb")).toBe("a\nb\n");
    expect(normalizeSnapshot("   ")).toBe("\n");
  });
});

describe("makeScene / makeManifest", () => {
  it("builds a scene with resolved paths and the default viewport", () => {
    const scene = makeScene({
      chainId: "0008",
      scene: "empty",
      criterion: "criterion 1: the empty first-load screen is captured",
      capturedAt: "2026-06-04T00:00:00.000Z",
    });
    expect(scene).toEqual({
      scene: "empty",
      criterion: "criterion 1: the empty first-load screen is captured",
      screenshot: "evidence/0008/empty.png",
      snapshot: "evidence/0008/empty.txt",
      capturedAt: "2026-06-04T00:00:00.000Z",
      viewport: { ...DEFAULT_VIEWPORT },
    });
  });

  it("requires a criterion (evidence must say what it demonstrates)", () => {
    expect(() =>
      makeScene({ chainId: "0008", scene: "empty", criterion: "  ", capturedAt: "x" })
    ).toThrow();
  });

  it("assembles a v1 manifest", () => {
    const scene = makeScene({ chainId: "0008", scene: "empty", criterion: "c1", capturedAt: "t" });
    expect(makeManifest("0008", [scene])).toEqual({ version: "1", chainId: "0008", scenes: [scene] });
  });
});

describe("mergeEvidenceIntoReport", () => {
  const baseReport: VerifyReport = {
    version: "1",
    generated_at: "2026-06-04T00:00:00.000Z",
    schema: "ribosome.verify.report",
    totals: { units: 2, fixtures: 3, pass: 3, fail: 0, blocked: 0, skip: 0, probes: 1 },
    results: [],
  };

  it("attaches evidence and keeps version 1 (additive, non-breaking)", () => {
    const scene = makeScene({ chainId: "0008", scene: "empty", criterion: "c1", capturedAt: "t" });
    const manifest = makeManifest("0008", [scene]);
    const merged = mergeEvidenceIntoReport(baseReport, manifest);
    expect(merged.version).toBe("1");
    expect(merged.schema).toBe("ribosome.verify.report");
    expect(merged.evidence).toEqual(manifest);
  });

  it("does not mutate the input report or touch its existing fields", () => {
    const manifest = makeManifest("0008", []);
    const merged = mergeEvidenceIntoReport(baseReport, manifest);
    expect(baseReport.evidence).toBeUndefined();
    expect(merged.totals).toEqual(baseReport.totals);
    expect(merged.results).toBe(baseReport.results);
  });
});

describe("DISABLE_ANIMATIONS_CSS", () => {
  it("zeroes animations and transitions for deterministic capture", () => {
    expect(DISABLE_ANIMATIONS_CSS).toContain("animation-duration: 0s");
    expect(DISABLE_ANIMATIONS_CSS).toContain("transition-duration: 0s");
  });
});

describe("parseSceneSet (slice 2)", () => {
  it("parses a set with a first-load scene and an interacted scene", () => {
    const set = parseSceneSet([
      { scene: "empty", criterion: "the empty first-load screen" },
      {
        scene: "populated",
        criterion: "a few todos on the list",
        steps: [
          { action: "fill", selector: "#todo-text", value: "Buy milk" },
          { action: "click", selector: "[data-verify-action='submit-todo']" },
        ],
      },
    ]);
    expect(set).toHaveLength(2);
    expect(set[1]!.steps).toEqual([
      { action: "fill", selector: "#todo-text", value: "Buy milk" },
      { action: "click", selector: "[data-verify-action='submit-todo']" },
    ]);
  });

  it("accepts a JSON string", () => {
    expect(parseSceneSet('[{"scene":"empty","criterion":"c"}]')).toEqual([
      { scene: "empty", criterion: "c" },
    ]);
  });

  it("rejects a non-array, a scene with no name or criterion, and duplicate scenes", () => {
    expect(() => parseSceneSet({})).toThrow();
    expect(() => parseSceneSet([{ scene: "", criterion: "c" }])).toThrow();
    expect(() => parseSceneSet([{ scene: "x", criterion: "" }])).toThrow();
    expect(() =>
      parseSceneSet([
        { scene: "x", criterion: "c" },
        { scene: "X", criterion: "c" },
      ])
    ).toThrow(/duplicate/);
  });

  it("rejects a malformed step rather than capturing a wrong screen", () => {
    expect(() => parseSceneSet([{ scene: "x", criterion: "c", steps: [{ action: "fill", selector: "#a" }] }])).toThrow();
    expect(() => parseSceneSet([{ scene: "x", criterion: "c", steps: [{ action: "nope", selector: "#a" }] }])).toThrow();
    expect(() => parseSceneSet([{ scene: "x", criterion: "c", steps: [{ action: "click" }] }])).toThrow();
  });
});
