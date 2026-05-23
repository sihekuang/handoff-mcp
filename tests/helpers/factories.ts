import { db as defaultDb } from "@/lib/db";
import { users } from "@/lib/auth/schema";
import { handoffs } from "@/lib/handoffs/schema";
import { newHandoffId, newUserId } from "@/lib/ids";
import type { DB } from "@/lib/db";

export async function seedUser(db: DB = defaultDb, overrides: Partial<typeof users.$inferInsert> = {}) {
  const row = {
    id: newUserId(),
    email: `${newUserId()}@test.local`,
    name: "Test User",
    ...overrides,
  };
  await db.insert(users).values(row);
  return row;
}

export async function seedHandoff(db: DB = defaultDb, userId: string, overrides: Partial<typeof handoffs.$inferInsert> = {}) {
  const row = {
    id: newHandoffId(),
    userId,
    title: "Seed handoff",
    body: "# body",
    status: "open" as const,
    tags: [],
    metadata: {},
    ...overrides,
  };
  await db.insert(handoffs).values(row);
  return row;
}
