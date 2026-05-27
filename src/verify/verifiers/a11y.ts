import type { Check, Verifier } from "../core/types";

/**
 * Accessibility verifier. Catches the most common accessibility
 * regressions an LLM-driven build is likely to introduce:
 *
 *   1. Every button must have an accessible name (`aria-label`,
 *      `aria-labelledby`, or non-empty text content).
 *   2. Every input must have a label (`aria-label`,
 *      `aria-labelledby`, or an associated `<label>` element via
 *      `for`/`id` or wrapping).
 *   3. Every `<img>` must have an `alt` attribute (may be empty
 *      string for decorative images, but must be present).
 *
 * This is intentionally narrow. It is not a substitute for axe or a
 * full WCAG audit; it catches the high-frequency mistakes and frees
 * the human reviewer for the rest.
 */
export const a11yVerifier: Verifier = {
  name: "a11y",
  run: (container): Check[] => {
    const checks: Check[] = [];

    // Buttons
    const buttons = container.querySelectorAll<HTMLElement>("button");
    buttons.forEach((b, i) => {
      const named =
        b.hasAttribute("aria-label") ||
        b.hasAttribute("aria-labelledby") ||
        (b.textContent !== null && b.textContent.trim().length > 0);
      if (!named) {
        checks.push({
          verifier: "a11y",
          status: "fail",
          reason: `button[${i}] has no accessible name`,
        });
      }
    });

    // Inputs
    const inputs = container.querySelectorAll<HTMLInputElement>("input");
    inputs.forEach((input, i) => {
      const id = input.id;
      const hasAriaLabel =
        input.hasAttribute("aria-label") || input.hasAttribute("aria-labelledby");
      const hasAssociatedLabel = id
        ? container.querySelector(`label[for="${id}"]`) !== null
        : false;
      const hasWrappingLabel = input.closest("label") !== null;
      if (!hasAriaLabel && !hasAssociatedLabel && !hasWrappingLabel) {
        checks.push({
          verifier: "a11y",
          status: "fail",
          reason: `input[${i}] has no label`,
        });
      }
    });

    // Images
    const images = container.querySelectorAll<HTMLImageElement>("img");
    images.forEach((img, i) => {
      if (!img.hasAttribute("alt")) {
        checks.push({
          verifier: "a11y",
          status: "fail",
          reason: `img[${i}] has no alt attribute (use alt="" for decorative)`,
        });
      }
    });

    if (checks.length === 0) {
      checks.push({ verifier: "a11y", status: "ok" });
    }
    return checks;
  },
};
