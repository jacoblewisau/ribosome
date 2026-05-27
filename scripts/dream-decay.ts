#!/usr/bin/env node
/**
 * scripts/dream-decay.ts
 *
 * `npm run dream:decay [--days N] [--floor F]`
 *
 * Phase 6 deliverable. Decays distilled items that have not been
 * referenced and are old enough to suggest the chain has stopped
 * caring about them. Plan §10:
 *
 *   "A distilled item that fails to be referenced in any session for
 *    N runs is demoted (confidence decays) and eventually purged.
 *    This is the only memory write that happens outside Dreaming."
 *
 * Heuristic (proxy for "N runs without reference" since we don't
 * track per-pass history):
 *   - For each item in the latest distilled store:
 *     - if reference_count > 0 OR last_referenced exists: leave alone
 *     - if first_seen is older than `--days` (default 14): decay
 *       confidence by 0.1
 *   - After decay: items with confidence below `--floor` (default
 *     0.3) are removed from the store
 *   - Write the resulting store as a NEW timestamped distilled pass
 *     (writeDistilled handles the archive)
 *
 * Invoked from the dream skill at the end of a dreaming run, OR
 * standalone by the maintainer / a Phase 4.5 cron job.
 */

import { decayDistilled, latestDistilledPath } from "../src/chain/distilled.ts";

interface Options {
  days: number;
  floor: number;
}

function parseArgs(): Options {
  const opts: Options = { days: 14, floor: 0.3 };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--days") {
      opts.days = Number(args[++i] ?? "14");
    } else if (a === "--floor") {
      opts.floor = Number(args[++i] ?? "0.3");
    } else if (a === "--help" || a === "-h") {
      console.log("usage: dream:decay [--days N] [--floor F]");
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(opts.days) || opts.days < 0) {
    console.error("--days must be a non-negative number");
    process.exit(2);
  }
  if (!Number.isFinite(opts.floor) || opts.floor < 0 || opts.floor > 1) {
    console.error("--floor must be a number between 0 and 1");
    process.exit(2);
  }
  return opts;
}

const opts = parseArgs();
const result = decayDistilled(opts);

if (result.decayed === 0 && result.purged.length === 0) {
  console.log("dream:decay: no items eligible for decay");
} else {
  console.log(`dream:decay: ${result.decayed} item(s) decayed, ${result.purged.length} purged`);
  const newDir = latestDistilledPath();
  if (newDir !== undefined) console.log(`  new store: ${newDir}`);
  for (const id of result.purged) console.log(`  purged: ${id}`);
}
