import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { defineCommand } from "citty";
import { getApiKey, PLATFORM_BASE } from "../lib/api";
import { MIME_TYPES } from "../lib/mime";
import { error, output } from "../lib/output";

export async function presignedUpload(
  filePath: string,
): Promise<{ cdnUrl: string; key: string; size: number }> {
  const filename = basename(filePath);
  const ext = extname(filename).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";
  const size = statSync(filePath).size;

  const presignRes = await fetch(
    `${PLATFORM_BASE}/media/presigned-upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": getApiKey() },
      body: JSON.stringify({ filename, mimeType, size }),
    },
  );
  if (!presignRes.ok)
    error(
      `presigned-upload-url ${presignRes.status}: ${await presignRes.text()}`,
    );
  const { data } = (await presignRes.json()) as {
    data: { uploadUrl: string; cdnUrl: string; key: string };
  };

  const buf = readFileSync(filePath);
  const putRes = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType, "x-amz-acl": "public-read" },
    body: buf,
  });
  if (!putRes.ok) error(`upload PUT ${putRes.status}: ${await putRes.text()}`);

  return { cdnUrl: data.cdnUrl, key: data.key, size };
}

export default defineCommand({
  meta: {
    name: "upload",
    description: "Upload a local file to kvidai CDN",
  },
  args: {
    file: {
      type: "positional",
      required: true,
      description: "Local file path to upload",
    },
  },
  async run({ args }) {
    const result = await presignedUpload(args.file as string);
    output(result);
  },
});
