# Claude Code Plugin for handoff-mcp

## Overview

Package handoff-mcp as a Claude Code plugin so that Claude automatically learns the handoff workflow and connects to the MCP server. Phase 1 targets a locally-running server; phase 2 adds cloud hosting and auth.

## Goals

- Zero-friction handoff workflow for Claude Code users
- Skill auto-invokes when context is handoff-relevant (ending sessions, switching tools, picking up work)
- No changes to the existing Next.js app or Homebrew distribution
- Plugin installs via `/plugin install handoff-mcp@sihekuang/handoff-mcp`

## Non-goals (phase 1)

- Cloud hosting / Vercel deploy
- Auth (API keys, OAuth, Better Auth wiring)
- Remote server URL configuration (`userConfig`)
- Homebrew deprecation

## Architecture

The plugin is a thin client that lives alongside the existing Next.js app in the same repo. It adds three files:

```
handoff-mcp/
├── .claude-plugin/
│   └── plugin.json              # plugin manifest
├── skills/
│   └── handoff/
│       └── SKILL.md             # handoff workflow skill
├── .mcp.json                    # remote MCP server connection
│
├── app/                         # existing (unchanged)
├── lib/                         # existing (unchanged)
├── Formula/                     # existing (unchanged)
└── ...
```

The plugin does not bundle or start a server. It connects to a server the user is already running locally.

## New files

### `.claude-plugin/plugin.json`

Plugin manifest with metadata, skill reference, and MCP server reference.

```json
{
  "name": "handoff-mcp",
  "displayName": "Handoff",
  "version": "0.3.0",
  "description": "Create, browse, and claim handoff documents so agents can pick up where others left off.",
  "author": { "name": "Daniel Lee" },
  "repository": "https://github.com/sihekuang/handoff-mcp",
  "license": "MIT",
  "keywords": ["handoff", "agent", "collaboration"],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

Version bumps to 0.3.0 to reflect the new distribution channel.

### `.mcp.json`

Connects Claude Code to the locally-running handoff server over Streamable HTTP.

```json
{
  "mcpServers": {
    "handoff": {
      "url": "http://localhost:3007/mcp"
    }
  }
}
```

No auth headers in phase 1. The server runs unauthenticated with `DEV_ACTOR`.

### `skills/handoff/SKILL.md`

Frontmatter:

```yaml
---
name: handoff
description: Create, browse, and claim handoff documents so agents can pick up where others left off. Use when ending a session, switching tools, or leaving work for a teammate.
---
```

Body content:

1. **When to invoke** section -- Claude Code-specific triggers:
   - User says "save context", "hand off", "leave a handoff", "pick up where I left off"
   - User is ending a session with unfinished work
   - User asks to switch to another tool (Cursor, Copilot, etc.)
   - User asks what handoffs are available or what work is pending

2. **When NOT to invoke** section:
   - Normal development work with no handoff intent
   - No in-flight work to hand off

3. **Handoff workflow** -- extracted from `lib/mcp/skill.ts` (`DEFAULT_SKILL`):
   - When to create a handoff
   - Discovery convention (list -> get -> claim)
   - Writing a good handoff (body structure, metadata)
   - Finishing/releasing handoffs

The skill replaces the MCP server's `instructions` field as the primary way Claude learns the handoff conventions. The `instructions` field on the server can remain for non-plugin clients.

## User flow

1. User installs the server: `brew install handoff-mcp` (or runs `pnpm dev`)
2. User starts the server: `handoff start` (or `brew services start handoff-mcp`)
3. User installs the plugin: `/plugin install handoff-mcp@sihekuang/handoff-mcp`
4. Claude Code auto-discovers the skill and MCP tools
5. When the user ends a session or says "hand this off", Claude invokes the skill and creates a handoff via the MCP tools
6. In a new session, Claude can list and claim open handoffs

## Existing code changes

None. The three new files are additive. The Next.js app, MCP route, Homebrew formula, service layer, and tests are unchanged.

## Phase 2 (future)

- Deploy the Next.js app to Vercel or similar cloud host
- Add API key auth: `api_keys` table, middleware on MCP route, settings UI for key generation
- Add `userConfig` to `plugin.json` for `server_url` and `api_key`
- Update `.mcp.json` to use `${HANDOFF_SERVER_URL}` with hosted default
- Deprecate Homebrew as the primary distribution (keep for offline/local use)
