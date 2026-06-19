import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cursorTarget, renderCursorRule } from "./cursor";
import type { SkillContent } from "./types";

const skill: SkillContent = {
  name: "kvidai",
  description: "Use the kvidai CLI to run fal.ai models.",
  body: "# kvidai CLI\n\nDo things.",
  rawFrontmatter: "---\nname: kvidai\n---\n",
  files: [],
};

describe("renderCursorRule", () => {
  test("emits Cursor frontmatter with description, empty globs, alwaysApply: false", () => {
    const out = renderCursorRule(skill);
    const lines = out.split("\n");
    expect(lines[0]).toBe("---");
    expect(lines[1]).toBe(
      'description: "Use the kvidai CLI to run fal.ai models."',
    );
    expect(lines[2]).toBe("globs:");
    expect(lines[3]).toBe("alwaysApply: false");
    expect(lines[4]).toBe("---");
    expect(out).toContain("# kvidai CLI");
  });

  test("collapses multi-line description to a single line", () => {
    const multi: SkillContent = {
      ...skill,
      description: "Line one\n  Line two\n  Line three",
    };
    const out = renderCursorRule(multi);
    expect(out).toContain('description: "Line one Line two Line three"');
  });

  test("escapes double quotes in description", () => {
    const tricky: SkillContent = {
      ...skill,
      description: 'has "quotes" inside',
    };
    const out = renderCursorRule(tricky);
    expect(out).toContain('description: "has \\"quotes\\" inside"');
  });

  test("escapes backslashes in description", () => {
    const tricky: SkillContent = {
      ...skill,
      description: "path\\to\\file",
    };
    const out = renderCursorRule(tricky);
    expect(out).toContain('description: "path\\\\to\\\\file"');
  });
});

describe("cursorTarget.enabled", () => {
  test("returns true with empty opts", () => {
    expect(cursorTarget.enabled(".", {})).toBe(true);
  });

  test("returns false when only does not include cursor", () => {
    expect(cursorTarget.enabled(".", { only: ["agents-md"] })).toBe(false);
  });

  test("returns true when only includes cursor", () => {
    expect(cursorTarget.enabled(".", { only: ["cursor"] })).toBe(true);
  });

  test("returns false when cursor is excluded", () => {
    expect(cursorTarget.enabled(".", { exclude: ["cursor"] })).toBe(false);
  });

  test("returns true when exclude does not include cursor", () => {
    expect(cursorTarget.enabled(".", { exclude: ["agents-md"] })).toBe(true);
  });
});

describe("cursorTarget.write and remove", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cursor-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("write creates the .mdc rule file", async () => {
    const result = await cursorTarget.write(dir, skill);
    expect(result.kind).toBe("cursor");
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toBe(".cursor/rules/kvidai.mdc");
    const abs = join(dir, result.paths[0]);
    expect(existsSync(abs)).toBe(true);
    const content = readFileSync(abs, "utf-8");
    expect(content).toContain(
      'description: "Use the kvidai CLI to run fal.ai models."',
    );
    expect(content).toContain("# kvidai CLI");
  });

  test("write records sha256 for the rule file", async () => {
    const result = await cursorTarget.write(dir, skill);
    const path = result.paths[0];
    expect(result.sha256[path]).toMatch(/^[a-f0-9]{64}$/);
  });

  test("remove deletes an existing rule file", async () => {
    await cursorTarget.write(dir, skill);
    const result = await cursorTarget.remove(dir, "kvidai");
    expect(result.kind).toBe("cursor");
    expect(result.paths).toHaveLength(1);
    expect(existsSync(join(dir, ".cursor/rules/kvidai.mdc"))).toBe(false);
  });

  test("remove is a no-op when file does not exist", async () => {
    const result = await cursorTarget.remove(dir, "nonexistent");
    expect(result.kind).toBe("cursor");
    expect(result.paths).toHaveLength(0);
  });
});
