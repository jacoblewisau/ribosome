import { useState } from "react";
import {
  initialState,
  addTodo,
  removeTodo,
  toggleTodo,
  setFilter,
  clearCompleted,
  counts,
  visibleItems,
  overdueCount,
  setTodoText,
  type TodosState,
  type TodoFilter,
} from "./todos.feature";
import { TodoForm } from "./TodoForm";
import { TodoList } from "./TodoList";
import { TodoStats } from "./TodoStats";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoAppProps {
  initial?: TodosState;
  /**
   * Clock injector. Resolved once per render. Default: () => Date.now().
   * Fixtures pass a fixed-time function so overdue derivation is
   * reproducible without timer mocking.
   */
  now?: () => number;
}

export function TodoApp({ initial = initialState, now = () => Date.now() }: TodoAppProps) {
  const [state, setState] = useState<TodosState>(initial);
  const nowMs = now();
  const { total, done, active } = counts(state);
  const overdue = overdueCount(state, nowMs);
  const items = visibleItems(state, nowMs);
  const tagged = state.items.filter((t) => t.tags.length > 0).length;

  const attrs = verifyAttrs("TodoApp", {
    total,
    done,
    active,
    filter: state.filter,
    visible: items.length,
    tagged,
    "overdue-count": overdue,
  });

  return (
    <section {...attrs}>
      <h2 data-verify-unit-label="TodoApp">Todos</h2>
      <TodoForm
        onSubmit={(text, tags, dueDate) =>
          setState((s) => addTodo(s, text, tags, dueDate, nowMs))
        }
      />
      <FilterControls
        current={state.filter}
        onChange={(f) => setState((s) => setFilter(s, f))}
      />
      <TodoList
        items={items}
        nowMs={nowMs}
        onToggle={(id) => setState((s) => toggleTodo(s, id))}
        onRemove={(id) => setState((s) => removeTodo(s, id))}
        onEditText={(id, text) => setState((s) => setTodoText(s, id, text))}
      />
      <TodoStats total={total} done={done} active={active} overdue={overdue} />
      <button
        type="button"
        data-verify-action="clear-completed"
        aria-label="Clear completed todos"
        onClick={() => setState((s) => clearCompleted(s))}
      >
        Clear completed
      </button>
    </section>
  );
}

interface FilterControlsProps {
  current: TodoFilter;
  onChange: (filter: TodoFilter) => void;
}

function FilterControls({ current, onChange }: FilterControlsProps) {
  const filters: TodoFilter[] = ["all", "active", "done", "overdue"];
  return (
    <nav aria-label="Filter todos" data-verify-region="filter-controls">
      {filters.map((f) => (
        <button
          key={f}
          type="button"
          aria-label={`Show ${f} todos`}
          aria-pressed={current === f}
          data-verify-filter-choice={f}
          onClick={() => onChange(f)}
        >
          {f}
        </button>
      ))}
    </nav>
  );
}
