import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { detectPlatform, serveInstallScript } from "./install";

// ── detectPlatform ────────────────────────────────────────────────────────────

describe("detectPlatform", () => {
  test("returns sh for null UA", () => {
    expect(detectPlatform(null)).toBe("sh");
  });

  test("returns sh for curl UA", () => {
    expect(detectPlatform("curl/8.4.0")).toBe("sh");
  });

  test("returns sh for empty string UA", () => {
    expect(detectPlatform("")).toBe("sh");
  });

  test("returns ps1 for PowerShell UA", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT) PowerShell/7.4")).toBe(
      "ps1",
    );
  });

  test("returns ps1 for pwsh UA", () => {
    expect(detectPlatform("pwsh/7.4.0")).toBe("ps1");
  });

  test("returns ps1 for Windows UA string", () => {
    expect(detectPlatform("Windows irm installer")).toBe("ps1");
  });

  test("case-insensitive Windows detection", () => {
    expect(detectPlatform("POWERSHELL/5.1")).toBe("ps1");
  });
});

// ── serveInstallScript ────────────────────────────────────────────────────────

describe("serveInstallScript", () => {
  let savedFetch: typeof globalThis.fetch;

  beforeEach(() => {
    savedFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
  });

  test("returns 200 with script content for sh platform", async () => {
    const scriptBody = "#!/bin/sh\necho hello";
    globalThis.fetch = mock(async () =>
      new Response(scriptBody, { status: 200 }),
    ) as unknown as typeof globalThis.fetch;

    const res = await serveInstallScript("sh");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe(scriptBody);
  });

  test("returns 200 with script content for ps1 platform", async () => {
    const scriptBody = "# PowerShell installer";
    globalThis.fetch = mock(async () =>
      new Response(scriptBody, { status: 200 }),
    ) as unknown as typeof globalThis.fetch;

    const res = await serveInstallScript("ps1");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(scriptBody);
  });

  test("fetches sh URL for sh platform", async () => {
    let capturedUrl = "";
    globalThis.fetch = mock(async (url: string) => {
      capturedUrl = url;
      return new Response("#!/bin/sh", { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await serveInstallScript("sh");
    expect(capturedUrl).toContain("install.sh");
    expect(capturedUrl).not.toContain("install.ps1");
  });

  test("fetches ps1 URL for ps1 platform", async () => {
    let capturedUrl = "";
    globalThis.fetch = mock(async (url: string) => {
      capturedUrl = url;
      return new Response("# ps1", { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    await serveInstallScript("ps1");
    expect(capturedUrl).toContain("install.ps1");
  });

  test("returns 502 when upstream fetch fails (non-ok status)", async () => {
    globalThis.fetch = mock(async () =>
      new Response("Not Found", { status: 404 }),
    ) as unknown as typeof globalThis.fetch;

    const res = await serveInstallScript("sh");
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain("unavailable");
  });

  test("passes userAgent to serveInstallScript without error", async () => {
    globalThis.fetch = mock(async () =>
      new Response("#!/bin/sh", { status: 200 }),
    ) as unknown as typeof globalThis.fetch;

    const res = await serveInstallScript("sh", "curl/8.4.0");
    expect(res.status).toBe(200);
  });

  test("handles null userAgent without error", async () => {
    globalThis.fetch = mock(async () =>
      new Response("#!/bin/sh", { status: 200 }),
    ) as unknown as typeof globalThis.fetch;

    const res = await serveInstallScript("sh", null);
    expect(res.status).toBe(200);
  });
});
