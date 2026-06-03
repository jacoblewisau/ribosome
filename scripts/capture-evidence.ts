#!/usr/bin/env node
/**
 * scripts/capture-evidence.ts  (browser-evidence slice 1)
 *
 * Capture ONE screen of the BUILT app in a real headless browser,
 * deterministically, and commit a screenshot plus a text snapshot under
 * evidence/<id>/ so they appear in the pull request's changed files. When the
 * verify report (tests/verify/last-run.json) is present, also merge an evidence
 * entry into it so the validator can read it.
 *
 * Deterministic by construction: a fixed viewport, animations/transitions
 * disabled, and an explicit wait for the unit selector (never a timed pause).
 * The app is the production build (`vite build`) served over http by
 * `vite preview` (ES-module scripts do not execute from file://), and the
 * server is torn down at the end.
 *
 *   node --experimental-strip-types scripts/capture-evidence.ts \
 *     --id 0008 --scene empty --criterion "criterion 1: empty first-load screen"
 *
 * Flags:
 *   --id <chainId>      evidence/<id>/ folder (default "local")
 *   --scene <name>      scene name -> <scene>.png / <scene>.txt (default "empty")
 *   --criterion "<t>"   the acceptance criterion this screen demonstrates
 *   --selector <css>    wait-for/innerText target (default [data-verify-unit="TodoApp"])
 *   --port <n>          preview server port (default 4319)
 *   --url <override>    skip build+serve and capture this URL instead
 *   --no-build          reuse an existing dist/ build (still starts the server)
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import {
  DEFAULT_VIEWPORT,
  DISABLE_ANIMATIONS_CSS,
  evidencePaths,
  makeManifest,
  makeScene,
  mergeEvidenceIntoReport,
  normalizeSnapshot,
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
const scene = arg("scene", "empty")!;
const criterion = arg("criterion", "the captured screen matches the requested screen")!;
const selector = arg("selector", '[data-verify-unit="TodoApp"]')!;
const port = Number(arg("port", "4319"));

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

async function main(): Promise<void> {
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
    await page.goto(target, { waitUntil: "networkidle" });
    await page.waitForSelector(selector, { state: "visible" });
    await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });

    const paths = evidencePaths(id, scene);
    mkdirSync(dirname(join(ROOT, paths.screenshot)), { recursive: true });

    const visible = await page.locator(selector).first().innerText();
    writeFileSync(join(ROOT, paths.snapshot), normalizeSnapshot(visible));
    await page.screenshot({ path: join(ROOT, paths.screenshot), fullPage: true });

    const sceneRec = makeScene({ chainId: id, scene, criterion, capturedAt: new Date().toISOString() });
    const manifest = makeManifest(id, [sceneRec]);
    writeFileSync(
      join(dirname(join(ROOT, paths.screenshot)), "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n"
    );

    const reportPath = join(ROOT, "tests", "verify", "last-run.json");
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, "utf8")) as VerifyReport;
      writeFileSync(reportPath, JSON.stringify(mergeEvidenceIntoReport(report, manifest), null, 2));
      console.log("capture-evidence: merged evidence into tests/verify/last-run.json");
    }

    console.log(`capture-evidence: wrote ${paths.screenshot}, ${paths.snapshot}, and the manifest`);
  } finally {
    await browser.close();
    preview?.child.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error("capture-evidence failed:", e);
  process.exit(1);
});
