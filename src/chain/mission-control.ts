/**
 * Mission Control renderer. Slice A of the native-GitHub bundle.
 *
 * Pure TypeScript, no I/O. Given the state of the open chains, produces the
 * title and body for the single pinned `ribo:in-flight` Issue, laid out as an
 * inbox: "Needs you" first, then "Working", then "Done this week".
 *
 * The coordinator and the shepherd gather the chain states (by scanning open
 * Issues via gh and parsing each sticky state marker) and call the
 * `scripts/mission-control.ts` CLI, which wraps this module. Keeping the render
 * logic here, pure and unit-tested, means the operator-facing board never
 * drifts in formatting and the stage vocabulary (plain language, never a raw
 * step name) has exactly one home.
 *
 * Read-only by design: the board links to each Issue and the operator acts
 * there with the existing slash commands. No buttons, no external services.
 */

/** The subset of a chain's sticky state marker that decides its stage. */
export interface StickyLike {
  current_step?: string | null;
  gate_state?: Record<string, string | null | undefined> | null;
}

export interface StageInfo {
  /** Plain-language stage shown to the operator. Never a raw step name. */
  stage: string;
  /** True when this chain is waiting on the operator. Drives "Needs you". */
  needsYou: boolean;
  /** True for terminal chains (merged, completed, cancelled). Drives "Done". */
  done: boolean;
}

/** One open (or recently closed) chain, as gathered from its Issue. */
export interface ChainInput extends StickyLike {
  issue: number;
  title: string;
  /** Optional human "2 days" hint shown on the Needs-you rows. */
  waiting?: string;
}

export interface ChainRow {
  issue: number;
  title: string;
  stage: string;
  needsYou: boolean;
  done: boolean;
  waiting?: string;
}

export interface RenderOptions {
  /** ISO-ish timestamp string for the footer. The caller stamps it so the
   *  renderer stays pure (no Date.now). */
  updatedAt?: string;
}

function lc(v?: string | null): string {
  return (v ?? "").toString().trim().toLowerCase();
}

/**
 * Map a chain's raw state (current_step + gate_state) to the operator-facing
 * stage, whether it needs the operator, and whether it is terminal. This is
 * the single source of the stage vocabulary; the order of the checks is the
 * contract (most specific first).
 */
export function deriveStage(s: StickyLike): StageInfo {
  const step = lc(s.current_step);
  const g = s.gate_state ?? {};
  const story = lc(g.story);
  const spec = lc(g.spec);
  const pr = lc(g.pr);
  const roadmap = lc(g.roadmap);

  // Terminal states first.
  if (step === "cancelled") return { stage: "Cancelled", needsYou: false, done: true };
  if (step === "completed" || pr === "merged") {
    return { stage: "Merged", needsYou: false, done: true };
  }

  // Gates awaiting the operator.
  if (roadmap === "pending") {
    return { stage: "Planning the breakdown", needsYou: true, done: false };
  }
  if (step === "story-writer" && story === "pending") {
    return { stage: "Waiting for your OK on the story", needsYou: true, done: false };
  }
  if (step === "spec-writer" && spec === "pending") {
    return { stage: "Waiting for your OK on the plan", needsYou: true, done: false };
  }
  // PR opened after a clean validator: the operator's gate is the merge button.
  if (step === "pr-shepherd" || step === "pr-opened" || (step.includes("pr") && pr !== "merged")) {
    return { stage: "Ready to merge", needsYou: true, done: false };
  }

  // Building. A spec that auto-advanced (Slice B) is labelled so the operator
  // can see it was not held for a decision.
  if (spec === "auto-approved") {
    return { stage: "Building (plan needed no decisions)", needsYou: false, done: false };
  }
  if (step === "builder") return { stage: "Building", needsYou: false, done: false };

  return { stage: "Working", needsYou: false, done: false };
}

/** Resolve a gathered chain input into a renderable row. */
export function toRow(input: ChainInput): ChainRow {
  const { stage, needsYou, done } = deriveStage(input);
  return {
    issue: input.issue,
    title: input.title,
    stage,
    needsYou,
    done,
    waiting: input.waiting,
  };
}

/** The Issue title carries the count so the GitHub tab and notification show
 *  it without opening: "Ribosome: 3 things need you" / "Ribosome: all clear". */
export function boardTitle(rows: ChainRow[]): string {
  const n = rows.filter((r) => r.needsYou && !r.done).length;
  if (n === 0) return "Ribosome: all clear";
  return `Ribosome: ${n} ${n === 1 ? "thing needs" : "things need"} you`;
}

/**
 * Render the inbox board. Empty sections are omitted entirely so the operator
 * never reads a "Working (0)" header. Needs-you rows keep the caller's order
 * (the caller sorts longest-waiting first); they are numbered for quick
 * reference. `#NN` references auto-link to the Issue in GitHub, so no full
 * URLs are needed.
 */
export function renderMissionControl(
  rows: ChainRow[],
  opts: RenderOptions = {}
): { title: string; body: string } {
  const needs = rows.filter((r) => r.needsYou && !r.done);
  const working = rows.filter((r) => !r.needsYou && !r.done);
  const done = rows.filter((r) => r.done);

  const lines: string[] = [];

  if (needs.length > 0) {
    lines.push(`## Needs you (${needs.length})`);
    needs.forEach((r, i) => {
      const wait = r.waiting ? ` (waiting ${r.waiting})` : "";
      lines.push(`${i + 1}. #${r.issue} ${r.title}: ${r.stage}${wait}`);
    });
    lines.push("");
  }

  if (working.length > 0) {
    lines.push("## Working, nothing needed");
    for (const r of working) {
      lines.push(`- #${r.issue} ${r.title}: ${r.stage}`);
    }
    lines.push("");
  }

  if (done.length > 0) {
    lines.push("## Done this week");
    for (const r of done) {
      lines.push(`- #${r.issue} ${r.title}: ${r.stage}`);
    }
    lines.push("");
  }

  if (needs.length === 0 && working.length === 0 && done.length === 0) {
    lines.push("Nothing in flight right now. Open an Issue to start something.");
    lines.push("");
  }

  lines.push(
    opts.updatedAt
      ? `Last updated ${opts.updatedAt}, refreshes on every step.`
      : "Refreshes on every step."
  );

  return { title: boardTitle(rows), body: lines.join("\n") };
}
