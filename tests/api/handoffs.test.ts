import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import type { DB } from "@/lib/db";
import { Pool } from "pg";

let db: DB;
let pool: Pool;

beforeAll(async () => { ({ db, pool } = await freshDb()); });
afterAll(async () => { await pool?.end(); });

function mockSession(userId: string | null) {
  vi.resetModules();
  // Provide the test db so the route uses the same connection as freshDb()
  vi.doMock("@/lib/db", () => ({ db }));
  if (userId) {
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: {
        api: {
          getSession: async () => ({ user: { id: userId }, session: { id: "s" } }),
          getMcpSession: async () => null,
        },
      },
    }));
  } else {
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: { api: { getSession: async () => null, getMcpSession: async () => null } },
    }));
  }
}

describe("POST /api/handoffs", () => {
  it("creates a handoff for the authed user (web cookie)", async () => {
    const u = await seedUser(db);
    mockSession(u.id);
    const { POST } = await import("@/app/api/handoffs/route");
    const req = new Request("http://localhost/api/handoffs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "t", body: "b" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.userId).toBe(u.id);
  });

  it("returns 401 when no session and no Bearer", async () => {
    mockSession(null);
    const { POST } = await import("@/app/api/handoffs/route");
    const req = new Request("http://localhost/api/handoffs", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/handoffs", () => {
  it("lists the user's handoffs", async () => {
    const u = await seedUser(db);
    mockSession(u.id);
    const { POST, GET } = await import("@/app/api/handoffs/route");

    await POST(new Request("http://localhost/api/handoffs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "a", body: "b" }),
    }) as any);

    const res = await GET(new Request("http://localhost/api/handoffs?limit=10") as any);
    const json = await res.json();
    expect(json.items.map((i: any) => i.title)).toEqual(["a"]);
  });
});
