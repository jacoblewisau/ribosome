/**
 * Pure helpers for browser-evidence capture (browser-evidence slice 1).
 *
 * No I/O. The capture script (scripts/capture-evidence.ts) owns Playwright and
 * the filesystem; this module owns the shapes, the deterministic committed
 * paths, the snapshot normalisation, and the report merge, so that logic is
 * unit-tested and never drifts. Mirrors the pure-module discipline of
 * src/chain/mission-control.ts.
 */

import type { EvidenceManifest, EvidenceScene, VerifyReport } from "./types";

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
