import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { error, output } from "../lib/output";

export default defineCommand({
  meta: {
    name: "upload",
    description:
      "Upload a local file to kvidai CDN (uses KVIDAI_USER_EMAIL or --email)",
  },
  args: {
    file: {
      type: "positional",
      required: true,
      description: "Local file path to upload",
    },
    email: {
      type: "string",
      description:
        "User email (overrides KVIDAI_USER_EMAIL env var)",
    },
  },
  async run({ args }) {
    const filePath = args.file as string;
    const email = (args.email as string | undefined) ?? process.env.KVIDAI_USER_EMAIL;

    if (!email) {
      error("Email is required", {
        hint: "Set KVIDAI_USER_EMAIL in your environment or pass --email <email>",
      });
    }

    const buf = readFileSync(filePath);
    const formData = new FormData();
    formData.append("email", email as string);
    formData.append("files", new Blob([buf]), basename(filePath));

    const r = await fetch(`${PLATFORM_BASE}/api/media-management/upload`, {
      method: "POST",
      headers: { "api-key": getApiKey() },
      body: formData,
    });
    if (!r.ok) error(`upload ${r.status}: ${await r.text()}`);
    const d = await r.json();
    if (!d.success) error(`upload failed: ${JSON.stringify(d)}`);

    const file = (d.data as Array<{ id: number; url: string; name: string }>)[0];
    output({ id: file.id, url: file.url, name: file.name });
  },
});
