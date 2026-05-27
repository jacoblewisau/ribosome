# CLAUDE.md — Ribosome

This file is loaded into every Claude Code session in this repository. Keep it
between 100 and 300 lines. Every rule below has a reason behind it (often a
mistake that already happened). Prune as often as you add.

If anything in this file contradicts the plan, the plan wins. Plan lives at
`/Users/jacobl/research/software-factory/PLAN.md`.

---

## Identity

Ribosome is a Claude Code workflow that ships features from a GitHub Issue to
a merged PR. It is built for two operators with different needs.

- **Operator (non coder).** Interacts only through the GitHub UI: Issues,
  comments, PR merges. Never the CLI. Never `.claude/` files. The full
  operator surface is documented in `OPERATOR.md`.
- **Maintainer.** Edits this file, the agents, the skills, the hooks, the
  eval harness. Reads the plan first when in doubt.

The name is from the molecular machine that reads an instruction (mRNA) and
synthesises a new working object (a protein). Issues are the mRNA. PRs are
the product. Each subagent and skill in this repo has a ribosomal analogue
documented in the metaphor table at the top of `PLAN.md`. The analogue is
documentation, not branding; file names stay functional (`builder.md`, not
`large-subunit.md`) so a new maintainer can navigate without a biology
degree.

Current phase: 0 (foundations). What is wired: this file, `OPERATOR.md`,
`.claude/` skeleton, the `block-secrets` pre-commit hook. What is not wired:
any agent body, any skill body, any GitHub workflow, any memory store, any
eval. See `PLAN.md` §12 for the phase plan.

---

## Stack

To be decided. Likely candidates depending on the first real feature:

- Runtime: Node 22 plus Bun, or pure Node, or Python. Pick once at Phase 1.
- Web framework: Next.js App Router, or Vite plus React, or Remix.
- Data: Postgres plus Prisma, or Supabase, or SQLite for early phases.
- Background jobs: BullMQ on Redis, or a managed queue.
- Test: Vitest plus Playwright (for acceptance and screenshots).
- Lint and types: Biome or ESLint plus tsc strict.

When the stack lands, replace this section with the concrete choices and
the commands below. Until then, treat any stack-coupled discussion as
hypothetical.

---

## Commands

Phase 0 commands only. Updated each phase.

```
# install the local git hooks (one time per clone)
git config core.hooksPath .claude/hooks

# verify the hook is wired
git config --get core.hooksPath
# expected output: .claude/hooks

# manually run the secrets check against the current index
.claude/hooks/block-secrets.sh
```

Stack-specific commands (test, build, dev, typecheck, migrate) get added in
Phase 1 once the stack is chosen.

---

## Architecture rules

From `PLAN.md` §3. These are the principles every agent, skill, and hook in
Ribosome must respect. They are short on purpose. Long-form reasoning lives
in the plan.

1. **Skill before agent before pipeline.** Do not reach for a subagent when
   a skill suffices. Do not build a pipeline when a coordinator suffices.
   Smell test: if the output is one number, it is not a subagent.
2. **Read only by default.** Any step that can be read only must be. Write
   access is a privilege, granted per path glob, enforced by hook.
3. **Clean context windows are a feature.** The reason to spawn a subagent
   is to isolate context, not to look modular.
4. **Machine readable contracts beat prose review.** Components, APIs, and
   jobs declare fixtures, invariants, and observable outputs. The validator
   reads the contract output, not the source.
5. **CLAUDE.md is bounded and earned.** 100 to 300 lines. Every rule has a
   story behind it. Prune as often as you add.
6. **Three human gates, not seven.** Story approval, spec approval, PR
   merge. Everything else runs.
7. **Idempotent setup.** Re-running setup is safe. Agents and skills
   register without duplication.
8. **Eval the system, not the prompt.** A scored task suite gates changes
   to any agent or skill.
9. **Persistent lessons, not persistent transcripts.** Two tier memory:
   live store mounted per session, distilled store written only by the
   Dreaming pass. Raw history is consumed and discarded.
10. **Hooks are guardrails, not features.** Fail loud, never silently
    rewrite. The user can always bypass with `--no-verify`; do not try to
    out-clever them.
11. **`package.json` is implicitly in scope when the build commands
    themselves need to change.** When a feature requires a new test
    script, a new dependency entry (rare; requires spec approval), or a
    flag adjustment on an existing script, the builder may edit
    `package.json` even if the spec did not list it. The spec-writer
    should add `package.json` to `scope_paths` whenever a script edit is
    foreseeable. Earned 2026-05-27 from feature 0001 validator finding.

---

## Prose conventions for Ribosome outputs

These rules apply to every artefact Ribosome produces that a human reads:
PR bodies, Issue comments from the bot, generated stories, generated specs,
generated documentation, validator reports, digest Issues.

- **No en or em dashes.** Use commas, parens, colons, or restructure. The
  ASCII hyphen-minus is allowed in compound nouns (`tenant-aware`) and in
  command flags (`--no-verify`).
- **No emoji.** Not in PR bodies, not in Issue comments, not in code
  comments, not in commit messages, not in any generated documentation.
- **Primary-source verification.** Do not state specific facts about
  third-party libraries, APIs, papers, or services with authority unless
  verified from the primary source in this session. Mark inferences and
  paraphrases as such. "I do not know" is a first-class answer. Better to
  ask the operator than to fabricate.
- **First principles, not mediocre precedent.** When the plan, this file,
  or an established pattern in the repo is wrong, say so and propose the
  fix. Do not defer to the existing thing just because it exists. The
  upgrade path is a PR against this file or against the plan.
- **Plain language with the operator.** OPERATOR.md is the contract: six
  slash commands, three gates, three Issue templates. Do not invent new
  surface in operator-facing text.

---

## Do not do

The list of things that have caused or would cause real harm. Each is a hard
rule, not a guideline.

- **No `git commit --amend`** after a pre-commit hook failure. The commit
  did not happen. Amending would modify the previous commit. Create a new
  commit instead.
- **No `--no-verify` from any agent.** The operator may bypass for one
  commit when certain. Agents never bypass.
- **No `git add -A` or `git add .`.** Stage specific paths by name. The
  hook is a backstop, not the gate.
- **No `git push --force` to main, ever.** Force push to feature branches
  is allowed when the branch is clearly owned by Ribosome and not shared.
- **No interactive git flags** (`-i`, `--interactive`). Never callable from
  an automated path.
- **No writes to `.claude/memory/distilled/`** from any agent or session
  except the Dreaming job. Distilled is trustworthy only because the write
  surface is one process.
- **No edits to CLAUDE.md from an agent.** Only `rule-miner` opens a PR
  against this file, and the operator merges. Agents do not self-modify
  their own guardrails.
- **No fabricated citations or screenshots.** If a screenshot would be
  helpful and one cannot be produced, say so. Do not invent a path that
  does not exist.
- **No new dependencies** without an explicit operator-approved spec entry.
  Dep bumps go through the `dep-scanner` scout and the standard chain.
- **No secrets in any file the hook checks.** If the hook fails, fix the
  cause; do not bypass and recommit.

---

## Hook installation

The pre-commit guard lives at `.claude/hooks/pre-commit` and delegates to
`.claude/hooks/block-secrets.sh`. Git is wired to use it via
`core.hooksPath`. This survives clones because the hook scripts are
committed in the repo, but the `core.hooksPath` config is per-clone and
must be set once after cloning.

One-time install:

```
git config core.hooksPath .claude/hooks
```

Verification:

```
git config --get core.hooksPath   # expects: .claude/hooks
.claude/hooks/block-secrets.sh    # exits 0 on a clean index
```

Acceptance test (Phase 0 done criterion):

```
echo 'AWS_SECRET_ACCESS_KEY=AKIAFAKETESTKEY' > .env
git add .env
git commit -m "test"   # rejected with: filename  .env  (matches .env)
git restore --staged .env
rm .env
```

The hook covers:

- **Filenames.** `.env` (and `.env.<anything>` except `.example`, `.sample`,
  `.template`, `.dist`), `*.key`, `*.pem`, `secrets.*`.
- **Content.** AWS access key id (`AKIA` plus 16 alphanumerics), GitHub
  classic PAT (`ghp_` plus 36 alphanumerics), GitHub fine-grained PAT
  (`github_pat_` plus 82 chars), Anthropic API key (`sk-ant-` plus 32 or
  more chars).

Both layers run on every commit. A violation in either layer rejects the
commit. To bypass for a single commit (operator only, when certain):
`git commit --no-verify`.

---

## Pointers

- `OPERATOR.md` is the full non-coder surface. If a question is about how
  to use Ribosome from the GitHub UI, the answer is in there.
- `/Users/jacobl/research/software-factory/PLAN.md` is the design document.
  Read it before changing anything in `.claude/`.
- `.claude/memory/ACCESS.md` is the per-agent memory access matrix.

---

## When this file changes

Append the date and a one-line reason to a CHANGELOG comment at the bottom
of this file when you edit. Keep the file under 300 lines; if you add a
section, prune another or split into a linked doc.
