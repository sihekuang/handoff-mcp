# handoff-mcp

A single-user web service that lets AI coding agents hand off self-contained
markdown documents to each other via an MCP server (Streamable HTTP), a
mirrored REST API, and a minimal browse/manage web UI.

> **Status:** MVP — agent-to-agent flow verified end-to-end with two
> sub-agents exchanging a handoff via the MCP server. Authentication is
> intentionally deferred (the server uses a hardcoded `dev_user` actor);
> Better Auth wiring is built but not connected. UI is read-only at this
> stage (list + detail).

## Quick start (local)

```bash
# 1. Start a local Postgres
docker run -d --name handoff-pg -p 54330:5432 \
  -e POSTGRES_USER=handoff -e POSTGRES_PASSWORD=handoff -e POSTGRES_DB=handoff \
  postgres:16-alpine

# 2. Set env (or copy .env.example to .env.local and edit)
echo 'DATABASE_URL=postgresql://handoff:handoff@localhost:54330/handoff' > .env.local
echo 'BETTER_AUTH_SECRET=any-32-byte-random-string-for-now' >> .env.local
echo 'BETTER_AUTH_URL=http://localhost:3000' >> .env.local
echo 'NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000' >> .env.local

# 3. Install + migrate
pnpm install
DATABASE_URL='postgresql://handoff:handoff@localhost:54330/handoff' pnpm db:migrate
# Migration 0001 seeds the dev_user actor automatically — no manual INSERT needed.

# 4. Run
pnpm dev
```

Open <http://localhost:3000> to browse handoffs.

## Install via Homebrew

```bash
brew tap sihekuang/handoff-mcp https://github.com/sihekuang/handoff-mcp
brew install handoff-mcp

# Start manually
handoff start

# Or run as a login service
brew services start handoff-mcp

# Stop
handoff stop
# or
brew services stop handoff-mcp
```

## Install as Claude Code plugin

```bash
# 1. Add the marketplace (one time)
/plugin marketplace add sihekuang/handoff-mcp

# 2. Install the plugin
/plugin install handoff-mcp@sihekuang
```

Requires the server running locally (`brew services start handoff-mcp` or `pnpm dev`). The plugin adds a handoff skill and connects Claude Code to the MCP server at `http://localhost:3007/mcp`.

## Install for Codex

```bash
# Branded (uses the handoff CLI from Homebrew)
handoff codex install

# Or natively
codex mcp add handoff --url http://localhost:3007/mcp
```

Requires the server running locally (`brew services start handoff-mcp` or `pnpm dev`). The MCP server's `instructions` field carries the handoff skill — Codex agents learn the conventions automatically on connect. To remove: `handoff codex uninstall` (or `codex mcp remove handoff`).

## Connecting an agent

The MCP server is at `http://localhost:3007/mcp` (Streamable HTTP) when installed via Homebrew, or `http://localhost:3000/mcp` when running with `pnpm dev`. No auth at MVP. Connect with the official MCP SDK:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-agent", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost:3007/mcp")));

// The server's instructions field carries the handoff skill — agents
// learn the conventions on connect.

const tools = await client.listTools();         // 6 tools
await client.callTool({ name: "create_handoff", arguments: { title, body, ... } });
```

The six tools: `create_handoff`, `list_handoffs`, `get_handoff`, `update_handoff`, `claim_handoff`, `release_handoff`. The discovery convention (in `lib/mcp/skill.ts`): `list_handoffs({ status: "open", claimed: false })` → `get_handoff({ id })` → `claim_handoff({ id, agent })`.

There's also a `handoff://skill` resource (markdown) and a `handoff-help` prompt.

## REST API mirror

Same operations are available over HTTP (auth deferred = no Authorization header needed at MVP):

```
GET    /api/handoffs?status=&project=&tag=&claimed=&q=&cursor=&limit=
POST   /api/handoffs                       { title, body, ... }
GET    /api/handoffs/[id]
PATCH  /api/handoffs/[id]                  { patch: { ... } }
POST   /api/handoffs/[id]/claim            { agent }
DELETE /api/handoffs/[id]/claim
```

## Testing

- `pnpm test` — unit + integration (testcontainers Postgres, ~30s including container boot)
- `pnpm test:e2e` — Playwright smoke (requires `pnpm dev` running)

## What's deferred

- **Auth.** Better Auth's MCP plugin is configured at `lib/auth/better-auth.ts` but `withMcpAuth` isn't connected in `app/[transport]/route.ts`. Wire it back in to require OAuth (PKCE + DCR) on MCP connections and a cookie session for the UI.
- **Settings UI.** `/settings/agents` (list authorized OAuth clients with a Revoke button) is not built — it depends on real auth.
- **Vercel deploy.** `vercel.json` exists but the build command doesn't run `db:migrate` until a hosted DB is connected.
- **Blob attachments.** The interface `lib/storage/index.ts` is stubbed; an `attachments` table + `attach_blob` MCP tool come later.
- **Editable per-user skill.** `lib/mcp/skill.ts` exposes `getSkillFor(actor)` which always returns `DEFAULT_SKILL` today. v2 adds a `user_skills` table + `/settings/skill` editor.

## Reference docs

- Design spec: `docs/superpowers/specs/2026-05-22-handoff-mcp-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-22-handoff-mcp.md`
- Claude Code plugin spec: `docs/superpowers/specs/2026-05-27-claude-code-plugin-design.md`
- Claude Code plugin plan: `docs/superpowers/plans/2026-05-27-claude-code-plugin.md`
