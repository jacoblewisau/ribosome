### 2026-06-03 - Footer copy "Built" -> "Crafted" (chain 0009 tweak)

Chain 0009 (Issue #47), a `ribo:tweak`. Changed the app footer credit line from
"Built with Ribosome" to "Crafted with Ribosome" (one word, sentence case
preserved) in `src/App.tsx`, and updated the assertion, title, and header
comment in `tests/acceptance/0007.spec.ts` (the living single source of truth
for the footer copy) to the new literal so the suite stays green. No second
acceptance test was created: a duplicate footer assertion would have inflated
the diff past the tweak budget for no coverage gain.

Purpose of the run: a deliberate re-run of the Slice C tweak fast-path to
confirm a clean green end-to-end run after the board-rebuild fix (PR #46,
`--upsert`). The fast-path behaved as designed: no story or plan gate, triage
clean (tweak-size 2 files / 4 lines within budget, spec-gate no sensitive
flags), builder + verify-contracts + validator all green, draft PR opened with
the PR merge as the only gate. The footer is not a VerifiableUnit, so
`npm run verify` (28 fixtures) was unaffected.
