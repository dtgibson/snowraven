# Design Spec — Windows Desktop App

## Visual Direction
This feature adds no new visual language. The Windows app inherits the entire existing UI unchanged. The single design deliverable is one informational note that replaces the "Use my location" button on Windows, styled with existing `--sr-*` tokens to read as a calm "coming later," not an error.

## Scope guardrail (important)
The **only** Map Explorer UI change is swapping the "Use my location" button for the note, and **only on Windows**. Everything else is untouched on all platforms: address search, latitude/longitude inputs, the **radius / distance selector**, the legend, and all three view modes (My Sightings, Hotspots, Media Targets). Downstream must not remove or restyle any other control. The mockup abbreviated the sidebar for focus; it is not a statement that anything was removed.

## Screens / Views

### MapExplorer → CenterPointControl (Windows only)
- Where the "Use my location" button renders on macOS/web, Windows shows an info note in its place. The note occupies the same slot so the layout doesn't shift; the radius selector and everything below remain.
- **Note styling:** `--sr-surface-subtle` background, 1px `--sr-border`, 6px radius, ~10–11px padding. An info-circle icon in `--sr-text-muted`. Two-part copy: a bold lead in `--sr-text` and a supporting sentence in `--sr-text-muted`, ~12px, line-height ~1.45.
- **Copy (approved):** "**Location detection is coming to Windows.** For now, search for an address above or enter coordinates to set your center point."
- Not an error treatment — no red/destructive tokens.

## Component Usage
No new components or libraries. Reuses existing sidebar field/input/note patterns and the Lucide-style stroke icon set already in the app.

## Design Tokens Applied
- Surface/border: `--sr-surface-subtle`, `--sr-border`
- Text: `--sr-text` (lead), `--sr-text-muted` (body + icon)
- Radius 8px family (note uses 6px to match other inset controls)
- Font: Inter (`--font-sans`)
- Correct in light and dark via the token sets (verified in the mockup).

## Interaction Notes
- The note is static (no interaction). The path forward is the existing address search and lat/lng inputs directly above it.
- Platform gating: shown when `isTauri() && isWindows()`; the button renders otherwise (macOS native, web `navigator.geolocation`).

## Content Notes
Warm, forward-looking, non-error. Single sentence of guidance pointing to the existing fallbacks.
