import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import type { DB } from "@/lib/db";
import { Pool } from "pg";

describe("auth/web", () => {
  let db: DB;
  let pool: Pool;

  beforeAll(async () => {
    ({ db, pool } = await freshDb());
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("returns null Actor when no session cookie", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: {
        api: {
          getSession: async () => null,
          getMcpSession: async () => null,
        },
      },
    }));
    const { resolveWebActor } = await import("@/lib/auth/web");
    const req = new Request("http://localhost/", { headers: {} });
    expect(await resolveWebActor(req)).toBeNull();
    vi.doUnmock("@/lib/auth/better-auth");
  });

  it("returns user Actor when session is valid", async () => {
    const user = await seedUser(db);
    vi.resetModules();
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: {
        api: {
          getSession: async () => ({ user: { id: user.id }, session: { id: "s" } }),
          getMcpSession: async () => null,
        },
      },
    }));
    const { resolveWebActor } = await import("@/lib/auth/web");
    const actor = await resolveWebActor(new Request("http://localhost/"));
    expect(actor).toEqual({ kind: "user", userId: user.id });
    vi.doUnmock("@/lib/auth/better-auth");
  });
});

describe("auth/mcp", () => {
  let db: DB;
  let pool: Pool;

  beforeAll(async () => {
    ({ db, pool } = await freshDb());
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("returns null when no Authorization header", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: {
        api: {
          getSession: async () => null,
          getMcpSession: async () => null,
        },
      },
    }));
    const { resolveAgentActor } = await import("@/lib/auth/mcp");
    const req = new Request("http://localhost/");
    expect(await resolveAgentActor(req)).toBeNull();
    vi.doUnmock("@/lib/auth/better-auth");
  });

  it("returns null when token is invalid (not found in DB)", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: {
        api: {
          getSession: async () => null,
          getMcpSession: async () => null,
        },
      },
    }));
    const { resolveAgentActor } = await import("@/lib/auth/mcp");
    const req = new Request("http://localhost/", {
      headers: { authorization: "Bearer invalid-token" },
    });
    expect(await resolveAgentActor(req)).toBeNull();
    vi.doUnmock("@/lib/auth/better-auth");
  });

  it("returns agent Actor when token is valid", async () => {
    const user = await seedUser(db);
    const futureDate = new Date(Date.now() + 3600 * 1000);
    vi.resetModules();
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: {
        api: {
          getSession: async () => null,
          getMcpSession: async () => ({
            accessToken: "tok",
            refreshToken: "ref",
            accessTokenExpiresAt: futureDate,
            refreshTokenExpiresAt: futureDate,
            clientId: "client-123",
            userId: user.id,
            scopes: "handoffs:read handoffs:write",
          }),
        },
      },
    }));
    const { resolveAgentActor } = await import("@/lib/auth/mcp");
    const req = new Request("http://localhost/", {
      headers: { authorization: "Bearer tok" },
    });
    const actor = await resolveAgentActor(req);
    expect(actor).toEqual({
      kind: "agent",
      userId: user.id,
      clientId: "client-123",
      clientName: "client-123",
    });
    vi.doUnmock("@/lib/auth/better-auth");
  });

  it("returns null when token is expired", async () => {
    const user = await seedUser(db);
    const pastDate = new Date(Date.now() - 1000);
    vi.resetModules();
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: {
        api: {
          getSession: async () => null,
          getMcpSession: async () => ({
            accessToken: "expired-tok",
            refreshToken: "ref",
            accessTokenExpiresAt: pastDate,
            refreshTokenExpiresAt: pastDate,
            clientId: "client-123",
            userId: user.id,
            scopes: "handoffs:read",
          }),
        },
      },
    }));
    const { resolveAgentActor } = await import("@/lib/auth/mcp");
    const req = new Request("http://localhost/", {
      headers: { authorization: "Bearer expired-tok" },
    });
    expect(await resolveAgentActor(req)).toBeNull();
    vi.doUnmock("@/lib/auth/better-auth");
  });
});
