import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { migratePglite } from "./migrate-pglite";

// ---------------------------------------------------------------------------
// Data directory — persisted PGlite storage
// ---------------------------------------------------------------------------

const dataDir =
  process.env.HANDOFF_DATA_DIR ||
  join(homedir(), ".local", "share", "handoff-mcp", "data");

mkdirSync(dataDir, { recursive: true });

// ---------------------------------------------------------------------------
// PGlite client + Drizzle instance
// ---------------------------------------------------------------------------

const client = new PGlite(dataDir);

export const db = drizzle(client);

// ---------------------------------------------------------------------------
// Migrations — run on first load as a fire-and-forget promise.
//
// The module is loaded via synchronous `require()` from lib/db.ts, so we
// cannot use top-level await.  Instead we kick off the migration and expose
// `migrationReady` so callers *can* await it if needed.
//
// In practice, PGlite starts fast enough that migrations complete before the
// first MCP/API request arrives.
// ---------------------------------------------------------------------------

const installDir = process.env.HANDOFF_INSTALL_DIR || process.cwd();
const migrationsDir = join(installDir, "db", "migrations");

export const migrationReady: Promise<void> = migratePglite(
  client,
  migrationsDir,
).catch((err) => {
  console.error("[db-pglite] migration failed:", err);
  process.exit(1);
});
