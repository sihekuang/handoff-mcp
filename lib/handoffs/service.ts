import * as repo from "./repo";
import {
  createHandoffInput,
  listHandoffsInput,
  updateHandoffInput,
  claimHandoffInput,
  type Handoff,
} from "./schema";
import { HandoffError } from "./errors";
import type { Actor } from "@/lib/auth/types";
import type { DB } from "@/lib/db";
import { ZodError } from "zod";

export type HandoffSummary = Omit<Handoff, "body" | "metadata">;

function summary(h: Handoff): HandoffSummary {
  const { body, metadata, ...rest } = h;
  return rest;
}

function fail(kind: "not_found" | "validation", detail: string): never {
  throw new HandoffError(kind, detail);
}

function parseOrThrow<T>(parser: { parse: (x: unknown) => T }, input: unknown): T {
  try { return parser.parse(input); }
  catch (e) {
    if (e instanceof ZodError) throw new HandoffError("validation", e.message, { issues: e.issues });
    throw e;
  }
}

export async function create(db: DB, actor: Actor, input: unknown): Promise<Handoff> {
  const parsed = parseOrThrow(createHandoffInput, input);
  return repo.insertHandoff(db, {
    userId: actor.userId,
    title:    parsed.title,
    body:     parsed.body,
    summary:  parsed.summary ?? null,
    status:   parsed.status,
    project:  parsed.project ?? null,
    tags:     parsed.tags,
    metadata: parsed.metadata,
  });
}

export async function get(db: DB, actor: Actor, id: string): Promise<Handoff> {
  const row = await repo.findById(db, actor.userId, id);
  if (!row) fail("not_found", `handoff ${id} not found`);
  return row;
}

export async function list(db: DB, actor: Actor, input: unknown): Promise<{
  items: HandoffSummary[];
  nextCursor?: string;
}> {
  const parsed = parseOrThrow(listHandoffsInput, input);
  const cursor = parsed.cursor ? decodeCursor(parsed.cursor) : undefined;
  const rows = await repo.list(db, actor.userId, {
    status: parsed.status,
    project: parsed.project,
    tag: parsed.tag,
    claimed: parsed.claimed,
    query: parsed.query,
    limit: parsed.limit + 1,    // peek one to know if more exist
    cursor,
  });
  const hasMore = rows.length > parsed.limit;
  const items = (hasMore ? rows.slice(0, parsed.limit) : rows).map(summary);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : undefined,
  };
}

export async function update(db: DB, actor: Actor, input: unknown): Promise<Handoff> {
  const parsed = parseOrThrow(updateHandoffInput, input);
  await get(db, actor, parsed.id);    // 404 check
  return repo.update(db, actor.userId, parsed.id, parsed.patch as any);
}

export async function claim(db: DB, actor: Actor, input: unknown): Promise<Handoff> {
  const parsed = parseOrThrow(claimHandoffInput, input);
  await get(db, actor, parsed.id);
  return repo.claim(db, actor.userId, parsed.id, parsed.agent);
}

export async function release(db: DB, actor: Actor, id: string): Promise<Handoff> {
  await get(db, actor, id);
  return repo.release(db, actor.userId, id);
}

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`, "utf8").toString("base64url");
}
function decodeCursor(cursor: string): { updatedAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  return { updatedAt: new Date(iso), id };
}
