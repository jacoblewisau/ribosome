#!/usr/bin/env node
/**
 * scripts/state-build.ts
 *
 * Regenerates STATE.md from the fragments in state.d/. Run by the maintainer
 * or a serial step (the dream pass / session start), NOT inside feature PRs:
 * feature PRs only add a fragment, so they never collide on STATE.md.
 *
 *   npm run state:build            # rewrite STATE.md from state.d/
 *   npm run state:build -- --check # exit 1 if STATE.md is out of date (no write)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildState } from "../src/state/build.ts";

const STATE_DIR = resolve("state.d");
const STATE_FILE = resolve("STATE.md");

const check = process.argv.includes("--check");
const built = buildState(STATE_DIR);

if (check) {
  let current = "";
  try {
    current = readFileSync(STATE_FILE, "utf8");
  } catch {
    current = "";
  }
  if (current !== built) {
    console.error("STATE.md is out of date with state.d/. Run: npm run state:build");
    process.exit(1);
  }
  console.log("STATE.md is up to date with state.d/.");
  process.exit(0);
}

writeFileSync(STATE_FILE, built);
console.log(`wrote STATE.md from state.d/ (${built.split("\n").length} lines)`);
