#!/usr/bin/env node
/**
 * scripts/eval.ts
 *
 * `npm run eval` runs the 12 seeded tasks against the current repo
 * state. With `--baseline <path>`, also compares to a recorded
 * baseline and exits non-zero on regression.
 *
 * Modes:
 *   npm run eval                              # human-readable report; exit 0 always
 *   npm run eval -- --json                    # JSON to stdout
 *   npm run eval -- --gate evals/baseline.json
 *                                              # human report + regression gate;
 *                                              # exit 1 if regressed by > 1 task
 *   npm run eval -- --record evals/baseline.json
 *                                              # rewrite the baseline from the
 *                                              # current report (operator-only)
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadBaseline, regressesAgainst, renderReport, runEval, writeBaseline } from "../src/evals/runner.ts";

type Mode = "text" | "json" | "gate" | "record";
interface Options {
  mode: Mode;
  baselinePath?: string;
  outFile?: string;
}

function parseArgs(): Options {
  const opts: Options = { mode: "text" };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") opts.mode = "json";
    else if (a === "--gate") {
      opts.mode = "gate";
      opts.baselinePath = args[++i];
    } else if (a === "--record") {
      opts.mode = "record";
      opts.baselinePath = args[++i];
    } else if (a === "--out") {
      opts.outFile = args[++i];
    } else if (a === "--help" || a === "-h") {
      console.log("usage: eval [--json] [--gate <baseline>] [--record <baseline>] [--out <path>]");
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if ((opts.mode === "gate" || opts.mode === "record") && !opts.baselinePath) {
    console.error(`--${opts.mode} requires a baseline path argument`);
    process.exit(2);
  }
  return opts;
}

const opts = parseArgs();
const report = runEval();

if (opts.outFile) {
  writeFileSync(resolve(opts.outFile), JSON.stringify(report, null, 2));
}

if (opts.mode === "json") {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(0);
}

if (opts.mode === "record") {
  writeBaseline(resolve(opts.baselinePath!), report, "manual record");
  console.log(`recorded baseline at ${opts.baselinePath}: pass=${report.pass}/${report.totalTasks}, score=${report.score.toFixed(3)}`);
  process.exit(0);
}

console.log(renderReport(report));

if (opts.mode === "gate") {
  const baseline = loadBaseline(resolve(opts.baselinePath!));
  if (!baseline) {
    console.error(`no baseline at ${opts.baselinePath}; run --record first`);
    process.exit(1);
  }
  const r = regressesAgainst(report, baseline);
  console.log(`\nGate: baseline pass=${baseline.pass}/${baseline.totalTasks}, current pass=${report.pass}/${report.totalTasks}, drop=${r.drop}`);
  if (r.regressed) {
    console.error(`\nGATE FAILED: ${r.reason}`);
    process.exit(1);
  }
  console.log(`Gate passed: ${r.reason}`);
  process.exit(0);
}

// Default (text mode, no gate): always exit 0.
process.exit(report.fail === 0 ? 0 : 0);
