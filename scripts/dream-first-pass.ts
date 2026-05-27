#!/usr/bin/env node
/**
 * scripts/dream-first-pass.ts
 *
 * One-time bootstrap. Acts as the `dream` skill's first invocation
 * against the three real chain runs on disk (0001, 0002, 0003).
 *
 * In normal operation the `dream` skill is invoked by a Claude Code
 * session (manually in Phase 4.5, via the GitHub Action cron in
 * Phase 3+). Both invocations produce items by LLM synthesis. This
 * bootstrap script hardcodes the first batch so the Phase 4.5
 * acceptance test has a reproducible starting state without
 * requiring a Claude Code session at the time of commit.
 *
 * Subsequent dream passes go through the skill, not through this
 * script. Treat this file as one-shot documentation of the first
 * distilled store.
 */

import { writeDistilled, type DistilledItem } from "../src/chain/distilled.ts";

const now = new Date().toISOString();

const items: DistilledItem[] = [
  {
    id: "pat-data-verify-contract-surface",
    category: "pattern",
    title: "data-verify-* attributes are the validator's surface, not the source",
    body:
      "Every observable element in this codebase exposes data-verify-* attributes via " +
      "verifyAttrs(unit, state). The validator reads these attributes (and the " +
      "tests/verify/last-run.json domSnapshot derived from them); it does not read the " +
      "component source. Renaming or removing a data-verify-* attribute without updating " +
      "every verify spec that mounts the unit is a breaking change. See CLAUDE.md rule 13 " +
      "for the importer-in-scope corollary. The Phase 2 acceptance test demonstrated this: " +
      "commenting out the `total` key in TodoApp's verifyAttrs surfaced three FAIL verdicts " +
      "with domSnapshot.total absent on each.",
    evidence: [
      "src/verify/core/contract.ts",
      "chain:0001",
      "chain:0002",
      "chain:0003",
      "CLAUDE.md rule 13",
    ],
    confidence: 0.95,
    reference_count: 0,
    first_seen: now,
  },
  {
    id: "pat-clock-injection-for-time-tests",
    category: "pattern",
    title: "Time-dependent components accept now?: () => number and resolve once per render",
    body:
      "When a component derives observable state from the current time (overdue, expired, " +
      "stale), it accepts an optional now?: () => number prop with default () => Date.now(). " +
      "The prop is resolved once per render and the resulting nowMs is threaded to children. " +
      "Contract fixtures inject a fixed clock (typically FIXED_NOW = Date.UTC(2026, 4, 15)) " +
      "so verdicts are reproducible without timer mocking. See TodoApp.tsx for the canonical " +
      "shape and TodoApp.verify.ts for the FIXED_NOW pattern.",
    evidence: [
      "chain:0003",
      "src/features/todos/TodoApp.tsx",
      "src/verify/specs/TodoApp.verify.ts",
    ],
    confidence: 0.9,
    reference_count: 0,
    first_seen: now,
  },
  {
    id: "pat-local-noon-date-parsing",
    category: "pattern",
    title: "HTML date inputs are parsed as local-noon timestamps to dodge tz off-by-one",
    body:
      "HTML <input type=\"date\"> returns YYYY-MM-DD in local time. Parsing this as " +
      "new Date(s) gives UTC midnight, which is the previous day in tz east of UTC and " +
      "the same day in tz west. The convention in this repo is to parse it as local-noon " +
      "via new Date(y, m-1, d, 12, 0, 0, 0).getTime(). Local-noon is at least 12 hours away " +
      "from either UTC boundary across all real tz from UTC-12 to UTC+12, so the formatted " +
      "YYYY-MM-DD round-trips correctly. Kiribati (UTC+14) is the known exception; out of " +
      "scope. See parseDueDateInput in todos.feature.ts.",
    evidence: [
      "chain:0003",
      "src/features/todos/todos.feature.ts (parseDueDateInput)",
      "specs/0003.md (Risks: timezone)",
    ],
    confidence: 0.85,
    reference_count: 0,
    first_seen: now,
  },
  {
    id: "pat-probe-pairs-with-behavior",
    category: "pattern",
    title: "A probe is more useful when paired with a non-probe exercising the same code path",
    body:
      "A probe fixture asserts something deliberately false to prove the harness catches " +
      "lies. The probe is most instructive when a sibling non-probe fixture exercises the " +
      "same code path with a real assertion. tags-dedupe-fails (probe, claims tag-count=3 " +
      "after submitting 'x, x, x') paired with tags-parse-and-trim (non-probe, asserts " +
      "tag-count=3 after submitting 'a, b, c, a') together make the dedupe path observable: " +
      "a regression in dedupe would change BOTH the probe's failure reason and the " +
      "non-probe's verdict. Compare to total-claims-mismatch which is a generic probe and " +
      "asserts nothing the unit's normal behaviour depends on; it is acceptable but less " +
      "instructive.",
    evidence: [
      "chain:0002",
      "src/verify/specs/todos.feature.verify.ts (tags-dedupe-fails + tags-parse-and-trim)",
    ],
    confidence: 0.8,
    reference_count: 0,
    first_seen: now,
  },
  {
    id: "ap-vitest-default-bails-at-first-fail",
    category: "anti-pattern",
    title: "Matrix tests must use expect.soft or they hide downstream failures",
    body:
      "Vitest's default expect().toBe() throws synchronously and bails the rest of the test. " +
      "For a matrix test that runs every fixture and writes a canonical report consumed by " +
      "the validator, a default expect causes the report to contain only the first failing " +
      "fixture; downstream failures are invisible. Use expect.soft for the verdict " +
      "assertions inside the matrix loop, then a final expect to fail the test if any soft " +
      "expect was violated. Discovered during the Phase 2 acceptance demonstration when " +
      "deliberately omitting data-verify-total surfaced only TodoApp/empty initially.",
    evidence: [
      "src/verify/matrix.test.ts",
      "commit:632c439 (phase 2)",
    ],
    confidence: 0.9,
    reference_count: 0,
    first_seen: now,
  },
  {
    id: "op-pref-bare-approve-resolves-to-stated-defaults",
    category: "operator-preference",
    title: "Operator's bare /approve resolves story open questions to the stated defaults",
    body:
      "Story-writer surfaces genuine open questions and offers stated defaults (\"above " +
      "assumes X, Y, Z; operator confirms\"). The operator's bare /approve, observed in all " +
      "three chains (0001 reset button, 0002 tags, 0003 due dates), accepts the defaults as-is. " +
      "/changes is reserved for cases where the operator wants a non-default answer. " +
      "Implication for the story-writer: phrase defaults with confidence, not as questions; " +
      "the operator approves the defaults explicitly when bare /approve is the path.",
    evidence: [
      "chain:0001",
      "chain:0002",
      "chain:0003",
      "stories/0001.md",
      "stories/0002.md",
      "stories/0003.md",
    ],
    confidence: 0.85,
    reference_count: 0,
    first_seen: now,
  },
];

const newDir = writeDistilled({
  generated_at: now,
  source_chains: ["0001", "0002", "0003"],
  items,
});

console.log(`dream first pass complete: ${items.length} items at ${newDir}`);
