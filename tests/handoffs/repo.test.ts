import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "pg";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import * as repo from "@/lib/handoffs/repo";
import { handoffs } from "@/lib/handoffs/schema";
import type { DB } from "@/lib/db";

describe("handoffs/repo", () => {
  let db: DB;
  let pool: Pool;
  let userId: string;

  beforeAll(async () => { ({ db, pool } = await freshDb()); });
  afterAll(async () => { await pool?.end(); });
  beforeEach(async () => { ({ id: userId } = await seedUser(db)); });

  it("insert + findById round-trip", async () => {
    const inserted = await repo.insertHandoff(db, {
      userId, title: "Hello", body: "body", status: "open", tags: ["a", "b"], metadata: {},
    });
    const fetched = await repo.findById(db, userId, inserted.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe("Hello");
    expect(fetched!.tags).toEqual(["a", "b"]);
  });

  it("listOpen filters by userId, status, claimed=false, paginates by (updatedAt, id) desc", async () => {
    await Promise.all([
      seedHandoffViaRepo(db, userId, { title: "a", status: "open" }),
      seedHandoffViaRepo(db, userId, { title: "b", status: "in_progress" }),
      seedHandoffViaRepo(db, userId, { title: "c", status: "open", claimedBy: "x", claimedAt: new Date() }),
    ]);
    const otherUser = await seedUser(db);
    await seedHandoffViaRepo(db, otherUser.id, { title: "other", status: "open" });

    const items = await repo.list(db, userId, { status: "open", claimed: false, limit: 50 });
    expect(items.map(i => i.title).sort()).toEqual(["a"]);
  });

  it("update writes only the patched fields and bumps updatedAt", async () => {
    const original = await seedHandoffViaRepo(db, userId, { title: "orig", body: "b1" });
    const before = original.updatedAt;
    await new Promise(r => setTimeout(r, 5));
    const updated = await repo.update(db, userId, original.id, { title: "new" });
    expect(updated.title).toBe("new");
    expect(updated.body).toBe("b1");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("claim sets claimedBy + claimedAt; release clears them", async () => {
    const h = await seedHandoffViaRepo(db, userId);
    const claimed = await repo.claim(db, userId, h.id, "agent-1");
    expect(claimed.claimedBy).toBe("agent-1");
    expect(claimed.claimedAt).toBeInstanceOf(Date);

    const released = await repo.release(db, userId, h.id);
    expect(released.claimedBy).toBeNull();
    expect(released.claimedAt).toBeNull();
  });
});

// helper used by the tests above
async function seedHandoffViaRepo(db: DB, userId: string, overrides: Partial<typeof handoffs.$inferInsert> = {}) {
  return repo.insertHandoff(db, {
    userId,
    title: overrides.title ?? "t",
    body: overrides.body ?? "b",
    status: overrides.status ?? "open",
    tags: overrides.tags ?? [],
    metadata: overrides.metadata ?? {},
    project: overrides.project,
    summary: overrides.summary,
    claimedBy: overrides.claimedBy,
    claimedAt: overrides.claimedAt,
  });
}
