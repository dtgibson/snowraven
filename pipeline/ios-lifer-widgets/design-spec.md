# Design Spec - iOS Lifer Widgets

**Feature:** ios-lifer-widgets
**Date:** 2026-09-24
**Stage:** 4 - The Designer (approved direction)
**Mockup:** `pipeline/ios-lifer-widgets/design.html` (the visual authority; this document states the rules the mockup renders)
**Design system:** `pipeline/design-system.md` applied without deviation, with the named exceptions in *Design Tokens Applied*.

## Visual Direction

Quiet utility carried onto the home screen. Each widget is the raven mark, the view's exact name from Map Explorer, and the selected window as a word, over a nearest-first list of species with the distance as the single accented figure. Everything else is ink and gray, so the list reads as a list and the number reads as the answer. Empty and error states keep the title and say one plain sentence in the register of the Map Explorer overlays; a stale list stays a list and is marked in words, never by color. The rendering is native SwiftUI in a WidgetKit extension and looks like it: system text styles, the system widget container, no chrome invented for the tile.

## Screens / Views

### Widget anatomy (all families, both kinds)

Layout, top to bottom, inside the WidgetKit content margins (the mockup uses 12pt top, 15pt sides, 10pt bottom on a 22pt corner radius; on device use `containerBackground(for: .widget)` and the default content margins rather than hand-set insets):

1. **Header row:** raven mark (`RavenGlyph` path as an SVG or PDF asset in the extension, 13pt square, colored with the accent, `widgetAccentable`) + title (the kind's name, 13pt semibold, 12pt on small) + a trailing window word (11pt semibold, secondary color): `Week`, `Day` or `30 days`. On Media Targets with a single media type selected the trailing word becomes `Week · Photo`, `Week · Audio` or `Week · Video`. The row is allowed to wrap at large Dynamic Type sizes so the window word drops under the title rather than truncating either.
2. **Body:** rows (medium, large), the one-bird card (small), or the state sentence.
3. **Footer:** secondary-color caption (10.5pt): `Updated 9:41 AM`, preceded where applicable by `From your default location` and/or `Offline` / `eBird busy`, separated by middle dots. Medium and large show the footer on every successful refresh; small shows it only when the latest refresh failed (the stale mark) or the Default Location caption applies.

Sizes: `systemSmall` 1 row, `systemMedium` 3 rows, `systemLarge` 8 rows, the first N of the ordered list. A row that does not fit at the rendered text size is dropped whole; a row is never clipped mid-row (in the mockup the Larger text mode shows medium at 2 rows and large at 5).

### Row (medium and large)

Two-line row on a hairline separator (`--w-sep`) between rows, none above the first:

- Line 1: species common name (13.5pt semibold, primary color) leading, distance trailing (13.5pt semibold, accent, tabular figures, `widgetAccentable`), e.g. `3.2 mi`. Under Media Targets set to Any, the missing-media glyphs follow the name (see *Glyph rules*).
- Line 2: `Today · Coyote Hills Regional Park` (10.5pt, secondary color): recency, middle dot, location name. Truncates with an ellipsis at the trailing end.
- Row padding 3pt top and bottom on medium, 5pt on large; the name and the distance share a baseline.

Every row is its own `Link` to the widget's deep link (FR-34; medium and large). Rows are not individually distinguishable as links visually; the whole widget reads as one tappable surface, which is the WidgetKit norm.

### One-bird card (small)

Bottom-anchored block under the header: the species name at 18pt bold, up to two lines, clamped with an ellipsis; then the distance line: `0.9 mi` at 22pt bold in the accent (`widgetAccentable`) with the recency word beside it at 11pt secondary. The location name is not drawn on small and remains in the accessibility label. The whole tile is the `Link`.

### Home-screen placement

Nothing to build; recorded so the Engineer can check the look: a medium Nearby Lifers (Week) over a small Media Targets (Day) on iPhone, a large Nearby Lifers (30 days) beside a medium and a small on iPad, all from the same extension.

### States (S1 to S12)

The header stays in every state. The body is one sentence at 13pt medium weight (12pt on small), primary color, left-aligned, vertically centered in the remaining space. No icon, no color. The final copy is in *Content Notes*. The S7 caption and the S9 marks live in the footer and compose with a list. The S12 placeholder renders the row layout with WidgetKit's `redacted(reason: .placeholder)` over sample rows.

### Edit Widget sheet (iOS's own surface; we supply the parameters)

- Nearby Lifers: one parameter, **Time range**, values **Day**, **Week**, **30 days**, default **Week**.
- Media Targets: **Time range** as above, plus **Media**, values **Photo**, **Audio**, **Video**, **Any**, default **Any**. Each Media value carries a subtitle (see *Content Notes*), shown through `DisplayRepresentation(title:subtitle:)` on the `AppEnum` cases.
- The widget's description under the sheet (the `configurationDisplayName` / `description` pair) is in *Content Notes*.
- The mockup draws the picker checkmark in the app accent; on device iOS draws it in the system tint. Not a spec claim.

### Tap-through (Map Explorer)

Two landings, one surface. Both land on the shipped Map Explorer: the view pill for the kind pressed, the widget's Time Range applied in the Filters sheet, radius 25 mi, a search run from the current location, the searched area shown by dimming what was not covered. For Media Targets the in-app **Filter by Type** chips are set from the widget's Media value: Photo, Audio or Video selects that one chip; **Any** lands with the chips on **All** (the in-app chip keeps its name). Every setting is an exact match between the widget's list and the view's list for the same inputs.

**Bird tap** (a row on medium and large; the one-bird card on small): after the search, the map shows **only the tapped species**: its chip(s) alone, the sighting the widget listed **selected with its details popup open** (the view's existing maplibre popup: location line, recency dot and name, date, checklist link, close button), and the map centered on that sighting. Everything else the search found stays loaded but hidden, so "Show all" is instant.

- **The way back:** one pill, `Only Baird's Sandpiper · Show all`, in the map's bottom-right FAB cluster as a full-width action row (the shipped `.sr-map-search-area-row` mechanism), in the **accent-tinted** register of `.sr-map-search-area-btn` (`--sr-accent` on `--sr-accent-bg` inside `--sr-accent-border-strong`, radius 20, 0.8125rem/600, the cluster's shadow), never an accent-filled slab (a solid accent fill on this canvas means sighting pin). The whole pill is the action; pressing it clears the species filter, keeps the search, closes the popup and re-fits to all results. The name truncates with an ellipsis before "Show all" does. Accessible name: `Showing only Baird's Sandpiper. Show all nearby lifers` (or `... media targets`).
- **Where it sits:** on a phone, above the round buttons and the Filters pill, right-aligned, inheriting the cluster's safe-area inset. On a desktop window, the same row in the same bottom-right corner of the map beside the open sidebar; the sidebar's count line reads `1 spot · 1 lifer` and the in-view list shows the one spot. If **Search this area** appears (the user pans), it takes the row above this one: the cluster grows upward, and the row whose position must stay stable goes below the neighbor that appears.
- **Sidebar and Filters:** unchanged. The species filter is session state set by the link and cleared by the pill, a view switch, a new search, or the popup's close button (closing the details does not clear the filter; only the pill does, so a user who closes the popup to see the map still has the way back).

**Widget tap outside a bird** (header, empty space, a state sentence): today's landing, the view with all nearby birds and no popup; the widget's window and media setting still apply.

**The edge:** the app searches on landing, and the tapped species may not be in the new results (the report aged out of the window, the phone moved, eBird changed). Then the map shows **all nearby birds** with no filter and the top-center statement line (the search-outcome slot, `.sr-map-search-status-msg`, `pointer-events: none`) reads `Baird's Sandpiper was not found within 25 miles. Showing all lifers.` (or `Showing all media targets.`). Never an empty map, never a filter with nothing in it, no pill. If the species is in the results but the listed location is not, the nearest location for that species is selected instead and no statement is shown.

## Component Usage

- **WidgetKit / SwiftUI:** `WidgetBundle` with two `AppIntentConfiguration` widgets (`NearbyLifers`, `MediaTargets`); `containerBackground(for: .widget)` with a themed color; `VStack` header/body/footer; rows as `HStack` over `VStack`; `Link` per row on medium and large, `widgetURL` on small; `Text` in system text styles only (`.subheadline` weight `.semibold` for names and title, `.caption` / `.caption2` for secondary lines, `.title3` / `.title2` bold on the small card); `.lineLimit(1)` with `.truncationMode(.tail)` on names and second lines, `.lineLimit(2)` on the small name; `.widgetAccentable()` on the raven and every distance figure; `.redacted(reason: .placeholder)` for S12.
- **Glyphs:** SF Symbols `camera.fill`, `mic.fill`, `video.fill`, rendered `.font(.caption2)` scale, secondary color, `.accessibilityHidden(true)` (the row's label carries the meaning).
- **App Intents:** `TimeRangeConfigurationIntent` (both kinds) and a `MediaTargetsConfigurationIntent` adding the `Media` parameter; enums carry `caseDisplayRepresentations` with titles and, for Media, subtitles.
- **In-app landing:** no new component. Existing `MapExplorer` view pills, `SegControl` Time Range, `Filter by Type` chips, FAB cluster and Filters sheet. The bird-tap landing adds one `Button` in the cluster's action row (the `.sr-map-search-area-btn` register, `.sr-touch-target`) and reuses the view's selected-marker popup and the search-outcome statement line.

## Design Tokens Applied

Widget colors are a Color Set per role in the extension's asset catalog, with light and dark variants taken from `frontend/src/globals.css`; the tinted and clear home-screen modes are handled by the system and by `widgetAccentable`, not by tokens.

| Role | Light | Dark | Source token |
|---|---|---|---|
| Container | `#FFFFFF` | `#1C1C1E` | `--sr-surface` (dark uses the system widget dark surface, which is the honest WidgetKit ground; the app's `#18181B` reads identically on a tile) |
| Primary text | `#0F1117` | `#F4F4F5` | `--sr-text` |
| Secondary text, glyphs, footer | `#6B6B74` | `#A1A1AA` | `--sr-text-muted` |
| Accent (distance figure, raven) | `#277448` | `#34D399` | `--sr-accent` |
| Row separator | `#ECECEF` | `#2C2C2E` | one step off `--sr-border-subtle` / `--sr-border`, hairline |
| Placeholder bars | `#E4E4E7` | `#3A3A3C` | `--sr-border` / system placeholder |

Contrast: primary and secondary text clear WCAG AA on both containers (secondary 4.8:1 light, 7.4:1 dark); the accent figure 5.5:1 light, 9.1:1 dark. No meaning is carried by color alone: stale is words, the window is words, the glyphs are shapes.

**Tinted mode (iOS 18):** the system replaces the container with its glass and renders text white; the raven and the distance figures take the user's tint through `widgetAccentable`; everything else stays white or white at reduced opacity. **Clear mode (iOS 26):** behaves the same way over the clear glass; nothing in the design depends on the container being opaque. Both were rendered in the mockup with a lavender tint to show the design holds without its green.

**Typography exception, named:** the widget uses the iOS system font (SF) through system text styles, not the app's web stack. WidgetKit renders SF and Dynamic Type requires system text styles, so this is the faithful choice rather than a default; the design system's type rule governs the app, and the widget inherits its roles (title, body, label) rather than its face.

## Interaction Notes

- **Tap targets:** on medium and large every row is its own `Link` (a bird tap); the header, footer and any empty space or state sentence carry the widget's `widgetURL` (a view tap). On small, iOS allows a single tap target, so a tap anywhere on a listing card, header included, is the bird tap; a small widget showing a state sentence carries the view tap.
- **What the link carries:** the view (`lifers` / `targets`), the window, the media setting for targets, and, for a bird tap only, the species and the sighting the widget listed: the eBird `speciesCode` (the app already filters lifer and target records by it and matches it with `SPECIES_CODE_RE`) and the `locId` of the listed location (`L` plus digits). The name is never carried; the app renders it from its own results. Without the two identifiers the link is a view tap. The exact grammar and its allowlist are the Architect's; the design requires only that a bird tap can single out one species and center one listed location, and that the link stays short and allowlisted.
- **Bird tap application order:** view, window, media, radius 25, search from the current location; then, from the results, filter to the species; select the listed location (or the nearest location of that species if the listed one is absent); pan to it and open its popup; show the pill. If the species is absent, show all results and the statement line.
- No other interactive control exists in the widget.
- **Configuration:** Edit Widget only. A change of Time range or Media re-lists from the cached fetch with no new eBird request (FR-12).
- **Refresh:** WidgetKit timeline at the planned cadence; rows re-render with the content transition in *Motion Spec*.
- **Glyph rules (Media Targets, Media set to Any only):** one glyph per missing type after the name, fixed order camera, microphone, video; never under a single type, where the header names the type. On medium and large the glyph group is fixed-width and never dropped; the name truncates first. On small the glyphs sit at the end of the distance line, right-aligned, and wrap under it when Dynamic Type leaves no room; the distance and recency never break mid-figure.
- **Dynamic Type:** system text styles throughout. Rows drop whole at larger sizes (FR-03). The small family scales less than medium and large at the largest sizes: use one text style step smaller on the small card than the row styles would give (the mockup shows 1.2x against 1.3x), because a two-line name, the distance line and a glyph line must fit a 170pt tile. A long name on small clamps at two lines with an ellipsis.
- **Accessibility label (VoiceOver), composed per widget:** title and window (and the media type when not Any), then each row as one sentence: name, then under Any `needs photo` / `needs audio` / `needs video` or the combination in the fixed order (`needs photo and video`, `needs photo, audio and video`), then distance with the unit spoken in full (`3.2 miles`), recency, location name; then the footer parts (`From your default location`, `Offline`, `eBird busy`, `Updated 9:41 AM`) as sentences. A state widget reads title, window and the sentence. The label is complete even where the tile truncates or omits the location. Example: `Media Targets, Week. Black-throated Gray Warbler, needs photo, audio and video, 1.4 miles, Today, Sanborn County Park. Bell's Sparrow, needs photo, audio and video, 18.2 miles, 5 days ago, Henry W. Coe State Park. Updated 9:41 AM.`

## Motion Spec

- Widget refresh (rows change): `.contentTransition(.opacity)` on the rows and `.numericText()` on the distance figures, system default timing (about 200 ms, ease-out); reduced motion: instant. Lib: SwiftUI.
- Everything else in the widget: no motion (NFR-05). No entrance animation, no pulsing, nothing on the placeholder.
- In-app landing: the existing Map Explorer transitions, unchanged (view switch instant; the Filters sheet's existing motion; map fit as today). The `Only ... · Show all` pill arrives with the shipped action-row entrance (`sr-search-area-arrive`, 190 ms, `cubic-bezier(0.16, 1, 0.3, 1)`, transform-origin bottom center) and leaves instantly; the statement line uses the shipped `sr-map-geo-in`; the popup opens as the app's popups already do. All collapse under the global reduced-motion rule. Lib: CSS.
- Mockup-only chrome (not shipped): appearance switch cross-fade 160 ms ease-out, refresh rows 200 ms ease-out translate 3px, both collapsed under `prefers-reduced-motion`.

## Content Notes

Voice: short, specific, the Map Explorer overlay register. American spelling. No em dashes. Species names exactly as eBird returns `comName`; location names exactly as `locName`. Distances one decimal with ` mi`; recency `Today`, `Yesterday`, `N days ago`. Times in the device's short time style (`9:41 AM`).

**Window words:** `Day`, `Week`, `30 days`. With a single media type: `Week · Photo`, `Week · Audio`, `Week · Video`.

**Edit Widget copy**
- Time range: `Day` / `Week` / `30 days` (default Week).
- Media (Media Targets only): `Photo` ("Species you have no photo of"), `Audio` ("Species you have no audio of"), `Video` ("Species you have no video of"), `Any` ("Missing a photo, audio, or video"). Default Any.
- Nearby Lifers description: `Recent eBird reports of species you still need, within 25 miles of where you are, nearest first. Tap to open them in Map Explorer.`
- Media Targets description: `Recent eBird reports of species you have recorded but still need a photo, audio or video of, within 25 miles of where you are, nearest first. Tap to open them in Map Explorer.`

**Footer parts:** `Updated 9:41 AM`; `From your default location`; `Offline`; `eBird busy`. Joined with ` · `.

**In-app landing copy (bird tap)**
- Pill: `Only {name} · Show all` (accessible name `Showing only {name}. Show all nearby lifers` / `... media targets`).
- Statement line, the edge: `{name} was not found within 25 miles. Showing all lifers.` / `... Showing all media targets.`
- Sidebar count under the filter: the existing `{n} spot(s) · {n} lifer(s)` line, unchanged.

**State copy (final)**

| State | Copy |
|---|---|
| S1 | `Open SnowRaven once to set up widgets.` |
| S2 | `Add your eBird API key in SnowRaven's Settings.` |
| S3 | `Load your eBird backup in SnowRaven's Settings.` |
| S4 (Media Targets) | `Load your Macaulay Library export in SnowRaven's Settings.` |
| S5 (Media Targets, Any) | `You already have media for every species in your backup.` |
| S5 (Photo / Audio / Video) | `You already have a photo of every species in your backup.` / `You already have audio of every species in your backup.` / `You already have video of every species in your backup.` |
| S6 | `Open SnowRaven to allow location, or set a Default Location in Settings.` |
| S7 | The list, with the footer caption `From your default location`. |
| S8 | `Could not reach eBird. Last updated yesterday, 4:12 PM.` (the time part names the last successful fetch: `today, 7:05 AM`, `yesterday, 4:12 PM`, or a short date for older; omit the second sentence if there was never a successful fetch) |
| S9 | The last good list, footer `Offline · Updated 7:05 AM` or `eBird busy · Updated 8:20 AM`. Small shows the footer in this state only. |
| S10 (Nearby Lifers) | `No lifers reported within 25 miles today.` / `... this week.` / `... in the last 30 days.` |
| S10 (Media Targets, Any) | `No media targets reported within 25 miles today.` / `... this week.` / `... in the last 30 days.` |
| S10 (Photo / Audio / Video) | `No species needing a photo reported within 25 miles this week.` (audio / video likewise; the window phrase as above) |
| S11 | `eBird did not accept your key. Check it in SnowRaven's Settings.` |
| S12 | Placeholder rows, redacted; no copy. |

Window phrases for S10: Day `today`, Week `this week`, 30 days `in the last 30 days`.
