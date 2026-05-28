# Researcher findings: feature 0003 (due dates with overdue)

## Files involved

- `src/features/todos/todos.feature.ts`: defines `Todo` (lines 11-17), `TodoFilter` (line 6 as union `"all" | "active" | "done"`), `TodosState` (lines 19-22), `visibleItems` (lines 60-68 switches on filter), `counts` (lines 70-74). Adding due dates requires: extending Todo, extending TodoFilter to include "overdue", extending visibleItems to handle the new filter (which requires a time argument), adding an `isOverdue` helper, adding an `overdueCount` helper.
- `src/features/todos/TodoApp.tsx`: holds state. Currently has no `now` prop. To make overdue derivation deterministic for testing, TodoApp needs to accept a `now: () => number` prop with default `() => Date.now()`, resolve it at render, and pass the resolved number down to children that need it. The `FilterControls` inline component (`TodoApp.tsx:55-72`) renders the existing three filter buttons; extending to four needs editing the `filters` array there.
- `src/features/todos/TodoForm.tsx`: form with text and tags. To accept a due date, the form needs a third input. HTML5 `<input type="date">` produces strings in `YYYY-MM-DD` format which are easy to parse to a timestamp. Empty input = no due date. Form passes `dueDate?: number` as a fourth argument to onSubmit (or as part of an options object; spec-writer decides).
- `src/features/todos/TodoList.tsx`: maps items to TodoItem. Will need to pass `nowMs` through so TodoItem can compute overdue.
- `src/features/todos/TodoItem.tsx`: renders the todo. Will need: a due date display when set, a `data-verify-overdue` attribute on the root when overdue, an aria-label adjustment so screen readers know an item is overdue (so the styling is not the only signal).
- `src/features/todos/TodoStats.tsx`: currently shows total/done/active. May or may not show overdue count; story-writer decides.
- `src/verify/specs/TodoApp.verify.ts`: existing fixtures pass `()` props with no `now` injection. They will continue to render but their overdue-related attributes will derive from real `Date.now()` which is non-deterministic. Either (a) the existing fixtures explicitly inject `now: () => 0` so all dates are far-future and overdue=false, or (b) the existing fixtures unaffected because they don't reference overdue-related attributes. New fixtures specifically exercising overdue must inject a fixed clock.
- `src/verify/specs/todos.feature.verify.ts`: new fixtures for the pure helpers (`isOverdue`, `overdueCount`) and at least one probe for time-determinism (a probe claiming overdue=true at a time when it should be false).

## Existing patterns to follow

- Pure helpers in `todos.feature.ts` (no React, no globals). New `isOverdue(todo, nowMs)` and `overdueCount(state, nowMs)` must be pure and accept a time argument.
- `data-verify-*` via `verifyAttrs` from `src/verify/core/contract.ts:8-29`. New attributes (`overdue`, `due-date`, `overdue-count` if exposed) must follow.
- a11y verifier checks for labelled inputs. The new date input must have a `<label htmlFor>` association.
- Filter as a union type with switch coverage. Extending the union to include "overdue" requires updating the switch in `visibleItems`; TypeScript's exhaustiveness check will catch the missing case if the switch is well-typed.
- Probe fixtures must reference the unit's behaviour. A good probe for time would assert something about overdue derivation that is locally testable with a fixed clock.

## Similar features already built

- Filter (`setFilter` in `todos.feature.ts:53-55` plus the `FilterControls` in `TodoApp.tsx:55-72`) is the closest analogue. The new "overdue" filter follows the same pattern: union extension, new switch arm, new button in the FilterControls' filters array.
- Tags (feature 0002) introduced a new field with a parser (`parseTagsInput`). Due dates introduce a new field with a parser-equivalent (`parseDueDateInput` to turn an HTML date string into a UTC timestamp or undefined).

## Risks

- **Timezone**: this is the first feature where this category is load-bearing. HTML `<input type="date">` returns a string in local time format (`YYYY-MM-DD`). If parsed naively with `new Date("2026-05-27")`, JavaScript interprets it as UTC midnight, which means in Australian time zones the displayed "2026-05-27" is rendered as the previous day. Mitigation: parse the string deliberately as local-noon timestamp (or as midnight in a known tz), document the choice, and write fixtures that exercise the choice. Spec-writer should resolve.
- **Test determinism**: without injecting a clock, fixtures cannot reliably assert overdue=true or false. The clock must be injectable. Recommended: TodoApp accepts `now?: () => number`. Fixtures pass `now: () => 1700000000000` (a fixed Unix ms) and choose dueDate values relative to it.
- **Stale render on time passing**: if a todo's due date is 1 second from now, the UI does not auto-update to mark it overdue when that second passes. For the substrate, this is acceptable; React re-renders only on state changes. Real production would need a ticker; out of scope per researcher recommendation, story-writer to confirm.
- **Empty / malformed date input**: HTML date input typically constrains, but the form handler should still guard against the empty string ("" -> undefined dueDate).
- **Security**: no data is persisted, no third party touched. Risk: none.
- **Multi-tenant**: not applicable.
- **a11y**: overdue must be conveyed by more than colour. The contract gives this for free via `data-verify-overdue`; the visible signal should also include an aria-label adjustment ("X. Overdue.").

## Tests that will likely need updating

- Existing fixtures in `TodoApp.verify.ts` (empty, three-todos, toggle-marks-done, with-tags-on-some-items, total-claims-mismatch) should pass unchanged because the new `data-verify-overdue` and `data-verify-overdue-count` attributes are additive. The TodoFilter union extension is a breaking type change for any code that does exhaustive switch; the spec-writer should call out all such call sites.
- New fixture in TodoApp: `overdue-derivation-with-injected-clock`. Creates a todo with dueDate before `now`; asserts `data-verify-overdue="true"` on the item; asserts `data-verify-overdue-count="1"` on the app root.
- New probe in TodoApp or todos.feature: claims overdue=true on a todo whose dueDate is after `now` (i.e., not overdue). Invariant fires; verdict PASS via probe.
- New non-probe in todos.feature exercising `isOverdue` directly with deterministic inputs.

## Memory citations

`.claude/memory/distilled/` is empty. The most recent live-memory item that bears on this feature is the feature 0002 builder summary at `.claude/memory/live/0002/builder.md` which notes:

> "When a function signature changes, every caller is in scope."

This applies here: the proposed `visibleItems(state, nowMs)` change touches every call site, currently only one in `TodoApp.tsx`. Easy to handle in scope.

CLAUDE.md rule 11 (`package.json` implicitly in scope when build commands need to change) does not apply; no new build commands are introduced by due dates.

## Open questions

1. **Date input semantics**: HTML `<input type="date">` value is `YYYY-MM-DD` in local time. Parse as local-noon timestamp (most user-intuitive), local-midnight, or UTC-midnight? Recommendation: local-noon (`new Date(YYYY, MM-1, DD, 12, 0, 0).getTime()`). It avoids the off-by-one-day issue in either tz direction without surprising the user. Operator decision at gate 1.
2. **Clock prop on TodoApp**: accept `now?: () => number` with default `() => Date.now()`, resolved at render and passed down. Confirm or pick a different injection point (e.g., a React context).
3. **Overdue count in TodoStats**: include it (alongside total/done/active) or out of scope? Recommendation: include it; the stats section is the natural home and it adds a useful invariant target.
4. **Ticker for real-time overdue update**: out of scope per researcher. Confirm.
5. **Filter "overdue" semantic**: items whose `dueDate` is in the past AND `done === false`. Items that were done before their due date are not overdue. Items that were done after their due date are also not overdue (done dominates overdue). Confirm.

Five questions. Five defaults. If operator `/approve`s, defaults stand.
