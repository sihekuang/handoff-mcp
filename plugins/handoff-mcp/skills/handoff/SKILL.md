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
