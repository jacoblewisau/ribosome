/**
 * Todo feature: pure state and transitions, no React.
 *
 * The UI components (TodoApp, TodoList, TodoItem, TodoForm, TodoStats)
 * call these functions; the feature itself is what the spec-writer and
 * the test-author talk about. Keeping it React-free is what lets the
 * `todos.feature.verify.ts` spec exercise it directly.
 */

export type TodoId = string;
export type TodoFilter = "all" | "active" | "done";

export interface Todo {
  id: TodoId;
  text: string;
  done: boolean;
  createdAt: number;
  tags: ReadonlyArray<string>;
}

export interface TodosState {
  items: ReadonlyArray<Todo>;
  filter: TodoFilter;
}

export const initialState: TodosState = {
  items: [],
  filter: "all",
};

/**
 * Add a todo. Returns the new state. Whitespace-only inputs are
 * rejected (the form should not produce one, but the feature guards
 * anyway and the whitespace-submit probe verifies this).
 *
 * `tags` is an already-parsed array of strings; the caller (TodoForm
 * via parseTagsInput) is responsible for splitting, trimming, and
 * deduplication. addTodo trusts its input.
 */
export function addTodo(
  state: TodosState,
  text: string,
  tags: ReadonlyArray<string> = [],
  now: number = Date.now()
): TodosState {
  const trimmed = text.trim();
  if (trimmed.length === 0) return state;
  const item: Todo = {
    id: nextId(now),
    text: trimmed,
    done: false,
    createdAt: now,
    tags,
  };
  return { ...state, items: [...state.items, item] };
}

/**
 * Parse a raw tag input string into a deduplicated array of tags.
 * Splits on commas, trims each part, drops empty parts, and removes
 * exact-match duplicates preserving first-seen order. Pure.
 */
export function parseTagsInput(input: string): string[] {
  const parts = input.split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function removeTodo(state: TodosState, id: TodoId): TodosState {
  return { ...state, items: state.items.filter((t) => t.id !== id) };
}

export function toggleTodo(state: TodosState, id: TodoId): TodosState {
  return {
    ...state,
    items: state.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  };
}

export function setFilter(state: TodosState, filter: TodoFilter): TodosState {
  return { ...state, filter };
}

export function clearCompleted(state: TodosState): TodosState {
  return { ...state, items: state.items.filter((t) => !t.done) };
}

export function visibleItems(state: TodosState): ReadonlyArray<Todo> {
  switch (state.filter) {
    case "all":
      return state.items;
    case "active":
      return state.items.filter((t) => !t.done);
    case "done":
      return state.items.filter((t) => t.done);
  }
}

export function counts(state: TodosState): { total: number; done: number; active: number } {
  const total = state.items.length;
  const done = state.items.filter((t) => t.done).length;
  return { total, done, active: total - done };
}

/**
 * Deterministic id from a timestamp. Phase 1 substrate; not for
 * production. Collisions within the same millisecond would corrupt
 * state but the contract harness drives serial updates so we never
 * hit one.
 */
let lastTs = 0;
let collisionCounter = 0;
function nextId(now: number): string {
  if (now === lastTs) {
    collisionCounter += 1;
  } else {
    lastTs = now;
    collisionCounter = 0;
  }
  return `t_${now}_${collisionCounter}`;
}
