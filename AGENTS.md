# kvidai CLI agent guide

## Scope

These instructions apply to the repository root unless a deeper `AGENTS.md` overrides them.

## Repository shape

- `src/index.ts` is the CLI entrypoint and lazy-loads subcommands.
- `src/commands/` contains one file per command or command group.
- `src/lib/` contains shared runtime helpers for config, API access, output, and UI.
- `scripts/` contains build and maintenance scripts.

## Working conventions

- Keep changes small and focused. Match the existing TypeScript + ESM style.
- Prefer updating shared helpers over duplicating logic across commands.
- Use `bun` for repo scripts and local execution.
- Follow Biome formatting conventions already present in the codebase.

## CLI command conventions

- Define commands with `defineCommand` from `citty`.
- Register new top-level commands in `src/index.ts` using the existing lazy-import pattern.
- Put shared request or parsing logic in `src/lib/` when it is used by more than one command.
- Prefer descriptive argument names that match the public CLI surface.
- Preserve existing aliases and compatibility behavior unless the task explicitly changes them.

## Output and UX

- This CLI is agent-first: preserve structured JSON output for `--json` and non-TTY usage.
- Prefer `output()`, `outputRawJson()`, `error()`, `isJsonOutput()`, and related helpers from `src/lib/output.ts` instead of ad hoc `console.log` handling.
- Only write custom pretty-mode terminal output when the command needs a richer TTY presentation.
- Avoid adding interactive prompts to non-interactive commands.

## API and config

- API base URL: `https://api.kvid.ai` (overridable via `KVIDAI_BASE_URL`).
- Auth header: `api-key: <KVIDAI_API_KEY>`.
- Reuse helpers from `src/lib/api.ts`, `src/lib/config.ts`, and `src/lib/env.ts` instead of reimplementing headers, auth, or config loading.
- Config is stored in `~/.kvidai/config.json`.
- Keep environment-variable behavior documented and consistent with help text and README examples.
- When changing command behavior, update the JSON help schema in `src/index.ts` if the public interface changes.

## Self-update

- All update logic lives in `src/lib/updater.ts`. The `update` command and the background check in `src/index.ts` both go through it — don't reimplement download/checksum/swap logic elsewhere.
- Startup in `src/index.ts` runs `preSwapPendingUpdate()` first (atomic swap of a staged `.new` binary) and may fire `maybeTriggerBackgroundUpdate()` (detached subprocess, rate-limited to once per hour, TTY-only). Respect `KVIDAI_NO_UPDATE=1` and `config.autoUpdate` in any update-related code.

## Skills

All agent skills live in [`kvidai/kvidai-skills`](https://github.com/kvidai/kvidai-skills) (separate repo, not a submodule of this one). `src/lib/skills-registry.ts`'s `DEFAULT_REGISTRY_URL` points at its `main` branch — this repo has no bundled `skills/` directory of its own. This split exists so `kvidai skills install` / `kvidai init` keep working even if this repo's visibility changes.

Some skills there teach agents how to call `kvidai run`, `kvidai schema`, `kvidai upload`, etc. and require the kvidai binary on the same machine (marked "Requires: the kvidai CLI" under the title in their `SKILL.md`); others call `api.kvid.ai` directly via Node.js and need no CLI. Installed via `kvidai init` / `kvidai skills install <name>` (this CLI) or `npx skills add kvidai/kvidai-skills` (any agent).

To add or modify a skill, work in the `kvidai/kvidai-skills` repo directly — see its `AGENTS.md` for `scripts/build-skills-index.ts` and the index-regeneration steps.

## Validation

- Prefer the smallest useful validation first.
- Common checks:
  - `bun run typecheck`
  - `bun run check`
  - `bun run build`
- Run broader build validation when changing packaging, generated artifacts, or command registration.

## Documentation

- Update `README.md` when adding commands, flags, environment variables, install behavior, or agent workflow changes.
- Keep examples aligned with the actual CLI output and command names.

## Releasing

Releases are driven by version tags (`vX.Y.Z`). Pushing a matching tag triggers `.github/workflows/release.yml`, which builds cross-platform binaries and publishes a GitHub Release with checksums. The workflow verifies `package.json` version matches the tag and fails the build on mismatch.

Steps:

1. Bump `version` in `package.json` to the new `X.Y.Z`.
2. Commit with `chore: X.Y.Z release`.
3. Push `main`: `git push origin main`.
4. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

Pre-release versions (e.g. `0.4.0-alpha.0`) are auto-detected from the version string and marked as pre-release on GitHub.

<!-- BEGIN kvidai:kvidai -->
## kvidai CLI

# kvidai workflow

> **Requires**: the [kvidai CLI](https://github.com/kvidai/kvidai-cli) installed locally (`kvidai --version` to check).

kvidai has a small, fixed set of commands and emits structured JSON when
called with `--json` or when stdout is not a TTY. There is no model
catalog to search and no per-model schema to inspect — the command set
below is the complete surface.

## Authentication

kvidai reads credentials from (in priority order):

1. `KVIDAI_API_KEY` environment variable
2. `~/.kvidai/config.json` (written by `kvidai setup`)
3. A project `.env` file (if auto-load is enabled via `kvidai setup`)

```
kvidai setup --non-interactive --api-key <key> --json    # agents/CI
kvidai setup                                              # interactive wizard
```

`KVIDAI_USER_EMAIL` is also required for `video t2v` and `assets upload`.

## Steps

1. **Pick the right command** for what the user wants:

   | Want | Command |
   |---|---|
   | A single image from a prompt | `kvidai image generate <prompt> ...` |
   | A single video from a prompt, no existing project | `kvidai video t2v <prompt> ...` |
   | Edit/build inside an existing (or new) video project via the AI agent — multi-turn, can attach files | `kvidai project create` then `kvidai video generate <projectId> <message>` |

2. **Upload local files first** if the user gave you a local file to use as
   input (a reference image, a clip to attach to an agent message):
   ```
   kvidai upload <local_file> --json
   ```
   Use the returned `cdnUrl` — for `video generate`, pass it as `--cdn-url`.

3. **Generate**:
   ```
   kvidai image generate "<prompt>" --size landscape_16_9 --output ./out.png --json
   kvidai video t2v "<prompt>" --duration 10 --wait --output ./out.mp4 --json
   kvidai video generate <projectId> "<message>" --cdn-url <url> --mime image/png --verbose --json
   ```
   - `image generate` and `video t2v` return the result directly (or a
     `jobId` if you didn't pass `--wait`/`--output`).
   - `video generate` streams an AI agent editing the project over SSE and
     returns `{ projectId, tools, url }` — `url` is the editor link, not a
     media file. Use it when the user wants to keep iterating on a project,
     not just get one clip back.

4. **Poll async jobs** if you didn't pass `--wait`/`--output` to `video t2v`:
   ```
   kvidai task status <jobId> --wait --output ./out.mp4 --json
   ```

5. **Return the result** to the user. If `--output` was used, reference that
   local path. Otherwise the JSON result contains the media URL(s) directly
   — for `video generate`, point the user at the returned editor `url`
   instead of a raw file.

## Command reference

### project — create and inspect video projects

```
kvidai project create <name> [--preset-id <id>] [--json]
kvidai project get <id> [--json]
```

`create` returns `{ id }`. Most video work starts by creating a project,
then either driving it with `video generate` (agent, multi-turn) or a
one-off `video t2v` call.

### video — generate video

```
kvidai video generate <projectId> <message> [--cdn-url <url>] [--mime <type>] [--filename <name>] [--verbose] [--json]
kvidai video t2v <prompt> [--model <id>] [--duration <s>] [--wait] [--output <path>] [--interval <ms>] [--timeout <ms>] [--json]
```

`generate` streams an AI agent editing an **existing** project over SSE and
returns `{ projectId, tools, url }` (`url` is the kvid.ai editor link, not a
media file). Use `--cdn-url` to attach a file (from `upload`/`assets upload`)
as context for the agent's instruction. `--verbose` prints tool-call names
to stderr as they happen.

`t2v` is a standalone async text-to-video job — no project required.
Without `--wait`/`--output` it returns immediately with `{ jobId, ... }`;
poll it with `task status`. With `--wait` or `--output` it polls internally
and returns the finished result (or downloads it, respectively).

### image — generate images

```
kvidai image generate <prompt> [--model <id>] [--size <preset>] [--num <n>] [--output <path>] [--json]
```

Synchronous — returns the result directly. `--size` accepts `square`,
`square_hd`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`,
`landscape_16_9` (default `square`). `--num` sets image count (default 1).
`--output` downloads the first result image to that path.

### task — check or poll an async job

```
kvidai task status <jobId> [--wait] [--interval <ms>] [--timeout <ms>] [--output <path>] [--json]
```

`jobId` comes from `video t2v`. Without `--wait`, returns the current status
once. With `--wait`, polls (default every 5000ms, up to 600000ms) until the
job completes or fails, then returns the full result. `--output` downloads
the result video once complete (implies waiting for completion).

### upload / assets — get files onto kvid.ai CDN

```
kvidai upload <file_path> [--json]
kvidai assets upload <file1> [file2...] [--json]
kvidai assets add-composition <projectId> <email> <assetJson> [--json]
```

`upload` and `assets upload` both do a presigned-URL upload and return
`{ cdnUrl, key, size }` (assets upload returns one such object per file).
Use the `cdnUrl` as `video generate --cdn-url`, or with `add-composition` to
attach an asset directly into a project's composition
(`assetJson` example: `{"id":"asset_1","type":"image","remoteUrl":"..."}`).

### docs — static documentation links (not a real search)

```
kvidai docs [query] [--json]
```

This does **not** perform a search — `query` is accepted but ignored. It
always returns the same static links (`docs.kvid.ai`, `api.kvid.ai/docs`).
Don't build a "discover via docs" step around this command.

## Handling errors

Every command exits non-zero on failure and writes a JSON object to stderr:

```json
{
  "error": "image/generate 422: {\"message\":\"prompt is required\"}",
  "details": { "hint": "..." }
}
```

There is no standardized `validation_errors`/`endpoint_id`/`request_id`
schema — `error` is a one-line summary (often including the raw HTTP status
and response body, since these commands don't do FastAPI-style structured
validation), and `details` (when present) has extra context such as a
`hint` on auth failures. On a 4xx, fix the request and retry; on 429/5xx,
a short backoff-and-retry is reasonable. No API key configured → run
`kvidai setup --non-interactive --api-key <key>` (agents/CI) or point the
user at `kvidai setup` (interactive).

## Common workflows

### One-off image
```
kvidai image generate "a cat on the moon" --size landscape_16_9 --output ./cat.png --json
```

### One-off video, wait for it
```
kvidai video t2v "a dog running on a beach" --duration 10 --wait --output ./dog.mp4 --json
```

### One-off video, fire-and-poll
```
kvidai video t2v "a dog running on a beach" --duration 10 --json
# save jobId from the response, then:
kvidai task status <jobId> --wait --output ./dog.mp4 --json
```

### Using a local file as agent context
```
kvidai upload ./reference.jpg --json
# use the returned cdnUrl:
kvidai project create "New scene" --json
kvidai video generate <projectId> "match the lighting from this reference" \
  --cdn-url <cdnUrl> --mime image/jpeg --json
```

### Multi-turn project editing
```
kvidai project create "Product launch" --json
kvidai video generate <projectId> "make a 10s intro for our product" --verbose --json
kvidai video generate <projectId> "make the intro faster-paced" --verbose --json
```

## Notes

- Always use `--json` so output is machine-readable.
- `kvidai docs <query>` does **not** perform a real search — see above.
- There is no `--model` catalog to browse: `image generate` / `video t2v`
  accept an optional `--model <id>` but fall back to a server-side default
  if omitted — don't invent endpoint IDs.
<!-- END kvidai:kvidai -->
