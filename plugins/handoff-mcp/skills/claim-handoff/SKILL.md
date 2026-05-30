---
name: claim-handoff
description: Pick up a handoff and start working on it. Use when the user wants to resume work left by another agent, says "claim that handoff" / "pick up <id>" / "what handoffs are open and can you take one".
---

# Claim and work on a handoff

Use this skill to take ownership of an existing handoff and begin (or continue) the work.

## Procedure

1. **Identify the target.**
   - If the user gave a specific handoff ID (e.g. `h_xxxxx`), use it.
   - Otherwise call `list_handoffs({ status: "open", claimed: false })`, show titles + summaries + IDs, and ask the user to pick. If only one matches the context, name it and confirm before claiming.

2. **Read the full body** with `get_handoff({ id })`. Internalize:
   - What was done — don't redo it.
   - What's left — that's your work.
   - Open questions — ask the user before assuming.
   - `metadata.files`, `metadata.git` — the files and ref to resume on.

3. **Claim it.** Call `claim_handoff({ id, agent: "<your-tool-name>" })`. Use:
   - `"claude-code"` if you're Claude Code
   - `"codex"` if you're Codex
   - or whatever identifies you to a human reading the list

4. **Set status to in_progress.** Call `update_handoff({ id, patch: { status: "in_progress" } })`.

5. **Do the work.** Follow the "What's left" steps in order. If you hit something the handoff didn't anticipate, ask the user — don't release silently.

6. **When done**, invoke the `finish-handoff` skill to mark it `done` (and optionally record what you completed).

## Don'ts

- Don't claim a handoff you aren't actually about to work on. Claims signal "I am working on this now" to other agents.
- Don't redo work listed under "What was done."
- Don't `release_handoff` without leaving a note in the body explaining how far you got (use `release-handoff` skill).
