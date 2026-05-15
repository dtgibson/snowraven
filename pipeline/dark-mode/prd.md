# PRD — Dark Mode
**Feature:** dark-mode
**Session:** 001
**Date:** 2026-05-15
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Dark mode adds a dark colour scheme to SnowRaven and lets users override the system preference from the Settings tab. The default is always System — it reads `prefers-color-scheme` without writing anything to the browser. Overriding to Light or Dark requires one-time explicit consent before anything is stored in `localStorage`.

---

## User Stories

**US-01** — As a user on a device set to dark mode, I want SnowRaven to appear dark automatically, so I don't have to configure anything.

**US-02** — As a user who always wants dark mode regardless of my OS setting, I want to lock the app to dark, so I never see the light theme.

**US-03** — As a user who always wants light mode regardless of my OS setting, I want to lock the app to light, so I never see the dark theme.

**US-04** — As a privacy-conscious user, I want to know before anything is saved to my browser, so I can decide whether to allow it.

**US-05** — As a user who doesn't want persistent browser storage, I want my chosen theme to work for this session without being stored anywhere, so I get the visual benefit without the data footprint.

**US-06** — As a user who has already consented to storage, I want to change my override silently, so I don't have to re-confirm something I've already agreed to.

---

## Functional Requirements

### Theme Resolution

**FR-01** — On page load, before React renders, the app shall read `localStorage` for a key named `sr-theme`. If the value is `light` or `dark`, it shall set `data-theme` on the `<html>` element to that value.

**FR-02** — If no `sr-theme` key exists in `localStorage`, the app shall apply `data-theme="dark"` if `prefers-color-scheme: dark` matches, or `data-theme="light"` otherwise.

**FR-03** — FR-01 and FR-02 shall execute synchronously via an inline `<script>` tag in `index.html`, placed before the module bundle, so the correct theme is applied before first paint and no flash of the wrong theme occurs.

**FR-04** — The `data-theme` attribute shall drive all colour values through CSS custom properties defined in `globals.css`. No colour value in any component shall be hardcoded; all shall use `var(--sr-*)` tokens.

### Settings UI

**FR-05** — The Settings tab shall show an "Appearance" section above "API Keys", containing a three-option toggle: **System** · **Light** · **Dark**.

**FR-06** — The active option shall be visually highlighted. On load: if `sr-theme` is `light`, highlight Light; if `dark`, highlight Dark; otherwise highlight System.

**FR-07** — Selecting **System** shall remove `sr-theme` from `localStorage` (if present) and immediately apply the OS preference. No consent prompt is shown.

### Consent Flow

**FR-08** — When the user selects **Light** or **Dark** and `localStorage.getItem('sr-theme')` is `null`, the theme shall apply immediately to the visible UI, and a consent prompt shall appear inline below the toggle.

**FR-09** — The consent prompt shall read: *"Your preference will be saved in this browser's local storage — on this device only. Nothing is sent to the server."* with two buttons: **Save preference** and **This session only**.

**FR-10** — Clicking **Save preference** shall write the selected value (`light` or `dark`) to `localStorage` under the key `sr-theme` and dismiss the prompt. No further prompts shall appear for subsequent Light/Dark changes in any session.

**FR-11** — Clicking **This session only** shall dismiss the prompt without writing to `localStorage`. The applied theme persists until the page is closed or reloaded; on next load the app returns to the OS preference.

**FR-12** — When the user selects **Light** or **Dark** and `localStorage.getItem('sr-theme')` already has a value, the selection shall update `localStorage` silently and apply immediately. No consent prompt is shown.

**FR-13** — If the consent prompt is visible and the user selects a different option (e.g. switches from Dark to System while the prompt is open), the prompt shall be dismissed and the normal flow for that option shall apply.

### CSS Architecture

**FR-14** — All colour values used across `App.tsx`, `Settings.tsx`, `BreedingCodeList.tsx`, `BreedingCodeTable.tsx`, `LifeList.tsx`, `LifeListTable.tsx`, `ListComparer.tsx`, `ResultsView.tsx`, `SpeciesPanel.tsx`, and `DropZone.tsx` shall be replaced with `var(--sr-*)` CSS custom property references.

**FR-15** — `globals.css` shall define a complete set of `--sr-*` tokens for both themes: `:root` (light) and `[data-theme="dark"]`.

**FR-16** — The `sr-panel`, `sr-header`, and `sr-card` responsive classes added in v0.0.28 shall remain functional and continue overriding padding correctly in both themes.

---

## Non-Functional Requirements

**NFR-01 — Accessibility:** All text/background colour combinations in the dark theme shall meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text and UI components).

**NFR-02 — No flash of wrong theme:** The synchronous inline script (FR-03) is mandatory. The theme must be committed before the browser paints the first frame.

**NFR-03 — Privacy:** No data shall be written to `localStorage` without the user completing the consent flow (FR-08 through FR-11). `localStorage` shall never be read to infer preferences beyond the `sr-theme` key.

**NFR-04 — Compatibility:** The implementation shall work on all browsers that support CSS custom properties and `prefers-color-scheme` (Safari 12.1+, Chrome 76+, Firefox 67+).

**NFR-05 — Backend unchanged:** This feature has no backend component. No new endpoints, no server-side storage, no changes to `backend/`.

---

## Out of Scope

- Per-tab or per-component theme overrides
- Syncing theme preference across devices or browsers via the server
- Animated transition between themes (immediate switch only)
- A site-wide cookie or storage consent banner
- Dark-mode SVG or illustration variants
- Any change to the breeding code tier colours (purple palette) — these should be verified for readability but not redesigned

---

## Open Questions

**OQ-01 — Breeding code circle colours in dark mode:** The tier circles use a purple palette (`#3B0764` → `#C084FC`). The darkest tier (`#3B0764` on a dark card) may have insufficient contrast. Default assumption: lighten the darkest tier to `#6B21A8` in dark mode; verify at Stage 4.

**OQ-02 — Green accent in dark mode:** `#2D8653` on a dark background reads well at large sizes but may fall below 4.5:1 on small text. Default assumption: lighten to `#34D399` for dark theme text uses; keep `#2D8653` for icon and border uses where contrast requirement is 3:1.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | System mode — dark OS | App loads with dark theme when `prefers-color-scheme: dark`; no `sr-theme` in localStorage |
| QA-02 | System mode — light OS | App loads with light theme when `prefers-color-scheme: light`; no `sr-theme` in localStorage |
| QA-03 | No flash of wrong theme | Dark-mode user sees no white flash on load when `sr-theme=dark` is stored |
| QA-04 | Settings toggle reflects stored state | Opening Settings shows Light/Dark/System highlighted to match `sr-theme` or OS if null |
| QA-05 | Selecting System clears storage | After selecting System, `localStorage.getItem('sr-theme')` returns null |
| QA-06 | Consent prompt appears | Selecting Light or Dark with no stored preference shows the inline consent prompt |
| QA-07 | Consent prompt applies theme immediately | Theme changes to the selection before the user responds to the prompt |
| QA-08 | Save preference persists | After "Save preference", `sr-theme` is set in localStorage; theme survives page reload |
| QA-09 | This session only does not persist | After "This session only", `localStorage.getItem('sr-theme')` is null; theme resets on reload |
| QA-10 | Silent update after prior consent | With `sr-theme` set, changing Light↔Dark updates localStorage without showing prompt |
| QA-11 | All components themed | In dark mode, no component shows hardcoded light colours (white cards, dark text on dark bg) |
| QA-12 | WCAG AA contrast | Body text in dark theme passes 4.5:1 contrast check against its background |
| QA-13 | No backend changes | `git diff HEAD backend/` shows no changes |
