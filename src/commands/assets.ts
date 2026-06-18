import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { error, output } from "../lib/output";

const uploadCmd = defineCommand({
  meta: {
    name: "upload",
    description: "Upload files to kvidai CDN",
  },
  args: {
    email: {
      type: "positional",
      required: true,
      description: "User email",
    },
    // Variadic files are read from (args as any)._ after email
  },
  async run({ args }) {
    const email = args.email as string;
    // citty/mri puts all positional argv in args._, email is also args._[0]
    const allPositionals = (args as Record<string, unknown>)._ as string[];
    const filePaths = allPositionals.slice(1);

    if (filePaths.length === 0) {
      error("At least one file path is required", {
        hint: "Usage: kvidai assets upload <email> <file1> [file2...]",
      });
    }

    const formData = new FormData();
    formData.append("email", email);
    for (const fp of filePaths) {
      const buf = readFileSync(fp);
      formData.append("files", new Blob([buf]), basename(fp));
    }

    const r = await fetch(`${PLATFORM_BASE}/api/media-management/upload`, {
      method: "POST",
      headers: { "api-key": getApiKey() },
      body: formData,
    });
    if (!r.ok) error(`upload ${r.status}: ${await r.text()}`);
    const d = await r.json();
    if (!d.success) error(`upload failed: ${JSON.stringify(d)}`);
    output(
      (d.data as Array<{ id: number; url: string; name: string }>).map(
        (f) => ({ id: f.id, url: f.url, name: f.name }),
      ),
    );
  },
});

const addCompositionCmd = defineCommand({
  meta: {
    name: "add-composition",
    description: "Add an asset to a project composition",
  },
  args: {
    projectId: {
      type: "positional",
      required: true,
      description: "Project ID",
    },
    email: {
      type: "positional",
      required: true,
      description: "User email",
    },
    assetJson: {
      type: "positional",
      required: true,
      description:
        'Asset JSON (e.g. \'{"id":"asset_1","type":"image","remoteUrl":"https://..."}\')',
    },
  },
  async run({ args }) {
    const asset = JSON.parse(args.assetJson as string);
    const r = await fetch(
      `${PLATFORM_BASE}/video-project/${args.projectId}/composition`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "api-key": getApiKey(),
        },
        body: JSON.stringify({
          email: args.email,
          operation: "add_asset",
          data: { asset },
        }),
      },
    );
    if (!r.ok) error(`add-composition ${r.status}: ${await r.text()}`);
    output(await r.json());
  },
});

const attachMediaCmd = defineCommand({
  meta: {
    name: "attach-media",
    description: "Attach file IDs to a project (requires STRAPI_TOKEN)",
  },
  args: {
    projectId: {
      type: "positional",
      required: true,
      description: "Project ID",
    },
    // Variadic file IDs are read from (args as any)._ after projectId
  },
  async run({ args }) {
    const token = process.env.STRAPI_TOKEN;
    if (!token) {
      error("STRAPI_TOKEN env var is required for attach-media");
    }

    const allPositionals = (args as Record<string, unknown>)._ as string[];
    const fileIds = allPositionals.slice(1).map(Number);

    if (fileIds.length === 0) {
      error("At least one file ID is required", {
        hint: "Usage: kvidai assets attach-media <projectId> <fileId1> [fileId2...]",
      });
    }

    const r = await fetch(
      `${PLATFORM_BASE}/api/video-projects/${args.projectId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "api-key": getApiKey(),
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data: { media: fileIds } }),
      },
    );
    if (!r.ok) error(`attach-media ${r.status}: ${await r.text()}`);
    output(await r.json());
  },
});

export default defineCommand({
  meta: {
    name: "assets",
    description: "Upload and attach media assets",
  },
  subCommands: {
    upload: uploadCmd,
    "add-composition": addCompositionCmd,
    "attach-media": attachMediaCmd,
  },
});
