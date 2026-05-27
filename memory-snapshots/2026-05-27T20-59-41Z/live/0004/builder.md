# Builder summary: feature 0004 (edit-in-place for todo text)

## Files changed

- `src/features/todos/todos.feature.ts` (modified): added `setTodoText(state, id, text)` pure helper. Trims input; whitespace-only is no-op (returns input state by reference); unknown id is no-op; matching id returns new state with the matching todo's text replaced and other items preserved by reference.
- `src/features/todos/TodoItem.tsx` (modified): added `onEditText` required prop. Added internal state `isEditing` and `draft`. Added refs to the input and the text span. Added `useEffect` that focuses the input on edit-start and the text span on edit-end (criterion 7). Added keyboard handler for Enter (commit if non-empty), Escape (cancel), and a blur handler (cancel; criterion 6). Added `data-verify-editing` to the root attrs and `data-verify-input="edit-text"` to the edit input. The text span gains `tabIndex={0}`, role="button", aria-label, and `data-verify-action="enter-edit"` so the contract harness can target it.
- `src/features/todos/TodoList.tsx` (modified): `onEditText` prop pass-through.
- `src/features/todos/TodoApp.tsx` (modified): `onEditText` handler calls `setTodoText`; wired through to TodoList.
- `src/verify/specs/TodoApp.verify.ts` (modified): five new fixtures (edit-saves-on-enter, edit-cancels-on-escape, edit-cancels-on-blur, edit-rejects-empty-on-enter, plus probe claim-not-editing-after-click).
- `src/verify/specs/todos.feature.verify.ts` (modified): one new non-probe fixture setTodoText-helper with five invariants exercising trim, whitespace-only rejection (reference equality), unknown id rejection (reference equality), and non-touched-item reference equality.

## Patterns reused

- Per distilled item pat-data-verify-contract-surface (refs incremented to 1 by this chain): the new `editing` attribute flows through `verifyAttrs`.
- Per distilled item pat-probe-pairs-with-behavior (refs incremented to 1): claim-not-editing-after-click pairs with edit-saves-on-enter exercising the same code path. A regression in enterEditMode flips BOTH the non-probe's verdict and the probe's failure message.
- Per the existing trim-and-reject-empty pattern in addTodo, `setTodoText` follows the same semantics for whitespace-only inputs.

## Acceptance criteria addressed

1. Click on text span enters edit mode (only): covered. The edit affordance is on the text span only; the checkbox and remove button do not trigger edit.
2. Edit input pre-filled, focused, data-verify-editing=true: covered.
3-5. Enter commits if non-empty; Enter on empty cancels; Escape cancels: covered (edit-saves-on-enter, edit-rejects-empty-on-enter, edit-cancels-on-escape).
6. Blur cancels: covered (edit-cancels-on-blur).
7. Focus returns to text element after save/cancel: covered structurally via the useEffect on isEditing change.
8. Concurrent edits across items independent: covered by per-instance useState.
9. Editing does not toggle/remove/reorder: covered structurally (the edit code path does not call any other mutation).
10. setTodoText helper rejects whitespace-only: covered (setTodoText-helper fixture invariant).
11. Existing fixtures continue to pass: covered (npm run verify reports 22 non-probe passes including all from chains 0001/2/3).

## Check results

- npm run typecheck: clean.
- npm test: 16/16 (chain state + distilled tests).
- npm run verify: 2/2 matrix tests. totals.fixtures=28 (up from 22), totals.pass=22, totals.probes=6, totals.fail=0.

## Blockers

None.

## CLAUDE.md candidates

None this run. The chain learned to lean on rule 13 (importers in scope) explicitly when planning; TodoItemProps gaining a required onEditText prop forced TodoList.tsx and TodoApp.tsx into the spec's scope_paths up front. No scope creep. No new rule earned.
