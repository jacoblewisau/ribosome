/**
 * Phase 6 hook tests. Runs the shell hooks against a sandbox file
 * layout so the tests do not touch production .claude/memory or
 * production specs/. Uses execSync to invoke bash directly; this
 * keeps the hook's interface (stdin JSON + exit code + stderr)
 * unchanged and exercised end to end.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ENFORCE_SCOPE = resolve(process.cwd(), ".claude/hooks/enforce-scope.sh");
const ENFORCE_DISTILLED = resolve(process.cwd(), ".claude/hooks/enforce-distilled-write.sh");

type HookResult = { exit: number; stderr: string };

function runHook(hookPath: string, cwd: string, stdin: object): HookResult {
  try {
    execSync(`bash ${hookPath}`, {
      input: JSON.stringify(stdin),
      encoding: "utf8",
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exit: 0, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stderr?: Buffer | string };
    return {
      exit: err.status ?? 1,
      stderr: err.stderr ? err.stderr.toString() : "",
    };
  }
}

let sandbox: string;

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), "ribosome-enforce-scope-"));
});

afterAll(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

function seedChain(id: string, opts: {
  step: string;
  scopePaths: string[];
}): void {
  mkdirSync(join(sandbox, ".claude/memory/live", id), { recursive: true });
  mkdirSync(join(sandbox, "specs"), { recursive: true });
  writeFileSync(
    join(sandbox, ".claude/memory/live", id, "chain.json"),
    JSON.stringify({ version: "1", id, current_step: opts.step })
  );
  const scopeBlock = opts.scopePaths.length
    ? "## scope_paths\n\n```\n" + opts.scopePaths.join("\n") + "\n```\n"
    : "## scope_paths\n\n(none declared)\n";
  writeFileSync(join(sandbox, "specs", `${id}.md`), `# Spec ${id}\n\n${scopeBlock}\n`);
}

function clearSandbox(): void {
  rmSync(join(sandbox, ".claude/memory/live"), { recursive: true, force: true });
  rmSync(join(sandbox, "specs"), { recursive: true, force: true });
  mkdirSync(join(sandbox, ".claude/memory/live"), { recursive: true });
}

describe("Phase 6: enforce-scope hook", () => {
  it("allows non-mutating tools (Read/Glob/Grep/Bash) regardless of path", () => {
    clearSandbox();
    seedChain("test-0001", {
      step: "builder",
      scopePaths: ["src/allowed/**"],
    });
    for (const tool of ["Read", "Glob", "Grep", "Bash"]) {
      const r = runHook(ENFORCE_SCOPE, sandbox, {
        tool_name: tool,
        tool_input: { file_path: `${sandbox}/src/other/anywhere.tsx` },
        cwd: sandbox,
      });
      expect(r.exit, `tool=${tool}`).toBe(0);
    }
  });

  it("allows any write when no chain is in builder step", () => {
    clearSandbox();
    seedChain("test-0001", {
      step: "completed",
      scopePaths: ["src/allowed/**"],
    });
    const r = runHook(ENFORCE_SCOPE, sandbox, {
      tool_name: "Write",
      tool_input: { file_path: `${sandbox}/src/other/x.ts` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(0);
  });

  it("allows write inside scope_paths glob", () => {
    clearSandbox();
    seedChain("test-0002", {
      step: "builder",
      scopePaths: ["src/allowed/**", "specific/file.ts"],
    });
    const r = runHook(ENFORCE_SCOPE, sandbox, {
      tool_name: "Write",
      tool_input: { file_path: `${sandbox}/src/allowed/deep/x.tsx` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(0);
  });

  it("allows write at exact scope_paths entry", () => {
    clearSandbox();
    seedChain("test-0003", {
      step: "builder",
      scopePaths: ["package.json", "src/allowed/**"],
    });
    const r = runHook(ENFORCE_SCOPE, sandbox, {
      tool_name: "Write",
      tool_input: { file_path: `${sandbox}/package.json` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(0);
  });

  it("rejects write outside scope_paths with exit 2 and clear stderr", () => {
    clearSandbox();
    seedChain("test-0004", {
      step: "builder",
      scopePaths: ["src/allowed/**"],
    });
    const r = runHook(ENFORCE_SCOPE, sandbox, {
      tool_name: "Write",
      tool_input: { file_path: `${sandbox}/src/forbidden/x.tsx` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(2);
    expect(r.stderr).toContain("enforce-scope");
    expect(r.stderr).toContain("rejected");
    expect(r.stderr).toContain("test-0004");
    expect(r.stderr).toContain("src/allowed/**");
  });

  it("allows writes inside the chain's own .claude/memory/live/<id>/ regardless of scope_paths", () => {
    clearSandbox();
    seedChain("test-0005", {
      step: "builder",
      scopePaths: ["src/onlythis.ts"],
    });
    const r = runHook(ENFORCE_SCOPE, sandbox, {
      tool_name: "Write",
      tool_input: { file_path: `${sandbox}/.claude/memory/live/test-0005/builder.md` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(0);
  });

  it("rejects with ambiguity message when two chains are in builder step", () => {
    clearSandbox();
    seedChain("test-0006", { step: "builder", scopePaths: ["a/**"] });
    seedChain("test-0007", { step: "builder", scopePaths: ["b/**"] });
    const r = runHook(ENFORCE_SCOPE, sandbox, {
      tool_name: "Write",
      tool_input: { file_path: `${sandbox}/a/x.ts` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(2);
    expect(r.stderr).toContain("multiple chains");
    expect(r.stderr).toContain("test-0006");
    expect(r.stderr).toContain("test-0007");
  });

  it("rejects MultiEdit with the same logic as Write", () => {
    clearSandbox();
    seedChain("test-0008", {
      step: "builder",
      scopePaths: ["src/allowed/**"],
    });
    const r = runHook(ENFORCE_SCOPE, sandbox, {
      tool_name: "MultiEdit",
      tool_input: { file_path: `${sandbox}/src/forbidden/y.ts` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(2);
  });
});

describe("Phase 6: enforce-distilled-write hook", () => {
  beforeAll(() => {
    mkdirSync(join(sandbox, ".claude/memory/distilled"), { recursive: true });
  });

  it("allows writes outside the distilled tree", () => {
    const r = runHook(ENFORCE_DISTILLED, sandbox, {
      tool_name: "Write",
      tool_input: { file_path: `${sandbox}/src/anywhere.ts` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(0);
  });

  it("rejects writes to distilled when the dream marker is absent", () => {
    rmSync(join(sandbox, ".claude/memory/.dream-active"), { force: true });
    const r = runHook(ENFORCE_DISTILLED, sandbox, {
      tool_name: "Write",
      tool_input: { file_path: `${sandbox}/.claude/memory/distilled/2026-x/store.json` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(2);
    expect(r.stderr).toContain("enforce-distilled-write");
    expect(r.stderr).toContain(".dream-active");
  });

  it("allows writes to distilled when the dream marker is present", () => {
    writeFileSync(join(sandbox, ".claude/memory/.dream-active"), "");
    try {
      const r = runHook(ENFORCE_DISTILLED, sandbox, {
        tool_name: "Write",
        tool_input: { file_path: `${sandbox}/.claude/memory/distilled/2026-x/store.json` },
        cwd: sandbox,
      });
      expect(r.exit).toBe(0);
    } finally {
      rmSync(join(sandbox, ".claude/memory/.dream-active"), { force: true });
    }
  });

  it("ignores non-mutating tools regardless of distilled path", () => {
    const r = runHook(ENFORCE_DISTILLED, sandbox, {
      tool_name: "Read",
      tool_input: { file_path: `${sandbox}/.claude/memory/distilled/store.json` },
      cwd: sandbox,
    });
    expect(r.exit).toBe(0);
  });
});
