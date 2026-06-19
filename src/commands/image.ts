import { writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { error, output } from "../lib/output";

const generateCmd = defineCommand({
  meta: {
    name: "generate",
    description: "Generate an image from a text prompt",
  },
  args: {
    prompt: {
      type: "positional",
      required: true,
      description: "Image generation prompt",
    },
    model: {
      type: "string",
      description: "Model ID (server default if omitted)",
    },
    size: {
      type: "string",
      description:
        "Image size preset: square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9 (default: square)",
    },
    num: {
      type: "string",
      description: "Number of images to generate (default: 1)",
    },
    output: {
      type: "string",
      description: "Download result image to this path",
    },
  },
  async run({ args }) {
    const body: Record<string, unknown> = { prompt: args.prompt };
    if (args.model) body.model = args.model;
    if (args.size) body.image_size = args.size;
    if (args.num) body.num_images = Number(args.num);

    const r = await fetch(`${PLATFORM_BASE}/ai/image/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": getApiKey() },
      body: JSON.stringify(body),
    });
    if (!r.ok) error(`image/generate ${r.status}: ${await r.text()}`);
    const data = await r.json();

    if (args.output) {
      const url = data?.data?.url ?? data?.url;
      if (typeof url === "string") {
        const fetched = await fetch(url);
        const buf = Buffer.from(await fetched.arrayBuffer());
        writeFileSync(args.output as string, buf);
        process.stderr.write(`Downloaded → ${args.output}\n`);
      }
    }

    output(data);
  },
});

export default defineCommand({
  meta: { name: "image", description: "Generate images from text prompts" },
  subCommands: {
    generate: generateCmd,
  },
});
