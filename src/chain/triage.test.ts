/**
 * Slices B and C unit tests: the deterministic gate decisions.
 *
 * Proves the safety-posture logic programmatically: an unflagged spec
 * auto-advances, a flagged spec holds, and the tweak fast-path escalates a
 * change that is bigger than a tweak (or whose size is unknown).
 */

import { describe, it, expect } from "vitest";
import {
  FLAG_CATEGORIES,
  TWEAK_BUDGET,
  decideSpecGate,
  evaluateTweakSize,
} from "./triage";

describe("decideSpecGate (Slice B)", () => {
  it("auto-advances when there are no flags", () => {
    expect(decideSpecGate([])).toEqual({ needs_operator: false, flags: [] });
    expect(decideSpecGate(null)).toEqual({ needs_operator: false, flags: [] });
    expect(decideSpecGate(undefined)).toEqual({ needs_operator: false, flags: [] });
  });

  it("holds the gate when any flag is present", () => {
    const d = decideSpecGate(["new dependency: zod-form"]);
    expect(d.needs_operator).toBe(true);
    expect(d.flags).toEqual(["new dependency: zod-form"]);
  });

  it("ignores blank / whitespace-only flags so an empty-ish list still advances", () => {
    expect(decideSpecGate(["", "   "])).toEqual({ needs_operator: false, flags: [] });
    expect(decideSpecGate(["  ", "new email sender: notifications@app"]).needs_operator).toBe(true);
  });

  it("trims flag text", () => {
    expect(decideSpecGate(["  payments: Stripe checkout  "]).flags).toEqual([
      "payments: Stripe checkout",
    ]);
  });

  it("exposes the six sensitive categories as the contract", () => {
    expect([...FLAG_CATEGORIES]).toEqual([
      "personal-data",
      "third-party-service",
      "email-sender",
      "new-dependency",
      "auth",
      "payments",
    ]);
  });
});

describe("evaluateTweakSize (Slice C)", () => {
  it("keeps a genuinely small change on the fast-path", () => {
    const d = evaluateTweakSize({ files: 1, lines: 2 });
    expect(d.withinBudget).toBe(true);
    expect(d.escalate).toBe(false);
  });

  it("treats the exact budget boundary as within budget", () => {
    expect(evaluateTweakSize({ files: TWEAK_BUDGET.files, lines: TWEAK_BUDGET.lines }).withinBudget).toBe(true);
  });

  it("escalates when over the file budget", () => {
    const d = evaluateTweakSize({ files: TWEAK_BUDGET.files + 1, lines: 1 });
    expect(d.escalate).toBe(true);
    expect(d.reason).toContain("files over");
  });

  it("escalates when over the line budget", () => {
    const d = evaluateTweakSize({ files: 1, lines: TWEAK_BUDGET.lines + 1 });
    expect(d.escalate).toBe(true);
    expect(d.reason).toContain("lines over");
  });

  it("fails safe: an unknown size escalates rather than slipping through", () => {
    const d = evaluateTweakSize({ files: NaN, lines: 5 });
    expect(d.escalate).toBe(true);
    expect(d.withinBudget).toBe(false);
  });
});
