# Goal: Conflict-free STATE.md (the shared-file merge problem)

Loaded by a maintainer who hit the bug. This is the spec'd plan: the problem,
the diagnosis grounded in the live repo, the external research that challenged
the obvious fix, the settled decision, what shipped (the tracer bullet), and the
remaining hardening slices.

Provenance: session 6 (2026-06-02), after several scout-generated PRs rewrote
`STATE.md` overnight and all conflicted.

---

## The problem, stated honestly

CLAUDE.md rule 15 required every landed change to update `STATE.md` in the same
PR. `STATE.md` is therefore a single hot file that every PR rewrites. Two PRs
editing the same file conflict; N concurrent PRs conflict pairwise. This is the
classic shared-changelog merge problem, and Ribosome's scouts make it acute:
they file Issues in batches (dep-scanner, doc-drift) that fan out into several
chains, each producing a PR that rewrites `STATE.md`.

## Diagnosis (grounded in the live repo, 2026-06-02)

- Open PRs at the time: zero, but five scout Issues (#27 dep bumps, #28-#31
  doc-drift) were queued, each of which would produce a `STATE.md`-rewriting PR.
- The closed-PR history already showed the manual conflict dance, so this is
  structural, not a one-off:
  - PR #24: "No CHANGELOG line here on purpose, it would conflict with PR #23's
    changelog edit; I will add one consolidated entry once both merge."
  - PR #25 existed only to reconcile #23 and #24's changelog edits.
  - PRs #22, #18 were standalone `STATE.md` refreshes.

So `STATE.md` (and the CLAUDE.md changelog block) is a recurring conflict source,
and rule 15 institutionalised it.

## The research that challenged the obvious fix

The tempting one-liner is `.gitattributes` `merge=union`, which concatenates both
sides of a conflict instead of failing. It was ruled out for Ribosome:

- **GitHub's web/API merge does not honor user-defined merge drivers.**
  `merge=union` works only for local merges. Ribosome merges via the GitHub UI
  (the operator's gate-3 Merge button) and the API, so `merge=union` would not
  prevent the conflicts that actually block us. It is kept only as local
  defense-in-depth.

The robust, widely-adopted answer is the **news-fragment / changeset pattern**
(Towncrier, Changesets; adopted by GitLab, Prefect, tox, black, scikit-learn):
instead of editing one shared file, each change writes a uniquely named fragment
in a directory, and the shared doc is assembled from fragments. Two PRs adding
different fragments never touch the same file, so they never conflict. The fit is
exact: every Ribosome chain already has a unique `<id>`.

## The principle and the one subtlety

Decouple the two kinds of content in `STATE.md`:

- **The shipped log** (what each change did) is append-only and high-churn. This
  is where the conflicts lived. It becomes per-change fragments, never a shared
  edit.
- **The curated head** (what is true now, open work, what-not-to-do, pointers)
  is small, narrative, and changes deliberately. It stays a single file
  (`state.d/0000-current.md`), edited rarely and on purpose. If two PRs both edit
  the head they can still conflict, but that is rare and meaningful, not the
  every-PR churn the log caused.

The subtlety: a committed, generated `STATE.md` would itself reconflict if every
PR rebuilt it (two PRs each regenerate it with their own fragment included). So
the rule is: **feature PRs add a fragment and do NOT rebuild `STATE.md`.** The
rebuild is serial (maintainer, the dream pass, or session start), so the
generated file has exactly one writer at a time and never conflicts. `STATE.md`
stays committed (a fresh clone and the GitHub web view still show it), but it may
lag the newest fragments between serial rebuilds; the fragments are the
authoritative record and `npm run state:build` makes the view current.

## What shipped (the tracer bullet)

Implemented, tested, and verified in this change:

- `state.d/` with the curated head `0000-current.md`, a `README.md` documenting
  the pattern, and seed log fragments (session 5; this change).
- `src/state/build.ts`: a pure assembler (dir in, string out), unit-tested for
  determinism and newest-first ordering (`src/state/build.test.ts`, 6 tests).
- `scripts/state-build.ts` and `npm run state:build` (with `--check` for CI use).
- `STATE.md` regenerated, carrying a generated-file banner so it is not
  hand-edited.
- `.gitattributes` with `STATE.md merge=union` as local defense-in-depth, with
  the GitHub-UI caveat documented inline.
- CLAUDE.md rule 15 reworded: record a fragment, never edit `STATE.md` directly.
  (A CLAUDE.md change, so left for the operator to merge.)
- Eval invariants R15 (mechanism present), T18 (generated banner + rule 15 points
  at the fragment), TR16 (merge=union present, head is not the only fragment).
  Suite 41 -> 44; unit tests 52 -> 58.

## Remaining slices (hardening)

### Slice 2: enforce it in CI

Add a check (in `checks.yml`) that a feature PR does not edit `STATE.md`
directly: it must add a `state.d/` fragment instead. This turns the practice into
a guarantee, so a future producer that forgets cannot reintroduce the conflict.
Must exempt the serial rebuild commit. The mechanical shape: compare the PR diff
against the base; fail if `STATE.md` is modified outside a recognised rebuild.

### Slice 3: rebuild at the right serial moments

Wire `npm run state:build` into the moments that are naturally serial so the
committed `STATE.md` does not drift: a SessionStart hook for web sessions (the
`session-start-hook` skill), and/or the dream pass (which already regenerates
`MEMORY.md`). Decide then whether `STATE.md` should remain committed or become a
pure build artifact materialised at session start.

## Decisions (settled session 6, maintainer)

- Mechanism: **news-fragment pattern**, `STATE.md` generated from `state.d/`.
- `merge=union` is kept as local defense-in-depth only; it is not the fix,
  because GitHub-UI merges ignore it.
- Feature PRs add a fragment and do **not** rebuild `STATE.md`; the rebuild is
  serial.
- The curated head is one deliberately-edited file; only the high-churn shipped
  log is fragmented.

## What not to do (guardrails to preserve)

- Do not edit `STATE.md` by hand; it is generated.
- Do not rebuild and commit `STATE.md` inside a feature PR; that reintroduces the
  conflict on the generated file.
- Do not rely on `merge=union` as the fix; GitHub-UI merges ignore it.
- Do not move the curated head content back into the per-PR path.

## Sources

Verified or near-primary in session 6: GitLab "solving our CHANGELOG conflict
crisis" and Towncrier / Changesets writeups (news-fragment pattern); git
`gitattributes` docs and the GitHub community discussion confirming GitHub's
merge does not honor user-defined `merge=union` drivers; the live repo's own
closed PRs #23/#24/#25 as primary evidence of the conflict dance.
