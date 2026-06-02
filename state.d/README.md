# state.d/ (how the session-handoff doc is assembled)

`STATE.md` at the repo root is **generated**. Do not edit it by hand. It is
assembled from the files in this directory by `npm run state:build`.

## Why

`STATE.md` used to be a single file that every landed change rewrote (CLAUDE.md
rule 15). Two PRs editing the same file always conflict, which is the classic
shared-changelog problem. Multiple scout-generated PRs overnight, each rewriting
`STATE.md`, made this acute. The fix is the news-fragment pattern (Towncrier /
Changesets): each change writes its own uniquely named file, so two changes
never touch the same file and never conflict.

`.gitattributes` also sets `STATE.md merge=union`, but that is only
defense-in-depth for local merges: GitHub's web/API merge does not honor
user-defined merge drivers, so the fragment pattern is what actually prevents
conflicts on GitHub.

## How to record a change

1. Add one file: `state.d/<id>-<slug>.md`, where `<id>` is the chain id
   (zero-padded, e.g. `0007`) or, for a maintainer change, the date
   (`YYYY-MM-DD`). Filenames sort lexically; the assembler lists newest first.
2. Write a short markdown block. Lead with a `### <date> - <title>` heading.
3. Do NOT edit `STATE.md` and do NOT rebuild it inside your PR. The rebuild is
   serial (maintainer, the dream pass, or session start), so feature PRs never
   collide on `STATE.md`.

The curated sections (what is true now, open work, what not to do, pointers)
live in `0000-current.md`. Edit that file directly when those change; it is the
one shared file here, changed deliberately and rarely, not by every chain.

## Regenerate

```
npm run state:build            # rewrite STATE.md from state.d/
npm run state:build -- --check # exit non-zero if STATE.md is stale (CI use)
```
