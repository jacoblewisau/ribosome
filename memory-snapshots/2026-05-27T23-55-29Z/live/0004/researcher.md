# Researcher findings: feature 0004 (edit-in-place for todo text)

## Files involved

- `src/features/todos/TodoItem.tsx` (lines 1-61): the locus of the change. Currently renders todo text as `<span data-verify-field="text">{todo.text}</span>` (line 45). The component has props `todo`, `nowMs`, `onToggle`, `onRemove`. To support editing, it needs new state (`isEditing`), new keyboard handlers, and a new callback `onEditText`.
- `src/features/todos/todos.feature.ts`: defines `Todo`, mutation helpers. Adding a `setTodoText(state, id, text)` pure helper here keeps the feature module pure (no React) and consistent with the existing pattern of `addTodo`, `toggleTodo`, `removeTodo`, `setFilter`, `clearCompleted`.
- `src/features/todos/TodoApp.tsx`: holds state; needs an `onEditText` callback wired through `TodoList` to `TodoItem`. Mirrors the existing `onToggle` and `onRemove` wiring.
- `src/features/todos/TodoList.tsx`: passes callbacks through; trivial addition.
- `src/verify/specs/TodoApp.verify.ts`: needs at least one fixture exercising the edit flow (click text, type new value, press Enter, assert text updated) and one probe (e.g., a fixture asserting `data-verify-editing="true"` on a non-editing item).
- `src/verify/specs/todos.feature.verify.ts`: needs a non-probe fixture for the pure `setTodoText` helper.

## Existing patterns to follow

- **DOM contract via `verifyAttrs`**: per the distilled item `pat-data-verify-contract-surface` (in MEMORY.md), every observable state goes through `verifyAttrs(unit, state)`. The TodoItem already exposes `id`, `done`, `tag-count`, `overdue` (`TodoItem.tsx:25-30`). The editing state must follow: `data-verify-editing="true"|"false"` on the root.
- **Per-item local state**: each `TodoItem` will need a `useState<boolean>(false)` for `isEditing`. The substrate already has no shared editing state; treating editing as per-instance is the simplest path and matches React idioms.
- **Pure feature helpers**: `setTodoText(state, id, text): TodosState` follows `toggleTodo` (`todos.feature.ts:51-56`). Trim whitespace; reject empty strings (mirror `addTodo`'s whitespace-only guard at `todos.feature.ts:41`).
- **Probe pairing**: per `pat-probe-pairs-with-behavior` in MEMORY.md, probes are more instructive when paired with non-probe fixtures exercising the same code path. The new edit fixture should pair: `edit-saves-on-enter` (non-probe) + `claim-not-editing-after-click` (probe asserting `data-verify-editing="false"` after the click started editing).
- **Operator-default approval pattern**: per `op-pref-bare-approve-resolves-to-stated-defaults`, when the story-writer surfaces open questions with stated defaults, bare `/approve` accepts the defaults. The story-writer should phrase the keyboard semantics (Enter / Escape / blur / click-outside) as defaults.

## Similar features already built

- `addTodo` plus form input (chain 0001 through 0003): the same problem in reverse — convert form input to state. Reading `TodoForm.tsx:18-37` shows the trimmed/submittable pattern; the edit input can reuse that shape.
- `toggleTodo` and `removeTodo`: callback wiring through TodoList -> TodoItem is the template (`TodoApp.tsx:53-58`, `TodoList.tsx:13-26`).
- Tags edit was deliberately out of scope in story 0002. This story is conceptually similar (mutating a per-item field via UI), but for text. Tags-edit could reuse this feature's pattern in a future story.

## Risks

- **Security**: user-controlled text. React escapes by default; no `dangerouslySetInnerHTML` is added. Risk: none.
- **Tenant isolation, timezone, performance**: not applicable.
- **Accessibility**: this is the load-bearing risk for this feature. The current toggle's aria-label is `Mark "X" as done/active`. The new edit affordance must be reachable by keyboard (not only mouse). The edit input must be labelled. When editing starts the input must receive focus; when editing ends focus should return to the text or a sensible neighbour. Screen-reader users need a way to know editing is active; `aria-live` on the editing region or an `aria-label` change on the text element. The `a11y` verifier in `src/verify/verifiers/a11y.ts` will catch a labelled-input miss but not a focus-management miss; that one is for the spec to resolve.
- **Cross-tab editing**: not applicable (no persistence yet; out of scope).
- **Cancel semantics ambiguity**: Escape clearly cancels. Click-outside-to-cancel is conventional but not universal. Operator should confirm at gate 1.
- **Enter on empty input**: the form's whitespace-only guard rejects empty strings on add. For edit, the same guard should apply (cannot edit-save to empty). Confirmation at gate 1.

## Tests that will likely need updating

- `src/verify/specs/TodoApp.verify.ts`: new fixtures for the edit flow (success path) and probes (designed-to-fail assertions on editing state).
- `src/verify/specs/todos.feature.verify.ts`: new non-probe fixture for `setTodoText` (the pure helper).
- Existing fixtures should pass unchanged; the new `data-verify-editing` attribute is additive on `TodoItem`.

## Memory citations

From the distilled store at `.claude/memory/distilled/2026-05-27T20-49-34-593Z/` (via `MEMORY.md`):

- **`pat-data-verify-contract-surface`**: dictates the new `data-verify-editing` attribute on TodoItem root. Increment its reference_count after this chain run via `npm run dream:show` confirming and `citeItem` if scripted.
- **`pat-probe-pairs-with-behavior`**: dictates the probe + non-probe pairing for the edit fixtures. The new probe must be paired with a non-probe exercising the same code path.
- **`op-pref-bare-approve-resolves-to-stated-defaults`**: dictates the story-writer's phrasing of the five open questions below as stated defaults rather than bare questions.

The other distilled items (`pat-clock-injection-for-time-tests`, `pat-local-noon-date-parsing`, `ap-vitest-default-bails-at-first-fail`) do not bear on this feature.

## Open questions

1. **Cancel triggers.** Escape cancels (default). Should click-outside also cancel, or commit? Recommendation: cancel (matches typical inline-edit UX in Linear, GitHub, Notion). Operator confirm at gate 1.
2. **Empty edit text.** Mirror `addTodo`'s rejection of whitespace-only: Enter on an empty (after trim) input cancels the edit (returns to the original text), not save-as-empty. Recommendation: this. Operator confirm.
3. **Concurrent edits.** Two `TodoItem`s could be in edit mode simultaneously. Recommendation: allow (each item's editing state is local; no mutual exclusion). Operator confirm.
4. **Focus return after save / cancel.** After Enter or Escape, focus moves to... the text span (now a button-like element)? The list root? A sentinel after the item? Recommendation: focus moves to the text element itself (now rendered as a span). Operator confirm.
5. **Click target for entering edit mode.** The text span only, or the whole label area? Recommendation: text span only; clicking the checkbox or the remove button should not enter edit mode. Operator confirm.

Five questions. Five recommended defaults. Per the operator-preference pattern in distilled memory, bare `/approve` resolves to the defaults.
