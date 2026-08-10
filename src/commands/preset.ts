import { readFileSync } from "node:fs";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { error, output } from "../lib/output";

// Presets seed new video projects (voice, tone, color palette, scene defaults).
// APIM (/preset) rewrites to Strapi video-preset. Auth: api-key only — APIM injects
// the caller email on the backend hop, so no email is sent here.
async function presetFetch(path: string, init?: RequestInit) {
  const r = await fetch(`${PLATFORM_BASE}/preset${path}`, {
    ...init,
    headers: { "api-key": getApiKey(), ...(init?.headers ?? {}) },
  });
  if (!r.ok) error(`preset ${r.status}: ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

const listCmd = defineCommand({
  meta: { name: "list", description: "List presets" },
  async run() {
    output(await presetFetch("/"));
  },
});

const getCmd = defineCommand({
  meta: { name: "get", description: "Get a preset by numeric id" },
  args: { id: { type: "positional", required: true, description: "Numeric preset id" } },
  async run({ args }) {
    output(await presetFetch(`/${args.id}`));
  },
});

const getByPresetIdCmd = defineCommand({
  meta: { name: "get-by-preset-id", description: "Get a preset by its presetId string" },
  args: { presetId: { type: "positional", required: true, description: "presetId (e.g. ko-shorts)" } },
  async run({ args }) {
    output(await presetFetch(`/by-preset-id/${encodeURIComponent(args.presetId as string)}`));
  },
});

const createCmd = defineCommand({
  meta: { name: "create", description: "Create a preset from a JSON file" },
  args: { file: { type: "positional", required: true, description: "Path to preset JSON" } },
  async run({ args }) {
    const body = JSON.parse(readFileSync(args.file as string, "utf8"));
    output(await presetFetch("/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  },
});

const updateCmd = defineCommand({
  meta: { name: "update", description: "Update a preset (numeric id) from inline JSON or a file" },
  args: {
    id: { type: "positional", required: true, description: "Numeric preset id" },
    json: { type: "positional", required: true, description: "Inline JSON string, or path to a .json file" },
  },
  async run({ args }) {
    const raw = args.json as string;
    const body = JSON.parse(raw.trim().startsWith("{") ? raw : readFileSync(raw, "utf8"));
    output(await presetFetch(`/${args.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  },
});

const duplicateCmd = defineCommand({
  meta: { name: "duplicate", description: "Duplicate a preset" },
  args: {
    id: { type: "positional", required: true, description: "Numeric preset id" },
    name: { type: "positional", required: false, description: "Name for the copy" },
  },
  async run({ args }) {
    const body = args.name ? { name: args.name } : {};
    output(await presetFetch(`/${args.id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  },
});

const deleteCmd = defineCommand({
  meta: { name: "delete", description: "Delete a preset" },
  args: { id: { type: "positional", required: true, description: "Numeric preset id" } },
  async run({ args }) {
    output(await presetFetch(`/${args.id}`, { method: "DELETE" }));
  },
});

export default defineCommand({
  meta: { name: "preset", description: "Manage reusable video presets (voice/tone/palette/scene defaults)" },
  subCommands: {
    list: listCmd,
    get: getCmd,
    "get-by-preset-id": getByPresetIdCmd,
    create: createCmd,
    update: updateCmd,
    duplicate: duplicateCmd,
    delete: deleteCmd,
  },
});
