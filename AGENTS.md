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
