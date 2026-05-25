# Design Spec — SnowRaven Desktop App

## Visual Direction

The desktop app looks and feels like the existing SnowRaven web app running inside a native macOS window. The brand identity (Irish clover green #2D8653, clean sans-serif, quiet utility aesthetic) carries over unchanged. The new design surfaces are minimal: the macOS window chrome, two updated sections in Settings, and the in-app update banner.

## Screens / Views

### Settings Tab (primary design surface)

This is where the meaningful visual changes live. The layout is a two-column grid:

**Left column — API Keys, Appearance, Data**

API Keys section uses a card with two rows, one per key. Each row has an icon, a title and subtitle, and a right-aligned action area. The critical design decision: keys are never shown as text inputs in desktop mode. Instead they display a green "Keychain" badge (lock icon + label) when stored, or an amber "Not set" badge when missing. A "Remove" button (destructive style, red border) appears next to stored keys. An "Add key" primary button appears next to unset keys.

The Data section surfaces three entries: eBird backup file, ML export file, and taxonomy cache. Each shows the native app data directory path as the subtitle. Taxonomy cache shows its version and a "Refresh" button.

**Right column — Tab Layout, About, Help**

Tab Layout uses toggles (green when on, gray when off) with the tab name and current visibility state. About shows the app version and a GitHub link. Help links to the existing in-app documentation overlay.

### Add Key Dialog

Opens as a centered overlay with a backdrop blur. Contains: a large lock icon in a green rounded square, a title ("Add [Service] API Key"), a subtitle explaining keychain storage, a password input field (masked), a green informational note confirming the key goes to Keychain not a file, and Cancel / Save to Keychain buttons. Clicking outside the dialog closes it.

### In-App Update Banner

Appears at the top of Settings when an update is available. Green gradient background, darker green border. Left icon (download arrow in a green rounded square), center body (version name + brief changelog note), right actions (primary "Update now" + ghost "Later"). Dismisses on "Later"; triggers update flow on "Update now".

### Other Tabs

Weather, Breeding Codes, Media, Species Detail, Statistics, and Map tabs are visually unchanged from the existing web app. The Statistics tab shows the stat grid and bar chart. The Map tab shows the Leaflet map. No design changes to these views.

## Component Usage

- `Card` with `card-row` pattern: API keys, data files, tab toggles, about, help
- `Badge`: green "Keychain" status, amber "Not set" status
- `Button`: primary (green fill) for "Add key" and "Update now"; ghost (gray) for secondary actions; destructive (red border) for "Remove"
- `Toggle`: tab visibility controls
- `Dialog` / overlay: Add Key flow
- `Input`: password field inside the Add Key dialog
- Update banner: custom component, not a shadcn dialog — it lives inline in Settings

## Design Tokens Applied

- Primary: `var(--sr-accent)` / #2D8653 — primary buttons, active tab underline, keychain badges, toggle on-state
- Background: white
- Border: `var(--sr-border)` / #E4E4E7 — all card borders
- Muted surface: #FAFAFA — tab bar background
- Muted text: `var(--sr-text-muted)` / #71717A — subtitles, inactive tabs
- Amber: #FEF3C7 / #92400E — "Not set" badge
- Destructive: `var(--sr-destructive)` / #EF4444 — "Remove" button text and border

## Interaction Notes

- "Add key" button opens the Add Key dialog; saving updates the row badge from amber to green without a page reload
- Toggles in Tab Layout update their subtitle text (Visible / Hidden) on click
- Tabs switch the visible content panel; no page navigation
- "Update now" in the banner should trigger the Tauri updater API; "Later" dismisses the banner for the session
- The Add Key dialog closes on outside click or Cancel

## Content Notes

- API key inputs are always type="password" — never shown in plaintext
- Keychain badge copy: "Keychain" (with lock icon) — short and clear
- "Not set" badge (with warning circle icon) — direct, no hedging
- Update banner copy pattern: "[App] [version] is available / You're on [current]. [One-line changelog note]."
- Data path subtitles show the literal path so users know where their files live
- No em dashes anywhere in UI copy
