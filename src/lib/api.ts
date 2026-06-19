import { loadConfig } from "./config";
import { error } from "./output";

export const PLATFORM_BASE =
  process.env.KVIDAI_BASE_URL ?? "https://api.kvid.ai";

export function getApiKey(): string {
  const key = process.env.KVIDAI_API_KEY ?? loadConfig().apiKey;
  if (!key) {
    error("No kvidai API key found.", {
      hint: [
        "Set KVIDAI_API_KEY in your environment, or",
        "run `kvidai setup` (interactive), or",
        "run `kvidai setup --non-interactive --api-key <key>` (for agents/CI).",
        "Get one at https://app.kvid.ai/settings",
      ].join("\n"),
    });
  }
  return key as string;
}

export function platformHeaders(): Record<string, string> {
  return {
    "api-key": getApiKey(),
    "Content-Type": "application/json",
  };
}
