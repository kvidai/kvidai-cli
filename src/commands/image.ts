import { writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { asyncGenArgs, runAsyncGeneration, userEmail } from "../lib/generation";
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

const i2iCmd = defineCommand({
  meta: {
    name: "i2i",
    description:
      "Image-to-image async generation (edit/transform a source image)",
  },
  args: {
    prompt: {
      type: "positional",
      required: true,
      description: "Edit instruction (how to transform the image)",
    },
    image: {
      type: "string",
      description: "Source image CDN URL (single; or use --images)",
    },
    images: {
      type: "string",
      description: "JSON array of source image URLs (overrides --image)",
    },
    model: {
      type: "string",
      description: "Model ID (server default if omitted)",
    },
    num: { type: "string", description: "Number of images (default 1)" },
    ...asyncGenArgs,
  },
  async run({ args }) {
    const imageUrls = args.images
      ? JSON.parse(args.images as string)
      : args.image
        ? [args.image]
        : [];
    if (!imageUrls.length) error("i2i requires --image or --images");
    const body: Record<string, unknown> = {
      prompt: args.prompt,
      function: "img2img",
      image_urls: imageUrls,
      userEmail: userEmail(),
    };
    if (args.model) body.model = args.model;
    if (args.num) body.num_images = Number(args.num);
    await runAsyncGeneration(
      "i2i",
      "/ai/generation/image-to-image/generate-async",
      body,
      args,
    );
  },
});

export default defineCommand({
  meta: { name: "image", description: "Generate/edit images (t2i, i2i)" },
  subCommands: {
    generate: generateCmd,
    i2i: i2iCmd,
  },
});
