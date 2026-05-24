import type { PgDatabase } from "drizzle-orm/pg-core";

export type DB = PgDatabase<any>;

// ---------------------------------------------------------------------------
// DB router — lazy-initialised on first property access so that the env var
// `DATABASE_URL` can be set at runtime (e.g. by test-container setup) before
// the first query executes.
//
//   DATABASE_URL present  →  db-pg.ts   (node-postgres / Pool)
//   DATABASE_URL absent   →  db-pglite.ts  (embedded PGlite — Task 2)
// ---------------------------------------------------------------------------

let _db: DB | undefined;

function init(): DB {
  if (_db) return _db;

  if (process.env.DATABASE_URL) {
    // Synchronous require so no top-level await is needed.  db-pg.ts is a
    // plain CJS-compatible module (Pool + drizzle), so this always works in
    // Node / Next.js / vitest regardless of module format.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _db = require("./db-pg").db as DB;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _db = require("./db-pglite").db as DB;
  }

  return _db;
}

/**
 * Lazily-initialised database instance.
 *
 * A Proxy lets every consumer keep the familiar
 * `import { db } from "@/lib/db"` + `db.select(…)` pattern.  The real
 * drizzle instance is created on the first property access — which always
 * happens inside an async handler, long after env vars are in place.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(init(), prop, receiver);
  },
});
