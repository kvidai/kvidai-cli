// Pure HTML renderer for the kvidai gallery. NO I/O at request time, no
// `process`/`fs` access. The actual HTML / CSS / JS lives in
// `./gallery-assets/` as editable .html / .css / .js files; we just splice
// page-specific data into a Mustache-style template at call time.
//
// Bun embeds the files as string constants via `with { type: "text" }`, so
// the compiled binary still ships a single self-contained executable.

// The HTML templates intentionally use the `.html.tmpl` extension: Bun's
// build pipeline applies its HTML loader to any `*.html` file in the
// import graph and strips `{{{...}}}` braces inside `<script>` blocks
// (parsing them as broken JS) even with `with { type: "text" }`. A
// non-`.html` extension keeps Bun's HTML loader out of the way so the
// templater can see the raw placeholders.
import indexScript from "./gallery-assets/index.client.js" with {
  type: "text",
};
import indexCss from "./gallery-assets/index.css" with { type: "text" };
import indexHtml from "./gallery-assets/index.html.tmpl" with { type: "text" };
import sessionScript from "./gallery-assets/session.client.js" with {
  type: "text",
};
import sessionCss from "./gallery-assets/session.css" with { type: "text" };
import sessionHtml from "./gallery-assets/session.html.tmpl" with {
  type: "text",
};
import sharedScript from "./gallery-assets/shared.client.js" with {
  type: "text",
};
import sharedStyles from "./gallery-assets/styles.css" with { type: "text" };
import { VERSION } from "./version";

export type AssetKind = "image" | "video" | "audio" | "model" | "other";

export interface GalleryFile {
  path: string | null;
  url: string;
  size_bytes: number | null;
  kind: AssetKind;
  json_path: string;
}

export interface RunRecord {
  ts: number;
  request_id: string;
  endpoint_id: string;
  modality: string | null;
  prompt: string | null;
  duration_ms: number | null;
  files: GalleryFile[];
}

export interface SessionPayload {
  schema_version: 1;
  session_id: string;
  session_source: string;
  agent: string | null;
  agent_host: string | null;
  cwd: string | null;
  started_at: number;
  updated_at: number;
  // Optional user-set display name. Cosmetic only — the on-disk id stays
  // anchored to the process-tree resolver so future runs still land here.
  label?: string;
  runs: RunRecord[];
}

// image/video render real media; audio = synthetic waveform; 3d/other =
// kind-icon placeholder. All counted toward the 4-slot cap (FIFO).
export interface SessionPreview {
  kind: "image" | "video" | "audio" | "model" | "other";
  file: string | null;
  url: string;
}

export interface SessionSummary {
  session_id: string;
  label: string | null;
  agent: string | null;
  agent_host: string | null;
  started_at: number;
  updated_at: number;
  run_count: number;
  asset_count: number;
  kind_counts: Record<AssetKind, number>;
  modalities: string[];
  previews: SessionPreview[];
}

const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

// Escapes a JSON string so it can be embedded inside <script>...</script>
// without breaking out of the tag. `</script>` is the only sequence that
// matters; `<!--` is escaped for good measure.
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("</", "<\\/")
    .replaceAll("<!--", "<\\u0021--");
}

// Tiny Mustache-style templater. Two forms only:
//   - `{{key}}`   — HTML-escaped substitution
//   - `{{{key}}}` — raw substitution
// Unknown keys are removed (so leftover placeholders never reach the user).
// Substitution is a single pass — inserted strings are never re-scanned, so
// values that happen to contain `{{…}}` make it through verbatim.
const TEMPLATE_RE = /\{\{\{\s*(\w+)\s*\}\}\}|\{\{\s*(\w+)\s*\}\}/g;

export function applyTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(
    TEMPLATE_RE,
    (_match, rawKey: string | undefined, escKey: string | undefined) => {
      if (rawKey !== undefined) {
        return Object.hasOwn(vars, rawKey) ? vars[rawKey] : "";
      }
      const key = escKey as string;
      return Object.hasOwn(vars, key) ? escapeHtml(vars[key]) : "";
    },
  );
}

export function renderSessionHtml(payload: SessionPayload): string {
  return applyTemplate(sessionHtml, {
    title: `kvidai session ${payload.session_id}`,
    styles: `${sharedStyles}\n${sessionCss}`,
    shared_script: sharedScript,
    page_script: sessionScript,
    data: safeJson(payload),
    version: VERSION,
    kvidai_icon: "",
  });
}

export function renderSessionsIndexHtml(sessions: SessionSummary[]): string {
  return applyTemplate(indexHtml, {
    styles: `${sharedStyles}\n${indexCss}`,
    shared_script: sharedScript,
    page_script: indexScript,
    data: safeJson({ schema_version: 1 as const, sessions }),
    version: VERSION,
    kvidai_icon: "",
  });
}
