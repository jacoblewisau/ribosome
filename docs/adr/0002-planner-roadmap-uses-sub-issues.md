# 0002. The planner roadmap uses native GitHub sub-issues

- Status: accepted
- Altitude: system-wide
- Decided: 2026-05-30
- Decided by: maintainer (design), session 5, via a prototype comparison

## Context

Slice 2 adds the planner, which decomposes a Project Issue into a sequence of
child Feature Issues and must link those children to the parent so the operator
sees one roadmap. Three mechanisms were compared, grounded in GitHub's current
primary docs: a markdown task list in the parent, native sub-issues, and a
separate `plans/<id>.md` document the parent links to.

## Decision

The parent Project Issue tracks its children as native GitHub sub-issues. The
planner creates each child with `gh issue create`, reads the child's integer id
(`gh api repos/{owner}/{repo}/issues/{n} --jq .id`), then calls
`POST /repos/{owner}/{repo}/issues/{parent}/sub_issues` with `sub_issue_id`. The
call retries once; on persistent failure it falls back to appending a `- [ ] #n`
task-list line to the parent body so the parent-child link is never silently
lost.

## Alternatives considered

- Markdown task list in the parent. Simpler and more robust (no API; closing a
  child auto-ticks it), but no native progress bar or Project sub-issue fields.
  Chosen against for the weaker operator-facing roadmap, but kept as the failure
  fallback above.
- Separate `plans/<id>.md` document. Most format control and versioned, but the
  operator looks in two places and the parent-child link is not native.

## Consequences

Makes easy: a single native roadmap view with a progress bar and Project
sub-issue fields, all inside the one Issue the operator already has open. Makes
hard: the bot must use the sub-issues REST endpoint (the child's id, not its
number; same repository owner only), the gh CLI cannot set a parent directly,
and the endpoint has reported flakiness, so the planner carries retry-plus-
fallback logic. Commits us to: that fallback path, and a structural invariant
(slice 2) asserting both the sub-issue call and the task-list fallback stay
present. Revisit if: the sub-issues API remains flaky in practice, in which case
the task-list mechanism becomes primary.

## Sources

GitHub REST API for sub-issues; Adding sub-issues; About task lists; Issue Forms
syntax; cli/cli#10298 (gh cannot set a parent issue). Verified from primary docs
in session 5.
