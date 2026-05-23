// app/api/handoffs/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { errorResponse, newRequestId, resolveActorOr401 } from "@/lib/api/respond";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  const { id } = await ctx.params;
  try {
    const h = await service.get(db, actor, id);
    return NextResponse.json(h, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const updated = await service.update(db, actor, { id, patch: body.patch ?? body });
    return NextResponse.json(updated, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
