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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium, type Page } from "playwright";
import {
  DEFAULT_VIEWPORT,
  DISABLE_ANIMATIONS_CSS,
  evidencePaths,
  makeManifest,
  makeScene,
  mergeEvidenceIntoReport,
  normalizeSnapshot,
  parseSceneSet,
  type EvidenceScene,
  type SceneSpec,
} from "../src/verify/core/evidence.ts";
import type { VerifyReport } from "../src/verify/core/types.ts";

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

    const manifest = makeManifest(id, records);
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
