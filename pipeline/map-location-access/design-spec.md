# Design Spec — Map Location Access

## Visual Direction
Quiet utility — the button fits seamlessly into the existing Maps sidebar without introducing new visual language. Green accent (#2D8653) signals the active/success state; the error message uses the existing destructive red token. No new design patterns introduced.

## Screens / Views

### Maps Sidebar — CenterPointControl (Hotspots and Media Targets modes)

The "Use my location" button sits above the lat/lng input fields, exactly where it currently lives. Four states:

**Default**
- 34px height, full-width, `background: none`, `border: 1.5px solid var(--sr-border)`, `border-radius: 6px`
- Crosshair/locate icon at 13px in `var(--primary)` green, followed by "Use my location" label
- Hover: `border-color: var(--primary)`, `background: var(--accent)`

**Loading (acquiring position)**
- Spinner replaces icon (13px, green border-top, animated)
- Label changes to "Locating…"
- `background: var(--muted)`, `color: var(--muted-foreground)`, `cursor: default`, `disabled`
- No hover state change while disabled

**Resolved (location found)**
- Check icon replaces crosshair, label changes to "Location found"
- `border-color: var(--primary)`, `color: var(--accent-foreground)`, `background: var(--accent)`
- Lat/lng inputs gain `border-color: var(--primary)`, `background: var(--accent)`, `color: var(--accent-foreground)` to signal they were just populated
- Button returns to default state after ~1.5s (or immediately on next interaction)

**Error**
- Button returns to default state
- Error message renders between button and lat/lng inputs: `font-size: 11px`, `color: var(--sr-error)`, `margin-bottom: 8px`, `line-height: 1.4`
- Error clears when button is clicked again

## Component Usage
- Button: native `<button>` styled inline (matches existing pattern in `CenterPointControl`)
- Spinner: CSS-only `border-radius: 50%` with `animation: spin` — no new dependency
- Error text: `<div>` with existing `var(--sr-error)` token (matches existing `geoError` div at line 1001)
- All sizing and spacing matches existing sidebar controls exactly

## Design Tokens Applied
- `var(--primary)` — icon color, resolved border, spinner accent
- `var(--accent)` — hover background, resolved background on inputs and button
- `var(--accent-foreground)` — resolved text color
- `var(--muted)` — loading background
- `var(--muted-foreground)` — loading text color, placeholder text
- `var(--sr-border)` — default border, spinner base ring
- `var(--sr-error)` — error message text
- `var(--sr-surface)` — normal input background

## Interaction Notes
- **Loading state:** `isLocating: boolean` state variable disables the button and shows spinner
- **Auto-fetch trigger:** After coordinates resolve, if `lat` and `lng` were empty strings before the click, call `handleFindHotspots()` or `handleFindSightings()` based on active `viewMode`
- **No auto-fetch:** If coordinates were already populated, update state only — user triggers fetch manually
- **Error clear:** At the start of each `handleUseMyLocation` call, `setGeoError('')` clears any previous error
- **`isSecureContext` guard removal:** Current code at line 867 blocks the button in Tauri (`window.isSecureContext` is false in WKWebView). This check must be removed — the Tauri plugin path handles permissions natively without needing HTTPS

## Content Notes
- Button label: "Use my location" (lowercase 'm' — matches existing label in codebase)
- Loading label: "Locating…"
- Resolved label: "Location found" (briefly, before reverting to default)
- Error — permission denied (Tauri): "Location access was denied. Grant permission in System Settings → Privacy & Security → Location Services."
- Error — permission denied (web): "Location access was denied. Allow location access in your browser settings."
- Error — position unavailable: "Unable to determine your location. Try again or enter coordinates manually."
- Error — timeout: "Location request timed out. Try again or enter coordinates manually."
