import { z } from "zod";
import { fireEvent } from "@testing-library/react";
import React from "react";
import { TodoApp } from "../../features/todos/TodoApp";
import type { VerifiableUnit } from "../core/types";
import { registerUnit } from "../core/registry";

/**
 * FIXED_NOW: 2026-05-15T00:00:00Z (Unix ms). All fixtures inject this
 * clock so overdue derivation is reproducible. Choose dueDate values
 * relative to this constant when writing a fixture that exercises
 * overdue behaviour.
 */
const FIXED_NOW = Date.UTC(2026, 4, 15, 0, 0, 0); // month index 4 = May
const PAST_DUE_INPUT = "2026-05-10"; // 5 days before FIXED_NOW
const FUTURE_DUE_INPUT = "2027-05-15"; // a year after

function makeClock() {
  return () => FIXED_NOW;
}

export const TodoAppUnit: VerifiableUnit = {
  name: "TodoApp",
  props: z.object({}).strict(),
  fixtures: [
    {
      name: "empty",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      invariants: [
        (dom) => dom.querySelectorAll('li[data-verify-unit="TodoItem"]').length === 0,
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-total") === "0" || "data-verify-total should be 0 when empty";
        },
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-overdue-count") === "0" || "overdue-count should be 0 when empty";
        },
      ],
    },
    {
      name: "three-todos",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
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
      render: () => React.createElement(TodoApp, { now: makeClock() }),
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
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const tagsIn = container.querySelector('[data-verify-input="todo-tags"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "read paper" } });
        fireEvent.change(tagsIn, { target: { value: "urgent, follow-up" } });
        fireEvent.click(button);
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
      name: "overdue-when-date-past",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const due = container.querySelector('[data-verify-input="todo-due"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "overdue paper" } });
        fireEvent.change(due, { target: { value: PAST_DUE_INPUT } });
        fireEvent.click(button);
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-overdue") === "true" || "expected item overdue=true";
        },
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-overdue-count") === "1" || "expected overdue-count=1";
        },
        (dom) => {
          const stats = dom.querySelector('[data-verify-unit="TodoStats"]');
          return stats?.getAttribute("data-verify-overdue") === "1" || "expected TodoStats overdue=1";
        },
      ],
    },
    {
      name: "done-todo-with-past-date-not-overdue",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const due = container.querySelector('[data-verify-input="todo-due"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "stale but done" } });
        fireEvent.change(due, { target: { value: PAST_DUE_INPUT } });
        fireEvent.click(button);
        const toggle = container.querySelector('[data-verify-action="toggle-done"]') as HTMLInputElement;
        fireEvent.click(toggle);
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-overdue") === "false" || "expected overdue=false on done todo";
        },
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-overdue-count") === "0" || "expected overdue-count=0 for done item";
        },
      ],
    },
    {
      name: "filter-overdue-only-shows-overdue",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const due = container.querySelector('[data-verify-input="todo-due"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        // Three todos: overdue-active, overdue-done, future-active.
        fireEvent.change(text, { target: { value: "a" } });
        fireEvent.change(due, { target: { value: PAST_DUE_INPUT } });
        fireEvent.click(button);
        fireEvent.change(text, { target: { value: "b" } });
        fireEvent.change(due, { target: { value: PAST_DUE_INPUT } });
        fireEvent.click(button);
        fireEvent.change(text, { target: { value: "c" } });
        fireEvent.change(due, { target: { value: FUTURE_DUE_INPUT } });
        fireEvent.click(button);
        // Mark the second (b) done.
        const toggles = container.querySelectorAll('[data-verify-action="toggle-done"]');
        fireEvent.click(toggles[1]!);
        // Select the overdue filter.
        const overdueBtn = container.querySelector('[data-verify-filter-choice="overdue"]') as HTMLButtonElement;
        fireEvent.click(overdueBtn);
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          return items.length === 1 || `expected 1 visible (overdue-active) item, got ${items.length}`;
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          const text = items[0]?.querySelector('[data-verify-field="text"]')?.textContent;
          return text === "a" || `expected the overdue-active todo "a", got "${text}"`;
        },
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoApp"]');
          return root?.getAttribute("data-verify-filter") === "overdue" || "filter should be overdue";
        },
      ],
    },
    {
      name: "edit-saves-on-enter",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "draft" } });
        fireEvent.click(button);
        const span = container.querySelector('[data-verify-action="enter-edit"]') as HTMLSpanElement;
        fireEvent.click(span);
        const editInput = container.querySelector('[data-verify-input="edit-text"]') as HTMLInputElement;
        fireEvent.change(editInput, { target: { value: "final" } });
        fireEvent.keyDown(editInput, { key: "Enter" });
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-editing") === "false" || "expected editing=false after Enter";
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          const span = items[0]!.querySelector('[data-verify-field="text"]');
          return span?.textContent === "final" || `expected text="final" after edit, got "${span?.textContent}"`;
        },
      ],
    },
    {
      name: "edit-cancels-on-escape",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "keep" } });
        fireEvent.click(button);
        const span = container.querySelector('[data-verify-action="enter-edit"]') as HTMLSpanElement;
        fireEvent.click(span);
        const editInput = container.querySelector('[data-verify-input="edit-text"]') as HTMLInputElement;
        fireEvent.change(editInput, { target: { value: "throwaway" } });
        fireEvent.keyDown(editInput, { key: "Escape" });
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-editing") === "false" || "expected editing=false after Escape";
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          const span = items[0]?.querySelector('[data-verify-field="text"]');
          return span?.textContent === "keep" || `expected text unchanged "keep", got "${span?.textContent}"`;
        },
      ],
    },
    {
      name: "edit-cancels-on-blur",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "stay" } });
        fireEvent.click(button);
        const span = container.querySelector('[data-verify-action="enter-edit"]') as HTMLSpanElement;
        fireEvent.click(span);
        const editInput = container.querySelector('[data-verify-input="edit-text"]') as HTMLInputElement;
        fireEvent.change(editInput, { target: { value: "different" } });
        fireEvent.blur(editInput);
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-editing") === "false" || "expected editing=false after blur";
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          const span = items[0]?.querySelector('[data-verify-field="text"]');
          return span?.textContent === "stay" || `expected text unchanged "stay", got "${span?.textContent}"`;
        },
      ],
    },
    {
      name: "edit-rejects-empty-on-enter",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "keep" } });
        fireEvent.click(button);
        const span = container.querySelector('[data-verify-action="enter-edit"]') as HTMLSpanElement;
        fireEvent.click(span);
        const editInput = container.querySelector('[data-verify-input="edit-text"]') as HTMLInputElement;
        fireEvent.change(editInput, { target: { value: "   " } });
        fireEvent.keyDown(editInput, { key: "Enter" });
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-editing") === "false" || "expected editing=false after empty Enter";
        },
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          const span = items[0]?.querySelector('[data-verify-field="text"]');
          return span?.textContent === "keep" || `expected text unchanged "keep", got "${span?.textContent}"`;
        },
      ],
    },
    {
      // Probe: claim-not-editing-after-click. Renders one todo, clicks
      // its text (which DOES enter editing). The invariant claims
      // data-verify-editing="false". The actual DOM has editing="true".
      // The invariant fires; verdict PASS via probe. Pairs with
      // edit-saves-on-enter per pat-probe-pairs-with-behavior.
      name: "claim-not-editing-after-click",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "one" } });
        fireEvent.click(button);
        const span = container.querySelector('[data-verify-action="enter-edit"]') as HTMLSpanElement;
        fireEvent.click(span);
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-editing") === "false" || "probe expected editing=false (actually true)";
        },
      ],
      probe: true,
    },
    {
      name: "total-claims-mismatch",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
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
    {
      name: "claims-future-date-is-overdue",
      props: {},
      render: () => React.createElement(TodoApp, { now: makeClock() }),
      act: async (container) => {
        const text = container.querySelector('[data-verify-input="todo-text"]') as HTMLInputElement;
        const due = container.querySelector('[data-verify-input="todo-due"]') as HTMLInputElement;
        const button = container.querySelector('[data-verify-action="submit-todo"]') as HTMLButtonElement;
        fireEvent.change(text, { target: { value: "future paper" } });
        fireEvent.change(due, { target: { value: FUTURE_DUE_INPUT } });
        fireEvent.click(button);
      },
      invariants: [
        (dom) => {
          const items = dom.querySelectorAll('[data-verify-unit="TodoItem"]');
          if (items.length !== 1) return `expected 1 item, got ${items.length}`;
          return items[0]!.getAttribute("data-verify-overdue") === "true" || "probe expected overdue=true on future-dated todo";
        },
      ],
      probe: true,
    },
  ],
};

registerUnit(TodoAppUnit);
