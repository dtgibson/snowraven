# Strategic Brief — Command Palette

## What We're Building

A modal search overlay, opened with Cmd-K / Ctrl-K from anywhere in the app (and by a
visible control at every nav density), that takes the user straight to a thing they can
name: one of the eleven destinations, or any species in their own eBird backup. Type a
few letters, press Enter, arrive.

## Why Now

The nav rework (v1.0.17) answered *"where am I and how do I get to the next screen"* and
deliberately left *"take me straight to a thing I can name"* unanswered, because folding
the second into a navigation change would have been scope growth into every tab's data.
That second question is now the app's most conspicuous gap, and its ground was just laid
and is still fresh: `TAB_LABELS` in `lib/tabLayout.ts` is the authoritative destination
list, `lib/tabIcons.tsx` the authoritative glyph table at four scales, and the More sheet
already proves the exact overlay behaviours this needs — scrim, `role="dialog"`
`aria-modal="true"`, the shared `useFocusTrap`, one close path for Escape / backdrop /
selection, focus returned to the opener.

The species half is nearly as well provisioned, and that is what makes this the right
build rather than a big one. `navigateToSpeciesDetail(commonName)` already exists at App
level and is already used by Statistics and the Map Explorer. `SpeciesCombobox` already
ships a tested, three-times-reused species picker with a proper combobox / listbox /
`aria-activedescendant` model and case-insensitive substring matching over common **and**
scientific name. `loadEbirdObservations()` is a memoized shared parse that App.tsx already
imports statically. The feature is mostly composition of parts that are already proven,
which is a good reason to do it while that is still true.

## The User Problem

SnowRaven's user knows the name of the thing they want. They are looking at the Calendar
and think "what does my Wilson's Warbler history look like" — and today that takes
switching to Species Detail (a lazy chunk mount and a parse wait), finding the species
picker at the top of it, and typing. From Breeding Codes or Checklists or the Map Explorer
it is the same three-step detour every time. The app has eleven destinations and, on this
user's export, roughly a thousand species; every one of them is a thing they can name from
memory, and none of them is reachable by naming it.

The nav rework made all eleven destinations visible and one press away. It did nothing for
the thousand. Recall is the fastest input a keyboard user has, and this app currently
offers no way to use it.

## Success Criteria

- From any tab, on any platform with a keyboard: press Cmd-K (or Ctrl-K), type three or
  four letters of a species name, press Enter, and Species Detail is open on that species.
- Typing a destination name and pressing Enter switches to it, in no more keystrokes than
  reaching it through the nav would have taken.
- The palette opens instantly on a cold start, before any export has been parsed:
  destinations are searchable immediately, and species appear in the same open session
  once the shared parse lands, with no need to close and reopen.
- A person on an iPhone with no hardware keyboard can find and use the palette, and is
  never shown a keyboard hint they have no way to press.
- Escape closes it and focus returns to whatever the user was doing. Tab does not escape
  the overlay on any of the six platforms, including the three Apple ones where WebKit's
  default tab mode is in force.
- With no eBird file loaded, or with a parse that failed, the palette still works for
  destinations and says something honest about the species half — it never shows a
  spinner that outlives the answer, and never offers species from a file the user deleted.
- First paint is unchanged: `entryChunk.test.ts` passes with no new module on App.tsx's
  static graph beyond the shortcut listener itself.
- `PRIVACY_POLICY.md` needs no edit, because the feature makes no network call and stores
  nothing.

## Scope

- **A palette overlay** — scrim, one query input, a grouped result list, keyboard-driven.
  Rendered above everything, on every density.
- **Two result kinds, in this order:** destinations, then species.
- **Destinations** come from `visibleTabs(tabLayout)` plus Settings, labelled from
  `TAB_LABELS` and drawn with `TAB_ICONS` — the same three sources the nav itself reads,
  with no parallel list anywhere.
- **Species** come from the distinct species in the shared parsed observations, matched
  case-insensitively over common **and** scientific name (`SpeciesCombobox`'s exact
  contract), rendered through `<BirdName>` per `.claude/rules/bird-names.md`.
- **Selecting a species** calls the existing `navigateToSpeciesDetail(commonName)`.
- **Invocation:** Cmd-K and Ctrl-K, plus a visible affordance at every nav density (see
  Key Decisions 2 and 3).
- **Keyboard model:** the combobox pattern — the input holds focus, Up/Down move
  `aria-activedescendant` through the results, Enter selects, Escape closes, focus returns
  to the opener.
- **Empty query** shows the destination list, so the palette is usable as a plain nav jump
  with nothing typed.
- **Honest states** for no matches, for no eBird file, and for a species index not ready
  yet — none of which blocks the destination results.
- **Lazy loading** — the palette and its index code arrive via `import()` on first invoke.
- **The standing docs sweep** — `docs/HELP.md`, `README.md`, `website/`, and
  `ACCESSIBILITY.md` if the tab-order exclusion roster gains a row.

## Out of Scope

- **County, hotspot, location and checklist search.** The strongest cut, and the reason is
  structural rather than effort: none of them has a destination to land on. There is no
  "county detail" screen and no by-name deep link into the Map Explorer, so a county
  result would first require inventing an entry point on a lazily-loaded, maplibre-coupled
  tab — a Map Explorer feature wearing a palette's clothes. Checklists are IDs the user
  pastes, not names they recall. Revisit once (and if) the Map Explorer grows a by-name
  entry point of its own.
- **An action / command registry** — "clear my data", "check for updates", "restore
  default tab order". This would make the palette a second source of truth for every
  control in the app, with no mechanism keeping the two in step. Deliberately declined.
- **Media search across the Macaulay export** as a second index.
- **Recency, frecency, history and pinned results.** Earn them from a shipped plain
  version, not before it.
- **Fuzzy matching.** Substring is what the app's three shipped pickers do; a second
  matcher would make the same query behave two different ways in one app.
- **`/` as a bare-key shortcut.** This app is full of text inputs (the checklist ID field,
  three species pickers, the map search) and a bare-key trigger would fight all of them.
- **Reaching a hidden destination.** Hiding a tab is a stated preference and the panel
  behind it is not what the nav offers; the palette shows what the nav shows.
- **Merging with, replacing, or re-implementing the More sheet.**
- **Any new network call, persisted document, cache, `CACHED_GET_PATHS` entry, or
  `clearDerived.ts` row.**

## Key Decisions

**1. Scope is destinations plus species — not destinations alone, and not everything.**
Destinations-only was rejected as too thin to be a feature: the nav rework just put all
eleven one press from a permanently visible sidebar or rail, so a palette that reached only
those would be a keyboard alias for a control already on screen. It is the smallest
version, but not the smallest version that solves the stated problem. Full content search
was rejected as the scope growth the nav rework already refused once. Species is the one
content type that clears every bar: it has a landing destination that exists, an App-level
navigation handler that exists, a data source that is a derivation of a parse the app
already shares and App.tsx already imports, matching semantics already shipped and tested
three times, and it is the thing a birder actually names. **The stated cost:** a user who
wants "take me to Yolo County" or "open checklist S12345678" will not get it, and that is
accepted rather than deferred quietly.

**2. Cmd-K and Ctrl-K are both accepted on every platform; the displayed hint follows the
running one.** Accepting both means muscle memory travels between a user's Mac and their
PC. `isMacOS()` / `isWindows()` / `isIOS()` already exist in `lib/platform.ts` for the
hint. The listener must `preventDefault()` so the web/Pi build does not hand the chord to
the browser. Flagged for the Architect: `isMacOS()` is Tauri's sync `platform()` probe and
is false on web/Pi, so a Mac user in the browser build would be shown the Ctrl-K hint —
either add a userAgent fallback for the hint only, or show both chords there.

**3. This is not a desktop-only feature, and the phone bar's anatomy does not change.**
The sidebar and the rail get a search control at the top of the nav column, where it
belongs on a navigation surface. The phone bottom bar keeps its shipped four-favourites-
plus-More anatomy — a fifth cell would undo a decision v1.0.17 made deliberately — so the
phone's entry point is a search row pinned at the top of the More sheet, which opens the
palette as its own surface. One tap from the bar, and no merge.

**4. The palette is a distinct surface from the More sheet, and stays one.** They differ
in every dimension that matters: the More sheet holds a fixed, known list of eleven
destinations and you open it to *see what is there*; the palette queries an open-ended set
of roughly a thousand things you *name from memory*. The sheet exists at one density; the
palette exists at all of them. Merging them would put a text field in a bottom sheet on
one platform and leave the other five with no palette at all. What the palette *does*
borrow is every behaviour the sheet already proves — the scrim, `role="dialog"`
`aria-modal="true"`, the shared `useFocusTrap`, one close path for Escape / backdrop /
selection, and focus returned to the opener — and beyond that hook it shares no code.

**5. The combobox pattern, and it is the WebKit-safe choice as well as the correct one.**
`role="combobox"` on the input, `role="listbox"` on the results, `role="option"` rows
driven by `aria-activedescendant` — `SpeciesCombobox`'s shipped model, not a list of
buttons. That makes the only tab stop inside the overlay a native `<input>`, which
WebKit's default tab mode does visit, so the focus trap's keydown end-wrap arm predicts
the engine's real order *by construction* — which is exactly the property
`NavMoreSheet`'s header says its own containment rests on, obtained here for free rather
than by remembering to mark every row. Any intrinsic `<button>` or `<a href>` the palette
renders still carries a literal `tabIndex={0}` per `.claude/rules/ui.md`. `role="option"`
rows are neither, so `tabOrderCoverage.test.ts` does not see them; if this introduces a
third activedescendant group, `ACCESSIBILITY.md`'s exclusion roster and the guard's roster
are updated in the same change. WCAG 2.1 AA holds at 320px and 200% in-app text scale,
which on a phone means a full-height sheet rather than a centred box. Every colour through
`var(--sr-*)` in both themes.

**6. The species index is derived, in-memory, and dies with the parse.** It comes from
`loadEbirdObservations()` — the existing memoized shared parse — and is not a new cache, a
new persisted document, or a new network call, so it needs no `clearDerived.ts` row and no
`PRIVACY_POLICY.md` change. Opening the palette may kick that parse if nothing else has
yet, but must never block on it: destinations render immediately and species join the
same open session when the index is ready. The index keys off `useFilesEpoch()` per
`lib/filesChanged.ts`, so replacing or deleting the eBird file cannot leave the palette
offering species from a file that is gone.

**7. Single source of truth for destinations.** Results are read from `TAB_LABELS`,
`TAB_ICONS` and `visibleTabs()`, never a hand-maintained parallel list. A destination
added in a future release appears in the palette by existing, with no registration step.
This is what keeps a cross-cutting index from becoming a standing maintenance tax — and it
is the answer to the one alignment tension worth naming: the palette is the first surface
in this app organized by *content* rather than by *destination*, which is a natural next
move after the nav rework, but only stays cheap if it derives everything and owns nothing.

**8. Entry-chunk discipline.** The palette component and its index code load via
`import()` on first invoke; only the key listener and the affordance markup ride the entry
chunk. `entryChunk.test.ts` is the live guard. `SpeciesCombobox` and `<BirdName>` are off
the entry graph today (all their consumers are lazy) and must stay off it.

**9. Escape layering needs deciding, not discovering.** The app has a documented two-layer
Escape story — `SharePopup`'s capture-phase listener with `stopPropagation` as the
innermost dismiss, then the map fullscreen overlay's bubble-phase handler. The palette is
a third layer, and it can be opened while the fullscreen map has `inert` on the nav. The
Architect should settle the ordering explicitly (the palette is the outermost surface, so
its Escape should win while it is open, and the map's `inert` must not swallow the
overlay) rather than let it fall out of listener registration order.

**10. Strategic alignment, checked on the record.** Same user as the founding brief — a
birder exploring their own records. Consistent with the core purpose: a faster route to
"richer ways to look at your own data". It touches none of the founding Out of Scope
(no accounts, no server, no telemetry, no data leaving the device) and is, unusually, a
feature with no privacy surface at all: everything it reads is already parsed and already
local. It reinforces rather than dilutes the founding decision to ship one frontend to
macOS, Windows, iOS and the Pi, provided decision 3 holds and it does not become a
desktop-only convenience.
