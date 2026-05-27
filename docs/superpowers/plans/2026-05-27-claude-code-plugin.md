# Claude Code Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three files to the repo so handoff-mcp can be installed as a Claude Code plugin.

**Architecture:** Thin-client plugin — `.claude-plugin/plugin.json` manifest, `skills/handoff/SKILL.md` skill file, and `.mcp.json` remote MCP config pointing at `localhost:3007`. No changes to existing files.

**Tech Stack:** Claude Code plugin system (JSON manifest + markdown skills)

**Spec:** `docs/superpowers/specs/2026-05-27-claude-code-plugin-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `.claude-plugin/plugin.json` | Create | Plugin manifest — metadata, skill/MCP references |
| `skills/handoff/SKILL.md` | Create | Handoff workflow skill for Claude Code |
| `.mcp.json` | Create | Streamable HTTP connection to local server |

No existing files are modified.

---

### Task 1: Create `.mcp.json`

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Create the MCP server config**

```json
{
  "mcpServers": {
    "handoff": {
      "url": "http://localhost:3007/mcp"
    }
  }
}
```

Write this to `.mcp.json` at the repo root.

- [ ] **Step 2: Verify the file is valid JSON**

Run: `python3 -c "import json; json.load(open('.mcp.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .mcp.json
git commit -m "feat: add .mcp.json for Claude Code plugin MCP connection"
```

---

### Task 2: Create `.claude-plugin/plugin.json`

**Files:**
- Create: `.claude-plugin/plugin.json`

- [ ] **Step 1: Create the plugin manifest directory**

```bash
mkdir -p .claude-plugin
```

- [ ] **Step 2: Create the plugin manifest**

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

Write this to `.claude-plugin/plugin.json`.

- [ ] **Step 3: Verify the file is valid JSON**

Run: `python3 -c "import json; json.load(open('.claude-plugin/plugin.json')); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat: add plugin.json manifest for Claude Code"
```

---

### Task 3: Create `skills/handoff/SKILL.md`

**Files:**
- Create: `skills/handoff/SKILL.md`
- Reference (read-only): `lib/mcp/skill.ts` — source of the `DEFAULT_SKILL` content

- [ ] **Step 1: Create the skills directory**

```bash
mkdir -p skills/handoff
```

- [ ] **Step 2: Write the skill file**

Create `skills/handoff/SKILL.md` with this exact content:

````markdown
---
name: handoff
description: Create, browse, and claim handoff documents so agents can pick up where others left off. Use when ending a session, switching tools, or leaving work for a teammate.
---

## When to invoke this skill

- The user says "save context", "hand off", "leave a handoff", "pick up where I left off"
- The user is ending a session with unfinished work
- The user asks to switch to another tool (Cursor, Copilot, etc.)
- The user asks what handoffs are available or what work is pending

## When NOT to invoke

- The user is doing normal development work with no handoff intent
- There is no in-flight work to hand off

## Handoff service

You can create, browse, and claim **handoff documents** that describe in-flight work, so another agent (or another session, or a human) can pick the work up later.

### When to create a handoff

- You're ending a session with work still in progress.
- You're about to switch tools (e.g., Claude Code → Cursor) mid-task.
- The user has explicitly asked you to leave one for a teammate or future you.

### Picking up work from someone else

1. `list_handoffs({ status: "open", claimed: false })` — browse summaries.
2. `get_handoff({ id })` — read the full body of any candidate.
3. `claim_handoff({ id, agent: "<your-tool-name>" })` — once you've committed to working on it.

When you finish, call `update_handoff({ id, patch: { status: "done" } })`. If you can't finish, call `release_handoff({ id })` so another agent can pick it up.

### Writing a good handoff

Use clear markdown in `body`. Recommended structure:

```
## What was done
- decisions and completed work, with file paths and short snippets if useful
- list significant commits or PRs

## What's left
- concrete, ordered next steps
- each step should be doable without re-derivation

## Open questions
- anything you couldn't resolve alone
- options you considered and why you didn't pick them
```

Set:
- `project` and `tags` so the next agent can filter.
- `metadata.git` (`{ repo, branch, commit, prUrl }`) so they can resume on the right ref.
- `metadata.files` (`[{ path, note }]`) for files you've touched.

### Discovery convention

Agents share one space per user. Don't claim work you aren't ready to do. Don't release work without leaving a note in `body` about how far you got.
````

- [ ] **Step 3: Verify the frontmatter parses**

Run: `head -4 skills/handoff/SKILL.md`
Expected:
```
---
name: handoff
description: Create, browse, and claim handoff documents so agents can pick up where others left off. Use when ending a session, switching tools, or leaving work for a teammate.
---
```

- [ ] **Step 4: Commit**

```bash
git add skills/handoff/SKILL.md
git commit -m "feat: add handoff skill for Claude Code plugin"
```

---

### Task 4: Smoke test the plugin structure

No new files. This validates the three files work together.

- [ ] **Step 1: Verify plugin structure**

Run:
```bash
echo "=== plugin.json ===" && cat .claude-plugin/plugin.json | python3 -m json.tool && echo "=== .mcp.json ===" && cat .mcp.json | python3 -m json.tool && echo "=== SKILL.md frontmatter ===" && head -4 skills/handoff/SKILL.md
```

Expected: both JSON files pretty-print without errors, skill frontmatter shows the `name` and `description` fields.

- [ ] **Step 2: Verify plugin.json references resolve**

Run:
```bash
python3 -c "
import json, os
p = json.load(open('.claude-plugin/plugin.json'))
skills_dir = p['skills'].lstrip('./')
mcp_file = p['mcpServers'].lstrip('./')
assert os.path.isdir(skills_dir), f'skills dir not found: {skills_dir}'
assert os.path.isfile(mcp_file), f'mcp file not found: {mcp_file}'
print('All references resolve OK')
"
```

Expected: `All references resolve OK`

- [ ] **Step 3: Validate the plugin (if Claude Code is available)**

Run: `claude plugin validate . 2>&1 || echo "claude CLI not available, skipping"`

Expected: either validation passes, or the CLI isn't installed (both are fine for now).

- [ ] **Step 4: Update README with plugin install instructions**

In `README.md`, add a new section after the "Install via Homebrew" section:

```markdown
## Install as Claude Code plugin

```bash
/plugin install handoff-mcp@sihekuang/handoff-mcp
```

Requires the server running locally (`brew services start handoff-mcp` or `pnpm dev`). The plugin adds a handoff skill and connects Claude Code to the MCP server at `http://localhost:3007/mcp`.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add Claude Code plugin install instructions to README"
```
