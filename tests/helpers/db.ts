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
  // dev_user is seeded by 0001_seed_dev_user migration — no manual INSERT needed.

  return { db, pool };
}
