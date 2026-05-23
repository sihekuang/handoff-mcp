import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "pg";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import { db as _ } from "@/lib/db";       // ensure mocked test DATABASE_URL is picked up
import * as service from "@/lib/handoffs/service";
import { HandoffError } from "@/lib/handoffs/errors";
import type { Actor } from "@/lib/auth/types";
import type { DB } from "@/lib/db";

let db: DB;
let pool: Pool;
let actor: Actor;
let other: Actor;

beforeAll(async () => { ({ db, pool } = await freshDb()); });
afterAll(async () => { await pool?.end(); });
beforeEach(async () => {
  const u = await seedUser(db);
  const v = await seedUser(db);
  actor = { kind: "user",  userId: u.id };
  other = { kind: "agent", userId: v.id, clientId: "c", clientName: "c" };
});

describe("service.create", () => {
  it("creates a handoff owned by the actor", async () => {
    const h = await service.create(db, actor, {
      title: "Refactor auth",
      body: "## What was done\n- X\n## What's left\n- Y",
      tags: ["auth"],
      metadata: { git: { repo: "me/app", branch: "feat/auth" } },
      status: "open",
    });
    expect(h.id).toMatch(/^h_[0-9a-z]{10}$/);
    expect(h.userId).toBe(actor.userId);
    expect(h.status).toBe("open");
  });

  it("rejects empty body", async () => {
    await expect(service.create(db, actor, { title: "x", body: "" } as any))
      .rejects.toMatchObject({ kind: "validation" });
  });
});

describe("service.get", () => {
  it("returns the handoff for its owner", async () => {
    const created = await service.create(db, actor, { title: "t", body: "b" });
    const got = await service.get(db, actor, created.id);
    expect(got.id).toBe(created.id);
  });

  it("hides handoffs belonging to a different user (NotFound, not Forbidden)", async () => {
    const created = await service.create(db, actor, { title: "t", body: "b" });
    await expect(service.get(db, other, created.id))
      .rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("service.list", () => {
  it("returns own handoffs only, summary shape (no body)", async () => {
    await service.create(db, actor, { title: "a", body: "long body 1" });
    await service.create(db, other, { title: "b", body: "long body 2" });

    const page = await service.list(db, actor, { limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].title).toBe("a");
    expect((page.items[0] as any).body).toBeUndefined();
  });

  it("filters by status, claimed, project, tag, query", async () => {
    await service.create(db, actor, { title: "a", body: "alpha", status: "open", project: "p1", tags: ["t1"] });
    await service.create(db, actor, { title: "b", body: "beta",  status: "done", project: "p2", tags: ["t2"] });

    const open = await service.list(db, actor, { status: "open", limit: 10 });
    expect(open.items.map(i => i.title)).toEqual(["a"]);

    const p2 = await service.list(db, actor, { project: "p2", limit: 10 });
    expect(p2.items.map(i => i.title)).toEqual(["b"]);

    const tagged = await service.list(db, actor, { tag: "t1", limit: 10 });
    expect(tagged.items.map(i => i.title)).toEqual(["a"]);

    const queried = await service.list(db, actor, { query: "alph", limit: 10 });
    expect(queried.items.map(i => i.title)).toEqual(["a"]);
  });
});

describe("service.update", () => {
  it("updates only patched fields", async () => {
    const h = await service.create(db, actor, { title: "orig", body: "b" });
    const u = await service.update(db, actor, { id: h.id, patch: { title: "new" } });
    expect(u.title).toBe("new");
    expect(u.body).toBe("b");
  });

  it("404s a non-existent id", async () => {
    await expect(service.update(db, actor, { id: "h_doesnotexis", patch: { title: "x" } }))
      .rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("service.claim / release", () => {
  it("claim sets claimedBy + claimedAt; release clears them", async () => {
    const h = await service.create(db, actor, { title: "t", body: "b" });
    const claimed = await service.claim(db, actor, { id: h.id, agent: "claude-code" });
    expect(claimed.claimedBy).toBe("claude-code");
    expect(claimed.claimedAt).toBeInstanceOf(Date);

    const released = await service.release(db, actor, h.id);
    expect(released.claimedBy).toBeNull();
  });
});
