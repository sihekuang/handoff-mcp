// lib/mcp/tools.ts
import { z } from "zod";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import {
  createHandoffInput,
  listHandoffsInput,
  updateHandoffInput,
  claimHandoffInput,
} from "@/lib/handoffs/schema";
import type { Actor } from "@/lib/auth/types";
import { HandoffError } from "@/lib/handoffs/errors";

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const err = (e: unknown) => {
  if (e instanceof HandoffError) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: `[${e.kind}] ${e.message}` }],
    };
  }
  return {
    isError: true,
    content: [{ type: "text" as const, text: `[internal] ${(e as Error).message}` }],
  };
};

export function registerHandoffTools(server: any, actor: Actor) {
  server.tool(
    "create_handoff",
    "Create a new handoff document for in-flight work. Use when ending a session, switching tools, or leaving work for a teammate.",
    createHandoffInput.shape,
    async (input: any) => {
      try { return ok(await service.create(db, actor, input)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_handoffs",
    "Browse handoffs as summaries (no body). Typical use: `{ status: \"open\", claimed: false }` to find work to pick up.",
    listHandoffsInput.shape,
    async (input: any) => {
      try { return ok(await service.list(db, actor, input)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_handoff",
    "Fetch a single handoff including its full body and metadata.",
    { id: z.string() },
    async ({ id }: { id: string }) => {
      try { return ok(await service.get(db, actor, id)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_handoff",
    "Patch a handoff. Common use: set status to in_progress when you start, or done when you finish.",
    updateHandoffInput.shape,
    async (input: any) => {
      try { return ok(await service.update(db, actor, input)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "claim_handoff",
    "Mark a handoff as being worked on by you. Advisory only — last writer wins.",
    claimHandoffInput.shape,
    async (input: any) => {
      try { return ok(await service.claim(db, actor, input)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "release_handoff",
    "Clear the claim on a handoff so another agent can pick it up.",
    { id: z.string() },
    async ({ id }: { id: string }) => {
      try { return ok(await service.release(db, actor, id)); }
      catch (e) { return err(e); }
    },
  );
}
