# Builder summary: feature 0002 (add tags to todos)

## Files changed

- `src/features/todos/todos.feature.ts` (modified): added `tags: ReadonlyArray<string>` to the `Todo` interface; changed `addTodo` signature from `(state, text, now?)` to `(state, text, tags?, now?)` with `tags` defaulting to `[]`; added new pure helper `parseTagsInput(input)` that splits on comma, trims, drops empty parts, dedupes case-sensitive preserving first-seen order.
- `src/features/todos/TodoForm.tsx` (modified): added a second labelled input field for tags; the form computes `parsedTags` via `parseTagsInput` and passes them as the second argument to `onSubmit`; both inputs clear after a successful submit. `onSubmit` prop signature changed to `(text: string, tags: string[]) => void`. New `data-verify-*` attributes: `tags-input-length`, `parsed-tag-count`.
- `src/features/todos/TodoApp.tsx` (modified): `tagged` count computed (todos with non-empty tags); passed through into the root attribute bag as `data-verify-tagged`; the `onSubmit` wiring to `addTodo` updated to pass tags.
- `src/features/todos/TodoItem.tsx` (modified): added `data-verify-tag-count` on the root `<li>`; added a `<span data-verify-field="tags">{todo.tags.join(", ")}</span>` element after the text span and before the remove button.
- `src/verify/specs/TodoApp.verify.ts` (modified): added one fixture `with-tags-on-some-items` exercising two todos (one tagged, one not) and asserting `data-verify-tagged="1"`, `tag-count="2"` on the first, `tag-count="0"` on the second, and the joined-tag text.
- `src/verify/specs/todos.feature.verify.ts` (modified): added one non-probe fixture `tags-parse-and-trim` exercising the parser via the form with a messy input ("  a  , b  ,, c  , a") and asserting the parser yields exactly three tags in correct order. Added one probe fixture `tags-dedupe-fails` that claims tag-count=3 after submitting "x, x, x"; parser dedupes to one, the invariant fires, verdict PASS via the probe path.

## Existing patterns reused

- `verifyAttrs(unit, state)` from `src/verify/core/contract.ts:8-29` for every new data-verify attribute. No new helper invented.
- Pure function pattern in `todos.feature.ts` (no React imports, no side effects beyond `nextId`); `parseTagsInput` follows the same shape.
- Label+input association via `htmlFor`/`id` for accessibility, matching the existing `todo-text` input's pattern.
- Fixture authoring: `fireEvent.change` then `fireEvent.click` for form drives, mirroring the existing `toggle-marks-done` and `three-todos` fixtures.

## Acceptance criteria addressed

1. Each todo carries tags: covered (`todos.feature.ts:13`, `Todo.tags` field; default `[]`).
2. Form accepts tags via labelled input: covered (`TodoForm.tsx:54-65`, `<label htmlFor="todo-tags">Tags</label>` + input).
3. Submit parses and dedupes: covered (`TodoForm.tsx:24` calls `parseTagsInput`, parser at `todos.feature.ts:64-78`).
4. Both inputs clear after submit: covered (`TodoForm.tsx:33-34`, `setText("")` and `setTagsRaw("")` after `onSubmit`).
5. TodoItem renders tags under `data-verify-field="tags"`: covered (`TodoItem.tsx:25`, `<span data-verify-field="tags">{todo.tags.join(", ")}</span>`).
6. `data-verify-tag-count` on TodoItem: covered (`TodoItem.tsx:11`, `"tag-count": todo.tags.length`).
7. `data-verify-tagged` on TodoApp: covered (`TodoApp.tsx:24-32`, `tagged` computed and included in `verifyAttrs`).
8. Tag input is labelled (a11y compliance): covered (`TodoForm.tsx:54`, `<label htmlFor="todo-tags">`); the a11y verifier in the matrix continues to report ok.

Edge cases from the story also covered:
- Empty tag input -> 0 tags: covered structurally (parser returns []).
- Whitespace-only -> 0 tags: covered by parser (all parts empty after trim).
- All-duplicate tag input -> 1 tag: probed by `tags-dedupe-fails`, confirmed by parser logic.
- Mixed-case duplicates as distinct: case-sensitive dedupe preserves them; no probe but trivial from parser code.
- Comma in tag content: out of scope per story; no work needed.

## Check results

- `npm run typecheck`: exit 0, no output.
- `npm test`: exit 0 ("No test files found, exiting with code 0").
- `npm run verify`: exit 0, JSON written. Matrix: 2/2 tests passing. `success: true`.

The matrix exercises every unit (TodoApp, TodoStats, todos.feature) across every fixture and every verifier (schema, invariants, dom-contract, a11y). Non-probe fixtures all PASS; probe fixtures PASS (verdict-wise) with their internal checks marked as `probe`.

## Blockers

None.

## CLAUDE.md candidates

1. **Rule candidate: probe fixtures must be paired with a meaningful invariant**, not just any false claim. The `tags-dedupe-fails` probe specifically asserts that the dedupe path was exercised; a probe that asserts something orthogonal to the unit's behaviour would still PASS but would not teach anyone anything. Suggested rule: "A probe fixture's adversarial assertion must reference the same behaviour the unit's other invariants reference, so a future code change that breaks the dedupe path makes the probe's check details visibly different rather than identical." This is subtle; defer until a second probe is added that demonstrates the failure mode.

2. **Rule candidate: when a function signature changes, every caller is in scope.** This run added a parameter to `addTodo`. Every call site (in `TodoApp.tsx` only) updated within scope. The spec correctly listed both files. CLAUDE.md does not need a new rule; the existing rule 1 ("skill before agent before pipeline") plus spec discipline cover it. Mention this so rule-miner can recognise the rule was implicitly applied.
