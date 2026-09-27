# Strategic Brief -- Calendar Overlays

> **Amendment (post-design, 2026-09-26).** Amended by The Planner after the
> user approved the Stage 4 design (`decisions.md` D4-09 and D4-10). The
> Out of Scope item "per-format media marks on the cell" moves into Scope:
> the Compact-view cell becomes a tile of per-format media glyphs with
> counts and of specific breeding codes with a category circle and species
> counts, and a third persisted control chooses between every code and one
> row per category. Key Decisions gains the reason the user chose a rich
> illustration over quiet marks. Success Criteria are adjusted where they
> stated the old premise (marks beside the count, one media line per
> checklist). Everything else stands as approved.

Seed (the user's saved idea, verbatim): "Add a toggle to overlay additional
available user data in calendar mode, such as media and breeding codes glyphs."

## What We're Building

Two optional overlays on the Calendar tab's day cells: a **Media** mark on any
day where at least one of that day's observations carries a Macaulay Library
catalog number, and a **Breeding** mark on any day where at least one
observation carries an eBird breeding code, shown at the day's strongest
category (Confirmed, Probable, Possible). Each overlay has its own switch in
the Calendar controls, both default off, both remembered across launches; the
day popup gains the matching detail per checklist while an overlay is on.

## Why Now

The Calendar already answers "how busy was each day"; the birder's export
carries two more things about every day that the tab currently throws away:
whether they came home with media, and whether they recorded breeding
evidence. Both columns are already parsed into every `ObservationEntry`
(`catalogIds`, `breedingCode`), so the data is on hand at zero cost, and the
Breeding Codes and Multimedia tabs already establish the app's vocabulary for
each (tier categories and tier tokens; photo/audio/video formats). The tab has
been stable since v0.5.68 with a queue of small follow-ons; this is the first
one that adds a new kind of information to the grid rather than polishing what
is there, and it is the user's own request.

## The User Problem

A birder scanning their year on the Calendar cannot tell a day they merely
counted birds from a day they photographed or recorded one, nor a summer day
of ordinary birding from the day they confirmed a nest. Today that requires
leaving the Calendar for the Multimedia or Breeding Codes tab, which answer by
species, not by date. With the overlays on, and especially under the species
filter, the questions "when did I get media of this bird" and "when did I see
breeding evidence for it this year" read straight off the grid.

## Success Criteria

- With **Media** on, a day whose observations carry at least one ML catalog
  number shows a visible media mark on its Compact-view cell; a day with none
  shows no mark. Turning the switch off returns the grid to today's rendering
  byte for byte.
- With **Breeding** on, a day with at least one breeding-coded observation
  shows a breeding mark that reads as Confirmed, Probable or Possible without
  relying on color: the category is carried by text or shape, with the tier
  tokens as reinforcement only.
- Both overlays stay legible over every one of the five shade tiers in both
  themes, and over the crosshatch when **Use Textures** is on; the on-cell
  count stays first in the tile, in its own register, at 320px width and
  200% in-app text scale; the tile may grow in height to hold its rows, with
  no new horizontal page scroll (the existing 29px Calendar leak is not made
  worse). (Amended post-design, D4-09.)
- Under a species filter, both marks reflect only that species (forms folded
  as the filter already folds them): a filtered day marks Media only if that
  species had media that day, and Breeding only if that species carried a code.
- In **All years**, a date is marked if any year had media or breeding
  evidence on it, and the popup's existing year tags say which.
- The day popup, while an overlay is on, shows per checklist the media count
  (broken down by photo/audio/video when the ML export is loaded, otherwise a
  plain count) and every breeding code that checklist recorded with its
  label, category and species count; the header carries the day's per-format
  totals and every code. The popup always lists every code whatever the
  codes control says. With both overlays off, the popup is unchanged.
  (Amended post-design, D4-09 and D4-10.)
- The legend names each mark while its overlay is on. Screen-reader users hear
  the same information: a marked day's accessible name says "with media" and
  "breeding: Confirmed" (etc.), and now also names the metric the number
  belongs to.
- Both switches survive a relaunch on desktop and iOS (stored through the
  `storage` seam), and a missing ML export changes nothing except that the
  popup's media line shows a count rather than formats.
- The Calendar makes no third-party request, adds no endpoint or host, and
  moves no request between components (on web/Pi its preference read and write
  and the ML export read go to the user's own backend over existing routes; on
  desktop and iOS they are local file reads), and it reads no new file on the
  default path: the ML export is read only when the Media overlay is on, and a
  missing or unparseable one is "no formats", never an error state. (Corrected
  after the security review, Finding 3: the earlier "makes no network call" was
  not true on web/Pi.)
- The user has seen the built desktop app against their real data, in both
  themes and with textures on, before the deploy gate.

## Scope

- Two overlay layers, v1: **Media presence** (from the backup's
  `ML Catalog Numbers` column) and **Breeding evidence** (from the backup's
  `Breeding Code` column, classified with the existing `BREEDING_CODE_MAP`
  tiers: tier 3-4 Confirmed, tier 2 Probable, tier 1 Possible, unknown code
  treated as tier 1 exactly as `resolveApiBreedingCode` already does).
- Two independent switches in the Calendar controls (the low-emphasis settling
  row beside **Count all forms**), each default off, each persisted under one
  settings key through `storage.getSetting` / `setSetting`, validated on read
  so an unknown shape reads as both-off.
- **(Added post-design, D4-10.)** A third control in the same Overlays group,
  a two-option choice between **Every code** (default) and **By category**
  that governs how breeding rows are drawn on the cell; a third field
  (`codes: 'every' | 'category'`) on the same settings key, validated the
  same way (anything else reads as every code); dimmed with `aria-disabled`
  and inert, but still focusable, while Breeding is off. The popup and the
  accessible name always carry every code.
- **(Moved in from Out of Scope post-design, D4-09.)** Rich tiles on the
  Compact-view cell while an overlay is on: per-format media glyphs (photo,
  audio, video, with a generic frame for ids the ML export does not name, or
  for the whole count when it is not loaded) each with its count of distinct
  catalog ids; specific breeding codes, strongest first, each with a category
  circle (solid Confirmed, half Probable, open Possible) and the number of
  species carrying it, capped at three rows plus "+N"; a condensed form
  chosen by the cell's own width on narrow cells. Large view keeps quiet
  corner presence marks.
- Per-day derivation added to the same single pass as `buildDayCells` (new
  per-cell fields: media presence and count, strongest breeding tier; the
  same per checklist for the popup rows), so no second walk of the
  observations and no re-parse when a switch flips.
- Marks rendered on Compact-view cells (the twelve big month grids) at every
  width. In Large view the mark follows the same legibility rule as the
  day-of-month number: shown only where the thumbnail cell is already wide
  enough to show its date, tucked away below that floor, with the popup as the
  always-available source of the exact facts.
- Day popup: per-checklist media line and breeding badge while the respective
  overlay is on; a day-level summary line in the header ("media on 2
  checklists", "breeding evidence: Confirmed").
- Legend entries for each active overlay, derived from the same spec as the
  cell marks so the two cannot drift.
- Accessible name of a marked day extended with the overlay facts, and the
  metric noun added to every data day's accessible name (folds in the ROADMAP
  item "Name the metric in the Calendar's day accessible name"; the build
  edits that exact string and appending more nouns to a bare numeral would
  make its ambiguity worse).
- `docs/HELP.md` Calendar section updated in the same change. One proposed
  sentence for the Calendar's section of README/website, shown to the user
  for approval before it lands; nothing on those surfaces or the App Store
  listing changes without that yes.
- Tests: red-first unit coverage of the derivation (presence, strongest tier,
  species-filter and all-years behavior, missing ML export), a both-themes
  contrast guard for the marks over all five tiers and the hatch, the
  persistence round trip through the seam, and the "overlays off is byte
  identical" property on cell and popup output.

## Out of Scope

- A **first-of-year / lifer** layer. A lifer needs the whole-history first-seen
  computation with the countability and escapee-provenance rules that
  Statistics owns, and "first of year" has no single meaning in All-years
  mode. Noted for the roadmap as the natural third layer once the overlay
  frame exists.
- Any layer that needs network or a file the user has not loaded (eBird API
  data, atlas blocks, weather).
- (Removed post-design, D4-09: "per-format media marks on the cell" is now in
  Scope. The 320px concern is met by the condensed form, which the cell's own
  width selects, and by letting the tile grow in height.)
- Listing the day's **species names** in the popup, and per-species shading
  parity with the map (ROADMAP "Richer Calendar day popups / county-style
  shading parity"). The overlay detail is per checklist; the species listing is
  its own item and would pull `<BirdName>` rendering and countability display
  rules into this build.
- The **textures-mode tint underlay** defect (ROADMAP ~:41). Different cause
  (a key-order collision in `calendarTextures.ts`), and its fix changes what
  every textures user sees today, so it needs its own both-theme look. The
  Designer's look at marks over the hatch will see the underlay as it
  currently renders; that is fine, the marks must be legible either way.
- The Calendar **29px horizontal-scroll leak** at 320px/200% (ROADMAP ~:226)
  and the **scientific-name species filter** gap (~:184). Unrelated causes;
  the build must not widen the first and does not touch the second.
- Persisting the Calendar's existing session-only controls (metric, view,
  textures, Count all forms, species filter). The new switches persist because
  the seed asks for a preference, not a session toggle; whether the older
  controls should follow is a separate question for the roadmap.
- Any change to what the Breeding Codes or Multimedia tabs show, and any
  change to `PRIVACY_POLICY.md` (no new network destination, provider or
  stored data category; two boolean preferences join `settings.json`).

## Key Decisions

- **Two layers, two switches, not one master toggle.** The seed says "a
  toggle"; the two layers answer different questions and stacking both on a
  number-bearing cell is the worst legibility case, so the birder chooses each.
  The Planner may present them as one labeled "Overlays" group.
- **A rich illustration over quiet marks (user, Stage 4, D4-09 and D4-10).**
  The first mockup drew one presence mark per overlay; the user chose
  specific media and breeding-code glyphs with counts instead, because the
  overlays are off by default: busy is fine when the user turns it on. The
  cell becomes a tile that may grow in height, the codes control lets the
  birder pick every code or one row per category, and off stays byte
  identical to today. This supersedes the earlier Out of Scope reasoning
  that a three-way glyph fails the 320px bar; the condensed form answers it.
- **Media presence comes from the eBird backup, not the ML export.** Every
  backup row already carries its ML catalog numbers, so the mark works for a
  user who never loaded an ML export, and the Calendar's "only the eBird
  backup is required" contract holds. The ML export is optional enrichment
  read only while the Media overlay is on, via the existing cached
  `loadMLExport()` (which already answers `null` for a missing or bad file),
  and it contributes formats to the popup only. Reuse the
  `observationMediaFormats` join rather than a new one.
- **Breeding classification reuses the Breeding Codes tab's table.** Strongest
  category per day and per checklist from `BREEDING_CODE_MAP` tiers; no new
  code list, no re-litigating where `F` (Flyover) sits. The mark carries the
  category as text or shape and uses `--sr-tier-*` only as reinforcement.
- **Overlays follow the species filter and ignore the countability toggle and
  the escapee exclusion.** Presence is presence: a photo of "Gull sp." is still
  media and a coded hybrid row is still evidence. Under a species filter the
  marks narrow to that species; this is the headline use.
- **Compact view always; Large view only above the date's legibility floor;
  the popup is the source of truth.** Same rule the day-of-month number
  already follows, so no new container-query threshold is invented.
- **Off means unchanged.** With both switches off, cell markup, popup markup
  and accessible names are identical to today except for the folded-in metric
  noun; a test asserts it. This keeps the v0.5.58 render and NFR guarantees
  for users who never turn the feature on.
- **Derived in the one existing pass.** New fields on `DayCell` (and its
  checklist rows) computed inside `buildDayCells`, so a switch flip re-reads
  without re-walking the observations.
- **Persisted through the storage seam, one validated key, default off.**
  Never `localStorage`; hydration is a pure read; nothing is written until the
  user flips a switch; an unrecognized stored shape reads as off. Device-local
  like every other setting (iCloud syncs the two data files only).
- **UI rules carried forward:** tokens only in both themes, WCAG 2.1 AA at
  320px and 200% text scale, marks legible over solid tiers and the crosshatch,
  never color alone, controls through the `Button`/`ToggleSwitch` primitives,
  any bird name that appears (the popup does not plan one) via `<BirdName>`.
- **Live look before the deploy gate.** The user reviews the built desktop app
  against their real data (both themes, textures on and off, a species filter
  applied) before shipping; what that look finds goes back to the Designer.
- **Published copy needs the user's approval first.** `docs/HELP.md` is
  updated in this change; README/website get at most one proposed sentence,
  approved before it is written; the App Store listing is untouched unless
  the user chooses otherwise.
- **Release, noted not planned:** shipping is a patch bump across all four
  files and every platform leg (macOS, Windows, iOS/App Store), per CLAUDE.md
  and the `snowraven-release` skill.
