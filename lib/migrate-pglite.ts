import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Run Drizzle-generated SQL migration files directly against a PGlite client.
 *
 * Each file is split on Drizzle's `--> statement-breakpoint` separator and
 * executed statement-by-statement.  "Already exists" / "duplicate" errors are
 * silently ignored so the function is idempotent.
 */
export async function migratePglite(
  client: { exec: (sql: string) => Promise<unknown> },
  migrationsDir: string,
) {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      try {
        await client.exec(stmt);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        // Idempotent: ignore "already exists" / duplicate-object errors
        if (!msg.includes("already exists") && !msg.includes("duplicate")) {
          throw e;
        }
      }
    }
  }
}
