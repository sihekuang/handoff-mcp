# Codex Plugin Design

**Date:** 2026-05-29
**Status:** Implemented
**Author:** Daniel Lee (with Claude)

## Goal

Make `handoff-mcp` installable as a Codex CLI plugin so users can run:

```bash
codex plugin marketplace add sihekuang/handoff-mcp
codex plugin add handoff-mcp@sihekuang
```

— exactly mirroring the existing Claude Code plugin install flow.

## Background — why this replaces the earlier `handoff codex install` attempt

A prior attempt (PR #6, closed) added a `handoff codex install` subcommand to the Homebrew CLI that wrapped `codex mcp add --url`. That approach was wrong-shaped: Codex CLI v0.117.0 (March 2026) introduced a first-class plugin system that bundles skills, MCP servers, and app connectors — the exact analog of Claude Code's plugin marketplace. Codex users install plugins via `codex plugin add`, not via a third-party CLI wrapper. The MCP server's `instructions` field still carries the handoff skill on connect, but the plugin shape is what makes installation feel native.

## The canonical multi-ecosystem layout

Both the official `openai/plugins` reference repo (~120 plugins) and real-world cross-ecosystem plugins (e.g. `EveryInc/compound-engineering-plugin`) use this layout:

```
repo-root/
├── .claude-plugin/marketplace.json    → points to ./plugins/<name>
├── .agents/plugins/marketplace.json   → points to ./plugins/<name>  (Codex)
├── plugins/
│   └── <plugin-name>/
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── skills/<skill>/SKILL.md
│       └── .mcp.json
```

A subdirectory layout is **required** for Codex because of [openai/codex#17066](https://github.com/openai/codex/issues/17066): Codex's marketplace rejects `source.path: "./"` — every variant that resolves to the repository root fails validation. Plugins must live at `./plugins/<name>` (or some other non-root subpath).

Our prior Claude Code plugin shipped at the repo root with `source: "./"`. To support both ecosystems from one repo, we move the plugin contents into a subdirectory and update both marketplaces to point there.

## File changes

### Moved (3 files)

| From | To |
|---|---|
| `.claude-plugin/plugin.json` | `plugins/handoff-mcp/.claude-plugin/plugin.json` |
| `skills/handoff/SKILL.md` | `plugins/handoff-mcp/skills/handoff/SKILL.md` |
| `.mcp.json` | `plugins/handoff-mcp/.mcp.json` |

### Added (2 files)

- `plugins/handoff-mcp/.codex-plugin/plugin.json` — Codex plugin manifest (same shape as the Claude Code manifest)
- `.agents/plugins/marketplace.json` — Codex marketplace catalog

### Modified (2 files)

- `.claude-plugin/marketplace.json` — `"source": "./"` → `"source": "./plugins/handoff-mcp"`
- `README.md` — add "Install as Codex plugin" section after the existing "Install as Claude Code plugin"

## Manifest contents

### `plugins/handoff-mcp/.codex-plugin/plugin.json`

```json
{
  "name": "handoff-mcp",
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

Field source: [Codex plugin manifest spec](https://developers.openai.com/codex/plugins/build). `name`, `version`, `description` are required; `skills` and `mcpServers` are path pointers; the rest is publisher metadata.

### `.agents/plugins/marketplace.json`

```json
{
  "name": "sihekuang",
  "interface": { "displayName": "Daniel Lee's Codex plugins" },
  "plugins": [
    {
      "name": "handoff-mcp",
      "source": { "source": "local", "path": "./plugins/handoff-mcp" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

`source` uses the object form with `source: "local"` and `path` pointing at the plugin subdirectory. `policy` is required: `installation: "AVAILABLE"` makes the plugin installable on demand (vs. `INSTALLED_BY_DEFAULT` or `NOT_AVAILABLE`); `authentication: "ON_INSTALL"` matches the convention used by every plugin in `openai/plugins`.

## Shared resources (zero duplication)

The moved `skills/handoff/SKILL.md` and `.mcp.json` are consumed unchanged by both ecosystems:

- **SKILL.md frontmatter** — `name` + `description` fields are the same in both Claude Code and Codex.
- **`.mcp.json`** — Codex accepts the camelCase `mcpServers` key our file already uses (verified live: `codex plugin add handoff-mcp@sihekuang` auto-registered the server as `handoff` with the correct URL).

## Verification (live, against Codex CLI 0.135.0)

Performed during implementation:

1. `codex plugin marketplace add .` — exits 0, prints `Added marketplace 'sihekuang' from <repo>`.
2. `codex plugin list` — shows `handoff-mcp@sihekuang  not installed`.
3. `codex plugin add handoff-mcp@sihekuang` — exits 0, prints `Added plugin 'handoff-mcp' from marketplace 'sihekuang'. Installed plugin root: ~/.codex/plugins/cache/sihekuang/handoff-mcp/0.3.0`.
4. `codex plugin list` — now shows `handoff-mcp@sihekuang  installed, enabled  0.3.0`.
5. `codex mcp list` — shows `handoff  http://localhost:3007/mcp  enabled` (auto-registered from the plugin's `.mcp.json`).
6. `~/.codex/config.toml` — contains `[plugins."handoff-mcp@sihekuang"] enabled = true`.

For the Claude Code plugin: `claude plugin validate plugins/handoff-mcp/` passes.

## Breakage notes

Anyone who had previously installed the Claude Code plugin needs to re-add the marketplace (`/plugin marketplace update sihekuang` or remove/re-add) to pick up the new source path. Since the Claude Code plugin shipped only a few days before this change, impact is essentially nil.

## Explicitly out of scope (YAGNI)

- **No `bin/handoff codex install` wrapper.** Codex's native `codex plugin add` is the right install mechanism. The earlier wrapper attempt (PR #6) was tearing down a wall to install a doorbell.
- **No AGENTS.md injection.** The MCP `instructions` field already carries the skill on connect; same delivery path as the Claude Code plugin's SKILL.md.
- **No symlinks or file duplication.** Subdirectory layout is the canonical pattern.
- **No Cursor or other ecosystems.** Same multi-ecosystem layout supports adding `.cursor-plugin/plugin.json` later, but YAGNI for now.

## Sources

- [Codex plugin spec — Build plugins](https://developers.openai.com/codex/plugins/build)
- [openai/plugins reference repo](https://github.com/openai/plugins)
- [Codex issue #17066 — `"./"` rejected at marketplace root](https://github.com/openai/codex/issues/17066)
- [EveryInc/compound-engineering-plugin — multi-ecosystem reference](https://github.com/EveryInc/compound-engineering-plugin)
