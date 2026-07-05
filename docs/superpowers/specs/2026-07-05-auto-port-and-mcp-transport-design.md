# Automatic Port Selection & Local/Remote MCP Transport

## Overview

Today the local `handoff` CLI binds a hardcoded port (`3007`, with a stale `3000` in the help text), and the plugin's `.mcp.json` points at a static `http://localhost:3007/mcp`. If that port is taken, startup collides and there is no fallback.

This change makes the **local** server bind an automatically-selected free port on every start, and reworks the **local** client connection to a stdio bridge (`handoff mcp`) that discovers the running server and proxies to it — so clients never need to know the port. The **deployed/remote** path is unchanged in spirit: a stable public HTTPS URL consumed over native HTTP transport.

The server is a single artifact that always speaks MCP over HTTP at `/mcp`. Only the *client connection config* differs between local and remote.

## Goals

- Local server auto-selects a free port on every start; no manual port config, no collisions.
- Local clients (Claude Code / Codex plugins) connect with zero knowledge of the port, via a stdio bridge.
- A CLI surface (`handoff url`, `handoff status`, `--json`) reports the running server's address for humans and scripts.
- The deployed/remote HTTP path stays first-class and is documented alongside the local path.
- Fix the existing `3007`-vs-`3000` help-text mismatch.

## Non-goals

- Auth for the remote path (better-auth wiring). Flagged as a **prerequisite gate** for public deployment, not built here. See [Remote deployment prerequisite](#remote-deployment-prerequisite).
- Changing the `pnpm dev` developer workflow (still `next dev` on 3000).
- Changing the MCP tool set, DB layer, or web UI.
- A single client command that auto-detects local-vs-remote. Rejected per `docs/decisions.md` (2026-07-05): the established practice is one shared server + two distinct client configs.

## Background: why this shape

Verified facts (see `docs/decisions.md` and the claude-code-guide research):

- Claude Code `.mcp.json` `url` for http/sse transport is a **static string** — no command substitution, no dynamic resolution.
- Env-var expansion (`${VAR}`) is **broken specifically in plugin `.mcp.json`** (Claude Code issue #9427).
- **stdio** transport commands are executed fresh on every connect, and such a command *may* discover a port and bridge to it.

Therefore a randomly-chosen local port is incompatible with a static HTTP `.mcp.json`; stdio is the only viable local transport. A deployed server has a stable URL, so it keeps native HTTP.

## Architecture

```
Local self-host                          Deployed / remote
────────────────                         ─────────────────
Claude Code / Codex                      Claude Code / Codex
      │ stdio                                  │ HTTP
      ▼                                        ▼
handoff mcp  (bridge)                     https://<host>/mcp
      │ HTTP → localhost:<auto-port>/mcp        │
      ▼                                        ▼
Next standalone server.js  ◄── same code ──►  Next app (PORT from platform)
  (127.0.0.1, auto port)                     (0.0.0.0, $PORT, public URL)
```

One server codebase. Local realizes the stdio transport via a bridge because the server is HTTP-native; remote uses HTTP directly.

## Components

### 1. Port selection — `bin/handoff` (`start`)

- **Selection:** if `process.env.PORT` is explicitly set, honor it (override, used by hosts/tests). Otherwise auto-pick: open a throwaway `net.createServer()`, `listen(0, "127.0.0.1")`, read `.address().port`, close it, then spawn `server.js` with that concrete `PORT`. A tiny TOCTOU window remains; acceptable for localhost. If the spawned server dies with `EADDRINUSE`, retry the pick up to N (=5) times.
- **Derive** `BETTER_AUTH_URL` from the chosen port at spawn, as today.
- **`HOSTNAME`** stays `127.0.0.1` (local only).

### 2. Run-state file (replaces the bare PID file)

Replace `handoff.pid` with `handoff.json` in `DATA_DIR`:

```json
{ "pid": 12345, "port": 51872, "startedAt": "<iso>" }
```

- `getState()` reads it and liveness-checks the pid (`process.kill(pid, 0)`), clearing a stale file as `getPid()` does today.
- `start` writes it; `stop` removes it.
- Back-compat: if only a legacy `handoff.pid` exists, treat it as `{pid, port: null}` and let `status`/`url` report "port unknown — restart to refresh."

### 3. Discovery commands

- `handoff url` → prints `http://localhost:<port>/mcp`. `handoff url --json` → `{"baseUrl":"http://localhost:<port>","mcpUrl":".../mcp","port":<port>}`. Non-zero exit if not running.
- `handoff status` → reports pid **and** port (reads the state file).
- `handoff --help` → replace the `PORT default: 3000` line with: "auto-selected free port; set `PORT` to pin one."

### 4. `handoff mcp` — stdio↔HTTP bridge

New subcommand invoked by the local `.mcp.json`. Behavior:

1. **Ensure a server is running.** If `getState()` is live, use its port. Otherwise acquire a start-lock (atomic create of `handoff.start.lock` via `openSync(..., "wx")`, with a stale-lock timeout), start the server on an auto-picked port, wait until `/mcp` (or a health path) answers, then release the lock. Concurrent `handoff mcp` processes (multiple editor sessions) that lose the lock wait for the state file to appear and reuse the same server.
2. **Bridge.** Open a bidirectional JSON-RPC pipe between a stdio server transport and a Streamable-HTTP client transport pointed at `http://localhost:<port>/mcp`, using `@modelcontextprotocol/sdk` (already a dependency). Forward messages both directions verbatim; propagate close/errors so the editor sees a clean disconnect.

The bridge is a thin passthrough — it does not re-implement tools; the Next server remains the single source of truth.

### 5. Client configs

- **Local** — `plugins/handoff-mcp/.mcp.json`:
  ```json
  { "mcpServers": { "handoff": { "command": "handoff", "args": ["mcp"] } } }
  ```
  Shared by both `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`.
- **Remote** — documented in README (no bundled file needed):
  ```
  claude mcp add --transport http handoff https://<host>/mcp
  ```

### 6. Docs

- README: drop hardcoded `:3007` MCP URLs; document auto-port + `handoff url`/`status`; add the remote HTTP section; note the auth gate for public deployment.

## Remote deployment prerequisite

The server currently runs unauthenticated with a hardcoded dev actor (per project memory / MVP). A publicly-reachable MCP endpoint **must** enable `better-auth` (already a dependency) before exposure, or anyone can read/write handoffs. This spec does not implement auth; it records the gate so the remote path is not shipped open.

## Error handling

- Port probe failure / repeated `EADDRINUSE` → exit non-zero with a clear message after N retries.
- `handoff url`/`status` when not running → clear "not running" message, non-zero exit.
- `handoff mcp` when the server fails to become healthy within a timeout → emit an MCP-visible error and exit non-zero so the editor reports the failure.
- Start-lock held but stale (owner died) → break the lock after timeout and proceed.

## Testing

- **Unit:** free-port probe returns a bindable port; state-file read/write + stale-pid clearing; legacy `handoff.pid` back-compat.
- **Integration:** `bin/handoff start` → `handoff url --json` → HTTP GET/POST to the reported `/mcp` succeeds; `handoff stop` clears state.
- **Bridge smoke test:** spawn `handoff mcp`, perform an MCP `initialize` handshake over stdio, assert a tool (`list_handoffs`) round-trips through to the HTTP server.
- **Concurrency:** two `handoff mcp` processes started together yield exactly one server (one state file, one pid).

## Risks / implementation notes

- **ESM vs CJS:** `@modelcontextprotocol/sdk` is ESM; `bin/handoff` is CommonJS. Use dynamic `import()` inside the async `mcp` handler, and confirm the SDK is traced into `.next/standalone/node_modules` by the standalone build (it is used server-side via `mcp-handler`, so it should be). If tracing is unreliable, add an explicit dependency copy in `build:standalone`.
- **Codex loader:** confirm the Codex plugin loader consumes a stdio `.mcp.json` (`command`/`args`) the same way Claude Code does. stdio is generally the more portable transport, so this is expected to work; verify during implementation.
- **TOCTOU:** the probe-then-bind window is unavoidable without binding fd handoff; mitigated by `EADDRINUSE` retry.
- **`handoff` on PATH:** the stdio config assumes the `handoff` bin is on PATH (Homebrew installs it). Local-from-source users run `node bin/handoff`; document that their `.mcp.json` command differs.
