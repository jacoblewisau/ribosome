/**
 * Slice A unit tests: the Mission Control inbox renderer.
 *
 * These prove the operator-facing board programmatically: the stage
 * vocabulary, the needs-you / working / done bucketing, the title count, and
 * the guarantee that no raw internal step name ever leaks to the operator.
 */

import { describe, it, expect } from "vitest";
import {
  boardTitle,
  deriveStage,
  renderMissionControl,
  toRow,
  type ChainInput,
} from "./mission-control";

describe("deriveStage", () => {
  it("flags a story-writer chain with a pending story as needs-you", () => {
    expect(deriveStage({ current_step: "story-writer", gate_state: { story: "pending" } })).toEqual({
      stage: "Waiting for your OK on the story",
      needsYou: true,
      done: false,
    });
  });

  it("flags a spec-writer chain with a pending spec as needs-you", () => {
    expect(deriveStage({ current_step: "spec-writer", gate_state: { spec: "pending" } })).toEqual({
      stage: "Waiting for your OK on the plan",
      needsYou: true,
      done: false,
    });
  });

  it("treats an auto-approved spec as building, not waiting (Slice B)", () => {
    const r = deriveStage({ current_step: "builder", gate_state: { spec: "auto-approved" } });
    expect(r.needsYou).toBe(false);
    expect(r.done).toBe(false);
    expect(r.stage).toBe("Building (plan needed no decisions)");
  });

  it("treats a plain builder step as building, no action needed", () => {
    expect(deriveStage({ current_step: "builder", gate_state: { spec: "approved" } })).toEqual({
      stage: "Building",
      needsYou: false,
      done: false,
    });
  });

  it("treats a roadmap pending (planner) as needs-you", () => {
    const r = deriveStage({ current_step: "planner", gate_state: { roadmap: "pending" } });
    expect(r).toEqual({ stage: "Planning the breakdown", needsYou: true, done: false });
  });

  it("treats an opened PR as ready to merge (needs-you)", () => {
    expect(deriveStage({ current_step: "pr-shepherd", gate_state: { pr: "pending" } })).toEqual({
      stage: "Ready to merge",
      needsYou: true,
      done: false,
    });
    expect(deriveStage({ current_step: "pr-opened", gate_state: { pr: "pending" } }).needsYou).toBe(true);
  });

  it("treats a merged or completed chain as done, not needing the operator", () => {
    expect(deriveStage({ current_step: "completed" }).done).toBe(true);
    expect(deriveStage({ current_step: "completed" }).needsYou).toBe(false);
    expect(deriveStage({ current_step: "pr-opened", gate_state: { pr: "merged" } })).toEqual({
      stage: "Merged",
      needsYou: false,
      done: true,
    });
  });

  it("treats a cancelled chain as terminal and not needs-you", () => {
    expect(deriveStage({ current_step: "cancelled" })).toEqual({
      stage: "Cancelled",
      needsYou: false,
      done: true,
    });
  });

  it("the merge gate wins over the auto-approved spec label (order of checks)", () => {
    // A chain whose spec auto-advanced and is now at the PR stage must read
    // "Ready to merge", not "Building (plan needed no decisions)".
    const r = deriveStage({ current_step: "pr-shepherd", gate_state: { spec: "auto-approved", pr: "pending" } });
    expect(r.stage).toBe("Ready to merge");
    expect(r.needsYou).toBe(true);
  });

  it("is case-insensitive and tolerant of missing gate_state", () => {
    expect(deriveStage({ current_step: "CANCELLED" }).done).toBe(true);
    expect(deriveStage({ current_step: "builder" }).stage).toBe("Building");
    expect(deriveStage({}).stage).toBe("Working");
  });
});

describe("boardTitle", () => {
  it("puts the needs-you count in the title with correct grammar", () => {
    expect(boardTitle([])).toBe("Ribosome: all clear");
    expect(
      boardTitle([{ issue: 1, title: "a", stage: "x", needsYou: true, done: false }])
    ).toBe("Ribosome: 1 thing needs you");
    expect(
      boardTitle([
        { issue: 1, title: "a", stage: "x", needsYou: true, done: false },
        { issue: 2, title: "b", stage: "y", needsYou: true, done: false },
      ])
    ).toBe("Ribosome: 2 things need you");
  });

  it("does not count done rows even if they were once needs-you", () => {
    expect(
      boardTitle([{ issue: 1, title: "a", stage: "Merged", needsYou: false, done: true }])
    ).toBe("Ribosome: all clear");
  });
});

describe("renderMissionControl", () => {
  const sample: ChainInput[] = [
    { issue: 41, title: "Dark mode toggle", current_step: "spec-writer", gate_state: { spec: "pending" }, waiting: "2 days" },
    { issue: 44, title: "Fix login redirect", current_step: "pr-shepherd", gate_state: { pr: "pending" }, waiting: "1 day" },
    { issue: 46, title: "Weekly report email", current_step: "planner", gate_state: { roadmap: "pending" } },
    { issue: 39, title: "Export to CSV", current_step: "builder", gate_state: { spec: "approved" } },
    { issue: 47, title: "Tooltip wording", current_step: "builder", gate_state: { spec: "auto-approved" } },
    { issue: 40, title: "Add dark logo", current_step: "completed" },
  ];

  const render = (inputs: ChainInput[] = sample, updatedAt = "2026-06-02 14:03") =>
    renderMissionControl(inputs.map(toRow), { updatedAt });

  it("titles the board with the live needs-you count (3 of the 6)", () => {
    expect(render().title).toBe("Ribosome: 3 things need you");
  });

  it("renders the three inbox sections with the right members", () => {
    const { body } = render();
    expect(body).toContain("## Needs you (3)");
    expect(body).toContain("## Working, nothing needed");
    expect(body).toContain("## Done this week");
    // Needs-you members.
    expect(body).toMatch(/Needs you \(3\)[\s\S]*#41 Dark mode toggle: Waiting for your OK on the plan \(waiting 2 days\)/);
    expect(body).toMatch(/#44 Fix login redirect: Ready to merge \(waiting 1 day\)/);
    expect(body).toMatch(/#46 Weekly report email: Planning the breakdown/);
    // Working members, including the auto-approved label.
    expect(body).toMatch(/Working, nothing needed[\s\S]*#39 Export to CSV: Building/);
    expect(body).toContain("#47 Tooltip wording: Building (plan needed no decisions)");
    // Done member.
    expect(body).toMatch(/Done this week[\s\S]*#40 Add dark logo: Merged/);
  });

  it("numbers the needs-you rows in the given order", () => {
    const { body } = render();
    expect(body).toMatch(/1\. #41 /);
    expect(body).toMatch(/2\. #44 /);
    expect(body).toMatch(/3\. #46 /);
  });

  it("never leaks a raw internal step or gate name to the operator", () => {
    const { title, body } = render();
    const blob = `${title}\n${body}`;
    for (const leak of ["story-writer", "spec-writer", "pr-shepherd", "pr-opened", "current_step", "gate_state", "auto-approved", "roadmap"]) {
      expect(blob).not.toContain(leak);
    }
  });

  it("omits empty sections entirely", () => {
    const onlyWorking: ChainInput[] = [
      { issue: 1, title: "Solo build", current_step: "builder", gate_state: { spec: "approved" } },
    ];
    const { title, body } = render(onlyWorking);
    expect(title).toBe("Ribosome: all clear");
    expect(body).toContain("## Working, nothing needed");
    expect(body).not.toContain("## Needs you");
    expect(body).not.toContain("## Done this week");
  });

  it("handles an empty board gracefully", () => {
    const { title, body } = render([]);
    expect(title).toBe("Ribosome: all clear");
    expect(body).toContain("Nothing in flight right now");
    expect(body).toContain("refreshes on every step");
    // And the no-timestamp form yields the bare footer.
    expect(renderMissionControl([]).body).toContain("Refreshes on every step");
  });

  it("stamps the footer when given a timestamp", () => {
    expect(render().body).toContain("Last updated 2026-06-02 14:03, refreshes on every step.");
  });

  it("contains no en or em dash characters (prose convention)", () => {
    const { body } = render();
    expect(body).not.toMatch(/[–—]/);
  });
});
