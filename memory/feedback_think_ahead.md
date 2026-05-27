---
name: feedback-think-ahead
description: When making a change, proactively find and fix ALL related places — don't wait to be reminded
metadata:
  type: feedback
---

When changing something (label, format, config pattern), always search for all related references in the entire codebase and update them in the same pass.

**Why:** User had to remind me to also fix a stale `DB_URL` comment in README after switching from DB_URL format to DB_TYPE format. I updated the main sections but missed a comment in the repo structure block.

**How to apply:** Before reporting a change as done, grep for old terminology/patterns to confirm there are no stragglers. This applies to: renamed variables, changed config formats, updated labels, switched defaults.
