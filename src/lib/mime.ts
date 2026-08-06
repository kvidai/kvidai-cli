export const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".pdf": "application/pdf",
  ".glb": "model/gltf-binary",
  ".obj": "model/obj",
};

// Fallback MIME per composition asset type, used when the extension is unknown.
const DEFAULT_MIME_BY_TYPE: Record<string, string> = {
  video: "video/mp4",
  image: "image/png",
  audio: "audio/mpeg",
  gif: "image/gif",
};

// Extract a MIME type from a filename or URL by its extension (query/hash stripped).
export function mimeFromExtension(nameOrUrl?: string): string | undefined {
  if (!nameOrUrl) return undefined;
  const clean = nameOrUrl.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  if (dot === -1) return undefined;
  return MIME_TYPES[clean.slice(dot).toLowerCase()];
}

// Resolve a valid MIME type for a composition asset. The editor builds
// `new Blob([bytes], { type: asset.mimeType })`; an empty type yields a blob
// URL the browser <video> can't decode (DEMUXER_ERROR), so never leave it blank.
export function resolveAssetMimeType(asset: {
  type?: string;
  filename?: string;
  remoteUrl?: string;
  mimeType?: string;
}): string {
  if (asset.mimeType) return asset.mimeType;
  return (
    mimeFromExtension(asset.filename) ??
    mimeFromExtension(asset.remoteUrl) ??
    (asset.type ? DEFAULT_MIME_BY_TYPE[asset.type] : undefined) ??
    "application/octet-stream"
  );
}
