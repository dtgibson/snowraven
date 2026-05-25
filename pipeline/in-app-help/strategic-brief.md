# Strategic Brief -- In-App Help Documentation

## What We're Building

A help system built directly into the app: a full documentation panel accessible from the Settings tab, plus the same documentation available as a rendered markdown file in the GitHub repo. Both are served from a single source file so the content is always identical.

## Why Now

The app has grown to eight tabs with meaningful depth on each one. New users -- particularly the less technical birding friends the product was designed for -- have no guidance on what the tabs do, how to get API keys, or what file formats to upload. The Settings tab already exists as the natural anchor for configuration and is the right home for a "How does this work?" entry point. Building this now, before adding more features, means every future feature can be documented in the same session it ships.

## The User Problem

An experienced birder opens SnowRaven on a Raspberry Pi that a tech-savvy friend set up. They know exactly what a life list is, what Macaulay Library is, and what a checklist submission ID looks like -- but they have never registered for a developer API key, do not know what an eBird backup export is or where to find it, and are not sure what an ML export file contains. The tabs mostly make sense once they are working, but getting to "working" requires steps that have no in-app guidance. There is nothing to read, and there is no one to ask.

## Success Criteria

- A user with no technical background but deep birding knowledge can get from zero to all features working by reading the docs alone, in either location, with no other reference needed.
- The in-app docs load instantly and work with no network connection.
- The docs are discoverable from the Settings tab with one click.
- The GitHub URL is obvious and linked from the README.
- Every tab and every major feature has at least a paragraph of plain-language explanation.
- The API key and file setup sections are step-by-step and specific enough that a non-technical user can follow them. Birding terminology is used freely; technical terminology is explained on first use.
- The content is identical in both locations -- guaranteed by a single source file, not by discipline.

## Scope

- `docs/HELP.md` at the repo root -- the single source of truth for all documentation. GitHub renders it at github.com/dtgibson/snowraven/blob/main/docs/HELP.md.
- `HelpDocs.tsx` imports `docs/HELP.md` as a raw string via Vite's `?raw` import. The file is bundled at build time -- no network call at runtime.
- A lightweight markdown renderer renders the bundled string inside the overlay panel.
- A "Help" button in the Settings tab opens the docs in a full-screen overlay panel.
- README links to `docs/HELP.md` prominently.
- Coverage: Getting Started, API Keys (eBird and OpenWeather), Default Files (eBird backup and ML export), and a section per tab.
- Writing register: birding terminology used without definition; technical terms explained briefly on first use.
- No em dashes, no emojis, anywhere in the documentation or README.

## Out of Scope

- A searchable or indexed help system.
- Versioned documentation -- the bundled docs update with the app.
- A dedicated Help tab in the tab bar.
- Explanations of birding concepts the audience already knows.
- GitHub Pages or any hosted documentation site.

## Key Decisions

- `docs/HELP.md` is the single source of truth. The in-app component and the GitHub URL both serve this file -- there is no second copy to maintain.
- Vite `?raw` import bundles the markdown at build time, guaranteeing offline access.
- Entry point is a button in the Settings tab; the panel is full-screen or near-full-screen.
- Assume birding literacy; explain technical steps.
- README links to `docs/HELP.md` and is updated alongside it before every push.
