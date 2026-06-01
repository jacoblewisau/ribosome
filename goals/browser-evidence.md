# Goal: Browser evidence, judged against the story

Loaded by a maintainer designing the visual-verification layer. This doc is the
spec'd plan: the problem, the external research that challenged the obvious
approach, the settled decisions, and the slices (tracer bullet first). It is not
yet built. Adding the browser dependency goes through a gate (see Slice 1).

Provenance: session 6 (2026-06-01), after a focused web-research pass that
challenged the first-draft recommendation (raw Playwright + commit screenshots,
gate on a text snapshot).

---

## The problem, stated honestly

Ribosome builds web apps but never looks at them in a browser. The verify
harness runs Vitest against `src/verify/matrix.test.ts` with happy-dom, which is
a DOM emulation, not a real browser: CSS layout, real fonts, and canvas are not
faithful, and there is no picture. Two artefacts already promise more than the
machine delivers:

- `OPERATOR.md` gate 3 tells the operator the PR "contains screenshots of every
  screen that changed."
- `pr-shepherd.md` explicitly defers them ("You do not include screenshots or
  visual diffs in this Phase 3 implementation").
- `verify-contracts/SKILL.md` files Playwright screenshots as a future
  deliverable.

So there is a real capability gap and a documentation inconsistency to close in
the same work. The goal: make Ribosome render the built app in a real browser,
judge it, and save durable evidence in git so it lands in the PR the operator
reviews.

## The research that changed the first answer

The obvious design was: drive Playwright, screenshot each changed screen, and
gate on a deterministic text snapshot (treating the PNG as illustrative because
"binaries in git are noisy and pixel diffs are flaky"). External research
challenged that on two fronts, both verified from primary or near-primary
sources.

1. **Committing screenshots to git and gating on pixel diffs is the mainstream
   robust pattern, not an anti-pattern, at this scale.** Playwright's own docs:
   "You should commit this directory to your version control (e.g. `git`), and
   review any changes to it." Flakiness is handled with a pixelmatch tolerance
   (`maxDiffPixels`) and a `stylePath` stylesheet to "filter out dynamic or
   volatile elements," with baselines generated in the CI container. Baselines
   are platform-specific in their filenames (`name-chromium-linux.png`), which
   is normally a cross-platform headache, but Ribosome only runs in ubuntu CI,
   so that headache does not exist here. Industry consensus matches: store
   baselines in git for small projects, cloud for large. Ribosome is small. The
   first draft over-corrected against pixels.

2. **The LLM-native option was missing, and it fits the non-coder operator
   better.** Pixel-diff visual regression has a workflow assumption: a human
   reviews and blesses every baseline update. Ribosome's operator cannot judge
   whether a pixel diff is an intended change. A vision-capable Claude can
   instead judge the screenshot against the story's acceptance criteria in plain
   language. Reported judge-vs-human agreement is around 85% (higher than two
   humans agree with each other), and multimodal judges are used to verify that
   a GUI faithfully implements textual requirements. Ribosome's validator is
   already a Claude agent that writes severity-grouped findings, so this is
   wiring, not a new dependency.

Rejected for Ribosome specifically:

- **shot-scraper** (simonw): the simplest "screenshot a URL, keep git history,
  `--fail` in CI" tool, but it is Python built on Playwright. Adding a Python
  toolchain to a Node repo is not simpler here; native Playwright (Node) wins.
- **reg-suit / Chromatic / Percy / Argos / Lost Pixel:** the scale-out answer
  (baselines in S3/GCS or a SaaS, repos stay light). Each adds an external
  service and solves a repo-bloat problem Ribosome does not have. Name them as
  the revisit-if-it-grows path; do not adopt now.

## The principle: judge against criteria, regress against pixels

The two approaches are complementary, split by what is being checked:

- **A new screen (a fresh feature).** There is no prior baseline to diff, so
  pixel-diff has nothing to do. A vision-judge against the acceptance criteria is
  the natural fit and matches what the operator cares about: "does this screen do
  what the story said?" This is the primary gate.
- **A shipped screen (regression).** Pixel-diff baselines are exactly right and
  deterministic: catch unintended visual drift on a screen that already passed.
  This is the secondary, deterministic backstop.

Capture once, judge primary, diff secondary. The judge's non-determinism is
managed by binding it to explicit, written criteria and committing its verdict as
evidence (auditable), and by keeping the deterministic pixel-diff as the machine
backstop for shipped screens.

## What the evidence is, and where it lives

Per declared scene, committed under `evidence/<id>/` on the `ribosome/<id>`
branch (so it lands in the PR diff and is durable):

- `<scene>.png`: the screenshot (the picture the operator sees in the PR).
- `<scene>.snapshot.txt`: the accessibility-tree / visible-text serialization
  (a clean, diffable textual record alongside the binary).
- The validator's per-criterion verdict, written into its report (the judgment,
  bound to the story).

`evidence/<id>/` is added to the spec's `scope_paths` so the builder may write it.
One folder per chain id, so committed PNGs do not churn across features.

## Where it plugs into Ribosome

A step, not an agent (rule 1: mechanical capture, judgment folded into the
existing validator). It reuses the existing surfaces rather than adding parallel
machinery:

- **Scene declaration is a contract** (rule 4). A VerifiableUnit gains an
  optional `scenes` field: named render states plus the route to visit. No prose
  review of UI; the contract says what to capture.
- **The canonical report carries the evidence.** `tests/verify/last-run.json`
  (schema `ribosome.verify.report`) gains an additive `evidence: [{ scene,
  route, png, snapshot }]` array. Additive, so the schema version bump is a
  superset; the validator already reads this file.
- **The validator does the judging.** It already reads story + spec + report and
  writes severity-grouped findings; it now also receives the screenshots and
  judges each against the acceptance criteria, emitting a per-criterion verdict.
- **pr-shepherd embeds the PNGs** in the PR body, honoring the OPERATOR.md
  promise at last.

## Slices (tracer bullet first)

### Slice 1 (tracer bullet): one screen, captured, committed, judged

The smallest end-to-end path. Stand up `vite build` + preview in CI, drive
Playwright headless Chromium to one hard-coded route, capture one `<scene>.png`
plus its `<scene>.snapshot.txt`, commit both under `evidence/<id>/`, and have the
validator vision-judge that one screenshot against one acceptance criterion and
write the verdict into its report.

This is the slice where the **Playwright dependency enters**, so per CLAUDE.md
("No new dependencies without an operator-approved spec entry; dep bumps go
through the dep-scanner scout and the chain") this slice carries the dependency
decision: an ADR proposing Playwright (Node, Chromium-only, installed in CI via
`npx playwright install --with-deps chromium`), reviewed at the gate before any
install. Determinism rules baked in from the start: fixed viewport, animations
and transitions disabled, frozen clock (reuse the repo's local-noon date
convention), seeded randomness, explicit ready-wait (never a sleep).

Eval invariant added: the verify report schema includes the `evidence` array and
the validator prompt carries the "judge each screenshot against the acceptance
criteria" instruction.

### Slice 2: scenes as a contract, all changed screens, PR embedding

Generalize from the hard-coded route. A VerifiableUnit declares `scenes`; the
capture step iterates every declared scene of every changed unit; the report's
`evidence` array carries them all; pr-shepherd embeds the PNGs in the PR body and
the validator judges each. Reconcile the documentation inconsistency here: either
the promise in OPERATOR.md gate 3 is now true, or its wording is corrected to
match exactly what ships.

Eval invariant: pr-shepherd references the evidence array; the scene contract is
documented in verify-contracts.

### Slice 3: deterministic pixel-diff backstop for shipped screens

Add Playwright `toHaveScreenshot` regression for screens that already shipped: a
committed baseline (generated in the ubuntu CI container), pixelmatch tolerance
(`maxDiffPixels`), and a `stylePath` stylesheet masking dynamic regions. A diff
beyond tolerance is a deterministic finding the validator surfaces. New screens
have no baseline and are judged only; shipped screens get both gates.

Eval invariant: the regression config (tolerance + masking + CI-generated
baseline) is present and the baseline directory is committed.

## Decisions (settled session 6, maintainer)

- Gate model: **vision-judge primary, pixel-diff backstop.** Judge new screens
  against criteria; pixel-diff shipped screens for regression.
- Evidence lives **in git** under `evidence/<id>/` (PNG + text snapshot), one
  folder per chain. Endorsed for this scale by primary sources; revisit only if
  the repo bloats, at which point artifacts or object storage is the path.
- Browser is **Playwright, Node, Chromium-only, ubuntu CI**. Single platform, so
  no cross-platform baseline matrix. Dependency adoption is gated in Slice 1.
- The judge's non-determinism is **bound and audited**: explicit criteria in, a
  written verdict committed as evidence out, with the deterministic pixel-diff as
  the machine backstop.

## What not to do (guardrails to preserve)

- Do not install Playwright before the Slice 1 dependency gate is approved.
- Do not make the pixel-diff the primary gate for a new screen: there is no
  baseline, and it would force the non-coder operator to bless a diff he cannot
  judge.
- Do not store evidence outside `evidence/<id>/` or use `git add -A` to stage it
  (stage paths by name, per CLAUDE.md).
- Do not adopt a SaaS visual-testing service to start; it adds an external
  dependency Ribosome's scale does not need.
- Do not leave the OPERATOR.md / pr-shepherd screenshot inconsistency standing:
  Slice 2 either makes the promise true or corrects the wording.

## Sources

Verified or near-primary in session 6: Playwright visual comparisons docs
(commit-to-git, OS-specific baselines, pixelmatch / `maxDiffPixels`, `stylePath`
masking); Lost Pixel and Bug0 2026 surveys (store in git for small projects,
reg-suit S3/GCS, SaaS comparison); LLM-as-a-judge guides (Evidently, UW CSE503
"Using Vision LLMs for UI Testing", ~85% judge-human agreement); shot-scraper
(Python, built on Playwright).
