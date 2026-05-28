/**
 * Acceptance test for chain 0005.
 *
 * Story: stories/0005.md
 * Spec:  specs/0005.md
 *
 * Asserts the h2 inside `<TodoApp />` renders the literal string "My todos"
 * (lowercase t in "todos") and preserves its `data-verify-unit-label="TodoApp"`
 * attribute. The acceptance criteria require strict equality on the text
 * content; this also catches any title-case regression ("My Todos").
 */

import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { TodoApp } from "../../src/features/todos/TodoApp";

describe("chain 0005 acceptance: TodoApp heading copy", () => {
  it('renders the h2 with text "My todos" and keeps the verify-unit-label attribute', () => {
    const { container } = render(createElement(TodoApp));

    const heading = container.querySelector('[data-verify-unit-label="TodoApp"]');
    expect(heading).not.toBeNull();
    // Narrow for TypeScript strict mode with noUncheckedIndexedAccess.
    if (heading === null) throw new Error("heading not found");

    expect(heading.tagName).toBe("H2");
    expect(heading.textContent).toBe("My todos");
    expect(heading.getAttribute("data-verify-unit-label")).toBe("TodoApp");
  });
});
