import type { Todo, TodoId } from "./todos.feature";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoItemProps {
  todo: Todo;
  onToggle: (id: TodoId) => void;
  onRemove: (id: TodoId) => void;
}

export function TodoItem({ todo, onToggle, onRemove }: TodoItemProps) {
  const attrs = verifyAttrs("TodoItem", {
    id: todo.id,
    done: todo.done,
    "tag-count": todo.tags.length,
  });

  return (
    <li {...attrs}>
      <label>
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
          data-verify-action="toggle-done"
          aria-label={`Mark "${todo.text}" as ${todo.done ? "active" : "done"}`}
        />
        <span data-verify-field="text">{todo.text}</span>
      </label>
      <span data-verify-field="tags">{todo.tags.join(", ")}</span>
      <button
        type="button"
        data-verify-action="remove"
        aria-label={`Remove "${todo.text}"`}
        onClick={() => onRemove(todo.id)}
      >
        Remove
      </button>
    </li>
  );
}
