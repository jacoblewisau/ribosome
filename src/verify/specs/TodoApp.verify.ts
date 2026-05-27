import { z } from "zod";
import { fireEvent } from "@testing-library/react";
import React from "react";
import { TodoApp } from "../../features/todos/TodoApp";
import type { VerifiableUnit } from "../core/types";
import { registerUnit } from "../core/registry";

export const TodoAppUnit: VerifiableUnit = {
  name: "TodoApp",
  props: z.object({}).strict(),
  fixtures: [
    {
      name: "empty",
      props: {},
      render: () => React.createElement(TodoApp),
      invariants: [
        (dom) => dom.querySelectorAll('li[data-verify-unit="TodoItem"]').length === 0,
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-total") === "0" || "data-verify-total should be 0 when empty";
        },
      ],
    },
    {
      name: "three-todos",
      props: {},
      render: () => React.createElement(TodoApp),
      act: async (container) => {
        const input = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        const submit = (text: string) => {
          fireEvent.change(input, { target: { value: text } });
          fireEvent.click(button);
        };
        submit("read paper");
        submit("rerun ChimeraX session");
        submit("email collaborator");
      },
      invariants: [
        (dom) => dom.querySelectorAll('li[data-verify-unit="TodoItem"]').length === 3,
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-total") === "3" || "expected total=3 after three submissions";
        },
      ],
    },
    {
      name: "toggle-marks-done",
      props: {},
      render: () => React.createElement(TodoApp),
      act: async (container) => {
        const input = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(input, { target: { value: "one" } });
        fireEvent.click(button);
        const toggle = container.querySelector('[data-verify-action="toggle-done"]') as HTMLInputElement;
        fireEvent.click(toggle);
      },
      invariants: [
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-done") === "1" || "expected done=1 after toggle";
        },
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-active") === "0" || "expected active=0 after toggle";
        },
      ],
    },
    {
      name: "with-tags-on-some-items",
      props: {},
      render: () => React.createElement(TodoApp),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const tagsIn = container.querySelector('[data-verify-input="todo-tags"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        // First todo: with two tags.
        fireEvent.change(text, { target: { value: "read paper" } });
        fireEvent.change(tagsIn, { target: { value: "urgent, follow-up" } });
        fireEvent.click(button);
        // Second todo: no tags.
        fireEvent.change(text, { target: { value: "send email" } });
        fireEvent.click(button);
      },
      invariants: [
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-tagged") === "1" || "expected tagged=1 (one todo of two has tags)";
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 2) return `expected 2 items, got ${items.length}`;
          const first = items[0]!;
          return first.getAttribute("data-verify-tag-count") === "2" || "expected first item tag-count=2";
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 2) return `expected 2 items, got ${items.length}`;
          const second = items[1]!;
          return second.getAttribute("data-verify-tag-count") === "0" || "expected second item tag-count=0";
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 2) return `expected 2 items, got ${items.length}`;
          const first = items[0]!;
          const tagsField = first.querySelector('[data-verify-field="tags"]');
          return tagsField?.textContent === "urgent, follow-up" || `expected joined tags "urgent, follow-up", got "${tagsField?.textContent}"`;
        },
      ],
    },
    {
      // Probe: asserts something deliberately false to prove the framework
      // catches lies. Three todos are added; the invariant claims total=999.
      // The dom-contract reports total=3 and the invariant fires "expected
      // total=999". Verdict: PASS (probes are expected to surface checks
      // marked "probe"); a verdict of FAIL here would be the bug.
      name: "total-claims-mismatch",
      props: {},
      render: () => React.createElement(TodoApp),
      act: async (container) => {
        const input = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        for (const text of ["a", "b", "c"]) {
          fireEvent.change(input, { target: { value: text } });
          fireEvent.click(button);
        }
      },
      invariants: [
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-total") === "999" || "probe expected total=999";
        },
      ],
      probe: true,
    },
  ],
};

registerUnit(TodoAppUnit);
