---
name: create-handoff
description: Capture in-flight work as a handoff document so another agent (or future you) can resume cleanly. Use when the user is ending a session mid-task, switching tools, or asks to "save context" / "leave a handoff" / "hand off this work".
---

# Create a handoff

Use this skill to leave a self-contained record of in-flight work that another agent can pick up later.

## Procedure

1. **Confirm scope.** If the user only said "leave a handoff," summarize what you understand the in-flight work to be (one sentence) and let them correct you before writing the body. Skip this if the user already named the task.

2. **Assemble the body** as markdown with this structure (omit any section that's genuinely empty):

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

3. **Set metadata** for discoverability:
   - `project` — a slug the next agent can filter on (e.g. the repo name or feature name).
   - `tags` — short labels (e.g. `["bug", "auth"]`).
   - `metadata.git` — `{ repo, branch, commit, prUrl }` if there's a repo in scope. Read these from `git` if available, don't fabricate.
   - `metadata.files` — `[{ path, note }]` for files touched.

4. **Call `create_handoff`** with `{ title, body, summary, project, tags, metadata, status: "open" }`. Keep `title` action-oriented and under ~80 chars; `summary` ≤ 500 chars, written so a skimmer knows whether to claim it.

5. **Report the new handoff's ID back to the user** so they can pass it to the next session. Mention the suggested pickup command:
   - In Claude Code: `/claim-handoff <id>`
   - In Codex: `$claim-handoff <id>`

## Don'ts

- Don't claim the handoff you just created.
- Don't set status to anything other than `open` on creation.
- Don't include secrets, tokens, or credentials in `body` or `metadata`.
