# PRD -- In-App Help Documentation
**Feature:** in-app-help
**Session:** 001
**Date:** 2026-05-25
**Stage:** 2 -- The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A full-screen help overlay accessible from the Settings tab, powered by a single `docs/HELP.md` file that is imported at build time and bundled with the app. The same file is rendered by GitHub at a permanent, linkable URL. No network call is made at runtime; the documentation is always available offline.

---

## User Stories

**US-01** -- As a birder new to SnowRaven, I want to read what each tab does before I start using it, so that I understand the app without having to discover everything by trial and error.

**US-02** -- As a birder with limited technical experience, I want step-by-step instructions for getting an eBird API key and an OpenWeather API key, so that I can complete setup without asking for help.

**US-03** -- As a birder who is not sure what an eBird backup file is, I want to know how to download it and where to upload it in the app, so that the tabs that require it start working.

**US-04** -- As a birder who has never heard of a Macaulay Library export, I want a plain explanation of what it is, what it unlocks in the app, and how to get it, so that I can decide whether it is worth setting up.

**US-05** -- As a birder on a plane or at a location without internet, I want the full documentation to be readable in-app without any network connection, so that I am not blocked when I need to look something up.

**US-06** -- As a birder who wants a quick reference, I want to be able to find the documentation in the GitHub repo at an obvious URL, so that I can bookmark it and share it with others.

---

## Functional Requirements

### Documentation source

**FR-01** -- The app shall include a `docs/HELP.md` file at the repository root. This file is the single source of truth for all help content. No other file contains duplicate or alternate documentation.

**FR-02** -- `HelpDocs.tsx` shall import `docs/HELP.md` using Vite's `?raw` import (e.g. `import helpText from '../../docs/HELP.md?raw'`). The content shall be resolved at build time and included in the production bundle as a string.

**FR-03** -- The app shall render the bundled markdown string using a lightweight markdown renderer. The renderer must correctly handle: H1, H2, H3 headings; paragraphs; bold text; unordered lists; ordered lists; inline code; fenced code blocks; horizontal rules; and hyperlinks. No runtime network calls shall be made to fetch or parse the documentation.

### Settings tab integration

**FR-04** -- The Settings tab shall display a "Help and documentation" section below the Tab Layout section, visually separated from it by a divider matching the existing section divider style. The section shall contain a single button labeled "Open documentation."

**FR-05** -- Clicking "Open documentation" shall open the help overlay. The overlay shall cover the full viewport (100vw x 100vh), appear above all other content (z-index appropriate to clear the app header and any Leaflet layers), and include a visible close button in the top-right corner labeled with an X icon.

**FR-06** -- The overlay shall be scrollable. The close button shall remain fixed at the top-right regardless of scroll position.

**FR-07** -- Pressing the Escape key while the overlay is open shall close it.

**FR-08** -- The overlay background shall use `var(--sr-surface)` and text shall use `var(--sr-text)`, consistent with the existing theme system. The overlay shall respect the active light/dark theme.

### Documentation content

**FR-09** -- `docs/HELP.md` shall include the following top-level sections, in this order:

1. Getting Started -- a short orientation explaining what SnowRaven is, what tabs are visible, and the recommended setup sequence
2. API Keys -- two subsections (eBird API key; OpenWeather API key), each covering where to register, where to find the key, and any non-obvious requirements (the OpenWeather One Call by Call subscription must be activated explicitly)
3. Default Files -- two subsections (eBird backup; ML export), each covering what the file is, what features it enables, and exactly how to obtain and upload it
4. One section per tab, covering what the tab does and how to use its major features: Weather, Species Detail, Statistics, Map Explorer, Media List, Breeding Codes, Life List Comparer, Settings

**FR-10** -- The documentation shall assume birding literacy. Terms such as life list, checklist, Macaulay Library, eBird, and breeding code shall be used without definition. Technical terms (API key, CSV file, export file, browser cache, systemd) shall be defined or briefly explained on first use.

**FR-11** -- The documentation shall contain no em dashes and no emoji. Prose style shall match the existing Settings tab copy: plain, direct, present tense, active voice.

**FR-12** -- The OpenWeather setup section shall explicitly state that the One Call by Call subscription is free for the first 1,000 calls per day and that it must be subscribed to separately -- it is not included automatically when an account is created. This is the most common setup failure and must be stated clearly.

**FR-13** -- The eBird API key section shall state that the key is free and that registration requires a standard eBird account.

**FR-14** -- The eBird backup section shall state that the file is called `MyEBirdData.csv`, that it is available at ebird.org/downloadMyData (requiring sign-in), and that it is used by the Breeding Codes, Media List, Species Detail, Statistics, and Life List Comparer tabs.

**FR-15** -- The ML export section shall state that the file is a spreadsheet exported from the user's Macaulay Library media page, that it is used by the Media List, Species Detail, and Statistics tabs, and that it enables media-aware features that are not available from the eBird backup alone (embedded recent media, media counts, media chart).

**FR-16** -- The Statistics tab section shall document all nine cards and explain the Top Local Target Species feature, including what "configured location" means (the Default Location in Settings), what the 30-day window means, and what the dot colors indicate.

### README

**FR-17** -- `README.md` shall include a prominent link to `docs/HELP.md` under a section titled "Documentation." The link text shall be "Full documentation."

**FR-18** -- `README.md` shall be reviewed and updated to reflect the current state of the app. All references to per-tab file upload (removed in the Settings-first model) shall be updated. The Statistics tab, Map Explorer, and all features shipped since the README was last updated shall be accurately described.

---

## Non-Functional Requirements

**NFR-01 -- Offline availability:** The help content shall be fully readable with no network connection. No part of the rendering pipeline shall make a fetch, XHR, or WebSocket call.

**NFR-02 -- Bundle impact:** The markdown renderer shall not cause any single bundle chunk to exceed 500 kB. If `marked` is used, it shall be included in the `vendor-recharts` chunk or given its own small vendor chunk -- the Architect decides based on size.

**NFR-03 -- Accessibility:** The overlay shall trap focus while open. Pressing Escape shall close it. The close button shall have an accessible aria-label of "Close documentation."

**NFR-04 -- Theme consistency:** The rendered markdown shall use only `var(--sr-*)` tokens for all colors. No hardcoded hex values in `HelpDocs.tsx`.

**NFR-05 -- TypeScript:** The `?raw` import shall be correctly typed. If `vite/client` types are not already included in `tsconfig.json`, they shall be added.

---

## Out of Scope

- A searchable or indexed help system
- A dedicated Help tab in the tab bar
- Versioned or per-release documentation
- GitHub Pages or any hosted documentation site
- Explanations of birding concepts (life list, eBird, Macaulay Library, checklist)
- Any documentation for the Raspberry Pi installation process -- that remains in README.md only, not in the in-app panel (the in-app docs assume the app is already running)

---

## Open Questions

None -- all decisions are resolved in this document.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Help button present in Settings | "Open documentation" button is visible below Tab Layout section |
| QA-02 | Overlay opens | Clicking the button shows a full-viewport overlay with documentation content |
| QA-03 | Overlay closes via button | Clicking the X button closes the overlay |
| QA-04 | Overlay closes via Escape | Pressing Escape while overlay is open closes it |
| QA-05 | Offline availability | Documentation renders correctly when the browser has no network access |
| QA-06 | Theme compliance | Overlay respects light and dark theme; no hardcoded colors visible |
| QA-07 | Content completeness | All nine sections from FR-09 are present in the rendered output |
| QA-08 | OpenWeather warning present | The One Call by Call subscription note appears in the OpenWeather section |
| QA-09 | README link present | README.md contains a "Full documentation" link pointing to docs/HELP.md |
| QA-10 | Single source of truth | The content rendered in-app matches the content of docs/HELP.md exactly (same import) |
| QA-11 | No em dashes or emoji | docs/HELP.md contains no em dash character and no emoji codepoints |
| QA-12 | TypeScript clean | `npm run typecheck` exits with no errors |
| QA-13 | Tests pass | `npm test` exits with no failures |
