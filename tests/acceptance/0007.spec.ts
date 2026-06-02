/**
 * Acceptance test for chain 0007.
 *
 * Story: stories/0007.md
 * Spec:  specs/0007.md
 *
 * Footer copy was changed from "Built with Ribosome" to "Made with Ribosome"
 * by chain 0008 (issue #44). This test pins the current wording, so it is in
 * scope for that tweak (CLAUDE.md rule 13: a test pinning a changed literal).
 *
 * Renders the whole <App /> and asserts the new credit line:
 *   - it is a semantic <footer> landmark (criterion 3),
 *   - its text content is exactly "Made with Ribosome" (criteria 1, 6),
 *   - the existing <h1> ("Ribosome substrate") still renders, confirming the
 *     footer is additive and did not displace existing content (criterion 4).
 *
 * The exact-string assertion pins casing and spacing: a title-case regression
 * ("Made With Ribosome") or stray whitespace from JSX indentation fails here.
 */

import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { App } from "../../src/App";

describe("chain 0007 acceptance: footer credit line", () => {
  it('renders a <footer> whose text is exactly "Made with Ribosome"', () => {
    const { container } = render(createElement(App));

    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
    // Narrow for TypeScript strict mode with noUncheckedIndexedAccess.
    if (footer === null) throw new Error("footer not found");

    expect(footer.tagName).toBe("FOOTER");
    expect(footer.textContent).toBe("Made with Ribosome");
  });

  it("leaves the existing heading unchanged (footer is additive)", () => {
    const { container } = render(createElement(App));

    const heading = container.querySelector("h1");
    expect(heading).not.toBeNull();
    if (heading === null) throw new Error("h1 not found");

    expect(heading.textContent).toBe("Ribosome substrate");
  });
});
