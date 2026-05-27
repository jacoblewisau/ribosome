# Researcher findings: feature 0002 (add tags to todos)

## Files involved

- `src/features/todos/todos.feature.ts` (lines 1-90): defines `Todo`, `TodosState`, `addTodo`, `removeTodo`, `toggleTodo`, `setFilter`, `clearCompleted`, `visibleItems`, `counts`. The Todo interface has `id`, `text`, `done`, `createdAt`. Adding tags requires extending this type and adding helpers to mutate tags.
- `src/features/todos/TodoForm.tsx`: single text input that submits via Enter or button click. To input tags, the form needs either a second input or a delimiter convention (eg comma-separated).
- `src/features/todos/TodoItem.tsx`: renders the todo's text plus a checkbox and remove button. Tags would render here as an additional element.
- `src/features/todos/TodoApp.tsx`: holds state and routes events. The `addTodo` call site at line 28 currently passes only text; would need to also pass tags.
- `src/features/todos/TodoStats.tsx`: shows total/done/active counts. Could optionally show tag counts, but story-writer should decide if that is in scope.
- `src/verify/specs/TodoApp.verify.ts`: existing fixtures (empty, three-todos, toggle-marks-done, total-claims-mismatch). New fixture needed for tags.
- `src/verify/specs/todos.feature.verify.ts`: existing fixtures (add-rejects-empty, add-rejects-whitespace, whitespace-submit, claims-empty-list). Tag-related fixtures belong here.

## Existing patterns to follow

- Every component emits `data-verify-*` attributes via `verifyAttrs(unit, state)` from `src/verify/core/contract.ts:8-29`. Any new observable state on tags must follow this pattern (e.g., `data-verify-tags="a,b,c"` on TodoItem).
- The feature module exposes pure functions; state mutation is via copy. New helpers must be pure (`todos.feature.ts:34-67` for the pattern).
- Form inputs have an associated `<label>` element; the a11y verifier checks for this. Any new input must comply (`TodoForm.tsx:38-45`).
- Verify specs register their unit via `registerUnit(...)` at module bottom. Fixtures use `act` to drive interaction via `@testing-library/react`'s `fireEvent`.
- Tests must include at least one probe fixture per unit. `matrix.test.ts:20-32` enforces this.

## Similar features already built

- Adding a todo (`addTodo` in `todos.feature.ts:34-43`) is the closest pattern. It takes text, trims, validates, prepends an id. Tag mutation should follow the same shape: pure, copy-based, validates input.
- The filter mechanism (`setFilter`, `visibleItems` in `todos.feature.ts:53-72`) is a similar slice-of-state with UI controls. Tag filtering, if it becomes a follow-up feature, would mirror this.

## Risks

- Security: no new data sources; tags are user-controlled strings rendered into the DOM. React escapes them by default; no `dangerouslySetInnerHTML` is introduced. Risk: none.
- Tenant isolation: not applicable (no backend).
- Timezone: not applicable.
- Performance: tags as a `string[]` per todo. With dedupe O(n) per add, fine at expected scale.
- Accessibility: a new tag input must be labelled. A tag display element should not silently break screen reader flow on a TodoItem.
- Data model migration: none (in-memory state); existing todos in tests will simply have empty `tags` arrays after the field is added with a default `[]`.
- Edge cases the researcher cannot resolve (forwarded to story-writer as open questions): tag input format, dedupe behaviour, case sensitivity, max length, allowed characters.

## Tests that will likely need updating

- `src/verify/specs/TodoApp.verify.ts`: add a new fixture exercising tags via the form, asserting the rendered TodoItem shows them. Possibly extend the "three-todos" fixture to also exercise tags on at least one item.
- `src/verify/specs/todos.feature.verify.ts`: add a probe asserting duplicate tags are deduplicated (or are NOT deduplicated, depending on the story-writer's resolution).
- Existing fixtures should continue to pass unchanged because the new `tags` field has a sensible default (empty array).

## Memory citations

`.claude/memory/distilled/` is empty (Phase 4.5 not yet wired). The only prior chain run is feature 0001 (`.claude/memory/live/0001/`); it touched Counter, which has been removed in commit `6aff487`. No carryover applies.

The recently earned CLAUDE.md rule 11 (`package.json` implicitly in scope when build commands need to change) probably does not apply here unless the spec adds a new test script. The spec-writer should consider whether tag handling needs a new helper script; likely no.

## Open questions

1. Tag input format: a single text field accepting comma-separated tags, or a chip-style input with an "add tag" button, or a separate input that adds tags one at a time? The simplest is comma-separated, single field. The most idiomatic is chip-style. Operator decision at gate 1.
2. Dedupe: should `["urgent", "Urgent", "URGENT"]` collapse to one tag? Case-insensitive dedupe is common but loses display fidelity. The simplest is case-sensitive exact-match dedupe. Operator decision at gate 1.
3. Maximum tags per todo: cap or unbounded? Suggest 8 as a soft cap matching the workshop's per-session memory store limit (a defensible default precedent), or no cap. Operator decision.
4. Where do tags render on a TodoItem? Before or after the text, inline or block? Default suggestion: inline after text, comma-separated, in `<small>` elements with `data-verify-field="tags"` on the wrapper. Operator may want chip styling later but that is out of scope for Phase 1.
5. Should TodoStats show a tag count (eg "12 tags across 4 todos") or remain unchanged? Default suggestion: unchanged in this story, scope deferred.

Five questions. Five sensible defaults. If operator types `/approve`, defaults stand.
