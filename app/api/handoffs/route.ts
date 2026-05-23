import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { errorResponse, newRequestId, resolveActorOr401 } from "@/lib/api/respond";

export async function GET(req: Request) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  try {
    const url = new URL(req.url);
    const params = {
      status:  url.searchParams.get("status") ?? undefined,
      project: url.searchParams.get("project") ?? undefined,
      tag:     url.searchParams.get("tag") ?? undefined,
      claimed: url.searchParams.has("claimed") ? url.searchParams.get("claimed") === "true" : undefined,
      query:   url.searchParams.get("q") ?? undefined,
      cursor:  url.searchParams.get("cursor") ?? undefined,
      limit:   url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };
    const page = await service.list(db, actor, params);
    return NextResponse.json(page, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  try {
    const body = await req.json();
    const created = await service.create(db, actor, body);
    return NextResponse.json(created, { status: 201, headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
