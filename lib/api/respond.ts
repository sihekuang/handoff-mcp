// lib/api/respond.ts
import { NextResponse } from "next/server";
import { HandoffError, isHandoffError } from "@/lib/handoffs/errors";
import { ZodError } from "zod";
import { resolveAgentActor } from "@/lib/auth/mcp";
import { resolveWebActor } from "@/lib/auth/web";
import { DEV_ACTOR } from "@/lib/auth/dev";
import type { Actor } from "@/lib/auth/types";

const STATUS: Record<HandoffError["kind"], number> = {
  validation: 422,
  not_found:  404,
  forbidden:  403,
  conflict:   409,
  unauthorized: 401,
};

export function errorResponse(e: unknown, requestId: string): NextResponse {
  if (isHandoffError(e)) {
    return NextResponse.json(
      { error: e.kind, detail: e.message, meta: e.meta, requestId },
      { status: STATUS[e.kind] },
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "validation", detail: e.message, issues: e.issues, requestId },
      { status: 422 },
    );
  }
  console.error("unhandled error", e, { requestId });
  return NextResponse.json(
    { error: "internal", detail: "internal error", requestId },
    { status: 500 },
  );
}

export async function resolveActorOr401(req: Request): Promise<Actor | NextResponse> {
  // Agents first (Bearer), then web cookie.
  const agent = await resolveAgentActor(req);
  if (agent) return agent;
  const web = await resolveWebActor(req);
  if (web) return web;
  // AUTH DEFERRED: fall back to the hardcoded dev actor while auth is not wired in.
  // Remove this branch when Better Auth MCP/cookie auth is connected.
  if (process.env.NODE_ENV !== "production") return DEV_ACTOR;
  return NextResponse.json(
    { error: "unauthorized", detail: "missing or invalid credentials" },
    { status: 401, headers: { "WWW-Authenticate": `Bearer realm="handoff-mcp"` } },
  );
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
