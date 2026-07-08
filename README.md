# handoff-mcp

A single-user web service that lets AI coding agents hand off self-contained
markdown documents to each other via an MCP server (Streamable HTTP), a
mirrored REST API, and a minimal browse/manage web UI.

> **Status:** MVP — agent-to-agent flow verified end-to-end with two
> sub-agents exchanging a handoff via the MCP server. Authentication is
> intentionally deferred (the server uses a hardcoded `dev_user` actor);
> Better Auth wiring is built but not connected. UI is read-only at this
> stage (list + detail).

## Get started (Homebrew + Claude Code)

The fastest path to a working handoff server wired into Claude Code — no port
config, no Postgres to run (the packaged CLI uses an embedded database):

```bash
# 1. Install the CLI (macOS / Linux)
brew tap sihekuang/handoff-mcp https://github.com/sihekuang/handoff-mcp
brew install handoff-mcp

# 2. Add + install the Claude Code plugin (run these in Claude Code)
/plugin marketplace add sihekuang/handoff-mcp
/plugin install handoff-mcp@sihekuang
```

**Verify it works** (one paste — starts the server, checks it, then leaves it running):

```bash
handoff start                                                              # -> "handoff-mcp started … MCP: http://localhost:<port>/mcp"
handoff status                                                             # -> "running (pid …) on port <port>"
curl -s -o /dev/null -w 'server: %{http_code}\n' "$(handoff url | sed 's#/mcp##')"   # -> server: 200
```

Then, in Claude Code, ask it to **"list open handoffs"** — the plugin's tools
connect automatically. (The plugin auto-starts the server via `handoff mcp` on
first use, so `handoff start` above is only for the manual check; use `handoff
stop` to shut it down.)

Using **Codex** instead? See [Install as Codex plugin](#install-as-codex-plugin).
Want to **hack on the app itself**? See [Local development](#local-development).

## Local development

For working on the app itself — runs the Next dev server on a fixed port 3000
(the auto-port behavior applies to the packaged `handoff` CLI, not `next dev`):

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

The plugin connects via `handoff mcp` (stdio) — no port to configure. It
auto-starts the server on first use if one isn't already running (see
[Local (plugin)](#local-plugin) below).

## Install as Codex plugin

```bash
# 1. Add the marketplace (one time)
codex plugin marketplace add sihekuang/handoff-mcp

# 2. Install the plugin
codex plugin add handoff-mcp@sihekuang
```

The plugin connects the same way as the Claude Code plugin: via `handoff mcp`
(stdio), reading the shared `./.mcp.json` — no port to configure, and the
server auto-starts on first use. To remove: `codex plugin remove
handoff-mcp@sihekuang`.

## Connecting an agent

The server auto-selects a free port on every `handoff start` (or first
`handoff mcp` bridge). Don't hardcode a port — discover it instead:

```bash
handoff url          # prints the MCP endpoint, e.g. http://localhost:54321/mcp
handoff url --json   # {"port":54321,"baseUrl":"...","mcpUrl":"..."}
handoff status       # prints the port of the running server, if any
```

No auth at MVP. There are two supported ways to connect, depending on where
the client and server live:

### Local (plugin)

The bundled plugin config (`plugins/handoff-mcp/.mcp.json`) uses the stdio
transport:

```json
{
  "mcpServers": {
    "handoff": {
      "command": "handoff",
      "args": ["mcp"]
    }
  }
}
```

`handoff mcp` bridges stdio↔HTTP to a local server, auto-starting it if one
isn't already running. No port configuration is needed — this is what the
Claude Code and Codex plugins use out of the box.

### Remote / hosted

For a server running on another host, connect directly over Streamable HTTP
instead of the stdio bridge:

```bash
claude mcp add --transport http handoff https://<your-host>/mcp
```

> **Before exposing a remote endpoint:** this server is unauthenticated at
> MVP (hardcoded `dev_user` actor — see the "What's deferred" section
> below). A publicly-reachable `/mcp` endpoint **must** wire up `better-auth`
> first, or anyone can read/write handoffs. See `docs/decisions.md` and the
> design spec's ["Remote deployment
> prerequisite"](docs/superpowers/specs/2026-07-05-auto-port-and-mcp-transport-design.md#remote-deployment-prerequisite).
> Do not deploy the remote path publicly until that gate is closed.

Connecting with the official MCP SDK directly (e.g. from your own agent
code), against whichever endpoint `handoff url` reports:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-agent", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost:54321/mcp")));

// The server's instructions field carries the handoff skill — agents
// learn the conventions on connect.

const tools = await client.listTools();         // 6 tools
await client.callTool({ name: "create_handoff", arguments: { title, body, ... } });
```

The six tools: `create_handoff`, `list_handoffs`, `get_handoff`, `update_handoff`, `claim_handoff`, `release_handoff`. The discovery convention (in `lib/mcp/skill.ts`): `list_handoffs({ status: "open", claimed: false })` → `get_handoff({ id })` → `claim_handoff({ id, agent })`.

There's also a `handoff://skill` resource (markdown) and a `handoff-help` prompt.

`pnpm dev` still serves the app on port 3000 (fixed, for local app
development) — the auto-port behavior above applies to `handoff start` /
`handoff mcp` (the Homebrew-installed CLI and the standalone build), not to
`next dev`.

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
