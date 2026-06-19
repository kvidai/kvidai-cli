import { describe, expect, test } from "bun:test";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  test("returns empty fields when no frontmatter present", () => {
    const { fields, body, raw } = parseFrontmatter("# Just a body");
    expect(fields).toEqual({});
    expect(body).toBe("# Just a body");
    expect(raw).toBe("");
  });

  test("parses simple key: value pairs", () => {
    const text = "---\nname: kvidai\nversion: 1\n---\n\nbody here";
    const { fields, body } = parseFrontmatter(text);
    expect(fields.name).toBe("kvidai");
    expect(fields.version).toBe("1");
    expect(body).toBe("\nbody here");
  });

  test("folds `>` block scalars to a single line", () => {
    const text = [
      "---",
      "description: >",
      "  Use the kvidai CLI to search,",
      "  run, and manage models.",
      "---",
      "",
      "body",
    ].join("\n");
    const { fields } = parseFrontmatter(text);
    expect(fields.description).toBe(
      "Use the kvidai CLI to search, run, and manage models.",
    );
  });

  test("preserves `|` literal scalars line-by-line", () => {
    const text = [
      "---",
      "notes: |",
      "  line 1",
      "  line 2",
      "---",
      "",
      "body",
    ].join("\n");
    const { fields } = parseFrontmatter(text);
    expect(fields.notes).toBe("line 1\nline 2");
  });

  test("strips quotes from quoted values", () => {
    const text = '---\nname: "quoted"\n---\n';
    const { fields } = parseFrontmatter(text);
    expect(fields.name).toBe("quoted");
  });

  test("strips single quotes from values", () => {
    const text = "---\nname: 'single'\n---\n";
    const { fields } = parseFrontmatter(text);
    expect(fields.name).toBe("single");
  });

  test("skips blank lines inside YAML block", () => {
    const text = "---\n\nname: kvidai\n\nversion: 1\n---\n";
    const { fields } = parseFrontmatter(text);
    expect(fields.name).toBe("kvidai");
    expect(fields.version).toBe("1");
  });

  test("skips YAML comment lines inside frontmatter block", () => {
    const text = "---\n# a comment\nname: kvidai\n---\n";
    const { fields } = parseFrontmatter(text);
    expect(fields.name).toBe("kvidai");
    expect(Object.keys(fields)).toHaveLength(1);
  });

  test("skips non-key-value lines inside frontmatter block", () => {
    const text = "---\n- list item\nname: kvidai\n---\n";
    const { fields } = parseFrontmatter(text);
    expect(fields.name).toBe("kvidai");
  });

  test("handles empty line inside a block scalar", () => {
    const text = [
      "---",
      "description: >",
      "  First line.",
      "",
      "  Third line.",
      "---",
      "",
      "body",
    ].join("\n");
    const { fields } = parseFrontmatter(text);
    expect(fields.description).toContain("First line.");
  });
});
