import { writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { loadConfig } from "../lib/config";
import { error, output } from "../lib/output";

// TTS (text-to-speech). Not part of the core kvidai CLI surface before — the
// generation endpoints live under /ai/generation/voice/* and identify the credit
// pool by email (or product_code/product_id). Auth: api-key header.
async function aiFetch(path: string, init?: RequestInit) {
  const r = await fetch(`${PLATFORM_BASE}${path}`, {
    ...init,
    headers: { "api-key": getApiKey(), ...(init?.headers ?? {}) },
  });
  if (!r.ok) error(`voice ${r.status}: ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// Generation endpoints need a credit-pool identifier in the body.
function creditId(): Record<string, string> {
  if (process.env.KVIDAI_PRODUCT_CODE) return { product_code: process.env.KVIDAI_PRODUCT_CODE };
  if (process.env.KVIDAI_PRODUCT_ID) return { product_id: process.env.KVIDAI_PRODUCT_ID };
  const email = process.env.KVIDAI_USER_EMAIL ?? loadConfig().userEmail;
  if (email) return { email };
  error("Credit identifier required: set KVIDAI_USER_EMAIL (or KVIDAI_PRODUCT_CODE/ID)");
  return {};
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const generateCmd = defineCommand({
  meta: { name: "generate", description: "Text-to-speech: generate an mp3 from text" },
  args: {
    text: { type: "positional", required: true, description: "Text to speak" },
    "voice-id": { type: "string", description: "ElevenLabs voice id (default: pNInz6obpgDQGcFmaJgB)" },
    "model-id": { type: "string", description: "TTS model id (default: eleven_multilingual_v2)" },
    lang: { type: "string", description: "Language code (e.g. ko)" },
    speed: { type: "string", description: "Speaking speed (e.g. 1.05)" },
    format: { type: "string", description: "Output format (default: mp3_44100_128)" },
    output: { type: "string", description: "Download the mp3 to this path" },
    interval: { type: "string", description: "Poll interval ms (default 3000)" },
    timeout: { type: "string", description: "Poll timeout ms (default 300000)" },
  },
  async run({ args }) {
    const body: Record<string, unknown> = {
      ...creditId(),
      text: String(args.text),
      voice_id: args["voice-id"] || "pNInz6obpgDQGcFmaJgB",
      model_id: args["model-id"] || "eleven_multilingual_v2",
      output_format: args.format || "mp3_44100_128",
      ...(args.lang ? { language_code: String(args.lang) } : {}),
      ...(args.speed ? { voice_settings: { speed: Number(args.speed) } } : {}),
    };
    const submit = await aiFetch("/ai/generation/voice/text-to-speech/generate-async", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const jobId = submit?.data?.job_id ?? submit?.job_id;
    if (!jobId) error(`No job_id in response: ${JSON.stringify(submit)}`);

    const interval = Number(args.interval) || 3000;
    const timeout = Number(args.timeout) || 300000;
    const start = Date.now();
    // poll until completed
    while (true) {
      const st = await aiFetch(`/ai/generation/voice/status?jobId=${encodeURIComponent(jobId)}`);
      const status = String(st?.data?.status ?? st?.status ?? "");
      if (/completed/i.test(status)) break;
      if (/failed|error/i.test(status)) error(`voice failed: ${JSON.stringify(st)}`);
      if (Date.now() - start > timeout) error("voice timeout");
      await sleep(interval);
    }

    const result = await aiFetch(`/ai/generation/voice/result?jobId=${encodeURIComponent(jobId)}`);
    const d = result?.data ?? result;
    if (args.output && d?.result_url) {
      const res = await fetch(d.result_url as string);
      if (!res.ok) error(`download ${res.status}: ${d.result_url}`);
      writeFileSync(args.output as string, Buffer.from(await res.arrayBuffer()));
    }
    output({
      result_url: d?.result_url,
      duration_seconds: d?.duration_seconds,
      alignment: d?.alignment,
      output: args.output ?? null,
    });
  },
});

export default defineCommand({
  meta: { name: "voice", description: "Text-to-speech (TTS) generation" },
  subCommands: {
    generate: generateCmd,
  },
});
