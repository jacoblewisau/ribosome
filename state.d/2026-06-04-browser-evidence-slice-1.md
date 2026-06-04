### 2026-06-04 - Browser-evidence slice 1, built as maintainer work (project #34)

The chain (issue #37) correctly **blocked** building this: slice 1 rewires
Ribosome's own machinery (validator, pr-shepherd, verify schema), which the
builder is charter-forbidden to edit. So it was built directly as maintainer
work, in three PRs, with one first-principles change over the blocked spec:
**evidence is additive on the v1 verify report, not a version-2 bump** (so the
validator never breaks and the changes are pure enhancements). ADR-0006.

- **PR #55 (capture core).** `src/verify/core/evidence.ts` (pure helpers, 12
  tests), an optional `evidence` field on the v1 `VerifyReport`, and
  `scripts/capture-evidence.ts` (`npm run capture:evidence`): `vite build` +
  `vite preview` over http, headless Chromium, fixed 1200x800 viewport,
  animations off, explicit selector wait. Writes `evidence/<id>/<scene>.{png,txt}`
  + manifest, merges evidence into the report. `playwright` devDep. A real,
  deterministic sample was captured (`evidence/0008/`, byte-identical re-runs).
  Evals R18 / TR20.
- **PR #56 (judge + hold).** The validator reads each screenshot (the Read tool
  renders PNGs) and judges it against its criterion (matches / does_not_match /
  cannot_tell); `cannot_tell` sets `hold_for_evidence` and pr-shepherd leaves the
  PR a draft (a pr-shepherd-level hold, no new chain verdict, so T3/R11/R14/T10/
  TR3 stay green). Eval T21.
- **PR #57 (wiring + guardrail).** ribosome.yml installs Chromium (cached). The
  block produced a guardrail in spec-writer and planner: never put `.claude/`
  agent/skill/hook files in builder `scope_paths`; meta-changes are maintainer
  work (evals R19 / T22). ADR-0006; STATE updated.

Counts: 104 unit tests, eval 60/60. Remaining (also maintainer work): slice 2
(#38, embed the image in the PR body) and slice 3 (#39, visual regression).
