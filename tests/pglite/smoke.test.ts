import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migratePglite } from "@/lib/migrate-pglite";
import * as service from "@/lib/handoffs/service";
import type { Actor } from "@/lib/auth/types";

describe("PGlite smoke test", () => {
  let db: ReturnType<typeof drizzle>;
  const actor: Actor = { kind: "user", userId: "dev_user" };

  beforeAll(async () => {
    const client = new PGlite();
    db = drizzle(client);
    await migratePglite(client, "./db/migrations");
  });

  it("creates and retrieves a handoff", async () => {
    const created = await service.create(db as any, actor, {
      title: "PGlite test",
      body: "Testing embedded Postgres",
    });
    expect(created.id).toMatch(/^h_/);

    const fetched = await service.get(db as any, actor, created.id);
    expect(fetched.title).toBe("PGlite test");
  });

  it("lists handoffs", async () => {
    const result = await service.list(db as any, actor, {});
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });
});
