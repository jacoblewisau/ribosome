# Validator report: feature 0002 (add tags to todos)

## Status

clean. All acceptance criteria covered. No scope creep. No contract failures. No security findings.

## Critical

None.

## Important

None.

## Minor

None.

## Coverage matrix

| Criterion | Covered by | Where |
|---|---|---|
| 1. each todo carries a tags array | type definition + parser + addTodo signature | `src/features/todos/todos.feature.ts:13` (field), `:34-49` (addTodo), `:64-78` (parser) |
| 2. form accepts tags via labelled comma-separated input | TodoForm tag input with associated label | `src/features/todos/TodoForm.tsx:54-65` |
| 3. submit parses, splits, trims, drops empty, dedupes case-sensitive | `parseTagsInput` plus form wiring | `src/features/todos/todos.feature.ts:64-78`, `TodoForm.tsx:24,30` |
| 4. both inputs clear after submit | setText("") and setTagsRaw("") | `TodoForm.tsx:33-34` |
| 5. tags rendered inline under `data-verify-field="tags"` | TodoItem tag span | `src/features/todos/TodoItem.tsx:25` |
| 6. `data-verify-tag-count` on TodoItem root | verifyAttrs call | `TodoItem.tsx:9-13` |
| 7. `data-verify-tagged` on TodoApp root | TodoApp tagged count + verifyAttrs | `TodoApp.tsx:24-32` |
| 8. tag input labelled (a11y) | `<label htmlFor="todo-tags">` + a11y verifier reports ok | `TodoForm.tsx:54`, matrix a11y verifier output |

Story edge cases covered:

| Edge case | Covered by |
|---|---|
| empty tag input -> 0 tags | parser logic + `with-tags-on-some-items` fixture (second todo) |
| whitespace-only input -> 0 tags | parser logic (all parts empty after trim) |
| all-duplicate input -> 1 tag | probe `tags-dedupe-fails` |
| mixed-case duplicates as distinct | parser logic (case-sensitive `Set<string>`) |
| comma in tag content | out of scope per story (acknowledged, not implemented) |

## Scope report

Spec's `scope_paths`:
```
src/features/todos/todos.feature.ts
src/features/todos/TodoForm.tsx
src/features/todos/TodoApp.tsx
src/features/todos/TodoItem.tsx
src/verify/specs/TodoApp.verify.ts
src/verify/specs/todos.feature.verify.ts
```

Files modified in this feature run:

| Path | In scope? |
|---|---|
| `src/features/todos/todos.feature.ts` | yes |
| `src/features/todos/TodoForm.tsx` | yes |
| `src/features/todos/TodoApp.tsx` | yes |
| `src/features/todos/TodoItem.tsx` | yes |
| `src/verify/specs/TodoApp.verify.ts` | yes |
| `src/verify/specs/todos.feature.verify.ts` | yes |

Exact match. No out-of-scope writes. (Compare to feature 0001 which had one Important finding on `package.json`; CLAUDE.md rule 11 prevented a recurrence by encouraging the spec-writer to include build-command-affecting files explicitly.)

## Contract verify summary

`tests/verify/last-run.json` (re-read on this validator pass):

- numTotalTests: 2
- numPassedTests: 2
- numFailedTests: 0
- success: true

The matrix exercises three units (TodoApp, TodoStats, todos.feature) and four verifiers (schema, invariants, dom-contract, a11y) across all their fixtures. Probe fixtures (`TodoStats/inconsistent-counts`, `TodoApp/total-claims-mismatch`, `todos.feature/claims-empty-list`, `todos.feature/tags-dedupe-fails`) all yield verdict PASS as expected; their internal checks include `probe`-tagged failures which is the framework working as designed.

## Notes

This is the second feature run through the chain. Improvements over feature 0001 visible on disk:

- No scope creep. The spec-writer learned from rule 11 and listed every file the change touched up front, including the verify specs. The builder did not need to widen scope.
- Tighter contract design. The new probe (`tags-dedupe-fails`) is paired with a meaningful invariant rather than a generic "claim something false", which makes the probe instructive rather than ceremonial.
- More verifiers exercised. The a11y verifier caught nothing because the spec mandated the label association; the schema verifier caught nothing because the props passed through Zod without issue. The fact that there is nothing to report from those verifiers is itself a useful signal: they ran, they had a chance to fail, they did not.

The chain ran end to end without a Critical finding and without a need for a rollback or amendment. Phase 1 is now genuinely proven on a substrate that exercises every chain piece.

A note for the rule-miner (Phase 4): the builder's CLAUDE.md candidate 1 ("probe fixtures must be paired with a meaningful invariant referencing the unit's behaviour") is worth promoting once a second example demonstrates the failure mode. For now, the validator agrees the pattern is correct but does not promote because one data point is not a rule.
