---
name: list-handoffs
description: Browse handoffs to see what's available, in progress, or done. Use when the user asks "what handoffs are open" / "show me my handoffs" / "any unfinished work to pick up".
---

# List handoffs

Use this skill to give the user a quick view of handoffs they can browse, claim, or follow up on.

## Procedure

1. **Pick filters from the user's intent.** Default is `{ status: "open", claimed: false }` — the "available work" view.
   Override based on what they asked:
   - "what's in progress" → `{ status: "in_progress" }`
   - "what did I/we finish" → `{ status: "done" }`
   - "handoffs in <project>" → `{ project: "<project>" }`
   - "anything tagged X" → `{ tag: "X" }`
   - free-text search → `{ query: "<terms>" }`

2. **Call `list_handoffs`** with the chosen filters. Use the default limit (25) unless the user wants more.

3. **Render a compact table** for the user, one row per handoff:

   ```
   <id>  <status>  <claimed-by or "—">  <title>
                                        <summary, truncated to ~100 chars>
   ```

   Use the short ID form (the full `h_xxxxx`). Sort by `updatedAt` desc (the server returns them in that order already).

4. **If `nextCursor` is set**, mention there's more and offer to fetch the next page on request.

5. **Offer next actions** in one line: e.g. `Run /claim-handoff <id>` (or `$claim-handoff <id>` in Codex) to take one.

## Don'ts

- Don't call `get_handoff` for each row — `list_handoffs` returns the summary already, and full bodies waste tokens.
- Don't auto-claim. Browsing is read-only.
