import { writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { loadConfig } from "../lib/config";
import { error, isJsonOutput, output } from "../lib/output";
import { pollStatus } from "./task";

const generateCmd = defineCommand({
  meta: {
    name: "generate",
    description: "Stream agent generation for a project (SSE)",
  },
  args: {
    projectId: {
      type: "positional",
      required: true,
      description: "Project ID",
    },
    message: {
      type: "positional",
      required: true,
      description: "Instruction message for the agent",
    },
    "cdn-url": {
      type: "string",
      description:
        "Pre-uploaded CDN URL to attach as context (single attachment)",
    },
    mime: {
      type: "string",
      description: "MIME type of --cdn-url attachment",
    },
    filename: {
      type: "string",
      description: "Filename for --cdn-url attachment",
    },
    size: {
      type: "string",
      description:
        "Byte size of --cdn-url attachment (0 makes the agent skip images)",
    },
    attachments: {
      type: "string",
      description:
        'JSON array for multiple attachments: [{"cdnUrl","mimeType","filename","size"}]',
    },
    "preset-id": {
      type: "string",
      description:
        "Preset ID to apply (voice/tone/palette). system_default if omitted",
    },
    verbose: {
      type: "boolean",
      description: "Show tool events in real time (stderr)",
    },
  },
  async run({ args }) {
    const projectId = Number(args.projectId);
    const message = args.message as string;
    const apiKey = getApiKey();

    const inferType = (mime?: string) => {
      if (!mime) return "image";
      if (mime.startsWith("image/")) return "image";
      if (mime.startsWith("video/")) return "video";
      if (mime.startsWith("audio/")) return "audio";
      if (mime === "application/pdf") return "pdf";
      return "text";
    };
    // Normalize one attachment to the /agent/generate shape.
    const toAttachment = (a: {
      cdnUrl: string;
      mimeType?: string;
      mime?: string;
      filename?: string;
      name?: string;
      size?: number;
    }) => {
      const mimeType = a.mimeType ?? a.mime ?? "application/octet-stream";
      return {
        name: a.filename ?? a.name ?? a.cdnUrl.split("/").pop() ?? "attachment",
        type: inferType(mimeType),
        mimeType,
        // size 0 이면 서버 에이전트가 이미지를 빈 파일로 보고 배치에서 제외한다 → 실제 크기 필요.
        size: Number(a.size ?? 0),
        cdnUrl: a.cdnUrl,
      };
    };

    const attachedFiles: ReturnType<typeof toAttachment>[] = [];
    if (args.attachments) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(args.attachments as string);
      } catch {
        error("--attachments must be a JSON array");
      }
      if (!Array.isArray(parsed)) error("--attachments must be a JSON array");
      for (const a of parsed as Record<string, unknown>[]) {
        if (!a?.cdnUrl) error("each attachment needs a cdnUrl");
        attachedFiles.push(toAttachment(a as { cdnUrl: string }));
      }
    }
    const cdnUrl = args["cdn-url"] as string | undefined;
    if (cdnUrl) {
      attachedFiles.push(
        toAttachment({
          cdnUrl,
          mime: args.mime as string | undefined,
          filename: args.filename as string | undefined,
          size: args.size ? Number(args.size) : 0,
        }),
      );
    }

    const body: Record<string, unknown> = {
      projectId,
      message,
      chatHistory: [],
    };
    if (args["preset-id"]) body.presetId = args["preset-id"];
    if (attachedFiles.length) body.attachedFiles = attachedFiles;
    const fetchInit: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify(body),
    };

    const r = await fetch(`${PLATFORM_BASE}/agent/generate`, {
      ...fetchInit,
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
    if (!r.ok || !r.body) {
      error(`agent/generate ${r.status}: ${await r.text()}`);
    }

    const tools: string[] = [];
    const reader = (r.body as ReadableStream<Uint8Array>).getReader();
    const dec = new TextDecoder();
    let event = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split("\n")) {
        if (line.startsWith("event: ")) {
          event = line.slice(7).trim();
          continue;
        }
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if (event === "tool_start" && d.toolName) {
              tools.push(d.toolName);
              if (args.verbose && !isJsonOutput()) {
                process.stderr.write(`  ▸ ${d.toolName}\n`);
              }
            }
          } catch {
            /* non-JSON data line */
          }
        }
      }
    }

    output({
      projectId,
      tools,
      url: `https://kvid.ai/en/editor/${projectId}`,
    });
  },
});

const t2vCmd = defineCommand({
  meta: {
    name: "t2v",
    description:
      "Text-to-video async generation (submits job, optionally waits)",
  },
  args: {
    prompt: {
      type: "positional",
      required: true,
      description: "Video generation prompt",
    },
    model: {
      type: "string",
      description: "Model ID (server default if omitted)",
    },
    duration: {
      type: "string",
      description: "Duration in seconds",
    },
    wait: {
      type: "boolean",
      description: "Poll until completed before exiting",
    },
    output: {
      type: "string",
      description: "Download result video to this path (implies --wait)",
    },
    interval: {
      type: "string",
      description: "Poll interval in ms (default: 5000)",
    },
    timeout: {
      type: "string",
      description: "Max wait time in ms (default: 600000)",
    },
  },
  async run({ args }) {
    const body: Record<string, unknown> = {
      prompt: args.prompt,
      userEmail: process.env.KVIDAI_USER_EMAIL ?? loadConfig().userEmail,
    };
    if (args.model) body.model = args.model;
    if (args.duration) body.duration = Number(args.duration);

    const r = await fetch(
      `${PLATFORM_BASE}/ai/generation/text-to-video/generate-async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": getApiKey() },
        body: JSON.stringify(body),
      },
    );
    if (!r.ok) error(`t2v ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const jobId = String(
      data?.data?.job_id ??
        data?.data?.jobId ??
        data?.job_id ??
        data?.jobId ??
        "",
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
      const d = res?.data as Record<string, unknown>;
      const url =
        d?.result_url ?? d?.videoUrl ?? res?.result_url ?? res?.videoUrl;
      if (typeof url === "string") {
        const fetched = await fetch(url);
        const buf = Buffer.from(await fetched.arrayBuffer());
        writeFileSync(args.output as string, buf);
        process.stderr.write(`Downloaded → ${args.output}\n`);
      }
    }
    output(result);
  },
});

export default defineCommand({
  meta: {
    name: "video",
    description: "Generate video via agent or text-to-video",
  },
  subCommands: {
    generate: generateCmd,
    t2v: t2vCmd,
  },
});
