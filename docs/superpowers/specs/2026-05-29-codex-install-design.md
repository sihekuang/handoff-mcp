# Codex Install Design

**Date:** 2026-05-29
**Status:** Approved
**Author:** Daniel Lee (with Claude)

## Goal

Make `handoff-mcp` installable for [OpenAI Codex CLI](https://developers.openai.com/codex/) with a single command, parallel to the existing Claude Code plugin install flow. A Codex agent should reach the same six handoff tools and the same skill conventions a Claude Code agent does.

## Background

Today the project supports two install paths:

- **Homebrew:** `brew install sihekuang/handoff-mcp/handoff-mcp` → runs the server.
- **Claude Code plugin:** `/plugin marketplace add sihekuang/handoff-mcp` then `/plugin install handoff-mcp@sihekuang` → registers the MCP server URL and ships a `skills/handoff/SKILL.md` so the agent learns the conventions.

Codex CLI supports MCP servers natively but has no plugin marketplace, no skill concept. The user wants the Codex install to feel symmetric with the Claude Code plugin install.

## What Codex already gives us

Research (see Sources) confirms:

1. **Native HTTP MCP support.** `codex mcp add <name> --url <url>` registers a Streamable HTTP MCP server and writes it to `~/.codex/config.toml`. No project-level scoping needed; user-level is the parallel to Claude Code's global plugin install.

2. **`instructions` field is auto-surfaced.** Codex reads the MCP `instructions` field returned during initialization and uses it as "server-wide guidance alongside the server's tools." Our server already emits the handoff skill in `instructions` (via `lib/mcp/skill.ts` → `DEFAULT_SKILL`), so a Codex agent that connects to our MCP server gets the same conventions a Claude Code plugin skill would.

3. **`codex mcp remove <name>`** is the symmetric uninstall.

This means the Codex-native one-liner already exists:

```bash
codex mcp add handoff --url http://localhost:3007/mcp
```

The design's job is to provide a branded wrapper for symmetry and to document both paths.

## Architecture

Add a `codex` subcommand group to the existing `bin/handoff` CLI (the Homebrew-installed Node script). Underneath, shell out to `codex mcp ...`. Update the README to show both the branded wrapper and the native command.

```
handoff codex install     →  codex mcp add handoff --url http://localhost:${PORT}/mcp
handoff codex uninstall   →  codex mcp remove handoff
```

## Components

### 1. `bin/handoff codex install`

**Behavior:**

1. **Pre-flight:** Check that `codex` is on `PATH`. If not, print:
   ```
   Codex CLI not found on PATH. Install it from https://developers.openai.com/codex/ and try again.
   ```
   Exit 1.

2. **Run:** `codex mcp add handoff --url http://localhost:${PORT}/mcp`
   - `PORT` reads from `process.env.PORT`, defaulting to `3007` — same source as the rest of the CLI.
   - Verified behavior (Codex CLI 0.135.0, 2026-05-29): the command is idempotent — re-adding the same name silently overwrites and exits 0. There is no "already exists" error path to special-case.

3. **On success (the only success path):** Codex prints `Added global MCP server 'handoff'.` and exits 0. Append our own reminder:
   ```
   Make sure the server is running: handoff start  (or: brew services start handoff-mcp)
   ```

4. **On Codex failure:** Surface Codex's stdout/stderr verbatim, exit with Codex's exit code. (In practice the only realistic failure is Codex itself being broken or `~/.codex/` being unwritable — there is no "wrong arguments" path once the wrapper supplies a valid URL.)

### 2. `bin/handoff codex uninstall`

**Behavior:**

1. Run: `codex mcp remove handoff`.
2. Surface stdout/stderr verbatim.
3. Exit with Codex's exit code.

Verified behavior (Codex CLI 0.135.0, 2026-05-29): `remove` is idempotent — removing a non-existent server prints `No MCP server named 'handoff' found.` and exits 0. No special-casing needed.

No pre-flight needed beyond Codex-on-PATH (handled by failure passthrough).

### 3. CLI help text

Add to the `default:` case in `bin/handoff`:

```
  handoff codex install    Register the MCP server with Codex CLI
  handoff codex uninstall  Remove the handoff entry from Codex's MCP config
```

### 4. README "Install for Codex" section

Sibling to the existing "Install as Claude Code plugin" section. Two paths shown, equivalent:

```markdown
## Install for Codex

```bash
# Branded (uses the handoff CLI from Homebrew)
handoff codex install

# Or natively
codex mcp add handoff --url http://localhost:3007/mcp
```

Requires the server running locally (`brew services start handoff-mcp` or `pnpm dev`).
The MCP server's `instructions` field carries the handoff skill — Codex agents
learn the conventions automatically on connect.
```

## Data flow

```
User runs `handoff codex install`
  ↓
bin/handoff spawns: codex mcp add handoff --url http://localhost:3007/mcp
  ↓
Codex CLI writes to ~/.codex/config.toml:
  [mcp_servers.handoff]
  url = "http://localhost:3007/mcp"
  ↓
Later, user starts a Codex session
  ↓
Codex connects to http://localhost:3007/mcp (Streamable HTTP)
  ↓
Server returns initialization response with `instructions` (the handoff skill)
  ↓
Codex surfaces both the six tools and the skill to the model
```

## Error handling

| Failure mode | Behavior |
|---|---|
| `codex` not on PATH | Print install link, exit 1 |
| `codex mcp add` fails (write error, broken Codex, etc.) | Surface its stdout/stderr verbatim, exit with its code |
| Re-running install when already registered | Codex silently overwrites and exits 0; we treat as success |
| Server not running at install time | Not our problem — Codex registers the URL regardless. Install message reminds user to start the server. |
| `codex mcp remove` on non-existent entry | Codex prints a friendly message and exits 0; we treat as success |

## Testing

Manual smoke test (no automated test — we'd just be mocking `child_process.spawn`):

1. Ensure `codex` CLI is installed and Codex's config is in a known state (`codex mcp list`).
2. Run `handoff codex install`. Expect success message.
3. Run `codex mcp get handoff --json`. Expect the URL `http://localhost:3007/mcp`.
4. Start the server (`handoff start` or `pnpm dev`).
5. Run a Codex session. Verify the agent lists the six handoff tools and references the skill conventions when asked about handoffs.
6. Run `handoff codex uninstall`. Verify `codex mcp get handoff` errors.

A second smoke test for the idempotency path: run `handoff codex install` twice and `handoff codex uninstall` twice; all four invocations should exit 0.

## Explicitly out of scope (YAGNI)

- **`~/.codex/AGENTS.md` injection.** Codex surfaces our MCP `instructions` on every connection, so the skill content already reaches the model. Writing to global AGENTS.md would force handoff conventions onto every Codex project — not desired.
- **Project-level `.codex/config.toml`.** User-level config is the parallel to Claude Code's global plugin install. Per-project would be a separate feature.
- **OAuth / `bearer_token_env_var`.** Auth is deferred at MVP for the whole project; no token to pass.
- **Custom transport headers (`http_headers`).** Not needed for unauthenticated local server.
- **Other clients (Cursor, Cline, Windsurf).** Each would be a separate sub-project. Codex first.

## Sources

- [Codex MCP Configuration](https://developers.openai.com/codex/mcp)
- [Codex CLI Reference — `codex mcp` subcommands](https://developers.openai.com/codex/cli/reference)
- [Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)
