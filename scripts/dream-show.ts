#!/usr/bin/env node
/**
 * scripts/dream-show.ts
 *
 * `npm run dream:show`
 *
 * Print the latest distilled store as text, ordered by reference
 * count within category. Maintainer convenience; the operator sees
 * the repo-root MEMORY.md instead.
 */

import { latestDistilledPath, readLatestDistilled } from "../src/chain/distilled.ts";

const store = readLatestDistilled();
if (store === undefined) {
  console.log("no distilled store on disk; run the dream skill first");
  process.exit(0);
}
const path = latestDistilledPath();
console.log(`distilled store at ${path}`);
console.log(`  schema:   ${store.schema} v${store.version}`);
console.log(`  generated: ${store.generated_at}`);
console.log(`  chains:    ${store.source_chains.join(", ")}`);
console.log(`  items:     ${store.items.length}`);
console.log("");

const categories = [
  "pattern",
  "anti-pattern",
  "operator-preference",
  "domain-invariant",
  "eval-trap",
] as const;

for (const cat of categories) {
  const items = store.items
    .filter((i) => i.category === cat)
    .sort((a, b) => b.reference_count - a.reference_count);
  if (items.length === 0) continue;
  console.log(`## ${cat}`);
  for (const item of items) {
    console.log(`  - [${item.id}] (refs=${item.reference_count} conf=${item.confidence.toFixed(2)}) ${item.title}`);
  }
  console.log("");
}
