import { and, desc, eq, sql, isNull, isNotNull, ilike, or, lt } from "drizzle-orm";
import { handoffs, type Handoff } from "./schema";
import type { DB } from "@/lib/db";
import { newHandoffId } from "@/lib/ids";

export async function insertHandoff(
  db: DB,
  input: Omit<typeof handoffs.$inferInsert, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Handoff> {
  const id = input.id ?? newHandoffId();
  const [row] = await db.insert(handoffs).values({ ...input, id }).returning();
  return row;
}

export async function findById(db: DB, userId: string, id: string): Promise<Handoff | null> {
  const [row] = await db.select().from(handoffs)
    .where(and(eq(handoffs.userId, userId), eq(handoffs.id, id)));
  return row ?? null;
}

export type ListFilters = {
  status?: "open" | "in_progress" | "done";
  project?: string;
  tag?: string;
  claimed?: boolean;
  query?: string;
  limit: number;
  cursor?: { updatedAt: Date; id: string };
};

export async function list(db: DB, userId: string, f: ListFilters): Promise<Handoff[]> {
  const conds = [eq(handoffs.userId, userId)];
  if (f.status)  conds.push(eq(handoffs.status, f.status));
  if (f.project) conds.push(eq(handoffs.project, f.project));
  if (f.tag)     conds.push(sql`${f.tag} = ANY(${handoffs.tags})`);
  if (f.claimed === true)  conds.push(isNotNull(handoffs.claimedBy));
  if (f.claimed === false) conds.push(isNull(handoffs.claimedBy));
  if (f.query) {
    const q = `%${f.query}%`;
    conds.push(or(ilike(handoffs.title, q), ilike(handoffs.summary, q), ilike(handoffs.body, q))!);
  }
  if (f.cursor) {
    conds.push(or(
      lt(handoffs.updatedAt, f.cursor.updatedAt),
      and(eq(handoffs.updatedAt, f.cursor.updatedAt), lt(handoffs.id, f.cursor.id))!,
    )!);
  }
  return db.select().from(handoffs)
    .where(and(...conds))
    .orderBy(desc(handoffs.updatedAt), desc(handoffs.id))
    .limit(f.limit);
}

export async function update(
  db: DB,
  userId: string,
  id: string,
  patch: Partial<typeof handoffs.$inferInsert>,
): Promise<Handoff> {
  const [row] = await db.update(handoffs)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(handoffs.userId, userId), eq(handoffs.id, id)))
    .returning();
  if (!row) throw new Error("not_found");
  return row;
}

export async function claim(db: DB, userId: string, id: string, agent: string): Promise<Handoff> {
  return update(db, userId, id, { claimedBy: agent, claimedAt: new Date() });
}

export async function release(db: DB, userId: string, id: string): Promise<Handoff> {
  return update(db, userId, id, { claimedBy: null, claimedAt: null });
}

export async function remove(db: DB, userId: string, id: string): Promise<void> {
  await db.delete(handoffs).where(and(eq(handoffs.userId, userId), eq(handoffs.id, id)));
}
