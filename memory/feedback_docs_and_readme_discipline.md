---
name: feedback-docs-and-readme-discipline
description: Before every push or GitHub release, review and update README.md and the in-app help documentation. No em dashes or emojis in either.
metadata:
  type: feedback
---

Before every git push or GitHub release, review README.md and the in-app help documentation (`frontend/src/components/HelpDocs.tsx`) and update both where the content has become inaccurate, incomplete, or missing coverage of new features.

**Why:** The user explicitly requested that documentation always stays current automatically, without having to ask. This is a standing instruction that applies to every session, not just the help-docs feature build.

**How to apply:** As part of the deploy step in any pipeline session (before `git push` and before `gh release create`), read README.md and HelpDocs.tsx, identify any gaps introduced by the current session's changes, and update both files in the same commit. This is non-negotiable -- if the docs are stale, fix them before pushing.

**Style rules (non-negotiable):**
- No em dashes anywhere in README.md or HelpDocs.tsx. Use a period or restructure the sentence.
- No emojis anywhere in README.md or HelpDocs.tsx.
- Write in plain, direct prose. No bold lead-ins. No bullet points for content that reads naturally as sentences.

**Links:** [[feedback-readme-with-changelog]]
