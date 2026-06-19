import { writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { output } from "../lib/output";

export async function pollStatus(
  jobId: string,
  opts: {
    intervalMs?: number;
    timeoutMs?: number;
    onTick?: (status: string) => void;
  } = {},
): Promise<unknown> {
  const { intervalMs = 5_000, timeoutMs = 600_000, onTick } = opts;
  const start = Date.now();
  while (true) {
    const r = await fetch(
      `${PLATFORM_BASE}/ai/generation/status?jobId=${encodeURIComponent(jobId)}`,
      { headers: { "api-key": getApiKey() } },
    );
    if (!r.ok) throw new Error(`pollStatus ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const status = String(data?.data?.status ?? data?.status ?? "");
    onTick?.(status);
    if (/^(completed|done|success|finished)$/i.test(status)) return data;
    if (/^(failed|error)$/i.test(status)) {
      throw new Error(`Generation failed: ${JSON.stringify(data)}`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timeout after ${timeoutMs / 1000}s`);
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

export default defineCommand({
  meta: { name: "task", description: "Check async generation job status" },
  subCommands: {
    status: defineCommand({
      meta: { name: "status", description: "Check or poll a generation job" },
      args: {
        jobId: {
          type: "positional",
          required: true,
          description: "Job ID returned by video t2v or agent generate",
        },
        wait: {
          type: "boolean",
          description: "Poll until completed",
        },
        interval: {
          type: "string",
          description: "Polling interval in ms (default: 5000)",
        },
        timeout: {
          type: "string",
          description: "Max wait time in ms (default: 600000)",
        },
        output: {
          type: "string",
          description: "Download result video to this path when done",
        },
      },
      async run({ args }) {
        const jobId = args.jobId as string;

        if (!args.wait) {
          const r = await fetch(
            `${PLATFORM_BASE}/ai/generation/status?jobId=${encodeURIComponent(jobId)}`,
            { headers: { "api-key": getApiKey() } },
          );
          if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
          output(await r.json());
          return;
        }

        const intervalMs = args.interval ? Number(args.interval) : 5_000;
        const timeoutMs = args.timeout ? Number(args.timeout) : 600_000;
        const data = await pollStatus(jobId, {
          intervalMs,
          timeoutMs,
          onTick: (s) => {
            if (process.stderr.isTTY)
              process.stderr.write(`\r  status: ${s}   `);
          },
        });
        if (process.stderr.isTTY) process.stderr.write("\n");

        if (args.output) {
          const result = data as Record<string, unknown>;
          const rd = result?.data as Record<string, unknown>;
          const url =
            rd?.result_url ??
            rd?.videoUrl ??
            result?.result_url ??
            result?.videoUrl;
          if (typeof url === "string") {
            const res = await fetch(url);
            const buf = Buffer.from(await res.arrayBuffer());
            writeFileSync(args.output as string, buf);
            process.stderr.write(`Downloaded → ${args.output}\n`);
          }
        }
        output(data);
      },
    }),
  },
});
