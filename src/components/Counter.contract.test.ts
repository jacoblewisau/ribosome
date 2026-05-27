import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { Counter, type CounterProps } from "./Counter";

/**
 * Counter contract.
 *
 * Three things every contract declares, per plan §9:
 *   1. Fixtures: canonical example inputs.
 *   2. Invariants: assertions that must hold across all fixtures.
 *   3. DOM contract: the set of `data-contract` selectors that must exist
 *      and behave as described.
 *
 * The validator reads the JSON output of `npm run verify` and reasons
 * against this contract. It does not read the source.
 */

interface Fixture {
  name: string;
  props: Partial<CounterProps>;
}

const FIXTURES: ReadonlyArray<Fixture> = [
  { name: "defaults", props: {} },
  { name: "custom-initial", props: { initial: 5 } },
  { name: "custom-step", props: { initial: 0, step: 3 } },
  { name: "custom-label", props: { label: "Replicons" } },
];

const DOM_CONTRACT = {
  "counter": "the root section of the component",
  "counter.label": "the label heading; text matches the `label` prop",
  "counter.value": "the current value display; text is the numeric value",
  "counter.increment": "the increment button; click increases the value by `step`",
  "counter.reset": "the reset button; click returns the value to the `initial` prop",
} as const;

describe("Counter contract", () => {
  it("declares its DOM contract", () => {
    // Smoke check that the contract dictionary is exported and non-empty.
    // The set of selectors here is the source of truth.
    expect(Object.keys(DOM_CONTRACT).length).toBeGreaterThan(0);
  });

  describe("invariants over fixtures", () => {
    for (const fixture of FIXTURES) {
      describe(`fixture: ${fixture.name}`, () => {
        it("renders without throwing", () => {
          const { container } = render(React.createElement(Counter, fixture.props));
          expect(container).toBeTruthy();
        });

        it("exposes every DOM contract selector", () => {
          const { container } = render(React.createElement(Counter, fixture.props));
          for (const selector of Object.keys(DOM_CONTRACT)) {
            const node = container.querySelector(`[data-contract="${selector}"]`);
            expect(node, `missing selector: ${selector}`).not.toBeNull();
          }
        });

        it("renders the label prop into counter.label", () => {
          const expected = fixture.props.label ?? "Counter";
          const { container } = render(React.createElement(Counter, fixture.props));
          const label = container.querySelector('[data-contract="counter.label"]');
          expect(label?.textContent).toBe(expected);
        });

        it("renders the initial value into counter.value", () => {
          const expected = fixture.props.initial ?? 0;
          const { container } = render(React.createElement(Counter, fixture.props));
          const value = container.querySelector('[data-contract="counter.value"]');
          expect(value?.textContent).toBe(String(expected));
        });

        it("increments by step when counter.increment is clicked", () => {
          const initial = fixture.props.initial ?? 0;
          const step = fixture.props.step ?? 1;
          const { container } = render(React.createElement(Counter, fixture.props));
          const button = container.querySelector(
            '[data-contract="counter.increment"]'
          ) as HTMLButtonElement | null;
          expect(button).not.toBeNull();
          fireEvent.click(button!);
          const value = container.querySelector('[data-contract="counter.value"]');
          expect(value?.textContent).toBe(String(initial + step));
        });

        it("increments idempotently across multiple clicks", () => {
          const initial = fixture.props.initial ?? 0;
          const step = fixture.props.step ?? 1;
          const { container } = render(React.createElement(Counter, fixture.props));
          const button = container.querySelector(
            '[data-contract="counter.increment"]'
          ) as HTMLButtonElement | null;
          fireEvent.click(button!);
          fireEvent.click(button!);
          fireEvent.click(button!);
          const value = container.querySelector('[data-contract="counter.value"]');
          expect(value?.textContent).toBe(String(initial + step * 3));
        });

        it("reset on an unmodified counter is a no-op", () => {
          const initial = fixture.props.initial ?? 0;
          const { container } = render(React.createElement(Counter, fixture.props));
          const resetButton = container.querySelector(
            '[data-contract="counter.reset"]'
          ) as HTMLButtonElement | null;
          expect(resetButton).not.toBeNull();
          fireEvent.click(resetButton!);
          const value = container.querySelector('[data-contract="counter.value"]');
          expect(value?.textContent).toBe(String(initial));
        });

        it("reset returns the value to initial after some increments", () => {
          const initial = fixture.props.initial ?? 0;
          const { container } = render(React.createElement(Counter, fixture.props));
          const inc = container.querySelector(
            '[data-contract="counter.increment"]'
          ) as HTMLButtonElement | null;
          const reset = container.querySelector(
            '[data-contract="counter.reset"]'
          ) as HTMLButtonElement | null;
          fireEvent.click(inc!);
          fireEvent.click(inc!);
          fireEvent.click(reset!);
          const value = container.querySelector('[data-contract="counter.value"]');
          expect(value?.textContent).toBe(String(initial));
        });

        it("increment after reset adds step to initial, not to pre-reset value", () => {
          const initial = fixture.props.initial ?? 0;
          const step = fixture.props.step ?? 1;
          const { container } = render(React.createElement(Counter, fixture.props));
          const inc = container.querySelector(
            '[data-contract="counter.increment"]'
          ) as HTMLButtonElement | null;
          const reset = container.querySelector(
            '[data-contract="counter.reset"]'
          ) as HTMLButtonElement | null;
          fireEvent.click(inc!);
          fireEvent.click(inc!);
          fireEvent.click(inc!);
          fireEvent.click(reset!);
          fireEvent.click(inc!);
          const value = container.querySelector('[data-contract="counter.value"]');
          expect(value?.textContent).toBe(String(initial + step));
        });

        it("reset is idempotent across multiple clicks", () => {
          const initial = fixture.props.initial ?? 0;
          const { container } = render(React.createElement(Counter, fixture.props));
          const inc = container.querySelector(
            '[data-contract="counter.increment"]'
          ) as HTMLButtonElement | null;
          const reset = container.querySelector(
            '[data-contract="counter.reset"]'
          ) as HTMLButtonElement | null;
          fireEvent.click(inc!);
          fireEvent.click(reset!);
          fireEvent.click(reset!);
          fireEvent.click(reset!);
          const value = container.querySelector('[data-contract="counter.value"]');
          expect(value?.textContent).toBe(String(initial));
        });
      });
    }
  });
});
