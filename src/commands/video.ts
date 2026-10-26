import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { asyncGenArgs, runAsyncGeneration, userEmail } from "../lib/generation";
import { error, isJsonOutput, output } from "../lib/output";

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
    ...asyncGenArgs,
  },
  async run({ args }) {
    const body: Record<string, unknown> = {
      prompt: args.prompt,
      function: "txt2vid",
      userEmail: userEmail(),
    };
    if (args.model) body.model = args.model;
    if (args.duration) body.duration = Number(args.duration);
    await runAsyncGeneration(
      "t2v",
      "/ai/generation/text-to-video/generate-async",
      body,
      args,
    );
  },
});

const i2vCmd = defineCommand({
  meta: {
    name: "i2v",
    description: "Image-to-video async generation (source image → video)",
  },
  args: {
    prompt: {
      type: "positional",
      required: true,
      description: "Motion/scene prompt describing how to animate the image",
    },
    image: {
      type: "string",
      required: true,
      description: "Source image CDN URL (from `kvidai upload`)",
    },
    model: {
      type: "string",
      description: "Model ID (server default if omitted)",
    },
    "negative-prompt": { type: "string", description: "Negative prompt" },
    ...asyncGenArgs,
  },
  async run({ args }) {
    const body: Record<string, unknown> = {
      prompt: args.prompt,
      function: "img2vid",
      image_url: args.image,
      userEmail: userEmail(),
    };
    if (args.model) body.model = args.model;
    if (args["negative-prompt"]) body.negative_prompt = args["negative-prompt"];
    await runAsyncGeneration(
      "i2v",
      "/ai/generation/image-to-video/generate-async",
      body,
      args,
    );
  },
});

const ref2vidCmd = defineCommand({
  meta: {
    name: "ref2vid",
    description:
      "Reference-to-video async generation (reference image(s) → video)",
  },
  args: {
    prompt: {
      type: "positional",
      required: true,
      description: "Video prompt (describe motion/scene using the reference)",
    },
    image: {
      type: "string",
      description: "Reference image CDN URL (single; or use --images)",
    },
    images: {
      type: "string",
      description: "JSON array of reference image URLs (overrides --image)",
    },
    video: {
      type: "string",
      description: "Reference video CDN URL (optional)",
    },
    model: {
      type: "string",
      description: "Model ID (server default if omitted)",
    },
    ...asyncGenArgs,
  },
  async run({ args }) {
    const imageUrls = args.images
      ? JSON.parse(args.images as string)
      : args.image
        ? [args.image]
        : [];
    if (!imageUrls.length) error("ref2vid requires --image or --images");
    const body: Record<string, unknown> = {
      prompt: args.prompt,
      function: "ref2vid",
      image_urls: imageUrls,
      video_urls: args.video ? [args.video] : [],
      userEmail: userEmail(),
    };
    if (args.model) body.model = args.model;
    await runAsyncGeneration(
      "ref2vid",
      "/ai/generation/reference-to-video/generate-async",
      body,
      args,
    );
  },
});

const v2vCmd = defineCommand({
  meta: {
    name: "v2v",
    description:
      "Video-to-video async generation (input video + prompt → transformed video)",
  },
  args: {
    prompt: {
      type: "positional",
      required: true,
      description: "Transformation prompt (how to change the video)",
    },
    video: {
      type: "string",
      required: true,
      description: "Input video CDN URL (from `kvidai upload`)",
    },
    model: {
      type: "string",
      description:
        "Model fal id (default: alibaba/wan-3.0/reference-to-video). Others: fal-ai/kling-video/o3/pro/video-to-video/reference, bytedance/seedance-2.5/reference-to-video",
    },
    duration: {
      type: "string",
      description:
        "Duration in seconds (4-30, default 5) or 'auto' (seedance 2.5)",
    },
    resolution: {
      type: "string",
      description: "Resolution: 480p, 720p, 1080p (default 720p)",
    },
    "aspect-ratio": {
      type: "string",
      description:
        "Aspect ratio (model-dependent, e.g. 16:9/9:16/adaptive/auto)",
    },
    seed: {
      type: "string",
      description: "Seed for reproducibility (optional)",
    },
    ...asyncGenArgs,
  },
  async run({ args }) {
    const body: Record<string, unknown> = {
      prompt: args.prompt,
      input_video_url: args.video,
      // v2v 는 model 이 필수 (fal id). 미지정 시 wan3 기본.
      model: args.model || "alibaba/wan-3.0/reference-to-video",
      userEmail: userEmail(),
    };
    if (args.duration)
      body.duration = args.duration === "auto" ? "auto" : Number(args.duration);
    if (args.resolution) body.resolution = args.resolution;
    if (args["aspect-ratio"]) body.aspect_ratio = args["aspect-ratio"];
    if (args.seed) body.seed = Number(args.seed);
    await runAsyncGeneration(
      "v2v",
      "/ai/generation/video-to-video/generate-async",
      body,
      args,
    );
  },
});

const talkV2vCmd = defineCommand({
  meta: {
    name: "talk-v2v",
    description:
      "Lip-sync (audio + image/video → talking video). Image mode (face photo) or video mode (existing clip).",
  },
  args: {
    prompt: {
      type: "positional",
      required: false,
      description: "Optional subject/scene description",
    },
    audio: {
      type: "string",
      required: true,
      description:
        "Audio (voice) CDN URL to lip-sync to (from `kvidai upload`)",
    },
    image: {
      type: "string",
      description:
        "Face image CDN URL — image mode (talk_i2v). Provide --image OR --video",
    },
    video: {
      type: "string",
      description:
        "Talking video CDN URL — video mode (talk_v2v). Provide --image OR --video",
    },
    model: {
      type: "string",
      description:
        "Image-mode avatar model (default fal-ai/kling-video/ai-avatar/v2/standard; or .../pro, fal-ai/bytedance/omnihuman). Ignored in video mode.",
    },
    "negative-prompt": { type: "string", description: "Negative prompt" },
    ...asyncGenArgs,
  },
  async run({ args }) {
    if (!args.image && !args.video) {
      error("talk-v2v requires --image (image mode) or --video (video mode)");
    }
    if (!args.audio) {
      error("talk-v2v requires --audio (voice track to lip-sync to)");
    }
    const isImageMode = !!args.image && !args.video;
    const body: Record<string, unknown> = {
      prompt: args.prompt || "",
      audio_file: args.audio,
      userEmail: userEmail(),
    };
    if (isImageMode) {
      // 이미지 립싱크 (talk_i2v): 사진 1장 + 오디오, model = fal avatar id
      body.image_url = args.image;
      body.function = "talk_i2v";
      body.model = args.model || "fal-ai/kling-video/ai-avatar/v2/standard";
    } else {
      // 영상 립싱크 (talk_v2v): 입력 영상 + 오디오, model = 'talk' (sync-lipsync)
      body.input_video = args.video;
      body.function = "talk_v2v";
      body.model = "talk";
    }
    if (args["negative-prompt"]) body.negative_prompt = args["negative-prompt"];
    await runAsyncGeneration(
      "talk-v2v",
      "/ai/generation/talk-v2v/generate-async",
      body,
      args,
    );
  },
});

export default defineCommand({
  meta: {
    name: "video",
    description: "Generate video: agent, t2v, i2v, ref2vid, v2v, talk-v2v",
  },
  subCommands: {
    generate: generateCmd,
    t2v: t2vCmd,
    i2v: i2vCmd,
    ref2vid: ref2vidCmd,
    v2v: v2vCmd,
    "talk-v2v": talkV2vCmd,
  },
});
