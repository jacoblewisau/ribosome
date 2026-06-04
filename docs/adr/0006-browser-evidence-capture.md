# 0006. Browser evidence: capture screens via Playwright, additive on the v1 report

- Status: accepted
- Altitude: system-wide
- Decided: 2026-06-04
- Decided by: operator decision (build browser-evidence, project #34), maintainer build

## Context

Project #34 wants the chain to commit a real screenshot of the built app into
the pull request, with a plain-language verdict, so the non-coder operator can
see and trust what was built without reading code. Slice 1 is: capture one
screen, commit it, have the validator judge it.

The chain could not build this itself: the feature rewires Ribosome's own
machinery (the validator, pr-shepherd, the verify schema), which the builder is
charter-forbidden to edit. The chain correctly blocked at the build step (#37)
and flagged it as maintainer work. It was therefore built as a maintainer
feature, in three PRs (#55, #56, this one).

## Decision

- **Capture mechanism.** Add `playwright` as a devDependency.
  `scripts/capture-evidence.ts` runs `vite build` and serves it with
  `vite preview` over http (ES-module scripts do not execute from `file://` in
  Chromium), launches headless Chromium, and takes a full-page screenshot plus a
  text snapshot of the same screen. It is deterministic by construction: a fixed
  1200x800 viewport, animations and transitions disabled, and an explicit wait
  for the unit selector (never a timed pause). Both files are committed under
  `evidence/<id>/`, a path outside `.gitignore`, so they appear in the PR's
  changed files. CI installs Chromium (cached by lockfile hash).
- **Additive on the v1 report, not a version-2 bump.** Evidence is an OPTIONAL
  `evidence` field on the existing `version: "1"` verify report. This is the
  load-bearing choice: the original (blocked) spec bumped the report to
  `version: "2"`, which made the feature all-or-nothing (the validator BLOCKs on
  a version it does not understand) and put the change on a collision course
  with the live chain. An additive optional field keeps the version `"1"`, so
  older readers ignore it and the validator/pr-shepherd changes are pure
  enhancements.
- **Validator judges, pr-shepherd holds.** When the report carries evidence, the
  validator reads each screenshot (the Read tool renders PNGs) and judges it
  against its criterion: `matches`, `does_not_match` (folded into findings), or
  `cannot_tell`. `cannot_tell` sets `hold_for_evidence`, and pr-shepherd leaves
  the PR a draft so the operator looks before merging. This is a pr-shepherd-level
  hold, not a new top-level chain verdict, so the validator's `clean`/`needs_fix`
  and its routing are unchanged.
- **Guardrail.** The block also produced a rule (spec-writer and planner): a spec
  must never place agent/skill/hook files or `CLAUDE.md` in the builder's
  `scope_paths`, and the planner must not decompose a "meta" project into chain
  slices. Meta-changes to Ribosome's own machinery are maintainer work.

## Alternatives considered

- **Report version `"2"` with a blocking validator** (the original spec).
  Rejected: all-or-nothing, breaks the live validator on the version mismatch,
  and couples the feature code to a guardrail rewrite. The additive field
  delivers the same capability with no breaking change.
- **Embed the screenshot inline in the PR body.** Deferred to slice 2 (#38).
  Slice 1 commits the files so they show in the changed-files view; the
  embedding is a separate, larger step.
- **Load the build via `file://`** (no server). Rejected: Chromium blocks
  ES-module scripts under `file://`, so the React app never mounts. `vite
  preview` over http is the faithful, working path.

## Consequences

Makes easy: the chain can now show the operator a real picture of what it built
and hold the PR when it cannot confirm the screen. Commits us to: a new
devDependency (Playwright) and a cached Chromium install in CI; an additive
`evidence` field that must stay backward-compatible (no version bump for
additions); and the meta-scope guardrail. Revisit if: a future slice needs the
report version bumped (then update the validator's pin in lockstep, per the
verify-contracts skill), or if Chromium install time becomes a problem (the
cache should keep it to seconds after the first run).

## Sources

Project #34 and issue #37 (the chain's own block report, which diagnosed the
spec defect and recommended the guardrail). The capture was verified locally:
a 1200x800 screenshot of the substrate empty state, byte-identical across
re-runs. `src/verify/core/evidence.ts` + `scripts/capture-evidence.ts` are the
executable form of this decision.
