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
  type TodosState,
  type TodoFilter,
} from "./todos.feature";
import { TodoForm } from "./TodoForm";
import { TodoList } from "./TodoList";
import { TodoStats } from "./TodoStats";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoAppProps {
  initial?: TodosState;
}

export function TodoApp({ initial = initialState }: TodoAppProps) {
  const [state, setState] = useState<TodosState>(initial);
  const { total, done, active } = counts(state);
  const items = visibleItems(state);

  const attrs = verifyAttrs("TodoApp", {
    total,
    done,
    active,
    filter: state.filter,
    visible: items.length,
  });

  return (
    <section {...attrs}>
      <h2 data-verify-unit-label="TodoApp">Todos</h2>
      <TodoForm onSubmit={(text) => setState((s) => addTodo(s, text))} />
      <FilterControls
        current={state.filter}
        onChange={(f) => setState((s) => setFilter(s, f))}
      />
      <TodoList
        items={items}
        onToggle={(id) => setState((s) => toggleTodo(s, id))}
        onRemove={(id) => setState((s) => removeTodo(s, id))}
      />
      <TodoStats total={total} done={done} active={active} />
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
  const filters: TodoFilter[] = ["all", "active", "done"];
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
