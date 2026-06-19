import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { CallerInfo } from "./caller";

// This file clears all ambient agent-detection env vars so detectAgent()
// falls through every false-branch check and returns null. It also sets
// GITHUB_ACTIONS and CURSOR_CLI to exercise those specific branches.
// Each bun test file gets its own module registry, so _cached starts null.

const AGENT_VARS = [
  "KVIDAI_USER_AGENT",
  "AI_AGENT",
  "AGENT",
  "CODEX_SANDBOX",
  "CODEX_CI",
  "CODEX_THREAD_ID",
  "GEMINI_CLI",
  "COPILOT_CLI",
  "OPENCODE",
  "CURSOR_AGENT",
  "AIDER_VERSION",
  "AIDER_MODEL",
  "CLINE",
  "CONTINUE_GLOBAL_DIR",
  "ZED_TERM",
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "CIRCLECI",
  "BUILDKITE",
  "JENKINS_URL",
  "TRAVIS",
  "APPVEYOR",
  "CIRRUS_CI",
  "TF_BUILD",
  "TEAMCITY_VERSION",
  "CI",
  "BUILD_NUMBER",
  "RUN_ID",
  "CURSOR_CLI",
  "TERM_PROGRAM",
];

const saved: Record<string, string | undefined> = {};
let info: CallerInfo;

beforeAll(async () => {
  for (const k of AGENT_VARS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  // Exercise GitHub Actions CI branch and Cursor host branch
  process.env.GITHUB_ACTIONS = "true";
  process.env.CURSOR_CLI = "1";

  const mod = await import("./caller");
  info = mod.getCallerInfo();
});

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("getCallerInfo — no agent env vars", () => {
  test("agent is null when no agent signals are present", () => {
    expect(info.agent).toBeNull();
    expect(info.agentVersion).toBeNull();
  });

  test("detects GitHub Actions as CI provider", () => {
    expect(info.ci).toBe(true);
    expect(info.githubActions).toBe(true);
    expect(info.ciProvider).toBe("github_actions");
  });

  test("detects cursor host from CURSOR_CLI", () => {
    expect(info.agentHost).toBe("cursor");
  });

  test("invocationId is a UUID v4 string", () => {
    expect(info.invocationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("isTty is a boolean", () => {
    expect(typeof info.isTty).toBe("boolean");
  });

  test("caches result — same invocationId on repeated calls", async () => {
    const mod = await import("./caller");
    const a = mod.getCallerInfo();
    const b = mod.getCallerInfo();
    expect(a.invocationId).toBe(b.invocationId);
  });
});
