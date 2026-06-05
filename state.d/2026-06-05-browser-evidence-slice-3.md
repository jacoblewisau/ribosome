### 2026-06-05 - Browser-evidence slice 3 (project #34, #39): visual regression

Catches accidental visual changes to screens that already shipped, completing
project #34. Maintainer work, one PR.

- Each captured scene is diffed against a committed baseline
  (`evidence/baselines/<scene>.png`) with `pixelmatch` (+ `pngjs`). The pure
  `classifyVisual` returns `match` / `changed` / `new-baseline` against a small
  mismatch threshold (sub-pixel antialiasing tolerated; the same code in the
  same environment yields 0). The pixel diff lives in the script; the classify
  logic is pure and unit-tested.
- `scripts/capture-evidence.ts --check-visual` records a per-scene visual verdict
  on the manifest and writes a diff image on a change; `--update-baselines`
  accepts the current capture as the new golden image. The validator flags a
  `changed` verdict as an Important visual regression (unless the spec says it
  was intended), pointing at the diff.
- Proven live (all three paths): seeding baselines (new-baseline), an identical
  re-capture (match, 0%), and a deliberately wrong baseline (changed, 0.38%, diff
  written). Demo baselines committed for the substrate empty + populated scenes.

Eval T25; baseline 62 -> 63. 112 unit tests. **Project #34 is complete**
(slices 1, 2, 3 all shipped as maintainer PRs).
