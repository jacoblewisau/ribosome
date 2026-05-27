/**
 * Phase 2.5 acceptance test, run as part of `npm test`.
 *
 * Acceptance per plan §12: "in a single feature run, the builder
 * writes an in-flight note that the validator reads back in the next
 * step. Restarting the builder mid-run picks up the note."
 *
 * This test exercises the helper module that the agent prompts cite.
 * Real agents read and write the same paths via the Read / Write
 * tools; this test verifies the layout works without involving Claude
 * Code subagent invocation (which is not testable in a unit-test
 * harness).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  _purgeForTests,
  finalize,
  initChain,
  isMidRun,
  listChains,
  pathsFor,
  readChain,
  readFinal,
  readInFlight,
  updateChain,
  writeInFlight,
} from "./state";

const TEST_ID = "test-phase2-5";

beforeEach(() => {
  _purgeForTests(TEST_ID, "I-KNOW-WHAT-I-AM-DOING");
});

afterEach(() => {
  _purgeForTests(TEST_ID, "I-KNOW-WHAT-I-AM-DOING");
});

describe("Phase 2.5 chain state helper", () => {
  it("initialises a chain idempotently", () => {
    const a = initChain(TEST_ID, {
      issue: "test feature",
      path: "full",
      path_reason: "smoke test",
    });
    expect(a.id).toBe(TEST_ID);
    expect(a.version).toBe("1");
    expect(a.current_step).toBe("researcher");
    expect(a.gate_state.story).toBe("pending");

    // Second call returns existing, does not clobber.
    const b = initChain(TEST_ID, {
      issue: "different issue",
      path: "docs-only",
      path_reason: "should not overwrite",
    });
    expect(b.issue).toBe("test feature");
    expect(b.path).toBe("full");
  });

  it("updates chain.json atomically and preserves id/version", () => {
    initChain(TEST_ID, { issue: "x", path: "full", path_reason: "x" });
    const next = updateChain(TEST_ID, {
      current_step: "spec-writer",
      gate_state: { story: "approved", spec: "pending", pr: "pending" },
    });
    expect(next.current_step).toBe("spec-writer");
    expect(next.gate_state.story).toBe("approved");
    expect(next.id).toBe(TEST_ID);
    expect(next.version).toBe("1");
    // Re-read from disk to confirm persistence.
    const reread = readChain(TEST_ID);
    expect(reread.current_step).toBe("spec-writer");
  });

  // The acceptance test, verbatim from plan §12 Phase 2.5.
  it(
    "ACCEPTANCE: builder writes an in-flight note that the validator reads back; restart picks up the note",
    () => {
      initChain(TEST_ID, {
        issue: "add a feature",
        path: "full",
        path_reason: "test",
      });

      // Step 1: builder starts work, writes an in-flight note.
      writeInFlight(
        TEST_ID,
        "builder",
        "## in-flight notes\n\n- Step 1: reading the spec\n- Step 2: identifying files\n"
      );
      expect(isMidRun(TEST_ID, "builder")).toBe(true);

      // Step 2: validator (running in a separate process equivalent)
      // reads the in-flight note. This is what the spec calls
      // "validator reads it back in the next step".
      const noteFromValidator = readInFlight(TEST_ID, "builder");
      expect(noteFromValidator).toBeDefined();
      expect(noteFromValidator).toContain("Step 1: reading the spec");
      expect(noteFromValidator).toContain("Step 2: identifying files");

      // Step 3: simulate "restart" by reading the in-flight note in
      // what would be a new builder session. The new session picks up
      // exactly where the previous one left off.
      const restartReadback = readInFlight(TEST_ID, "builder");
      expect(restartReadback).toBe(noteFromValidator);

      // The new builder session continues, appending more notes.
      writeInFlight(
        TEST_ID,
        "builder",
        (restartReadback ?? "") +
          "- Step 3: writing the change (resumed after restart)\n" +
          "- Step 4: running typecheck\n"
      );

      const continued = readInFlight(TEST_ID, "builder");
      expect(continued).toContain("Step 1: reading the spec");
      expect(continued).toContain("Step 3: writing the change (resumed after restart)");

      // Step 4: builder finalises. The final report supersedes the
      // in-flight note for verdict purposes. isMidRun returns false
      // after finalise.
      finalize(
        TEST_ID,
        "builder",
        "## Builder summary\n\nFour steps completed. Typecheck passed.\n"
      );
      expect(isMidRun(TEST_ID, "builder")).toBe(false);
      expect(readFinal(TEST_ID, "builder")).toContain("Four steps completed");
    }
  );

  it("isMidRun returns false when only the final report exists", () => {
    initChain(TEST_ID, { issue: "x", path: "full", path_reason: "x" });
    finalize(TEST_ID, "validator", "## Validator report\n\nClean.\n");
    expect(isMidRun(TEST_ID, "validator")).toBe(false);
  });

  it("listChains includes the test chain while it exists", () => {
    initChain(TEST_ID, { issue: "x", path: "full", path_reason: "x" });
    expect(listChains()).toContain(TEST_ID);
  });

  it("pathsFor returns canonical paths under the chain directory", () => {
    const p = pathsFor(TEST_ID);
    expect(p.chain.endsWith("chain.json")).toBe(true);
    expect(p.inFlight("builder").endsWith("builder.inflight.md")).toBe(true);
    expect(p.final("builder").endsWith("builder.md")).toBe(true);
    // Paths sit under the live store
    expect(p.dir.includes(".claude/memory/live/")).toBe(true);
  });

  it("rejects invalid chain ids", () => {
    expect(() => initChain("../escape", { issue: "x", path: "full", path_reason: "x" })).toThrow();
    expect(() => initChain("with spaces", { issue: "x", path: "full", path_reason: "x" })).toThrow();
  });
});
