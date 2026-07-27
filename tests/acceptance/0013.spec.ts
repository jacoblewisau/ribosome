/**
 * Acceptance test for tweak 0013.
 *
 * Spec:  specs/0013.md
 * Issue: #92 (doc-drift)
 *
 * Regression: the coordinator records an auto-advanced spec gate as
 * gate_state.spec: "auto-approved" (ADR-0005). This asserts that value
 * survives an updateChain -> readChain round-trip instead of being collapsed
 * to "pending" by normaliseGateState, and that "approved" and "auto-approved"
 * stay distinct on the same read.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _purgeForTests, initChain, readChain, updateChain } from "../../src/chain/state";

const ID = "test-acceptance-0013";

beforeEach(() => {
  _purgeForTests(ID, "I-KNOW-WHAT-I-AM-DOING");
});

afterEach(() => {
  _purgeForTests(ID, "I-KNOW-WHAT-I-AM-DOING");
});

describe("chain 0013 acceptance: auto-approved spec gate round-trips", () => {
  it("preserves gate_state.spec: auto-approved through updateChain then readChain", () => {
    initChain(ID, { issue: "#92", path: "full", path_reason: "tweak 0013" });

    updateChain(ID, {
      current_step: "builder",
      gate_state: { story: "approved", spec: "auto-approved", pr: "pending" },
    });

    const reread = readChain(ID);
    // The regression this test guards: it must not collapse to "pending".
    expect(reread.gate_state.spec).toBe("auto-approved");
    // approved and auto-approved stay distinct on the same round-trip.
    expect(reread.gate_state.story).toBe("approved");
    expect(reread.gate_state.pr).toBe("pending");
  });
});
