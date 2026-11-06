# Strategic Brief: Life Lists Tab

## What We're Building
A new **Life Lists** tab, placed directly after Checklists in the tab order, that lists every species on the user's life list newest-first by the date it was first recorded, with the date, time, checklist and location of that first sighting. Two off-by-default switches (Include Escapees, Include Exotics) widen the list, and three media buttons (Photo, Audio, Video) turn it into a photo, audio or video life list, or any combination, dated to when the species first reached that combined status.

## Why Now
SnowRaven already computes a whole-history first-seen date per species (Statistics, the Frivolous Lists, Species Detail's First of Year) and already knows which species carry photo, audio or video (Multimedia), but there is no surface that shows the life list itself as a chronological record. The countability, escapee and exotic rules were settled across v0.5.87 to v0.5.89 and are shared, so this tab is a derivation over data and rules the app already holds, with no new provider and no privacy change. The roadmap's Horizon already names the lifer computation as the natural next layer; a dedicated tab is the plainest home for it.

## The User Problem
A birder with years of eBird and Macaulay data cannot answer, from their own exports, "which bird did I add most recently, and when and where?" or "when did I first photograph that species, and which species have I both photographed and recorded?" without scrolling eBird's own list or cross-referencing two exports by hand. eBird shows a life list but not the per-media life lists, and never the combined ones. SnowRaven can answer all of these from the two stored files, on the device, with the countability rules the rest of the app already applies.

## Success Criteria
- With both switches off and no media button selected, the tab lists every countable species in the loaded eBird backup, excluding species the exotic-provenance record classifies as escapee or exotic, newest first by first-sighting date; each row shows the species name, the date, the time, the checklist (linked to eBird when the submission id has the valid shape) and the location of that first sighting.
- Two species first seen on the same date order by that day's time, then by name, so the order is stable across reloads.
- Turning Include Escapees on adds the species that every consulted checklist tags Exotic: Escapee; turning Include Exotics on adds the species whose every consulted observation carries an exotic category (naturalized or provisional) without being an escapee. Each added species appears at its own first-sighting date, and turning a switch off removes exactly the species it added.
- A species whose provenance has not been resolved (no Statistics pass yet, or a partial one) is treated as native and listed; the tab says in one line that escapee and exotic status is resolved from Statistics and has not been for this export, and it never makes a network call of its own to resolve it.
- With Photo selected, a species appears only if the ML export holds at least one photo of it, and the row's date, time, checklist and location are those of its first photo (not its first sighting). Audio and Video behave the same for their formats.
- With Photo and Audio both selected, a species appears only if it has at least one photo and at least one audio recording, dated to the later of its first photo and its first audio, with that later asset's time, checklist and location. Photo, Audio and Video together narrow to species with all three, dated to the latest of the three firsts.
- Deselecting every media button returns the list to the first-sighting list; the switches and the media buttons compose (a species excluded by a switch stays excluded whatever media it has).
- Subspecies and other forms fold into their parent species, and non-countable forms (spuhs, slashes, hybrids, domestics) do not appear, by the shared `isNonCountableForm` and `normalizeSpeciesName` rules; the species count the tab shows equals the number of rows.
- The tab reads correctly at 320px wide and at 200% text scale, every color is a `var(--sr-*)` token in both themes, and the switches, buttons and checklist links are keyboard-reachable through the native primitives.
- With no eBird backup loaded the tab shows the app's standard setup guidance; with a backup but no ML export the first-sighting list works and the three media buttons explain that media dates need the Macaulay export.
- Loading, replacing or removing either data file re-derives the list (the tab follows the files epoch), and clearing data empties it.
- No third-party request, no new endpoint or host, and no request moved between components: the tab derives everything from the two stored files and the already-cached provenance record. Requests a system component makes from the app's process do not count toward this feature (none are added).

## Scope
- A new configurable tab with user-facing label **Life Lists** and a distinct internal key, registered in `TAB_LABELS` and `DEFAULT_TAB_ORDER` immediately after `checklists`, hideable and reorderable like every other tab.
- One derivation module in `lib/` (pure, tested) that computes per-species first-sighting from the eBird backup and per-species, per-format first-media from the ML export, and combines them for a given switch and media selection.
- Reuse of the shared countability fold, the escapee classification Statistics publishes (passive read, same mechanism Species Detail's Show escapees uses), and a parallel exotic classification derived from the same cached provenance tokens.
- The two switches (Include Escapees, Include Exotics), off by default, rendered with the app's existing switch control; the three media buttons (Photo, Audio, Video), each independently selectable, rendered through the native `Button` primitive.
- Row content: species name via `<BirdName>`, date, time, checklist link via `ChecklistLink` when the id matches the eBird submission-id shape, location name.
- Whether the switch and media states persist across sessions is a Planner decision; if they persist, it is through the `storage` seam.
- `docs/HELP.md` gains a Life Lists section in the same change; the Settings tab-layout UI shows the new tab automatically through the existing registry.
- A Designer pass and a live look at the built app before the deploy gate, because the tab has a visible surface.

## Out of Scope
- Any network call, including initiating the exotic-provenance resolution: that stays a Statistics action, and this tab reads the result passively.
- Changing the existing Multimedia tab (`life-list` key, `LifeList.tsx`) or its coverage view in any way.
- A "Count all forms" or "Show all forms" switch on this tab; non-countable forms are simply excluded in this version.
- Per-year, per-region, per-county or per-location life lists; this is the whole-history list only.
- Sorting or grouping other than newest-first by the computed date; a search or species filter box.
- A Calendar lifer overlay (the Horizon item stays separate and may reuse this derivation later).
- Exporting the list, sharing it, or iCloud-syncing the tab's controls.
- Per-observation escapee handling: the provenance record is per species, so a species's first-sighting date is its earliest observation regardless of that observation's own tag.
- Changes to README, website, App Store listing or privacy policy beyond a single held proposal sentence.

## Key Decisions
- **Tab placement: a sibling tab directly after Checklists, not a sub-view inside Checklists.** The user wrote "under the Checklists tab"; the app has a flat, user-orderable tab roster with a sidebar rail, so "under" is read as the next position in that order. The alternative (a segmented view inside the Checklists tab) is named here so the Designer can show the placement and the user can redirect; a saved custom tab order receives the new tab through the existing missing-tab append, so only the shipped default puts it right after Checklists.
- **Name and key.** The user-facing label is **Life Lists** (the user's words; the plural fits because the media buttons yield photo, audio and video life lists). The existing Multimedia tab already owns the internal key `life-list` and the component names `LifeList.tsx` and `LifeListTable.tsx`, so the new tab takes a distinct key (recommend `life-lists`; `first-sightings` is the alternative) and distinct component names, and the Multimedia label is untouched.
- **"Sliders" are toggle switches**, the control the app already uses in Settings, Statistics and the Calendar overlays, with labels "Include Escapees" and "Include Exotics".
- **Exotic classification from the existing provenance record.** The cache stores the raw eBird category tokens seen per species (X escapee, N naturalized, P provisional). Escapee keeps Statistics' rule (every consulted observation is X). Exotic is the parallel rule: every consulted observation carries some exotic category and the species is not an escapee. A species with any observation carrying no exotic category, or no provenance yet, is native and always listed. No offline heuristic (such as the taxonomy's domestic category) stands in.
- **Default exclusion of exotics diverges from eBird's own life-list rule**, under which naturalized and provisional exotics count, and from the Statistics headline, which follows eBird. The user asked for it explicitly; the tab's row count will therefore read lower than Statistics at both tabs' defaults, and the in-tab note names why. The alternative (Include Exotics on by default to match eBird) is noted for the user to reverse if they want parity.
- **The combined-media date is the maximum of the selected formats' first dates**, that is, the day the species first held every selected media type; the row's time, checklist and location come from that latest asset. Within a format, the first asset is the earliest by date then time.
- **First sighting is the earliest observation by date then time** over the folded species, from the eBird backup; the ML export never supplies the sighting date, only media dates.
- **Media dates come only from the ML export** and the media buttons require it; the first-sighting list does not.
- **The derivation runs on-device over the already-loaded files**, following the tabs that read the observations cache and the ML export cache; no new store, no new file, nothing registered in `clearDerived.ts` unless the Planner persists a derived document (it should not need to).
- **Published copy is held.** The build may prepare at most one proposed sentence for README, website and the App Store listing as a held patch in this pipeline folder; nothing is written to those surfaces without the user's explicit yes. In-app text and `docs/HELP.md` are written without a stop.
- **A Designer pass and a live look at the built app precede the deploy gate**, and what that look finds goes back to The Designer rather than shipping as a follow-up.
