# CONTEXT.md — Ribosome glossary

This is a glossary and nothing else. It records what domain terms mean in this
repository. It holds no implementation detail, no design, no decisions (those go
in `docs/adr/`), and no rules (those go in `CLAUDE.md`). When a term settles
during a chain run, record it here immediately rather than batching.

It is seeded with Ribosome's own terms and doubles as the template a target repo
starts from. See `.claude/skills/decision-records/SKILL.md` for the convention.

## Roles

- **Operator.** The person who drives Ribosome through GitHub alone (Issues,
  comments, PR merges). A domain expert who designs software but does not code.
- **Maintainer.** The person who edits the agents, skills, hooks, and this repo's
  internals. Reads the plan before changing anything substantive.

## The chain and its steps

- **Chain.** One run from a GitHub Issue to a merged pull request.
- **Gate.** A point where the chain pauses for the operator. There are three:
  approve the story, approve the spec, merge the PR.
- **Story.** A one-paragraph statement of what a feature is, with acceptance
  criteria. The first artefact the operator reviews.
- **Spec.** The technical brief that turns an approved story into something a
  builder can follow literally.
- **Coordinator.** The single entry point that decides the next chain step on
  each event and posts the operator-visible comment.
- **Researcher, story-writer, spec-writer, builder, validator, pr-shepherd.** The
  chain steps, in order. The first decodes the codebase; the last opens the PR.
- **Scout.** A scheduled agent that watches the repo (CI, coverage, deps, docs,
  PRs, memory) and opens Issues, rather than running inside a chain.

## Decisions and memory

- **ADR (architecture decision record).** A numbered record in `docs/adr/` of one
  decision, its rationale, alternatives, and consequences.
- **Context map.** The glossary layer. This file for a single-context repo; a
  root `CONTEXT-MAP.md` indexing per-context glossaries if the repo grows.
- **Hard memory.** `CLAUDE.md`. Standing rules. Changed only by rule-miner PR.
- **Distilled memory.** Lessons learned from past runs, written only by the
  Dreaming pass.
- **Live memory.** Per-chain working notes under `.claude/memory/live/<id>/`.

## The coaching protocol

- **Triage.** Sorting a decision into who should make it: the operator
  (depends on domain knowledge) or the agent (pure engineering).
- **Ask / Decide / Inform-only.** The three buckets a triaged decision lands in.
  Ask the operator; decide silently; or note a defaulted assumption in one line
  the operator can veto.
- **Translate to consequence.** Restating an engineering question as a
  consequence in the operator's world, so his judgment can decide it.

## Build vocabulary

- **Tracer bullet (vertical slice).** The smallest version of a feature that does
  one real thing end to end, built before the next slice is added.
- **Issue templates.** Feature, Bug, Tweak today; a Project template is planned
  for decomposing a large idea into sequenced Issues.
- **Contract / verifiable unit.** A component, API, or job that declares fixtures,
  invariants, and observable outputs the validator reads instead of the source.
