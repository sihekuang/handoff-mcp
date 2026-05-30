---
name: finish-handoff
description: Mark a handoff as done after completing the work it described. Use when the user says "mark it done" / "close out handoff <id>" / after the agent itself has finished the claimed work.
---

# Finish a handoff

Use this skill to close out a handoff whose work is complete.

## Procedure

1. **Identify the target.**
   - If the user gave a specific ID, use it.
   - Otherwise, call `list_handoffs({ status: "in_progress" })` and pick the one claimed by you (matching your `claimedBy` agent string). If multiple match, ask the user which.

2. **Verify the work is actually done.** Read your own session context (or the handoff's acceptance test if it has one) and confirm:
   - All "What's left" items are addressed, or
   - You explicitly noted any that were intentionally skipped.

   If the work isn't actually done, invoke `release-handoff` instead, not this skill.

3. **Optionally append a short completion note** to the handoff body before marking done. Useful when:
   - Acceptance test results (e.g. "all 26 tests pass at commit abc1234").
   - PR/commit URL that fulfilled the work.
   - Anything surprising the next reader should know.

   Patch by reading the current `body` via `get_handoff`, appending under a new `## Result` section, and passing the new body in the patch. Do not overwrite existing sections.

4. **Mark it done.** Call `update_handoff({ id, patch: { status: "done" } })`.

5. **Confirm to the user** with the ID and a one-line summary of what was completed.

## Don'ts

- Don't mark done if the work is partial — use `release-handoff` so another agent can finish it.
- Don't release the claim after marking done; "done + claimedBy=you" preserves the authorship record.
