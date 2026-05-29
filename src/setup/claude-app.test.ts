import { describe, expect, it } from "vitest";
import { classifyClaudeApp, formatClaudeAppLine } from "./claude-app";

describe("classifyClaudeApp", () => {
  it("reports unknown (not a failure) when there is no remote", () => {
    const status = classifyClaudeApp({
      hasRemote: false,
      installationApiOk: false,
      installationApiBody: "",
    });
    expect(status.state).toBe("unknown");
    expect(status.reason).toMatch(/remote/i);
  });

  it("reports ok when the installation API succeeds and names the claude app slug", () => {
    const status = classifyClaudeApp({
      hasRemote: true,
      installationApiOk: true,
      installationApiBody: '{"app_slug": "claude", "id": 123}',
    });
    expect(status.state).toBe("ok");
    expect(status.value).toMatch(/installed/i);
  });

  it("reports unknown when the installation API succeeds but names a different app", () => {
    const status = classifyClaudeApp({
      hasRemote: true,
      installationApiOk: true,
      installationApiBody: '{"app_slug": "dependabot", "id": 456}',
    });
    expect(status.state).toBe("unknown");
  });

  it("reports unknown (not missing) when the installation API 403s for a user token", () => {
    const status = classifyClaudeApp({
      hasRemote: true,
      installationApiOk: false,
      installationApiBody:
        "You must authenticate with an access token authorized to a GitHub App",
    });
    expect(status.state).toBe("unknown");
    // The honest reason must explain the user-token constraint. (The
    // false-negative regression guard lives at the line level in the
    // formatClaudeAppLine tests below, since "=missing" is what the setup
    // skill keys off.)
    expect(status.reason).toMatch(/user token/i);
    expect(status.hint).toMatch(/github\.com\/apps\/claude/);
  });
});

describe("formatClaudeAppLine", () => {
  it("renders an ok status as a parseable key=value line", () => {
    const line = formatClaudeAppLine({ state: "ok", value: "installed (verified via installation API)" });
    expect(line).toMatch(/^claude_app=ok value="/);
  });

  it("renders an unknown status as claude_app=unknown, never =missing", () => {
    const line = formatClaudeAppLine({
      state: "unknown",
      reason: "cannot verify App installation with a user token",
      hint: "manage installs at https://github.com/apps/claude/installations",
    });
    expect(line.startsWith("claude_app=unknown ")).toBe(true);
    expect(line).toContain("reason=");
    expect(line).toContain("hint=");
    // Regression guard: the false-negative must never reappear.
    expect(line).not.toContain("claude_app=missing");
  });

  it("never emits the false-negative for any classification outcome", () => {
    const probes = [
      { hasRemote: false, installationApiOk: false, installationApiBody: "" },
      { hasRemote: true, installationApiOk: false, installationApiBody: "401" },
      { hasRemote: true, installationApiOk: true, installationApiBody: "{}" },
    ];
    for (const probe of probes) {
      const line = formatClaudeAppLine(classifyClaudeApp(probe));
      expect(line).not.toContain("=missing");
    }
  });
});
