import { describe, expect, test } from "bun:test";
import { parseValue } from "./parse-value";

describe("parseValue", () => {
  test("parses boolean true", () => expect(parseValue("true")).toBe(true));
  test("parses boolean false", () => expect(parseValue("false")).toBe(false));

  test("parses integer", () => expect(parseValue("42")).toBe(42));
  test("parses float", () => expect(parseValue("3.14")).toBe(3.14));
  test("parses negative number", () => expect(parseValue("-7")).toBe(-7));
  test("parses zero", () => expect(parseValue("0")).toBe(0));

  test("parses JSON object", () =>
    expect(parseValue('{"a":1}')).toEqual({ a: 1 }));
  test("parses JSON array", () =>
    expect(parseValue("[1,2,3]")).toEqual([1, 2, 3]));
  test("parses JSON null", () => expect(parseValue("null")).toBeNull());

  test("returns string for plain text", () =>
    expect(parseValue("hello")).toBe("hello"));
  test("returns string for empty string", () =>
    expect(parseValue("")).toBe(""));
  test("returns string when JSON is invalid", () =>
    expect(parseValue("{bad json}")).toBe("{bad json}"));
  test("returns string for whitespace-only", () =>
    expect(parseValue("  ")).toBe("  "));
});
