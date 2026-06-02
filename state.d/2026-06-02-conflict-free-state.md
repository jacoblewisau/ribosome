### 2026-06-02 - Conflict-free STATE.md via the fragment pattern

Fixes the structural bug where every landed change rewrote `STATE.md` (rule 15), so concurrent PRs (notably several scout-generated PRs overnight) always conflicted on it. Diagnosis was grounded: closed PRs #23/#24/#25 already showed the manual conflict dance, and 5 scout Issues (#27-#31) were queued to repeat it.

Researched the standard fix and challenged the obvious one: `.gitattributes merge=union` does NOT work for Ribosome because GitHub's web/API merge ignores user-defined merge drivers. The robust answer is the news-fragment pattern (Towncrier / Changesets): each change adds a uniquely named `state.d/<id>-<slug>.md`, and `STATE.md` is assembled from those fragments plus the curated head `state.d/0000-current.md`.

Shipped (tracer bullet): `state.d/` with the curated head, a README, and seed log fragments; `src/state/build.ts` (pure assembler) + `scripts/state-build.ts` (`npm run state:build`, with `--check`); `STATE.md` regenerated with a generated-file banner; `.gitattributes` with `STATE.md merge=union` as local defense-in-depth; unit tests for the assembler; eval invariants R15 / T18 / TR16. Rule 15 reworded to require a fragment, not a STATE.md edit (CLAUDE.md change, left for the operator to merge). Full plan and remaining slices in `goals/conflict-free-state.md`.
