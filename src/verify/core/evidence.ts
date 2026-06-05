/**
 * Pure helpers for browser-evidence capture (browser-evidence slice 1).
 *
 * No I/O. The capture script (scripts/capture-evidence.ts) owns Playwright and
 * the filesystem; this module owns the shapes, the deterministic committed
 * paths, the snapshot normalisation, and the report merge, so that logic is
 * unit-tested and never drifts. Mirrors the pure-module discipline of
 * src/chain/mission-control.ts.
 */

import type { EvidenceManifest, EvidenceScene, VerifyReport, VisualStatus } from "./types";

export const DEFAULT_VIEWPORT = { width: 1200, height: 800 } as const;

/**
 * CSS injected before capture so the screenshot is deterministic: no
 * animations, transitions, blinking caret, or smooth scroll. Combined with a
 * fixed viewport and an explicit wait for the unit selector (never a timed
 * pause), the same code produces the same screenshot run to run.
 */
export const DISABLE_ANIMATIONS_CSS = [
  "*, *::before, *::after {",
  "  animation-duration: 0s !important;",
  "  animation-delay: 0s !important;",
  "  transition-duration: 0s !important;",
  "  transition-delay: 0s !important;",
  "  caret-color: transparent !important;",
  "  scroll-behavior: auto !important;",
  "}",
].join("\n");

function sanitize(segment: string): string {
  const clean = String(segment)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!clean) throw new Error(`evidence: empty path segment from "${segment}"`);
  return clean;
}

/**
 * Repo-relative committed paths for a captured scene. Both live under
 * `evidence/<chainId>/`, which is NOT gitignored (unlike the verify report), so
 * they reach the pull request's changed files.
 */
export function evidencePaths(
  chainId: string,
  scene: string
): { screenshot: string; snapshot: string } {
  const id = sanitize(chainId);
  const s = sanitize(scene);
  return { screenshot: `evidence/${id}/${s}.png`, snapshot: `evidence/${id}/${s}.txt` };
}

/**
 * Collapse a captured visible-text blob into a stable snapshot: normalise line
 * endings, strip trailing whitespace, drop leading/trailing blank lines, and
 * end with a single newline. Idempotent, so re-capturing identical content
 * yields a byte-identical snapshot.
 */
export function normalizeSnapshot(text: string): string {
  const lines = String(text)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+/, ""));
  while (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  return lines.length === 0 ? "\n" : lines.join("\n") + "\n";
}

/** Build one scene's record, resolving its committed paths and default viewport. */
export function makeScene(input: {
  chainId: string;
  scene: string;
  criterion: string;
  capturedAt: string;
  viewport?: { width: number; height: number };
}): EvidenceScene {
  if (!input.criterion.trim()) {
    throw new Error("evidence: a scene needs a criterion it demonstrates");
  }
  const { screenshot, snapshot } = evidencePaths(input.chainId, input.scene);
  return {
    scene: sanitize(input.scene),
    criterion: input.criterion.trim(),
    screenshot,
    snapshot,
    capturedAt: input.capturedAt,
    viewport: input.viewport ?? { ...DEFAULT_VIEWPORT },
  };
}

/** Assemble the manifest for one chain run. */
export function makeManifest(chainId: string, scenes: EvidenceScene[]): EvidenceManifest {
  return { version: "1", chainId: sanitize(chainId), scenes };
}

/**
 * Attach evidence to a verify report without touching anything already in it.
 * The `version` literal `"1"` is preserved by the spread, so the validator's
 * version pin keeps passing: this is an additive, non-breaking extension.
 */
export function mergeEvidenceIntoReport(
  report: VerifyReport,
  manifest: EvidenceManifest
): VerifyReport {
  return { ...report, evidence: manifest };
}

/**
 * A deterministic interaction to reach a screen state before capture
 * (slice 2: every declared screen). Steps are minimal and replayable: fill an
 * input, click an element, or wait for a selector. No timed pauses.
 */
export type CaptureStep =
  | { action: "fill"; selector: string; value: string }
  | { action: "click"; selector: string }
  | { action: "waitFor"; selector: string };

/** One declared screen a feature wants captured. */
export interface SceneSpec {
  scene: string;
  criterion: string;
  /** Interactions to reach the screen from a fresh load. Omit for the
   *  first-load state. */
  steps?: CaptureStep[];
}

function validateSteps(steps: unknown, scene: string): CaptureStep[] {
  if (!Array.isArray(steps)) throw new Error(`scene "${scene}": steps must be an array`);
  return steps.map((raw, i) => {
    const s = raw as Record<string, unknown>;
    const action = s.action;
    const selector = typeof s.selector === "string" ? s.selector.trim() : "";
    if (!selector) throw new Error(`scene "${scene}" step ${i}: missing selector`);
    if (action === "fill") {
      if (typeof s.value !== "string") throw new Error(`scene "${scene}" step ${i}: fill needs a string value`);
      return { action: "fill", selector, value: s.value };
    }
    if (action === "click") return { action: "click", selector };
    if (action === "waitFor") return { action: "waitFor", selector };
    throw new Error(`scene "${scene}" step ${i}: unknown action "${String(action)}"`);
  });
}

/**
 * Parse and validate a declared scene set (the capture script's input). Pure:
 * the script runs the steps in a browser, this only checks the shape. Throws on
 * a malformed set rather than capturing a wrong or partial screen.
 */
export function parseSceneSet(raw: string | unknown): SceneSpec[] {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) throw new Error("scene set must be a JSON array");
  const seen = new Set<string>();
  return parsed.map((entry, i) => {
    if (!entry || typeof entry !== "object") throw new Error(`scene ${i} is not an object`);
    const e = entry as Record<string, unknown>;
    const scene = String(e.scene ?? "").trim();
    const criterion = String(e.criterion ?? "").trim();
    if (!scene) throw new Error(`scene ${i} has no name`);
    if (!criterion) throw new Error(`scene "${scene}" has no criterion`);
    if (seen.has(scene.toLowerCase())) throw new Error(`duplicate scene "${scene}"`);
    seen.add(scene.toLowerCase());
    return e.steps === undefined
      ? { scene, criterion }
      : { scene, criterion, steps: validateSteps(e.steps, scene) };
  });
}

/**
 * Default visual-regression tolerance: the fraction of pixels allowed to differ
 * from the baseline before a screen counts as "changed". A small non-zero value
 * absorbs sub-pixel antialiasing noise; the same code in the same environment
 * produces a 0 ratio, so a real visual change crosses this easily.
 */
export const DEFAULT_MISMATCH_THRESHOLD = 0.002;

/** Repo-relative path to a scene's committed baseline screenshot (the golden
 *  image), shared across runs and outside `.gitignore`. */
export function baselinePath(scene: string): string {
  return `evidence/baselines/${sanitize(scene)}.png`;
}

/** Repo-relative path to a scene's diff image, written only when it changed. */
export function diffPath(chainId: string, scene: string): string {
  return `evidence/${sanitize(chainId)}/${sanitize(scene)}.diff.png`;
}

/**
 * Classify a scene against its baseline from the measured pixel-mismatch ratio.
 * Pure: the caller does the PNG decode and the pixel diff; this only applies the
 * threshold. No baseline means the capture becomes the baseline (not a
 * regression).
 */
export function classifyVisual(input: {
  hasBaseline: boolean;
  mismatchRatio: number;
  threshold?: number;
}): { status: VisualStatus; mismatchRatio: number; threshold: number } {
  const threshold = input.threshold ?? DEFAULT_MISMATCH_THRESHOLD;
  if (!input.hasBaseline) return { status: "new-baseline", mismatchRatio: 0, threshold };
  const ratio = Number.isFinite(input.mismatchRatio) ? Math.max(0, input.mismatchRatio) : 1;
  return { status: ratio > threshold ? "changed" : "match", mismatchRatio: ratio, threshold };
}
