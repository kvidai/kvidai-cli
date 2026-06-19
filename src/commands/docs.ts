import { defineCommand } from "citty";
import { output } from "../lib/output";

export default defineCommand({
  meta: {
    name: "docs",
    description: "Open kvidai documentation and API references",
  },
  args: {
    query: {
      type: "positional",
      required: false,
      description: "Search query (informational)",
    },
  },
  async run({ args }) {
    output({
      query: args.query ?? null,
      docs: "https://docs.kvid.ai",
      api: "https://api.kvid.ai/docs",
      skills: "https://github.com/kvidai/kvidai-cli/tree/main/skills",
      hint: "Visit https://docs.kvid.ai to search kvidai documentation.",
    });
  },
});
