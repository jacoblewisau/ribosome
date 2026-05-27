import { useState, type FormEvent } from "react";
import { parseTagsInput, parseDueDateInput } from "./todos.feature";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoFormProps {
  onSubmit: (text: string, tags: string[], dueDate: number | undefined) => void;
}

/**
 * TodoForm. Text input plus tag input plus optional due-date input
 * plus submit button. Whitespace-only text submissions are rejected
 * (button disabled). The tag input is optional; empty produces an
 * empty array. The due-date input is optional; empty or malformed
 * produces undefined. Parsing happens in the form via the pure
 * helpers from todos.feature.
 */
export function TodoForm({ onSubmit }: TodoFormProps) {
  const [text, setText] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [dueRaw, setDueRaw] = useState("");
  const trimmed = text.trim();
  const submittable = trimmed.length > 0;
  const parsedTags = parseTagsInput(tagsRaw);
  const parsedDueDate = parseDueDateInput(dueRaw);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!submittable) return;
    onSubmit(trimmed, parsedTags, parsedDueDate);
    setText("");
    setTagsRaw("");
    setDueRaw("");
  }

  const attrs = verifyAttrs("TodoForm", {
    "input-length": text.length,
    "trimmed-length": trimmed.length,
    "tags-input-length": tagsRaw.length,
    "parsed-tag-count": parsedTags.length,
    "due-input-length": dueRaw.length,
    "due-parsed": parsedDueDate !== undefined,
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
      <label htmlFor="todo-tags">Tags</label>
      <input
        id="todo-tags"
        type="text"
        value={tagsRaw}
        onChange={(e) => setTagsRaw(e.target.value)}
        data-verify-input="todo-tags"
        aria-describedby="todo-tags-help"
        placeholder="comma, separated"
      />
      <span id="todo-tags-help" hidden>
        Comma-separated. Duplicates and whitespace-only parts are dropped.
      </span>
      <label htmlFor="todo-due">Due</label>
      <input
        id="todo-due"
        type="date"
        value={dueRaw}
        onChange={(e) => setDueRaw(e.target.value)}
        data-verify-input="todo-due"
        aria-describedby="todo-due-help"
      />
      <span id="todo-due-help" hidden>
        Optional. Calendar day in your local time zone.
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
