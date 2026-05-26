---
name: feedback-readme-with-changelog
description: Whenever the CHANGELOG is updated, also review and update README.md to reflect any new features or changed instructions
metadata:
  type: feedback
---

Whenever the CHANGELOG is updated, also review README.md and make any necessary changes to keep it accurate.

**Why:** The changelog was updated for the API key settings feature but the README still said keys had to be set manually in the terminal via `.env`. A user following the README would miss the simpler in-app approach entirely.

**How to apply:** After updating CHANGELOG.md as part of any feature or fix, read README.md and check whether any instructions or feature descriptions have become inaccurate or incomplete. Update README.md in the same commit.
