# Strategic Brief — Dark Mode

## What We're Building

A dark colour scheme for SnowRaven that follows the device's system preference automatically, with an override setting on the Settings tab so users can lock the app to light, dark, or system mode. Storing any preference in the browser requires explicit user consent, in keeping with the app's privacy-respecting ethos.

## Why Now

SnowRaven is already listed on its own roadmap for dark mode, and the Settings tab now exists to hold a preference. The timing is right — adding dark mode before the app grows more surfaces keeps the implementation contained.

## The User Problem

Birders often use the app in the evening, reviewing checklists after a day outdoors. A bright white interface in a dim room is uncomfortable. The app has no way to match the user's system display preference, and no way to override it when the preference is wrong for the context.

## Success Criteria

- Opening the app in a room with dark OS mode active shows a dark interface without any user action
- A user who prefers dark mode regardless of OS setting can set that once — after explicitly consenting to browser storage — and never see the light theme again
- A user who declines storage can still use their preferred theme for the current session; it resets on next load
- All existing UI — tabs, cards, filter pills, breeding code circles, error states — reads clearly in both themes

## Scope

- Dark colour scheme covering all five tabs and all components
- System mode (follows `prefers-color-scheme`) as the default — requires no storage
- Light / Dark / System toggle in the Settings tab
- **Consent before storage:** when a user selects Light or Dark, an inline prompt appears explaining that the preference will be saved in this browser's local storage on this device only. Two options: "Save preference" (persists to `localStorage`) or "This session only" (applies immediately, resets on next load). System mode never requires consent — it reads the OS setting without writing anything.
- If a stored preference already exists from a prior consent, changing the setting updates it silently (consent was already given)
- Theme applied at the `<html>` element level via a `data-theme` attribute
- All hardcoded hex colours converted to CSS custom properties with light and dark values in `globals.css`

## Out of Scope

- Per-tab or per-component theme overrides
- Syncing theme preference across devices or browsers via the server
- Animated transition between themes
- A site-wide cookie/storage consent banner — consent is scoped to this single action at the point of action

## Key Decisions

- **System mode needs no storage** — `prefers-color-scheme` is read-only from the OS; nothing is written to the browser. Only choosing Light or Dark (an explicit override) triggers the consent prompt.
- **Consent is inline and contextual, not a banner** — the prompt appears directly below the theme toggle at the moment the user makes a choice, not as a modal or site-wide notice.
- **"This session only" is a real option** — users who don't want browser storage can still use their preferred theme; it just won't persist across loads.
- **Storage: `localStorage`** — per-browser, appropriate for a display preference; nothing is sent to the server.
- **Implementation via CSS custom properties** — all colours mapped to CSS variables; inline styles reference `var(--sr-*)` instead of literal hex.
- **Default is System** — no storage, no prompt, good experience on first load.
