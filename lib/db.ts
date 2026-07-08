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

// Embedded PGlite runs its migrations on load as a fire-and-forget promise.
// Block module evaluation until they finish so the first write (e.g. the first
// create_handoff) can't race the dev_user seed (migration 0001) and fail on the
// foreign key. Every importer of `db` therefore receives an already-migrated
// database. The hosted Postgres backend migrates out-of-band via `db:migrate`
// and exposes no `migrationReady`.
if ("migrationReady" in mod) {
  await mod.migrationReady;
}

export const db: DB = mod.db as DB;
