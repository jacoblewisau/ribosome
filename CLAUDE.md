# CLAUDE.md — Ribosome

Loaded into every Claude Code session in this repository. Every rule earned its
place (most from a mistake that already happened). Prune as often as you add.
Target length: 100 to 300 lines.

When this file contradicts the plan, the plan wins. Plan is at
`/Users/jacobl/research/software-factory/PLAN.md` (maintainer-local; future
iteration may move it into the repo).

---

## Identity

Ribosome is a Claude Code workflow that ships features from a GitHub Issue
to a merged PR. Two operator profiles use this repo with different needs:

- **Operator (non coder).** GitHub UI only: Issues, comments, PR merges. Never
  the CLI, never `.claude/` files. Their surface is `OPERATOR.md`.
- **Maintainer.** Edits this file, the agents, the skills, the hooks. Reads
  the plan before changing anything substantive.

The name is from the molecular machine that reads an instruction (mRNA) and
synthesises a working object (a protein). Issues are the mRNA, PRs are the
product. The metaphor is documentation, not branding; file names stay
functional (`builder.md`, not `large-subunit.md`).

**Phases shipped:** 0 (foundations), 1 (chain), 2 (verify schema), 2.5 (live
memory), 3 (GitHub workflow), 4 (proactive scouts), 4.5 (dream + distilled),
5 (eval harness, structural), 6 (enforcement hooks).
**Phases remaining:** none. Open work is incremental, tracked in STATE.md
(notably behavioural eval mode, the live-run counterpart to the structural suite).

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node 22 (`engines` in package.json), bash 3.2+ for hooks |
| UI substrate | Vite + React 19 + TypeScript strict |
| Test runner | Vitest with happy-dom |
| Verifier matrix | `src/verify/` (custom; emits canonical JSON for the validator) |
| Schema validation | Zod (props on every VerifiableUnit) |
| Date / timezone | Local-noon convention for `<input type="date">` |
| GitHub automation | `anthropics/claude-code-action@v1`, opus-4-8 default (TR10) |

---

## Commands

```
# install local git hooks (one time per clone)
git config core.hooksPath .claude/hooks

# verify GitHub setup is complete (idempotent)
npm run setup:check

# tests
npm run typecheck        # tsc -b --noEmit
npm test                 # vitest unit + chain + hook tests (52 currently)
npm run verify           # verifier matrix; writes tests/verify/last-run.json

# chain inspection (maintainer only; the operator uses GitHub)
npm run chain:list                      # every chain on disk
npm run chain:show <id>                 # detail for one chain
npm run dream:show                      # latest distilled store summary
npm run dream:forget <id> [reason]      # remove a distilled item
npm run dream:decay [--days N] [--floor F]  # decay or purge stale items
npm run memory:snapshot                 # opt-in: commit memory for audit
```

Stack-specific commands inside the substrate (`npm run dev`, `npm run build`)
are runnable but not part of the chain.

---

## Architecture rules

From `PLAN.md` §3 plus four rules earned in production. Grouped by topic for
maintainability; the numbers are stable (do not renumber when adding).

### Decomposition

1. **Skill before agent before pipeline.** Do not reach for a subagent when
   a skill suffices. Do not build a pipeline when a coordinator suffices.
   Smell test: if the output is one number, it is not a subagent.
3. **Clean context windows are a feature.** The reason to spawn a subagent
   is to isolate context, not to look modular.

### Verification

4. **Machine readable contracts beat prose review.** Components, APIs, and
   jobs declare fixtures, invariants, and observable outputs. The validator
   reads the contract output, not the source.
8. **Eval the system, not the prompt.** A scored task suite gates changes
   to any agent or skill (Phase 5 wires this).

### Process

5. **CLAUDE.md is bounded and earned.** 100 to 300 lines. Every rule has a
   story behind it. Prune as often as you add.
6. **Three human gates, not seven.** Story approval, spec approval, PR
   merge. Everything else runs.
7. **Idempotent setup.** Re-running setup is safe. Agents and skills
   register without duplication.
15. **STATE.md is updated as part of done, not on request.** The session
   handoff doc (`STATE.md`) is the next session's starting context. Any change
   that lands updates it in the same PR: eval and test counts, what shipped,
   open work, what-not-to-do. Do not end a unit of work by asking the operator
   whether to refresh it. Earned 2026-05-30: STATE.md repeatedly went stale
   (wrong eval count, "slice 3 remains" after it had shipped) because it was
   treated as an optional epilogue and surfaced as a question.

### Memory

9. **Persistent lessons, not persistent transcripts.** Two tier memory:
   live store per session, distilled store written only by the Dreaming
   pass. Raw history is consumed and discarded.
12. **Memory state is filesystem by default, committed by explicit opt-in.**
    `.claude/memory/live/` and `.claude/memory/distilled/` are gitignored.
    `npm run memory:snapshot` copies the current state into
    `memory-snapshots/<timestamp>/` and commits the copy.
14. **Chain state lives at `.claude/memory/live/<id>/` with a fixed layout.**
    `chain.json` (state machine, version `"1"`), `<role>.md` (final
    reports), `<role>.inflight.md` (resumption notes). A role is "mid-run"
    when its `.inflight.md` is newer than its `.md`; the validator returns
    BLOCKED in that case. Helper at `src/chain/state.ts`.

### Guardrails

2. **Read only by default.** Any step that can be read only must be. Write
   access is a privilege granted per path glob and enforced by the
   `enforce-scope` PreToolUse hook (Phase 6).
10. **Hooks fail loud, never silently rewrite.** A blocked operation prints
    actionable stderr and exits non-zero. The user can always bypass with
    `--no-verify`; do not try to out-clever them.

### Scope (earned in production)

11. **`package.json` is implicitly in scope when build commands need to
    change.** Earned 2026-05-27 from feature 0001: builder needed
    `--passWithNoTests` on `npm test` but `package.json` was not in
    `scope_paths`. Spec-writer should now anticipate script edits.
13. **Importers of a changed interface are implicitly in scope.** When a
    feature changes a unit's exported type (required prop added, signature
    changed, union member added), every importing file is in scope. Earned
    2026-05-27 from feature 0003: `TodoStats` gained a required `overdue`
    prop; `TodoStats.verify.ts` had to be edited but was not listed.

---

## Prose conventions for Ribosome outputs

Apply to every artefact a human reads: PR bodies, Issue comments from the
bot, generated stories and specs, validator reports, digests.

- **No en or em dashes.** Use commas, parens, colons, or restructure.
  Hyphens are fine in compound nouns and command flags.
- **No emoji.** Anywhere. Including code comments and commit messages.
- **Primary-source verification.** Do not state facts about third-party
  libraries, APIs, or services with authority unless verified from the
  primary source in this session. Mark inferences as such. "I do not
  know" is a first-class answer.
- **First principles, not mediocre precedent.** When the plan, this file,
  or a repo pattern is wrong, say so and propose a fix. The upgrade path
  is a PR; do not silently work around.
- **Plain language with the operator.** OPERATOR.md is the contract: six
  slash commands, three gates, four Issue templates (Feature, Bug, Tweak,
  Project). Do not invent new surface in operator-facing text.

---

## Do not do

Hard rules. Each has caused real harm or would cause real harm.

- **No `git commit --amend`** after a pre-commit hook failure. The commit
  did not happen; amending modifies the previous commit. Create a new
  commit.
- **No `--no-verify` from any agent.** The operator may bypass for one
  commit when certain. Agents never bypass.
- **No `git add -A` or `git add .`.** Stage specific paths by name.
- **No `git push --force` to main, ever.** Force push to feature branches
  is allowed when the branch is clearly owned by Ribosome.
- **No interactive git flags** (`-i`). Never callable from automation.
- **No writes to `.claude/memory/distilled/`** from anyone except the
  Dreaming job. Enforced by the `enforce-distilled-write` hook plus the
  `.claude/memory/.dream-active` marker convention.
- **No edits to CLAUDE.md from an agent.** Only `rule-miner` opens a PR
  against this file; the operator merges. Agents do not self-modify their
  guardrails.
- **No fabricated citations or screenshots.** If you cannot produce one,
  say so.
- **No new dependencies** without an operator-approved spec entry. Dep
  bumps go through the `dep-scanner` scout (Phase 4) and the chain.

---

## Hooks installed in this repo

| Hook | Trigger | What it does |
|---|---|---|
| `pre-commit` (git) -> `block-secrets.sh` | every `git commit` | rejects `.env`, `*.key`, `*.pem`, `secrets.*` and content matching AWS / GitHub PAT / Anthropic key regexes |
| `enforce-scope.sh` (Claude Code PreToolUse) | `Write` / `Edit` / `MultiEdit` during builder runs | rejects writes outside the active spec's `scope_paths`; exits 2 with the active chain id and the allowed paths in stderr |
| `enforce-distilled-write.sh` (Claude Code PreToolUse) | `Write` / `Edit` / `MultiEdit` targeting `.claude/memory/distilled/**` | allowed only when `.claude/memory/.dream-active` marker file exists; the `dream` skill manages the marker |
| `record-correction.sh` (CLI, not a Claude Code hook) | invoked by coordinator on `/changes` | appends a structured JSON line to `.claude/corrections.jsonl` for the rule-miner to consume |

Git hooks install with `git config core.hooksPath .claude/hooks` (run once per
clone). Claude Code hooks register via `.claude/settings.json` and load on
session start. Acceptance evidence for each hook is in `src/chain/hooks.test.ts`
(28 tests cover the matrix).

---

## Pointers

- `OPERATOR.md`: non-coder surface (two pages).
- `.claude/skills/setup/SKILL.md`: maintainer-facing GitHub bootstrap walkthrough.
- `.claude/memory/ACCESS.md`: per-agent memory write permissions.
- `.claude/skills/verify-contracts/SKILL.md`: contract authoring conventions.
- `tests/verify/last-run.json`: canonical verifier report (schema
  `ribosome.verify.report`, version `"1"`).
- `/Users/jacobl/research/software-factory/PLAN.md`: design document.

---

## When this file changes

Append the date and a one-line reason as a comment at the bottom. Keep the file
under 300 lines; if you add a section, prune another or split into a linked doc.
Numbered rules keep their numbers forever; new rules append at the next
unused number rather than renumbering. Deletions leave the number gap.

<!--
CHANGELOG
2026-05-28: Phase 6 pass. Rules grouped by topic. Stack section concretized.
            Commands section now lists all npm scripts. Hooks table replaces
            the prior Phase 0 hook-install section. Identity reflects shipped
            phases (0/1/2/2.5/3/4.5/6). Length: ~230 lines.
2026-05-30: Added Process rule 15 (STATE.md is updated as part of done).
            Length: ~240 lines.
-->
