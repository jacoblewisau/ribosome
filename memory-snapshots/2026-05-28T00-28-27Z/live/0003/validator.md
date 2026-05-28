# Validator report: feature 0003 (due dates with overdue) — after amendment

## Status

clean. All acceptance criteria covered. No remaining scope creep. No contract failures. No security findings.

The first pass surfaced one Important finding (`src/verify/specs/TodoStats.verify.ts` edited out of scope). The operator resolved it by:
1. Promoting CLAUDE.md rule 13 (importers of a changed interface are implicitly in scope), generalising rule 11.
2. Amending `specs/0003.md` to include `TodoStats.verify.ts` in `scope_paths` with a footnote citing the rule.

The amendment was made because the underlying change is correct (TodoStats's `overdue` prop should be required); the spec just failed to anticipate the downstream verify spec. Same shape as feature 0001's `package.json` finding; different category (verify spec vs build tooling) and now covered by a single generalising rule.

## Critical

None.

## Important

None.

## Minor

None.

## Coverage matrix

| Criterion | Covered by | Where |
|---|---|---|
| 1. optional due date on each todo | type field + addTodo signature | `todos.feature.ts:18` (field), `:34-53` (signature) |
| 2. form provides labelled Due input | TodoForm with htmlFor/id | `TodoForm.tsx:72-79` (label + input) |
| 3. parse empty / valid / malformed | parseDueDateInput + helper fixture | `todos.feature.ts:103-114`, `todos.feature.verify.ts:isOverdue-helper, parseDueDateInput-helper` |
| 4. all three inputs clear after submit | setText / setTagsRaw / setDueRaw | `TodoForm.tsx:36-38` |
| 5. data-verify-field="due-date" when set | conditional render | `TodoItem.tsx:38-40` |
| 6. overdue truth table incl. done-dominates | isOverdue + fixtures | `todos.feature.ts:80-82`, fixtures `overdue-when-date-past`, `done-todo-with-past-date-not-overdue`, `isOverdue-helper` (five cases) |
| 7. aria-label "Overdue." suffix | TodoItem.tsx ariaLabel construction | `TodoItem.tsx:32-33` |
| 8. data-verify-overdue-count on TodoApp | overdueCount + attrs | `TodoApp.tsx:39-46` |
| 9. data-verify-overdue on TodoStats + visible span | TodoStats props + render | `TodoStats.tsx:17-32` |
| 10. fourth filter option "overdue" | filter union + FilterControls + visibleItems arm | `todos.feature.ts:6`, `TodoApp.tsx:96`, `todos.feature.ts:60-70` |
| 11. clock injection via prop | TodoApp `now` prop | `TodoApp.tsx:28-29,35` |
| 12. existing fixtures pass | matrix runs all 9 TodoApp fixtures (4 existing + 4 new + 1 probe) | matrix 2/2 |

Story edge cases (all covered):

| Edge | Covered by |
|---|---|
| empty date input | parseDueDateInput returns undefined; `parseDueDateInput-helper` invariant 1 |
| date input in future | `claims-future-date-is-overdue` probe documents the truth; `isOverdue-helper` invariant 3 |
| date input equal to nowMs | `isOverdue-helper` invariant 4 (strict less-than) |
| done todo with past date | `done-todo-with-past-date-not-overdue` fixture |
| filter overdue with no overdue items | not explicitly tested as a fixture; emergent property of the filter switch arm |
| multi-day-ago due dates | `overdue-when-date-past` uses a 5-day-ago date |

## Scope report

Spec's `scope_paths` (after 2026-05-27 amendment):
```
src/features/todos/todos.feature.ts
src/features/todos/TodoApp.tsx
src/features/todos/TodoForm.tsx
src/features/todos/TodoList.tsx
src/features/todos/TodoItem.tsx
src/features/todos/TodoStats.tsx
src/verify/specs/TodoApp.verify.ts
src/verify/specs/TodoStats.verify.ts
src/verify/specs/todos.feature.verify.ts
```

Files modified in this feature run (all in scope):

| Path | In scope? |
|---|---|
| `src/features/todos/todos.feature.ts` | yes |
| `src/features/todos/TodoApp.tsx` | yes |
| `src/features/todos/TodoForm.tsx` | yes |
| `src/features/todos/TodoList.tsx` | yes |
| `src/features/todos/TodoItem.tsx` | yes |
| `src/features/todos/TodoStats.tsx` | yes |
| `src/verify/specs/TodoApp.verify.ts` | yes |
| `src/verify/specs/TodoStats.verify.ts` | yes (added by amendment) |
| `src/verify/specs/todos.feature.verify.ts` | yes |

`CLAUDE.md` and `specs/0003.md` were also modified by the rule promotion and amendment respectively; those are operator actions on the chain itself, not feature builds, and are not validated against the spec.

## Contract verify summary

`tests/verify/last-run.json`:

- numTotalTests: 2 (matrix's two top-level tests)
- numPassedTests: 2
- numFailedTests: 0
- success: true

Beneath those two tests, the matrix runner exercised every unit (TodoApp, TodoStats, todos.feature) across every fixture (15 across all units after this feature) and every verifier (schema, invariants, dom-contract, a11y). All non-probe fixtures: PASS. All probe fixtures (`TodoStats/inconsistent-counts`, `TodoApp/total-claims-mismatch`, `TodoApp/claims-future-date-is-overdue`, `todos.feature/claims-empty-list`, `todos.feature/tags-dedupe-fails`): PASS (verdict level; internal probe-tagged failures are the expected adversarial behaviour).

## Notes

This is the third feature run through the chain. Two new things this run demonstrated that 0001 and 0002 did not:

- **Time-dependent logic exercised with deterministic tests.** The clock-injection pattern (`now: () => FIXED_NOW`) is the first non-trivial answer to the "how do you test time" question. Every fixture that touches overdue derivation injects a fixed clock; the matrix is reproducible.
- **A second downstream-import miss earned a generalising rule.** Feature 0001 earned rule 11 for `package.json`. Feature 0003 earned rule 13 for verify specs. Rule 13 explicitly covers the broader category ("importers of a changed interface"), so a future feature changing a third kind of importer should not need a fourth rule. The rule-miner pipeline is doing what it should: each finding promotes a rule that prevents the SHAPE of the finding, not just the instance.

A note for the rule-miner once it runs (Phase 4): rule 13 supersedes rule 11 in spirit (build-tooling files are a special case of "files that import the changed interface"). When rule-miner sees both, it should propose merging them or marking rule 11 as a special case of rule 13. Defer the merge until rule-miner exists; today, both are stated separately for the audit trail.

The chain's rule-promotion pipeline now has two examples of operating in real time and one example of NOT firing (feature 0002, which ran clean on first pass because rule 11 prevented the recurrence). The trend is what the design wanted: each chain run is at most one preventable finding away from clean.
