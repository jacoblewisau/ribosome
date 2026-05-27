import type { Todo, TodoId } from "./todos.feature";
import { TodoItem } from "./TodoItem";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoListProps {
  items: ReadonlyArray<Todo>;
  nowMs: number;
  onToggle: (id: TodoId) => void;
  onRemove: (id: TodoId) => void;
}

export function TodoList({ items, nowMs, onToggle, onRemove }: TodoListProps) {
  const attrs = verifyAttrs("TodoList", {
    count: items.length,
  });

  return (
    <ul {...attrs}>
      {items.map((t) => (
        <TodoItem
          key={t.id}
          todo={t}
          nowMs={nowMs}
          onToggle={onToggle}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}
