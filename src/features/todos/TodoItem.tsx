import { isOverdue, type Todo, type TodoId } from "./todos.feature";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoItemProps {
  todo: Todo;
  nowMs: number;
  onToggle: (id: TodoId) => void;
  onRemove: (id: TodoId) => void;
}

/**
 * Render YYYY-MM-DD. Because dueDate is parsed at local noon (per
 * todos.feature parseDueDateInput), the UTC date returned by
 * toISOString().slice(0,10) matches the user's intended calendar
 * day in any tz from UTC-12 to UTC+12. Kiribati (UTC+14) breaks the
 * assumption; out of scope per spec 0003.
 */
function formatDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function TodoItem({ todo, nowMs, onToggle, onRemove }: TodoItemProps) {
  const overdue = isOverdue(todo, nowMs);

  const attrs = verifyAttrs("TodoItem", {
    id: todo.id,
    done: todo.done,
    "tag-count": todo.tags.length,
    overdue,
  });

  const baseAriaLabel = `Mark "${todo.text}" as ${todo.done ? "active" : "done"}`;
  const ariaLabel = overdue ? `${baseAriaLabel}. Overdue.` : baseAriaLabel;

  return (
    <li {...attrs}>
      <label>
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
          data-verify-action="toggle-done"
          aria-label={ariaLabel}
        />
        <span data-verify-field="text">{todo.text}</span>
      </label>
      <span data-verify-field="tags">{todo.tags.join(", ")}</span>
      {todo.dueDate !== undefined && (
        <span data-verify-field="due-date">{formatDate(todo.dueDate)}</span>
      )}
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
