# Design Spec — Windows Geolocation

## Visual Direction
No new visual language. The "Use my location" button is the existing component, now shown on Windows. The only new element is the copy + treatment for the "location off/denied" case on Windows, which reuses the existing inline-error style.

## Screens / Views

### MapExplorer → CenterPointControl (Windows)
- **Button:** the existing "Use my location" button renders on Windows exactly as on macOS/web (Navigation icon in `--sr-accent`, `Locating…` spinner state). No change to the button itself.
- **Denied / location-off message:** rendered in the existing `geoError` slot directly under the button — `font-size: 11px`, `color: var(--sr-error)`, `margin-bottom: 6px`, line-height ~1.45. Same treatment as the macOS/web denied messages.
- **Copy (approved, Windows 11):** "Turn on location in Windows Settings → Privacy & security → Location, then try again." This is the correct Win11 path (master "Location services" toggle + "Let desktop apps access your location" live on that page).
- Coordinates / address search / radius all unchanged.

## Component Usage
No new components, libraries, or tokens. Reuses the existing button and the existing inline-error text style.

## Design Tokens Applied
- Button: `--sr-accent` (icon), `--sr-text` / `--sr-text-muted`, `--sr-border`.
- Message: `--sr-error`. Correct in light and dark via the token sets.

## Interaction Notes
- Allowed → clicking returns coordinates and recenters the map (same flow as macOS).
- Off/denied → the `permission-denied` result shows the Windows-specific guidance above; macOS and web denied messages are unchanged.
- The button must not hang in "Locating…" on failure (resolves to the error message).

## Content Notes
Guidance, not blame — points the user to the exact Windows 11 settings page. macOS/web denied copy is untouched.
