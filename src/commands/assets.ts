import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { error, output } from "../lib/output";
import { presignedUpload } from "./upload";

const uploadCmd = defineCommand({
  meta: {
    name: "upload",
    description: "Upload files to kvidai CDN (presigned PUT)",
  },
  args: {
    // Variadic files read from (args as any)._
  },
  async run({ args }) {
    const filePaths = (args as Record<string, unknown>)._ as string[];

    if (filePaths.length === 0) {
      error("At least one file path is required", {
        hint: "Usage: kvidai assets upload <file1> [file2...]",
      });
    }

    const results = await Promise.all(filePaths.map(presignedUpload));
    output(results);
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

export default defineCommand({
  meta: {
    name: "assets",
    description: "Upload and attach media assets",
  },
  subCommands: {
    upload: uploadCmd,
    "add-composition": addCompositionCmd,
  },
});
