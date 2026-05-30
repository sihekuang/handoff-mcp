---
name: release-handoff
description: Drop a claim on a handoff so another agent can pick it up. Use when the user says "release that handoff" / "I can't finish this" / or the agent realizes mid-work that someone else needs to take over.
---

# Release a handoff

Use this skill to give up a claim on a handoff that you (or the user) can't or won't finish, so another agent can take over.

## Procedure

1. **Identify the target.**
   - If the user gave a specific ID, use it.
   - Otherwise, call `list_handoffs({ status: "in_progress" })` and pick the one claimed by you. If multiple match, ask the user which.

2. **Append a "Released by ..." note** to the body before releasing. This is required by convention — the next agent needs to know how far you got and why you stepped back. Read the current body via `get_handoff`, append a new section like:

   ```
   ## Released by <your-agent-name> on <iso-date>

   How far we got:
   - <concrete progress, file paths if useful>

   Why released:
   - <one sentence: blocker, scope, time, expertise, etc.>

   What the next agent should know:
   - <gotchas, partial state, intermediate decisions to keep or discard>
   ```

   Patch via `update_handoff({ id, patch: { body: <full new body> } })`. Do not overwrite existing sections.

3. **Release the claim.** Call `release_handoff({ id })`. This clears `claimedBy` and `claimedAt` but preserves status.

4. **Status handling.**
   - If status was `in_progress`, leave it as `in_progress` — that signals "started but stuck."
   - If you're explicitly abandoning rather than handing off, switch it back to `open` with `update_handoff` so it shows up in default browse filters again.

5. **Confirm to the user** with the ID and a one-line summary of why it was released.

## Don'ts

- Don't release without leaving a note. Convention from the umbrella `handoff` skill: "Don't release work without leaving a note in `body` about how far you got."
- Don't release a handoff someone else claimed; only release your own claims.
- Don't mark released handoffs `done` — they aren't done.
