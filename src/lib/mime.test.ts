import { describe, expect, test } from "bun:test";
import { mimeFromExtension, resolveAssetMimeType } from "./mime";

describe("mimeFromExtension", () => {
  test("maps known extensions", () => {
    expect(mimeFromExtension("clip.mp4")).toBe("video/mp4");
    expect(mimeFromExtension("PHOTO.PNG")).toBe("image/png");
  });

  test("reads extension from a URL, stripping query/hash", () => {
    expect(mimeFromExtension("https://cdn.kvid.ai/a/b/clip.mp4?sig=x")).toBe(
      "video/mp4",
    );
    expect(mimeFromExtension("https://cdn.kvid.ai/x.mov#t=1")).toBe(
      "video/quicktime",
    );
  });

  test("returns undefined for unknown or missing extension", () => {
    expect(mimeFromExtension("noext")).toBeUndefined();
    expect(mimeFromExtension("file.xyz")).toBeUndefined();
    expect(mimeFromExtension(undefined)).toBeUndefined();
  });
});

describe("resolveAssetMimeType", () => {
  test("keeps an explicit mimeType", () => {
    expect(
      resolveAssetMimeType({ type: "video", mimeType: "video/webm" }),
    ).toBe("video/webm");
  });

  test("derives from remoteUrl extension when mimeType is missing", () => {
    expect(
      resolveAssetMimeType({
        type: "video",
        remoteUrl: "https://cdn.kvid.ai/x/clip.mp4",
      }),
    ).toBe("video/mp4");
  });

  test("prefers filename over remoteUrl", () => {
    expect(
      resolveAssetMimeType({
        type: "video",
        filename: "scene.mov",
        remoteUrl: "https://cdn.kvid.ai/x/clip.mp4",
      }),
    ).toBe("video/quicktime");
  });

  test("falls back to type default when extension is unknown", () => {
    expect(
      resolveAssetMimeType({
        type: "video",
        remoteUrl: "https://cdn.kvid.ai/x/noext",
      }),
    ).toBe("video/mp4");
    expect(resolveAssetMimeType({ type: "image" })).toBe("image/png");
  });

  test("falls back to octet-stream when nothing is known", () => {
    expect(resolveAssetMimeType({})).toBe("application/octet-stream");
  });
});
