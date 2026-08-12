import { writeFileSync } from "node:fs";
import { pollStatus } from "../commands/task";
import { getApiKey, PLATFORM_BASE } from "./api";
import { loadConfig } from "./config";
import { error, output } from "./output";

/** credit/user 식별 — `video t2v` 와 동일 (env → config). */
export function userEmail(): string | undefined {
  return process.env.KVIDAI_USER_EMAIL ?? loadConfig().userEmail;
}

/** async 생성 명령이 공유하는 flag (wait/output/interval/timeout). 각 command args 에 스프레드. */
export const asyncGenArgs = {
  wait: {
    type: "boolean",
    description: "Poll until completed before exiting",
  },
  output: {
    type: "string",
    description: "Download result to this path (implies --wait)",
  },
  interval: {
    type: "string",
    description: "Poll interval in ms (default: 5000)",
  },
  timeout: {
    type: "string",
    description: "Max wait time in ms (default: 600000)",
  },
} as const;

/**
 * `/ai/generation/*​/generate-async` 잡 제출 → (옵션) 폴링·다운로드. `video t2v` 와 동일 흐름.
 * 모든 async 생성(t2v/i2v/ref2vid/i2i/talk-v2v)은 제네릭 `/ai/generation/status` 로 폴링된다.
 */
export async function runAsyncGeneration(
  label: string,
  endpoint: string,
  body: Record<string, unknown>,
  args: {
    wait?: boolean;
    output?: string;
    interval?: string;
    timeout?: string;
  },
): Promise<void> {
  const r = await fetch(`${PLATFORM_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": getApiKey() },
    body: JSON.stringify(body),
  });
  if (!r.ok) error(`${label} ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const jobId = String(
    data?.data?.job_id ?? data?.data?.jobId ?? data?.job_id ?? data?.jobId ?? "",
  );

  if (!args.wait && !args.output) {
    output({ jobId, ...data });
    return;
  }

  const intervalMs = args.interval ? Number(args.interval) : 5_000;
  const timeoutMs = args.timeout ? Number(args.timeout) : 600_000;
  const result = await pollStatus(jobId, {
    intervalMs,
    timeoutMs,
    onTick: (s) => {
      if (process.stderr.isTTY) process.stderr.write(`\r  status: ${s}   `);
    },
  });
  if (process.stderr.isTTY) process.stderr.write("\n");

  if (args.output) {
    const res = result as Record<string, unknown>;
    const d = res?.data as Record<string, unknown> | undefined;
    const url =
      d?.result_url ??
      d?.videoUrl ??
      d?.imageUrl ??
      d?.url ??
      res?.result_url ??
      res?.videoUrl ??
      res?.url;
    if (typeof url === "string") {
      const fetched = await fetch(url);
      writeFileSync(args.output, Buffer.from(await fetched.arrayBuffer()));
      process.stderr.write(`Downloaded → ${args.output}\n`);
    }
  }
  output(result);
}
