#!/usr/bin/env node
/**
 * scripts/capture-evidence.ts  (browser-evidence, slices 1 and 2)
 *
 * Capture one or more declared screens of the BUILT app in a real headless
 * browser, deterministically, and commit a screenshot plus a text snapshot per
 * scene under evidence/<id>/ so they appear in the pull request's changed
 * files. When the verify report (tests/verify/last-run.json) is present, also
 * merge an evidence entry into it so the validator can read and judge each
 * scene.
 *
 * Deterministic by construction: a fixed viewport, animations/transitions
 * disabled, and explicit waits (never timed pauses). The app is the production
 * build (`vite build`) served over http by `vite preview` (ES-module scripts do
 * not execute from file://). Each scene starts from a fresh page load, runs its
 * declared interaction steps, then is captured.
 *
 *   # single scene (slice 1):
 *   node --experimental-strip-types scripts/capture-evidence.ts \
 *     --id 0008 --scene empty --criterion "the empty first-load screen"
 *
 *   # declared scene set (slice 2):
 *   node --experimental-strip-types scripts/capture-evidence.ts \
 *     --id 0010 --scenes-file evidence/0010/scenes.json
 *
 * Flags:
 *   --id <chainId>        evidence/<id>/ folder (default "local")
 *   --scenes-file <path>  JSON array of declared scenes (overrides --scene)
 *   --scene <name>        single-scene name (default "empty")
 *   --criterion "<t>"     single-scene criterion
 *   --selector <css>      main wait/innerText target (default [data-verify-unit="TodoApp"])
 *   --port <n>            preview server port (default 4319)
 *   --url <override>      skip build+serve and capture this URL instead
 *   --no-build            reuse an existing dist/ build (still starts the server)
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium, type Page } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import {
  DEFAULT_VIEWPORT,
  DISABLE_ANIMATIONS_CSS,
  baselinePath,
  classifyVisual,
  diffPath,
  evidencePaths,
  makeManifest,
  makeScene,
  mergeEvidenceIntoReport,
  normalizeSnapshot,
  parseSceneSet,
  type EvidenceScene,
  type SceneSpec,
} from "../src/verify/core/evidence.ts";
import type { VerifyReport, VisualVerdict } from "../src/verify/core/types.ts";

const argv = process.argv.slice(2);
const arg = (name: string, def?: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const has = (name: string): boolean => argv.includes(`--${name}`);

const ROOT = process.cwd();
const VITE = join(ROOT, "node_modules", "vite", "bin", "vite.js");
const id = arg("id", "local")!;
const selector = arg("selector", '[data-verify-unit="TodoApp"]')!;
const port = Number(arg("port", "4319"));

function loadScenes(): SceneSpec[] {
  const file = arg("scenes-file");
  if (file) return parseSceneSet(readFileSync(join(ROOT, file), "utf8"));
  return [{ scene: arg("scene", "empty")!, criterion: arg("criterion", "the captured screen matches the requested screen")! }];
}

function build(): void {
  console.log("capture-evidence: building app (vite build) ...");
  execFileSync(process.execPath, [VITE, "build", "--logLevel", "warn"], { cwd: ROOT, stdio: "inherit" });
}

async function startPreview(): Promise<{ url: string; child: ChildProcess }> {
  const child = spawn(process.execPath, [VITE, "preview", "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  const url = `http://localhost:${port}/`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return { url, child };
    } catch {
      /* server not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill("SIGTERM");
  throw new Error(`capture-evidence: vite preview did not become ready on ${url}`);
}

async function captureScene(page: Page, target: string, spec: SceneSpec): Promise<EvidenceScene> {
  // Fresh load per scene, so scenes are independent.
  await page.goto(target, { waitUntil: "networkidle" });
  await page.waitForSelector(selector, { state: "visible" });
  for (const step of spec.steps ?? []) {
    if (step.action === "fill") await page.fill(step.selector, step.value);
    else if (step.action === "click") await page.click(step.selector);
    else await page.waitForSelector(step.selector, { state: "visible" });
  }
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });

  const paths = evidencePaths(id, spec.scene);
  mkdirSync(dirname(join(ROOT, paths.screenshot)), { recursive: true });
  const visible = await page.locator(selector).first().innerText();
  writeFileSync(join(ROOT, paths.snapshot), normalizeSnapshot(visible));
  await page.screenshot({ path: join(ROOT, paths.screenshot), fullPage: true });
  console.log(`capture-evidence: captured "${spec.scene}" -> ${paths.screenshot}`);
  return makeScene({ chainId: id, scene: spec.scene, criterion: spec.criterion, capturedAt: new Date().toISOString() });
}

/** Decode the current and baseline PNGs and measure their pixel mismatch ratio
 *  (slice 3). A missing baseline yields hasBaseline:false; a dimension change
 *  counts as fully changed. The diff image is returned only when pixels differ. */
function compareToBaseline(
  currentAbs: string,
  baselineAbs: string
): { hasBaseline: boolean; mismatchRatio: number; diff?: PNG } {
  if (!existsSync(baselineAbs)) return { hasBaseline: false, mismatchRatio: 0 };
  const cur = PNG.sync.read(readFileSync(currentAbs));
  const base = PNG.sync.read(readFileSync(baselineAbs));
  if (cur.width !== base.width || cur.height !== base.height) {
    return { hasBaseline: true, mismatchRatio: 1 };
  }
  const { width, height } = cur;
  const diff = new PNG({ width, height });
  const numDiff = pixelmatch(base.data, cur.data, diff.data, width, height, { threshold: 0.1 });
  return { hasBaseline: true, mismatchRatio: numDiff / (width * height), diff };
}

async function main(): Promise<void> {
  const scenes = loadScenes();
  const override = arg("url");
  if (!has("no-build") && !override) build();

  let preview: { url: string; child: ChildProcess } | undefined;
  const target = override ?? (preview = await startPreview()).url;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { ...DEFAULT_VIEWPORT },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    const records: EvidenceScene[] = [];
    for (const spec of scenes) records.push(await captureScene(page, target, spec));

    // Visual regression (slice 3): compare each captured scene to its committed
    // baseline; --update-baselines accepts the current capture as the new golden.
    const verdicts: VisualVerdict[] = [];
    if (has("check-visual") || has("update-baselines")) {
      const thr = arg("threshold") !== undefined ? Number(arg("threshold")) : undefined;
      for (const rec of records) {
        const curAbs = join(ROOT, evidencePaths(id, rec.scene).screenshot);
        const baseAbs = join(ROOT, baselinePath(rec.scene));
        const cmp = compareToBaseline(curAbs, baseAbs);
        const v = classifyVisual({ hasBaseline: cmp.hasBaseline, mismatchRatio: cmp.mismatchRatio, threshold: thr });
        const vv: VisualVerdict = { scene: rec.scene, status: v.status, mismatchRatio: v.mismatchRatio, threshold: v.threshold };
        if (v.status === "changed" && cmp.diff) {
          const dRel = diffPath(id, rec.scene);
          writeFileSync(join(ROOT, dRel), PNG.sync.write(cmp.diff));
          vv.diff = dRel;
        }
        if (has("update-baselines") && v.status !== "match") {
          mkdirSync(dirname(baseAbs), { recursive: true });
          copyFileSync(curAbs, baseAbs);
        }
        verdicts.push(vv);
        console.log(`capture-evidence: visual "${rec.scene}": ${v.status} (${(v.mismatchRatio * 100).toFixed(2)}% changed)`);
      }
    }

    const manifest = verdicts.length ? { ...makeManifest(id, records), visual: verdicts } : makeManifest(id, records);
    const anyPng = evidencePaths(id, records[0]!.scene).screenshot;
    writeFileSync(join(dirname(join(ROOT, anyPng)), "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

    const reportPath = join(ROOT, "tests", "verify", "last-run.json");
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, "utf8")) as VerifyReport;
      writeFileSync(reportPath, JSON.stringify(mergeEvidenceIntoReport(report, manifest), null, 2));
      console.log("capture-evidence: merged evidence into tests/verify/last-run.json");
    }

    console.log(`capture-evidence: ${records.length} scene(s) under evidence/${id}/ + manifest`);
  } finally {
    await browser.close();
    preview?.child.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error("capture-evidence failed:", e);
  process.exit(1);
});
