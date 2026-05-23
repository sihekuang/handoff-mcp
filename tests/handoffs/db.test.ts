// tests/handoffs/db.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { freshDb } from "@/tests/helpers/db";

describe("migrations", () => {
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let pool: Pool;
  beforeAll(async () => { ({ db, pool } = await freshDb()); });
  afterAll(async () => { await pool?.end(); });

  it("creates the handoffs table", async () => {
    const rows = await db.execute(
      sql`SELECT to_regclass('public.handoffs') AS t`
    );
    expect((rows as any).rows[0].t).toBe("handoffs");
  });

  it("creates the handoff_status enum", async () => {
    const rows = await db.execute(
      sql`SELECT enumlabel FROM pg_enum
          JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
          WHERE pg_type.typname = 'handoff_status'
          ORDER BY enumsortorder`
    );
    expect((rows as any).rows.map((r: any) => r.enumlabel)).toEqual(
      ["open", "in_progress", "done"]
    );
  });
});
