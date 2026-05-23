// Fresh schema per test file. Call once in a beforeAll() in each test file.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export async function freshDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Wipe all data between test files; migrations remain.
  await pool.query(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `).catch(() => undefined); // ignore if no tables yet

  await migrate(db, { migrationsFolder: "./db/migrations" });

  // Seed the hardcoded dev actor so the handoffs.user_id FK resolves in tests.
  // Idempotent: ON CONFLICT DO NOTHING.
  await pool.query(`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES ('dev_user', 'Dev User', 'dev@handoff-mcp.local', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  return { db, pool };
}
