import { useState, type FormEvent } from "react";
import { parseTagsInput } from "./todos.feature";
import { verifyAttrs } from "../../verify/core/contract";

export interface TodoFormProps {
  onSubmit: (text: string, tags: string[]) => void;
}

/**
 * TodoForm. Text input plus tag input plus submit button.
 * Whitespace-only text submissions are rejected (button disabled).
 * The tag input is optional; empty tag input produces an empty tag
 * array. Tag parsing (split / trim / dedupe) happens inside the form
 * via `parseTagsInput`.
 */
export function TodoForm({ onSubmit }: TodoFormProps) {
  const [text, setText] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const trimmed = text.trim();
  const submittable = trimmed.length > 0;
  const parsedTags = parseTagsInput(tagsRaw);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!submittable) return;
    onSubmit(trimmed, parsedTags);
    setText("");
    setTagsRaw("");
  }

  const attrs = verifyAttrs("TodoForm", {
    "input-length": text.length,
    "trimmed-length": trimmed.length,
    "tags-input-length": tagsRaw.length,
    "parsed-tag-count": parsedTags.length,
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
