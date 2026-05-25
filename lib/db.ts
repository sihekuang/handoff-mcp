import type { PgDatabase } from "drizzle-orm/pg-core";

export type DB = PgDatabase<any>;

// ---------------------------------------------------------------------------
// DB router
//
//   DATABASE_URL present  →  db-pg.ts   (node-postgres / Pool)
//   DATABASE_URL absent   →  db-pglite.ts  (embedded PGlite)
//
// Uses dynamic import() so Turbopack code-splits each backend into its own
// chunk instead of bundling both (which breaks PGlite's WASM loading).
// Tests mock this module entirely via vi.doMock("@/lib/db").
// ---------------------------------------------------------------------------

const mod = await (process.env.DATABASE_URL
  ? import("./db-pg")
  : import("./db-pglite"));

export const db: DB = mod.db as DB;
