import { describe, expect, test } from "bun:test";
import { extractMediaRefs, formatBytes, parseDownloadFlag } from "./download";

describe("formatBytes", () => {
  test("formats bytes under 1 KB", () =>
    expect(formatBytes(512)).toBe("512 B"));
  test("formats 1 byte", () => expect(formatBytes(1)).toBe("1 B"));
  test("formats kilobytes", () => expect(formatBytes(1536)).toBe("1.5 KB"));
  test("formats megabytes", () =>
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB"));
  test("formats gigabytes", () =>
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.50 GB"));
  test("formats exactly 1 KB", () => expect(formatBytes(1024)).toBe("1.0 KB"));
  test("formats exactly 1 MB", () =>
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB"));
});

describe("extractMediaRefs", () => {
  test("extracts top-level url", () => {
    const refs = extractMediaRefs({ url: "https://example.com/video.mp4" });
    expect(refs).toHaveLength(1);
    expect(refs[0].url).toBe("https://example.com/video.mp4");
    expect(refs[0].index).toBe(0);
  });

  test("extracts content_type", () => {
    const refs = extractMediaRefs({
      url: "https://example.com/img.png",
      content_type: "image/png",
    });
    expect(refs[0].contentType).toBe("image/png");
  });

  test("extracts file_name", () => {
    const refs = extractMediaRefs({
      url: "https://example.com/x",
      file_name: "photo.jpg",
    });
    expect(refs[0].fileName).toBe("photo.jpg");
  });

  test("extracts file_size", () => {
    const refs = extractMediaRefs({
      url: "https://example.com/x",
      file_size: 1024,
    });
    expect(refs[0].fileSize).toBe(1024);
  });

  test("extracts nested url", () => {
    const refs = extractMediaRefs({
      data: { url: "https://example.com/img.png" },
    });
    expect(refs).toHaveLength(1);
    expect(refs[0].jsonPath).toBe("data");
  });

  test("extracts multiple urls from array", () => {
    const refs = extractMediaRefs({
      images: [
        { url: "https://example.com/a.png" },
        { url: "https://example.com/b.png" },
      ],
    });
    expect(refs).toHaveLength(2);
    expect(refs[0].index).toBe(0);
    expect(refs[1].index).toBe(1);
  });

  test("ignores non-http urls", () => {
    const refs = extractMediaRefs({ url: "ftp://example.com/file" });
    expect(refs).toHaveLength(0);
  });

  test("ignores relative urls", () => {
    const refs = extractMediaRefs({ url: "/path/to/file.mp4" });
    expect(refs).toHaveLength(0);
  });

  test("returns empty array for null", () =>
    expect(extractMediaRefs(null)).toHaveLength(0));
  test("returns empty array for string", () =>
    expect(extractMediaRefs("string")).toHaveLength(0));
  test("returns empty array for number", () =>
    expect(extractMediaRefs(42)).toHaveLength(0));
  test("returns empty array for empty object", () =>
    expect(extractMediaRefs({})).toHaveLength(0));
});

describe("parseDownloadFlag", () => {
  test("returns off when --download is absent", () => {
    expect(parseDownloadFlag(["--json", "--prompt", "foo"])).toEqual({
      mode: "off",
    });
  });

  test("returns off for empty argv", () => {
    expect(parseDownloadFlag([])).toEqual({ mode: "off" });
  });

  test("returns on with null template when --download is last arg", () => {
    expect(parseDownloadFlag(["--download"])).toEqual({
      mode: "on",
      template: null,
    });
  });

  test("returns on with null template when next arg starts with --", () => {
    expect(parseDownloadFlag(["--download", "--json"])).toEqual({
      mode: "on",
      template: null,
    });
  });

  test("returns on with path template", () => {
    expect(parseDownloadFlag(["--download", "./out/"])).toEqual({
      mode: "on",
      template: "./out/",
    });
  });

  test("returns on with template containing tokens", () => {
    expect(parseDownloadFlag(["--download", "./out/{index}.{ext}"])).toEqual({
      mode: "on",
      template: "./out/{index}.{ext}",
    });
  });

  test("handles --download in the middle of argv", () => {
    expect(
      parseDownloadFlag(["--async", "--download", "./out/", "--json"]),
    ).toEqual({ mode: "on", template: "./out/" });
  });
});
