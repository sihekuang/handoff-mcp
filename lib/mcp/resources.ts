// lib/mcp/resources.ts
import type { Actor } from "@/lib/auth/types";
import { getSkillFor } from "./skill";

export function registerSkillResources(server: any, actor: Actor) {
  server.resource(
    "handoff-skill",
    "handoff://skill",
    { description: "The handoff service skill — usage instructions and conventions.", mimeType: "text/markdown" },
    async () => ({
      contents: [{
        uri: "handoff://skill",
        mimeType: "text/markdown",
        text: await getSkillFor(actor),
      }],
    }),
  );

  server.prompt(
    "handoff-help",
    "Print the handoff service skill (how to create, list, claim, etc.).",
    {},
    async () => ({
      messages: [{
        role: "assistant" as const,
        content: { type: "text" as const, text: await getSkillFor(actor) },
      }],
    }),
  );
}
