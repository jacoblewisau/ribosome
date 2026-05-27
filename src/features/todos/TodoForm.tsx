import { useState, type FormEvent } from "react";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoFormProps {
  onSubmit: (text: string) => void;
}

/**
 * TodoForm. Single text input plus submit button. Whitespace-only
 * submissions are rejected by the feature module; the
 * whitespace-submit probe in `todos.feature.verify.ts` drives this
 * exact case to confirm.
 */
export function TodoForm({ onSubmit }: TodoFormProps) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const submittable = trimmed.length > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!submittable) return;
    onSubmit(trimmed);
    setText("");
  }

  const attrs = verifyAttrs("TodoForm", {
    "input-length": text.length,
    "trimmed-length": trimmed.length,
    submittable,
  });

  return (
    <form {...attrs} onSubmit={handleSubmit}>
      <label htmlFor="todo-text">New todo</label>
      <input
        id="todo-text"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-verify-input="todo-text"
        aria-describedby="todo-text-help"
      />
      <span id="todo-text-help" hidden>
        Enter at least one non-whitespace character.
      </span>
      <button
        type="submit"
        data-verify-action="submit-todo"
        aria-label="Add todo"
        disabled={!submittable}
      >
        Add
      </button>
    </form>
  );
}
