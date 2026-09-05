# PRD — Command Palette
**Feature:** command-palette
**Date:** 2026-09-05
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A modal search overlay, opened with Cmd-K or Ctrl-K from anywhere in the app and by a
visible control at every navigation density, that takes the user directly to a thing they
can name: one of the app's destinations, or any species in their own eBird backup. It
derives everything it offers from sources that already exist (`TAB_LABELS`, `TAB_ICONS`,
`visibleTabs()`, the shared `loadEbirdObservations()` parse) and owns no data of its own.

---

## User Stories

> **US-01** — As a birder looking at the Calendar, I want to press Cmd-K, type four letters
> of a species name and press Enter, so that Species Detail opens on that species without
> me switching tabs and hunting for the picker first.

> **US-02** — As a keyboard user on any tab, I want to press Cmd-K, type a destination name
> and press Enter, so that I reach that screen in no more keystrokes than the navigation
> would have taken.

> **US-03** — As a Windows user who also owns a Mac, I want Ctrl-K and Cmd-K both to work
> wherever I am, so that one piece of muscle memory travels between my machines.

> **US-04** — As someone who has just launched the app and not opened a data tab yet, I want
> the palette to open instantly and let me jump to a destination, so that a background parse
> of my backup never stands between me and a screen I asked for.

> **US-05** — As an iPhone user with no hardware keyboard, I want to reach the palette by
> touch and never be shown a key combination I cannot press, so that the feature is honestly
> mine as well.

> **US-06** — As a user who has not saved an eBird backup, or whose saved backup will not
> load, I want the palette to tell me which of those it is and still take me to
> destinations, so that a missing file never presents itself as an empty or spinning screen.

> **US-07** — As a screen reader and keyboard-only user on the Mac, iPhone or iPad, I want
> Tab to stay inside the palette and Escape to close it and hand focus back to where I was,
> so that the overlay is operable on the platforms whose engine skips ordinary controls.

---

## Functional Requirements

### A. Invocation and entry points

> **FR-01** — The app shall open the palette when the user presses Cmd-K or Ctrl-K, from any
> tab and on every shipped platform. Both chords shall be accepted on every platform.

> **FR-02** — The chord listener shall call `preventDefault()` on a handled press, so the
> web and Raspberry Pi builds do not hand the chord to the host browser.

> **FR-03** — The chord shall be honoured regardless of which element holds focus, including
> while a text input, textarea or contenteditable has focus. (A modifier chord, unlike a bare
> key, does not compete with the app's text fields; a bare-key trigger is out of scope.)

> **FR-04** — Pressing the chord while the palette is open shall close it through the same
> close path as Escape, returning focus to the control that opened it.

> **FR-05** — At sidebar density the navigation shall carry a visible search control at the
> top of the navigation column, between the brand and tagline block and the destination list.
> It shall **not** be a child of the `role="tablist"` group, which holds `role="tab"` children
> only.

> **FR-06** — At rail density the same control shall appear as an icon at the top of the icon
> column, carrying its name through the rail's shipped hover, keyboard-focus and touch-hold
> name treatment, and exposing that name to assistive technology whether or not the label is
> visible.

> **FR-07** — At phone density the palette's entry point shall be a search row pinned at the
> top of the More sheet. The bottom bar's shipped anatomy (the first four visible
> destinations plus More) shall not change, and no fifth cell shall be added.
>
> *Stated consequence, accepted rather than solved:* at phone density `App.tsx` omits the
> navigation entirely while a map is expanded to fullscreen (it is removed, not marked
> `inert`), so in that one state a phone has no visible palette entry point. The user leaves
> fullscreen first. No new entry point shall be invented for it.

> **FR-08** — Activating the phone entry point shall close the More sheet and open the
> palette. Because the row unmounts with the sheet, closing the palette shall return focus to
> the More button in the bottom bar.

> **FR-09** — Every entry-point control shall be a `<button>` carrying a literal
> `tabIndex={0}` and an accessible name.

### B. Overlay shell and dismissal

> **FR-10** — The palette shall render as a modal overlay above every other surface, with
> `role="dialog"`, `aria-modal="true"`, and a backdrop painted with `--sr-scrim`.

> **FR-11** — Escape, a backdrop press, selecting a result, and a second press of the chord
> shall all close the palette through one close function.

> **FR-12** — Closing the palette shall return focus to the control that opened it. Where
> that control has unmounted (FR-08) or sits inside an `inert` subtree (FR-14), focus shall
> go to a stated fallback rather than to `<body>`.

> **FR-13** — Opening the palette shall move focus into the query input, and the query input
> shall be empty on every open. The palette shall not remember the previous query.

> **FR-14** — The palette shall render outside any `inert` subtree, so that it is fully
> operable while an expanded fullscreen map has marked the navigation `inert`.

> **FR-15** — Tab and Shift-Tab shall not move focus to any control behind the overlay, on
> any shipped platform, including the three that run WebKit's default tab mode.

### C. Destination results

> **FR-16** — Destination rows shall be derived from `visibleTabs(layout)` plus Settings
> appended last (Settings is not a `ConfigurableTab` and every nav renderer appends it
> itself), labelled from `TAB_LABELS`, and drawn with `TAB_ICONS`, which already carries a
> glyph for `'settings'`. The palette shall hold no hand-maintained list of destinations, so a
> destination added in a future release appears in the palette with no registration step. The
> icon scale shall come from the `NAV_ICON` presets rather than a new number.

> **FR-17** — Destination rows shall appear in the user's saved tab order, with Settings last.

> **FR-18** — A destination the user has hidden in Settings shall not appear as a destination
> row.

> **FR-19** — Selecting a destination row shall switch to that tab and close the palette.

> **FR-20** — Destination rows shall render on open with no wait, before any attempt to read
> or parse the eBird backup, and shall never be blocked, delayed or hidden by the state of the
> species half.

> **FR-21** — With an empty query, the palette shall show the full destination list, so it is
> usable as a plain navigation jump with nothing typed.

### D. Species results

> **FR-22** — Species rows shall be derived from the distinct `commonName` / `scientificName`
> pairs present in the `ObservationEntry[]` returned by `loadEbirdObservations()`. The palette
> shall make no network call and shall create no persisted document, cache, or file of its own.

> **FR-23** — Matching shall be case-insensitive substring over common name **and** scientific
> name, identical to the predicate `SpeciesCombobox` ships: the query is trimmed and
> lowercased, and a row matches when its lowercased common name contains the query or its
> lowercased scientific name contains the query. The predicate shall be single-sourced with,
> or asserted equivalent to, the shipped one.

> **FR-24** — With an empty query, no species rows shall render.

> **FR-25** — Species rows shall be ordered alphabetically by common name, case-insensitively
> ascending, and the order shall be deterministic and identical on every platform.

> **FR-26** — Species rows shall be capped at 50. When more rows match, the palette shall
> render one non-selectable line stating that it is showing the first 50 matches and to keep
> typing to narrow them. Destination rows shall never be capped.

> **FR-27** — A species row shall render the common name as escaped plain text with the
> scientific name muted beside it, following the shipped `SpeciesCombobox` row convention.
> `<BirdName>` shall **not** be rendered inside the listbox: it composes a button and two
> anchors, which would nest interactive controls inside `role="option"` and add tab stops
> inside the overlay. This is the standing form-control exclusion in
> `.claude/rules/bird-names.md` and `pipeline/design-system.md`.

> **FR-28** — Selecting a species row shall call the existing `navigateToSpeciesDetail(commonName)`
> and close the palette.

> **FR-29** — Species rows shall remain available and shall navigate to Species Detail even
> when the Species Detail tab is hidden in the user's layout, matching the shipped behaviour
> of every other cross-tab species link (Statistics, Map Explorer, `BirdName`). The
> "the palette shows what the nav shows" rule governs destination rows only.

> **FR-30** — The species index shall include every distinct name the parse yields, including
> subspecies and other forms and species Species Detail hides at its defaults. Where a
> selected species would be hidden by a Species Detail switch, the shipped reveal behaviour
> (v1.0.18) applies and the species opens rather than being dropped silently.

> **FR-31** — The species index shall be rebuilt when the files epoch changes
> (`useFilesEpoch()` / `lib/filesChanged.ts`), so that replacing or clearing the eBird backup
> cannot leave the palette offering species from a file that is gone, and so the change is
> seen without a relaunch.

> **FR-32** — Opening the palette may start the shared parse if nothing else has, but shall
> never block on it. Species rows shall join the same open session when the parse lands, with
> no need to close and reopen the palette.

### E. States of the species half

Each of the four is a distinct observable state. None of them blocks, hides, or delays the
destination results (FR-20).

> **FR-33 — No backup saved.** Where `storage.getFilesStatus()` reports no stored eBird file,
> the palette shall state that searching species needs an eBird backup and point at Settings,
> using the app's existing setup wording rather than new copy.

> **FR-34 — Parse in flight.** While the shared parse has been started and has not settled,
> the palette shall show a loading line for the species half only. That line shall be replaced
> by results or by a terminal state (FR-33, FR-35, FR-36) and shall never outlive the answer.

> **FR-35 — Stored backup that will not load.** Where a file **is** stored and
> `loadEbirdObservations()` resolves falsy, the palette shall render `EBIRD_BACKUP_LOAD_ERROR`
> from `frontend/src/components/setupCopy.tsx` verbatim, and the palette shall be added to
> `frontend/src/components/honestLoadFailures.test.tsx`'s surface-by-surface roster.

> **FR-36 — No matches.** Where a non-empty query matches neither a destination nor a species
> and the species index is loaded, the palette shall render one line saying nothing matches.
> This state shall be distinguishable from FR-33, FR-34 and FR-35.

> **FR-37** — The palette shall not introduce a live region that is created together with its
> first message. Any status region it renders shall be present in the accessibility tree from
> first open, empty, per the standing rule in `.claude/rules/ui.md`.

### F. Keyboard and ARIA model

> **FR-38** — The palette shall use the combobox pattern: `role="combobox"` on the query
> input with `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` and
> `aria-activedescendant`; `role="listbox"` on the results container; `role="option"` with
> `aria-selected` on each row.

> **FR-39** — ArrowDown and ArrowUp shall move the active option through the whole result
> list, crossing the boundary between the destination group and the species group. Both shall
> **clamp** at the ends rather than wrapping, matching the shipped `SpeciesCombobox` (whose
> `activeIdx` is clamped, not wrapped), so the two surfaces do not answer the same key
> differently. The active option shall be scrolled into view.

> **FR-40** — Enter shall activate the active option. With no active option and at least one
> result, Enter shall activate the first row.

> **FR-41** — Group headings ("Destinations", "Species") and any state or cap line shall not
> be options, shall not be focusable, and shall not be reachable by the arrow keys.

> **FR-42** — The only tab stop inside the overlay shall be the query input, plus any
> `<button>` the palette itself draws (for example a close control), each carrying a literal
> `tabIndex={0}`.

> **FR-43** — Every `<button>` and every `<a href>` this change renders, in the palette and in
> its entry-point controls, shall carry a literal `tabIndex={0}`, per `.claude/rules/ui.md`.

> **FR-44** — As specified, the palette introduces no control that must be kept out of the tab
> order, so neither roster grows: the `EXCLUSIONS` array in
> `frontend/src/lib/tabOrderCoverage.test.ts` stays at its four rows (main nav tablist,
> Settings RadioGroups, the `SpeciesCombobox` chevron, the `SnowMap` offline base-map button),
> and `ACCESSIBILITY.md`'s published Keyboard Navigation roster stays at its three items (the
> fourth is published separately under Offline States, being a native-`disabled` case rather
> than a reached-by-a-neighbour case). If the implementation nevertheless introduces an
> exclusion, both shall be updated in the same change and shall agree.

### G. The platform hint

> **FR-45** — A single helper shall resolve the displayed chord to one of three values, in
> this order: (a) `isIOS()` true, or a coarse primary pointer
> (`matchMedia('(pointer: coarse)').matches`) — no chord; (b) `isMacOS()` true — Cmd; (c) not
> running under Tauri, and `navigator.userAgent` carries an Apple platform token — Cmd;
> (d) otherwise — Ctrl.

> **FR-46** — Where the helper resolves to no chord, the entry-point control shall render its
> name and no key hint at all. The user shall never be shown a chord they have no way to press.

> **FR-47** — The listener shall accept both chords on every platform regardless of what the
> hint displays (FR-01). The hint is presentation only.

> **FR-48** — The `navigator.userAgent` read in FR-45(c) is for the hint only. It shall not be
> used for capability branching, and its definition site shall say so, so it is not later
> mistaken for a platform predicate in the sense `lib/platform.ts` uses that word.

### H. Escape layering

> **FR-49** — While the palette is open, one press of Escape shall close the palette and
> nothing else. It shall not also exit an expanded fullscreen map, close a Map Explorer
> sidebar, or dismiss a `SharePopup` beneath it.
>
> *Observed ground the mechanism has to clear, for The Architect:* both shipped layers listen
> on `document`. `SharePopup` binds in the **capture** phase with `stopPropagation()`;
> `useMapFullscreen` binds in the **bubble** phase, armed only while expanded. Two capture-phase
> listeners on the same node fire in registration order, so "the outermost surface wins" cannot
> be left to fall out of registration order and must be settled explicitly.

> **FR-50** — While the palette is closed, Escape shall behave exactly as it does today on
> every surface, including `SharePopup`'s capture-phase dismiss and the fullscreen map's
> bubble-phase exit.

> **FR-51** — Opening the palette shall not close, dismiss, or otherwise alter any surface
> beneath it. A fullscreen map stays expanded, an open popup stays open, and a dropped share
> pin stays dropped.

### I. Documentation, published prose and release hygiene

> **FR-52** — `docs/HELP.md` shall be updated in the same change to describe the palette: how
> to open it on each platform, what it searches, and what each of the four species states
> means. If that adds a `##` section, `HelpDocs.tsx`'s hand-maintained TOC array shall gain the
> matching entry in the same change (guarded by `frontend/src/lib/helpToc.test.ts`).

> **FR-53** — `README.md` and `website/` shall be updated in the same change, beside the
> existing "Navigation that fits the window" material.

> **FR-54** — `ACCESSIBILITY.md` shall be updated in the same change to describe the palette's
> keyboard model, its focus containment and its Escape behaviour, alongside the existing
> species-selector combobox paragraph.

> **FR-55** — `PRIVACY_POLICY.md` shall require no edit; the change shall add no
> `clearDerived.ts` row, no `CACHED_GET_PATHS` entry, and no persisted document.

> **FR-56** — No em dash (U+2014) shall appear in any user-facing copy or published prose this
> change introduces. Every user-facing string the palette renders shall live in a copy module
> so it rides the repo's existing em-dash and agreement sweeps.

> **FR-57** — Every user-facing surface name in the palette, in the copy, and in the docs shall
> come from `TAB_LABELS` in `frontend/src/lib/tabLayout.ts`, never from a component or file
> name.

> **FR-58** — The change shall carry a patch version bump as the standing four-file set
> (`frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and
> `website/index.html`'s `version-pill` visible text, its `aria-label`, and the
> `footer-version` line). This build is part of a bundled Spool release, so the bump itself is
> performed once for the bundle at ship time rather than per feature; the requirement is that
> the shipped bundle carries all four in step.

---

## Non-Functional Requirements

> **NFR-01 — First paint / bundle:** The palette component, its species-index module,
> `SpeciesCombobox` and `BirdName` shall stay OFF App.tsx's static entry graph. Only the chord
> listener and the entry-point markup ride the entry chunk; the palette and its index arrive
> via `import()` on first invoke. `frontend/src/lib/entryChunk.test.ts` shall gain assertions
> covering both halves.

> **NFR-02 — Interaction performance:** Filtering shall stay under one frame (16 ms) per
> keystroke on an index of ~1,000 species on the slowest shipped platform. The index shall be
> built once per files epoch and memoized, never re-derived per keystroke, and the observations
> array shall not be re-walked on each render.

> **NFR-03 — Accessibility (layout):** WCAG 2.1 AA shall hold at 320px viewport width and at
> 200% in-app text scale. At phone width the palette shall be a full-height sheet rather than a
> centred box, so the query input and the first results remain visible with a software keyboard
> raised.

> **NFR-04 — Accessibility (focus):** Containment shall use the shared `lib/useFocusTrap.ts`.
> Whether `containOutsideFocus` is enabled is The Architect's call, and neither answer is free:
>
> - **Left at its default (false, as the More sheet ships it),** only the keydown end-wrap arm
>   runs, and that arm decides containment by predicting the engine's tab order. The prediction
>   is sound here **only** because every focusable inside the overlay is either a native
>   `<input>` (which WebKit's default tab mode visits) or a control carrying a literal
>   `tabIndex={0}` (FR-42, FR-43). That property is the requirement; adding any unmarked
>   focusable silently reopens the v1.0.15 hole.
> - **Enabled,** the `focusin` arm pulls focus back whenever it lands outside, and a focus
>   restore performed synchronously while the overlay is still mounted will be yanked back and
>   then dropped to `<body>` (the measured F061 defect in `NavMoreSheet`'s header). The restore
>   would then have to move into an effect that runs after the close commits, the
>   `restoreFiltersFocusRef` pattern in `MapExplorer.tsx`.
>
> Either way, FR-12 and FR-15 are the properties that must hold, and the containment test
> shall assert the property rather than the mechanism.

> **NFR-05 — Theming:** Every colour shall come from a `var(--sr-*)` token defined in both
> themes; no hardcoded hex or RGB. The backdrop shall use `--sr-scrim`; the panel shall use the
> app's surface, border and shadow tokens.

> **NFR-06 — Privacy and offline:** The feature shall make zero network calls and shall persist
> nothing. It shall be fully functional with no connection and with no API key, for both
> destinations and species.

> **NFR-07 — Security:** The query shall be used only as a lowercased substring needle through
> `String.prototype.includes`, never compiled into a `RegExp`, so no user input can drive
> backtracking on the main thread. Any accumulator keyed by a CSV-derived species name shall be
> built with `Object.create(null)` or a `Map`, and any object-literal lookup keyed by such a
> string shall be read through `Object.hasOwn`, per `.claude/rules/security.md`.

> **NFR-08 — Cross-platform:** The feature shall behave as specified on all six shipped
> targets: macOS desktop, Windows desktop, iPhone, iPad, web, and Raspberry Pi / self-hosted.

> **NFR-09 — Motion:** Any entrance animation shall respect the global reduced-motion rule and
> shall reuse the shipped listbox entrance timing rather than introducing a new curve.

> **NFR-10 — No new dependency:** The feature shall add no npm or Rust dependency.

> **NFR-11 — Testability:** Matching, ordering, capping and index derivation shall live as pure
> functions in a `lib/` module, unit-testable without mounting a component.

---

## Out of Scope

Carried from the strategic brief, and unchanged:

- **County, hotspot, location and checklist search.** None has a destination to land on;
  a county result would require inventing a by-name entry point on the Map Explorer first.
- **An action or command registry** ("clear my data", "check for updates", "restore default
  tab order"). Deliberately declined: it would make the palette a second source of truth for
  every control in the app.
- **Media search across the Macaulay Library export** as a second index.
- **Recency, frecency, search history, and pinned or recent results.**
- **Fuzzy matching.** Substring is what the app's shipped pickers do.
- **`/` as a bare-key shortcut.**
- **Reaching a hidden destination.** Hiding a tab is a stated preference; the palette's
  destination rows show what the navigation shows. (This governs destination rows only. See
  FR-29: a species row still opens Species Detail when that tab is hidden, matching every other
  cross-tab species link the app already ships.)
- **Merging with, replacing, or re-implementing the More sheet.** The palette borrows the
  sheet's overlay behaviours and shares no code with it beyond the focus-trap hook.
- **Any new network call, persisted document, cache, `CACHED_GET_PATHS` entry, or
  `clearDerived.ts` row.**

Added during PRD writing:

- **Rendering `<BirdName>` inside the palette's results.** Excluded on the standing
  form-control rule, not on effort (FR-27). The eBird and Birds of the World link marks are
  not available from a palette row; the user reaches them by opening the species.
- **Changing the bottom bar's anatomy** to add a fifth cell for search (FR-07).
- **Persisting anything about the palette** (last query, recent destinations, a "palette
  enabled" preference). The palette has no settings surface.
- **A palette entry point on any tab's own chrome.** The entry points are the navigation's,
  at the three densities, and the chord.
- **Ranking by match position, prefix weighting, or any scoring.** See Open Question 2.
- **Announcing result counts as a live region.** FR-37 forbids the insert-with-first-message
  shape; whether a count is announced at all is a Designer decision with a default of "no".

---

## Open Questions

Each carries the default the Engineer builds against if no answer arrives before Stage 5.

1. **The web and Raspberry Pi hint.** `isMacOS()` is Tauri's synchronous `platform()` probe
   and returns false on the browser build, so a Mac user in a browser would otherwise be shown
   the Ctrl-K hint. Options were a userAgent fallback for the hint only, or showing both chords.
   **Default: FR-45 as written** — a userAgent Apple-platform check for the hint only, gated
   behind the coarse-pointer suppression so an iPad's "Macintosh" userAgent never produces a
   chord on a touch surface.

2. **Species result ordering.** Plain alphabetical by common name treats "Bay-breasted Warbler"
   and "Warbling Vireo" identically for the query `war`; ordering prefix matches first would be
   more useful and is not fuzzy matching (the predicate would be unchanged). It would, however,
   make the palette order results differently from the app's three shipped pickers.
   **Default: FR-25 as written, plain alphabetical.** Prefix-first is a candidate follow-on
   earned from a shipped plain version.

3. **The species result cap.** 50 is a judgement, not a measurement.
   **Default: 50, with the "showing the first 50" line of FR-26.** If The Designer or a
   measurement prefers a different number, it is one constant.

4. **The phone entry point's placement.** The Strategist put a search row at the top of the
   More sheet, keeping the shipped four-favourites-plus-More bottom bar untouched and keeping
   the palette and the sheet as distinct surfaces (Key Decisions 3 and 4).
   **Default: FR-07 and FR-08 as written.** The Designer may revisit the placement within the
   More sheet, but not the constraint that the bottom bar's anatomy is unchanged and that the
   two surfaces stay distinct.

5. **The version number.** This build is one of several in a bundled Spool release, so the
   bundle owns the version and the four-file bump happens once at ship, not per feature.
   **Default: FR-58 as written** — the feature contributes its `CHANGELOG.md` entry and does
   not choose a number.

6. **Group heading wording.** "Destinations" is a word the app does not use on screen today
   (`docs/HELP.md` and the nav copy say "tabs"), while "Tabs" reads oddly against Settings.
   **Default: "Destinations" and "Species"**, both as copy-module constants so a change is one
   edit and rides the sweeps.

7. **Whether the palette's species half should honour the Species Detail display switches.**
   The palette could offer only what Species Detail shows at its defaults, or every distinct
   name and rely on the shipped reveal.
   **Default: FR-30 as written** — every distinct name, with the v1.0.18 reveal doing the work,
   because a user who names a subspecies should reach it.

8. **Whether the tab-order exclusion roster changes.** As specified it does not: the palette's
   rows are `role="option"` divs, which the AST guard does not see (it walks intrinsic
   `<button>` and `<a href>` only), and every button the palette draws carries `tabIndex={0}`.
   **Default: FR-44 as written** — `EXCLUSIONS` stays at four rows and `ACCESSIBILITY.md`'s
   published roster at three items; if the implementation introduces an exclusion, both move in
   the same change.

9. **Escape with a `SharePopup` open beneath the palette.** The palette is the outermost
   surface; `SharePopup` is the documented innermost dismiss layer.
   **Default: FR-49 as written** — while the palette is open its Escape wins and the popup is
   untouched; closing the palette restores the shipped layering exactly (FR-50).

10. **Whether the docs get a new `##` section or extend an existing one.**
    **Default: a new top-level section in `docs/HELP.md`** placed after "Getting Started",
    with the matching `HelpDocs.tsx` TOC entry (FR-52).

11. **Arrow-key behaviour at the ends of the list.** Many palettes wrap; the app's shipped
    `SpeciesCombobox` clamps. Wrapping would make the same key answer differently on two
    surfaces of the same app.
    **Default: FR-39 as written, clamped.**

12. **Whether `containOutsideFocus` is enabled on the focus trap.** NFR-04 sets out what each
    answer costs; the shipped More sheet leaves it off and rests containment on the markup.
    **Default: leave it at its default (off)**, since the combobox pattern already gives the
    markup property that makes the keydown arm's prediction correct.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Chord opens the palette (FR-01) | On each shipped platform, from a tab other than Settings, Cmd-K opens the palette; in a separate press, Ctrl-K opens it. Both work on every platform. |
| QA-02 | The chord is not handed to the browser (FR-02) | In the web build, pressing the chord does not trigger the browser's own Cmd-K/Ctrl-K behaviour; the handler's `preventDefault()` is asserted in a unit test. |
| QA-03 | Chord works from a text field (FR-03) | With focus in the Checklists comment search box and again in a species picker input, the chord opens the palette and the underlying field keeps its text. |
| QA-04 | Chord toggles closed (FR-04) | With the palette open and a query typed, pressing the chord closes it and focus is on the control that opened it. |
| QA-05 | Sidebar entry point (FR-05) | At sidebar density a search control renders at the top of the navigation column, above the first destination, and opens the palette when activated. |
| QA-06 | Rail entry point (FR-06) | At rail density the control renders as an icon at the top of the column; hovering, focusing it with the keyboard, and touch-holding each reveal its name; `getByRole('button', { name })` resolves it in both states. |
| QA-07 | Phone entry point, bar unchanged (FR-07) | At phone density the bottom bar holds exactly the first four visible destinations plus More, with no fifth cell; the More sheet's first row is the search row. |
| QA-08 | Phone open and focus return (FR-08) | Activating the More sheet's search row closes the sheet and opens the palette with focus in the query input; Escape closes the palette and focus lands on the bottom bar's More button. |
| QA-09 | Entry-point tab stops (FR-09, FR-43) | `tabOrderCoverage.test.ts` passes with the new files included, and every `<button>`/`<a href>` added by this change carries a literal `tabIndex={0}` in source. |
| QA-10 | Dialog semantics (FR-10) | The overlay root reports `role="dialog"` and `aria-modal="true"`; the backdrop's computed background resolves from `--sr-scrim`. |
| QA-11 | One close path (FR-11) | Escape, a backdrop press, selecting a destination, selecting a species, and a second chord press each close the palette, and each routes through the same close function (asserted by spying on it in a unit test). |
| QA-12 | Focus return (FR-12) | After each of the five close paths, `document.activeElement` is the opener; in the unmounted-opener case (QA-08) it is the stated fallback and never `<body>`. |
| QA-13 | Fresh query each open (FR-13) | Open, type "warb", close, reopen: the query input is empty and focused, and the destination list is shown. |
| QA-14 | Operable over an `inert` navigation (FR-14) | With a Species Detail map expanded to fullscreen (nav marked `inert`), the chord opens the palette, the query input accepts typing, and Enter navigates. |
| QA-15 | Focus containment (FR-15, NFR-04) | With the palette open, typing into a covered input behind the overlay after N Tab presses reads back empty, on the production build in both Chromium and WebKit (the v1.0.15 measurement method). A source assertion confirms every focusable inside the overlay is a native form control or carries a literal `tabIndex={0}`. |
| QA-16 | Destinations derive from one source (FR-16) | A test that adds a hypothetical tab id to `TAB_LABELS`/`TAB_ICONS`/the layout sees it appear as a palette destination row with no other edit; a source scan finds no hand-written destination list in the palette's files. |
| QA-17 | Destination order (FR-17) | With a reordered saved layout, the palette's destination rows appear in that saved order, Settings last. |
| QA-18 | Hidden destinations excluded (FR-18) | With Breeding Codes hidden in Settings, no destination row for it appears and typing its label yields no destination match. |
| QA-19 | Destination selection (FR-19) | Selecting a destination row switches `activeTab` to that id and the palette closes. |
| QA-20 | Destinations render before any parse (FR-20, FR-21) | On a cold start with no data tab yet opened, opening the palette renders the full destination list synchronously; a test that never resolves `loadEbirdObservations()` still shows and can select every destination. |
| QA-21 | Species come from the shared parse only (FR-22, NFR-06) | Over a full open, type, and select cycle, no request leaves the app (transport spy records zero calls) and no storage write occurs beyond what the shared parse already performs. |
| QA-22 | Matching predicate parity (FR-23) | A table of queries run against the same options through both `SpeciesCombobox`'s filter and the palette's returns identical result sets, including a scientific-name-only hit, a mixed-case query, and a query with leading and trailing spaces. |
| QA-23 | Empty query shows no species (FR-24) | With a loaded backup and an empty query, the results list contains destination rows only and zero `role="option"` species rows. |
| QA-24 | Species order (FR-25) | For a fixture with mixed-case names, species rows are alphabetical by common name, case-insensitively, and the same order is produced on two consecutive runs. |
| QA-25 | Species cap (FR-26) | A query matching 120 species renders exactly 50 species options plus one non-selectable line stating the first 50 are shown; a query matching 12 renders 12 and no line. Destination rows are never capped. |
| QA-26 | Row rendering (FR-27) | Species rows render the common name as text with a muted scientific name; the palette's source contains no `BirdName` import and the rendered listbox contains no `<a href>` and no nested `<button>`. |
| QA-27 | Species selection (FR-28) | Selecting a species row calls `navigateToSpeciesDetail` with that exact common name and closes the palette; Species Detail opens on that species. |
| QA-28 | Hidden Species Detail (FR-29) | With Species Detail hidden in the layout, species rows still appear and selecting one still opens Species Detail on that species. |
| QA-29 | Forms and hidden species reveal (FR-30) | Selecting a subspecies form, and separately a species hidden by a Species Detail default switch, opens Species Detail on it with the relevant switch revealed rather than landing on an empty selector. |
| QA-30 | Files epoch invalidation (FR-31) | With the palette open, clearing the eBird backup in Settings moves the species half to the no-backup state (FR-33) without a relaunch; uploading a different backup yields that file's species. |
| QA-31 | Species join an open session (FR-32) | Open the palette on a cold start, type a query while the parse is in flight, and the matching species rows appear in the same open session with no close and reopen. |
| QA-32 | No backup saved (FR-33) | With no eBird file stored, the species half states that species search needs a backup and points at Settings; destination rows are unaffected and selectable. |
| QA-33 | Parse in flight (FR-34) | While the parse is pending, the species half shows its loading line; when the parse settles the line is replaced by results or by a terminal state, and it is never present at the same time as either. |
| QA-34 | Load failure copy (FR-35) | With a stored file whose load resolves falsy, the palette renders the exact `EBIRD_BACKUP_LOAD_ERROR` string, and `honestLoadFailures.test.tsx` carries a palette row asserting it. |
| QA-35 | No matches (FR-36) | With a loaded backup and the query "zzzzqq", the palette shows one no-matches line, and that line's text differs from the three states in QA-32, QA-33 and QA-34. |
| QA-36 | Live-region shape (FR-37) | Any `role="status"` or `role="alert"` region the palette renders exists, empty, in the commit before its first message; a stylesheet scan finds no rule setting a hiding value on it or any ancestor. |
| QA-37 | Combobox wiring (FR-38) | The query input reports `role="combobox"`, `aria-expanded`, `aria-controls` resolving to the listbox, `aria-autocomplete="list"`, and `aria-activedescendant` matching the active row's id; each row reports `role="option"` and `aria-selected`. |
| QA-38 | Arrow navigation across groups (FR-39) | From the last destination row, ArrowDown moves the active option to the first species row. ArrowUp on the first row and ArrowDown on the last both leave the active option where it is (clamped, not wrapped), matching `SpeciesCombobox`. The active option is scrolled into view. |
| QA-39 | Enter behaviour (FR-40) | With an active option, Enter activates it. With results and no active option, Enter activates the first row. With no results, Enter does nothing and the palette stays open. |
| QA-40 | Headings are not options (FR-41) | Group headings and the cap and state lines carry no `role="option"`, are not focusable, and are skipped by ArrowDown and ArrowUp. |
| QA-41 | Single tab stop (FR-42) | Inside the open overlay the only focusable elements are the query input and any palette-drawn button, each with an explicit `tabIndex`; no `role="option"` row is focusable. |
| QA-42 | Exclusion roster (FR-44) | `tabOrderCoverage.test.ts` passes with its `EXCLUSIONS` array still at four rows and `ACCESSIBILITY.md`'s Keyboard Navigation roster still at three items; if a row was added, both carry it and agree. |
| QA-43 | Hint resolution (FR-45) | A unit table over the helper returns: iOS build -> none; coarse pointer -> none; macOS desktop -> Cmd; Windows desktop -> Ctrl; web with an Apple userAgent and a fine pointer -> Cmd; web with a Windows or Linux userAgent -> Ctrl. |
| QA-44 | No unpressable hint (FR-46) | In the iOS build and in a coarse-pointer web context, the entry-point control renders its name and no key hint; a text scan of the rendered control finds neither "Cmd" nor "Ctrl" nor the command glyph. |
| QA-45 | Both chords regardless of hint (FR-47) | In a context resolving to the Ctrl hint, Cmd-K still opens the palette, and the reverse. |
| QA-46 | UserAgent read is hint-only (FR-48) | A source scan finds the userAgent read only in the hint helper, and the helper's definition site carries the stated boundary comment; `lib/platform.ts` is unchanged. |
| QA-47 | Escape does one thing (FR-49) | With a fullscreen map expanded and the palette open over it, one Escape closes the palette and the map is still fullscreen. Repeated with a Map Explorer sidebar open, and with a `SharePopup` open. |
| QA-48 | Escape unchanged when closed (FR-50) | With the palette closed, `SharePopup`'s Escape dismiss and the fullscreen map's Escape exit behave exactly as they do on the previous release; their existing tests pass unchanged. |
| QA-49 | Opening disturbs nothing (FR-51) | Opening and closing the palette over a fullscreen map with an open popup and a dropped share pin leaves all three exactly as they were. |
| QA-50 | HELP and its TOC (FR-52) | `docs/HELP.md` documents the palette including all four species states; `helpToc.test.ts` passes, and the new section is reachable from the in-app Help sidebar. |
| QA-51 | README and website (FR-53) | `README.md` and `website/index.html` describe the palette, and the website's published copy matches the shipped behaviour (predicate checked against the code, not paraphrased). |
| QA-52 | Accessibility statement (FR-54) | `ACCESSIBILITY.md` describes the palette's keyboard model, focus containment and Escape behaviour, and every claim it makes is checkable against the shipped source. |
| QA-53 | No privacy surface (FR-55) | `PRIVACY_POLICY.md` is unchanged; the diff adds no `clearDerived.ts` row, no `CACHED_GET_PATHS` entry, and no new persisted document; `cacheInventory.test.ts` is unchanged. |
| QA-54 | No em dashes (FR-56) | `grep -n '—'` over the new copy module, `docs/HELP.md`, `README.md`, `ACCESSIBILITY.md` and `website/index.html` is clean; every palette string resolves from the copy module. |
| QA-55 | Surface names (FR-57) | Every destination name the palette and the docs show matches `TAB_LABELS`; in particular the `life-list` destination reads "Multimedia" and `birding-stats` reads "Statistics". |
| QA-56 | Version four-file set (FR-58) | At ship, `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md` and `website/index.html` (pill text, pill `aria-label`, `footer-version`) all carry the same version; the parity guard in `icloudKeysPublishedClaims.test.ts` passes and each of the three website occurrences is checked by eye as well, given the guard's known substring weakness. |
| QA-57 | Entry chunk (NFR-01) | `entryChunk.test.ts` asserts the palette component, its index module, `SpeciesCombobox` and `BirdName` are absent from the entry chunk, and that the chord listener is present; the full suite passes. |
| QA-58 | Filter performance (NFR-02) | Over a ~1,000-species index, a keystroke's filter-and-sort completes in under 16 ms on a quiet machine; the index is derived once per files epoch (a spy on the derivation counts one call across ten keystrokes). |
| QA-59 | 320px and 200% (NFR-03) | At 320px width and 200% in-app text scale, the palette renders as a full-height sheet with the query input and at least one result visible, nothing clipped, no horizontal page scroll, and AA contrast on every text pair in both themes. |
| QA-60 | Tokens only (NFR-05) | A source scan of the palette's files finds no hardcoded hex or rgb() colour; every colour resolves from a `var(--sr-*)` token defined in both `:root` and `[data-theme="dark"]`. |
| QA-61 | Offline (NFR-06) | With the network disabled and no API key entered, the palette opens, lists destinations, matches species from a loaded backup, and navigates. |
| QA-62 | Security posture (NFR-07) | A source scan of the palette's files finds no `new RegExp` and no regex literal built from the query; any name-keyed accumulator is a `Map` or `Object.create(null)`, and a test feeding the queries `constructor`, `__proto__` and `toString` returns ordinary no-match or match results with no thrown error and no prototype change. |
| QA-63 | Six platforms (NFR-08) | The feature is exercised on macOS desktop, Windows desktop, iPhone, iPad, web and the self-hosted build, and QA-01, QA-15, QA-27 and QA-47 pass on each. |
| QA-64 | Reduced motion (NFR-09) | With `prefers-reduced-motion: reduce`, the palette appears with no transition; without it, the entrance matches the shipped listbox timing. |
| QA-65 | No new dependency (NFR-10) | `frontend/package.json` and `src-tauri/Cargo.toml` gain no dependency; the lockfiles show no new package. |
| QA-66 | Pure core (NFR-11) | Matching, ordering, capping and index derivation are exported from a `lib/` module and are covered by unit tests that mount no component. |
