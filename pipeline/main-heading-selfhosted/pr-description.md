# main-heading-selfhosted

## What this does
Swaps the app's main tagline from "Birding tools for your eBird workflow" to
"Self-hosted birding tools and data explorer" in the three lockstep sites: the
tagline `<p>` under the SnowRaven title in `frontend/src/App.tsx`, the two
literal-phrase regex anchors (plus the quoting comment) in
`frontend/src/lib/iosChrome.test.ts`, and the `website/index.html` footer,
which echoes the tagline verbatim per the site/app copy-sync convention.
Copy-only: same element, same `!compactChrome()` guard, same styles.

## How to test
1. `cd frontend && npx vitest run src/lib/iosChrome.test.ts` — 5 tests pass
   (the guard-structure assertions now anchor on the new phrase).
2. `cd frontend && npm run typecheck` — clean.
3. `grep -rn "Birding tools for your eBird workflow" frontend/src website` —
   no matches (historical `pipeline/*/design.html` copies are exempt and
   untouched).
4. Visually: `cd frontend && npm run dev`, open http://localhost:5173 — the
   subtitle under the SnowRaven heading reads the new copy.

## Notes for reviewer
- The iosChrome test's guard-adjacency structure (bounded `[\s\S]{0,300}?`
  window, exactly-one-occurrence check) is intact — only the anchored string
  changed.
- Out of scope per the change brief: README.md line-3 descriptive copy and the
  website `<title>`/og:title (different phrase, not this tagline).
- No version bump and no CHANGELOG entry here — this is a bundled Spool build;
  the bundle release carries one patch bump + changelog entry at the end.
- New copy contains no em dash (v0.5.68 copy convention).
