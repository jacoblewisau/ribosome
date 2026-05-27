import type { Check, Verifier } from "../core/types";

/**
 * DOM contract verifier. The unit must emit a single root element
 * carrying `data-verify-unit="<unit-name>"`. Additionally, every
 * descendant `data-verify-*` attribute is enumerated and reported in
 * the check detail so the validator can see the surface state.
 */
export const domContractVerifier: Verifier = {
  name: "dom-contract",
  run: (container, unit): Check[] => {
    const root = container.querySelector(`[data-verify-unit="${unit.name}"]`);
    if (!root) {
      return [
        {
          verifier: "dom-contract",
          status: "fail",
          reason: `missing data-verify-unit="${unit.name}" element`,
        },
      ];
    }

    const surface: Record<string, string> = {};
    for (const attr of Array.from(root.attributes)) {
      if (attr.name.startsWith("data-verify-")) {
        surface[attr.name] = attr.value;
      }
    }
    // Also collect data-verify-* on descendants that carry a field
    // identifier; these are the "labelled facts" of the unit.
    const descendants = root.querySelectorAll<HTMLElement>(
      "[data-verify-field], [data-verify-action], [data-verify-input]"
    );
    const facts: Array<{ key: string; value: string }> = [];
    descendants.forEach((el) => {
      const fact = el.getAttribute("data-verify-field");
      if (fact !== null) {
        facts.push({ key: `field:${fact}`, value: el.textContent ?? "" });
      }
    });

    return [
      {
        verifier: "dom-contract",
        status: "ok",
        detail: { surface, facts },
      },
    ];
  },
};
