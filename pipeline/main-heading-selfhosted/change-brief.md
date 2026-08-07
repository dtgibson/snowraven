# Change Brief — main-heading-selfhosted

## What is changing
The app's tagline under the SnowRaven title changes from "Birding tools for
your eBird workflow" to "Self-hosted birding tools and data explorer".
Three exact-phrase sites move in lockstep: `frontend/src/App.tsx` (~line 713,
the `{!compactChrome() && …}` guarded tagline `<p>`), `frontend/src/lib/
iosChrome.test.ts` (two regex assertions on the literal phrase, lines 69 and
72, plus the comment at line 65 that quotes it), and the `website/index.html`
footer (~line 604), which echoes the tagline verbatim and stays in sync per
the website convention. Out of scope: README.md line 3 and the website
`<title>`/og:title use a different phrase ("Birding analytics and tools…"),
descriptive prose rather than this tagline; historical `pipeline/*/design.html`
copies are never edited.

## Why now
User-queued idea (Spool): the current tagline undersells the product. The new
copy leads with the self-hosted, local-first identity and names the data
explorer, matching how README/docs already describe the app.

## User-facing impact
The subtitle under the SnowRaven heading reads "Self-hosted birding tools and
data explorer" (non-compact chrome only; compact iOS chrome shows no tagline,
unchanged). The public website footer reads the same. No behavior change.

## Design pass
Not needed — no visual change. Copy-only: same element, same guard, same
styles; only the string swaps. New copy contains no em dash (complies with
the v0.5.68 copy convention).

## Decisions touched
None reversed or modified. Three conventions complied with, not changed:
the em-dash-free copy rule (v0.5.68, DECISIONS.md + CLAUDE.md), the
website-stays-in-sync-with-app-copy rule (CLAUDE.md Documentation), and the
compact-chrome tagline guard (mobile-app pass) — the `!compactChrome()`
structure and its test are preserved, only the anchored string updates.

## What done looks like
Header shows the new tagline; `grep -rn "Birding tools for your eBird
workflow"` returns nothing in `frontend/src/` or `website/` (pipeline
artifacts exempt). `iosChrome.test.ts` regexes updated to the new phrase and
green; full vitest suite passes; `npm run build` clean. Website footer
matches the app. This is a user-facing copy change, so the Spool BUNDLE
release must carry a patch version bump + CHANGELOG entry — handled ONCE at
the bundle level, not per-build; the Engineer should not bump here if the
bundle release owns it.
