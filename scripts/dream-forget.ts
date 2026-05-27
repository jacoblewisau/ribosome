#!/usr/bin/env node
/**
 * scripts/dream-forget.ts
 *
 * `npm run dream:forget <item-id> [reason]`
 *
 * Removes an item from the latest distilled store and archives the
 * previous store so the action can be rolled back. The reason is
 * recorded as a tombstone file in the new distilled directory.
 *
 * Phase 3 will wire the operator's `/forget <id>` reply on the
 * dreamer-digest Issue to call this script via the Claude Code
 * GitHub Action. For Phase 4.5 alone, this is invoked manually.
 */

import { forgetItem } from "../src/chain/distilled.ts";

const id = process.argv[2];
const reason = process.argv.slice(3).join(" ") || "no reason provided";

if (id === undefined) {
  console.error("usage: npm run dream:forget <item-id> [reason]");
  process.exit(1);
}

try {
  const newDir = forgetItem(id, reason);
  console.log(`dream:forget: removed "${id}" from the latest distilled store.`);
  console.log(`  new store: ${newDir}`);
  console.log(`  reason:    ${reason}`);
  console.log(`  rollback:  the prior store is archived at .claude/memory/distilled.archive/`);
} catch (err) {
  console.error("dream:forget failed:", (err as Error).message);
  process.exit(1);
}
