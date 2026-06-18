import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { error, output } from "../lib/output";

async function apiFetch(path: string, init?: RequestInit) {
  const r = await fetch(`${PLATFORM_BASE}${path}`, {
    ...init,
    headers: {
      "api-key": getApiKey(),
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

const createCmd = defineCommand({
  meta: { name: "create", description: "Create a new video project" },
  args: {
    name: {
      type: "positional",
      required: true,
      description: "Project name",
    },
    "preset-id": {
      type: "string",
      description: "Preset ID (e.g. review-owl)",
    },
  },
  async run({ args }) {
    const body: Record<string, unknown> = { name: args.name };
    if (args["preset-id"]) body.presetId = args["preset-id"];
    const data = await apiFetch("/video-project/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const id = data?.data?.id ?? data?.id;
    if (typeof id !== "number") {
      error(`No project ID in response: ${JSON.stringify(data)}`);
    }
    output({ id });
  },
});

const getCmd = defineCommand({
  meta: { name: "get", description: "Get video project details" },
  args: {
    id: {
      type: "positional",
      required: true,
      description: "Project ID",
    },
  },
  async run({ args }) {
    const data = await apiFetch(`/video-project/${args.id}`);
    output(data);
  },
});

export default defineCommand({
  meta: { name: "project", description: "Create and inspect video projects" },
  subCommands: {
    create: createCmd,
    get: getCmd,
  },
});
