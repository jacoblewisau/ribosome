### 2026-06-05 - Browser-evidence slice 2 (project #34, #38), maintainer work

Scales slice 1 from one screen to every declared screen, embedded in the PR.
Two PRs.

- **PR #58 (PR-A, declared scene set).** A feature declares the screens it wants
  captured (a scene set); each is reached from a fresh load by deterministic
  interaction steps (`fill` / `click` / `waitFor`, never a timed pause).
  `parseSceneSet` is pure and tested; `scripts/capture-evidence.ts --scenes-file`
  captures each scene. Demo `evidence/0010/` (empty + populated): the populated
  scene adds two fixed todos via interaction; both PNGs are byte-identical
  across re-runs. The validator already judges each scene (slice 1). Eval T23.
- **PR #59 (PR-B, embed).** pr-shepherd embeds each committed screenshot inline
  in the PR body via its raw URL on the head branch (markdown image), so the
  operator sees the picture in the PR body rather than digging into changed
  files. Eval T24.

Counts: 108 unit tests, eval 62/62. Remaining: slice 3 (#39, visual regression
against a saved baseline) is also maintainer work.
