# Changelog

All notable changes to SnowRaven are documented here.

## [0.5.77] - 2026-08-06

### Internal
- **The "Disable embedded media" setting now has its second safety net actually connected.** The setting already worked, and still does: nothing about what you see changes in this release. The media player component carries its own independent check of the setting, on top of the check the surrounding page does, so that a future change to one cannot quietly re-enable players the other has switched off. That inner check was being handed a fixed "allowed" value instead of your real setting, which made it a formality rather than a safeguard. It is now given the real value on both the Named Birds media and Species Detail's Recent Media, and each is covered by its own test so neither can drift back on its own.
- **Dependency housekeeping.** Three advisories in the build-time toolchain (`brace-expansion`, `postcss`, `undici`) were cleared with a non-breaking update. These are development tools only, never shipped inside the app, and the app itself is unchanged by it.

### Documentation
- **The screenshots on the SnowRaven website are current again.** They had been frozen since v0.5.23 while the site's version label kept moving, so the page advertised a version it did not depict: 53 releases of drift, and two tabs (Calendar and Named Birds) that did not exist when the pictures were taken and had never been shown at all. Every screenshot has been retaken from the current app, and Calendar and Named Birds now have their own. As always, they are generated from a made-up demo birder's data, never anyone's real sightings.

## [0.5.76] - 2026-08-06

### Fixed
- **Macaulay Library media no longer shows a "Missing feature Cookies" error card.** The Cornell Lab recently put a bot check in front of the Macaulay Library, and that check cannot run inside an embedded player: it needs a browser cookie that no site is allowed to set from inside another site's page. Every photo, recording, and video embedded in SnowRaven turned into Cornell's error card instead. SnowRaven now notices when the check is up and shows its own card in place of the player, keeping the date, the checklist link, and a direct link to the asset on the Macaulay Library, where it opens and plays normally. When the Cornell Lab lifts the check, players come back on their own with nothing to update. This affects the Named Birds media and Species Detail's Recent Media, and is the same on the web app, the desktop apps, and iOS.

## [0.5.75] - 2026-08-04

### Fixed
- **Named birds now find their media.** The Named Birds tab said "No media matched to this bird." for individuals you clearly had photos of. A media asset was only ever matched by a `[name:…]` tag in its *own* caption or media note, but most birders tag an individual once in the checklist's species comment, which is also where SnowRaven finds the named bird to begin with. So the very tag that created a named bird could never attribute that bird's media. The species comment is now used as a fallback: if an asset's own caption or media note names an individual, that still wins outright, and only when it names nobody does the species comment apply. Tag once in the species comment and that observation's photos, recordings, and video are attributed; caption an individual asset to override it. Nothing that matched before stops matching.
- **A named bird's audio recordings can now actually be played.** On the Named Birds tab, an individual's audio was embedded in a tile shorter than the Macaulay player itself, so the transport row was cut off below the edge of the frame: you could see the recording was there, but there was no way to press play. Audio tiles now match the photo and video tiles (and the same players on Species Detail), which also lines up the rows in a card that mixes formats. Photo and video are unchanged.
- **The in-app Help sidebar lists every section again.** Calendar, Using SnowRaven offline, and Updating SnowRaven were all present in the Help text but missing from the table of contents, so the only way to reach them was to scroll past everything else. All 16 sections are now listed.
- **Stray `--` marks are gone from the Help text.** Around fifty of them had been left behind mid-sentence by an earlier punctuation pass.

### Changed
- **When a named bird's audio is offline or fails to load, it now explains itself.** Previously an audio tile showed only an icon and a link, with no message, because there was no room for one at the old height. It now shows the same "Media unavailable offline" or "Media couldn't load" wording that photo and video already showed. As before, the date, the checklist link, and the direct Macaulay Library link stay visible in every case.

### Documentation
- **The privacy policy no longer over-discloses.** It said the map's label fonts and icon sheet were fetched from OpenFreeMap. They ship inside the app and load from it directly, so those requests never leave your device. The map style and the tiles themselves are still fetched, and are still listed.
- **The accessibility statement covers more of the app**, adding the Calendar's keyboard-operable day grid and its day dialog, the colorblind-friendly Use Textures switches (off by default) on the map and Calendar, the Breeding Codes matrix on a phone, and the Disable embedded media setting. The description of the map's "Counties in view" keyboard panel was updated for the Completeness metric it gained after that section was written.
- **The Help text, README, and website caught up with the app**: the Breeding Codes "Unbounded" view, Species Detail's Recent Media section, Named Birds among the features that use your Macaulay Library export, and a corrected count of the tools in the app.

## [0.5.74] - 2026-08-04

### Removed
- **The "Offline maps" section has been removed from Settings.** It offered downloadable map regions, but no region was ever actually available to download on any platform, so the section could only ever show an empty list. Rather than leave a control that promises something it cannot deliver, it is gone. Nothing you were using stops working, and nothing needs cleaning up on your device.

### Notes
- **Offline map behavior itself is unchanged.** The Map Explorer still opens with no connection and draws your sightings, heatmap, atlas blocks, county lines and shading, and the base map's place labels, once that map has loaded online at least once. Areas you have already panned over often redraw from the app's own cache. Full street detail for somewhere new still needs a connection, and Satellite, Topo, and Trails are still disabled while you are offline. The app has never downloaded map data on its own, and it still does not.

### Privacy
- **The privacy policy shrank.** GitHub is no longer listed as a map-tile source and the "Offline maps" subsection is gone, because the app can no longer contact that endpoint at all. The desktop app's file-system permissions were narrowed to match: the four grants that existed only to read downloaded region files are withdrawn.

## [0.5.73] - 2026-08-03

### Fixed
- **The Settings "Disable embedded media" switch no longer sits inside an empty box.** The switch is drawn by a shared control that frames a switch plus a visible text label; this row hides that label (the row's own title carries the name), so only the empty frame remained around the switch. The row now shows just the switch, slightly larger so it reads clearly on its own, with the same colors, motion, keyboard focus ring, and phone-friendly tap area. Every other switch in the app is unchanged.

## [0.5.72] - 2026-07-30

### Added
- **A global “Disable embedded media” setting** now lets you stop every inline Macaulay Library player from loading in Species Detail and Named Birds. It is off by default, applies immediately, and persists across launches. When enabled, player areas show a quiet “Embedded media is disabled in Settings.” note while dates, checklist links, direct Macaulay Library links, media counts, comments, and analytics remain available. The preference stays closed while loading at startup, so a saved opt-out never flashes or requests an iframe first.

### Security
- **Backend request handling and environment-file tooling are hardened.** The pinned FastAPI, Starlette, `python-multipart`, and `python-dotenv` dependencies now use their current patched releases, closing known request-parsing denial-of-service and smuggling flaws as well as an environment-file symlink overwrite flaw.

## [0.5.71] - 2026-07-20

### Changed
- **The Species Detail "Recent Media" embeds now degrade gracefully when they are slow, broken, or offline** instead of showing a dead or blank frame. Each of the most-recent photo, audio, and video players shows a brief loading placeholder, and if it cannot load it flips to a small card with a link to the recording on the Macaulay Library, keeping the frame mounted so a slow embed still appears if it finishes loading later. Going offline shows that same placeholder, and the players recover on their own once you are back online. This brings Species Detail's media to parity with the Named Birds tab, which already worked this way, and the two now share one implementation. Species Detail's three players sit in a uniform framed row, and each now shows a line beneath it with the capture date, a link that opens that recording on the Macaulay Library (its credit and a way to view or play it), and the eBird checklist it came from.

### Fixed
- **The in-app Help's "the eBird backup powers these tabs" summaries now list every tab that uses it.** Calendar, Named Birds, and Checklists were missing from the two summary lists, even though the rest of the Help already documented that those tabs need the backup. The OpenWeather setup notes in the Help and README also now mention that activating the One Call by Call plan requires a payment card on file, even though the daily free allowance is free.

## [0.5.70] - 2026-07-07

### Fixed
- **On a phone, the Breeding Codes matrix now keeps its dot-width columns in the Unbounded view, not just the normal one.** The last update tightened the code columns to dot-width in the normal view, but they stayed full-width when you switched to Unbounded, and once narrowed there was a wide band of empty space to the right of the table. Both are fixed: the columns are dot-width in both views on a phone now, and the table's container hugs the columns so scrolling sideways stops at the last code instead of running into blank space. Wider screens are unchanged.

## [0.5.69] - 2026-07-07

### Changed
- **The Breeding Codes matrix is far more usable on a phone.** On narrow screens each breeding-code column now shrinks to the width of its colored dot, so a full species row's codes are scannable at a glance instead of a one- or two-column peephole beside the species name. Roughly twice as many code columns fit before you scroll, and you can pinch to zoom in on any part of the grid with your device's normal gesture (no on-screen zoom controls to learn). Thin vertical rules now separate every column (at all widths) so the dots read in clean lanes, and the species-name column stays fixed on the left as you scroll the codes sideways. The table scrolls as one natural page, with the breeding-code legend sitting at the very end after the last row. Wider screens keep their familiar layout, now with the same column rules.

## [0.5.68] - 2026-07-06

### Fixed
- **The Calendar's Compact and Large views now work as two distinct views on a phone.** On narrow screens the View toggle was hidden and the calendar was pinned to one layout, so tapping Compact vs. Large did nothing and the single view crammed in both the count and the date. The toggle is now available at every width and drives two genuinely different views on mobile: **Compact** shows a per-day count on each birded day (no day-of-month date), and **Large** shows the dated, shaded whole-year mini-months (the day's figures appear when you tap a day and open its popup). A day tap opens the same day popup from either view. Desktop behavior is unchanged: it already worked this way.

### Changed
- **Em dashes are gone from the app's wording and the in-app Help.** Across the app's on-screen text, tooltips, accessibility labels, and the Help documentation, em dashes (—) have been replaced with plainer punctuation (periods, commas, colons, or parentheses) for a cleaner, more consistent product voice. Wording and meaning are unchanged; this is a punctuation-only polish.

### Internal
- On/off switch thumbs now read their color from a design token (`--sr-switch-thumb`) instead of a hardcoded value. Pixel-identical; no visible change.

## [0.5.67] - 2026-07-06

### Added
- **The Weather tab can now list your checklists that still have no weather block, so you can work down the backlog instead of looking them up one at a time.** A new "List checklists with no weather blocks" section sits at the bottom of the Weather tab, below the single-checklist lookup and the Current/Predict panel (both unchanged). Open it to see your most-recent checklists whose comment carries no recognized weather block — SnowRaven's or RainCrow's — newest first, built entirely from your loaded eBird backup with no lookups needed to build the list. Each row shows the date, location, species count, protocol, effort, and completeness, and offers three actions: open the checklist on eBird, open its comment/edit page, and **Copy weather & go** — which looks up that checklist's weather, copies it to your clipboard (weather only), and opens the comment page so you can paste. By default the list shows only your complete, non-incidental checklists; a toggle widens it to also include incomplete and incidental ones, which are marked with a small chip so the wider list is never ambiguous. The list pages in 100s (Show next 100 / Show all). If a weather lookup fails, the row says exactly why — you're offline, an API key is missing (with a Settings nudge), or a general error — and the comment page is never opened, so you never land on eBird with nothing on your clipboard.

## [0.5.66] - 2026-07-05

### Added
- **The Named Birds tab now shows each individual's own photos, audio, and video.** When you've saved your Macaulay Library export, expanding a named bird reveals a **Media of {name}** section below its map, gathering that specific individual's media as inline players from the Macaulay Library. An asset belongs to a named bird when the asset's *own* comment — its caption or media notes, not the observation comment that the export copies onto every asset — carries the same `[name:…]` tag, matched to the correct species, so the grouping is precise and never mixes up two birds that share a name. Each item is labeled with its capture date and a link to the checklist it came from, newest first. Players load only when you open the card, in an initial batch of six with a **Show more** control for well-documented individuals, and each mounts as it scrolls into view so the tab stays responsive. If you're offline or a player can't load, that tile shows a **View on Macaulay Library** link instead of a broken frame — keeping its date and checklist link, which are computed locally. A named bird with no matching media shows a short "No media matched to this bird." note; with no ML export saved, the media section simply doesn't appear. This is a Named Birds tab feature — the Named Individuals section on Species Detail is unchanged.

## [0.5.65] - 2026-07-05

### Changed
- **The Statistics media card now says "Sex" instead of "Gender."** eBird and the Macaulay Library name this field "Sex" in their exports, so the app now matches: the "Photos Tagged With Age or Sex" section heading, the donut titled "Sex," and its note ("…and sex for N…") all use the source-aligned term. This is a wording change only — the data, colors, and the male / female / unknown breakdown are unchanged.

## [0.5.64] - 2026-07-05

### Fixed
- **The Calendar shows dates again on a narrow screen.** On phone-width screens the Calendar always shows the big month grids, and a recent change had moved the day-of-month numbers onto the whole-year thumbnails — which those narrow screens never show — so the day cells lost their dates. Every day cell in the big month grids now carries its date again on narrow screens, restoring the familiar wall-calendar layout. Wider screens are unchanged (their big grids stay date-free, with the dates on the whole-year thumbnails).

## [0.5.63] - 2026-07-04

### Changed
- **The Calendar's big month grids are count-only again.** The Compact view's day cells no longer print a day-of-month number in the corner — each birded day shows just its count (and no-birding days are bare), returning the big grids to their cleaner earlier look.
- **The Calendar's whole-year thumbnails now carry a small day-of-month number.** Each cell in the Large view's 3×4 month thumbnails shows a small date in the corner alongside its shading (no count), and the number tucks away automatically when a thumbnail is too small for it to stay legible — so the whole-year overview reads as a dated heatmap.
- **The Calendar overview's days open their popups; its months no longer jump views.** Clicking a *month* in the Large thumbnail overview used to switch you into the big-grid view — that navigation is gone, so the month cards stay put and the Compact / Large toggle is the only way to switch layouts. Clicking an individual *day* in a thumbnail now opens that day's detail popup (the same summary and checklist links as the big grid) right where you are, so day detail is reachable from the whole-year overview without switching views.
- **The Calendar day popup now shows each checklist's start time, location, and species count.** Every checklist row in the day popup carries a second line with its start time, location, and how many species that checklist recorded (for example, "7:30 AM · Point Reyes NS--Bear Valley · 42 species"), so you can tell one outing from another at a glance and see how each contributed to the day; a checklist with no recorded start time shows just the location and count. The per-checklist count follows the spuh/slash/hybrid toggle exactly as the day totals do (countable species by default, all forms when it's on). Read straight from your already-loaded backup — no new network calls.

## [0.5.62] - 2026-07-04

### Changed
- **The Calendar's All years grid now aligns to the current year.** The combined ("All years") view laid out its weekday columns against a fixed reference year, so the grid positions matched no real calendar. It now aligns to the current year, matching the layout of this year's single-year view — while still keeping February's Feb 29 cell even in a non-leap year.
- **The Calendar's whole-year overview thumbnails are shading-only again.** The 3×4 mini-month thumbnails no longer print a number in each cell; the shape of your year reads from color (or texture) alone, and the exact figures stay in the big month grids and the day popup.
- **The Calendar's View toggle labels are swapped.** The big month grids are now labeled **Compact** (the default) and the whole-year thumbnail overview is labeled **Large**. Only the labels changed — the two layouts are the same, and phones still always show the big month grids.

## [0.5.61] - 2026-07-04

### Changed
- **The Calendar's Species filter is now a searchable combobox.** The old drop-down is replaced by a type-to-find picker — start typing a common or scientific name and the list narrows, with Arrow/Enter/Escape and an "All species" row at the top to clear it. It's the same picker Species Detail uses (now a shared component), which matters on a large life list where the plain drop-down was a long, unsearchable scroll.
- **Every Calendar day cell now shows its calendar date.** In the Large month grids each day carries its day-of-month number in the top-left corner (wall-calendar style) alongside the count, including blank no-birding days. This removes a source of confusion in the **All years** view, where the weekday columns align to a fixed reference year — the same grid *position* can be a different date than in a single-year view, so you now read the date, not the position. (The day counts themselves were already correct; this is a labeling fix.) The Compact thumbnail view stays count-only.
- **On phones the Calendar shows only the Large view.** The Large | Compact toggle is hidden at phone widths and the calendar always renders the big month grids, since the two layouts converge to a single column on a phone and the larger cells stay comfortably tappable. Tablet and desktop are unchanged.

### Fixed
- **iPhone auto-zoom on search and filter boxes is now genuinely suppressed app-wide.** The app's no-zoom guard for small text inputs could be silently overridden by a control's own font size, so tapping some inputs (the weather search, checklist filters, and others) still zoomed the page on iOS. The guard now always wins on every input that carries it.

## [0.5.60] - 2026-07-04

### Added
- **A "Total count" view on the Calendar tab.** The Calendar's *Show* toggle gains a third option alongside Species and Checklists: **Total count** shades and numbers each day by the total individual birds you recorded — the eBird *Count* column, summed. Paired with the Species filter it answers "how many of this bird did I record across the year," day by day. Same shading, legend, and popup as the other two metrics; the day popup now always shows all three numbers (species, checklists, individuals) whichever metric is active. Presence-only records — an "X" or a blank count — contribute 0 individuals, matching the Statistics tab's individual tally exactly, so the two never disagree. The "Count spuh, slash & hybrids" toggle re-shades Total count too (unlike Checklists, it isn't dimmed for this metric).

### Changed
- **The Calendar's view toggle is now Large | Compact (was Months | Year).** Both views always showed the whole year — only the cell size differed — so the labels were misleading. **Large** is the big month grids with day numbers; **Compact** is the 3×4 all-months thumbnail grid. Behavior is unchanged; only the labels are clearer.
- **Compact-view mini-months now show a day number in each cell.** The small all-year thumbnail grid previously showed shading only; each populated day now also carries its count (species, checklists, or total individuals — whichever metric is active), so a day's value is legible without expanding to Large. Where a mini-cell is too small for a legible number it stays shading-only, and the exact figure is always in the Large view and the day popup.

## [0.5.59] - 2026-07-03

### Added
- **Named Birds now shows how long you've followed each individual.** Under the first-seen–last-seen date range on every Named Birds row, a small second line spells out the elapsed span between the first and last sighting — "2 yrs. 3 mos.", "5 mos.", "5 days", "1 day" for a single sighting. It's a rounded, at-a-glance label (a lingering resident reads very differently from a one-day vagrant), and it needs no new data — it's derived from the dates already on the row.
- **The Calendar tab can now focus on a single species.** A new **Species** dropdown ("All species" by default) narrows the whole calendar — every day cell, the shading tiers, the legend, and the day popup — to just the one bird you pick, so you can see the seasonal shape of *when you record that species*. Under a species filter the Species metric becomes a simple "seen / not seen that day" and the Checklists metric counts the checklists that recorded it; the combined all-years view folds that one species across every year. Subspecies and form names fold into their parent (so "Dark-eyed Junco (Oregon)" lives under "Dark-eyed Junco"), and the spuh/slash/hybrid toggle steps aside while a single species is chosen. The selection is session-only and makes no new network calls.
- **A Labels / Dots marker-style toggle on the Map Explorer's Nearby Lifers and Media Targets.** Each of those two panels gains a **Marker Style** switch. Every marker now also carries a small locator dot pinned to its exact coordinate, so you always know precisely where a bird is. In **Dots** mode the name/media chips collapse to just those dots — a clean overview of *where* the birds are without the labels crowding each other — while a click, tap, or keyboard press still opens the same popup listing every species at that spot. The two panels remember their own choice independently, for the session.

## [0.5.58] - 2026-07-03

### Added
- **A new Calendar tab — a year of your birding as twelve month grids.** SnowRaven now lays out a full year like a wall calendar's twelve pages, with a number on each day showing either the **species** you saw that day or the **checklists** you submitted that day (your choice, species by default). Every day is shaded green by how busy it was relative to the year on screen, so the shape of your birding year — the busy migration weeks, the quiet mid-summer stretches, a December CBC spike — reads at a glance. You can page back and forward through every year your backup covers (gap years are skipped, not dead ends) and fold **all years** into one combined grid keyed by month-and-day, where species become a distinct-species union ("how many different birds have I ever recorded on this date") and checklists a sum — February always keeps its Feb 29 cell. Click any day for a popup with that day's species and checklist counts and working links straight to its eBird checklists.
  - **Year Overview.** A **Months | Year** view toggle switches between the big month grids and a 3×4 grid of small heatmap thumbnails — the whole year at a glance, where the shading alone tells the story. Click a mini-month to jump to its full grid.
  - **Colorblind textures.** A **Use Textures** switch turns each shade tier into a crosshatch whose density rises with the count, so the level reads from ink-density rather than hue or brightness — and the exact number is always in the day popup, so color is never the only signal.
  - **Count spuh, slash & hybrids.** A low-emphasis switch (off by default) optionally counts non-countable forms — spuh, slash, and hybrid names — toward the day's species number, re-shading the grid; it only affects the Species metric, so it's dimmed under Checklists.
  - Reads cleanly in both light and dark themes, on a phone down to 320px and at 200% text scale, and is fully keyboard-operable. Like the rest of SnowRaven it is entirely offline — it reads only the eBird backup already loaded on your device and makes no new network calls.

## [0.5.57] - 2026-07-02

### Fixed
- **Macaulay Library links for subspecies and form birds now filter correctly.** When you clicked a "view my photos/audio/video" link for a bird you'd recorded under a subspecies or form name — anything with a parenthetical, like Scaly-breasted Munia (Scaled), Dark-eyed Junco (Oregon), or Rock Pigeon (Feral Pigeon) — the link either dropped its filter and showed *all* your media, or built a broken filter that matched nothing. Now every such link on **Species Detail**, **Multimedia**, and **Statistics** filters to the right media: to the whole species by default, and — on the two tabs with a "Show subspecies" switch — to the exact form when that switch is on. Species Detail's links also moved to the same modern Macaulay catalog address the rest of the app already uses.

## [0.5.56] - 2026-07-02

### Changed
- **A few touch-friendly readability fixes.** Three small spots that previously showed information only when you hovered a mouse are now readable by touch. On the **Breeding Codes** tab, the legend under the table (and the filter pills above it) now spell out what each code means — "NB Nest Building", "FL Recently Fledged Young" — instead of just the two-letter code, so you no longer have to hover to remember what a code stands for. In the **Checklists** comparer, the little photo/audio/video counts next to each species now appear as a visible number on phones, where the hover tooltip that used to carry them never fires. And a small tidy on the **Life List**: a bit of dead code that tried (and failed) to pin the table header in place has been removed — the header scrolls with the page exactly as it already did. On desktop everything looks and behaves as before.

### Changed
- **A mobile-friendliness pass across the whole app.** SnowRaven already worked on a phone, but ahead of a future mobile build we swept every tab for the rough edges that show up on a small screen. Map popups — a shaded county's completeness card, a pin's sightings list, a target or nearby-lifer marker — now scroll inside themselves when they're taller than a short phone screen, instead of running off the bottom where you couldn't reach the content. Buttons, pills, and icon-only controls that were comfortable with a mouse now grow to a larger, easier-to-tap size on phones. Tapping into a search box, filter, or date picker no longer makes iOS zoom the whole page in on you. And rows, toggles, and control groups across Statistics, Life List, the Checklists comparer, Species Detail, the map sidebar, and Settings now wrap gracefully instead of overflowing or clipping — including at large in-app text sizes. Nothing was added or moved; this is purely making the existing screens hold up cleanly from a 320px phone on up. On desktop everything looks and behaves exactly as before.

- **Behind-the-scenes tidying (no visible change).** A few internal cleanups that don't change how anything looks or works: the self-hosted (web / Raspberry-Pi) backend now reuses one keep-alive connection for its outbound eBird, weather, and tide requests instead of opening a fresh one each time, so lookups shave a little latency; the Map Explorer's Media Targets and Nearby Lifers now share a single recent-observations fetch when they're centered on the same spot rather than each asking eBird separately; and some unused code left over from earlier development was removed.

## [0.5.54] - 2026-07-02

### Added
- **County Completeness — a third county-shading metric on the Map Explorer.** Alongside Species and Checklists, a new **Completeness** option shades each US county by how complete your county list is: your countable species recorded there (spuhs, slashes, and hybrids don't count, and subspecies fold into their species) measured against everything ever reported to eBird for that county. Click a shaded county for a progress bar with "X of Y species (Z%)", your five newest county species (from your own backup — works offline), and a five-species chase list of birds on the county's eBird list that aren't on yours yet. Counties you've never birded stay plain outlines; click one and press "Load completeness" to scout it with a single eBird request. Unlike the other two metrics, Completeness needs a network connection and your eBird API key — the control says so right where you pick it, and each county's result is cached on your device for 30 days, so panning back over fetched counties makes no new eBird calls and previously fetched counties still shade when you're offline. Fetching is strictly bounded: only counties you've actually birded in the current view are looked up (a few at a time), never a bulk sweep. The legend switches to a fixed 0–100% scale (the same shade always means the same completeness), Use Textures and the keyboard "Counties in view" list work with it, and the Species/Checklists shading is unchanged. The county sub-toggle is now labeled "Shade counties" since it governs three metrics.

## [0.5.53] - 2026-07-01

### Added
- **A "Point Size" control for the My Sightings map.** In the Map Explorer's Pins view you can now set your sighting points to **Normal**, **Small**, or **Off** — a new control just under the Pins / Heatmap switch. It's there for when you're studying a shaded breeding-code or county map and the points get in the way: shrink them, or hide them altogether, so the shading reads cleanly underneath. Turning points Off also removes their click target and popup, so a hidden point can't be clicked. It builds on the automatic fade the map already applies while shading is on — "Small" plus an active shade dims and shrinks. The default is **Normal**, so nothing changes unless you reach for it, and the choice is per-session (it resets on relaunch). Heatmap view is unaffected. No new data and no network calls.

## [0.5.52] - 2026-06-30

### Changed
- **Faster tide readings on the web and Raspberry-Pi build.** A checklist's tide lookup now fetches its three NOAA data series at the same time instead of one after another, so a reading loads in roughly a third of the round-trips — matching how the desktop app already did it. The readings themselves are unchanged.
- **Under-the-hood tidying (no visible change).** A handful of internal performance and housekeeping cleanups that don't change how anything looks or works: a couple of Statistics and Species Detail calculations do less repeat work, file saves on the self-hosted server no longer briefly block other requests, and some unused scaffolding left over from early development was removed.
- **Documentation caught up to the county overlay.** The README, in-app Help, and accessibility statement now mention the county lines & shading overlay in their "works offline" and keyboard-navigation sections, and the build-from-source notes were clarified.

## [0.5.51] - 2026-06-29

### Added
- **Colorblind-friendly county shading — a "Use Textures" option.** When you shade the Map Explorer by county, a new **Use Textures** toggle (under the Species / Checklists switch) paints each county as a crosshatch whose density rises with your count — an open lattice for your lightest counties through a tight crosshatch for your most-recorded ones — instead of relying on the green color ramp alone. It brings the county overlay to parity with the atlas overlay's existing Use Textures mode, so you can rank counties without depending on hue or brightness. The legend and the keyboard "Counties in view" list show the same density steps, the patterns follow light/dark themes, and they keep working when you switch between the Species and Checklists metric. It's off by default — your normal color view is unchanged until you opt in — and the choice is per-session (it resets on relaunch). Like the rest of the county overlay, it adds no network calls and no new data.

## [0.5.50] - 2026-06-29

### Changed
- **Crisper county shading at high zoom.** When you shade the Map Explorer by county and zoom in close, the shaded fill now tracks the county boundary more tightly, so the thin sliver of color that used to peek out past the county line is gone. The bundled county geometry was sharpened a notch; it still downloads only when you first turn the county overlay on, then stays cached.

## [0.5.49] - 2026-06-29

### Changed
- **Map Explorer county lines are now accurate at every zoom level.** The county boundaries in the overlay are drawn straight from the map's own tiles, so up close they trace the real county edge crisply instead of the blocky, simplified shape they used to — they match the boundary the basemap shows underneath. The shading, the per-county popups, and the zoomed-out / offline view still use the bundled US Census geometry. This adds no new download and no new data source (the lines come from tiles the map already loads), and the county overlay still makes no network calls of its own.

### Fixed
- **Long location names no longer overflow the county popup.** On the shaded county map, a long place name in the popup's "Top locations" list now ellipsizes neatly inside the popup instead of running off the right edge. (The same fix applies anywhere a hotspot link is shown in a tight, truncating space, such as the Species Detail named-birds list.)

## [0.5.48] - 2026-06-29

### Changed
- **Map Explorer county overlay — five fixes and refinements.**
  - **Sharper county lines.** The county boundaries now come from a higher-resolution version of the bundled US Census geometry, so they trace real coastlines and county edges crisply instead of looking blocky. (The county boundary data still downloads only when you first turn the overlay on, then stays cached.)
  - **A finer shading scale.** *Shade by species seen* now uses ten data-driven steps instead of four, so your well-birded counties stand apart from one another instead of all landing in the same darkest shade. The steps are still quantiles of your own county totals, so the breaks fit your data.
  - **Clearer county popup counts.** The popup now makes plain that its counts are your **checklists** — how many of your checklists reported a species in that county — not a tally of individual birds. There's a "by your checklist count" caption, hover tooltips on the numbers, and the metric switch is relabeled **Species / Checklists**.
  - **Long county names no longer overflow.** A county with a long name (e.g. an Alaska census area) now wraps neatly inside its popup instead of running off the edge.
  - **Collapsible "… in view" lists.** Each Map Explorer panel's "… in view" list (Sightings, Hotspots, Targets, Nearby Lifers) now has a chevron in its header to collapse or expand it; the count stays visible when collapsed, so you can tuck a long list away and keep the map controls in reach.

## [0.5.47] - 2026-06-28

### Changed
- **Map Explorer shading polish.** Three refinements to the v0.5.46 county and atlas shading:
  - **The "… in view" list now sits at the bottom of every Map Explorer panel.** This list (Sightings, Hotspots, Targets, or Counties in view) can get long and was pushing the overlay controls down on the My Sightings and Hotspots views; it is now the last section in all four panels, so the map controls stay put near the top.
  - **The two shadings are now mutually exclusive.** Turning on county shading (green) switches off atlas breeding shading (purple), and vice-versa — their color ramps competed for the same map, so only one is ever active at a time. The boundary *lines* can still both be shown; a tooltip on each shade toggle and a caption note make the switch discoverable.
  - **The basemap mutes while a shading ramp is active.** When either shading is on, the basemap's green land fills turn grey (water, roads, and labels keep their color, and satellite/topo imagery desaturates) so the active ramp stands out; the colors restore when shading is off. In heatmap mode, the heatmap now also dims and sits under the county ramp the way it already did for the atlas ramp, keeping the tier colors readable. No new controls, no new network calls — the muting reuses the tiles already loaded.

## [0.5.46] - 2026-06-28

### Added
- **County lines and shading on the Map Explorer.** A new **County lines** toggle draws US county boundaries over whatever part of the map you're looking at, redrawn as you pan and zoom (with a "Zoom in to see counties" hint at very wide views where the whole country would be too dense). With it on, a **Shade by species seen** toggle tints each county by how many species you've recorded there — a county-by-county read of your own coverage, built entirely from your loaded eBird backup, with a legend whose ranges are quantiles of your own county totals (so the breaks shift to fit your data). A **Species / Records** switch flips the shading between distinct species per county and total checklists per county; the legend and shading move together. Counties you've never recorded stay as plain outlines, clearly set apart from the shaded ones. Click any county for a popup with its name, state, your species and checklist counts there, a link to its eBird county page, and — depending on the metric — your most-recorded species or your top locations in that county. A keyboard-accessible **Counties in view** panel (bottom-left) lists the in-view counties so every popup is reachable without a mouse, and both themes render the lines, fills, and legend legibly. The green county shading is deliberately distinct from the purple California atlas shading, so you can have both overlays on at once. The boundaries are a compact bundled dataset (US Census, public domain), so the overlay works fully offline with no extra download and makes no network calls — nothing about your data leaves your device. Outside the US, nothing is drawn. The overlay is available across all four Map Explorer views.

## [0.5.45] - 2026-06-21

### Added
- **Offline support.** SnowRaven now works far better with a weak connection or none at all — built for birding in the field.
  - **Maps open offline.** Once a map has loaded online at least once, it opens again offline: your sightings, heatmap, and atlas all draw, the base map's place and street labels render from a small bundled font set (so an offline map keeps its names, not just unlabeled lines), and every analytical tab works without a connection.
  - **Downloadable offline map regions (desktop).** Turn on "Enable offline maps" in Settings, then download the counties you bird while you have wifi. In the field with no signal, pan and zoom those regions with full street and label detail. The manager shows each region's size and a running total, flags regions that are out of date, and lets you remove ones you no longer need. It's off by default and nothing downloads until you turn it on; region downloads are a desktop-app feature.
  - **Weather and tide re-show offline.** A checklist's weather or tide reading that you loaded online once re-appears when you reopen it offline, clearly marked as the last loaded result with the time it was loaded.
  - **Bird names sort right offline.** Taxonomic order and the small site icons next to bird names now work on a first-ever cold start with no connection, instead of falling back to a plain A–Z list.
  - **Honest "you're offline" messages.** When a live feature can't run, SnowRaven tells you clearly whether you're offline, missing an API key, or hit a server error — three distinct, honest messages instead of one confusing failure. The update check no longer reports "up to date" when it actually couldn't reach the update server.

## [0.5.44] - 2026-06-18

### Fixed
- **Milestone badges are now readable in dark mode.** On the Statistics tab, the "Firsts & Milestones" badges (and the matching "Complete!" badges in the Frivolous Lists) showed as bright white tiles in dark mode, with the bird's name washed out to nearly invisible. They now use dark tiles in dark mode, with the number, name, date, and check mark all re-tuned for legibility at WCAG AA contrast. Light mode is unchanged.

## [0.5.43] - 2026-06-17

### Added
- **Drop a pin on the map to set the search center.** On the Map Explorer's Hotspots, Nearby Lifers, and Media Targets views, you can now right-click (or long-press on a touch screen) anywhere on the map to drop a center pin there, then drag the pin to fine-tune — and the view re-runs its search for that spot automatically. It works alongside the existing place-name search, "Use my location", and coordinate entry, and sets the center for the session only, without touching your saved Default Location.

## [0.5.42] - 2026-06-17

### Changed
- **Checklists now sits between Breeding Codes and List Comparer in the default tab order.** New installs and reset tab layouts get the updated order; existing custom tab layouts stay as they are.
- **Lighter initial load.** The map library behind the in-app maps is no longer downloaded until you actually open a map, so the app starts faster — most noticeably in the browser / self-hosted version. The maps themselves are unchanged; they just load on demand. (The List Comparer and Checklists tabs also load on demand now.)
- **Clearer self-hosted security notice and refreshed build tooling.** Updating on a Raspberry Pi or Linux box could print an `npm` "N vulnerabilities" summary that looked alarming; those advisories were always in build-only tooling that never ships in the app. The dependency lockfile has been refreshed so a fresh install reports zero, and the README and `update.sh` now explain the scope.

## [0.5.41] - 2026-06-16

### Changed
- **Default navigation and comparison ordering now matches the most-used flow.** New installs and reset tab layouts now open in this order: Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, Named Birds, then Settings. Existing custom tab layouts stay as they are.
- **Checklist comparison is now first in List Comparer.** The List Comparer opens on Checklists by default, with Checklists on the left side of the mode switch and Life Lists on the right.
- **Nearby Lifers now comes before Media Targets in Map Explorer.** The Map Explorer mode buttons keep the same behavior, but the Nearby Lifers button now appears before Media Targets.

## [0.5.40] - 2026-06-16

### Added
- **Public hotspot names are now links to their eBird hotspot page — everywhere a location appears.** When a place in your data is a public eBird hotspot, its name becomes a link straight to that hotspot's page on eBird; a personal location (your yard, a stakeout pin) stays as plain text, since those have no public page to open. This is consistent across the app: Species Detail's top locations and comments, the Statistics top-locations and notable-outings cards, the Checklists tab (both the list and the comment search), the Named Birds reports, and the Rainbow Warrior first-sightings. Whether a location is a public hotspot is worked out from eBird's own list of hotspots for the regions your data covers — a small, cached lookup, not a per-location call — so it stays fast even on a large backup. (No eBird key, or eBird unreachable? Names simply stay plain text rather than guessing.)

### Fixed
- **Location links no longer point at dead pages.** Previously a couple of spots (Species Detail's top-locations list among them) turned any location id into an eBird hotspot link — including personal locations, whose hotspot page doesn't exist, so the link 404'd. Links now appear only for genuine public hotspots.

## [0.5.39] - 2026-06-16

### Added
- **Five new Frivolous Lists on the Statistics page.** Joining Avian American and California Dreamer at the bottom of Statistics: **Phoebe Phanatic** (the three phoebes), **Scrub Jay All Day** (the four scrub-jays), **Crow Pro / Raven Maven** (the crows and ravens), **Heron is Carin' (and Egrets too)** (true herons, egrets, night-herons, and bitterns), and **Best of the Crest** — a big "crested and crowned" collection spanning many families, from cardinals, jays, titmice, and quail down to the Crested Auklet and Tufted Puffin. Each checks off from your own life list with a running count and a "Complete!" badge; the last two show your sub-categories as labeled groups. Built entirely from the eBird data the app already has — no new providers, privacy unchanged.

## [0.5.38] - 2026-06-16

### Added
- **The behavior counts on the Statistics media card are now links to the Macaulay Library.** In the Media card's "Behaviors documented" list, each behavior's count opens the Macaulay Library catalog filtered to that behavior across your own media — your flying shots, your feeding-young shots, and so on — the same way the most-photographed lists already link to your media. Each breeding behavior (feeding young, carrying food, nest building, courtship/display, song) is listed and linked individually in its own group just below the behaviors list, so you can open just that behavior's media (they move into the breeding group rather than doubling up in the top-behaviors list). Built on the Macaulay Library user ID the app already reads from your export filename, so a click lands on your own media. (A behavior the catalog doesn't recognize stays as plain text rather than becoming a broken link.) While there, the most-photographed, most-recorded, and most-filmed links on the same card were moved onto the current Macaulay catalog address (media.ebird.org) so every Macaulay Library link on the Statistics tab uses one host.

### Fixed
- **The media "documentation coverage" denominator no longer overcounts your life list.** The "X of N life-list species documented with media" figure was counting every distinct name in your eBird data toward N — including "sp." entries, slashes (Greater/Lesser Scaup), and hybrids — which pushed the total above your real life list and understated your coverage percentage. It now counts only countable species, matching how the Life List and the other statistics already treat them.

## [0.5.37] - 2026-06-15

### Changed
- **A full responsive pass so every screen flows on phones and big desktops.** Every tab now reflows cleanly from a ~320px phone up to a large desktop, with no overlapping rows and no sideways scrolling. Rows that used to collide on a narrow screen — the Map Explorer's view-mode buttons, Settings' file and key rows, the filter strips, the comparison columns — now wrap or stack; wide tables scroll within their own box instead of dragging the whole page sideways; charts and multi-column grids fold to a single column; and long place and species names wrap instead of spilling over. On large screens the content is capped to a comfortable reading width rather than stretching edge to edge. Built on the app's existing styling, so nothing about what each screen does or shows has changed — it just fits the screen it's on. (Two unused leftover stylesheets from the project's original template were also removed.)

## [0.5.36] - 2026-06-14

### Added
- **Frivolous Lists on the Statistics page.** A new section at the very bottom of Statistics, just for the fun of it: three self-completing collections that fill in from your own life list. **Avian American** and **California Dreamer** check off every "American …" and "California …" bird as you record it — with a count of how many you have and a badge when you complete the set. **Rainbow Warrior** finds the first bird of each rainbow color you ever logged — red through violet — and shows where and when you first saw it, with a link to that checklist; a color you haven't found yet waits with a blank (a name counts for a color only as a whole word, so "Red-tailed Hawk" fills red but "Reddish Egret" doesn't, and one bird like the Violet-green Swallow can fill two). Built entirely from the eBird data the app already has — no new providers, and the local-first privacy promise is unchanged.

## [0.5.35] - 2026-06-14

### Added
- **Nearby Lifers on the Map Explorer.** The Nearby Lifers list moved off the Statistics tab and became its own section of the Map Explorer, so you can see *where* the birds you've never recorded are turning up, not just which ones. Each spot is a labeled pin — the species name, or "{n} species" where several of your lifers were reported at one place — colored by how recently it was seen; click a pin (or a row in the panel list) for the full list, each with its date and a link to the eBird checklist. It opens on your saved default location and gives you the same controls as the other map sections: use your current location or search for a place, set the radius, and a new **Time Range** filter (last day, last week, or last 30 days). That same Time Range filter was added to the Media Targets section too, so the two panels behave the same. Built entirely on the eBird data the app already uses — no new providers, and the local-first privacy promise is unchanged.

## [0.5.34] - 2026-06-13

### Added
- **Current & Predict — weather and tide for now, or any time ahead.** Two new buttons at the bottom of the Weather tab look forward instead of back. **Current** gives you live weather and tide for wherever you are, in one tap. **Predict** lets you pick a place — by name search or by dropping a pin on a small map — plus a date and time, then shows the forecast weather and the predicted tide for that single moment. Weather reaches about eight days out (hour-by-hour for the first couple of days, then a clearly-labeled daily summary beyond that); tide runs much further, because it's astronomical rather than meteorological — so choosing a date past the weather window still gives you the tide, with an honest note that no forecast reaches that far. Each result reads at a glance, with the familiar copy-ready block one tap away. Built entirely on the data sources the app already uses (OpenWeather, NOAA tide stations, OpenStreetMap for place search), so there's nothing new to set up and the local-first privacy promise is unchanged. The existing paste-a-checklist weather lookup is untouched.

## [0.5.33] - 2026-06-13

### Added
- **Sex and age filters on the Multimedia tab.** Two dropdowns — Sex (Male/Female) and Age (Juvenile/Immature/Adult) — let you slice your Macaulay Library media by life stage and sex: pull up all your juveniles, or the males of a sexually dimorphic species to compare plumage. They compose with the existing media and county/date filters; each species' photo/audio/video counts and the "X of N species" total reflect the active filter, species with no matching media drop out, and the Macaulay Library links carry the filter so a click opens the same subset. Combining age and sex targets one kind of bird (a "juvenile female" matches only media with at least one juvenile female), while a single facet stays broad. Built entirely on the age/sex data already in your export — no new data, no backend.

## [0.5.32] - 2026-06-13

### Accessibility

Finishing the cross-cutting accessibility items that 0.5.31 tracked as known exceptions.

- **Every "open on eBird" checklist link now goes through one shared component.** The checklist links that were still hand-rolled — across Species Detail, the Named Birds reports, the Statistics tab, the media stats, and the map popups — now render through `ChecklistLink`, so they share one visual signature and one screen-reader name everywhere (WCAG 3.2.4 Consistent Identification). Dense spots (the most-individuals and one-and-done species pills, the "most species / checklists" location cards, the year-by-year best-day column, and the Map Explorer target popup) use a new compact icon-only mode that keeps their tight layout while carrying the identical accessible name. That name now leads with the visible date or count a link shows, so a Voice Control user can activate it by what they see (WCAG 2.5.3 Label in Name) — which also corrects the Checklists tab's date link, whose name had drifted from its visible text when the component was first extracted.
- **Every external link now announces that it opens in a new tab.** A new shared `OutboundLink` wrapper backs the remaining outbound links — eBird region links, the Macaulay Library, the OpenWeather and API-key links in Settings, the map hotspot and atlas popups, comment URLs, and the footer — so screen-reader users are warned before a link leaves the app. The cue is screen-reader-only; nothing visible changed.

### Changed
- **The Southern-Hemisphere moon-phase note was corrected.** It was tracked as a deferred follow-up, but the latitude-correct moon orientation already shipped in 0.5.28 (the emoji set mirrors for `lat < 0`, the checklist's latitude reaches both the desktop and web formatters, and both hemispheres are covered by the byte-golden tests). The stale "deferred" note is removed and the published accessibility statement now reflects the completed checklist-link and new-tab work.
- **A stale "Leaflet" code comment was corrected.** The tab-navigation dropdown's z-index comment referenced Leaflet panes; the app moved to MapLibre GL in 0.5.9. Comment-only, no behavior change.

## [0.5.31] - 2026-06-12

### Accessibility

A focused accessibility pass across the whole app, aimed at WCAG 2.1 AA. By theme:

- **Named controls.** Every filter dropdown, date input, search box, and toggle that previously relied on a placeholder or a nearby caption now carries an explicit accessible name, so screen readers announce what each control does. The Settings segmented choices (theme, text size, date format) are now proper keyboard-operable radio groups.
- **Contrast retune.** The accent green, muted text, error red, chart line colors, toggle tracks, map pins, milestone chips, and statistics rank pins were all darkened or adjusted to meet AA contrast (4.5:1 text, 3:1 non-text) in both light and dark themes. Breeding-tier badges and pills, and map target chips, got dedicated text colors that pass on their fills and tints. Chart figures read from a label beside the bar; the one place a percentage sits inside a bar (the complete-checklists meter) now uses a theme-aware text color that meets AA on that fill in both themes.
- **Keyboard and focus.** The Settings tab-layout list now has Move up / Move down buttons as a keyboard alternative to drag-and-drop. The Map Explorer's mobile filter panel traps focus while open and restores focus to the Filters button on close (via Escape, the Close button, or the backdrop); Escape also exits map fullscreen and returns focus to the toggle. In-page "jump to" links now move keyboard focus to the destination, not just the scroll position. Bird-name links show the keyboard focus ring again. A "Skip to main content" link leads the page.
- **Announcements.** Result counts, loading states, and inline errors are exposed as polite live regions or alerts, and a keyboard tab move in Settings is announced. Every chart carries a concise text summary via an image role; decorative chart flourishes are hidden from assistive tech.
- **Maps.** The Media Targets sidebar's "Nearest Targets" list became a viewport-scoped **Targets in view** list (mirroring the Sightings/Hotspots in-view lists) that updates on pan and zoom and is the keyboard path to the otherwise mouse-only target chips; rows toggle their popup and carry pressed state. When the breeding-atlas overlay is on, an **Atlas blocks in view** panel gives the keyboard the same path to each block's popup (its breeding summary and eBird link), mirroring the marker in-view lists. Map pin strokes and target-chip text use contrast-checked tokens; new-tab links announce that they open in a new tab; map popup text scales with the Text Size control.
- **Resize and reflow.** Statistics bar-chart labels and the help layout are sized in relative units so they grow with the Text Size control to 200% without clipping, and the help two-column layout collapses to one column on narrow screens. The desktop app now honors the browser zoom hotkeys (Ctrl/Cmd +/−).
- **Structure.** Lists that mirror map markers use real list semantics; collapsed filter panels are made inert so hidden controls aren't stray tab stops.

Known exceptions (honestly tracked): a few cross-cutting niceties are partly done and still being unified. A shared `ChecklistLink` component now backs the "open on eBird" links in the checklist comparer, the weather/tide panel, and the Checklists tab; extending it to every remaining checklist link across the app is still in progress. Likewise, the main external links now announce that they open in a new tab, but a uniform sweep across all of them remains. And the weather block still names the Northern-Hemisphere moon phase for Southern-Hemisphere checklists — the fix needs the checklist's latitude threaded to the display layer.

### Fixed
- **Frontend test suite: the remaining rare timing flake is gone.** Two test-only fixes, both proven under a 30-run stress recipe (single worker, shuffled file order, concurrent CPU load): the `BirdingStats` progressive-render tests now wait for the component's animation-frame effect to have observably queued work before flushing it (under load the tests could outrun the effect and assert against a frozen shell), and the two chart-mounting test files now wait out a charting dependency's 100 ms fallback timer before their test environment is torn down (the timer could otherwise fire into the next file and fail a run whose tests were all green). Test infrastructure only — no production code changed.

### Changed
- **Records corrected: the 0.5.29 entries overclaimed the flake fix.** 0.5.29 fixed the dominant `cancelAnimationFrame` failure mode; the separate, rarer timing flake above remained until now. The 0.5.29 wording in this file, `DECISIONS.md`, and `ROADMAP.md` now says exactly that. `PRODUCT_CONTEXT.md` also caught up with the v0.5.9 MapLibre migration: its remaining Leaflet-era current-behavior passages were rewritten against the current map stack and the superseded historical entries are now annotated as such.

## [0.5.30] - 2026-06-11

### Fixed
- **Hotspot pins could silently fail to appear when searched during map tile loading.** The teardrop sprites were registered only when the map style reported itself fully loaded, with a fallback listener on an event that fires once per map lifetime — so a hotspot search that landed mid tile churn (after a Satellite/Topo base switch, a pan, or on a slow network) registered nothing, and the pins never rendered until a theme flip or a new search with a different result count. Sprites now register unconditionally, with a `styleimagemissing` listener as a safety net that bakes a missing pin sprite on demand. The same fix is applied to the atlas hatch textures (`AtlasLayer`), which used the identical pattern.
- **The Map Explorer's Pins → Heatmap toggle crashed the entire app.** The sightings layer swapped its map source's identity in place when the display mode changed, which the map library forbids — the toggle threw "source id changed" and dropped the whole app to the error screen (present since 0.5.18). The source now remounts cleanly on a mode change; pins, heatmap, the intensity slider, and the atlas-shading reordering all behave as designed. Species Detail's heatmap was never affected.

## [0.5.29] - 2026-06-10

### Added
- **SnowRaven Mini mentions.** Three informational pointers to [SnowRaven Mini](https://github.com/dtgibson/snowraven-mini) — the author's separate Chrome/Firefox extension that runs the same weather and tide lookup directly on an eBird checklist page: a one-line note under the Weather tab's card, a paragraph in the README, and a short subsection in the in-app Help under Weather. Plain links only — no icons, no fetches, no new providers; the privacy policy is unchanged.

### Fixed
- **Flaky frontend test suite — the dominant `cancelAnimationFrame` failure mode (~11% of full runs).** recharts bundles `@reduxjs/toolkit`, whose autoBatch enhancer races a captured `requestAnimationFrame` against a 100 ms fallback timer and calls bare `cancelAnimationFrame` when the timer wins; `BirdingStats.test.tsx` stubs rAF per-test, so the fallback fired after the stubs were restored in an environment with no native `cancelAnimationFrame`, producing an unhandled `ReferenceError` pinned on whichever test was running. A tiny vitest setup file (`frontend/src/test-setup.ts`) now installs baseline rAF/cAF shims when the globals are undefined. Test infrastructure only — no production code changed. A separate, rarer timing flake was a different mechanism and remained after this fix (addressed separately after 0.5.30).

## [0.5.28] - 2026-06-10

### Added
- **Moon phase on night weather blocks.** When any sampled hour of a checklist falls before sunrise or after sunset, the generated weather block now appends the current moon-phase emoji to the condition emoji on its first line — `☁️🌔` — matching what raincrow.app includes on night checklists. The phase is computed from the checklist's start time (a self-contained port of the lunarphase-js algorithm — no new API calls, no new providers), and the Southern Hemisphere sees the mirrored emoji. Day blocks are unchanged byte for byte, and the Checklists tab's hide-blocks toggle strips the new night headers cleanly with no stripper changes.

## [0.5.27] - 2026-06-10

### Added
- **New Checklists tab.** Your checklists now have a home of their own, with three sections: **Checklist Comments** (search every checklist-level comment you've written — last 10 shown, expandable, Newest/Oldest, with a date link to each checklist on eBird), **Species Comments** (the same search across the observation notes of **all** species at once, each entry leading with a clickable species name), and **All Checklists** (every outing with date, location, protocol, effort, species/individual counts, at-a-glance indicators, and the checklist comment — first 10 shown, expandable).
- **Composable checklist filters.** One pill per category cycles **any → has → doesn't have** for checklist comment, species comments, media, breeding codes, weather block, and tide block — plus Complete/Incomplete, photo/audio/video pills (when the ML export is saved), protocol, county, and a date range. Filters combine, so questions like "complete checklists with breeding codes but no media" are one click each.
- **Hide pasted weather & tide blocks.** A tab-wide toggle (off by default) strips SnowRaven weather/tide blocks out of every comment shown on the tab — and out of search, so searching "Humidity" no longer matches every checklist with a pasted block. A comment that is only a block counts as having no comment while hidden. Flip the toggle to see and search the blocks again.

### Changed
- The comparer's safe comment renderer (entity decoding, validated links, line breaks) is now a shared component used by both the List Comparer and the new Checklists tab.
- The in-app Help table of contents now lists Named Birds (previously missing) and the new Checklists section.
- **Privacy policy: completed the provider list.** `PRIVACY_POLICY.md` now discloses the Cornell Lab asset loads that have always been part of the app — embedded Macaulay Library media on Species Detail and the eBird / Birds of the World link icons beside bird names — and the README, website, and product brief now defer to the policy as the full provider list. (Disclosure only; no behavior change.)

## Website - 2026-06-07

### Added
- **Project showcase website** — a static site in `website/` that introduces SnowRaven and walks through its features with real screenshots, served from GitHub Pages at https://snowraven.dtgibson.com/ and deployed by `.github/workflows/pages.yml` on every push to `main` that touches `website/`. It is dependency-free (hand-written HTML/CSS/JS, system fonts, no third-party requests), supports light and dark mode, and is kept in sync with the README and docs. This lives in the repo only; it is not part of the macOS/Windows/Raspberry Pi app bundle and does not change the app version.

## [0.5.26] - 2026-06-10

### Added
- **Named Birds: a map for each individual bird.** Expand a named bird and you now see a small map of everywhere that individual has been seen, drawn the same way as the Species Detail map. Each report also shows its **location**, between the date and the checklist link.
- **Named Birds: taxonomic and alphabetical sorting.** The sort options are now **Name (Individual)**, **Alphabetical**, **Taxonomic**, and **Last Seen** — Taxonomic orders the individuals by their species' taxonomic order, the same as elsewhere in the app.

### Changed
- **Named Birds: clearer and easier to read.** Lifted the tab's contrast, put each card's individual name and species name on a shared baseline, and set every sighting's comment in its own quoted block so it no longer blends into the card. Behind the scenes the sightings map is now a single shared component used by both Named Birds and Species Detail, and cards on the tab open one at a time.

## [0.5.25] - 2026-06-09

### Fixed
- **Statistics → Media card: every At a glance fact is a proper stat tile again.** 0.5.24 squeezed the busiest-day, longest-streak, and date-span facts into one small caption line under the **At a glance** grid, where they read as an afterthought — and the floating date range was easy to misread as belonging to the streak. All three are back in the grid: **Busiest day** with its date underneath (the date links to that day's eBird checklist — the one holding the most of the day's media when there are several), **Longest streak** now showing the actual dates the streak ran (new), and a new **Archive span** tile with the length of your collection ("2 years") over the first-to-latest date range. Every tile reserves its sub-line slot so all eight stay the same height at any window width — the row misalignment 0.5.24 was chasing cannot come back, and nothing floats below the grid.

## [0.5.24] - 2026-06-09

### Changed
- **Statistics → Media card: fixed alignment and reworked the age-coverage list.** The **At a glance** tiles are now uniform — the busiest-day, longest-streak, and date-span facts moved out of the tile grid (where they made some tiles a line taller and knocked the row out of alignment) into a single caption beneath it, so the streak dates line up with everything else. **Age coverage by species** now lists only species you have documented as a juvenile or immature, shows the first 10 with a "Show all" / "Show fewer" toggle, and is sortable by name (A–Z) or taxonomic order. The "documented only as adults so far" note still appears even when you have no young birds tagged yet.

## [0.5.23] - 2026-06-09

### Added
- **Named Birds — track individual birds over time.** Tag a specific bird in an eBird species comment with a `[name:…]` tag (for example `[name:Winky]` or `[name:one-leg-pete]`) and SnowRaven gathers every checklist where that name appears. A new **Named Birds** tab lists each named individual with its species, first- and last-seen dates, and number of sightings, sortable by name, species, or last-seen; each one expands to show every checklist it appears on, with a link to the checklist on eBird and the species comment. The same information for a single species also appears as a **Named Individuals** section on the Species Detail tab. A bird is identified by its name plus its species (so the same name on two species is two individuals), name matching ignores case, and subspecies fold into the parent species. Computed entirely from your eBird backup, offline.

## [0.5.22] - 2026-06-09

### Changed
- **Tidied the Statistics → Media card.** Renamed the **Age & sex of your subjects** section to **Photos Tagged With Age or Gender** (the two donuts are now "Age" and "Gender"). Removed the **Format coverage** breakdown — it overlapped with, and was less clear than, the Documentation coverage section just above it. Removed the **Community ratings** section for now. Added a separator above the most-photographed / recorded / filmed rankings so the section above can no longer run into them.

## [0.5.21] - 2026-06-09

### Changed
- **The Multimedia tab's Media Comments section now shows only the comment on the media itself** — the asset **Caption** and **Media notes**. The eBird **Observation Details** comment is no longer listed: the Macaulay Library export copies that observation-level comment onto every media item from the same observation, so it was repeating across entries. The list, the count, and the keyword search are now limited to the per-asset Caption and Media notes, so each entry is a real comment about that specific photo, recording, or video.

## [0.5.20] - 2026-06-08

### Added
- **Richer media statistics on the Statistics → Media card** — the card now goes well beyond the most-photographed/recorded/filmed lists, reading more of your Macaulay Library export to break your archive down several ways:
  - **At a glance** — total media, species documented, the photo/audio/video split, your busiest media day, and your longest streak of consecutive days with media, across the span of your collection.
  - **Documentation coverage** — what share of your life list you have captured with media overall and, separately, with a photo, audio, and video, plus how your documented species break down by format (photo-only, photo + audio, all three, and so on).
  - **Age & sex of your subjects** — the age-class mix (adult / immature / juvenile / unknown) and sex mix (male / female / unknown) across your media, counted per individual, with the unknown share shown honestly and the annotation coverage noted.
  - **Age coverage by species** — which age classes you have captured per species, and how many species you have documented only as adults so far.
  - **Behaviors documented** — how many distinct behaviors you have captured and the most common ones, plus a tally of species with media showing breeding behavior (confirmed / probable / possible).
  - **When you capture media** — the time-of-day distribution of your captures, split by photo, audio, and video (the dawn-chorus audio and golden-hour photo patterns become visible).
  - **Community ratings** — when enough of your assets are community-rated, the rating distribution, your mean, and your top-rated pieces.

  Each section appears only to the extent your export carries the relevant annotations (age, sex, behavior, time, ratings), so the card stays clean when those fields are sparse. All of it is computed offline from your own export — nothing is uploaded.

### Internal
- The ML export parser now reads the Age/Sex, Behaviors, Time, Year/Month, and community-rating columns (additive and guarded, so older or column-light exports keep parsing). New `lib/mediaStats.ts` holds the parsing/aggregation (with the verified real-export formats) and the rendering lives in a dedicated `components/MediaStatsSections.tsx`. The synthetic demo-data generator was extended to populate these columns so the showcase reflects the new card.

## [0.5.19] - 2026-06-08

### Added
- **"Jump to comments" pointer on the Multimedia tab** — when your Macaulay Library export carries media comments, the Multimedia tab now shows a short line at the top telling you how many media comments are searchable, with a **Jump to comments** link that scrolls straight to the Media Comments section at the bottom of the tab. The section was easy to miss below the species table; now it's discoverable without scrolling. The line only appears when you actually have comments, so it never points at an empty section.

### Changed
- **Your date-format choice now also governs the Weather lookup's checklist line** — when you fetch a checklist's weather on the Weather tab, the date shown next to the checklist now follows your Settings → Appearance → Date format choice (and includes the time), the same as dates everywhere else in the app. This was the last spot still printing the raw eBird date string.

### Fixed
- **"Reduce motion" is now honored for in-page jump links** — if your operating system is set to reduce motion, the new "Jump to comments" link, the Statistics "Jump to section" navigation, and Species Detail's scroll-to-top when you open a species now jump instantly instead of animating. A CSS rule already covered ordinary scrolling, but these programmatic scrolls passed an explicit "smooth" option that bypassed it, so they previously animated regardless of the setting — contrary to the reduced-motion promise in `ACCESSIBILITY.md`.

### Internal
- **Consolidated programmatic smooth-scrolls into one motion-aware helper** (`frontend/src/lib/scroll.ts`, `smoothScrollIntoView`) used by all three jump sites, and routed the Weather-tab checklist date through the existing pref-aware `formatObsDate` helper. Date formatting across the app now consistently flows through the canonical `formatDate` / `formatObsDate` path.

## [0.5.18] - 2026-06-08

### Added
- **Media Comments section on the Multimedia tab** — a new section below the species table surfaces the notes from your Macaulay Library uploads: the asset **Caption**, **Media notes**, and the **Observation Details** carried over from the eBird checklist. It shows the most recent comments with a keyword filter, a Newest/Oldest sort, and a "Show all" control (mirroring the Species Detail comments box). Each entry shows the species, media type, date/place, the comment (labelled by which field it came from), and a link to that asset on the Macaulay Library; the filter matches across all three comment fields. The section appears only when your ML export contains comments. (The ML parser now also reads these fields and accepts the real export's `Locality` column, which previously went unread.)
- **Weather & tide block coverage in the Statistics → Data Quality card** — if any of your checklist comments carry a weather or tide block (the kind SnowRaven or Raincrow pastes in), the Data Quality section now shows a breakdown of how many checklists — and what percentage — carry **any weather** block, a **Raincrow weather** block, a **SnowRaven weather** block, a **SnowRaven tide** block, and **both** SnowRaven weather and tide. "Any weather" counts a block from either app; Raincrow blocks are recognized by their raincrow.app credit and SnowRaven blocks by their SnowRaven credit; tide blocks are SnowRaven-only. Detection runs entirely offline over your loaded eBird backup and the breakdown is hidden when none of your checklists carry these blocks.
- **Keyboard-accessible map markers in the Map Explorer** — the sighting pins and hotspot teardrops are drawn on the map's GPU canvas, so they can't be keyboard tab stops directly. The sidebar now offers a focusable, screen-reader-labelled list of the markers in the **current map view**: a **"Sightings in view"** list in My Sightings mode and a **"Hotspots in view"** list in Hotspots mode. Each item is a real button in the tab order — activating one with Enter or Space opens the **same details popup** a mouse click on the marker would open and pans the map to it. The lists update as you pan or zoom (and are capped on very dense views, with a "zoom in to narrow" hint), so the keyboard path tracks what's on screen. The Hotspots mode's "Nearest Unvisited Hotspots" rows and the Media Targets mode's "Nearest Targets" list now open the on-map popup the same way (the eBird link is still available alongside). This closes the long-standing accessibility gap noted in `ACCESSIBILITY.md` — individual map markers are now reachable and operable by keyboard.
- **Weather, tide, and at-a-glance badges in the Checklist Comparer** — comparing two eBird checklists now does more than match species:
  - **Badges on each checklist card** show, at a glance, which media types were reported (photo / audio / video), whether any breeding codes were noted, and whether the checklist's comment already has a SnowRaven weather block and/or tide block pasted in. All six badges always show (present or absent) so the two cards line up side by side.
  - **A Weather & Tide section** below the comparison pulls a fresh weather and tide reading for *each* checklist and shows them side by side, so you can compare the conditions of two outings in one place. It's an explicit "Load weather & tide" button — nothing is fetched until you ask, and **nothing is copied to your clipboard automatically**. Each side has its own Copy weather, Copy tide, and Copy weather & tide together buttons (the combined copy carries a single SnowRaven credit, the same as the Weather tab). The two sides load and fail independently — one checklist erroring never blanks the other.
  - When a checklist's comment already includes a weather block, a short note explains that OpenWeather revises historical data over time, so the fresh lookup may differ from what's pasted in the comment.
  - If your eBird or OpenWeather API key isn't set, the species comparison and badges keep working — only the Weather & Tide section shows a nudge to add the missing key in Settings.
- **Choose your date format** — Settings → Appearance now has a **Date format** control: month-first (`Jun 8, 2026`), day-first (`8 Jun 2026`), or ISO (`2026-06-08`), defaulting to month-first. Your choice applies everywhere dates appear and is remembered across sessions. (Under the hood, the app's date formatting was consolidated into one place so every date renders consistently.)

### Changed
- **Weather tab helper text** now notes that weather is automatically copied to the clipboard on a successful lookup, and that tidal information appears below when available.

### Internal
- **Split the three oversized components in place** (no behavior change) — `BirdingStats` (2036→1893), `SpeciesDetail` (1793→1461), and `MapExplorer` (2249→1515) had their pure helpers, shared types, and self-contained presentational/marker sub-components pulled into `lib/` and dedicated component files (`statsPrimitives`, `speciesDetail/*`, `map/*`). Behavior-preserving symbol moves only; the map marker components keep their MapLibre popup/cursor/sprite contracts intact.

## [0.5.17] - 2026-06-07

### Added
- **Tides on the Weather tab** — looking up a checklist now also shows the tide at that place and time, in a box below the weather. It uses NOAA's Tides & Currents data (no API key needed) for the nearest station, showing the water level across your checklist's duration (observed when a gauge reading exists, otherwise predicted, labeled which), whether the tide was rising or falling, the surrounding high and low tides, and the station with its distance. If a high or low turns during your checklist, it says so.
  - If the nearest station is more than 25 miles away, or the checklist is outside the US (NOAA's coverage), a notice explains it with a one-tap option to show the nearest US station anyway.
  - A **Copy Weather and Tide Together** button copies both blocks with a single SnowRaven credit at the bottom.

## [0.5.16] - 2026-06-07

### Added
- **Detect your location when setting a default** — Settings → Default Location now has a "Use my location" button that fills in your coordinates, the same one-tap detection the Map Explorer already offers.

### Changed
- **Default search radius is now 5 miles** — Hotspots and Media Targets start at a 5-mile radius instead of 25 until you pick your own; a radius you've saved as a default still loads. The Settings radius field defaults to 5 too, so saving a home location no longer requires typing one in.
- **Performance sweep, part 2** (continues the 0.5.11–0.5.13 arc; batches A–D and F landed earlier on this branch):
  - **Statistics opens instantly** — the tab paints its header and section navigation first with a brief "Computing your statistics…" indicator, charts follow a frame later, and the geographic map loads in the background. Toggling "Include spuhs" or the accumulation granularity no longer freezes the controls while the numbers recompute.
  - **Map Explorer renders pins on the GPU** — sighting pins and hotspot teardrops are now MapLibre layers instead of hundreds of individual page elements, so panning and zooming a busy map is dramatically smoother. Looks identical, including pin sizes, opacities, and the fade under atlas shading; dark mode now recolors pins and atlas block shading correctly (they previously kept light-mode colors).
  - **Atlas blocks draw only for the visible area** — the California atlas overlay generates blocks for the current view instead of all ~17,000 at once; very wide views show a "Zoom in to see atlas blocks" hint.
  - **Fewer repeat eBird requests** — hotspot, recent-sighting, nemesis, and region lookups are cached for 90 seconds, so re-running the same search or bouncing between map views doesn't re-hit eBird. Errors are never cached.
  - **Loading is always visible** — a progress chip on the map during hotspot/sighting searches, a spinner on the updater's "Checking…" and "Downloading…" states, and fixed-size favicon slots so bird-name rows never shift while icons load.

### Fixed
- Hiding a pin category in the Hotspots legend could make clicking another pin open the wrong popup (selection was tracked by list position; it now uses the location itself).
- The mouse cursor could get stuck as (or lose) the pointer hand when moving between pins and shaded atlas blocks.

## [0.5.15] - 2026-06-06

### Added
- **Richer checklist comparison** — the List Comparer's Checklists mode now shows the full detail of each checklist:
  - **Effort & provenance** on each A/B card: type (Traveling/Stationary/Incidental/…), distance (in the unit you entered), duration, number of observers, and the app + version it was submitted from (e.g. "eBird iOS 3.6.5").
  - **Checklist notes** — the checklist-level comment behind a collapsible "Notes" disclosure on each card.
  - **Species comments** — a 💬 toggle appears on the A and/or B side of a species that has a note (so it's clear which checklist it's on); clicking reveals the note(s). All comments are also collected in a **side-by-side comparison table** at the bottom, where an empty side reads "no comment" (on the checklist, no note) vs "not reported" (not on that checklist).
  - Comments are decoded (emoji, line breaks) and any links in them are clickable; each card's **checklist ID links to the checklist on eBird**.

## [0.5.14] - 2026-06-06

### Added
- **Compare two eBird checklists** — the comparer now has a second mode for individual checklists. Switch to **Checklists**, paste two checklist IDs or URLs (just like the Weather tab), and see which birds were on one, both, or the other — with each species' **count from both checklists side by side**. Where one checklist recorded more of a species, that count is emphasized with bold and a ▲ marker; presence-only ("X") entries show a dash and are never marked higher. It works for any public checklist, not just your own, using your eBird API key.
  - Each checklist is identified by a card showing its **location, date, and ID**, so two visits to the same place are easy to tell apart.
  - **Breeding codes** — each species shows its breeding-evidence code per checklist, as a small pill colored by evidence tier (matching the Breeding Codes tab). eBird's internal API codes are translated to the standard display codes.
  - **Media icons** — small photo / audio / video icons show what media exists for each species on each checklist (counts in the tooltip), drawn from all observers on the checklist.
  - Birds reported as a sub-form (for example a domestic Rock Pigeon) are matched and named by their parent species, so the real common name shows and the same bird lines up across both checklists.

### Changed
- The **Life List Comparer** tab is now simply **List Comparer**, since it compares both full life lists and individual checklists.

### Fixed
- **Map Explorer media filters** — the "Has Photo / Audio / Video" filters on your sightings now match the **specific sighting** that has the media, not every sighting of a species you've photographed or recorded somewhere. Previously, choosing "Has Video" showed pins for locations where you had no video (any sighting of a species you'd ever videoed). The filter now ties media to each observation via its ML catalog numbers.

## [0.5.13] - 2026-06-05

### Added
- **Text size control** — a new setting (Settings → Appearance) scales all of the app's text from 100% up to **200%**, meeting the WCAG 2.1 "Resize Text" accessibility standard. It's especially handy in the desktop app, which has no browser zoom of its own, and your choice is remembered across sessions. SnowRaven's text now also follows your browser's or device's own default text-size setting automatically.

### Improved
- At very large text sizes, the Statistics tab's headline figures (Life List Totals, Effort totals, Key Metrics) now reflow into roomier columns instead of crowding together.

## [0.5.12] - 2026-06-05

A quality, accessibility, and performance release — a sturdier, tested base with
no change to your data.

### Accessibility
- **Charts are now screen-reader accessible** — every chart (life-list growth, the temporal and media trends, sightings/checklists over time, observer and day-of-week distributions) exposes a concise spoken summary, and purely decorative chart flourishes are hidden from assistive tech.

### Performance
- **CSV parsing now runs off the main thread** (a Web Worker), so the interface stays responsive while a large eBird export loads — most noticeable on big datasets and low-power devices like a Raspberry Pi. Falls back to the previous behavior anywhere Workers aren't available.
- **Bird-name rendering is memoized**, so the long species lists (Multimedia, Breeding Codes, Statistics) re-render less.

### Improved
- The Map Explorer's atlas toggle now reads **"California atlas blocks,"** making its California-only scope clear at a glance.
- **Internal:** the Statistics and Species Detail calculations were extracted into dedicated, unit-tested modules (`lib/birdingStats`, `lib/speciesStats`) — 23 new tests covering effort/outings, streaks, co-occurrence, breeding tiers, and more. No behavior change, but the math that powers those tabs is now verified and far easier to maintain.

### Fixed
- Documentation corrected: the Map Explorer's "My Sightings" shows **all** your observations, not just recent ones.

## [0.5.11] - 2026-06-05

A refinement release from a comprehensive app review — accessibility, onboarding,
naming, and a big "lightweight" performance win — with no change to your data.

### Added
- **First-run welcome screen** — a brand-new install (no keys or files yet) now opens to a short welcome that explains setup and links straight to Settings and the docs, instead of an empty tab.
- **Help is always reachable** — a **Help** link in the footer opens the documentation from any tab (previously it was tucked inside Settings only).
- **Inline API-key guidance** — the Settings key fields now link to the eBird key generator and call out the OpenWeather **"One Call by Call"** subscription step right where you enter the keys.
- **Statistics jump-nav completeness** — the section links now include **Media** (when a Macaulay Library export is loaded) and **Other Statistics**, which were missing.

### Improved
- **"Media List" is now "Multimedia"** — clearer name for the tab focused on media coverage (your life list is still there).
- **"Nemesis Birds" is now "Nearby Lifers"** — one consistent name for the nearby-target-species feature in Statistics.
- **Unified, corrected setup instructions** — every "setup required" screen now shows the same accurate steps, including the eBird **unzip** step and the crucial Macaulay Library **"set the filter to All"** step (previously missing on the Multimedia tab).
- **Statistics error state** now offers a "Go to Settings" recovery action.
- Removed a stale permanent "NEW" badge in Settings, and corrected the Default Files descriptions (they understated which tabs each file powers).

### Accessibility
- Bird-name favicon links now have proper labels (screen readers announced the raw URL twice before).
- Sortable table columns (Multimedia, Breeding Codes) are now operable by keyboard (Tab + Enter/Space).
- Added **reduced-motion** support — animations are minimized when your system requests it.
- The published Accessibility statement was revised to accurately reflect current behavior.

### Performance
- **Much lighter first load** — the map and chart tabs (and their large libraries) now load only when first opened. First-paint JavaScript drops from roughly **525 KB to ~110 KB** (gzipped) for anyone who isn't immediately opening a map or chart.
- The eBird backup is now parsed once and shared across tabs instead of re-parsed by each.

### Fixed
- **Dark-mode contrast** — primary buttons were white-on-light-green (unreadable) in dark mode; map popups didn't adapt to dark mode at all; muted/footer/scientific-name text now meets the AA contrast standard in both themes.

## [0.5.10] - 2026-06-05

### Added
- **Top Species on the Statistics tab** — two new ranked top-10 lists: the species you've counted the most **individuals** of, and the species you've reported on the most **checklists**.
- **Notable Outings + richer effort stats** — the Statistics "Effort" section is now **Effort & Outings**: cumulative **totals** (time afield — also spelled out as days / hours / minutes — distance, and area when recorded), average area, an **observer summary** (% solo, average, largest group), and a **Notable Outings** block highlighting your longest, farthest, largest-area, most-species, and most-individuals single checklists (each links to eBird).
- **Highlights & Records section** — a new section gathering your biggest single day, longest streak, longest dry spell, Shannon diversity, biggest single counts (flocks), single-checklist birds, and one-and-done birds in one place.
- **Section jump-nav** — a row of links at the top of the Statistics tab jumps straight to any section.

### Improved
- **Statistics regrouped for clarity** — sections are reordered into a logical flow, and previously scattered stats are grouped meaningfully (streaks, diversity, and record counts moved out of "Firsts & Milestones" and "Data Quality" into the new "Highlights & Records").
- **Full state/province names** — the Statistics "States" lists now show names like **Minnesota** and **Ontario** instead of codes like `US-MN` (US + Canada; other regions fall back to the code, which still drives the eBird link).
- **Clearer effort labels** — metrics are spelled out ("Species per hour", "Average distance") instead of cryptic abbreviations.
- **Longest streak counts any report** — a day counts toward your streak if you reported anything at all that day.
- **Single-checklist birds** no longer redundantly include one-and-done species (which are always single-checklist); the two lists are now distinct.

### Changed
- Area-based stats appear only when your data includes area-covered checklists (the eBird "Area" protocol); otherwise they're hidden rather than shown blank.

### Fixed
- **Maps now recover gracefully when the base map can't load** — if the vector base map can't be fetched (you're offline, or the tile provider is unreachable), all three maps (Map Explorer, Species Detail, and Statistics) now show a clear "Map couldn't load — check your connection" message with a **Retry** button, instead of sitting on "Loading map…" forever. Tapping Retry re-attempts the fetch, so the map appears as soon as the connection is back. (The maps remain online-only for now; offline tiles are a separate future goal.)

## [0.5.9] - 2026-06-04

### Improved
- **Sharper, smoother maps (vector base map)** — all three maps (Map Explorer, Species Detail, and Statistics) now draw from vector tiles via MapLibre instead of raster tiles, so labels stay crisp at every zoom, panning and zooming are smoother, and the base map is tuned to SnowRaven's palette: calm, distinct greens for forest/park/meadow, a warm neutral for developed areas, and state/province borders that show when zoomed out. The Map / Satellite / Topo switcher and the Trails overlay work just as before, on every map.
- **Atlas overlay carried over in full, and easier to read** — the California Breeding Bird Atlas overlay keeps the block grid, shade-by-your-highest-breeding-code, the per-block info popup (with its eBird atlas link), and the optional "Use Textures" hatches. New: when shading is on, any heatmap or pins automatically dim so the breeding-tier colors stay legible on top.
- **Fullscreen on any screen** — the Map Explorer fullscreen button now appears on desktop too, not only on small/mobile screens.

### Fixed
- **Breeding Codes: species names now left-align** — they were center-aligned in that table; they now match the Life List, the media columns, and the rest of the app.
- **Life List: the Total media count is now a link** — the per-type Photo/Audio/Video counts already linked to Macaulay Library; the Total now links too, to all media for that species (with no media-type filter).

### Changed
- The default "Map" base is now OpenFreeMap vector tiles, replacing the CARTO raster base. Under the hood, the Leaflet map libraries have been removed now that every map runs on MapLibre.

### Privacy
- The Privacy Policy's map-tile disclosure now lists **OpenFreeMap** (the new default vector base) in place of CARTO. Tiles are still fetched directly from the provider as you pan and zoom — no SnowRaven server in between, and no tracking added.

## [0.5.8] - 2026-06-04

### Added
- **Consistent, clickable bird names everywhere** — every place a bird's name appears now uses one standard format: the common name links to that species' **Species Detail** entry, followed by quick eBird and Birds of the World icons, with the scientific name shown where there's room. Click a species in the Statistics lists, Map Explorer, Media List, Breeding Codes, or the Life List Comparer and you jump straight to its full history. Where a name used to be a link to something else (for example, the "Most Photographed" lists in Statistics), the **count** now carries that link (to Macaulay Library), and on the map's nearest-targets list a small locate icon does the map pan. Birds you haven't recorded (nemesis/target species) show the name plus icons without a Species Detail link, so it's never a dead end.

### Improved
- **Cleaner maps + a base-map switcher** — the maps now use a clean, light CARTO Positron base map by default (replacing the old OpenStreetMap tiles), which reads much better under your sighting pins and data. On the Map Explorer and Species Detail maps, a control in the top-right lets you switch the base map between **Map**, **Satellite** (aerial imagery), and **Topo (US)** (USGS topographic), and toggle a **Trails** overlay that shows hiking paths on top of any base. Your choice is remembered between sessions. All map sources are free and require no API key.

### Changed
- The empty area around the map now matches the active base map's tone (light for street/topo, dark for satellite).

### Privacy
- The Privacy Policy now discloses the map-tile providers (CARTO, Esri, USGS, Waymarked Trails). Map tiles are fetched directly from these providers as you pan and zoom, with no SnowRaven server in between and no tracking added — the same model as before, now documented.

### Documentation
- **In-app Help and README accuracy pass** — corrected and filled gaps in the documentation to match the current app: the Help intro now notes the app runs on Windows as well as Mac and Raspberry Pi; the Map Explorer atlas-shading description no longer references a non-existent "Observed" breeding level (the levels are Confirmed, Probable, Possible); file-storage wording is now platform-neutral (desktop local data directory vs. server); the My Sightings section documents its County, Media, and Radius controls; and new entries cover the desktop "Rebuild caches" troubleshooting button and how to check for and install in-app updates. The README's Security note is now scoped to the Raspberry Pi / self-hosted install (the desktop apps run no server).


### Added
- **Intel Mac support — the macOS app is now a universal build** — SnowRaven for macOS now ships as a single universal binary that runs natively on both **Apple Silicon (M-series)** and **Intel** Macs. There is one download for either machine (`SnowRaven_x.x.x_universal.dmg`); the previous build was Apple Silicon only, so Intel Mac users could not run the app or receive in-app updates. The in-app updater now serves Intel Macs too (`latest.json` maps both `darwin-aarch64` and `darwin-x86_64` to the universal updater bundle), so existing Intel users — and anyone who installs this build — get every future update automatically.

## [0.5.4] - 2026-06-02

### Improved
- **Map Explorer is easier to use on phones** — on small screens, a fullscreen button now sits next to Filters in the Map Explorer. Tap it and the map expands to fill the entire screen, hiding the app header, tab selector, and mode tabs so you get the maximum map area; tap again to return. The other tabs are unchanged, and the button only appears on small/mobile screens.
- **Cleaner map edges** — the empty area around the world map (visible when zoomed out or before tiles load) now uses an ocean tone instead of a flat grey, so it blends with the sea instead of looking like a rendering gap.


### Improved
- **Heatmap intensity control on the Species Detail map** — the per-species sighting map's Heatmap mode now has the same 1–10 "Heatmap Intensity" slider as the Map Explorer's My Sightings map. Dial it from tighter to broader and hotter to read sighting density at any zoom, with sparse low-count locations made easy to spot. The two heatmaps now behave identically.

### Fixed
- **Weather now auto-copies to the clipboard in the macOS and Windows desktop apps** — on a successful checklist lookup, the formatted weather is copied automatically, matching the web app. Previously the auto-copy silently failed on desktop (the system clipboard rejected the write because it happened after the network request, outside a click). The desktop apps now use the native OS clipboard directly. No extra permission or click is needed; the manual Copy button still works as before.


### Added
- **Map Explorer — shade atlas blocks by your highest breeding code** — when the California atlas blocks overlay is on, a new "Shade by My Highest Breeding Code" toggle tints each block by the strongest breeding code *you* have personally entered there (Confirmed darkest, down to Observed). The shading is based only on your own records, never anyone else's. Clicking a shaded block shows the highest code and how many of your breeding records (of any level) fall inside it.
- **Colorblind-accessible textures** — a separate "Use Textures" toggle (off by default) overlays a distinct hatch pattern per breeding level (sparse dots through dense cross-hatch), so the levels are distinguishable in grayscale, without relying on color alone. Patterns and spacing are tuned to keep the underlying map readable.
- **Overlay available in all three map views** — the atlas overlay (blocks, shading, and textures) now appears in the My Sightings, Hotspots, and Media Targets panels, not just Hotspots.
- **Blocks visible from farther out** — the atlas overlay now draws from higher zoom levels, so you no longer have to zoom in as far to see the block grid.

## [0.5.1] - 2026-06-01

### Improved
- **Map Explorer heatmap is more useful** — the My Sightings heatmap now spreads enough to show where your sightings cluster, instead of reading as isolated dots. A new "Heatmap Intensity" slider (in the My Sightings panel, heatmap mode) lets you dial the coverage from tighter to broader and hotter — handy for reading density at different zoom levels and for making sparse, low-count areas stand out.

## [0.5.0] - 2026-06-01

### Added
- **Map Explorer — California Breeding Bird Atlas blocks** — a new "Atlas blocks" toggle in the Hotspots panel overlays the official California atlas block boundaries on the map. Blocks draw for the area you're viewing (zoom in if you're too far out), and clicking a block opens its page on the eBird California atlas. The block boundaries are generated from a compact bundled dataset, so the overlay works offline with no extra download.
- **Map Explorer — nearest unvisited hotspots** — the Hotspots panel now automatically lists the ten closest hotspots you haven't visited, ranked by distance, each linking straight to its eBird hotspot page.

## [0.4.2] - 2026-05-29

### Changed
- **Clearer Macaulay Library export instructions** — the in-app help and README now tell you to set the My Media filter to "All" (not just Birds) before saving your export, and to leave the downloaded filename unchanged. The filename carries your Macaulay Library user ID, which SnowRaven uses to link straight to your own media pages; renaming the file makes those links generic. Also refreshed the help docs for completeness: the Tab Layout section now describes the responsive dropdown on narrow screens, and the Map Explorer location notes cover macOS, Windows, and web.

## [0.4.1] - 2026-05-28

### Added
- **"Use my location" now works on Windows** — the Windows desktop app gained native location detection (via the Windows Geolocation API), bringing it to full parity with the macOS and Pi/web clients. Click "Use my location" in the Map Explorer to center the map on your position. If Windows location is turned off, the app points you to Settings → Privacy & security → Location. The v0.4.0 "coming later" note is gone.

## [0.4.0] - 2026-05-28

### Added
- **Windows desktop app** — SnowRaven now ships a native Windows build alongside the macOS and Raspberry Pi/web clients, with full feature parity: weather lookup, species detail, statistics, map explorer, breeding codes, life list comparer, settings, in-app help, and in-app updates. Built automatically by GitHub Actions (no Windows machine needed to ship) and published to the same GitHub release as the macOS build, served by a single multi-platform `latest.json`. Distributed unsigned for now, so first launch shows a one-time Windows SmartScreen "unknown publisher" prompt (More info → Run anyway); the in-app updater is unaffected.

### Notes
- "Use my location" in the Map Explorer is not yet available on Windows — the app shows a brief note pointing to address search and manual coordinates instead. Native Windows geolocation is planned for a later release.

## [0.3.30] - 2026-05-28

### Fixed
- **Desktop tab layout now persists across relaunches** — reordering or hiding tabs in the desktop app previously reset to defaults on every relaunch, because the layout was saved to `localStorage`, which Tauri's WKWebView wipes on relaunch. The layout now persists through the same app-data-directory storage that API keys and other settings use. The web/Pi version is unchanged (it reads the layout synchronously for a flash-free first paint).

### Documentation
- Corrected four references (README and in-app help) that incorrectly stated the desktop app stores API keys in the macOS/system Keychain. The desktop app stores keys in its local data directory; the Keychain was never used (it requires entitlements this app does not ship).

## [0.3.29] - 2026-05-27

### Added
- **Responsive tab navigation** — the main tab bar now adapts to the available width. On desktop it stays the familiar horizontal bar; when the tabs would no longer fit (narrow windows, phone browsers viewing the Pi install) it collapses into a compact dropdown that shows the current tab and opens to the full list. The dropdown honors the user's saved tab order and hidden-tab choices, with Settings pinned below a divider and the active row highlighted with a checkmark. The collapse point is measured from actual overflow rather than a fixed breakpoint, so it holds at any tab count or zoom level. Keyboard navigation and ARIA semantics are preserved in both layouts, and the menu layers above the Map Explorer.

## [0.3.28] - 2026-05-27

### Improved
- **Accessibility — keyboard navigation and screen reader support (app-wide)** — comprehensive assistive technology pass across all eight tabs. Every interactive control is now reachable via Tab (including all button elements, which required explicit `tabIndex={0}` in Tauri's WKWebView). The tab bar uses roving tabindex with Left/Right arrow key navigation. The species selector combobox supports ArrowDown/ArrowUp to move through the filtered list and Enter to select; the active option is highlighted and scrolled into view. Filter pills carry `aria-pressed`, toggle switches carry `role="switch"` and `aria-checked`, sort headers carry `aria-sort`, and tab panels carry `role="tabpanel"` with `aria-labelledby`. The Map Explorer mobile sidebar has a full focus trap (Tab cycles within the overlay, Escape closes and returns focus to the trigger). Dynamic regions (weather output, species counts, update status) are marked `aria-live="polite"`. A consistent `:focus-visible` ring (3px green outline) appears on every focused element. The tier-1 breeding code badge text color changed from white to dark purple (#3B0764), bringing contrast from 2.7:1 to 6.8:1 (passes WCAG AA). Visually-hidden `.sr-only` labels added to tier badges and map recency dots for screen readers.

## [0.3.27] - 2026-05-27

### Added
- **Linux installer (`install.sh`)** — one-command installer for Raspberry Pi and Debian/Ubuntu systems. Prompts for a service install (systemd, auto-starts on boot) or a local install (dependencies + build, user starts manually). Installs system packages, clones the repo, builds the frontend, creates a Python virtualenv, prompts for API keys (skippable — configurable later via Settings), deploys the systemd unit for service mode, and prints a success block with both the `hostname.local` and LAN IP URLs. Safe to run via `curl | bash` (all logic inside `main()`); idempotent on re-run (existing `.env` preserved, existing repo updated via `git pull`).

## [0.3.26] - 2026-05-27

### Fixed
- **Dark mode — white flash on overscroll and unbounded tables (mobile)** — `html` and `body` had no `background-color`, so iOS Safari's rubber-band overscroll and any content overflow (e.g. Unbounded toggle in Breeding Codes / Media List) exposed the browser's default white background. Fixed by setting `background-color: var(--sr-bg)` on both elements; the token resolves to `#09090B` in dark mode and `#F9FAFB` in light mode automatically.

## [0.3.25] - 2026-05-27

### Improved
- **Statistics — Effort & Methodology: complete checklists bar** — the complete-checklist rate is now displayed as a two-segment bar (blue/grey) at the top of the Effort & Methodology card, above Protocol Distribution. Travelling and Stationary sub-bars show the completion rate for each protocol type. Count labels ("N of M complete") appear beside each bar's heading. The old text sentence at the bottom of the card is removed.
- **Statistics — Data Quality: count method and comment coverage** — the Count method, Checklist comments, and Species notes bars now all follow the same label+count pattern, with raw counts displayed beside each heading. Species notes is a new bar showing what percentage of individual observation rows carry a species-level annotation. "Comment coverage" is renamed "Checklist comments" to distinguish it from species notes.

## [0.3.24] - 2026-05-26

### Improved
- **Map Explorer — "Use my location" now re-centers the map and places a pin** — after location is detected, the map automatically pans to your position and a blue pin marks the detected location. Previously the coordinate fields were populated but the map stayed wherever it was. The pin clears if you edit the coordinates manually.

## [0.3.23] - 2026-05-26

### Fixed
- **Map Explorer — "Use my location" never prompts for permission (desktop)** — wry's `WKWebView` UIDelegate does not implement `webView:requestGeolocationPermissionFor:initiatedByFrame:decisionHandler:`, the method macOS 12+ requires to show the system location permission dialog. As a result, every `navigator.geolocation.getCurrentPosition()` call was silently denied before macOS was ever consulted, and no SnowRaven entry appeared in Location Services. Fixed by implementing a native `CLLocationManager`-based Tauri command (`get_location`) in Rust (`src-tauri/src/location.rs`) that bypasses WKWebView entirely. The app's `com.apple.security.personal-information.location` entitlement was also missing — hardened runtime requires it for any CoreLocation access.
- **Map Explorer — "Use my location" shows misleading "access denied" over HTTP (web)** — browsers silently return `PERMISSION_DENIED` for geolocation requests from non-secure origins (HTTP) without showing any dialog. The error message "Location access was denied" implied the user had actively denied permission. Fixed by detecting `!window.isSecureContext` before attempting geolocation and showing "Location requires HTTPS. Enter coordinates manually or access the app via localhost."

## [0.3.22] - 2026-05-26

### Added
- **Map Explorer — Use my location** — the "Use my location" button in the Map Explorer now works in the desktop app. Clicking it requests location permission from macOS and centers the map on your current coordinates. If coordinates were empty, it also auto-triggers the active view mode (Hotspots or Media Targets). Platform-specific error messages guide you to the right fix if permission is denied. In Tauri dev mode the button shows a clear developer message since CoreLocation requires a production build's secure protocol context.

## [0.3.21] - 2026-05-27

### Fixed
- **In-app updater installs v0.3.7 instead of the current version** — Tauri only regenerates the `.app.tar.gz` updater bundle when the Rust binary is actually recompiled. All versions after v0.3.7 changed only `tauri.conf.json` (version bump) with no Rust source changes, so Cargo produced incremental builds and Tauri skipped bundle regeneration. Every `release.sh` run since v0.3.7 uploaded the same stale v0.3.7 bundle while `latest.json` advertised the new version. Tauri's signature verification passed (the signature matched the stale bundle), so users received v0.3.7. Fixed by deleting stale bundle artifacts and touching `src-tauri/src/main.rs` before each build to force a full relink, plus a post-build version guard that aborts if the bundle version doesn't match the expected version.

## [0.3.20] - 2026-05-26

### Changed
- **Weather tab** — when OpenWeather API key is missing, the warning now also mentions that the Weather tab can be disabled or moved in Settings, for users who don't want weather features
- **README** — "Local installation (Mac/Linux)" section renamed to "Local installation (Linux)" to avoid sending Mac users down the server install path instead of the desktop binary
- **Settings** — default location placeholder coordinates updated to Point Reyes National Seashore (37.8275, -122.4238) with a 5-mile radius example

## [0.3.19] - 2026-05-26

### Fixed
- **In-app updater exits without relaunching** — Tauri v2's macOS updater performs synchronous in-place bundle replacement inside `downloadAndInstall` — no shell script, no sleep delay. By the time `downloadAndInstall` resolves, the new binary is already on disk at the original `.app` path. The previous code called `exit(0)` after installation, which simply terminated the process without relaunching. Users saw no app after the update and had to manually click the Dock icon; if they relaunched quickly they'd get the new version, but the experience was broken. Fixed by calling `relaunch()` instead: it spawns `current_exe` (now the new binary) and exits, giving users a seamless automatic relaunch into the updated version.
- **In-app updates never offered on Intel Macs** — `release.sh` mapped `x86_64 → x64` when building `latest.json`, producing `darwin-x64` as the platform key. Tauri's updater looks for `darwin-x86_64` on Intel Macs — a mismatch that caused Intel users to never see any update as available. Fixed by using `x86_64` in the arch mapping so `latest.json` uses the correct `darwin-x86_64` key.

## [0.3.18] - 2026-05-26

### Fixed
- **Map Explorer taxonomy fetch blocked — "url not allowed on the configured scope"** — `tauri-plugin-http` v2.5.x changed its default behavior: `http:default` enables the plugin commands but no longer grants access to external URLs. All HTTPS requests from `tauriFetch` (eBird taxonomy, weather, hotspots, Nominatim) were silently blocked. Added `http:allow-fetch` with `allow: [{ url: "https://**" }]` to the capability to restore external network access.

## [0.3.17] - 2026-05-26

### Fixed
- **In-app updater installs but never applies the new binary** — Tauri's macOS updater spawns a background shell script that sleeps 1 second, replaces the `.app` bundle, then calls `open -a` to relaunch. The previous code called `relaunch()` immediately after installation, which started a new instance of the old binary before the script could run. When the script's `open -a` fired, macOS found the app already running and focused the old window instead of launching the new binary. Fixed by calling `exit(0)` instead, so the app closes cleanly, the script replaces the bundle uncontested, and `open -a` launches the new binary.

## [0.3.16] - 2026-05-26

### Fixed
- **API keys and settings not persisting across relaunches or updates** — Consolidated all persistent storage to use `tauri-plugin-fs` with `BaseDirectory.AppLocalData`, the same mechanism that correctly persists uploaded CSV files. API keys are stored in `data/api-keys.json`, settings in `data/settings.json`. The system Keychain approach (v0.3.15) failed because it requires entitlements not configured in this app and fails silently. `localStorage` (v0.3.12–v0.3.14) was ephemeral and cleared on every relaunch. This is the definitive fix.

## [0.3.15] - 2026-05-26

### Fixed
- **API keys wiped on every update and relaunch** — The root cause: Tauri v2's WKWebView uses an ephemeral localStorage that does not survive app relaunches or updates. API key storage now uses the macOS system keychain via `invoke('get_api_key' / 'set_api_key' / 'delete_api_key')` — the Rust `keyring` commands were already implemented in v0.3.12 Phase 2 but were never wired to the TypeScript storage layer. Settings (map center, zoom, etc.) are now stored in `data/settings.json` via `tauri-plugin-fs` with `BaseDirectory.AppLocalData`, the same mechanism that correctly persists CSV files across updates.

## [0.3.14] - 2026-05-26

### Fixed
- **"Find Target Sightings" still failing after cache rebuild** — The eBird taxonomy fetch error was being swallowed silently at two layers (in `getTaxonomyCodes` and in MapExplorer's on-demand fetch), so all failures showed the same generic message regardless of cause. The actual error (network failure, bad API key, unexpected response) is now surfaced directly. Also improved error specificity in `ensureTaxonomy`: network errors, non-200 HTTP responses, and malformed responses each produce a distinct, actionable message.
- **CI lint failures** — `eslint-plugin-react-hooks` flagged synchronous `setPhase()` calls at the top of `useEffect` bodies in `BreedingCodeList`, `LifeList`, and `SpeciesDetail`. Moved the call inside the async `autoLoad` function in each component (semantically identical, no behavioral change).

## [0.3.13] - 2026-05-26

### Fixed
- **"Could not resolve species codes" on Find Target Sightings** — The eBird taxonomy cache (IndexedDB) was written empty during v0.3.11 when API key storage was broken. The stale 7-day cache kept returning empty results for every species lookup, producing a misleading "Check your eBird API key" error. Fixed by bumping the cache key to `taxonomy-v2025` (invalidating all stale caches), validating the fetched taxonomy has ≥100 entries before caching, and improving the error message to direct users to the cache rebuild tool.
- **In-app updater not applying** — After downloading an update the app showed "relaunch to apply," but relaunching via the Dock could refocus the running process instead of quitting it, leaving the old binary running. The updater now auto-relaunches immediately after installation using `tauri-plugin-process`.

### Added
- **Settings → Troubleshooting: "Rebuild caches & restart" button** — Clears the app's local taxonomy cache (IndexedDB) and restarts cleanly. Fixes stale-cache issues without requiring a reinstall. Desktop app only.

## [0.3.12] - 2026-05-26

### Fixed
- **API keys not persisting** — `tauri-plugin-fs` writes to `AppLocalData` were failing silently in production. The `setSetting` call appeared to succeed (no error in the UI) but nothing was written to disk, so keys were lost on every relaunch and cleared on every update. API keys and settings (including map defaults) now use `localStorage`, which is reliable in Tauri's WebView, requires no permissions or plugins, and persists correctly across launches and app updates.

## [0.3.11] - 2026-05-26

### Fixed
- **Map hotspot/sightings key check not live** — Map Explorer read `hasEbirdKey` once at mount and never updated it after a key was saved in Settings, leaving the search button disabled until relaunch. Now re-reads when `keysVersion` increments (same pattern as `filesVersion` for files).
- **"Failed to fetch hotspots" masked real error** — Map service throws plain `Error` objects with `status`/`detail` properties, but the catch blocks in Map Explorer checked `instanceof TransportError`, which always failed. Real errors (403, network failure, missing key) were all silently replaced with the generic fallback message. Catch blocks now read `status` and `detail` from the error regardless of type, so users see the actual failure reason.

## [0.3.10] - 2026-05-26

### Fixed
- **Frontend not rebuilt on release** — `release.sh` ran `tauri build` without first rebuilding the React frontend, so the old `frontend/dist/` from v0.3.8 was bundled into the v0.3.9 binary. All v0.3.9 fixes were in source but not in the shipped app. Added explicit `npm --prefix frontend run build` step to `release.sh`, and added `beforeBuildCommand` to `tauri.conf.json` as a safeguard for direct `tauri build` invocations.
- **Settings page showed incorrect storage description** — "stored on the server" and "stored on this server" text now shows platform-correct descriptions: "stored in this app's local data directory" in the desktop app, server language on web/Pi.
- **Updater bundle renamed** — GitHub release asset `SnowRaven.app.tar.gz` renamed to `SnowRaven-updater.app.tar.gz` to avoid confusion with the installer DMG.

## [0.3.9] - 2026-05-26

### Fixed
- **"Could not check for updates"** — `release.sh` was uploading `latest.json` as `snowraven-latest.json`, causing a 404 from the Tauri updater endpoint. Asset is now named `latest.json` to match the endpoint URL.
- **Files not refreshing after upload** — Life List, Breeding Codes, and Species Detail tabs never re-ran their file-loading effect after Settings uploaded a new file, because they are display-toggled (never unmounted). A `filesVersion` counter in App.tsx is incremented on upload and passed to each tab; their load effects are now re-triggered when a file is saved.
- **API keys lost on relaunch** — Keys stored in the macOS keychain are tied to the code signature of the binary that created them. New app builds could not read entries from prior builds, and the keychain fallback silently returned `null`. API keys are now stored in the app's local data directory (file-based, via `setSetting`) and persist correctly across updates.

## [0.3.8] - 2026-05-26

### Fixed
- Changed bundle identifier from `com.snowraven.app` to `com.snowraven` to avoid macOS conflict with the `.app` bundle extension.

## [0.3.7] - 2026-05-25

### Changed
- **Local release script** (`release.sh`) replaces the removed `tauri-release.yml` CI workflow. Run `./release.sh` after pushing a version bump to build, Apple-notarize, minisign, and publish the macOS desktop app. Apple credentials stay local -- nothing is stored in GitHub. The script generates `latest.json` and uploads it along with the DMG and updater bundle to the GitHub release.
- **Removed `tauri-release.yml`** -- the CI workflow that built unsigned macOS binaries in GitHub Actions is replaced by the local release script.

## [0.3.6] - 2026-05-25

### Fixed
- `transport.ts` used TypeScript parameter properties (`public readonly` in constructor args), disallowed by `erasableSyntaxOnly` in `tsc -b` (TypeScript 6.x project references mode). Replaced with explicit property declarations.
- `MapExplorer.tsx` had `transport.get<unknown[]>('/map/recent-obs')` causing a type mismatch with `setTargetPins` (expected `TargetPin[] | null`). Changed to `transport.get<TargetPin[]>`.
- `tauri-release.yml` used the wrong npm script name (`tauri` instead of `desktop:build`).

## [0.3.5] - 2026-05-25

### Changed
- **Desktop app fully standalone** (Desktop App Phase 6) -- The desktop app no longer requires the Python backend for any operation. Verified: no direct `fetch()` calls, no `/settings/*` backend calls, and no `TauriTransport` paths that fall through to `WebTransport` in Tauri mode. All transport routes (`/weather/*`, `/version/check`, `/stats/nemesis`, `/nominatim/search`, `/map/hotspots`, `/map/recent-obs`) are handled by TypeScript service files. All storage operations (API keys, files, settings) use `TauriStorage`. The Python backend remains the runtime for Raspberry Pi / web server mode -- only the desktop app is standalone.
- **README.md** -- Added "Desktop App Installation (Mac)" section with download, install, and update instructions. Updated desktop app description to reflect that it is fully self-contained.
- **docs/HELP.md** -- Updated Settings > API Keys and Default Files descriptions to distinguish desktop (system keychain / local app data) from web/Pi (server `.env` / server disk) behavior.
- **DECISIONS.md** -- Desktop app migration decision updated to record Phase 6 completion, full phase summary, and private key management guidance.

## [0.3.4] - 2026-05-25

### Added
- **In-app updater** (Desktop App Phase 5) -- In Tauri mode, "Check For Updates" now uses `tauri-plugin-updater` to detect, download, and install updates directly within the app. Progress is shown as a percentage while downloading. After install, the app prompts to relaunch to apply the update. Fallback to the existing GitHub API version check on error.
- **Tauri release CI** (`.github/workflows/tauri-release.yml`) -- New workflow triggered on GitHub release publication. Builds and signs the macOS desktop app binary, generates `latest.json` (the Tauri updater manifest), and uploads both as release assets. Uses `TAURI_SIGNING_PRIVATE_KEY` secret for minisign binary signing; Apple notarization secrets are optional slots.
- **Ed25519 minisign keypair** -- Generated for binary update signing. Public key stored in `tauri.conf.json`. Private key (base64) must be set as the `TAURI_SIGNING_PRIVATE_KEY` GitHub Actions secret; local copy at `~/.tauri/snowraven-signing.key`.
- **`updateManager.ts`** (`frontend/src/lib/tauri/updateManager.ts`) -- Wraps `@tauri-apps/plugin-updater`: `checkForUpdate()` returns structured result (up-to-date / available / error); `downloadAndInstall()` streams download progress.
- **`@tauri-apps/plugin-updater`** -- Added to frontend dependencies. Registered in `lib.rs` as `tauri_plugin_updater::Builder::new().build()`. Permission `updater:default` added to `capabilities/default.json`.

### Changed
- **Update available UI** -- Desktop app now shows "Install update" button (triggers in-app download + install) instead of "run ./update.sh". Web/Pi mode still shows the shell script instruction. New footer states: `downloading` (with % progress) and `ready-to-restart`.

## [0.3.3] - 2026-05-25

### Added
- **App data directory storage** (Desktop App Phase 4) -- In Tauri mode, all data files (eBird backup, ML export) and settings (map defaults) are stored in the OS app data directory via `tauri-plugin-fs`. The Python backend is no longer required for any data persistence in desktop mode.
- **`getFilesStatus()` on `StorageAdapter`** -- Returns `FilesStatus` (ebird/ml metadata) and exported `FileMetadata` type. Replaces `GET /settings/files` backend calls throughout all components.
- **`tauri-plugin-fs = "2"`** -- Added to Cargo.toml. Registered in `lib.rs`. File and settings storage uses `BaseDirectory.AppLocalData` (macOS: `~/Library/Application Support/com.snowraven.app/`).
- **`@tauri-apps/plugin-fs`** -- Added to frontend dependencies for typed fs access in TauriStorage.

### Changed
- **`TauriStorage`** (`frontend/src/lib/storage.ts`) -- All methods now fully implemented without backend dependency: `readFile`/`writeFile`/`deleteFile` use `$APPLOCALDATA/data/`; `getSetting`/`setSetting`/`deleteSetting` use `$APPLOCALDATA/settings/{key}.json`; `getFilesStatus()` reads `$APPLOCALDATA/data/metadata.json`. Dynamic imports keep fs plugin code out of the web bundle.
- **Settings.tsx** -- All backend fetch calls replaced with `storage.*` methods. File upload reads content in-browser then calls `storage.writeFile()`. Key save/delete use `storage.setApiKey()`/`storage.deleteApiKey()`. Map defaults use `storage.setSetting()`/`storage.deleteSetting()`.
- **All data-loading components** (`BirdingStats`, `BreedingCodeList`, `LifeList`, `ListComparer`, `MapExplorer`, `SpeciesDetail`) -- Settings fetch calls replaced with `storage.getFilesStatus()`, `storage.readFile()`, `storage.getSetting()`, `storage.getApiKey()`.
- **`capabilities/default.json`** -- Added scoped `fs:allow-*` permissions for `$APPLOCALDATA/**`.

## [0.3.2] - 2026-05-25

### Added
- **Direct external API calls in Tauri mode** (Desktop App Phase 3) -- In Tauri mode, all external API requests (eBird, OpenWeather, Nominatim, GitHub) are made directly from the desktop app without routing through the Python backend. Uses `tauri-plugin-http` to bypass browser CORS from `tauri://localhost`.
- **Offline timezone lookup** (`get_timezone` Tauri command) -- Uses the `tzf-rs` Rust crate with an embedded timezone database to resolve IANA timezone names from lat/lng coordinates. Replaces the Python `timezonefinder` dependency for the weather workflow.
- **TypeScript service layer** (`frontend/src/lib/tauri/`) -- Six service files call external APIs directly in Tauri mode: `weatherService.ts` (eBird checklist + OpenWeather historical + formatting), `taxonomyService.ts` (eBird taxonomy with 7-day IndexedDB cache), `mapService.ts` (eBird hotspots and recent observations), `statsService.ts` (nemesis/nearby species), `nominatimService.ts` (forward and reverse geocoding with rate limiting), `versionService.ts` (GitHub releases check using native app version via `@tauri-apps/api/app`).
- **`TransportError` class** -- Exported from `transport.ts`; carries `status` and `detail` fields so component error handlers get structured error information from both Tauri service calls and HTTP error responses.
- **`@tauri-apps/plugin-http`** -- Added to frontend dependencies for CORS-bypassed HTTP in Tauri mode.

### Changed
- **`TauriTransport`** (`frontend/src/lib/transport.ts`) -- Routes intercepted paths to the new TypeScript service layer; all other paths still fall through to `WebTransport` (backend). Dynamic imports keep Tauri service code out of the web bundle.
- **`WebTransport`** -- Now extracts the JSON `detail` field from error responses and includes it in thrown `TransportError`.
- **`lib.rs`** -- Added `get_timezone` command; registered `tauri_plugin_http`.
- **15 `fetch()` calls** across `App.tsx`, `BirdingStats.tsx`, `BreedingCodeList.tsx`, `LifeList.tsx`, `ListComparer.tsx`, `MapExplorer.tsx`, `SpeciesDetail.tsx` migrated to `transport.get()` / `transport.post()`. Settings-related fetch calls unchanged (Phase 4).
- **`Cargo.toml`** -- Added `tauri-plugin-http = "2"` and `tzf-rs = "0.4"`.
- **`capabilities/default.json`** -- Added `"http:default"` permission.

## [0.3.1] - 2026-05-25

### Added
- **OS keychain for API keys** (Desktop App Phase 2) -- In Tauri mode, eBird and OpenWeather API keys are stored in the OS native keychain (macOS Keychain, Windows Credential Manager) via the `keyring` Rust crate. Three Tauri commands exposed: `get_api_key`, `set_api_key`, `delete_api_key`. `TauriStorage` updated to use these commands. Keys persist across app restarts. Bridge write to the Python backend `.env` kept for Phase 3 transition compatibility.
- **`@tauri-apps/api`** -- Added to `frontend/package.json` dependencies for typed `invoke()` access to Tauri commands from TypeScript.

## [0.3.0] - 2026-05-25

### Added
- **TypeScript weather formatter** (`frontend/src/lib/weatherFormatter.ts`) -- Pure TypeScript port of `backend/formatters/weather.py`. Exports `formatWeather()`, `windDescription()`, `cardinal()`, `conditionEmoji()`, `formatRange()`, `formatLocalTime()`, and `bankersRound()`. Produces byte-for-byte identical output to the Python reference for all test fixtures. No new npm dependencies; no Node.js-only imports (browser-safe for Phase 3).
- **Golden test suite** (`frontend/src/lib/weatherFormatter.test.ts`) -- 61 vitest tests covering all Beaufort boundaries, all 8 cardinal directions, banker's rounding at .5 boundaries, multi-hour aggregation, wind description sort order, wind direction insertion order, capitalize semantics, equal-value ranges, noon/midnight formatting, and a byte-for-byte match against the production fixture from `backend/tests/test_weather_router.py`.
- **Golden reference script** (`frontend/src/lib/weatherFormatter.golden.py`) -- Python oracle script that runs the Python formatter logic against each test fixture and prints expected output. Documents how the TypeScript golden values were generated; re-run if the Python formatter changes.

## [0.2.0] - 2026-05-25

### Added
- **Transport seam** (`frontend/src/lib/transport.ts`) -- `TransportAdapter` interface wrapping all outbound HTTP. `WebTransport` routes through the existing Vite proxy to the FastAPI backend (no behavior change for web/Pi users). `TauriTransport` delegates to `WebTransport` in Phase 0; will call external APIs directly in Phase 3 as each proxy migrates.
- **Storage seam** (`frontend/src/lib/storage.ts`) -- `StorageAdapter` interface wrapping all persistent data access: API keys, settings, and stored files. `WebStorage` routes through the existing `/settings` API endpoints. `TauriStorage` delegates to `WebStorage` in Phase 0; will use OS keychain (Phase 2) and app data directory (Phase 4) as migration progresses.
- **Platform detection** (`frontend/src/lib/platform.ts`) -- `isTauri()` utility checking `window.__TAURI_INTERNALS__`. Single source of truth for platform detection across all seam implementations.
- **Tauri v2 project** (`src-tauri/`) -- Tauri project initialized: `Cargo.toml`, `build.rs`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`, and `capabilities/default.json`. Wraps the existing Vite frontend build. App identifier: `com.snowraven.app`.
- **Root `package.json`** -- `desktop:dev` and `desktop:build` scripts for running the Tauri app via `@tauri-apps/cli`.

### Changed
- **`frontend/vite.config.ts`** -- Added `clearScreen: false` for Tauri compatibility (keeps Tauri terminal output visible).

## [0.1.19] - 2026-05-25

### Added
- **In-app help documentation** -- New "Help & Documentation" section at the top of the Settings tab with an "Open documentation" button. Clicking it opens a full-screen overlay showing the complete `docs/HELP.md` documentation: Getting Started, API Keys (eBird and OpenWeather with setup instructions), Default Files (eBird backup and ML export), and a section for every tab. Rendered from a bundled markdown string with no network call at runtime -- works fully offline.
- **`docs/HELP.md`** -- Single source of truth for all documentation. Available in-app (via the `?raw` import bundled at build time) and rendered on GitHub at a permanent URL. No em dashes or emojis.
- **`HelpDocs.tsx`** -- Full-viewport overlay component with sticky header, two-column layout (sidebar TOC + content), Escape-key close, focus trap, and a custom lightweight markdown renderer with no new dependencies.
- **README.md** -- Added "Documentation" section with a "Full documentation" link to `docs/HELP.md`. Updated all tab descriptions to reflect the Settings-first model (no per-tab file upload). Added Statistics and Map Explorer tab entries. Removed all em dashes from README prose.

## [0.1.18] - 2026-05-25

### Changed
- **Build — chunk splitting** — Vendor libraries now split into three separate cacheable chunks: `vendor-recharts` (~397 kB), `vendor-react` (~179 kB), `vendor-leaflet` (~170 kB). App code chunk reduced from ~1,013 kB to ~272 kB. Resolves the large-chunk build warning. Configured via `manualChunks` in `vite.config.ts`.

## [0.1.17] - 2026-05-25

### Changed
- **Statistics — Mobile layout** — Statistics tab now adapts to narrow screens. SectionCard padding scales down with `clamp()`. Two-column grids (Geographic counties/states, Temporal day-of-week/start-hour) collapse to a single column below ~400px. The four-cell Effort metrics grid wraps to 2×2. Breeding filter buttons and Media interval controls wrap instead of overflowing.
- **Statistics — Nemesis Birds description** — Corrected and expanded. Now accurately states species are sorted by most recently seen (not frequency, which was the previous incorrect description). Adds the 30-day observation window, the source (eBird observations for the configured location and radius from Settings), and an inline dot color legend (red = past 7 days, amber = 8–14 days, grey = 15–30 days).

## [0.1.16] - 2026-05-25

### Added
- **Statistics — Media card** — New card between Breeding Stats and Other Statistics, visible when an ML export is loaded. Includes a four-series line chart (Photo, Audio, Video, Total) with Weekly / Monthly / Yearly / Total interval controls and a Per Period / Cumulative toggle. In Total mode the chart shows a cumulative step-line at daily granularity and the toggle is hidden. Chart is suppressed when data spans fewer than two periods.

### Changed
- **Statistics — Media rankings moved** — Most Photographed, Most Recorded (Audio), and Most Filmed (Video) top-10 rankings have moved from Other Statistics into the new Media card.
- **Statistics — Other Statistics** — Now contains only Nemesis Birds.

## [0.1.15] - 2026-05-24

### Added
- **Settings — Tab order & visibility** — New section at the bottom of Settings lets users drag tabs into any order and hide tabs they don't use. Settings tab is always fixed last. Changes take effect immediately with no save button. Preferences are stored per-browser in `localStorage` and survive page reloads. At least one tab must remain visible at all times. Hiding the currently active tab auto-switches to the first visible tab.

## [0.1.14] - 2026-05-24

### Changed
- **Statistics — Single-checklist and one-and-done birds** — moved from Other Statistics to Data Quality, below the Biggest Single Counts table.

## [0.1.13] - 2026-05-24

### Fixed
- **Media List — Taxonomic sort for non-bird animals** — entries with a single-word scientific name (no space) now sort in the middle tier alongside other non-bird animals, rather than at the very end with entries that have no scientific name at all.

## [0.1.12] - 2026-05-24

### Added
- **Statistics — Denser milestone schedule** — 43 milestone thresholds replacing the old 20, with every 10 species below 100, every 25 from 100–475, every 50 from 500–950, and sparse milestones from 1,000 to 3,000. Milestones are now in the Firsts & Milestones card instead of Life List Totals.
- **Statistics — Per-year species & best day** — Checklists by Year now shows distinct species count and best single-day species count alongside checklist count. Best-day count links to the eBird checklist when the submission ID is valid.
- **Statistics — Top Locations map** — Leaflet map in Geographic Stats showing numbered markers for top locations by checklists (green circles) and top locations by species (blue squares). Map appears at the top of the card. Markers auto-fit to bounds on load.
- **Statistics — One-and-done birds as links** — One-and-done bird pills now link to the eBird checklist where the single individual was recorded, matching single-checklist bird behavior.
- **Statistics — Nemesis bird links** — Each nemesis bird name links to its eBird species page. Taxon codes are resolved from ML export data or a secondary taxonomy lookup; unresolvable names fall back to plain text.

### Changed
- **Statistics — Accumulation pill order** — Life list accumulation toggle now reads Weekly · Monthly · Yearly · Total.
- **Statistics — Day-of-week chart layout** — Pie chart and legend now appear below the bar chart instead of beside it.
- **Statistics — "Fun Stats" renamed** — Section is now called "Other Statistics."

## [0.1.11] - 2026-05-24

### Added
- **Species Detail — Weekly graph interval** — new "Weekly" option in Graph Options groups sightings, checklists, and media by ISO week. Toggle order is now Weekly · Monthly · Yearly. Monthly is the new default on load and on every species change.
- **Species Detail — Checklists Over Time graph** — new chart card below "Sightings Over Time" showing how many of your checklists recorded the species per period (per week/month/year, or cumulative). Uses the same interval and view-mode controls as the other graphs.
- **Species Detail — Frequency statistic** — new "Frequency" cell in the Sightings section shows what percentage of your checklists include the selected species, with a slim fill bar. Updates reactively when county or date-range filters are active.

## [0.1.10] - 2026-05-24

### Fixed
- **Media List — Taxonomic sort for non-animals** — entries with no genus+species in their scientific name (Habitat, Soundscape, Experience, etc.) now sort alphabetically at the very end of the list when taxonomic sort is active, after all non-bird animal entries. Previously they were grouped with other non-birds and sorted by taxon order.

## [0.1.9] - 2026-05-24

### Added
- **Statistics — Life List Accumulation** — new "Total" granularity mode plots one data point per new life species in chronological order using a step-line chart. Tooltip shows the species name at each milestone. Toggle order is now Total · Yearly · Monthly · Weekly with Total as default.
- **Statistics — Milestone pills** — each reached milestone now displays the species name that hit that threshold and links to the corresponding eBird checklist.
- **Statistics — First/last observation cards** — location name appears on a second line; date is a clickable eBird checklist link when a valid submission ID is present.
- **Statistics — Biggest single day** — species count links to the eBird checklist.
- **Statistics — Temporal pie charts** — donut pie charts alongside the checklists-by-month and checklists-by-day-of-week bar charts, with percentage labels in legends.
- **Statistics — Percentage display** — checklists-by-month, by-day-of-week, and by-start-hour bars now show the percentage of total checklists alongside the raw count.
- **Statistics — Geographic charts split** — counties and states/provinces are now shown as two separate side-by-side charts each: one ranked by checklists, one ranked by species. Top locations also split into by-checklists and by-species lists, each showing both metrics.
- **Statistics — Observer count pie chart** — donut pie chart added alongside the observer count bar chart in Effort & Methodology.
- **Statistics — Breeding activity by month** — stacked color-coded bars showing confirmed (dark purple), probable (medium purple), and possible (light purple) species counts per month. Filter buttons (All / Confirmed / Probable / Possible) let users isolate one tier.
- **Statistics — One-and-done pills** — each pill links to the single checklist the species appeared on.
- **Statistics — County/state region links** — county entries link to the state/province eBird region page; state/province entries link to their eBird region page directly.
- **Statistics — ML media links** — most-photographed/recorded/filmed lists now link to Macaulay Library catalog filtered to the user's own media of that type and species (using `taxonCode` + `userId`), matching the behavior of the Media Count tab.

### Fixed
- **Statistics — Average duration and spp/hour blank** — eBird CSV column is `Duration (Min)` with parentheses; the parser was searching for `duration min` without parentheses. Fixed column header matching in `parseEbirdObservations.ts`.

## [0.1.8] - 2026-05-23

### Added
- **Media Targets — Filter by Type** — new filter pills (All / Photo / Audio / Video) in the Map Explorer Media Targets sidebar. Selecting one or more type pills narrows the map pins and nearest-10 list to species missing those specific media types (AND logic). The species count updates as the filter changes. Filter resets when "Find Recent Sightings" is clicked.

### Fixed
- **Hotspots — personal location radius** — personal location pins were appearing outside the user-selected radius because the eBird API expects distance in km but both fetch calls (`/map/hotspots` and `/map/recent-obs`) were passing the radius in miles. Both calls now convert before the request (`Math.round(radius * 1.60934)`). The personal-pin haversine comparison was already in miles and is unchanged.

## [0.1.7] - 2026-05-23

### Fixed
- **Statistics tab build error** — `Tooltip` formatter parameter typed as `number` failed `tsc -b` (the stricter build-time type checker) because Recharts passes `ValueType | undefined`. Broadened to a runtime guard: `typeof v === 'number' ? fmt(v) : String(v ?? '')`.

## [0.1.6] - 2026-05-23

### Added
- **Statistics tab** — new dedicated tab with 8 sections of comprehensive birding analytics computed client-side from the stored eBird backup and ML export:
  - **Life List Totals** — species count, checklist count, locations, years active, states/provinces, countries, and a life list accumulation curve (area chart) with milestone badges at 100, 200, 300, 400, 500+ species.
  - **Firsts & Milestones** — biggest single day, longest consecutive-day streak, longest dry spell, and Shannon diversity index (H′).
  - **Temporal Stats** — bar histograms for checklists by year, month, day of week, and hour of day.
  - **Geographic Stats** — top 10 locations with checklist and species counts; county breakdown with expand/collapse; observation map with Pins and Heatmap toggle.
  - **Effort & Methodology** — total and average duration/distance, complete-checklist ratio, average observers, and protocol breakdown.
  - **Data Quality** — numeric count vs. presence-only (X) ratio, checklists with notes percentage, and biggest single counts by species.
  - **Breeding Stats** — confirmed/probable/possible species counts and breeding activity by month histogram.
  - **Fun Stats** — Big Year selector (all years in the data); most photographed species from ML export; one-and-done birds (seen on exactly one checklist); Nemesis Birds (recently reported nearby but not on the life list, via new `GET /stats/nemesis` endpoint).
- **Spuh/slash toggle** — header-level control that recomputes all species-count stats globally.
- **`ObservationEntry` — 8 new optional fields** parsed from eBird backup CSV columns that were previously discarded: `time`, `duration`, `distance`, `protocol`, `numObservers`, `allObsReported`, `checklistComments`, `stateProvince`. All optional; no existing callers affected.
- **`ChecklistEntry` type** — new derived type (computed in `useMemo`, not parsed) representing one deduped entry per eBird checklist submission.
- **`GET /stats/nemesis`** — new backend endpoint proxying the eBird regional recent-observations API. Validates lat/lng/dist parameters, returns deduplicated species with most-recent observation date.

## [0.1.5] - 2026-05-23

### Added
- **Species Detail — Graph Options card** — a new dedicated card above the Sightings Over Time and Media Over Time graphs. Replaces the auto-detect interval logic and the embedded Per Year/Cumulative toggle. Users can now explicitly choose Yearly or Monthly interval and Per Period or Cumulative view mode. Both graphs respond to the same controls simultaneously.
- **Species Detail — Reported With section** — a new section between Breeding Codes and Top Locations listing the species most frequently appearing on the same eBird checklists as the selected species. Results are ranked by co-occurrence coefficient (shared checklists ÷ target checklists), expressed as a percentage. Top 10 are shown by default with expand/collapse for the full list. Respects active county and date-range filters, excludes the target species itself, and requires a minimum of 2 shared checklists.

### Improved
- **Species Detail — `buildGraphData` signature** — replaced auto-detection of yearly vs. monthly interval with an explicit `interval` parameter, giving the Graph Options card direct control over graph granularity.

## [0.1.4] - 2026-05-23

### Fixed
- **Media List — taxonomic sort with Show Subspecies** — toggling "Show subspecies" caused domestics and subspecies to sort to the bottom instead of their correct taxon position. The taxon-order lookup now falls back to the normalized species name (stripping trailing parentheticals) so entries like "Mallard (Domestic type)" resolve correctly.

### Removed
- **Filename pill** — the pill showing the stored ML export or eBird backup filename has been removed from the Media List, Breeding Codes, and Species Detail tabs. Settings is now the sole file source, making the pill redundant.
- **Stale Settings copy** — removed the sentence "Uploading a different file within a tab is session-only and won't replace your saved default." Per-tab upload no longer exists.

## [0.1.3] - 2026-05-23

### Added
- **Media List — "Is Target" filter pill** — new pill immediately after "Has media" in the filter bar. Shows every species missing at least one of Photo, Audio, or Video. Combines with all other pills using AND logic. "All" resets it along with all other filters.
- **Map Explorer — per-species missing-type icons on target pins** — each pin label now shows small 10px SVG icons (camera, mic, video camera) for the media types that species is still missing. Icons use `currentColor` and appear to the right of the species name. Multi-species location groups show "N species" with a popup listing each species and its missing types.
- **Map Explorer — expanded targeting model** — a species is now a target if it is missing at least one of Photo, Audio, or Video (previously: zero ML entries only). Partial-coverage species (e.g., has photos, no audio) now appear as targets on the map and in the "Is Target" pill.
- **Map Explorer → Media List cross-tab navigation** — "N target species" in the Media Targets sidebar is now a clickable link. Clicking it switches to the Media List tab with "Is Target" pre-applied. Filter resets when navigating away so returning to the tab does not re-apply it.
- **Map Explorer — updated sidebar label** — sub-label beneath the target count now reads "from ML export · missing ≥1 media type" (was "no media recorded").
- **Design tokens** — added `--sr-is-target-bg`, `--sr-is-target-text`, `--sr-is-target-border` in both light and dark themes for the amber "Is Target" pill styling.

## [0.1.2] - 2026-05-23

### Improved
- **Map Explorer — tab centering** — clicking Hotspots or Media Targets now immediately re-centers the map to the user's saved default location at the appropriate zoom level, replacing the previous behavior where the map stayed frozen at the My Sightings scale.
- **Map Explorer — tab auto-fetch** — switching to Hotspots or Media Targets automatically triggers the fetch if a default location is saved, so results appear without requiring an extra button click.
- **Map Explorer — target label legibility** — media target species-name pills now use `display: inline-block` so the colored background spans the full width of the species name (previously it was clipped to 12px, Leaflet's default icon size). Added a white border and stronger box-shadow so pins stand out clearly from OSM map tiles.

## [0.1.1] - 2026-05-22

### Fixed
- **Map Explorer — mobile overlay not working** — the sidebar's inline `display: flex` style overrode the CSS class's `display: none`, so the sidebar was permanently visible on mobile and pushed the map aside instead of overlaying it. Moved `display`, `flex-direction`, and `overflow` out of the inline style and into the CSS base class so the media query can correctly toggle them.
- **Map Explorer — Filters button hidden under map** — the floating Filters button, sidebar overlay, and backdrop had z-indices of 30, 40, and 50, all below Leaflet's internal layers (tiles at 200, markers at 600, controls at 1000). Raised to 1050, 1100, and 1200 respectively.
- **Map Explorer — map not centering on saved default location** — loading map defaults pre-filled the lat/lng/radius fields but left the map centered on North America. Added `DefaultCenterSetter`, a null-rendering child inside `MapContainer` (same pattern as `MapPanner`), that calls `map.setView()` once when defaults load, using a zoom level derived from the saved radius.

## [0.1.0] - 2026-05-22

### Added
- **Map Explorer — mobile layout** — on viewports ≤640px the map now fills the full screen with no sidebar visible by default. A green "Filters" pill button floats in the bottom-right corner of the map. Tapping it opens the filter sidebar as a full-height overlay with a dark backdrop; tapping the backdrop or the close button in the sidebar header dismisses it. Desktop layout (>640px) is pixel-identical to before.
- **Settings — Default Location** — new section at the bottom of the Settings page with Latitude, Longitude, and Radius (mi) inputs. Saving persists the values server-side (`data/map-defaults.json`). The Map Explorer reads these defaults on mount and pre-fills the coordinate fields for all three map modes (My Sightings, Hotspots, Media Targets). Clear removes the saved defaults and resets the fields.
- **`GET /settings/map-defaults`** — returns saved default location or 404 if none saved.
- **`POST /settings/map-defaults`** — saves `{lat, lng, dist}` with server-side validation (lat ∈ [−90, 90], lng ∈ [−180, 180], dist > 0).
- **`DELETE /settings/map-defaults`** — removes saved default location.

## [0.0.45] - 2026-05-22

### Fixed
- **Map Explorer — build failure** — `handleFindHotspots` and `handleFindSightings` were passed directly as `onClick` handlers after being changed to accept optional parameters. `tsc -b` (used by the build and update script) correctly rejected the `MouseEvent`-to-`number` type mismatch that `tsc --noEmit` missed. Wrapped both handlers in arrow functions so the mouse event is absorbed and not forwarded.

## [0.0.44] - 2026-05-22

### Added
- **Map Explorer — Address geocoding** — both Hotspots and Media Targets sidebars now have a "Search by place name" field above the lat/lng inputs. Typing a place name and pressing Enter (or clicking the search icon) resolves the address via Nominatim, populates the coordinates, and immediately triggers a fetch. Inline errors shown for no-result and network-failure cases.
- **Map Explorer — Hotspot legend toggles** — each legend row (Visited, Unvisited, Personal) is now a clickable button that hides or shows that pin category on the map. Hidden rows render at 40% opacity. All categories restore to visible on each new fetch.
- **Map Explorer — Media Targets recency tiers** — target pins are now color-coded by three green shades: fresh (≤7 days, vivid), mid (8–15 days, medium), old (16–30 days, faded). Sightings window extended from 14 to 30 days. Pins older than 30 days excluded by the eBird API.
- **Map Explorer — Last 30 Days / Last Week toggle** — segmented toggle in the Media Targets sidebar filters displayed pins client-side. "Last 30 Days" shows all pins within the window; "Last Week" shows only pins with a sighting in the past 7 days. No network request on toggle.
- **Map Explorer — Checklist link in popup** — each target pin popup now includes a "View checklist {subId}" link that opens the eBird checklist in a new tab. Only shown when a valid subId (matching `/^S\d+$/`) is present.
- **Map Explorer — Nearest-10 sidebar list** — Media Targets sidebar shows a ranked list of the ten closest pins sorted by haversine distance from the center point. Each row shows species name, location, distance in miles, and a tier dot. Clicking a row pans the map to that pin.
- **`GET /nominatim/search`** — new backend endpoint that forward-geocodes a place name via Nominatim OSM, sharing the existing rate-lock (≤1 req/sec) and User-Agent header.
- **CSS tokens** — `--sr-map-target-fresh`, `--sr-map-target-mid`, `--sr-map-target-old`, `--sr-map-target-old-text` added to both light and dark theme blocks in `globals.css`.

## [0.0.43] - 2026-05-22

### Fixed
- **Map Explorer — grey map tiles** — `MapContainer` initialises inside a hidden tab panel when data loads while the user is on another tab, giving Leaflet a 0×0 container. Added `AutoSizeMap` (a `ResizeObserver`-backed child component) that calls `map.invalidateSize()` whenever the container changes size, and updated `SightingMarkers` to defer `fitBounds` until the container reports a non-zero size — falling back to Leaflet's `resize` event if the container is still hidden at mount time.
- **Map Explorer — "Use my location" silent failure** — browsers block `navigator.geolocation` on non-secure HTTP origins (except `localhost`). The button now checks `window.isSecureContext` before calling the API and immediately shows a clear message ("Location detection requires HTTPS") instead of a generic fallback. Permission-denied errors are also reported distinctly from general unavailability.

## [0.0.42] - 2026-05-22

### Added
- **Map Explorer** — new tab with three view modes: My Sightings plots all personal eBird observations as weighted circle pins on an interactive map with real-time filters (species, date range, county, breeding code tier, media coverage) and a pins/heatmap toggle; Hotspots fetches nearby eBird hotspots and classifies them as visited (green ✓), unvisited (blue ⬤⬤), or personal (amber ★) using stored backup data; Media Targets identifies species with no ML media and finds where they've been recently reported near a chosen location, showing label pins per (species, location) pair.
- **`GET /map/hotspots`** — new FastAPI endpoint proxying the eBird hotspot geo API; returns 401 when no key is configured.
- **`GET /map/recent-obs`** — new FastAPI endpoint proxying eBird recent geo observations, filtered and grouped by (speciesCode, locId) server-side.
- **Map pin CSS tokens** — `--sr-map-visited`, `--sr-map-unvisited`, `--sr-map-personal`, `--sr-map-target` added to both light and dark theme blocks in `globals.css`.

## [0.0.41] - 2026-05-22

### Changed
- **Settings-first file model** — Breeding Codes, Media List, and Species Detail tabs no longer offer per-tab file upload. They load automatically from files stored in Settings, and show a guided "Go to Settings" screen when no file is configured. This completes the model started with the Settings file storage feature.
- **Life List Comparer — My List mode** — when an eBird backup is stored in Settings, the comparer offers "My List" as List A. Select it, upload any other eBird backup as List B, and compare without hunting for your own file. Results use "My List" / "Other List" as labels instead of filenames.
- **Weather tab key notices** — amber warning cards appear above the checklist input when the eBird or OpenWeather API key is not configured, with a "Go to Settings →" link.

## [0.0.40] - 2026-05-22

### Fixed
- **Species Detail graph TypeScript error** — removed an incorrect `as React.SVGProps<SVGTextElement>` type cast on shared axis props introduced in v0.0.39; `tsc -b` (used by the build and update script) rejected it with 4 errors while `tsc --noEmit` silently accepted it, causing the Pi update to fail mid-build
- **Update script working directory bug** — `cd frontend && npm ci && npm run build && cd ..` left the shell stranded in `frontend/` when the build failed, making the subsequent `cd backend` fail with "No such file or directory"; changed both directory-sensitive blocks to use subshells `(cd dir && ...)` so failures can't corrupt the working directory
- **Missing `package-lock.json`** — lockfile was present locally but never committed; `npm ci` on the Pi fell back to a stale lockfile with mismatched package versions, and `npm audit` failed entirely with ENOLOCK; lockfile now committed and kept current
- **`brace-expansion` vulnerability** — moderate severity DoS advisory patched via `npm audit fix` (updated from affected range 5.0.2–5.0.5)

## [0.0.39] - 2026-05-21

### Improved
- **Species Detail — split sightings and media graphs** — "Sightings Over Time" now shows only the individuals line with its own y-axis scale. When ML media is loaded and the species has at least one media item, a second "Media Over Time" graph appears below with photo, audio, and video on their own independent y-axis. Previously all four lines shared one axis, making media counts hard to read for species with large individual counts.

## [0.0.38] - 2026-05-21

### Added
- **Comprehensive Media Life List** — when an eBird backup is stored in Settings alongside the ML export, the Media List tab now shows every species from the eBird backup with ML media counts overlaid. Species with no media show dashes in all count columns. Previously, only species that appeared in the ML export were listed.
- **"Show subspecies" toggle** — new toggle switch in the Media List controls row (matches the equivalent toggle on Species Detail). Default OFF: subspecies parentheticals stripped, entries merged. Toggle ON to see each subspecies variant as its own row.
- **"Show sp./slash" toggle** — new toggle switch to reveal or hide spuh and slash entries (entries ending ` sp.` or containing `/`). Default OFF (hidden).
- **"Show non-bird" toggle** — new toggle switch visible only in comprehensive mode. Non-bird entries are ML catalog items whose normalized name does not appear in the eBird backup species list (soundscapes, insects, habitats, etc.). Default OFF (hidden). When shown, non-bird entries appear below all bird entries in taxonomic sort under a "Non-Bird Media" section separator.
- **"Has media" filter pill** — new pill between "All" and the "No photo/audio/video" group. When active, shows only species that have at least one media item (photo, audio, or video), hiding all zero-count rows in one click.
- **Shared species utilities** — `normalizeSpeciesName` and `isSpuhOrSlash` extracted to `frontend/src/lib/speciesUtils.ts` and imported by both `LifeList` and `SpeciesDetail`.

## [0.0.37] - 2026-05-21

### Added
- **Sightings Over Time graph** — new line chart on Species Detail showing total individuals reported per year (or per month for single-year species), with a Per Year / Cumulative segmented toggle. When an ML export is loaded, optional overlay lines show photo, audio, and video item counts per period. Graph is filter-reactive (county + date range) and hidden when fewer than 2 time periods exist.
- **Map heatmap toggle** — new Pins / Heatmap button in the Sighting Locations map header. Heatmap mode renders a weighted `leaflet.heat` overlay showing observation density; individual markers are hidden. Resets to Pins on species change. Hidden when the species has no coordinate data.

## [0.0.36] - 2026-05-21

### Improved
- **Expand/collapse removed** — all four tabs (Life List, Breeding Codes, Media List, Species Detail) now use natural page flow; the toggle button that showed/hid content is gone
- **Media List — ML export only** — removed the secondary eBird backup drop zone; ML export is now the sole input, simplifying the upload flow and removing dead code paths
- **Unbounded mode — Life List and Breeding Codes** — new "↔ Unbounded" toggle in the filter bar lets the table expand to its full natural width so the whole page can be panned horizontally on mobile, rather than scrolling inside a small bounded box; "↔ Normal" collapses it back
- **Unbounded mode — species column unfreezes** — in Unbounded mode on the Breeding Codes tab, the frozen species name column is released so the entire table scrolls as one unit

## [0.0.35] - 2026-05-20

### Fixed
- **White page crash** — `BreedingCodeList` called three `useMemo` hooks after conditional early returns, violating React's hooks rules. When the component transitioned from `loading-saved` to `ready` (e.g. on auto-load from Settings), React detected a different hook count and unmounted the entire app. All three memos are now declared before any early return with null-safe guards.
- **ESLint lint failure in CI** — same hooks violation in `BreedingCodeList` also caused ESLint `react-hooks/rules-of-hooks` errors, blocking CI since v0.0.34. Additionally corrected a `react-hooks/exhaustive-deps` warning in `LifeList` by wrapping `phaseEntries` in its own `useMemo`.

## [0.0.34] - 2026-05-20

### Added
- **County filter** — compact dropdown on Breeding Codes, Media List, and Species Detail tabs; populated from data only; highlights green when active; composes with all existing filter pills and sort controls (AND logic)
- **Date range filter** — From/To date inputs on all three tabs; supports open-ended ranges (From only, To only, or both); inputs highlight green when a value is entered; composes with county filter and code pills
- **Filter strip** — appears between toolbar and table when any location/date filter is active; shows active constraints and species/checklist count; "Clear filter" resets both county and date to default
- **Total column — Media List** — rightmost column showing Photo + Audio + Video count per species; green header and bold values; sortable (descending first); reflects active county and date filters
- **County resolution for ML export** — three-tier chain: (1) reads County column directly from ML export if present; (2) cross-references loaded eBird backup by location name; (3) calls `POST /nominatim/counties` for reverse geocoding via OpenStreetMap; county dropdown shows loading indicator during Nominatim resolution
- **Nominatim backend endpoint** — `POST /nominatim/counties` proxies reverse geocoding requests to Nominatim with in-process caching, ≤1 req/sec rate limiting, and OSM-compliant User-Agent header

### Improved
- **eBird path — Media List** — switched from `parseLifeList` (species-level, no date/county) to `parseEbirdObservations` (row-level with county, date, location, lat/lng); enables county and date filtering on the eBird backup path

## [0.0.33] - 2026-05-20

### Fixed
- **Species Detail — Top Locations links removed** — location names now render as plain text; the previous links to `ebird.org/loc/{id}` worked for public hotspots but failed for personal/private locations, which have no public-facing page on eBird

## [0.0.32] - 2026-05-15

### Added
- **Species Detail — subspecies toggle** — toolbar toggle switch collapses all subspecies variants (e.g. "Yellow-rumped Warbler (Myrtle)" + "(Audubon's)") into a single parent species entry; all statistics, media counts, breeding codes, locations, comments, and map pins aggregate across every matching subspecies; defaults to merged
- **Species Detail — spuh/slash toggle** — second toolbar toggle shows or hides uncertain identifications (sp. entries and slash species); defaults to hidden
- **Species Detail — embedded recent media** — when an ML export is loaded, the most recently uploaded Photo, Audio, and Video for the selected species are embedded inline via Macaulay Library iframes in a responsive 3-column grid; scrollbars suppressed; section appears at bottom of the detail view
- **Species Detail — top locations** — ranked list of locations where the species has been recorded most often; shows top 10 by default with expand/collapse; eBird location IDs link to ebird.org/loc/{id} (works for both public hotspots and personal locations)
- **Species Detail — sighting locations map** — interactive Leaflet/OpenStreetMap map showing one marker per unique lat/lng coordinate; map auto-fits bounds to the selected species' observations; each marker opens a popup listing dated checklist links (up to 6 + overflow count)
- **eBird CSV parser** — now reads Location ID, Latitude, and Longitude columns; latitude/longitude parsed as numbers (null when absent or non-numeric)

## [0.0.31] - 2026-05-15

### Improved
- **Species Detail — mobile layout** — Sightings and Media cards now stack vertically on portrait phone screens (≤640px) via shared `.sr-two-col` responsive CSS class; long species names no longer overflow narrow columns
- **Species Detail — sightings totals** — Sightings card now shows two distinct counts: Checklists (number of eBird entries) and Individuals (sum of numeric counts; shown as — when all counts are recorded as X)
- **Species Detail — Show all / Collapse** — toolbar button toggles the page between clipped scroll mode and full-height layout, matching the same `onExpandedChange` pattern used by the Media Life List and Life List Comparer tabs; works correctly for mobile viewing and printing
- **Species Detail — species links** — eBird and Birds of the World favicon links now appear inline with the scientific name in the summary card, matching the treatment in the Breeding Codes and Life List tabs

## [0.0.30] - 2026-05-15

### Added
- **Species Detail tab** — per-species drill-down from your eBird backup; select any species to see your full history with it
- Summary card: common name, scientific name, Photo/Audio/Video media indicators (filled when media exists in ML export), and a highest-tier breeding evidence pill (Confirmed/Probable/Possible)
- Sightings section: total observation count, first seen date, last seen date, and personal best count — all linked to their eBird checklists
- Media statistics: Photo, Audio, and Video counts linked to the Macaulay Library catalog filtered by species and media type; requires ML export loaded in Settings
- Breeding codes breakdown: every unique code recorded for the species with tier-colored dot, abbreviation, label, and count; sorted by tier then canonical order
- Comments archive: all species-level field notes from your eBird backup, sortable (newest/oldest) and filterable by keyword; first 10 shown with "Show all N" button; each date links to its checklist
- Auto-loads from stored eBird backup in Settings; shows upload drop zone as fallback when no file is stored
- Species selector is taxonomically sorted (fire-and-forget fetch); immediately usable in A–Z order while taxonomy resolves
- `parseEbirdObservations` parser: character-level CSV parser handling quoted fields with embedded newlines and commas; reads both "Species Comments" and "Observation Details" column names

## [0.0.29] - 2026-05-15

### Added
- **Dark mode** — full dark theme with automatic OS preference detection; no flash of the wrong theme on load
- Theme preference toggle in Settings → Appearance: System / Light / Dark
- Consent-gated `localStorage` persistence — theme is applied immediately when selected; a prompt asks whether to save the preference or keep it for this session only; once consent is given, future changes are silent
- Complete `--sr-*` CSS custom property token system in `globals.css` covering structural, text, border, accent, error, warning, tier, and shadow values for both themes
- Anti-flash inline script in `index.html` applies `data-theme` before first paint using stored preference or OS media query
- `src/lib/theme.ts` — `applyTheme()` and `readStoredPreference()` utilities with private-browsing-safe localStorage access
- Dark palette: zinc-based backgrounds (`#09090B` page, `#18181B` surface), `#34D399` emerald accent for better contrast on dark surfaces, lightened purple tier colours for breeding code badges

## [0.0.28] - 2026-05-15

### Fixed
- **Mobile tab bar** — tabs no longer clip off the right edge of the screen on iPhone; the tab bar now scrolls horizontally so all tabs are reachable without rotating the device
- Reduced top padding on the header and tab content panels on small screens (≤640px) to make better use of vertical space
- Reduced weather card inner padding on small screens

## [0.0.27] - 2026-05-15

### Added
- **API key settings** — new "API Keys" section on the Settings tab lets you enter, save, and manage your eBird and OpenWeather API keys directly in the UI
- Keys are written to `backend/.env` and take effect immediately — no server restart required
- Saved keys display masked by default (`••••••••••••••••`) with a Show/Hide toggle
- Inline "Add key" / "Update" edit mode with Enter-to-save and Cancel; Save button disabled until input has content
- "Clear" removes a key from `.env`, `os.environ`, and the UI
- `GET/POST/DELETE /settings/keys/{ebird|openweather}` backend endpoints backed by `python-dotenv`; unknown slots return 404, blank values return 400
- 11 new backend tests covering all key endpoints

## [0.0.26] - 2026-05-15

### Added
- **Breeding code category filters** — three new filter pills on the Breeding Codes tab: Confirmed, Probable, and Possible; each selects all codes in that eBird evidence category with one click
- Category filter logic: OR within category (any matching code qualifies the species), AND across active categories and individual code filters
- Multiple categories can be active simultaneously; "All" clears both category and individual code filters
- Category pills hidden when no codes from that category appear in the loaded data
- `BreedingCategory` type and `CATEGORY_CODES` constant added to `breedingCodes.ts`, derived programmatically from tier assignments

## [0.0.25] - 2026-05-15

### Added
- **Settings tab** — new rightmost tab for managing persistent default files; upload your eBird backup and ML export once and they load automatically every session
- eBird backup stored server-side; Breeding Codes tab auto-loads it on every page visit — no more re-uploading
- ML export stored server-side; Media List tab auto-loads it on every page visit with full taxonomic sort and species links
- Each stored file shows its original filename and upload date; a green chip in the data tab toolbar confirms when a saved default is active
- "Upload new" replaces the stored default in Settings; uploading directly within a tab is session-only and leaves the saved default untouched
- "Clear" removes a stored file from the server; the corresponding tab returns to its manual upload state on next page load
- `GET/POST/DELETE /settings/files/{ebird|ml}` backend endpoints with `.csv` validation, 50 MB size limit, and fixed server-side filenames (path traversal safe)
- `data/` directory at project root created on first upload; added to `.gitignore`
- `python-multipart` dependency added to support multipart file uploads

## [0.0.24] - 2026-05-14

### Added
- **Taxonomic sort** — A–Z / Taxonomic toggle added to the Media List and Breeding Codes tabs, matching the Life List Comparer
- Media List: both ML export and eBird CSV sources support taxonomic sort; species missing from the taxonomy fetch sort last
- Breeding Codes: A–Z is the default; switching to Taxonomic orders species by eBird taxon number, with A–Z fallback for ties
- Column-header sorts (count columns in Breeding Codes; Photo/Audio/Video in Media List) use the name sort mode as a tiebreaker, so the A–Z vs Taxonomic preference is preserved when sorting by any column
- `/taxonomy/codes` backend endpoint extended to return `orders: {commonName: taxonOrder}` alongside existing `codes` — no additional network call

### Fixed
- ML export drop zone copy updated from "Instant results — no network lookups" to "Instant results — species links and taxonomic sort load in the background" (the previous copy was inaccurate since taxonomy lookups do fire after upload)

## [0.0.23] - 2026-05-14

### Changed
- Filter pills on the Media List and Breeding Codes tabs now support multi-select with AND logic
- Media List: selecting "No photo" and "No audio" simultaneously shows only species missing both; selecting the opposite pill for the same dimension (e.g. "Has photo" while "No photo" is active) auto-replaces the conflicting selection; clicking an active pill deselects it
- Breeding Codes: multiple code pills can be active at once; the table shows only species with recorded observations for every selected code; clicking an active pill removes it from the filter
- "All" pill resets to unfiltered on both tabs; species count label reflects the AND result of all active filters

## [0.0.22] - 2026-05-14

### Changed
- Breeding Codes tab now shows species names in the same format as the Media List — common name with clickable eBird and Birds of the World favicon links, scientific name in italics below

## [0.0.21] - 2026-05-14

### Changed
- Tab order is now Weather, Breeding Codes, Media List, Life List Comparer
- "Media Life List" tab renamed to "Media List"
- README updated to match current tab order and names, and to include the Breeding Codes tool

## [0.0.20] - 2026-05-14

### Fixed
- Breeding Codes tab now correctly reads breeding codes from eBird backup files — eBird stores the full label alongside the code (e.g. "CN Carrying Nesting Material") and the parser now extracts only the code abbreviation before the map lookup

## [0.0.19] - 2026-05-14

### Fixed
- Breeding Codes tab now correctly reads breeding codes from eBird backup files that contain quoted fields with embedded newlines (e.g. multi-line observation notes entered before the breeding code column)
- Drop zone upload icon is now green, matching the rest of the app

## [0.0.18] - 2026-05-14

### Added
- **Breeding Codes tab** — upload your eBird backup (`MyEBirdData.csv`) to see a matrix of all species you've recorded breeding codes for, with columns for each of the 23 eBird breeding codes (Confirmed → Possible, left to right)
- Each cell shows a colored circle with the count of times that code was recorded for that species; colors follow eBird's four-tier system (darkest purple = confirmed, lightest = possible)
- All 23 columns are sortable by clicking the header; clicking a code column sorts by count descending, ties broken alphabetically
- Filter pills above the table let you focus on any single breeding code, hiding all other species
- A legend at the bottom of the table maps tier colors to their categories and codes
- Species with slashes, hybrids, and `sp.` categories are excluded; subspecies parentheticals are merged into the parent species entry

## [0.0.17] - 2026-05-13

### Added
- eBird and Birds of the World favicon links appear inline next to every species name in the Media Life List and all three Life List Comparer panels — clicking either icon opens that species' page on the respective site in a new tab
- Links appear automatically once taxon codes are resolved; species with no code (soundscapes, pending fetch) show no icons

### Fixed
- Macaulay Library media links now filter to your personal media — the user ID is parsed from the default ML export filename (`ML__DATE_USERID.csv`) and appended to all catalog links
- Media links now use the taxon code parameter (`taxonCode=acowoo`) instead of the species name parameter for accurate personal media filtering; requires the eBird taxonomy lookup introduced in this release
- A warning banner is shown when the ML export filename has been renamed and the user ID cannot be parsed

## [0.0.16] - 2026-05-13

### Changed
- Photo, Audio, and Video counts in the Media Life List are now clickable links — clicking a count opens the Macaulay Library catalog filtered by that species and media type in a new tab
- Column headers (Entries, Photo, Audio, Video) are now clickable sort controls; clicking a header sorts by that column, clicking again reverses direction
- Removed the "Media" (always-✓) column — redundant since every entry in the list has media
- Removed the standalone A–Z sort button — replaced by column-header sorting

## [0.0.15] - 2026-05-13

### Changed
- Photo, Audio, and Video columns in the Media Life List now show a count of individual media items per species instead of a checkmark (dash for zero)
- "Seen" column header renamed to "Media" — accurate for audio-only entries
- "Species" column header renamed to "Entries" — accurate for non-species items such as soundscapes
- Soundscape entries from Macaulay Library exports are no longer excluded — they appear in the list like any other entry

## [0.0.14] - 2026-05-12

### Added
- Media Life List now accepts a Macaulay Library export CSV as a preferred offline input — instant results, no CDN lookups (sign in to Macaulay Library → My Media → Save Spreadsheet)
- eBird backup CSV remains available as a secondary input; file type is auto-detected from the CSV header
- Three new positive filter pills: Has photo, Has audio, Has video — alongside the existing No photo / No audio / No video filters
- Soundscape entries from Macaulay Library exports are automatically excluded

## [0.0.13] - 2026-05-12

### Fixed
- Media Life List batch lookup no longer stalls or shows "Couldn't reach the Macaulay Library" mid-batch — reduced batch size (25 → 10 IDs), added a 500 ms inter-batch delay to stay under the Cornell CDN rate limit, and changed individual batch errors to be non-fatal so partial results are always shown

## [0.0.12] - 2026-05-12

### Added
- Taxonomic / A–Z sort control on the Life List Comparer tab, matching the sort control already present on the Media Life List tab

## [0.0.11] - 2026-05-12

### Fixed
- In "Show all" mode, the SnowRaven header and tab bar now scroll away naturally instead of remaining pinned at the top of the screen — improves mobile viewing and print output for the Media Life List and Life List Comparer tabs

## [0.0.10] - 2026-05-12

### Changed
- Tab order is now Weather, Media Life List, Life List Comparer
- "Life List" tab renamed to "Media Life List"
- "List Comparer" tab renamed to "Life List Comparer"

## [0.0.9] - 2026-05-12

### Fixed
- Life List species count now matches the List Comparer — subspecies parentheticals (e.g. "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)") are merged into a single species entry, consistent with how the List Comparer has always worked

## [0.0.8] - 2026-05-12

### Fixed
- Life List media lookup now works correctly — the original implementation queried the Macaulay Library search API by catalog ID, which does not support that lookup. The backend now probes the Cornell CDN directly via HEAD requests to determine each asset's media type (Photo / Audio / Video), which is reliable and fast.

## [0.0.7] - 2026-05-12

### Added
- Life List tab: upload your eBird backup CSV to generate a full life list with per-species media coverage (Photo, Audio, Video)
- Filter buttons to show only species missing a photo, audio recording, or video recording
- Taxonomic order and A–Z sort options
- "Show all / Collapse" toggle for full-page expansion (useful for printing)
- Backend proxy at `POST /ml/media-types` querying the Macaulay Library search API to determine media types for submitted catalog IDs, with batch progress indicator during lookup

## [0.0.6] - 2026-05-08

### Added
- "Edit on eBird" link appears in the results area after a successful weather lookup, linking directly to the eBird edit page for that checklist (`https://ebird.org/edit/effort?subID=…`)

## [0.0.5] - 2026-05-08

### Added
- `update.sh` script: one command to pull, rebuild, and restart the app (`./update.sh` from the repo root)
- "Check For Updates" link in the app footer: checks GitHub for a newer release on demand, showing version status inline (no passive network requests)
- `/version/check` backend endpoint: server-side GitHub API check that keeps the client IP off GitHub

## [0.0.4] - 2026-05-08

### Added
- Checklist confirmation line displayed after a successful weather lookup, showing the resolved checklist ID, location name, and observation time (e.g. `S334315671 / Berkeley Community Garden / 2026-05-07 17:26`)

## [0.0.3] - 2026-05-07

### Added
- List Comparer tab: drag-and-drop two eBird backup CSV files to see which species appear in both lists and which are unique to each
- "Show all / Collapse" toggle on comparison results to expand all three species panels to full length (useful for printing)

## [0.0.2] - 2026-05-07

### Added
- Weather output is now automatically copied to the clipboard on a successful lookup (with legacy fallback for non-HTTPS contexts)
- Footer "SnowRaven" text links to the GitHub repository
- This changelog

## [0.0.1] - 2026-05-07

### Added
- Initial release: paste an eBird checklist ID or URL to retrieve formatted weather conditions for that checklist
- Manual copy-to-clipboard button on the weather output panel
