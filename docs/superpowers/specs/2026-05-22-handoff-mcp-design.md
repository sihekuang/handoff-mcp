# Handoff-MCP — Design Spec

- **Date:** 2026-05-22
- **Status:** Approved (pre-implementation)
- **Author:** drafted via brainstorming with Claude Code (Opus 4.7, 1M)

## 1. Goal

Build a single-user web service that lets AI coding agents (Claude Code, Cursor, Codex, etc.) **hand off self-contained "handoff documents" to one another**. Agent A creates a handoff describing the state of work; Agent B (another tool, another session, or the human) discovers and reads it later.

This is the minimum viable scope. Out of scope for v1 but explicitly designed-for:

- Same-agent session resume (works as a side effect)
- AI-to-human review surface (the web UI already supports this read-only)
- Binary attachments (blobs) — storage interface placeholder reserved
- Status workflows beyond `open / in_progress / done`
- Multi-user / teams
- Kanban or alternative UI layouts

## 2. Success criteria

1. From Claude Code (or any MCP-aware tool), I can run `claude mcp add https://<my-domain>/mcp` and be walked through OAuth in a browser, ending with the agent able to call `list_handoffs` / `create_handoff` / `get_handoff` / `claim_handoff`.
2. The same operations work over plain HTTPS with `Authorization: Bearer …` from a script or curl.
3. I can open the web UI, log in with GitHub or magic link, browse all handoffs my agents wrote, copy an ID to share with another agent, and revoke an agent.
4. A handoff carries: title, free-form markdown body, optional summary, status, project, tags, free-form structured metadata (git refs, files touched, etc.), `claimed_by`, timestamps.
5. Adding blob attachments later requires no schema rewrite, no auth rewrite, no route restructure — only filling in `lib/storage/` and adding an `attachments` table + a `attach_blob` tool.

## 3. Stack (all latest stable, May 2026)

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js | 16.2.6 LTS |
| Runtime | React | 19.2.6 |
| Styling | Tailwind CSS | 4.3 |
| Components | shadcn/ui | latest |
| MCP server | `mcp-handler` (Vercel adapter) + `@modelcontextprotocol/sdk` | ^1.26 |
| Auth | Better Auth (with MCP OAuth provider plugin) | latest |
| ORM | Drizzle ORM + drizzle-kit | latest |
| Database | Supabase Postgres (storage only — not Supabase Auth) | latest |
| Markdown | `react-markdown` + `remark-gfm` + `shiki` + `rehype-sanitize` | latest |
| Validation | `zod` | ^3 |
| Logging | `pino` (+ `pino-pretty` in dev) | latest |
| Testing | Vitest + `@testcontainers/postgresql` + Playwright (smoke) | latest |
| Hosting | Vercel (Fluid compute) | — |

Notable deliberate choices:

- **Better Auth replaces Supabase Auth.** We use Better Auth's **OAuth Provider plugin** (the newer general OAuth 2.1 plugin — preferred over the older `mcp` plugin, which has CORS issues with browser-based MCP clients). It handles PKCE and DCR. Runs in the same Next.js app, Drizzle-native. Supabase is kept as Postgres only.
- **Drizzle over Prisma.** Smaller bundle, edge-friendly, SQL-shaped types, plays cleanly with Better Auth's schema generator.
- **No Vercel KV / Redis at MVP.** All state in Postgres. Streamable HTTP transport via `mcp-handler` doesn't require Redis unless we add SSE fallback, which we don't.

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Next.js 16 app on Vercel                                        │
│                                                                  │
│  app/(web)/...              ← humans (Better Auth cookie)        │
│  app/api/handoffs/*         ← scripts/curl (Bearer access token) │
│  app/[transport]/route.ts   ← AI agents (MCP Streamable HTTP +   │
│                                          OAuth via withMcpAuth)  │
│  app/api/auth/[...all]/...  ← Better Auth (humans + MCP OAuth AS)│
│                                                                  │
│         All four call into ↓                                     │
│  lib/handoffs/service.ts    ← single source of business logic    │
│         ↓                                                        │
│  lib/handoffs/repo.ts       ← only file that issues SQL          │
└──────────────────────────────────────────────────────────────────┘
                                ↓
                  Supabase Postgres (Drizzle)
```

**Invariants:**

- Only `lib/handoffs/repo.ts` issues SQL. Service layer doesn't import Drizzle.
- Every surface adapter is thin: (1) parse input via zod, (2) resolve `actor`, (3) call `service.x(actor, input)`, (4) format response.
- Every `service.x` call filters by `actor.userId` in its first repo query. Defense in depth, since we no longer have Postgres RLS via `auth.uid()`.

## 5. Repo layout

```
handoff-mcp/
├── app/
│   ├── (web)/
│   │   ├── layout.tsx                  # shadcn shell, auth-gated
│   │   ├── page.tsx                    # handoff list (RSC)
│   │   ├── h/[id]/page.tsx             # handoff detail (RSC)
│   │   ├── settings/agents/page.tsx    # OAuth client list + revoke
│   │   └── login/page.tsx              # Better Auth UI
│   ├── api/
│   │   ├── auth/[...all]/route.ts      # Better Auth handler
│   │   └── handoffs/
│   │       ├── route.ts                # GET list, POST create
│   │       └── [id]/
│   │           ├── route.ts            # GET, PATCH
│   │           └── claim/route.ts      # POST claim, DELETE release
│   └── [transport]/route.ts            # mcp-handler entrypoint (Streamable HTTP)
├── lib/
│   ├── handoffs/
│   │   ├── schema.ts                   # Drizzle tables + zod input/output schemas
│   │   ├── repo.ts                     # SQL only
│   │   ├── service.ts                  # business logic, takes (actor, input)
│   │   └── errors.ts                   # HandoffError tagged union
│   ├── auth/
│   │   ├── better-auth.ts              # Better Auth config (humans + MCP provider plugin)
│   │   ├── schema.ts                   # Better Auth's generated Drizzle tables
│   │   ├── web.ts                      # resolve Actor from cookie session
│   │   └── mcp.ts                      # resolve Actor from OAuth access token
│   ├── storage/
│   │   └── index.ts                    # interface { put, signedUrl } — empty at MVP
│   ├── mcp/
│   │   └── tools.ts                    # MCP tool definitions
│   └── log.ts                          # pino instance
├── db/
│   ├── migrations/                     # drizzle-kit output (committed)
│   └── seed.ts
├── components/                          # shadcn-generated UI primitives
├── tests/
│   ├── service.test.ts                 # integration tests (testcontainers Postgres)
│   ├── mcp.test.ts                     # MCP tools end-to-end
│   ├── auth.test.ts                    # token/session resolvers
│   └── smoke.spec.ts                   # Playwright smoke for /, /h/[id], /settings/agents
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts                  # mostly v4 @theme directives in globals.css
└── package.json
```

## 6. Data model

### `handoffs`

```ts
export const handoffStatus = pgEnum("handoff_status", ["open", "in_progress", "done"]);

export const handoffs = pgTable("handoffs", {
  id:          text("id").primaryKey(),                  // "h_" + nanoid(10)
  userId:      text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  summary:     text("summary"),
  body:        text("body").notNull(),                   // canonical markdown
  status:      handoffStatus("status").notNull().default("open"),
  project:     text("project"),
  tags:        text("tags").array().notNull().default(sql`'{}'`),
  metadata:    jsonb("metadata").$type<HandoffMetadata>().notNull().default({}),
  claimedBy:   text("claimed_by"),
  claimedAt:   timestamp("claimed_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byUser:    index("handoffs_by_user").on(t.userId, t.status, t.updatedAt),
  byProject: index("handoffs_by_project").on(t.userId, t.project),
}));

export type HandoffMetadata = {
  git?:   { repo?: string; branch?: string; commit?: string; prUrl?: string };
  files?: Array<{ path: string; note?: string }>;
  [k: string]: unknown;
};
```

### Better Auth tables

Generated via `npx @better-auth/cli generate` into `lib/auth/schema.ts`. Includes `users`, `sessions`, `accounts` (OAuth identities for humans logging in via GitHub), `oauth_application`, `oauth_access_token`, `oauth_consent` (MCP OAuth provider). All foreign keys point at `users.id` (text).

### `attachments` (reserved — not created at MVP)

When introduced:

```ts
attachments(id, handoff_id, object_key, mime, size_bytes, created_at)
```

backed by a Supabase Storage bucket. **At MVP, `lib/storage/index.ts` contains only the TypeScript interface** (`{ put(file): Promise<{ key }>; signedUrl(key, ttl): Promise<string> }`) plus a `throw new Error("not implemented")` stub. No call sites use it yet. When blobs land we fill in the Supabase Storage adapter without changing the surface.

## 7. MCP & REST surfaces

### MCP tools (mounted by `mcp-handler` at `/[transport]/route.ts`, wrapped in `withMcpAuth`)

| Tool | Input (zod) | Returns |
|---|---|---|
| `create_handoff` | `{ title, body, summary?, project?, tags?, status?, metadata? }` | `{ id, url, ...handoff }` |
| `list_handoffs` | `{ status?, project?, tag?, claimed?, query?, limit?: 1-100, cursor? }` | `{ items: HandoffSummary[], nextCursor? }` |
| `get_handoff` | `{ id }` | `Handoff` |
| `update_handoff` | `{ id, patch: Partial<Handoff> }` | `Handoff` |
| `claim_handoff` | `{ id, agent: string }` | `Handoff` |
| `release_handoff` | `{ id }` | `Handoff` |

`HandoffSummary` = `id`, `title`, `summary`, `status`, `project`, `tags`, `claimedBy`, `updatedAt`. No `body` — keeps responses small enough that an agent can list without burning context.

Each tool description teaches the discovery convention: filter `{ status: "open", claimed: false }`, read summaries, `get_handoff` the candidate, `claim_handoff` once committed.

### REST API

```
GET    /api/handoffs?status=&project=&tag=&claimed=&q=&cursor=&limit=
POST   /api/handoffs                       { title, body, ... }
GET    /api/handoffs/[id]
PATCH  /api/handoffs/[id]                  { patch: { ... } }
POST   /api/handoffs/[id]/claim            { agent }
DELETE /api/handoffs/[id]/claim
```

Auth: `Authorization: Bearer <access_token>` (Better Auth-issued, same tokens as MCP). The REST handlers and MCP tool handlers share helpers and are thin enough that one cannot drift from the other.

## 8. Auth model

### Humans

- Better Auth with two providers: **GitHub OAuth** and **email magic link** (via Resend).
- Cookie session, set/read via `@better-auth/next-js` helpers.
- Middleware on `app/(web)/*` redirects unauthenticated to `/login`.

### Agents (MCP and REST)

- Better Auth's **OAuth Provider plugin** (OAuth 2.1 compliant) acts as the Authorization Server. Endpoints land under `/api/auth/oauth2/*` (authorize, token, register, revoke, plus `.well-known/oauth-authorization-server` discovery).
- Agents register dynamically (DCR) on first connect, do PKCE auth code flow, get short-lived access tokens + refresh tokens.
- `mcp-handler`'s `withMcpAuth(handler, verifyToken)` validates tokens on every MCP request.
- REST endpoints share the same `verifyToken` via `lib/auth/mcp.ts`.
- Per-agent revocation: `/settings/agents` lists each registered `oauth_application` row with a "Revoke" button → marks tokens invalid → the next agent call returns 401 → agent re-authorizes (or stays revoked).

### Shared `Actor` abstraction

```ts
export type Actor =
  | { kind: "user";  userId: string }
  | { kind: "agent"; userId: string; clientId: string; clientName: string };
```

All service calls take `actor` as the first argument. All repo queries filter by `actor.userId`.

## 9. Web UI

| Route | Purpose | Render |
|---|---|---|
| `/login` | Better Auth GitHub + magic-link | client |
| `/` | Handoff list (filter bar, table, "Copy ID/URL") | RSC + small client filter island |
| `/h/[id]` | Detail: markdown body + metadata sidebar + status/claim actions | RSC + server actions |
| `/settings/agents` | Authorized OAuth clients + revoke | RSC + server actions |

- Layout shape: list+detail ("inbox" style). No kanban, no body editor at MVP.
- Top nav: brand · Handoffs · Agents · user menu.
- Tailwind v4 with `@theme` directive in `app/globals.css`. Dark mode follows system.
- Markdown rendering: `react-markdown` + `remark-gfm` + `rehype-sanitize` (no raw HTML) + `shiki` for code highlighting.
- Cursor pagination on `/` keyed on `(updatedAt, id)`.

## 10. Error handling

```ts
export class HandoffError extends Error {
  constructor(
    public kind: "not_found" | "forbidden" | "validation" | "conflict" | "unauthorized",
    public detail: string,
    public meta?: Record<string, unknown>,
  ) { super(detail); }
}
```

Translation table (set once per surface):

| Surface | not_found | forbidden | validation | conflict | unauthorized |
|---|---|---|---|---|---|
| REST | 404 | 403 | 422 | 409 | 401 |
| MCP | tool error result `{ isError: true, content: [...] }` with `kind` in the text | same | same | same | same (also triggers WWW-Authenticate so client re-auths) |
| RSC | `notFound()` → `not-found.tsx` | 403 page | shown inline on the originating form | 409 page | redirect to `/login` |

Raw DB errors (`23505` unique-violation, etc.) never leak. Service layer catches Drizzle errors and rethrows typed `HandoffError`s.

## 11. Testing

| Layer | Strategy |
|---|---|
| `lib/handoffs/service.ts` | Integration tests against ephemeral Postgres via `@testcontainers/postgresql`. Drizzle migrations applied per test file. **No mocks.** |
| MCP tools | End-to-end: start Next.js app in test mode, connect with MCP TypeScript SDK client, call each tool, assert results. |
| Auth resolvers | Unit tests with fake Better Auth contexts; one integration test that goes through the full OAuth code flow. |
| REST handlers | Covered transitively via service tests + a thin contract test per endpoint (status codes, error shapes). |
| Web UI | Playwright smoke: log in with seeded test user, visit `/`, click into a `/h/[id]`, visit `/settings/agents`. |

CI: GitHub Actions runs `pnpm test` (vitest) + `pnpm test:e2e` (Playwright) on every PR.

## 12. Logging & observability

- `pino` JSON logs to stdout. Vercel ingests automatically.
- `requestId` (uuid) generated in middleware, propagated through `Actor` context, included in every log line **and** in error response bodies so they can be grepped from a screenshot.
- No external APM at MVP.

## 13. Migrations & deployment

- All schema lives under Drizzle: `lib/handoffs/schema.ts` + `lib/auth/schema.ts` (latter generated by `@better-auth/cli generate`).
- `drizzle-kit generate` produces SQL in `db/migrations/` — committed to git.
- Package manager: **pnpm** (locked via `packageManager` field in `package.json`).
- Vercel build command, set in `vercel.json`: `pnpm db:migrate && pnpm build`. Migration failure fails the deploy. `db:migrate` is an npm script that runs `drizzle-kit migrate`.
- Preview deploys point at a separate Supabase project (or a Supabase branch DB) so previews can't corrupt prod.
- Environment variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `RESEND_API_KEY`.

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Losing Postgres RLS as a safety net (because we dropped Supabase Auth) | Single mandatory `userId` filter in every repo query; CI grep test that fails if a query in `lib/handoffs/repo.ts` doesn't reference `actor.userId`. |
| OAuth client sprawl as users run `mcp add` from many machines | `/settings/agents` shows last-used date and lets the user "revoke all" or revoke individually. |
| Markdown body from untrusted agent input | `rehype-sanitize` strips raw HTML; only standard markdown + code blocks render. |
| Concurrent agents both claim the same handoff | Advisory only at MVP — last writer wins. If it ever matters, add `If-Match` on `updated_at` and surface a `conflict` error. |
| MCP discovery convention only works if agents know it | Each tool description spells out the recommended flow; the README documents it; an MCP `prompt` named `pickup_next` will encode it as a server-provided slash command for clients that surface prompts. |
| Better Auth schema migrations diverging from our hand-written tables | Always run `@better-auth/cli generate` and `drizzle-kit generate` in the same script; commit both outputs together. |

## 15. Future extensions (intentionally out-of-scope, designed-for)

- **Blob attachments:** add `attachments` table, fill in `lib/storage/index.ts` using Supabase Storage, add `attach_blob` / `get_blob_url` MCP tools. Web UI renders inline (images) or as download links (other).
- **Status workflows:** extend `handoff_status` enum (`blocked`, `ready_for_review`, etc.) and add columns by enum.
- **Kanban view:** new route `/board` that reads the same data. Layout shape is purely a UI change.
- **Multi-user / sharing:** add `workspace` and `handoff_share` tables; the `Actor.userId` filter becomes an `Actor.workspaceId` filter; RLS-like checks done in service.
- **Local-first / sync:** the storage interface in `lib/handoffs/repo.ts` could be swapped for a file-backed implementation; service layer would not change.

## 16. Glossary

- **Handoff** — a markdown document plus structured metadata that captures the state of in-progress work, so another agent (or session, or person) can pick it up.
- **Actor** — the authenticated principal for a given request; either a `user` (human via cookie) or an `agent` (MCP OAuth client via Bearer token), always carrying a `userId`.
- **PKCE** — Proof Key for Code Exchange (RFC 7636); prevents auth-code interception for public clients.
- **DCR** — Dynamic Client Registration (RFC 7591); lets MCP clients register themselves on first connect without manual admin steps.
- **Streamable HTTP** — the 2026 MCP transport for remote servers; replaces SSE as the preferred remote transport.
