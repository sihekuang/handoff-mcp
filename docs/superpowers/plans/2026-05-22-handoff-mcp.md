# Handoff-MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user Next.js 16 web service that lets AI coding agents hand off self-contained markdown documents to each other via an OAuth-authenticated MCP server (with a built-in skill teaching the discovery convention), a mirrored REST API, and a minimal browse/manage web UI.

**Architecture:** One Next.js 16 app on Vercel. Four surfaces (MCP, REST, web UI, Better Auth handler) all call into a single `lib/handoffs/service.ts`. Only `lib/handoffs/repo.ts` issues SQL. Better Auth provides both human cookie sessions (GitHub + magic-link) and MCP OAuth 2.1 (PKCE + DCR) via its OAuth Provider plugin. Supabase Postgres is the database; auth is Better Auth, not Supabase Auth. Drizzle ORM with checked-in migrations.

**Tech Stack:** Next.js 16.2.6 LTS, React 19.2.6, Tailwind v4.3, shadcn/ui, Better Auth (OAuth Provider plugin), Drizzle ORM, Supabase Postgres, `mcp-handler` + `@modelcontextprotocol/sdk` ^1.26, Vitest + `@testcontainers/postgresql`, Playwright (smoke), pino, pnpm.

**Reference spec:** `docs/superpowers/specs/2026-05-22-handoff-mcp-design.md` — read first; the plan implements that spec.

---

## File map (created over the course of the plan)

```
handoff-mcp/
├── app/
│   ├── (web)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── h/[id]/page.tsx
│   │   ├── settings/agents/page.tsx
│   │   └── login/page.tsx
│   ├── api/
│   │   ├── auth/[...all]/route.ts
│   │   └── handoffs/
│   │       ├── route.ts
│   │       └── [id]/
│   │           ├── route.ts
│   │           └── claim/route.ts
│   ├── [transport]/route.ts
│   ├── layout.tsx
│   ├── globals.css
│   └── middleware.ts
├── lib/
│   ├── handoffs/{schema,repo,service,errors}.ts
│   ├── auth/{better-auth,schema,web,mcp,client}.ts
│   ├── mcp/{tools,skill,resources}.ts
│   ├── storage/index.ts
│   ├── db.ts
│   ├── ids.ts
│   ├── log.ts
│   └── markdown.tsx
├── db/migrations/ (drizzle-kit output)
├── components/ui/ (shadcn primitives)
├── tests/{service,api,mcp,auth,helpers,e2e}/
├── drizzle.config.ts, vitest.config.ts, playwright.config.ts
├── next.config.ts, tailwind.config.ts, postcss.config.mjs
├── tsconfig.json, vercel.json, .env.example, .github/workflows/ci.yml
└── package.json, pnpm-lock.yaml
```

---

## Phase 0 — Project scaffold

### Task 0.1: Initialize the Next.js 16 project

**Files:**
- Create: entire project structure via `create-next-app`

- [ ] **Step 1: Initialize the project**

Run from `/Users/daniel/Documents/Projects/handoff-mcp`:

```bash
pnpm dlx create-next-app@latest . \
  --typescript --tailwind --eslint --app \
  --src-dir=false --import-alias="@/*" \
  --use-pnpm --turbopack --skip-install
```

When prompted to overwrite existing files (because `.gitignore` and `docs/` exist), choose **"keep"** for `.gitignore` and **"keep"** for `docs/`. Allow overwrite for all others.

- [ ] **Step 2: Pin Next.js, React, Tailwind to known-good versions**

Edit `package.json` so `dependencies` / `devDependencies` use exact versions:

```json
{
  "packageManager": "pnpm@9.15.0",
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.6",
    "react-dom": "19.2.6"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "19.2.6",
    "@types/react-dom": "19.2.6",
    "tailwindcss": "4.3.0",
    "@tailwindcss/postcss": "4.3.0",
    "typescript": "^5.6",
    "eslint": "^9",
    "eslint-config-next": "16.2.6"
  }
}
```

- [ ] **Step 3: Install**

```bash
pnpm install
```

Expected: dependencies resolve and `pnpm-lock.yaml` is generated.

- [ ] **Step 4: Verify it builds**

```bash
pnpm build
```

Expected: build succeeds. If `app/page.tsx` from the template fails, replace it with a stub:

```tsx
// app/page.tsx
export default function Page() {
  return <main>handoff-mcp scaffold</main>;
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16.2.6 + React 19.2.6 + Tailwind v4.3"
```

---

### Task 0.2: Configure Tailwind v4 with `@theme` directive

**Files:**
- Modify: `app/globals.css`
- Create: `postcss.config.mjs`

- [ ] **Step 1: Replace `app/globals.css` with v4-style configuration**

```css
@import "tailwindcss";

@theme {
  --color-bg: oklch(0.99 0 0);
  --color-fg: oklch(0.18 0 0);
  --color-muted: oklch(0.6 0 0);
  --color-border: oklch(0.92 0 0);
  --color-accent: oklch(0.55 0.18 250);
  --color-status-open: oklch(0.55 0.15 250);
  --color-status-in-progress: oklch(0.65 0.18 70);
  --color-status-done: oklch(0.5 0 0);

  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-bg: oklch(0.14 0 0);
    --color-fg: oklch(0.97 0 0);
    --color-muted: oklch(0.65 0 0);
    --color-border: oklch(0.24 0 0);
  }
}

html, body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: Ensure `postcss.config.mjs` uses the v4 plugin**

```js
// postcss.config.mjs
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

- [ ] **Step 3: Run dev server briefly**

```bash
pnpm dev
```

Visit `http://localhost:3000`. Expected: page renders with the configured colors. Stop the server (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css postcss.config.mjs
git commit -m "chore: configure Tailwind v4 @theme tokens"
```

---

### Task 0.3: Set up Vitest with `@testcontainers/postgresql`

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/helpers/db.ts`
- Modify: `package.json` (test scripts)
- Modify: `tsconfig.json` (include tests path)

- [ ] **Step 1: Install dev deps**

```bash
pnpm add -D vitest @vitest/coverage-v8 @testcontainers/postgresql pg @types/pg drizzle-orm drizzle-kit dotenv
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30_000,    // testcontainers cold start
    hookTimeout: 60_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
// One Postgres container per test process (forks pool, singleFork=true).
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll } from "vitest";

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("handoff_test")
    .withUsername("test")
    .withPassword("test")
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();
});

afterAll(async () => {
  await container?.stop();
});
```

- [ ] **Step 4: Create `tests/helpers/db.ts`**

```ts
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
  return { db, pool };
}
```

- [ ] **Step 5: Add test scripts to `package.json`**

Under `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 6: Update `tsconfig.json` to include tests**

Ensure `"include"` is:

```json
"include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", "tests/**/*"]
```

- [ ] **Step 7: Verify Vitest runs (no tests yet)**

```bash
pnpm test
```

Expected: "No test files found" — that is fine.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: set up Vitest + testcontainers-postgres harness"
```

---

### Task 0.4: Install shadcn/ui and seed core primitives

**Files:**
- Create: `components.json`
- Create: `components/ui/*` (button, card, badge, input, table, dropdown-menu, sheet, dialog, toast/sonner)
- Create: `lib/utils.ts` (cn helper)

- [ ] **Step 1: Initialize shadcn/ui (Tailwind v4 mode)**

```bash
pnpm dlx shadcn@latest init -y -d
```

When prompted: TypeScript yes, style "new-york", base color "neutral", CSS variables yes, components alias `@/components`, utils alias `@/lib/utils`.

- [ ] **Step 2: Add the primitives we'll need**

```bash
pnpm dlx shadcn@latest add button card badge input table dropdown-menu sheet dialog sonner select textarea label separator
```

- [ ] **Step 3: Verify build still works**

```bash
pnpm build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: install shadcn/ui primitives"
```

---

### Task 0.5: Install runtime libraries

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add @modelcontextprotocol/sdk@^1.26 mcp-handler@latest \
  better-auth@latest @better-auth/cli@latest \
  zod@^3 nanoid pino pino-pretty \
  react-markdown remark-gfm rehype-sanitize shiki
```

- [ ] **Step 2: Install Playwright for smoke tests**

```bash
pnpm add -D @playwright/test
pnpm dlx playwright install chromium
```

- [ ] **Step 3: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add MCP, Better Auth, markdown, Playwright deps"
```

---

### Task 0.6: Logging + storage extension-point stubs

**Files:**
- Create: `lib/log.ts`
- Create: `lib/storage/index.ts`

- [ ] **Step 1: Create `lib/log.ts`**

```ts
// lib/log.ts
import pino from "pino";

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV !== "production"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
```

- [ ] **Step 2: Create `lib/storage/index.ts` — interface only, no implementation**

```ts
// lib/storage/index.ts
//
// Extension point for blob attachments (designed-for, not built at MVP).
// When attachments land, fill these in with a Supabase Storage adapter
// and add an `attachments` table + an `attach_blob` MCP tool. Call sites
// should code against this interface, not against Supabase Storage directly.

export interface BlobStore {
  put(input: { key: string; mime: string; body: Uint8Array | Blob }): Promise<{ key: string }>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

class NotImplementedStore implements BlobStore {
  async put(): Promise<{ key: string }> { throw new Error("BlobStore not implemented at MVP"); }
  async signedUrl(): Promise<string> { throw new Error("BlobStore not implemented at MVP"); }
  async delete(): Promise<void> { throw new Error("BlobStore not implemented at MVP"); }
}

export const blobStore: BlobStore = new NotImplementedStore();
```

- [ ] **Step 3: Commit**

```bash
git add lib/log.ts lib/storage/index.ts
git commit -m "chore: pino logger + storage interface placeholder for blob extension"
```

---

## Phase 1 — Database foundation

### Task 1.1: Drizzle client + config

**Files:**
- Create: `lib/db.ts`
- Create: `drizzle.config.ts`
- Create: `.env.example`
- Create: `.env.local` (gitignored — for local dev)

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: ["./lib/handoffs/schema.ts", "./lib/auth/schema.ts"],
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 2: Create `lib/db.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool);
export type DB = typeof db;
```

- [ ] **Step 3: Create `.env.example`**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
BETTER_AUTH_SECRET=replace-with-32-byte-random
BETTER_AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
RESEND_API_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): drizzle config + db client"
```

---

### Task 1.2: Define the `handoffs` schema with zod mirror

**Files:**
- Create: `lib/handoffs/schema.ts`
- Create: `lib/ids.ts`

- [ ] **Step 1: Create `lib/ids.ts`**

```ts
import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const id10 = customAlphabet(alphabet, 10);
const id12 = customAlphabet(alphabet, 12);

export const newHandoffId = () => `h_${id10()}`;
export const newUserId = () => `u_${id12()}`;
```

- [ ] **Step 2: Create `lib/handoffs/schema.ts`**

```ts
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "@/lib/auth/schema";

export const handoffStatus = pgEnum("handoff_status", ["open", "in_progress", "done"]);

export type HandoffMetadata = {
  git?: { repo?: string; branch?: string; commit?: string; prUrl?: string };
  files?: Array<{ path: string; note?: string }>;
  [k: string]: unknown;
};

export const handoffs = pgTable("handoffs", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  summary:   text("summary"),
  body:      text("body").notNull(),
  status:    handoffStatus("status").notNull().default("open"),
  project:   text("project"),
  tags:      text("tags").array().notNull().default(sql`'{}'::text[]`),
  metadata:  jsonb("metadata").$type<HandoffMetadata>().notNull().default({}),
  claimedBy: text("claimed_by"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byUser:    index("handoffs_by_user").on(t.userId, t.status, t.updatedAt),
  byProject: index("handoffs_by_project").on(t.userId, t.project),
}));

export type Handoff = typeof handoffs.$inferSelect;
export type HandoffInsert = typeof handoffs.$inferInsert;
export type HandoffStatus = "open" | "in_progress" | "done";

// --- zod schemas (shared by REST + MCP) ---

const metadataSchema = z.object({
  git: z.object({
    repo: z.string().optional(),
    branch: z.string().optional(),
    commit: z.string().optional(),
    prUrl: z.string().url().optional(),
  }).optional(),
  files: z.array(z.object({ path: z.string(), note: z.string().optional() })).optional(),
}).catchall(z.unknown());

export const createHandoffInput = z.object({
  title:    z.string().min(1).max(200),
  body:     z.string().min(1).max(200_000),
  summary:  z.string().max(500).optional(),
  status:   z.enum(["open", "in_progress", "done"]).default("open"),
  project:  z.string().max(100).optional(),
  tags:     z.array(z.string().max(50)).max(20).default([]),
  metadata: metadataSchema.default({}),
});
export type CreateHandoffInput = z.infer<typeof createHandoffInput>;

export const listHandoffsInput = z.object({
  status:  z.enum(["open", "in_progress", "done"]).optional(),
  project: z.string().optional(),
  tag:     z.string().optional(),
  claimed: z.boolean().optional(),
  query:   z.string().optional(),
  limit:   z.number().int().min(1).max(100).default(25),
  cursor:  z.string().optional(), // base64 of `${updatedAt.toISOString()}|${id}`
});
export type ListHandoffsInput = z.infer<typeof listHandoffsInput>;

export const updateHandoffInput = z.object({
  id: z.string(),
  patch: z.object({
    title:    z.string().min(1).max(200).optional(),
    body:     z.string().min(1).max(200_000).optional(),
    summary:  z.string().max(500).nullable().optional(),
    status:   z.enum(["open", "in_progress", "done"]).optional(),
    project:  z.string().max(100).nullable().optional(),
    tags:     z.array(z.string().max(50)).max(20).optional(),
    metadata: metadataSchema.optional(),
  }),
});
export type UpdateHandoffInput = z.infer<typeof updateHandoffInput>;

export const claimHandoffInput = z.object({
  id:    z.string(),
  agent: z.string().min(1).max(80),
});
export type ClaimHandoffInput = z.infer<typeof claimHandoffInput>;
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(handoffs): drizzle schema + zod input shapes"
```

---

### Task 1.3: Generate the initial migration

**Files:**
- Create: `db/migrations/0000_*.sql`

- [ ] **Step 1: Generate**

> ⚠️ `lib/auth/schema.ts` doesn't exist yet, so create a placeholder users table here so the FK resolves; we'll regenerate after Better Auth's schema is added in Task 2.2.

Create a temporary minimal `lib/auth/schema.ts`:

```ts
// TEMPORARY placeholder. Replaced in Task 2.2 by `@better-auth/cli generate`.
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id:        text("id").primaryKey(),
  email:     text("email").notNull().unique(),
  name:      text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Then:

```bash
pnpm db:generate
```

Expected: a SQL file appears in `db/migrations/0000_*.sql`. Inspect — should `CREATE TABLE users` and `CREATE TABLE handoffs`, plus the enum + indexes.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(db): initial migration (users placeholder + handoffs)"
```

---

### Task 1.4: Test the migration applies cleanly to testcontainers Postgres

**Files:**
- Create: `tests/helpers/db.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/helpers/db.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { freshDb } from "@/tests/helpers/db";

describe("migrations", () => {
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  beforeAll(async () => { db = (await freshDb()).db; });

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
```

- [ ] **Step 2: Run**

```bash
pnpm test tests/helpers/db.test.ts
```

Expected: PASS (~10s including container start).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(db): assert migration creates handoffs schema"
```

---

### Task 1.5: Implement the handoffs repo (SQL-only layer) with TDD

**Files:**
- Create: `lib/handoffs/repo.ts`
- Create: `tests/handoffs/repo.test.ts`
- Create: `tests/helpers/factories.ts`

- [ ] **Step 1: Write factories for tests**

```ts
// tests/helpers/factories.ts
import { db as defaultDb } from "@/lib/db";
import { users } from "@/lib/auth/schema";
import { handoffs } from "@/lib/handoffs/schema";
import { newHandoffId, newUserId } from "@/lib/ids";
import type { DB } from "@/lib/db";

export async function seedUser(db: DB = defaultDb, overrides: Partial<typeof users.$inferInsert> = {}) {
  const row = {
    id: newUserId(),
    email: `${newUserId()}@test.local`,
    name: "Test User",
    ...overrides,
  };
  await db.insert(users).values(row);
  return row;
}

export async function seedHandoff(db: DB = defaultDb, userId: string, overrides: Partial<typeof handoffs.$inferInsert> = {}) {
  const row = {
    id: newHandoffId(),
    userId,
    title: "Seed handoff",
    body: "# body",
    status: "open" as const,
    tags: [],
    metadata: {},
    ...overrides,
  };
  await db.insert(handoffs).values(row);
  return row;
}
```

- [ ] **Step 2: Write the first failing repo test**

```ts
// tests/handoffs/repo.test.ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import * as repo from "@/lib/handoffs/repo";
import type { DB } from "@/lib/db";

describe("handoffs/repo", () => {
  let db: DB;
  let userId: string;

  beforeAll(async () => { db = (await freshDb()).db; });
  beforeEach(async () => { ({ id: userId } = await seedUser(db)); });

  it("insert + findById round-trip", async () => {
    const inserted = await repo.insertHandoff(db, {
      userId, title: "Hello", body: "body", status: "open", tags: ["a", "b"], metadata: {},
    });
    const fetched = await repo.findById(db, userId, inserted.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe("Hello");
    expect(fetched!.tags).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 3: Run the test — it should fail (module not found)**

```bash
pnpm test tests/handoffs/repo.test.ts
```

Expected: FAIL with "cannot find module @/lib/handoffs/repo".

- [ ] **Step 4: Create the minimal repo**

```ts
// lib/handoffs/repo.ts
import { and, desc, eq, sql, isNull, isNotNull, ilike, or, lt } from "drizzle-orm";
import { handoffs, type Handoff } from "./schema";
import type { DB } from "@/lib/db";
import { newHandoffId } from "@/lib/ids";

export async function insertHandoff(
  db: DB,
  input: Omit<typeof handoffs.$inferInsert, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Handoff> {
  const id = input.id ?? newHandoffId();
  const [row] = await db.insert(handoffs).values({ ...input, id }).returning();
  return row;
}

export async function findById(db: DB, userId: string, id: string): Promise<Handoff | null> {
  const [row] = await db.select().from(handoffs)
    .where(and(eq(handoffs.userId, userId), eq(handoffs.id, id)));
  return row ?? null;
}
```

- [ ] **Step 5: Run the test — should PASS**

```bash
pnpm test tests/handoffs/repo.test.ts
```

- [ ] **Step 6: Add the rest of the repo tests (write them all, then drive each green)**

Append to `tests/handoffs/repo.test.ts`:

```ts
  it("listOpen filters by userId, status, claimed=false, paginates by (updatedAt, id) desc", async () => {
    await Promise.all([
      seedHandoffViaRepo(db, userId, { title: "a", status: "open" }),
      seedHandoffViaRepo(db, userId, { title: "b", status: "in_progress" }),
      seedHandoffViaRepo(db, userId, { title: "c", status: "open", claimedBy: "x", claimedAt: new Date() }),
    ]);
    const otherUser = await seedUser(db);
    await seedHandoffViaRepo(db, otherUser.id, { title: "other", status: "open" });

    const items = await repo.list(db, userId, { status: "open", claimed: false, limit: 50 });
    expect(items.map(i => i.title).sort()).toEqual(["a"]);
  });

  it("update writes only the patched fields and bumps updatedAt", async () => {
    const original = await seedHandoffViaRepo(db, userId, { title: "orig", body: "b1" });
    const before = original.updatedAt;
    await new Promise(r => setTimeout(r, 5));
    const updated = await repo.update(db, userId, original.id, { title: "new" });
    expect(updated.title).toBe("new");
    expect(updated.body).toBe("b1");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("claim sets claimedBy + claimedAt; release clears them", async () => {
    const h = await seedHandoffViaRepo(db, userId);
    const claimed = await repo.claim(db, userId, h.id, "agent-1");
    expect(claimed.claimedBy).toBe("agent-1");
    expect(claimed.claimedAt).toBeInstanceOf(Date);

    const released = await repo.release(db, userId, h.id);
    expect(released.claimedBy).toBeNull();
    expect(released.claimedAt).toBeNull();
  });
});

// helper used by the tests above
async function seedHandoffViaRepo(db: DB, userId: string, overrides: Partial<typeof handoffs.$inferInsert> = {}) {
  return repo.insertHandoff(db, {
    userId,
    title: overrides.title ?? "t",
    body: overrides.body ?? "b",
    status: overrides.status ?? "open",
    tags: overrides.tags ?? [],
    metadata: overrides.metadata ?? {},
    project: overrides.project,
    summary: overrides.summary,
    claimedBy: overrides.claimedBy,
    claimedAt: overrides.claimedAt,
  });
}
```

Add to the imports at the top: `import { seedUser } from "@/tests/helpers/factories";`

- [ ] **Step 7: Run — expect failures for `repo.list`, `repo.update`, `repo.claim`, `repo.release`**

```bash
pnpm test tests/handoffs/repo.test.ts
```

- [ ] **Step 8: Fill in the repo functions**

Append to `lib/handoffs/repo.ts`:

```ts
export type ListFilters = {
  status?: "open" | "in_progress" | "done";
  project?: string;
  tag?: string;
  claimed?: boolean;
  query?: string;
  limit: number;
  cursor?: { updatedAt: Date; id: string };
};

export async function list(db: DB, userId: string, f: ListFilters): Promise<Handoff[]> {
  const conds = [eq(handoffs.userId, userId)];
  if (f.status)  conds.push(eq(handoffs.status, f.status));
  if (f.project) conds.push(eq(handoffs.project, f.project));
  if (f.tag)     conds.push(sql`${f.tag} = ANY(${handoffs.tags})`);
  if (f.claimed === true)  conds.push(isNotNull(handoffs.claimedBy));
  if (f.claimed === false) conds.push(isNull(handoffs.claimedBy));
  if (f.query) {
    const q = `%${f.query}%`;
    conds.push(or(ilike(handoffs.title, q), ilike(handoffs.summary, q), ilike(handoffs.body, q))!);
  }
  if (f.cursor) {
    // (updatedAt, id) lexicographic-desc cursor
    conds.push(or(
      lt(handoffs.updatedAt, f.cursor.updatedAt),
      and(eq(handoffs.updatedAt, f.cursor.updatedAt), lt(handoffs.id, f.cursor.id))!,
    )!);
  }
  return db.select().from(handoffs)
    .where(and(...conds))
    .orderBy(desc(handoffs.updatedAt), desc(handoffs.id))
    .limit(f.limit);
}

export async function update(
  db: DB,
  userId: string,
  id: string,
  patch: Partial<typeof handoffs.$inferInsert>,
): Promise<Handoff> {
  const [row] = await db.update(handoffs)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(handoffs.userId, userId), eq(handoffs.id, id)))
    .returning();
  if (!row) throw new Error("not_found");
  return row;
}

export async function claim(db: DB, userId: string, id: string, agent: string): Promise<Handoff> {
  return update(db, userId, id, { claimedBy: agent, claimedAt: new Date() });
}

export async function release(db: DB, userId: string, id: string): Promise<Handoff> {
  return update(db, userId, id, { claimedBy: null, claimedAt: null });
}

export async function remove(db: DB, userId: string, id: string): Promise<void> {
  await db.delete(handoffs).where(and(eq(handoffs.userId, userId), eq(handoffs.id, id)));
}
```

- [ ] **Step 9: Run all repo tests — should PASS**

```bash
pnpm test tests/handoffs/repo.test.ts
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(handoffs): SQL-only repo layer with full CRUD + filtered list"
```

---

## Phase 2 — Better Auth (humans + MCP OAuth provider)

### Task 2.1: Install and configure Better Auth

**Files:**
- Create: `lib/auth/better-auth.ts`
- Create: `lib/auth/client.ts`

- [ ] **Step 1: Create `lib/auth/better-auth.ts`**

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProvider } from "better-auth/plugins/oauth-provider";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  emailAndPassword: { enabled: false },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Resend integration goes here. For local dev, log to console.
        console.log(`[magic-link] ${email} -> ${url}`);
      },
    }),
    oAuthProvider({
      // OAuth 2.1 AS for MCP clients. DCR + PKCE on by default.
      issuer: process.env.BETTER_AUTH_URL!,
      allowDynamicClientRegistration: true,
      defaultScope: "handoffs:read handoffs:write",
      supportedScopes: ["handoffs:read", "handoffs:write"],
    }),
  ],
});

export type Auth = typeof auth;
```

> If the exact import names for `better-auth` plugins differ in the current release, run `pnpm why better-auth` and check `node_modules/better-auth/dist/plugins/*.d.ts`. The plan assumes the names documented in 2026-05 — adjust if release notes show otherwise; the contract (`oAuthProvider` with `allowDynamicClientRegistration`) is stable.

- [ ] **Step 2: Create the React client**

```ts
// lib/auth/client.ts
"use client";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  plugins: [magicLinkClient()],
});
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(auth): better-auth config with GitHub, magic-link, OAuth provider plugin"
```

---

### Task 2.2: Generate Better Auth's Drizzle schema and replace the placeholder

**Files:**
- Replace: `lib/auth/schema.ts` (placeholder removed)

- [ ] **Step 1: Generate**

```bash
pnpm dlx @better-auth/cli generate --output ./lib/auth/schema.ts --y
```

Expected: `lib/auth/schema.ts` is overwritten with the full Better Auth schema (`users`, `sessions`, `accounts`, `verification`, plus OAuth provider tables: `oauthApplication`, `oauthAccessToken`, `oauthConsent`). All identifier columns are text. Verify by inspecting the file.

- [ ] **Step 2: Re-generate migrations**

```bash
pnpm db:generate
```

Expected: a new SQL file `db/migrations/0001_*.sql` adding the Better Auth tables. The old `users` placeholder may be dropped — confirm by reading the migration. If the diff is too tangled to read cleanly, you may delete `db/migrations/` entirely and regenerate `0000_*.sql` from scratch (acceptable because nothing has shipped yet).

- [ ] **Step 3: Verify migrations still apply cleanly**

```bash
pnpm test tests/helpers/db.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(auth): replace placeholder users table with @better-auth/cli generated schema"
```

---

### Task 2.3: Mount Better Auth on `/api/auth/[...all]`

**Files:**
- Create: `app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Create the route handler**

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 2: Quick smoke — run dev server**

```bash
pnpm dev
```

Visit `http://localhost:3000/api/auth/ok` and `http://localhost:3000/api/auth/.well-known/oauth-authorization-server`.
Expected: the OAuth discovery doc returns JSON with `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(auth): mount better-auth handler at /api/auth/[...all]"
```

---

### Task 2.4: Actor resolvers — `lib/auth/web.ts` and `lib/auth/mcp.ts`

**Files:**
- Create: `lib/auth/web.ts`
- Create: `lib/auth/mcp.ts`
- Create: `tests/auth/resolvers.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/auth/resolvers.test.ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import type { DB } from "@/lib/db";

describe("auth/web", () => {
  let db: DB;
  beforeAll(async () => { db = (await freshDb()).db; });

  it("returns null Actor when no session cookie", async () => {
    const { resolveWebActor } = await import("@/lib/auth/web");
    const req = new Request("http://localhost/", { headers: {} });
    expect(await resolveWebActor(req)).toBeNull();
  });

  it("returns user Actor when session is valid", async () => {
    // Mock better-auth.api.getSession to return our seeded user.
    const user = await seedUser(db);
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: { api: { getSession: async () => ({ user: { id: user.id }, session: { id: "s" } }) } },
    }));
    const { resolveWebActor } = await import("@/lib/auth/web");
    const actor = await resolveWebActor(new Request("http://localhost/"));
    expect(actor).toEqual({ kind: "user", userId: user.id });
    vi.doUnmock("@/lib/auth/better-auth");
  });
});
```

- [ ] **Step 2: Run — should fail (module missing)**

```bash
pnpm test tests/auth/resolvers.test.ts
```

- [ ] **Step 3: Create `lib/auth/types.ts`**

```ts
// lib/auth/types.ts
export type Actor =
  | { kind: "user";  userId: string }
  | { kind: "agent"; userId: string; clientId: string; clientName: string };
```

- [ ] **Step 4: Create `lib/auth/web.ts`**

```ts
// lib/auth/web.ts
import { auth } from "@/lib/auth/better-auth";
import type { Actor } from "./types";

export async function resolveWebActor(req: Request): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;
  return { kind: "user", userId: session.user.id };
}
```

- [ ] **Step 5: Create `lib/auth/mcp.ts`**

```ts
// lib/auth/mcp.ts
import { auth } from "@/lib/auth/better-auth";
import type { Actor } from "./types";

/** verifyToken signature compatible with mcp-handler's withMcpAuth helper. */
export async function verifyAccessToken(token: string): Promise<{
  actor: Actor;
  scopes: string[];
} | null> {
  // Better Auth exposes a server-side token verifier on auth.api.verifyOAuthToken
  // (name may vary slightly between versions — adapt if needed).
  const result = await auth.api.verifyOAuthAccessToken({ accessToken: token });
  if (!result?.active) return null;
  const { userId, clientId, clientName, scopes = [] } = result;
  return {
    actor: {
      kind: "agent",
      userId,
      clientId,
      clientName: clientName ?? clientId,
    },
    scopes,
  };
}

/** Pulls Bearer token from Authorization header. */
export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim() || null;
}

export async function resolveAgentActor(req: Request): Promise<Actor | null> {
  const token = bearerFrom(req);
  if (!token) return null;
  const result = await verifyAccessToken(token);
  return result?.actor ?? null;
}
```

- [ ] **Step 6: Run — tests pass**

```bash
pnpm test tests/auth/resolvers.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): Actor type + web + mcp resolvers"
```

---

## Phase 3 — Service layer

### Task 3.1: Domain errors

**Files:**
- Create: `lib/handoffs/errors.ts`

- [ ] **Step 1: Create**

```ts
// lib/handoffs/errors.ts
export type HandoffErrorKind =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "unauthorized";

export class HandoffError extends Error {
  public readonly kind: HandoffErrorKind;
  public readonly meta?: Record<string, unknown>;

  constructor(kind: HandoffErrorKind, detail: string, meta?: Record<string, unknown>) {
    super(detail);
    this.name = "HandoffError";
    this.kind = kind;
    this.meta = meta;
  }
}

export function isHandoffError(e: unknown): e is HandoffError {
  return e instanceof HandoffError;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/handoffs/errors.ts
git commit -m "feat(handoffs): HandoffError tagged union"
```

---

### Task 3.2: Service layer with TDD

**Files:**
- Create: `lib/handoffs/service.ts`
- Create: `tests/handoffs/service.test.ts`

- [ ] **Step 1: Write the full failing test file**

```ts
// tests/handoffs/service.test.ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import { db as _ } from "@/lib/db";       // ensure mocked test DATABASE_URL is picked up
import * as service from "@/lib/handoffs/service";
import { HandoffError } from "@/lib/handoffs/errors";
import type { Actor } from "@/lib/auth/types";
import type { DB } from "@/lib/db";

let db: DB;
let actor: Actor;
let other: Actor;

beforeAll(async () => { db = (await freshDb()).db; });
beforeEach(async () => {
  const u = await seedUser(db);
  const v = await seedUser(db);
  actor = { kind: "user",  userId: u.id };
  other = { kind: "agent", userId: v.id, clientId: "c", clientName: "c" };
});

describe("service.create", () => {
  it("creates a handoff owned by the actor", async () => {
    const h = await service.create(db, actor, {
      title: "Refactor auth",
      body: "## What was done\n- X\n## What's left\n- Y",
      tags: ["auth"],
      metadata: { git: { repo: "me/app", branch: "feat/auth" } },
      status: "open",
    });
    expect(h.id).toMatch(/^h_[0-9a-z]{10}$/);
    expect(h.userId).toBe(actor.userId);
    expect(h.status).toBe("open");
  });

  it("rejects empty body", async () => {
    await expect(service.create(db, actor, { title: "x", body: "" } as any))
      .rejects.toMatchObject({ kind: "validation" });
  });
});

describe("service.get", () => {
  it("returns the handoff for its owner", async () => {
    const created = await service.create(db, actor, { title: "t", body: "b" });
    const got = await service.get(db, actor, created.id);
    expect(got.id).toBe(created.id);
  });

  it("hides handoffs belonging to a different user (NotFound, not Forbidden)", async () => {
    const created = await service.create(db, actor, { title: "t", body: "b" });
    await expect(service.get(db, other, created.id))
      .rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("service.list", () => {
  it("returns own handoffs only, summary shape (no body)", async () => {
    await service.create(db, actor, { title: "a", body: "long body 1" });
    await service.create(db, other, { title: "b", body: "long body 2" });

    const page = await service.list(db, actor, { limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].title).toBe("a");
    expect((page.items[0] as any).body).toBeUndefined();
  });

  it("filters by status, claimed, project, tag, query", async () => {
    await service.create(db, actor, { title: "a", body: "alpha", status: "open", project: "p1", tags: ["t1"] });
    await service.create(db, actor, { title: "b", body: "beta",  status: "done", project: "p2", tags: ["t2"] });

    const open = await service.list(db, actor, { status: "open", limit: 10 });
    expect(open.items.map(i => i.title)).toEqual(["a"]);

    const p2 = await service.list(db, actor, { project: "p2", limit: 10 });
    expect(p2.items.map(i => i.title)).toEqual(["b"]);

    const tagged = await service.list(db, actor, { tag: "t1", limit: 10 });
    expect(tagged.items.map(i => i.title)).toEqual(["a"]);

    const queried = await service.list(db, actor, { query: "alph", limit: 10 });
    expect(queried.items.map(i => i.title)).toEqual(["a"]);
  });
});

describe("service.update", () => {
  it("updates only patched fields", async () => {
    const h = await service.create(db, actor, { title: "orig", body: "b" });
    const u = await service.update(db, actor, { id: h.id, patch: { title: "new" } });
    expect(u.title).toBe("new");
    expect(u.body).toBe("b");
  });

  it("404s a non-existent id", async () => {
    await expect(service.update(db, actor, { id: "h_doesnotexis", patch: { title: "x" } }))
      .rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("service.claim / release", () => {
  it("claim sets claimedBy + claimedAt; release clears them", async () => {
    const h = await service.create(db, actor, { title: "t", body: "b" });
    const claimed = await service.claim(db, actor, { id: h.id, agent: "claude-code" });
    expect(claimed.claimedBy).toBe("claude-code");
    expect(claimed.claimedAt).toBeInstanceOf(Date);

    const released = await service.release(db, actor, h.id);
    expect(released.claimedBy).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect "cannot find module" failure**

```bash
pnpm test tests/handoffs/service.test.ts
```

- [ ] **Step 3: Implement `lib/handoffs/service.ts`**

```ts
// lib/handoffs/service.ts
import * as repo from "./repo";
import {
  createHandoffInput,
  listHandoffsInput,
  updateHandoffInput,
  claimHandoffInput,
  type Handoff,
} from "./schema";
import { HandoffError } from "./errors";
import type { Actor } from "@/lib/auth/types";
import type { DB } from "@/lib/db";
import { ZodError } from "zod";

export type HandoffSummary = Omit<Handoff, "body" | "metadata">;

function summary(h: Handoff): HandoffSummary {
  const { body, metadata, ...rest } = h;
  return rest;
}

function fail(kind: "not_found" | "validation", detail: string): never {
  throw new HandoffError(kind, detail);
}

function parseOrThrow<T>(parser: { parse: (x: unknown) => T }, input: unknown): T {
  try { return parser.parse(input); }
  catch (e) {
    if (e instanceof ZodError) throw new HandoffError("validation", e.message, { issues: e.issues });
    throw e;
  }
}

export async function create(db: DB, actor: Actor, input: unknown): Promise<Handoff> {
  const parsed = parseOrThrow(createHandoffInput, input);
  return repo.insertHandoff(db, {
    userId: actor.userId,
    title:    parsed.title,
    body:     parsed.body,
    summary:  parsed.summary ?? null,
    status:   parsed.status,
    project:  parsed.project ?? null,
    tags:     parsed.tags,
    metadata: parsed.metadata,
  });
}

export async function get(db: DB, actor: Actor, id: string): Promise<Handoff> {
  const row = await repo.findById(db, actor.userId, id);
  if (!row) fail("not_found", `handoff ${id} not found`);
  return row;
}

export async function list(db: DB, actor: Actor, input: unknown): Promise<{
  items: HandoffSummary[];
  nextCursor?: string;
}> {
  const parsed = parseOrThrow(listHandoffsInput, input);
  const cursor = parsed.cursor ? decodeCursor(parsed.cursor) : undefined;
  const rows = await repo.list(db, actor.userId, {
    status: parsed.status,
    project: parsed.project,
    tag: parsed.tag,
    claimed: parsed.claimed,
    query: parsed.query,
    limit: parsed.limit + 1,    // peek one to know if more exist
    cursor,
  });
  const hasMore = rows.length > parsed.limit;
  const items = (hasMore ? rows.slice(0, parsed.limit) : rows).map(summary);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : undefined,
  };
}

export async function update(db: DB, actor: Actor, input: unknown): Promise<Handoff> {
  const parsed = parseOrThrow(updateHandoffInput, input);
  await get(db, actor, parsed.id);    // 404 check
  return repo.update(db, actor.userId, parsed.id, parsed.patch as any);
}

export async function claim(db: DB, actor: Actor, input: unknown): Promise<Handoff> {
  const parsed = parseOrThrow(claimHandoffInput, input);
  await get(db, actor, parsed.id);
  return repo.claim(db, actor.userId, parsed.id, parsed.agent);
}

export async function release(db: DB, actor: Actor, id: string): Promise<Handoff> {
  await get(db, actor, id);
  return repo.release(db, actor.userId, id);
}

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`, "utf8").toString("base64url");
}
function decodeCursor(cursor: string): { updatedAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  return { updatedAt: new Date(iso), id };
}
```

- [ ] **Step 4: Run service tests — should PASS**

```bash
pnpm test tests/handoffs/service.test.ts
```

- [ ] **Step 5: CI grep guard — every repo function must filter by userId**

Create `tests/handoffs/repo-userid-guard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("repo userId guard", () => {
  it("every exported async function references actor's userId in its query", () => {
    const src = readFileSync("lib/handoffs/repo.ts", "utf8");
    // Heuristic: each exported function body must mention `userId` and `handoffs.userId`
    const fnBlocks = src.split(/\nexport (?:async )?function /).slice(1);
    for (const block of fnBlocks) {
      const name = block.split("(")[0];
      expect(block, `${name} must filter by userId`).toMatch(/handoffs\.userId/);
    }
  });
});
```

- [ ] **Step 6: Run guard**

```bash
pnpm test tests/handoffs/repo-userid-guard.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(handoffs): service layer + CI userId guard"
```

---

## Phase 4 — REST API

### Task 4.1: Adapter helpers

**Files:**
- Create: `lib/api/respond.ts`

- [ ] **Step 1: Create**

```ts
// lib/api/respond.ts
import { NextResponse } from "next/server";
import { HandoffError, isHandoffError } from "@/lib/handoffs/errors";
import { ZodError } from "zod";
import { resolveAgentActor } from "@/lib/auth/mcp";
import { resolveWebActor } from "@/lib/auth/web";
import type { Actor } from "@/lib/auth/types";

const STATUS: Record<HandoffError["kind"], number> = {
  validation: 422,
  not_found:  404,
  forbidden:  403,
  conflict:   409,
  unauthorized: 401,
};

export function errorResponse(e: unknown, requestId: string): NextResponse {
  if (isHandoffError(e)) {
    return NextResponse.json(
      { error: e.kind, detail: e.message, meta: e.meta, requestId },
      { status: STATUS[e.kind] },
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "validation", detail: e.message, issues: e.issues, requestId },
      { status: 422 },
    );
  }
  console.error("unhandled error", e, { requestId });
  return NextResponse.json(
    { error: "internal", detail: "internal error", requestId },
    { status: 500 },
  );
}

export async function resolveActorOr401(req: Request): Promise<Actor | NextResponse> {
  // Agents first (Bearer), then web cookie.
  const agent = await resolveAgentActor(req);
  if (agent) return agent;
  const web = await resolveWebActor(req);
  if (web) return web;
  return NextResponse.json(
    { error: "unauthorized", detail: "missing or invalid credentials" },
    { status: 401, headers: { "WWW-Authenticate": `Bearer realm="handoff-mcp"` } },
  );
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/api/respond.ts
git commit -m "feat(api): error translation + actor resolver helpers"
```

---

### Task 4.2: `GET` / `POST /api/handoffs`

**Files:**
- Create: `app/api/handoffs/route.ts`
- Create: `tests/api/handoffs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/handoffs.test.ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import type { DB } from "@/lib/db";

let db: DB;
beforeAll(async () => { db = (await freshDb()).db; });

function mockSessionAs(userId: string) {
  vi.doMock("@/lib/auth/better-auth", () => ({
    auth: {
      api: {
        getSession: async () => ({ user: { id: userId }, session: { id: "s" } }),
        verifyOAuthAccessToken: async () => null,
      },
    },
  }));
}

describe("POST /api/handoffs", () => {
  it("creates a handoff for the authed user (web cookie)", async () => {
    const u = await seedUser(db);
    mockSessionAs(u.id);
    const { POST } = await import("@/app/api/handoffs/route");
    const req = new Request("http://localhost/api/handoffs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "t", body: "b" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.userId).toBe(u.id);
    vi.doUnmock("@/lib/auth/better-auth");
  });

  it("returns 401 when no session and no Bearer", async () => {
    vi.doMock("@/lib/auth/better-auth", () => ({
      auth: { api: { getSession: async () => null, verifyOAuthAccessToken: async () => null } },
    }));
    const { POST } = await import("@/app/api/handoffs/route");
    const req = new Request("http://localhost/api/handoffs", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
    vi.doUnmock("@/lib/auth/better-auth");
  });
});

describe("GET /api/handoffs", () => {
  it("lists the user's handoffs", async () => {
    const u = await seedUser(db);
    mockSessionAs(u.id);
    const { POST, GET } = await import("@/app/api/handoffs/route");

    await POST(new Request("http://localhost/api/handoffs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "a", body: "b" }),
    }) as any);

    const res = await GET(new Request("http://localhost/api/handoffs?limit=10") as any);
    const json = await res.json();
    expect(json.items.map((i: any) => i.title)).toEqual(["a"]);
    vi.doUnmock("@/lib/auth/better-auth");
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
pnpm test tests/api/handoffs.test.ts
```

- [ ] **Step 3: Implement the route**

```ts
// app/api/handoffs/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { errorResponse, newRequestId, resolveActorOr401 } from "@/lib/api/respond";

export async function GET(req: Request) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  try {
    const url = new URL(req.url);
    const params = {
      status:  url.searchParams.get("status") ?? undefined,
      project: url.searchParams.get("project") ?? undefined,
      tag:     url.searchParams.get("tag") ?? undefined,
      claimed: url.searchParams.has("claimed") ? url.searchParams.get("claimed") === "true" : undefined,
      query:   url.searchParams.get("q") ?? undefined,
      cursor:  url.searchParams.get("cursor") ?? undefined,
      limit:   url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };
    const page = await service.list(db, actor, params);
    return NextResponse.json(page, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  try {
    const body = await req.json();
    const created = await service.create(db, actor, body);
    return NextResponse.json(created, { status: 201, headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
```

- [ ] **Step 4: Run tests — PASS**

```bash
pnpm test tests/api/handoffs.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): GET + POST /api/handoffs"
```

---

### Task 4.3: `GET` / `PATCH /api/handoffs/[id]` and claim/release sub-route

**Files:**
- Create: `app/api/handoffs/[id]/route.ts`
- Create: `app/api/handoffs/[id]/claim/route.ts`
- Modify: `tests/api/handoffs.test.ts` (append more cases)

- [ ] **Step 1: Implement `[id]/route.ts`**

```ts
// app/api/handoffs/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { errorResponse, newRequestId, resolveActorOr401 } from "@/lib/api/respond";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  const { id } = await ctx.params;
  try {
    const h = await service.get(db, actor, id);
    return NextResponse.json(h, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const updated = await service.update(db, actor, { id, patch: body.patch ?? body });
    return NextResponse.json(updated, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
```

- [ ] **Step 2: Implement `[id]/claim/route.ts`**

```ts
// app/api/handoffs/[id]/claim/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { errorResponse, newRequestId, resolveActorOr401 } from "@/lib/api/respond";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const h = await service.claim(db, actor, { id, agent: body.agent });
    return NextResponse.json(h, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const actor = await resolveActorOr401(req);
  if (actor instanceof NextResponse) return actor;
  const { id } = await ctx.params;
  try {
    const h = await service.release(db, actor, id);
    return NextResponse.json(h, { headers: { "x-request-id": requestId } });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
```

- [ ] **Step 3: Append tests for GET/PATCH/claim/release**

In `tests/api/handoffs.test.ts`:

```ts
describe("GET /api/handoffs/[id]", () => {
  it("returns the handoff for owner", async () => {
    const u = await seedUser(db);
    mockSessionAs(u.id);
    const { POST } = await import("@/app/api/handoffs/route");
    const { GET } = await import("@/app/api/handoffs/[id]/route");
    const created = await (await POST(new Request("http://localhost/api/handoffs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "t", body: "b" }),
    }) as any)).json();
    const res = await GET(
      new Request(`http://localhost/api/handoffs/${created.id}`) as any,
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    vi.doUnmock("@/lib/auth/better-auth");
  });
});

describe("POST /api/handoffs/[id]/claim then DELETE", () => {
  it("claim then release", async () => {
    const u = await seedUser(db);
    mockSessionAs(u.id);
    const { POST: createPost } = await import("@/app/api/handoffs/route");
    const { POST: claimPost, DELETE: claimDel } = await import("@/app/api/handoffs/[id]/claim/route");
    const created = await (await createPost(new Request("http://localhost/api/handoffs", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "t", body: "b" }),
    }) as any)).json();

    const claimed = await (await claimPost(
      new Request(`http://localhost/api/handoffs/${created.id}/claim`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: "claude" }),
      }) as any,
      { params: Promise.resolve({ id: created.id }) },
    )).json();
    expect(claimed.claimedBy).toBe("claude");

    const released = await (await claimDel(
      new Request(`http://localhost/api/handoffs/${created.id}/claim`, { method: "DELETE" }) as any,
      { params: Promise.resolve({ id: created.id }) },
    )).json();
    expect(released.claimedBy).toBeNull();
    vi.doUnmock("@/lib/auth/better-auth");
  });
});
```

- [ ] **Step 4: Run all api tests — PASS**

```bash
pnpm test tests/api/handoffs.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): GET/PATCH/[id] + claim/release sub-route"
```

---

## Phase 5 — MCP server (skill, tools, resources, prompts)

### Task 5.1: The skill markdown

**Files:**
- Create: `lib/mcp/skill.ts`

- [ ] **Step 1: Create**

```ts
// lib/mcp/skill.ts
import type { Actor } from "@/lib/auth/types";

export const DEFAULT_SKILL = `# Handoff service

You can create, browse, and claim **handoff documents** that describe in-flight work, so another agent (or another session, or a human) can pick the work up later.

## When to create a handoff

- You're ending a session with work still in progress.
- You're about to switch tools (e.g., Claude Code → Cursor) mid-task.
- The user has explicitly asked you to leave one for a teammate or future you.

## Picking up work from someone else

1. \`list_handoffs({ status: "open", claimed: false })\` — browse summaries.
2. \`get_handoff({ id })\` — read the full body of any candidate.
3. \`claim_handoff({ id, agent: "<your-tool-name>" })\` — once you've committed to working on it.

When you finish, call \`update_handoff({ id, patch: { status: "done" } })\`. If you can't finish, call \`release_handoff({ id })\` so another agent can pick it up.

## Writing a good handoff

Use clear markdown in \`body\`. Recommended structure:

\`\`\`
## What was done
- decisions and completed work, with file paths and short snippets if useful
- list significant commits or PRs

## What's left
- concrete, ordered next steps
- each step should be doable without re-derivation

## Open questions
- anything you couldn't resolve alone
- options you considered and why you didn't pick them
\`\`\`

Set:
- \`project\` and \`tags\` so the next agent can filter.
- \`metadata.git\` (\`{ repo, branch, commit, prUrl }\`) so they can resume on the right ref.
- \`metadata.files\` (\`[{ path, note }]\`) for files you've touched.

## Discovery convention

Agents share one space per user. Don't claim work you aren't ready to do. Don't release work without leaving a note in \`body\` about how far you got.
`;

export async function getSkillFor(_actor: Actor): Promise<string> {
  // v2: query user_skills table by actor.userId, fall back to DEFAULT_SKILL.
  return DEFAULT_SKILL;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mcp/skill.ts
git commit -m "feat(mcp): DEFAULT_SKILL + getSkillFor stub for v2 customization"
```

---

### Task 5.2: MCP tool definitions

**Files:**
- Create: `lib/mcp/tools.ts`

- [ ] **Step 1: Create**

```ts
// lib/mcp/tools.ts
import { z } from "zod";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import {
  createHandoffInput,
  listHandoffsInput,
  updateHandoffInput,
  claimHandoffInput,
} from "@/lib/handoffs/schema";
import type { Actor } from "@/lib/auth/types";
import { HandoffError } from "@/lib/handoffs/errors";

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const err = (e: unknown) => {
  if (e instanceof HandoffError) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: `[${e.kind}] ${e.message}` }],
    };
  }
  return {
    isError: true,
    content: [{ type: "text" as const, text: `[internal] ${(e as Error).message}` }],
  };
};

export function registerHandoffTools(server: any, actor: Actor) {
  server.tool(
    "create_handoff",
    "Create a new handoff document for in-flight work. Use when ending a session, switching tools, or leaving work for a teammate.",
    createHandoffInput.shape,
    async (input: any) => {
      try { return ok(await service.create(db, actor, input)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_handoffs",
    "Browse handoffs as summaries (no body). Typical use: `{ status: \"open\", claimed: false }` to find work to pick up.",
    listHandoffsInput.shape,
    async (input: any) => {
      try { return ok(await service.list(db, actor, input)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_handoff",
    "Fetch a single handoff including its full body and metadata.",
    { id: z.string() },
    async ({ id }: { id: string }) => {
      try { return ok(await service.get(db, actor, id)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_handoff",
    "Patch a handoff. Common use: set status to in_progress when you start, or done when you finish.",
    updateHandoffInput.shape,
    async (input: any) => {
      try { return ok(await service.update(db, actor, input)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "claim_handoff",
    "Mark a handoff as being worked on by you. Advisory only — last writer wins.",
    claimHandoffInput.shape,
    async (input: any) => {
      try { return ok(await service.claim(db, actor, input)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "release_handoff",
    "Clear the claim on a handoff so another agent can pick it up.",
    { id: z.string() },
    async ({ id }: { id: string }) => {
      try { return ok(await service.release(db, actor, id)); }
      catch (e) { return err(e); }
    },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mcp/tools.ts
git commit -m "feat(mcp): six handoff tools wired to service layer"
```

---

### Task 5.3: MCP resources (`handoff://skill`) + prompt (`handoff-help`)

**Files:**
- Create: `lib/mcp/resources.ts`

- [ ] **Step 1: Create**

```ts
// lib/mcp/resources.ts
import type { Actor } from "@/lib/auth/types";
import { getSkillFor } from "./skill";

export function registerSkillResources(server: any, actor: Actor) {
  server.resource(
    "handoff-skill",
    "handoff://skill",
    { description: "The handoff service skill — usage instructions and conventions.", mimeType: "text/markdown" },
    async () => ({
      contents: [{
        uri: "handoff://skill",
        mimeType: "text/markdown",
        text: await getSkillFor(actor),
      }],
    }),
  );

  server.prompt(
    "handoff-help",
    "Print the handoff service skill (how to create, list, claim, etc.).",
    {},
    async () => ({
      messages: [{
        role: "assistant" as const,
        content: { type: "text" as const, text: await getSkillFor(actor) },
      }],
    }),
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mcp/resources.ts
git commit -m "feat(mcp): handoff://skill resource + handoff-help prompt"
```

---

### Task 5.4: Mount the MCP server at `/[transport]/route.ts`

**Files:**
- Create: `app/[transport]/route.ts`

- [ ] **Step 1: Create**

```ts
// app/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerHandoffTools } from "@/lib/mcp/tools";
import { registerSkillResources } from "@/lib/mcp/resources";
import { getSkillFor } from "@/lib/mcp/skill";
import { verifyAccessToken } from "@/lib/auth/mcp";
import type { Actor } from "@/lib/auth/types";

const handler = withMcpAuth(
  createMcpHandler(
    async (server, ctx) => {
      // ctx.auth.actor populated by withMcpAuth below
      const actor: Actor = ctx.auth.actor;
      server.serverInfo.instructions = await getSkillFor(actor);
      registerHandoffTools(server, actor);
      registerSkillResources(server, actor);
    },
    { name: "handoff-mcp", version: "0.1.0" },
    { basePath: "" },     // mounted at /[transport]
  ),
  {
    // mcp-handler calls this on every request. Return falsy to 401.
    verifyToken: async (req, token) => {
      const v = await verifyAccessToken(token);
      if (!v) return null;
      return { actor: v.actor, scopes: v.scopes };
    },
    required: true,
    resourceMetadata: {
      // /.well-known/oauth-protected-resource — points clients at our AS.
      authorizationServer: process.env.BETTER_AUTH_URL!,
    },
  },
);

export { handler as GET, handler as POST };
```

> The `mcp-handler` API surface (`withMcpAuth`, `createMcpHandler`, `server.serverInfo.instructions`) is what's documented in May 2026; if minor names differ in the installed version, consult `node_modules/mcp-handler/dist/*.d.ts` and adapt — the shape is stable.

- [ ] **Step 2: Quick smoke**

```bash
pnpm dev
```

In another terminal:

```bash
curl -s http://localhost:3000/.well-known/oauth-protected-resource | jq
```

Expected: JSON with `resource_server` and `authorization_servers` fields.

```bash
curl -s -X POST http://localhost:3000/sse \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

Expected: 401 (unauthorized — no Bearer). Good — auth is wired.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/[transport]/route.ts
git commit -m "feat(mcp): mount MCP server with withMcpAuth + skill instructions"
```

---

### Task 5.5: MCP end-to-end test via the SDK client

**Files:**
- Create: `tests/mcp/tools.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/mcp/tools.test.ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import { freshDb } from "@/tests/helpers/db";
import { seedUser } from "@/tests/helpers/factories";
import type { DB } from "@/lib/db";

let db: DB;
let userId: string;

beforeAll(async () => {
  db = (await freshDb()).db;
  ({ id: userId } = await seedUser(db));
  // Bypass OAuth verification — return our test actor.
  vi.doMock("@/lib/auth/better-auth", () => ({
    auth: {
      api: {
        verifyOAuthAccessToken: async () => ({
          active: true, userId, clientId: "test-client", clientName: "Test", scopes: ["handoffs:write"],
        }),
      },
    },
  }));
});

async function callTool(name: string, args: unknown) {
  const { default: handler } = await import("@/app/[transport]/route");
  // mcp-handler's tests typically use the SDK Client. Here we go HTTP-level for simplicity.
  const req = new Request("http://localhost/sse", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  // Both GET and POST exported equally; tools/call is POST.
  const res = await (handler as any)(req);
  return res.json();
}

describe("MCP tools end-to-end", () => {
  it("create_handoff → list_handoffs → get_handoff", async () => {
    const created = await callTool("create_handoff", {
      title: "first", body: "## what's left\n- ship it",
    });
    expect(created.result.isError).not.toBe(true);
    const createdHandoff = JSON.parse(created.result.content[0].text);

    const listed = await callTool("list_handoffs", { status: "open", claimed: false });
    expect(listed.result.isError).not.toBe(true);
    const page = JSON.parse(listed.result.content[0].text);
    expect(page.items.find((i: any) => i.id === createdHandoff.id)).toBeTruthy();

    const got = await callTool("get_handoff", { id: createdHandoff.id });
    const gotHandoff = JSON.parse(got.result.content[0].text);
    expect(gotHandoff.body).toBe("## what's left\n- ship it");
  });

  it("returns validation error for empty body", async () => {
    const res = await callTool("create_handoff", { title: "x", body: "" });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toMatch(/validation/);
  });
});
```

> If `mcp-handler`'s route handler doesn't directly accept a fetch `Request` like above (it should, since it returns from `createMcpHandler` which is a route handler), substitute with the MCP SDK client — `import { Client } from "@modelcontextprotocol/sdk/client/index.js"` + `StreamableHTTPClientTransport`. Either is acceptable; this version keeps the test self-contained.

- [ ] **Step 2: Run**

```bash
pnpm test tests/mcp/tools.test.ts
```

Expected: PASS. If the SDK shape doesn't match (e.g., the response envelope shape changed), `console.log` the response in the first test and adjust the parsing.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(mcp): end-to-end create/list/get/error through the route handler"
```

---

## Phase 6 — Web UI

### Task 6.1: Root layout + middleware + login page

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/middleware.ts`
- Create: `app/(web)/layout.tsx`
- Create: `app/(web)/login/page.tsx`

- [ ] **Step 1: Replace `app/layout.tsx`**

```tsx
// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "handoff-mcp",
  description: "AI agent handoff documents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create the middleware gating `(web)` routes**

```ts
// middleware.ts (project root, not app/)
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/", "/h", "/settings"];
const PUBLIC = ["/login", "/api", "/_next", "/favicon.ico"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  // Better Auth session cookie name follows pattern: `better-auth.session_token`.
  const session = req.cookies.get("better-auth.session_token");
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/h/:path*", "/settings/:path*"] };
```

- [ ] **Step 3: Create `(web)/layout.tsx`**

```tsx
// app/(web)/layout.tsx
import Link from "next/link";

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] px-6 py-3 flex items-center gap-6">
        <Link href="/" className="font-mono font-semibold">handoff-mcp</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/" className="hover:underline">Handoffs</Link>
          <Link href="/settings/agents" className="hover:underline">Agents</Link>
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create login page**

```tsx
// app/(web)/login/page.tsx
"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="max-w-sm mx-auto mt-24 space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Button className="w-full" onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/" })}>
        Continue with GitHub
      </Button>
      <div className="relative text-center text-xs text-[var(--color-muted)]">— or —</div>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await authClient.signIn.magicLink({ email, callbackURL: "/" });
          setSent(true);
        }}
      >
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <Button type="submit" variant="secondary" className="w-full">Email me a magic link</Button>
        {sent && <p className="text-sm text-[var(--color-muted)]">Check your email.</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): root layout, middleware gating, login page"
```

---

### Task 6.2: Handoff list page (`/`)

**Files:**
- Create: `app/(web)/page.tsx`
- Create: `components/filter-bar.tsx`
- Create: `components/status-badge.tsx`

- [ ] **Step 1: Status badge**

```tsx
// components/status-badge.tsx
import { Badge } from "@/components/ui/badge";

const colors: Record<string, string> = {
  open:         "bg-[var(--color-status-open)]/15 text-[var(--color-status-open)]",
  in_progress:  "bg-[var(--color-status-in-progress)]/15 text-[var(--color-status-in-progress)]",
  done:         "bg-[var(--color-status-done)]/15 text-[var(--color-status-done)]",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge className={colors[status] ?? ""}>{status}</Badge>;
}
```

- [ ] **Step 2: Filter bar (client component)**

```tsx
// components/filter-bar.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const set = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v); else next.delete(k);
    router.push(`/?${next.toString()}`);
  };
  return (
    <div className="flex gap-2 items-center">
      <Select value={sp.get("status") ?? "any"} onValueChange={(v) => set("status", v === "any" ? undefined : v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
      <Input
        placeholder="Search…"
        defaultValue={sp.get("q") ?? ""}
        onKeyDown={(e) => { if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value || undefined); }}
        className="max-w-xs"
      />
    </div>
  );
}
```

- [ ] **Step 3: List page (RSC)**

```tsx
// app/(web)/page.tsx
import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { resolveWebActor } from "@/lib/auth/web";
import { redirect } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterBar } from "@/components/filter-bar";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function HandoffsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const h = await headers();
  const req = new Request("http://x/", { headers: h });
  const actor = await resolveWebActor(req);
  if (!actor) redirect("/login");

  const params = await searchParams;
  const page = await service.list(db, actor, {
    status: params.status as any,
    project: params.project,
    tag: params.tag,
    query: params.q,
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Handoffs</h1>
        <FilterBar />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Claimed</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.items.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <Link href={`/h/${i.id}`} className="font-medium hover:underline">{i.title}</Link>
                {i.summary && <div className="text-sm text-[var(--color-muted)] line-clamp-1">{i.summary}</div>}
              </TableCell>
              <TableCell><StatusBadge status={i.status} /></TableCell>
              <TableCell className="text-sm">{i.project ?? "—"}</TableCell>
              <TableCell className="text-sm">{i.claimedBy ?? "—"}</TableCell>
              <TableCell className="text-sm">{new Date(i.updatedAt).toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-xs">{i.id}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): handoff list page with filter bar"
```

---

### Task 6.3: Detail page (`/h/[id]`)

**Files:**
- Create: `app/(web)/h/[id]/page.tsx`
- Create: `components/handoff-detail-actions.tsx`
- Create: `lib/markdown.tsx`

- [ ] **Step 1: Markdown renderer**

```tsx
// lib/markdown.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{children}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Server actions for status / claim**

```tsx
// app/(web)/h/[id]/actions.ts
"use server";
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { resolveWebActor } from "@/lib/auth/web";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

async function actor() {
  const h = await headers();
  const a = await resolveWebActor(new Request("http://x", { headers: h }));
  if (!a) throw new Error("unauthorized");
  return a;
}

export async function setStatus(id: string, status: "open" | "in_progress" | "done") {
  await service.update(db, await actor(), { id, patch: { status } });
  revalidatePath(`/h/${id}`);
}

export async function release(id: string) {
  await service.release(db, await actor(), id);
  revalidatePath(`/h/${id}`);
}
```

- [ ] **Step 3: Actions component (client)**

```tsx
// components/handoff-detail-actions.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setStatus, release } from "@/app/(web)/h/[id]/actions";

export function DetailActions({ id, status, claimedBy }: { id: string; status: string; claimedBy: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <Select defaultValue={status} onValueChange={(v) => setStatus(id, v as any)}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="open">open</SelectItem>
          <SelectItem value="in_progress">in_progress</SelectItem>
          <SelectItem value="done">done</SelectItem>
        </SelectContent>
      </Select>
      {claimedBy && <Button variant="outline" onClick={() => release(id)}>Release (claimed by {claimedBy})</Button>}
    </div>
  );
}
```

- [ ] **Step 4: Detail page**

```tsx
// app/(web)/h/[id]/page.tsx
import { db } from "@/lib/db";
import * as service from "@/lib/handoffs/service";
import { resolveWebActor } from "@/lib/auth/web";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Markdown } from "@/lib/markdown";
import { StatusBadge } from "@/components/status-badge";
import { DetailActions } from "@/components/handoff-detail-actions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await headers();
  const actor = await resolveWebActor(new Request("http://x", { headers: h }));
  if (!actor) redirect("/login");
  try {
    const handoff = await service.get(db, actor, id);
    return (
      <div className="grid grid-cols-[1fr,320px] gap-8 max-w-6xl mx-auto">
        <article>
          <header className="mb-6">
            <h1 className="text-2xl font-semibold">{handoff.title}</h1>
            {handoff.summary && <p className="text-[var(--color-muted)] mt-1">{handoff.summary}</p>}
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status={handoff.status} />
              <span className="font-mono text-xs text-[var(--color-muted)]">{handoff.id}</span>
            </div>
          </header>
          <Markdown>{handoff.body}</Markdown>
        </article>
        <aside className="space-y-4 text-sm">
          <DetailActions id={handoff.id} status={handoff.status} claimedBy={handoff.claimedBy} />
          <Section title="Project">{handoff.project ?? "—"}</Section>
          <Section title="Tags">{handoff.tags.length ? handoff.tags.join(", ") : "—"}</Section>
          {handoff.metadata?.git && (
            <Section title="Git">
              <div>repo: {handoff.metadata.git.repo ?? "—"}</div>
              <div>branch: {handoff.metadata.git.branch ?? "—"}</div>
              <div>commit: {handoff.metadata.git.commit ?? "—"}</div>
            </Section>
          )}
          {handoff.metadata?.files?.length ? (
            <Section title="Files">
              {handoff.metadata.files.map((f) => (
                <div key={f.path} className="font-mono text-xs">{f.path}</div>
              ))}
            </Section>
          ) : null}
          <Section title="Created">{new Date(handoff.createdAt).toLocaleString()}</Section>
          <Section title="Updated">{new Date(handoff.updatedAt).toLocaleString()}</Section>
        </aside>
      </div>
    );
  } catch (e: any) {
    if (e?.kind === "not_found") notFound();
    throw e;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{title}</div>
      <div>{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): handoff detail page with markdown body and status/release actions"
```

---

### Task 6.4: Settings — authorized agents (`/settings/agents`)

**Files:**
- Create: `app/(web)/settings/agents/page.tsx`
- Create: `app/(web)/settings/agents/actions.ts`

- [ ] **Step 1: Server actions**

```ts
// app/(web)/settings/agents/actions.ts
"use server";
import { auth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function revokeClient(clientId: string) {
  const h = await headers();
  await auth.api.revokeOAuthClient({ clientId, headers: h });
  revalidatePath("/settings/agents");
}
```

> If `auth.api.revokeOAuthClient` is named differently in the installed Better Auth version, check the OAuth Provider plugin's typings (`node_modules/better-auth/dist/plugins/oauth-provider/*.d.ts`). The functionality (revoking all tokens for a client) is part of the plugin's standard API surface.

- [ ] **Step 2: Page**

```tsx
// app/(web)/settings/agents/page.tsx
import { headers } from "next/headers";
import { auth } from "@/lib/auth/better-auth";
import { Button } from "@/components/ui/button";
import { revokeClient } from "./actions";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const h = await headers();
  const clients = await auth.api.listOAuthClientsForUser({ headers: h });
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Authorized agents</h1>
      <p className="text-sm text-[var(--color-muted)]">
        Each row is an MCP client that registered itself via OAuth. Revoke to invalidate all its tokens.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-[var(--color-border)]">
            <th className="py-2">Name</th>
            <th>Client ID</th>
            <th>Authorized</th>
            <th>Last used</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c: any) => (
            <tr key={c.id} className="border-b border-[var(--color-border)]">
              <td className="py-2">{c.name ?? "—"}</td>
              <td className="font-mono text-xs">{c.clientId}</td>
              <td>{new Date(c.createdAt).toLocaleString()}</td>
              <td>{c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : "—"}</td>
              <td className="text-right">
                <form action={revokeClient.bind(null, c.clientId)}>
                  <Button variant="outline" size="sm">Revoke</Button>
                </form>
              </td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-center text-[var(--color-muted)]">No agents have authorized yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(web): /settings/agents — list and revoke authorized OAuth clients"
```

---

### Task 6.5: Playwright smoke test

**Files:**
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Write smoke**

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: /github/i })).toBeVisible();
});

test("/ redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 2: Run (requires DATABASE_URL pointing at a real or local Supabase)**

```bash
pnpm test:e2e
```

If you don't have a local DB hooked up yet, skip this until Phase 7. Don't commit a failing run.

- [ ] **Step 3: Commit (assuming green)**

```bash
git add -A
git commit -m "test(e2e): smoke for /login and unauth redirect"
```

---

## Phase 7 — Deployment

### Task 7.1: `vercel.json` and `.env.example`

**Files:**
- Create: `vercel.json`
- Verify: `.env.example` (already exists; ensure complete)

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "buildCommand": "pnpm db:migrate && pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs"
}
```

- [ ] **Step 2: Ensure `.env.example` has every required variable**

```
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
RESEND_API_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json .env.example
git commit -m "chore: vercel.json + env.example"
```

---

### Task 7.2: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/ci.yml
name: ci
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: vitest + build on push and PR"
```

---

### Task 7.3: README + Skill self-test

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README**

```markdown
# handoff-mcp

Single-user web service that lets AI coding agents hand off self-contained
markdown documents to each other via an OAuth-authenticated MCP server, a
mirrored REST API, and a minimal web UI.

## Quick start

1. `pnpm install`
2. Create a Supabase project, paste connection string into `.env.local` as `DATABASE_URL`.
3. Fill in `BETTER_AUTH_SECRET` (any 32-byte random string), GitHub OAuth app creds, and a Resend API key.
4. `pnpm db:migrate`
5. `pnpm dev` and open http://localhost:3000

## Connecting an agent

```
claude mcp add handoff https://<your-domain>/mcp
```

Claude Code will walk you through OAuth in your browser. After it completes,
the agent can call `list_handoffs`, `create_handoff`, `get_handoff`,
`update_handoff`, `claim_handoff`, `release_handoff`. The server also pushes
the handoff skill via `instructions`, so agents learn the conventions on connect.

## Testing

- `pnpm test` — unit + integration (testcontainers Postgres)
- `pnpm test:e2e` — Playwright smoke
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quick-start and agent connection"
```

---

## Final phase — self-review checklist

Before declaring done, walk through the spec's Section 2 (Success criteria) and Section 14 (Risks) and verify each is satisfied or explicitly deferred.

- [ ] **Success criterion 1** (MCP OAuth connect from Claude Code) — manual test by running `claude mcp add http://localhost:3000/mcp` after `pnpm dev`. Confirm the browser opens, OAuth completes, and `tools/list` returns the six tools.
- [ ] **Success criterion 2** (instructions delivered, `handoff://skill` resource, `handoff-help` prompt) — call `initialize`, `resources/list`, `prompts/list` and confirm all three.
- [ ] **Success criterion 3** (curl with Bearer works) — after manual OAuth, copy the access token from devtools and curl `GET /api/handoffs`.
- [ ] **Success criterion 4** (web UI: login, browse, copy ID, revoke) — manual click-through.
- [ ] **Success criterion 5** (data shape) — verify by reading any handoff via the API.
- [ ] **Success criterion 6** (blob/v2-skill extension points exist) — verify `lib/storage/index.ts` and `getSkillFor(actor)` are in place.
- [ ] **Risk-1 userId guard** — `pnpm test tests/handoffs/repo-userid-guard.test.ts` is green.
- [ ] **Risk-2 revoke flow** — clicking Revoke on `/settings/agents` invalidates an active token (returns 401 on next call).
- [ ] **Risk-3 sanitizer** — paste raw `<script>alert(1)</script>` into a handoff body via the API; confirm it does not execute on `/h/[id]`.

When all boxes are checked, tag `v0.1.0` and deploy:

```bash
git tag v0.1.0
git push --tags
vercel --prod
```
