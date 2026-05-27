import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isOverdue, type Todo, type TodoId } from "./todos.feature";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoItemProps {
  todo: Todo;
  nowMs: number;
  onToggle: (id: TodoId) => void;
  onRemove: (id: TodoId) => void;
  onEditText: (id: TodoId, text: string) => void;
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

export function TodoItem({ todo, nowMs, onToggle, onRemove, onEditText }: TodoItemProps) {
  const overdue = isOverdue(todo, nowMs);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);

  // Focus the input on edit-start; focus the text span on edit-end.
  // Spec 0004 criterion 7: focus returns to the text element after
  // save or cancel.
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      textRef.current?.focus();
    }
  }, [isEditing]);

  const enterEditMode = () => {
    setDraft(todo.text);
    setIsEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed.length > 0) {
      onEditText(todo.id, trimmed);
    }
    setIsEditing(false);
  };

  const cancel = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const attrs = verifyAttrs("TodoItem", {
    id: todo.id,
    done: todo.done,
    "tag-count": todo.tags.length,
    overdue,
    editing: isEditing,
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
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={cancel}
            data-verify-input="edit-text"
            aria-label={`Edit text for "${todo.text}"`}
          />
        ) : (
          <span
            ref={textRef}
            data-verify-field="text"
            data-verify-action="enter-edit"
            tabIndex={0}
            onClick={enterEditMode}
            role="button"
            aria-label={`Edit "${todo.text}"`}
          >
            {todo.text}
          </span>
        )}
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
