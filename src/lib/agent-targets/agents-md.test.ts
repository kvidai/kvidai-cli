import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  agentsMdTarget,
  mergeAgentsMd,
  renderAgentsBlock,
  stripAgentsBlock,
} from "./agents-md";
import type { SkillContent } from "./types";

const skill: SkillContent = {
  name: "kvidai",
  description: "Use kvidai for fal.ai things.",
  body: "# kvidai CLI\n\nDo things.",
  rawFrontmatter: "---\nname: kvidai\n---\n",
  files: [],
};

describe("renderAgentsBlock", () => {
  test("wraps body with BEGIN/END markers and a heading", () => {
    const out = renderAgentsBlock(skill);
    expect(out).toContain("<!-- BEGIN kvidai:kvidai -->");
    expect(out).toContain("<!-- END kvidai:kvidai -->");
    expect(out).toContain("## kvidai");
    expect(out).toContain("Do things.");
  });

  test("uses skill name as heading for non-kvidai skills", () => {
    const out = renderAgentsBlock({ ...skill, name: "myskill" });
    expect(out).toContain("## myskill");
    expect(out).not.toContain("## kvidai CLI");
  });
});

describe("mergeAgentsMd — edge cases", () => {
  const block = renderAgentsBlock(skill);

  test("creates content when existing is empty string", () => {
    const out = mergeAgentsMd("", block, "kvidai");
    expect(out.startsWith("<!-- BEGIN kvidai:kvidai -->")).toBe(true);
  });

  test("appends with double newline when existing has no trailing newline", () => {
    const existing = "# Title";
    const out = mergeAgentsMd(existing, block, "kvidai");
    expect(out.startsWith("# Title\n\n")).toBe(true);
    expect(out).toContain("<!-- BEGIN kvidai:kvidai -->");
  });

  test("appends with single newline when existing ends with one newline", () => {
    const existing = "# Title\n";
    const out = mergeAgentsMd(existing, block, "kvidai");
    expect(out.startsWith("# Title\n\n")).toBe(true);
  });
});

describe("mergeAgentsMd", () => {
  const block = renderAgentsBlock(skill);

  test("creates content when AGENTS.md is missing", () => {
    const out = mergeAgentsMd(null, block, "kvidai");
    expect(out.startsWith("<!-- BEGIN kvidai:kvidai -->")).toBe(true);
    expect(out.endsWith("\n")).toBe(true);
  });

  test("appends to non-empty file without our block", () => {
    const existing = "# Project AGENTS guide\n\nSome existing instructions.\n";
    const out = mergeAgentsMd(existing, block, "kvidai");
    expect(out.startsWith(existing.replace(/\n*$/, ""))).toBe(true);
    expect(out).toContain("<!-- BEGIN kvidai:kvidai -->");
  });

  test("replaces an existing block in place", () => {
    const old = renderAgentsBlock({ ...skill, body: "OLD CONTENT" });
    const surrounded = `## Pre\nKeep me\n\n${old}\n\n## Post\nKeep me too\n`;
    const updated = renderAgentsBlock({ ...skill, body: "NEW CONTENT" });
    const out = mergeAgentsMd(surrounded, updated, "kvidai");
    expect(out).toContain("Keep me");
    expect(out).toContain("Keep me too");
    expect(out).toContain("NEW CONTENT");
    expect(out).not.toContain("OLD CONTENT");
  });

  test("is idempotent — same input produces same output", () => {
    const once = mergeAgentsMd(null, block, "kvidai");
    const twice = mergeAgentsMd(once, block, "kvidai");
    expect(twice).toBe(once);
  });

  test("handles distinct skill blocks side by side", () => {
    const blockA = renderAgentsBlock({ ...skill, name: "alpha" });
    const blockB = renderAgentsBlock({ ...skill, name: "beta" });
    const step1 = mergeAgentsMd(null, blockA, "alpha");
    const step2 = mergeAgentsMd(step1, blockB, "beta");
    expect(step2).toContain("<!-- BEGIN kvidai:alpha -->");
    expect(step2).toContain("<!-- BEGIN kvidai:beta -->");
    const updatedA = renderAgentsBlock({
      ...skill,
      name: "alpha",
      body: "ALPHA UPDATED",
    });
    const step3 = mergeAgentsMd(step2, updatedA, "alpha");
    expect(step3).toContain("ALPHA UPDATED");
    expect(step3).toContain("<!-- BEGIN kvidai:beta -->");
  });
});

describe("stripAgentsBlock", () => {
  test("removes our block and preserves surrounding content", () => {
    const block = renderAgentsBlock(skill);
    const surrounded = `# Header\n\n${block}\n\n## Post\nKeep\n`;
    const { content, removed } = stripAgentsBlock(surrounded, "kvidai");
    expect(removed).toBe(true);
    expect(content).toContain("# Header");
    expect(content).toContain("Keep");
    expect(content).not.toContain("BEGIN kvidai:kvidai");
  });

  test("reports removed: false when our block is absent", () => {
    const { content, removed } = stripAgentsBlock(
      "# Just a regular file",
      "kvidai",
    );
    expect(removed).toBe(false);
    expect(content).toBe("# Just a regular file");
  });
});

describe("agentsMdTarget.enabled", () => {
  test("returns true with empty opts", () => {
    expect(agentsMdTarget.enabled(".", {})).toBe(true);
  });

  test("returns false when only does not include agents-md", () => {
    expect(agentsMdTarget.enabled(".", { only: ["cursor"] })).toBe(false);
  });

  test("returns true when only includes agents-md", () => {
    expect(agentsMdTarget.enabled(".", { only: ["agents-md"] })).toBe(true);
  });

  test("returns false when agents-md is excluded", () => {
    expect(agentsMdTarget.enabled(".", { exclude: ["agents-md"] })).toBe(false);
  });

  test("returns true when exclude does not include agents-md", () => {
    expect(agentsMdTarget.enabled(".", { exclude: ["cursor"] })).toBe(true);
  });
});

describe("agentsMdTarget.write and remove", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agents-md-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("write creates AGENTS.md with the skill block", async () => {
    const result = await agentsMdTarget.write(dir, skill);
    expect(result.kind).toBe("agents-md");
    expect(result.paths).toEqual(["AGENTS.md"]);
    const content = readFileSync(join(dir, "AGENTS.md"), "utf-8");
    expect(content).toContain("<!-- BEGIN kvidai:kvidai -->");
    expect(content).toContain("Do things.");
  });

  test("write records sha256 for AGENTS.md", async () => {
    const result = await agentsMdTarget.write(dir, skill);
    expect(result.sha256["AGENTS.md"]).toMatch(/^[a-f0-9]{64}$/);
  });

  test("write merges into an existing AGENTS.md", async () => {
    writeFileSync(join(dir, "AGENTS.md"), "# Existing\n\nContent here\n");
    await agentsMdTarget.write(dir, skill);
    const content = readFileSync(join(dir, "AGENTS.md"), "utf-8");
    expect(content).toContain("# Existing");
    expect(content).toContain("Content here");
    expect(content).toContain("<!-- BEGIN kvidai:kvidai -->");
  });

  test("remove deletes the block from AGENTS.md", async () => {
    await agentsMdTarget.write(dir, skill);
    const result = await agentsMdTarget.remove(dir, "kvidai");
    expect(result.kind).toBe("agents-md");
    expect(result.paths).toHaveLength(1);
    const content = readFileSync(join(dir, "AGENTS.md"), "utf-8");
    expect(content).not.toContain("<!-- BEGIN kvidai:kvidai -->");
  });

  test("remove leaves file empty when block was only content", async () => {
    await agentsMdTarget.write(dir, skill);
    await agentsMdTarget.remove(dir, "kvidai");
    const content = readFileSync(join(dir, "AGENTS.md"), "utf-8");
    expect(content.trim()).toBe("");
  });

  test("remove is a no-op when AGENTS.md does not exist", async () => {
    const result = await agentsMdTarget.remove(dir, "kvidai");
    expect(result.kind).toBe("agents-md");
    expect(result.paths).toHaveLength(0);
  });

  test("remove is a no-op when block is absent from AGENTS.md", async () => {
    writeFileSync(join(dir, "AGENTS.md"), "# No kvidai block here\n");
    const result = await agentsMdTarget.remove(dir, "kvidai");
    expect(result.paths).toHaveLength(0);
  });
});
