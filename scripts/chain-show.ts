#!/usr/bin/env node
/**
 * scripts/chain-show.ts
 *
 * `npm run chain:show [id]` or `npm run chain:list`.
 *
 * For the maintainer to inspect chain state without writing scripts.
 * The operator (non-coder) does not run this; their interface is
 * GitHub Issues and PRs.
 *
 * Output is plain text, no colour codes (so it is grep-friendly and
 * pastes cleanly into PR descriptions or issue comments).
 */

import { listChains, readChain, readFinal, readInFlight, isMidRun } from "../src/chain/state.ts";
import type { Role } from "../src/chain/state.ts";

function showOne(id: string): void {
  const state = readChain(id);
  console.log(`chain ${id}`);
  console.log(`  issue:           ${state.issue}`);
  console.log(`  path:            ${state.path} (${state.path_reason})`);
  console.log(`  current step:    ${state.current_step}`);
  console.log(`  gates:           story=${state.gate_state.story}  spec=${state.gate_state.spec}  pr=${state.gate_state.pr}`);
  if (state.validator_status) {
    console.log(`  validator:       ${state.validator_status}`);
  }
  console.log(`  started:         ${state.started_at}`);
  if (state.completed_at) {
    console.log(`  completed:       ${state.completed_at}`);
  }

  const roles: Role[] = [
    "researcher",
    "story-writer",
    "spec-writer",
    "builder",
    "test-author",
    "validator",
    "pr-shepherd",
  ];
  console.log(`  artefacts:`);
  for (const role of roles) {
    const finalContent = readFinal(id, role);
    const inFlight = readInFlight(id, role);
    const mid = isMidRun(id, role);
    if (finalContent === undefined && inFlight === undefined) continue;
    const lines = [
      finalContent ? `final (${finalContent.split("\n").length} lines)` : null,
      inFlight ? `in-flight (${inFlight.split("\n").length} lines)` : null,
      mid ? "MID-RUN" : null,
    ].filter(Boolean);
    console.log(`    ${role.padEnd(14)} ${lines.join(", ")}`);
  }
}

function showAll(): void {
  const ids = listChains();
  if (ids.length === 0) {
    console.log("no chains on disk");
    return;
  }
  console.log(`chains on disk (${ids.length}):`);
  for (const id of ids) {
    const state = readChain(id);
    const mark = state.current_step === "completed" ? "done" : "open";
    console.log(`  [${mark}] ${id.padEnd(14)} ${state.issue}`);
  }
  console.log("");
  console.log("for details: npm run chain:show <id>");
}

const arg = process.argv[2];
if (arg === undefined || arg === "list") {
  showAll();
} else {
  showOne(arg);
}
