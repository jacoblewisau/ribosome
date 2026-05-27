import { z } from "zod";
import { fireEvent } from "@testing-library/react";
import React from "react";
import { TodoApp } from "../../features/todos/TodoApp";
import { addTodo, initialState, parseTagsInput } from "../../features/todos/todos.feature";
import type { VerifiableUnit } from "../core/types";
import { registerUnit } from "../core/registry";

/**
 * todos.feature verify spec.
 *
 * Feature-level fixtures exercise the business logic surface plus the
 * UI together. `whitespace-submit` is a behavioural probe: the form is
 * given whitespace-only input and submitted; the count must not
 * change. The probe records the outcome so a regression in the
 * feature module (or the form) surfaces.
 */

export const TodosFeatureUnit: VerifiableUnit = {
  name: "todos.feature",
  props: z.object({}).strict(),
  fixtures: [
    {
      name: "add-rejects-empty",
      props: {},
      render: () =>
        React.createElement(
          "div",
          { "data-verify-unit": "todos.feature" },
          React.createElement(TodoApp)
        ),
      invariants: [
        () => {
          const after = addTodo(initialState, "");
          return after.items.length === 0 || "addTodo on empty string should not append";
        },
      ],
    },
    {
      name: "add-rejects-whitespace",
      props: {},
      render: () =>
        React.createElement(
          "div",
          { "data-verify-unit": "todos.feature" },
          React.createElement(TodoApp)
        ),
      invariants: [
        () => {
          const after = addTodo(initialState, "   \t\n  ");
          return after.items.length === 0 || "addTodo on whitespace string should not append";
        },
      ],
    },
    {
      name: "tags-parse-and-trim",
      props: {},
      render: () =>
        React.createElement(
          "div",
          { "data-verify-unit": "todos.feature" },
          React.createElement(TodoApp)
        ),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const tags = container.querySelector('[data-verify-input="todo-tags"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "test" } });
        // Whitespace, empty parts, and a duplicate. Expect ["a", "b", "c"].
        fireEvent.change(tags, { target: { value: "  a  , b  ,, c  , a" } });
        fireEvent.click(button);
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-tag-count") === "3" || "expected tag-count=3 after parse";
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          const tagsField = items[0]!.querySelector('[data-verify-field="tags"]');
          return tagsField?.textContent === "a, b, c" || `expected "a, b, c", got "${tagsField?.textContent}"`;
        },
        () => {
          // Spot check the pure parser too.
          const parsed = parseTagsInput("  a  , b  ,, c  , a");
          if (parsed.length !== 3) return `parser returned ${parsed.length} tags, want 3`;
          if (parsed.join(",") !== "a,b,c") return `parser order/values wrong: ${parsed.join(",")}`;
          return true;
        },
      ],
    },
    {
      // Probe: tags-dedupe-fails. Asserts that "x, x, x" yields three tags.
      // The parser dedupes to one, so tag-count is "1". The invariant fires.
      // Verdict: PASS (probe). Confirms the dedupe path is exercised.
      name: "tags-dedupe-fails",
      props: {},
      render: () =>
        React.createElement(
          "div",
          { "data-verify-unit": "todos.feature" },
          React.createElement(TodoApp)
        ),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const tags = container.querySelector('[data-verify-input="todo-tags"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "test" } });
        fireEvent.change(tags, { target: { value: "x, x, x" } });
        fireEvent.click(button);
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-tag-count") === "3" || "probe expected tag-count=3";
        },
      ],
      probe: true,
    },
    {
      name: "whitespace-submit",
      props: {},
      render: () =>
        React.createElement(
          "div",
          { "data-verify-unit": "todos.feature" },
          React.createElement(TodoApp)
        ),
      act: async (container) => {
        const input = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(input, { target: { value: "   \t\n   " } });
        // The button is disabled for whitespace, so clicking should be a no-op.
        // If a future refactor accidentally enables the button, the count
        // would increment and the invariant below surfaces.
        fireEvent.click(button);
      },
      invariants: [
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-total") === "0" || "whitespace submit must not produce a todo";
        },
      ],
    },
    {
      // Probe: claims-empty-list. Renders the empty TodoApp inside the
      // feature wrapper and asserts a deliberately false claim
      // (total=5). The dom-contract verifier records total=0; the
      // invariant fires. Verdict: PASS (because probe). Confirms the
      // framework catches false claims at the feature level too.
      name: "claims-empty-list",
      props: {},
      render: () =>
        React.createElement(
          "div",
          { "data-verify-unit": "todos.feature" },
          React.createElement(TodoApp)
        ),
      invariants: [
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-total") === "5" || "probe expected total=5";
        },
      ],
      probe: true,
    },
  ],
};

registerUnit(TodosFeatureUnit);
