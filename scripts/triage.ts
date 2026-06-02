#!/usr/bin/env node
/**
 * scripts/triage.ts
 *
 * CLI wrapper around src/chain/triage.ts so the coordinator can make the spec
 * gate and tweak-size decisions deterministically (the agent supplies the
 * judgment inputs; the code returns the decision).
 *
 *   node --experimental-strip-types scripts/triage.ts spec-gate '["new dependency: x"]'
 *     -> {"needs_operator":true,"flags":["new dependency: x"]}
 *   node --experimental-strip-types scripts/triage.ts spec-gate '[]'
 *     -> {"needs_operator":false,"flags":[]}
 *   node --experimental-strip-types scripts/triage.ts tweak-size --files 1 --lines 5
 *     -> {"withinBudget":true,"escalate":false,"reason":"..."}
 *
 * Exit 2 on a usage error.
 */

import { decideSpecGate, evaluateTweakSize } from "../src/chain/triage.ts";

const [cmd, ...rest] = process.argv.slice(2);

function die(msg: string): never {
  console.error(msg);
  process.exit(2);
}

if (cmd === "spec-gate") {
  const json = rest[0] ?? "[]";
  let flags: unknown;
  try {
    flags = JSON.parse(json);
  } catch {
    die("spec-gate expects a JSON array of flag strings, e.g. '[\"new dependency: x\"]'");
  }
  if (!Array.isArray(flags)) die("spec-gate argument must be a JSON array");
  process.stdout.write(JSON.stringify(decideSpecGate(flags as string[])) + "\n");
} else if (cmd === "tweak-size") {
  const fi = rest.indexOf("--files");
  const li = rest.indexOf("--lines");
  const files = Number(fi >= 0 ? rest[fi + 1] : NaN);
  const lines = Number(li >= 0 ? rest[li + 1] : NaN);
  process.stdout.write(JSON.stringify(evaluateTweakSize({ files, lines })) + "\n");
} else {
  die("usage: triage spec-gate '<flagsJson>' | triage tweak-size --files N --lines N");
}
