# Design Spec: Widget measure-from choice

Improve lane, design pass (Stage 2), approved by the user on 2026-10-01 with
no changes to the first direction. The mockup is `design.html` in this folder
(served during the run at `https://hephaestus-developer.giraffe-chuckwalla.ts.net:8701/design.html`).
This refines five surfaces that already ship; it adds no screen, flow or
capability beyond the change brief's narrow shape. Every string below is
final and is the one `WidgetCopy.swift`, `Intents.swift`, `linkFocus.ts` and
`docs/HELP.md` should carry; the Engineer must not paraphrase.

## Visual Direction

Nothing visual is new. The Edit Widget sheet is iOS's own (App Intents), so
the design there is naming, order, defaults and second lines, rendered as iOS
renders them. The widget tile keeps the shipped v1.0.36 anatomy (header,
nearest-first rows with the distance as the single accented figure, muted
footer joined by middle dots) and only widens the rule for when one existing
footer caption appears. The Map Explorer landing reuses the alert link's
existing `fromPoint` wording. Quiet utility throughout: the choice reads as
the same choice Alerts and the Targets tab already offer, in the widget's own
words, and a widget placed before the update is pixel-identical after it.

## Screens / Views

### 1. Edit Widget sheet (Nearby Lifers and Media Targets)

Layout: unchanged iOS sheet (widget name and Done in the top bar, the medium
preview, then the grouped parameter list). One row is added.

- Parameter title: **Measure from**. The same words as Alerts' `MEASURE_LABEL`
  in Settings and the Targets tab's "Measure distances from" chooser.
- Position: Nearby Lifers, the **second** row (after Time range). Media
  Targets, the **third** row (after Time range and Media). The rows a birder
  already knows stay first.
- Values, in this order, with their second lines (the Media picker's
  register: one short clause saying what the value means):
  1. **My location** / *Where you are when the widget refreshes*
  2. **Default Location** / *The one saved in SnowRaven's Settings*
- Default: **My location**. This is today's behavior exactly: the device
  position at refresh, else the Default Location with the fallback caption,
  else the existing no-location sentence. A widget placed on a previous build
  picks up this default and changes nothing (the brief asks the Engineer to
  confirm this in the simulator).
- The row's value text is the chosen value's title ("My location" or
  "Default Location"), as Time range shows "Week".
- Key decisions: the second value is named **Default Location**, not Alerts'
  "Fixed place", because the widget's second value *is* the saved Default
  Location and nothing else, so its name says so (the Targets chooser already
  pairs "My location" with "Default Location", so both names exist in the
  app's vocabulary). "SnowRaven's Settings" in the second line is how every
  widget sentence already points at the app. No third value, no place
  search, no radius: out of scope.
- Intent descriptions (Shortcuts-facing, `IntentDescription`):
  - Nearby Lifers: **Choose the time range the widget lists and where it measures from.**
  - Media Targets: **Choose the time range and the media the widget lists, and where it measures from.**

### 2. The tile's footer caption

- The caption **From your default location** (existing string, unchanged)
  shows **whenever the list was measured from the Default Location, chosen or
  fallback**. Today it shows only as a fallback. The user chose this
  explicitly on 2026-10-01 (logged in `decisions.md`).
- Reason: on a mixed home screen (one widget on My location, one on Default
  Location) the caption is the only thing that tells the two tiles apart,
  since the tile never shows its settings. The sentence is true in both
  cases, and it stays one string, which the claims guard and HELP already
  name.
- Position and composition unchanged: first footer part, then the stale
  reason if any, then the update time; middle dots on screen, sentences in
  the VoiceOver label. Small shows the caption and keeps its rule of showing
  the update time only when stale.
- My location rows and footers are byte-identical to today, including the
  fallback case.

### 3. The no-Default-Location sentence (new state)

- Shown only on a widget set to Default Location when no Default Location is
  saved. No eBird request, no location read.
- Sentence: **Set a Default Location in SnowRaven's Settings, or switch this widget to My location.**
- Register: the existing state sentences (name the one thing in the way and
  the way out; no icon, no color; `MessageView`, footnote weight medium,
  caption on small). It names the value as the picker spells it ("My
  location") so the way back is findable. Fits the small tile at the default
  text size as the current no-location sentence does.
- The existing sentence **Open SnowRaven to allow location, or set a Default
  Location in Settings.** is unchanged and is reached only under My location.
- VoiceOver: the header label followed by the sentence, as every state.

### 4. Gallery and intent descriptions

The gallery description lives under the widget name in Add Widget. Only the
clause "where you are" changes.

- Nearby Lifers: **Recent eBird reports of species you still need, within 25
  miles of where you are or your Default Location, nearest first. Tap to open
  them in Map Explorer.**
- Media Targets: **Recent eBird reports of species you have recorded but
  still need a photo, audio or video of, within 25 miles of where you are or
  your Default Location, nearest first. Tap to open them in Map Explorer.**
- Intent descriptions: see surface 1.

### 5. Map Explorer landing after a tap

- When the widget's rows came from the Default Location (chosen **or**
  fallback), the link says so and Map Explorer searches from its saved
  Default Location with no location read, so the listed bird is on the map.
- Bird-tap landing line: **Finding {name}…** (the alert link's `fromPoint`
  form; today's widget form is "Finding {name} near you…", which stays for a
  list measured from the phone). With no name the app can vouch for:
  **Finding the bird you tapped…** (unchanged).
- View-tap landing line: **Finding nearby lifers…** / **Finding nearby media
  targets…** (unchanged; true from either point).
- The landing chip, the focus pill ("Only {name} · Show all"), the popup and
  the absent statement ("{name} was not found within 25 miles. Showing all
  lifers.") are the shipped Map Explorer's own and do not change.
- On the map the difference is the center: the search-center pin sits on the
  Default Location and there is no device dot, because nothing asked where
  the phone was.
- Mechanism (for the Engineer, bounded by the brief): the deep link's
  allowlist grammar grows by one bounded marker; a link without it lands as
  today, so older and newer builds of the widget and the app degrade to the
  view link.

## Component Usage

- Edit Widget sheet: App Intents `@Parameter` with an `AppEnum`
  (`DisplayRepresentation(title:subtitle:)`), exactly as `MediaOption` is
  built. System UI; nothing custom.
- Tile: the existing SwiftUI views (`HeaderView`, `RowList`, `OneBirdCard`,
  `MessageView`, `FooterView`) unchanged; `WidgetPresentation.make` composes
  the footer from a model flag that is now true for a chosen Default Location
  as well as the fallback.
- Landing: the existing `.sr-map-landing-chip` statement slot and
  `landingText(view, name, isBirdTap, fromPoint)`; the widget link sets
  `fromPoint` when the marker is present.

## Design Tokens Applied

No new tokens. Widget Color Sets as shipped: `WidgetText`, `WidgetMuted`
(the caption, the second lines' muted text are system-drawn in the sheet),
`WidgetAccent` (distance figures), `WidgetSeparator`. The sheet's checkmark
and chevrons are iOS's own. In-app landing chip: `--sr-surface`,
`--sr-border`, `--sr-text-muted`, as today.

## Interaction Notes

- Changing Measure from takes effect at the next refresh (WidgetKit reloads
  the timeline on a configuration change, as it does for Time range).
  Switching between the two points may refetch; the brief leaves the cache
  shape (one area or two) to the Engineer, with the request bound stated in
  HELP either way ("at most one eBird request per 15 minutes per area, so at
  most two" when a home screen mixes both choices).
- Default Location never calls the locator. A refresh measured from a chosen
  Default Location writes `cellSource: default-location`, so Alerts' My
  location still never treats it as "near you" (must not regress).
- The widget's accessibility label is composed as today: header, each row as
  a sentence, then the footer parts as sentences, so the caption is spoken
  whenever it is shown.
- A tap carries the measuring point; the map lands searched from it with no
  location read. Saved Radius and Default Location stay as they were.

## Motion Spec

Nothing new; the shipped motion is restated so it is not re-decided.

- Edit Widget picker checkmark: iOS's own selection animation, system
  default; nothing custom. (Mockup shows a 160 ms ease-out scale-and-fade in
  place as a stand-in.)
- Tile refresh after a setting change: `.contentTransition(.opacity)` on
  rows and the footer, `.numericText()` on distance figures, ~200 ms, origin
  in place; `.identity` under Reduce Motion. Lib: SwiftUI/WidgetKit.
- Landing chip: the shipped spinner, static under `prefers-reduced-motion`;
  text appears instantly. Lib: CSS, as today.
- Map landing pan to the selected sighting: unchanged (`setPanTarget`).

## Content Notes

Tone: the widget's own voice, one short sentence, no reassurance. American
spelling, no em dash anywhere, "SnowRaven's Settings" as the pointer at the
app, surfaces named from `TAB_LABELS` (Map Explorer). All strings live in
`WidgetCopy.swift` / `Intents.swift` so `widgetCopy.test.ts` scans them.

Final strings, by surface:

| Surface | String |
| --- | --- |
| Parameter title | Measure from |
| Value 1 | My location; second line: Where you are when the widget refreshes |
| Value 2 | Default Location; second line: The one saved in SnowRaven's Settings |
| Default | My location |
| Footer caption | From your default location (existing; now whenever measured from it) |
| New state sentence | Set a Default Location in SnowRaven's Settings, or switch this widget to My location. |
| Existing sentence (unchanged) | Open SnowRaven to allow location, or set a Default Location in Settings. |
| Gallery, Nearby Lifers | Recent eBird reports of species you still need, within 25 miles of where you are or your Default Location, nearest first. Tap to open them in Map Explorer. |
| Gallery, Media Targets | Recent eBird reports of species you have recorded but still need a photo, audio or video of, within 25 miles of where you are or your Default Location, nearest first. Tap to open them in Map Explorer. |
| Intent, Nearby Lifers | Choose the time range the widget lists and where it measures from. |
| Intent, Media Targets | Choose the time range and the media the widget lists, and where it measures from. |
| Landing, bird tap from the Default Location | Finding {name}… (no name: Finding the bird you tapped…) |
| Landing, view tap | Finding nearby lifers… / Finding nearby media targets… (unchanged) |

(No string contains an em dash.)

`docs/HELP.md` (Widgets, and the Default Location paragraph) is updated by
the Engineer in the same register, with no approval stop: the Settings
paragraph gains Measure from with both values and the default; "Where it
measures from" states that Default Location never reads location and shows
the caption; the sentence list gains the new sentence; "Keeping it current"
restates the request bound per area; "Tapping a widget" says a Default
Location list lands searched from the Default Location.

## Held published copy (not written; needs the user's express yes)

1. `PRIVACY_POLICY.md` and `website/privacy.html`, Your Location, after "the
   widget also reads your location each time iOS refreshes it...": proposed
   clause "A widget you set to measure from your Default Location reads no
   location and sends that saved point instead."
2. `appstore/LISTING.md`, App Review notes, widgets bullet: "Sends the
   device's coordinates (or, with location off, the saved Default Location)"
   becomes "Sends the device's coordinates (or the saved Default Location,
   when location is off or the widget is set to measure from it)".
3. The What's New line at ship, decided at the deploy gate with the version
   it ships in. README and `website/index.html` have no widget sentence and
   stay untouched.
