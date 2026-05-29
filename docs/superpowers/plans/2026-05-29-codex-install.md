# Codex Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `handoff codex install` / `handoff codex uninstall` subcommands that wrap `codex mcp add`/`remove`, and document both the wrapper and native commands in the README.

**Architecture:** Add a `codex` command group to the existing `bin/handoff` Node CLI. Both subcommands shell out to the user's `codex` binary using `child_process.spawnSync` with inherited stdio, so Codex's output flows directly to the user's terminal. No new dependencies, no new files.

**Tech Stack:** Node.js (CommonJS, matches existing `bin/handoff`), `child_process.spawnSync`. No tests beyond manual smoke tests against the real `codex` CLI (the project's existing `bin/handoff` has no unit tests; adding test infrastructure for a ~30-line wrapper is YAGNI given the integration is what matters and we've already verified Codex CLI 0.135.0 behavior live).

**Spec reference:** `docs/superpowers/specs/2026-05-29-codex-install-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `bin/handoff` | Modify | Add `codex install` / `codex uninstall` subcommands + help text |
| `README.md` | Modify | Add "Install for Codex" section |

That's it. The wrapper is small enough to live alongside the existing `start`/`stop`/`status`/`logs` commands in `bin/handoff`.

---

## Task 1: Add `codex install` and `codex uninstall` subcommands

**Files:**
- Modify: `bin/handoff` (add a `runCodex` helper, a `codex(sub)` dispatcher, and `case "codex":` to the main switch)

The current `bin/handoff` is a flat switch on `process.argv[2]`. We're adding one more case that dispatches on `process.argv[3]` for the subcommand.

- [ ] **Step 1: Define the smoke test procedure**

Before any code changes, write down the exact verification we'll run. Save this in a scratch note (no file needed) — these are the commands the next step expects to fail and the last step expects to succeed:

```bash
# Baseline: confirm handoff is NOT registered with Codex
codex mcp list | grep -q "^handoff " && echo "FAIL: handoff already registered" || echo "OK: baseline clean"

# Test 1: install
./bin/handoff codex install
# Expected: prints "Added global MCP server 'handoff'." then "Make sure the server is running..."
# Expected exit: 0

# Test 2: re-install (idempotency)
./bin/handoff codex install
# Expected: same output as Test 1
# Expected exit: 0

# Test 3: verify config.toml
grep -A 1 "^\[mcp_servers.handoff\]" ~/.codex/config.toml
# Expected:
#   [mcp_servers.handoff]
#   url = "http://localhost:3007/mcp"

# Test 4: verify codex sees it
codex mcp get handoff
# Expected: shows url http://localhost:3007/mcp

# Test 5: uninstall
./bin/handoff codex uninstall
# Expected: "Removed global MCP server 'handoff'."
# Expected exit: 0

# Test 6: re-uninstall (idempotency)
./bin/handoff codex uninstall
# Expected: "No MCP server named 'handoff' found."
# Expected exit: 0

# Test 7: PORT env var override
PORT=9999 ./bin/handoff codex install
codex mcp get handoff
# Expected url: http://localhost:9999/mcp

# Cleanup
./bin/handoff codex uninstall
```

- [ ] **Step 2: Run Tests 1 and 5 to verify they fail (no commands exist yet)**

```bash
./bin/handoff codex install
```

Expected output (something like):
```
handoff-mcp — AI agent handoff server

Usage:
  handoff start    Start the server in the background
  ...
```

That is, the script prints help and exits because `"codex"` isn't a recognized case. Confirmed: the subcommand is not yet implemented.

- [ ] **Step 3: Implement the `codex` subcommand in `bin/handoff`**

Add the following two functions and one switch case to `bin/handoff`. Place the `runCodex` helper and `codex` function above the main `switch (cmd)` block (i.e., after the existing `logs()` function on line 98, before line 100). Add the new switch case inside the existing switch.

After the `logs()` function and before `switch (cmd) {`:

```javascript
function runCodex(args) {
  const result = spawnSync("codex", args, { stdio: "inherit" });
  if (result.error && result.error.code === "ENOENT") {
    console.error("Codex CLI not found on PATH.");
    console.error("Install it from https://developers.openai.com/codex/ and try again.");
    process.exit(1);
  }
  return result.status ?? 1;
}

function codex(sub) {
  switch (sub) {
    case "install": {
      const code = runCodex([
        "mcp",
        "add",
        "handoff",
        "--url",
        `http://localhost:${PORT}/mcp`,
      ]);
      if (code === 0) {
        console.log("");
        console.log("Make sure the server is running:");
        console.log("  handoff start   (or: brew services start handoff-mcp)");
      }
      process.exit(code);
    }
    case "uninstall": {
      const code = runCodex(["mcp", "remove", "handoff"]);
      process.exit(code);
    }
    default:
      console.error(`Unknown codex subcommand: ${sub ?? "(none)"}`);
      console.error("Usage: handoff codex install | handoff codex uninstall");
      process.exit(2);
  }
}
```

Then add `spawnSync` to the existing destructured import on line 3. Change:

```javascript
const { spawn, execSync } = require("node:child_process");
```

to:

```javascript
const { spawn, spawnSync, execSync } = require("node:child_process");
```

Add the new case inside the existing `switch (cmd)` block, before `default:`:

```javascript
  case "codex":
    codex(process.argv[3]);
    break;
```

- [ ] **Step 4: Run the full smoke test from Step 1**

Execute every command in the smoke test procedure in order and verify each matches its expected output / exit code. If any test fails, fix the implementation and re-run from Test 1.

Pay particular attention to:
- Tests 2 and 6 (idempotency): both should exit 0.
- Test 7 (PORT override): `codex mcp get handoff` should show `http://localhost:9999/mcp` after `PORT=9999 ./bin/handoff codex install`.

- [ ] **Step 5: Run pre-flight failure test**

Temporarily prove the "Codex not on PATH" path works. Override `PATH` to exclude codex's location:

```bash
PATH=/usr/bin:/bin ./bin/handoff codex install
```

Expected output:
```
Codex CLI not found on PATH.
Install it from https://developers.openai.com/codex/ and try again.
```

Expected exit: 1.

- [ ] **Step 6: Commit**

```bash
git add bin/handoff
git commit -m "feat: add handoff codex install/uninstall subcommands

Wrap codex mcp add/remove with PORT env var autodetection and a
Codex-not-on-PATH pre-flight check. Both subcommands inherit stdio so
Codex's own output reaches the user verbatim, and both are idempotent
(re-install silently overwrites, re-uninstall is a no-op)."
```

---

## Task 2: Update CLI help text

**Files:**
- Modify: `bin/handoff` (the `default:` case in the main switch — the help string)

- [ ] **Step 1: Define the test**

```bash
./bin/handoff
```

Expected: the help text includes a "codex install" and "codex uninstall" line in the Usage section.

- [ ] **Step 2: Run the test to verify it fails**

Run the command above. Confirm the current help text does NOT mention `codex` (it stops at `handoff logs`).

- [ ] **Step 3: Update the help text**

In `bin/handoff`, modify the multi-line template literal inside the `default:` case. The current Usage section reads:

```
Usage:
  handoff start    Start the server in the background
  handoff stop     Stop the server
  handoff status   Check if the server is running
  handoff logs     Tail the server logs
```

Replace with:

```
Usage:
  handoff start             Start the server in the background
  handoff stop              Stop the server
  handoff status            Check if the server is running
  handoff logs              Tail the server logs
  handoff codex install     Register the MCP server with Codex CLI
  handoff codex uninstall   Remove the handoff entry from Codex's MCP config
```

(Column alignment changed because the new commands are wider — keep all the lines aligned to the longest command `handoff codex uninstall`.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
./bin/handoff
```

Expected: the new `codex install` and `codex uninstall` lines appear in the Usage section, all columns are aligned to `handoff codex uninstall`.

- [ ] **Step 5: Commit**

```bash
git add bin/handoff
git commit -m "docs: surface codex install/uninstall in handoff CLI help"
```

---

## Task 3: Add "Install for Codex" section to README

**Files:**
- Modify: `README.md` (add a new section after "Install as Claude Code plugin")

- [ ] **Step 1: Define the test**

Visual review: after the edit, the README should have a "## Install for Codex" section between "## Install as Claude Code plugin" and "## Connecting an agent". The section shows both the branded wrapper and the native `codex mcp add` command.

- [ ] **Step 2: Verify current state**

```bash
grep -n "^## " /Users/daniel/Documents/Projects/handoff-mcp/README.md
```

Confirm there is currently no "Install for Codex" section.

- [ ] **Step 3: Add the new section**

In `README.md`, insert the following block immediately after the "Install as Claude Code plugin" section ends (after the paragraph that begins "Requires the server running locally...", currently around line 66) and before "## Connecting an agent":

```markdown
## Install for Codex

```bash
# Branded (uses the handoff CLI from Homebrew)
handoff codex install

# Or natively
codex mcp add handoff --url http://localhost:3007/mcp
```

Requires the server running locally (`brew services start handoff-mcp` or `pnpm dev`). The MCP server's `instructions` field carries the handoff skill — Codex agents learn the conventions automatically on connect. To remove: `handoff codex uninstall` (or `codex mcp remove handoff`).
```

(Note: the inner code fence uses three backticks; if your editor strips them, copy from the spec file at `docs/superpowers/specs/2026-05-29-codex-install-design.md` which has the same block.)

- [ ] **Step 4: Verify the section was added**

```bash
grep -n "^## " /Users/daniel/Documents/Projects/handoff-mcp/README.md
```

Expected: `## Install for Codex` appears in the list, between `## Install as Claude Code plugin` and `## Connecting an agent`.

Also visually scan the section in the README to confirm the code blocks render and the prose paragraph is intact.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add Install for Codex section to README"
```

---

## Final verification

After all three tasks are complete, run one end-to-end pass:

- [ ] **Step 1: Full smoke test from a clean state**

```bash
# Clean baseline
codex mcp remove handoff 2>/dev/null

# Install via wrapper
./bin/handoff codex install
# Expected: success message + "Make sure the server is running" reminder

# Verify Codex sees it
codex mcp get handoff
# Expected: url http://localhost:3007/mcp

# Test it actually works end-to-end (requires server running)
handoff start  # or pnpm dev in another terminal
# In a Codex session, ask: "what handoff tools do you have?"
# Expected: agent lists create_handoff, list_handoffs, get_handoff,
# update_handoff, claim_handoff, release_handoff and references the
# discovery convention (list → get → claim).

# Uninstall via wrapper
./bin/handoff codex uninstall
# Expected: "Removed global MCP server 'handoff'."

# Re-verify uninstall is idempotent
./bin/handoff codex uninstall
# Expected: "No MCP server named 'handoff' found."
```

- [ ] **Step 2: Confirm help text**

```bash
./bin/handoff
```

Expected: Usage section includes the two new `codex` lines.

- [ ] **Step 3: Confirm README**

Open `README.md` in a markdown previewer (or `gh` browser view after push) and confirm the new section reads well and the code blocks render.

If all three checks pass, the feature is done. Hand off to `superpowers:finishing-a-development-branch` to decide on merge/PR.
