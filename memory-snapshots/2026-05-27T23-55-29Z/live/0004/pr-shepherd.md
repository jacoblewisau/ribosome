# PR-shepherd output (offline): feature 0004

This is the PR body the GitHub Actions workflow's pr-shepherd subagent
would post if a GitHub remote were configured for this repo. Since
there is no remote, the output is captured here for parity with what
the workflow would produce on a real run.

## What the PR command would do

```
git push -u origin ribosome/0004
gh pr create --draft --base main --head ribosome/0004 \
  --title "0004: edit-in-place for todo text" \
  --body-file /tmp/ribosome-pr-body.md \
  --label "ribo:auto-pr"
# validator clean, so:
gh pr ready
gh issue comment <issue-number> --body "Draft PR ready: <pr-url>"
```

## PR body (what would land in /tmp/ribosome-pr-body.md)

---

## What this PR does

This PR adds in-place editing for todo text. You can click the text of
any todo to start editing it. Press Enter to save. Press Escape, click
outside, or clear the input and press Enter to cancel. Existing tags,
due dates, and completion state are untouched by an edit.

## Files changed

- `src/features/todos/todos.feature.ts` (modified): new pure helper
  `setTodoText` that returns a new state with the matching todo's text
  replaced. Whitespace-only inputs are rejected (no-op).
- `src/features/todos/TodoItem.tsx` (modified): the text span is now
  clickable and focusable; clicking it (or pressing Enter while it has
  keyboard focus) opens an inline edit input pre-filled with the
  current text. Enter saves, Escape and blur cancel.
- `src/features/todos/TodoList.tsx` (modified): passes the new
  `onEditText` callback through to each TodoItem.
- `src/features/todos/TodoApp.tsx` (modified): wires `setTodoText`
  into the component tree.
- `src/verify/specs/TodoApp.verify.ts` (modified): five new contract
  fixtures covering the four success-path edit flows and one
  designed-to-fail probe asserting the editing flag is correctly
  exposed.
- `src/verify/specs/todos.feature.verify.ts` (modified): one new
  contract fixture exercising the pure `setTodoText` helper with
  five invariants (trim, whitespace rejection, unknown id, immutability
  of input state, reference-equality of non-touched items).

## Validator report

Status: clean.

Critical: none.
Important: none.
Minor: none.

Scope: 6 files modified, all within the spec's `scope_paths`. No
scope creep. (Compare to feature 0001 and feature 0003 which each had
one Important finding on the first validator pass; the rules earned
from those runs prevented a recurrence here.)

Contract verify: schema `ribosome.verify.report` version "1".
totals: { units: 3, fixtures: 28, pass: 22, fail: 0, blocked: 0,
skip: 0, probes: 6 }.

## Verify totals

| metric | value |
|---|---|
| total fixtures | 28 (+6 from this PR) |
| pass (non-probe) | 22 (+5) |
| probes | 6 (+1) |
| fail | 0 |
| blocked | 0 |
| skip | 0 |

## How to review

- If everything above looks right, click the Merge button.
- If something looks wrong, comment on the PR and the bot will respond.
- If you want to abandon this run entirely, comment `/cancel` on the
  originating Issue.

Closes #<issue-number>

---

## Operational notes for the maintainer

When the workflow runs this on a real remote:
- The branch `ribosome/0004` carries every commit the builder made.
- The PR is opened as `draft`, then marked `ready` because validator
  was clean.
- Branch protection prevents direct push to `main`; the operator merges
  the PR via the GitHub UI to advance gate 3.
