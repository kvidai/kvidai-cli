import { defineCommand, renderUsage, runMain } from "citty";
import { renderBanner } from "./lib/banner";
import { loadConfig } from "./lib/config";
import { loadDotEnv } from "./lib/env";
import { isJsonOutput, output } from "./lib/output";
import {
  maybeTriggerBackgroundUpdate,
  preSwapPendingUpdate,
  runBackgroundUpdateCheck,
} from "./lib/updater";
import { VERSION } from "./lib/version";

preSwapPendingUpdate();

// Internal entrypoint used by the background auto-update subprocess.
// Never exposed to citty or the JSON help schema.
if (process.argv[2] === "__update-check") {
  runBackgroundUpdateCheck().finally(() => process.exit(0));
} else {
  startCli();
}

function startCli(): void {
  loadDotEnv();
  maybeTriggerBackgroundUpdate();

  // JSON help schema for agents — output before citty intercepts --help
  if (
    process.argv.includes("--json") &&
    !process.argv.slice(2).find((a) => !a.startsWith("-"))
  ) {
    output({
      name: "kvidai",
      version: VERSION,
      description:
        "Agent-first CLI for kvidai — generate, manage, and stream AI videos",
      install: "curl https://cli.kvid.ai/install -fsS | bash",
      env: {
        KVIDAI_API_KEY:
          "Your kvidai API key. Can also be set via `kvidai setup` (interactive) or `kvidai setup --non-interactive --api-key <key>` (for agents/CI). Get one at https://app.kvid.ai/settings",
        KVIDAI_BASE_URL:
          "Override the API base URL (default: https://api.kvid.ai)",
        KVIDAI_USER_EMAIL:
          "User email required for t2v generation and asset upload",
      },
      commands: {
        project: {
          description: "Create and inspect video projects",
          usage: "kvidai project <create|get|replace-composition> [args]",
          subcommands: {
            create:
              "kvidai project create <name> [--preset-id <id>] — creates a new project, outputs {id}",
            get: "kvidai project get <id> — get project details",
            "replace-composition":
              "kvidai project replace-composition <projectId> <compositionJsonFile> — replace the whole composition",
          },
        },
        preset: {
          description:
            "Manage reusable video presets (voice/tone/palette/scene defaults)",
          usage:
            "kvidai preset <list|get|get-by-preset-id|create|update|duplicate|delete> [args]",
          subcommands: {
            list: "kvidai preset list",
            get: "kvidai preset get <id>",
            "get-by-preset-id": "kvidai preset get-by-preset-id <presetId>",
            create: "kvidai preset create <file.json>",
            update: "kvidai preset update <id> <inlineJson|file.json>",
            duplicate: "kvidai preset duplicate <id> [name]",
            delete: "kvidai preset delete <id>",
          },
        },
        voice: {
          description: "Text-to-speech (TTS) generation",
          usage: "kvidai voice generate <text> [args]",
          subcommands: {
            generate:
              "kvidai voice generate <text> [--voice-id <id>] [--lang ko] [--speed 1.05] [--output a.mp3] — outputs {result_url, duration_seconds}",
          },
          env: {
            KVIDAI_USER_EMAIL:
              "Credit-pool identifier for TTS (or KVIDAI_PRODUCT_CODE/ID)",
          },
        },
        video: {
          description:
            "Generate video: agent (SSE), t2v, i2v, ref2vid, talk-v2v",
          usage: "kvidai video <generate|t2v|i2v|ref2vid|talk-v2v> [args]",
          subcommands: {
            generate:
              "kvidai video generate <projectId> <message> [--preset-id <id>] [--attachments '<json[]>'] [--cdn-url <url> --mime <type> --filename <name> --size <bytes>] [--verbose]",
            t2v: "kvidai video t2v <prompt> [--model <id>] [--duration <s>] [--wait] [--output <path>] [--interval <ms>] [--timeout <ms>]",
            i2v: "kvidai video i2v <prompt> --image <cdnUrl> [--model <id>] [--negative-prompt <s>] [--wait] [--output <path>]",
            ref2vid:
              "kvidai video ref2vid <prompt> --image <cdnUrl> | --images '<json[]>' [--video <cdnUrl>] [--model <id>] [--wait] [--output <path>]",
            "talk-v2v":
              "kvidai video talk-v2v <prompt> --video <cdnUrl> [--model <id>] [--negative-prompt <s>] [--wait] [--output <path>]",
          },
        },
        task: {
          description: "Check async generation job status",
          usage:
            "kvidai task status <jobId> [--wait] [--interval <ms>] [--timeout <ms>] [--output <path>]",
          subcommands: {
            status:
              "kvidai task status <jobId> [--wait] — single check or poll until completed",
          },
          options: {
            "--wait": "Poll until completed",
            "--interval": "Polling interval in ms (default: 5000)",
            "--timeout": "Max wait time in ms (default: 600000)",
            "--output": "Download result video to this path when done",
          },
        },
        image: {
          description: "Generate/edit images (t2i text-to-image, i2i image-to-image)",
          usage: "kvidai image <generate|i2i> [args]",
          subcommands: {
            generate:
              "kvidai image generate <prompt> [--size square|portrait_4_3|landscape_16_9|...] [--num <n>] [--output <path>]",
            i2i: "kvidai image i2i <prompt> --image <cdnUrl> | --images '<json[]>' [--model <id>] [--num <n>] [--wait] [--output <path>]",
          },
        },
        assets: {
          description: "Upload and attach media assets",
          usage: "kvidai assets <upload|add-composition> [args]",
          subcommands: {
            upload:
              "kvidai assets upload <file1> [file2...] — upload files via presigned URL, returns [{cdnUrl, key, size}]",
            "add-composition":
              "kvidai assets add-composition <projectId> <email> <assetJson> — add asset to project composition",
          },
        },
        upload: {
          description: "Upload a local file to kvidai CDN via presigned URL",
          usage: "kvidai upload <file_path>",
          args: "<file_path>",
        },
        setup: {
          description:
            "Configure your kvidai API key and preferences (supports non-interactive mode for agents/CI)",
          usage:
            "kvidai setup [--non-interactive --api-key <key> --output-format <auto|json|standard> [--no-]auto-load-env [--no-]auto-update]",
          options: {
            "--non-interactive":
              "Skip all prompts. Required to run without a TTY. Alias: -y.",
            "--api-key": "API key to save. Pass empty string to clear.",
            "--no-save-key":
              "With --api-key, don't persist the key to config.json.",
            "--output-format": "Default output mode: auto, json, or standard.",
            "--auto-load-env":
              "Auto-load KVIDAI_API_KEY and related vars from a local .env.",
            "--auto-update":
              "Enable background update checks. Use --no-auto-update to disable.",
          },
        },
        init: {
          description:
            "Install the default kvidai skill bundle into the current project",
          usage: "kvidai init [--force]",
          options: {
            "--force": "Reinstall skills even if already present",
          },
        },
        skills: {
          description:
            "Install, update, and list agent skills from the kvidai registry",
          usage: "kvidai skills <list|install|update|remove> [args]",
          subcommands: {
            list: "List skills available in the registry",
            install: "kvidai skills install <name> [--force]",
            update: "kvidai skills update [<name>]",
            remove: "kvidai skills remove <name>",
          },
          env: {
            KVIDAI_SKILLS_URL:
              "Override the registry base URL (default: https://raw.githubusercontent.com/kvidai/kvidai-cli/refs/heads/main/skills)",
            KVIDAI_AGENT_LINKS:
              "Comma-separated list of agent skill dirs to symlink into (default: .claude/skills)",
          },
        },
        docs: {
          description: "Search kvidai documentation and API references",
          usage: "kvidai docs <query>",
          args: "<query>",
        },
        version: {
          description: "Show version and check for updates",
          usage: "kvidai version",
        },
        update: {
          description: "Check for and apply updates to the kvidai CLI",
          usage: "kvidai update [--check] [--force]",
          options: {
            "--check": "Only check for a newer version; don't download",
            "--force":
              "Re-download and reinstall even if already on the latest",
          },
          env: {
            KVIDAI_NO_UPDATE:
              "Set to 1 to disable all automatic update checks (manual `update` still works)",
          },
        },
      },
    });
    process.exit(0);
  }

  // Rewrite `--version` to `version` subcommand so we get the full banner
  if (process.argv.length === 3 && process.argv[2] === "--version") {
    process.argv[2] = "version";
  }

  const main = defineCommand({
    meta: {
      name: "kvidai",
      version: VERSION,
      description: "Agent-first CLI for kvidai",
    },
    subCommands: {
      setup: () => import("./commands/setup").then((m) => m.default),
      init: () => import("./commands/init").then((m) => m.default),
      skills: () => import("./commands/skills/index").then((m) => m.default),
      project: () => import("./commands/project").then((m) => m.default),
      preset: () => import("./commands/preset").then((m) => m.default),
      voice: () => import("./commands/voice").then((m) => m.default),
      video: () => import("./commands/video").then((m) => m.default),
      image: () => import("./commands/image").then((m) => m.default),
      task: () => import("./commands/task").then((m) => m.default),
      assets: () => import("./commands/assets").then((m) => m.default),
      upload: () => import("./commands/upload").then((m) => m.default),
      gallery: () => import("./commands/gallery/index").then((m) => m.default),
      docs: () => import("./commands/docs").then((m) => m.default),
      version: () => import("./commands/version").then((m) => m.default),
      update: () => import("./commands/update").then((m) => m.default),
    },
  });

  runMain(main, {
    showUsage: async (cmd, parent) => {
      if (process.stdout.isTTY) {
        console.log(renderBanner(VERSION, "small"));
      }
      const usage = await renderUsage(cmd, parent);
      console.log(`${usage}\n`);

      if (
        !isJsonOutput() &&
        !process.env.KVIDAI_API_KEY &&
        !loadConfig().apiKey
      ) {
        console.log(
          "Tip: set KVIDAI_API_KEY in your environment or run `kvidai setup` before using commands.",
        );
        console.log(
          '     For agents/CI: `kvidai setup --non-interactive --api-key "$KVIDAI_API_KEY"`.',
        );
        console.log();
      }
    },
  });
}
