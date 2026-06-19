import { describe, expect, test } from "bun:test";
import { simplifyProps } from "./simplify-props";

describe("simplifyProps", () => {
  test("returns empty array when no properties", () => {
    expect(simplifyProps({})).toEqual([]);
  });

  test("returns empty array when properties is undefined", () => {
    expect(simplifyProps({ required: ["x"] })).toEqual([]);
  });

  test("maps a basic string property", () => {
    const result = simplifyProps({
      properties: { prompt: { type: "string" } },
    });
    expect(result).toEqual([
      { name: "prompt", type: "string", required: false },
    ]);
  });

  test("marks required fields", () => {
    const result = simplifyProps({
      properties: { prompt: { type: "string" } },
      required: ["prompt"],
    });
    expect(result[0].required).toBe(true);
  });

  test("non-required field is false even when required array exists", () => {
    const result = simplifyProps({
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a"],
    });
    expect(result.find((p) => p.name === "a")?.required).toBe(true);
    expect(result.find((p) => p.name === "b")?.required).toBe(false);
  });

  test("includes description when present", () => {
    const result = simplifyProps({
      properties: { n: { type: "integer", description: "Number of images" } },
    });
    expect(result[0].description).toBe("Number of images");
  });

  test("omits description when absent", () => {
    const result = simplifyProps({
      properties: { n: { type: "integer" } },
    });
    expect("description" in result[0]).toBe(false);
  });

  test("includes default value", () => {
    const result = simplifyProps({
      properties: { n: { type: "integer", default: 1 } },
    });
    expect(result[0].default).toBe(1);
  });

  test("includes enum values", () => {
    const result = simplifyProps({
      properties: { size: { type: "string", enum: ["sm", "md", "lg"] } },
    });
    expect(result[0].enum).toEqual(["sm", "md", "lg"]);
  });

  test("formats array type with item type", () => {
    const result = simplifyProps({
      properties: { tags: { type: "array", items: { type: "string" } } },
    });
    expect(result[0].type).toBe("array<string>");
  });

  test("formats array type with unknown items", () => {
    const result = simplifyProps({
      properties: { items: { type: "array", items: {} } },
    });
    expect(result[0].type).toBe("array<unknown>");
  });

  test("uses unknown for missing type", () => {
    const result = simplifyProps({ properties: { x: {} } });
    expect(result[0].type).toBe("unknown");
  });
});
