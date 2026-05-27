import { useState } from "react";

export interface CounterProps {
  initial?: number;
  step?: number;
  label?: string;
}

/**
 * Counter. Single-component substrate for exercising the Ribosome chain.
 *
 * The `data-contract` attributes are part of the machine-readable DOM
 * contract declared in `Counter.contract.test.ts`. They are how the
 * validator observes behaviour without depending on text content or
 * CSS class names. Do not rename or remove a `data-contract` attribute
 * without updating the contract.
 */
export function Counter({ initial = 0, step = 1, label = "Counter" }: CounterProps) {
  const [value, setValue] = useState(initial);

  return (
    <section data-contract="counter">
      <h2 data-contract="counter.label">{label}</h2>
      <p data-contract="counter.value">{value}</p>
      <button
        type="button"
        data-contract="counter.increment"
        onClick={() => setValue((v) => v + step)}
      >
        Add {step}
      </button>
    </section>
  );
}
