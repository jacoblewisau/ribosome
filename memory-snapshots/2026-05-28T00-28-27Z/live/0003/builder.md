# Builder summary: feature 0003 (due dates with overdue)

## Files changed

- `src/features/todos/todos.feature.ts`: added `dueDate?: number` to Todo; added "overdue" to TodoFilter union; extended `visibleItems` to accept `nowMs` and handle the new filter arm; added pure helpers `isOverdue(todo, nowMs)`, `overdueCount(state, nowMs)`, `parseDueDateInput(input)`. The parser interprets a YYYY-MM-DD input as local-noon, per spec rationale.
- `src/features/todos/TodoApp.tsx`: added `now?: () => number` prop with default `() => Date.now()`. Resolved `nowMs = now()` once per render and passed down to TodoList, used for overdueCount and visibleItems calls. Filter controls extended to four buttons. Root attribute bag gains `data-verify-overdue-count`.
- `src/features/todos/TodoForm.tsx`: added labelled date input with `<label htmlFor="todo-due">Due</label>`; parses via `parseDueDateInput`; passes `dueDate` as third arg to onSubmit; all three inputs clear after successful submit.
- `src/features/todos/TodoList.tsx`: accepts `nowMs` prop, forwards to every TodoItem.
- `src/features/todos/TodoItem.tsx`: accepts `nowMs`, computes overdue via `isOverdue`, adds `data-verify-overdue` to root attrs, conditionally renders `<span data-verify-field="due-date">{formatDate(todo.dueDate)}</span>`, suffixes the aria-label with ". Overdue." when overdue (so screen readers get the state without colour).
- `src/features/todos/TodoStats.tsx`: accepts required `overdue: number` prop; root attrs gain `data-verify-overdue`; new visible span `<span data-verify-field="overdue">{overdue} overdue</span>` appended.
- `src/verify/specs/TodoApp.verify.ts`: all existing fixture renders now inject `now: makeClock()` for determinism (FIXED_NOW = 2026-05-15T00:00:00Z). Added four new fixtures (`overdue-when-date-past`, `done-todo-with-past-date-not-overdue`, `filter-overdue-only-shows-overdue`, plus probe `claims-future-date-is-overdue`). Existing fixtures continue to pass.
- `src/verify/specs/todos.feature.verify.ts`: added two non-probe fixtures (`isOverdue-helper`, `parseDueDateInput-helper`) exercising the pure helpers against fixed inputs. Existing fixtures continue to pass.

## Out-of-scope finding (scope creep)

- `src/verify/specs/TodoStats.verify.ts` (modified, NOT in spec scope_paths). The spec added `overdue: number` as a required prop on TodoStats. Every fixture in TodoStats.verify.ts that mounts `<TodoStats ...>` passed only `{total, done, active}`, which became a type error after the prop change. Builder updated this file to add `overdue` to every fixture's props and the Zod schema, and added a new non-probe fixture `some-overdue` for richer coverage. Without this fix, typecheck stays red and the chain cannot return.

This is the same shape as the feature 0001 `package.json` finding (rule 11) but at a different category: verify specs that mount a changed unit. The validator should flag this as Important and the operator may want a new generalizing rule.

## Existing patterns reused

- Pure helpers in `todos.feature.ts` (no React, no globals), matching the `parseTagsInput` shape from feature 0002.
- `verifyAttrs(unit, state)` for every new data-verify attribute; no new helper introduced.
- Label+input association via `htmlFor`/`id` for the new date input, matching the existing two inputs.
- Probe pattern with one designed-to-fail invariant per adversarial fixture.
- Clock injection via prop, the simplest test-determinism pattern that does not require timer mocking.

## Acceptance criteria addressed

1. Optional due date on each todo: covered (`todos.feature.ts:18` `dueDate?: number`).
2. Form provides a third labelled `Due` input: covered (`TodoForm.tsx:72-79`).
3. Parsing of empty/non-empty/malformed date inputs: covered by `parseDueDateInput` (`todos.feature.ts:103-114`) and exercised by the `parseDueDateInput-helper` fixture.
4. All three inputs clear after submission: covered (`TodoForm.tsx:36-38`).
5. `data-verify-field="due-date"` rendered when set: covered (`TodoItem.tsx:38-40`).
6. `data-verify-overdue` truth table including done-dominates-overdue: covered by `isOverdue` (`todos.feature.ts:80-82`) and exercised by `overdue-when-date-past`, `done-todo-with-past-date-not-overdue`, and the `isOverdue-helper` fixture.
7. aria-label suffix when overdue: covered (`TodoItem.tsx:32-33`).
8. `data-verify-overdue-count` on TodoApp root: covered (`TodoApp.tsx:39-46`).
9. `data-verify-overdue` on TodoStats plus visible fourth span: covered (`TodoStats.tsx:17-32`).
10. Fourth filter option `overdue`: covered (`TodoApp.tsx:96`, `todos.feature.ts:60-70` switch).
11. Clock injection via prop, resolved once per render: covered (`TodoApp.tsx:28-29,35`).
12. Existing fixtures continue to pass: covered (matrix runs 2/2; every existing invariant still holds).

## Check results

- `npm run typecheck`: exit 0, no output (after the TodoStats.verify.ts update).
- `npm test`: exit 0 ("No test files found, exiting with code 0").
- `npm run verify`: exit 0. Matrix 2/2 tests passing. `success: true`.

## Blockers

None resolved by the builder alone; the TodoStats.verify.ts scope-creep finding is surfaced for the operator and the validator. Builder could not return with red checks without making that edit.

## CLAUDE.md candidates

1. **Generalizing rule (proposed rule 13):** "When a unit's exported interface changes (a required prop is added, a function signature changes, a type union gains a member), every file that imports that interface is implicitly in scope. This includes verify specs that mount the unit, build tooling files (already covered by rule 11), and any other consumer not explicitly listed in `scope_paths`."

   This generalizes the lesson from rule 11 (package.json) and feature 0003's TodoStats.verify.ts finding. Rule 11 covered tooling files; rule 13 covers downstream code consumers. Together they say: "follow your changes."

2. **Sub-recommendation:** the spec-writer's checklist should include a step "for every type/interface I'm changing, grep the repo for imports; every importing file is in scope." This is a process rule rather than a CLAUDE.md rule; consider whether to encode it in the spec-writer SKILL.md or leave it as implicit discipline that rule 13 already implies.
