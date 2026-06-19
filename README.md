# kvidai CLI

Agent-first CLI for [kvidai](https://kvid.ai) — generate, manage, and stream AI videos from your terminal or agent scripts.

Works great for humans in a terminal and equally well for AI agents via shell commands. In a TTY, commands display a lightweight pretty view; when piped or called with `--json`, they emit structured JSON.

## Install

**Linux / macOS:**

```bash
curl https://cli.kvid.ai/install -fsS | bash
```

**Windows (PowerShell):**

```powershell
irm https://cli.kvid.ai/install.ps1 | iex
```

Both `kvidai` and `kvid` are registered as aliases after install.

## Setup

```bash
kvidai setup
```

Interactive wizard that configures:

- **API key** — saved encrypted to `~/.kvidai/config.json` (or skip and use `KVIDAI_API_KEY` in your environment)
- **Auto-load `.env`** — automatically load `KVIDAI_API_KEY` and related vars from a project `.env` file
- **Output mode** — `auto` (pretty in TTY, JSON when piped), `json` (always structured), or `standard` (always human-readable)
- **Automatic updates** — check for new versions in the background (default: on; set `KVIDAI_NO_UPDATE=1` to disable)

Get your API key at [app.kvid.ai/settings](https://app.kvid.ai/settings).

To skip the wizard, set the key in your environment:

```bash
export KVIDAI_API_KEY=your_kvidai_api_key
```

### Non-interactive setup (agents / CI)

```bash
kvidai setup --non-interactive --api-key "$KVIDAI_API_KEY"
kvidai setup --non-interactive --output-format json --no-auto-load-env --auto-update
```

Every flag is optional — fields you don't pass keep their current values, so repeated invocations are idempotent.

| Flag | Description |
|---|---|
| `--non-interactive`, `-y` | Skip all prompts. Required when there is no TTY. |
| `--api-key <key>` | API key to save. Pass `""` to clear the saved key. |
| `--no-save-key` | With `--api-key`, don't persist the key to `config.json`. |
| `--output-format <auto\|json\|standard>` | Default output mode. |
| `--auto-load-env` / `--no-auto-load-env` | Toggle auto-loading from a project `.env`. |
| `--auto-update` / `--no-auto-update` | Toggle background update checks. |

## Environment Variables

| Variable | Description |
|---|---|
| `KVIDAI_API_KEY` | API key (required for all commands) |
| `KVIDAI_BASE_URL` | Override API base URL (default: `https://api.kvid.ai`) |
| `KVIDAI_USER_EMAIL` | User email (required for `video t2v` and `assets upload`) |

| `KVIDAI_NO_UPDATE` | Set to `1` to disable automatic update checks |

## Commands

### `kvidai project create <name> [--preset-id <id>]`

Create a new video project. Returns `{ id }`.

```bash
kvidai project create "My Campaign" --json
# → {"id": 42}
```

### `kvidai project get <id>`

Get project details.

```bash
kvidai project get 42 --json
```

### `kvidai video generate <projectId> <message> [options]`

Stream agent generation for a project via SSE. The agent processes the message and executes tools; the command exits when the stream ends.

```bash
kvidai video generate 42 "고양이가 뛰노는 5초 세로 영상" --verbose
```

Options:
- `--cdn-url <url>` — attach a pre-uploaded CDN file as context
- `--mime <type>` — MIME type of the `--cdn-url` attachment
- `--filename <name>` — filename for the `--cdn-url` attachment
- `--verbose` — print tool events to stderr in real time

### `kvidai video t2v <prompt> [options]`

Submit a text-to-video async job. Without `--wait`, returns `{ jobId }` immediately.

```bash
# Submit and return jobId immediately
kvidai video t2v "sunset over ocean, cinematic 4K" --json

# Submit, poll until done, download result
kvidai video t2v "sunset over ocean" --wait --output ./result.mp4
```

Options:
- `--model <id>` — model ID (server default if omitted)
- `--duration <s>` — duration in seconds
- `--wait` — poll until completed
- `--output <path>` — download result video (implies `--wait`)
- `--interval <ms>` — polling interval (default: 5000)
- `--timeout <ms>` — max wait time (default: 600000)

### `kvidai task status <jobId> [options]`

Check or poll an async generation job.

```bash
# Single status check
kvidai task status abc-123 --json

# Poll until done
kvidai task status abc-123 --wait --output ./video.mp4
```

### `kvidai assets upload <email> <file1> [file2...]`

Upload local files to kvidai CDN. Returns `[{ id, url, name }]`.

```bash
kvidai assets upload user@example.com ./logo.png ./background.jpg --json
```

### `kvidai assets add-composition <projectId> <email> <assetJson>`

Add an asset to a project's composition so the agent can reference it on the timeline.

```bash
kvidai assets add-composition 42 user@example.com \
  '{"id":"asset_1","type":"image","remoteUrl":"https://cdn.kvid.ai/file.jpg"}'
```


### `kvidai upload <file> [--email <email>]`

Upload a single file (shorthand). Uses `KVIDAI_USER_EMAIL` env or `--email` flag.

```bash
export KVIDAI_USER_EMAIL=user@example.com
kvidai upload ./logo.png --json
```

### `kvidai skills <list|install|update|remove>`

Manage agent skill bundles (install under `.agents/skills/`, symlinked into `.claude/skills/`).
These are **model-runner skills** — they teach your agent how to call the kvidai CLI.

```bash
kvidai init                        # install default kvidai skill bundle
kvidai skills list                 # list available skills from the registry
kvidai skills install kvidai       # install the core kvidai workflow skill
kvidai skills install cinematography  # install a style/technique skill
```

Available skills: `kvidai`, `kvidai-ref`, `model-routing`, `storytelling`, `commercial`, `character-design`, `cinematography`, `workflow`.

### `kvidai version`

Show current version and check for updates.

### `kvidai update [--check] [--force]`

Download and install the latest version.

## Agent Usage

All commands support `--json` for machine-readable output. To get a full schema of all commands, arguments, and environment variables:

```bash
kvidai --json
```

Typical agent workflow:

```bash
# 1. One-time setup (or set KVIDAI_API_KEY in env)
kvidai setup --non-interactive --api-key "$KVIDAI_API_KEY"

# 2. Create a project
PROJECT_ID=$(kvidai project create "Agent test" --json | jq -r .id)

# 3. Generate video
kvidai video generate "$PROJECT_ID" "Make a 10s intro for our product" --verbose

# 4. Or async text-to-video with polling
kvidai video t2v "product showcase, 10s" --wait --output ./result.mp4
```

## Skills

### CLI-bundled skills (model runner)

Install the kvidai skill bundle to give your AI agent (Claude Code, Cursor, etc.) knowledge of the CLI commands:

```bash
kvidai init
```

This installs skills under `.agents/skills/` and symlinks them into `.claude/skills/` (Claude Code) automatically.
These skills teach the agent how to call `kvidai run`, `kvidai schema`, `kvidai upload`, etc. — **the CLI binary must be installed on the same machine.**

### kvidai-skills (video platform workflows, CLI-free)

For video project management, preset CRUD, media upload, and conversation-driven video editing — without requiring the kvidai CLI — use the separate skill pack that calls api.kvid.ai directly:

```bash
npx skills add epicmobile18/kvidai-skills
```

Works with Claude Code, ChatGPT, Codex, Goose, Copilot, and [50+ agents](https://github.com/vercel-labs/skills).
See [kvidai-skills on GitHub](https://github.com/epicmobile18/kvidai-skills) for the full skill list.

**When to use which:**

| Situation | Use |
|---|---|
| Generate images/video/audio with a kvid.ai model, CLI installed locally | CLI-bundled skills (`kvidai init`) |
| Manage video projects, presets, media — or edit video by conversation — any agent, no CLI required | kvidai-skills (`npx skills add`) |

## Build from Source

Requires [Bun](https://bun.sh) 1.x.

```bash
bun install
bun run build          # → dist/kvidai (single binary)
bun run typecheck      # tsc --noEmit
bun run check          # biome lint + format check
```

## Releasing

**트리거: `git push origin vX.Y.Z` (태그 push)**

commit message나 `package.json` version 변경 자체는 CI를 트리거하지 않는다.
`.github/workflows/release.yml`은 `v*.*.*` 패턴의 태그가 push될 때만 발동한다.

```
on:
  push:
    tags:
      - "v[0-9]+.[0-9]+.[0-9]+*"
```

`package.json` version은 빌드 중 태그명과 일치하는지 검증하는 용도다 — 불일치 시 CI 실패.
commit message `chore: X.Y.Z release`는 히스토리 가독성용 컨벤션이며 CI가 읽지 않는다.

**릴리스 절차**

```bash
# 1. version bump
#    package.json "version": "X.Y.Z" 수정 후 커밋
git add package.json
git commit -m "chore: X.Y.Z release"

# 2. main 머지 + push
git checkout main
git merge develop --ff-only
git push origin main

# 3. 태그 push → 이 시점에 release.yml 발동
git tag vX.Y.Z
git push origin vX.Y.Z

# 4. develop 동기화
git checkout develop
git push origin develop
```

Pre-release 버전(`0.4.0-alpha.0` 등)은 버전 문자열로 자동 감지되어 GitHub에 pre-release로 표시된다.
