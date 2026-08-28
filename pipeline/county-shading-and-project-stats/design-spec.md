# Design Spec — County Shading and Project Contributions

**Feature:** county-shading-and-project-stats
**Stage:** 4 — The Designer
**Mockup:** `pipeline/county-shading-and-project-stats/design.html`
**Design system:** extends `pipeline/design-system.md`. No new token is minted.

---

## Visual Direction

Quiet utility, unchanged. This is three additions to shipped screens, so the job
was fitting new controls into rooms that already have furniture, not designing a
room. Two new controls (a Counties switch, a Species/Checklists metric group)
reuse shipped components verbatim; one new section (Projects) reuses the escapee
account's exact shape, voice and live-region contract because it is the same kind
of thing: a number the app has to go and earn, reported honestly while it is
still incomplete.

The one place the design spends anything is the Projects section's single
accent-filled button. It is the only accent fill on that card, because it is the
only press that costs the user eight minutes.

---

## Screens / Views

### 1. Species Detail — Sighting Locations, Counties overlay

**Header row.** The existing row (icon tile, "Sighting Locations", the
Pins/Heatmap group pushed right by `margin-left: auto`) gains a **Counties**
switch to the right of that group. It is the shared `ToggleSwitch` in its
**boxed** variant, which is the app-wide default for a switch carrying its own
visible label: 30px box, 6px radius, 1.5px `--sr-border`, 28x16 track, 12px knob.
Off on mount, session-scoped, `role="switch"` + `aria-checked`.

The controls cluster keeps `flex-wrap: wrap`; at 320px it takes `width: 100%`
and drops to its own line beneath the title.

**Map.** Both branches carry the overlay. Turning Counties on:
- mounts `CountyLayer` (Pins branch through `SightingsMap`'s new opt-in prop;
  Heatmap branch on its own `SnowMap`),
- mutes the basemap through `BasemapDesaturation`,
- dims the pins / heat to `opacity: 0.4`,
- reveals the shading panel beneath the map.

The shipped **"Counties in view (N)"** disclosure appears at `top: 78px;
left: 10px` and comes free with the layer. It is the only keyboard route to a
county popup and must not be suppressed.

**Shading panel (new, beneath the map).** A `grid-template-rows: 0fr -> 1fr`
disclosure that grows downward from the control that opened it. Contents, in
order:
1. **Use Textures** — a `bare` `ToggleSwitch` in a label-left / switch-right row
   (`aria-label="Use textures on shaded counties"`), with the shipped hint line
   "Adds a distinct hatch density per level so counties are distinguishable
   without color."
2. **Legend** — `aria-live="polite"`, the shipped swatch/range rows.

Placing Use Textures below the map rather than in a second strip above it is
deliberate: the Heatmap Intensity strip already occupies the above-map slot, and
stacking two strips there costs a phone two rows before any map is visible.
Everything that changes how the shading paints now lives in one place, in the
Map Explorer's order (metric, textures, legend).

**Legend title** names the species: `Your {species} checklists per county`. No
metric group (per species, "distinct species" is always 1).

**Empty case:** `No recorded counties to shade. You have no US county records
for this species in the loaded backup.`

### 2. Species Detail — the county popup, one-species case

Same popup shell, same eBird region link on the county name, same state line
beneath it. Then:

- **One** `CountStat`: the value, label `checklists`, accent-active.
- A muted caption directly beneath: `reporting {species}`. This is what stops
  "123 checklists" being read as "all my checklists in Alameda", and it is the
  reason the second count can be dropped rather than kept as scaffolding.
- The shipped `CountyPopupTop` **Records-mode** rendering: heading
  `Top locations`, caption `by your {species} checklists`, three rows of
  rank / `HotspotLink` / count.

No "1 species" count anywhere.

### 3. Statistics — Geographic Stats, Counties overlay

**Header row.** `SectionCard` gains an optional trailing action slot. The
**Counties** switch lives there, right-aligned beside the "Geographic Stats"
title. This makes one rule across both surfaces: *the Counties switch lives in
its section's header row.* Every existing `SectionCard` caller passes nothing and
renders byte-identically.

**Preserved untouched:** ranked `RankIcon` pins, their popups, the share pin,
`fitToPins`, the `mapReady` idle deferral, the circle/square legend row beneath
the map, and the empty-pins suppression.

**Shading panel**, beneath the rank-pin legend row, same disclosure mechanism as
Species Detail:
1. **Shade counties by** + a `SegControl` with exactly two options, matching the
   Map Explorer in value and label: `species` / "Species", `records` /
   "Checklists". `role="group"`, `aria-label="Choropleth metric"`, `aria-pressed`
   on each option. Defaults to Species.
2. Hint: "Tints each county by your own count there, drawn only from your loaded
   backup. The numbers match the county tables below and the Map Explorer."
3. **Use Textures** + its hint.
4. Legend with the shipped `COUNTY_METRIC_META[metric].title` and the shipped
   quantile note.

No Completeness option, and no code path from this surface that could reach one.

**Popup:** the shipped two-count popup, unchanged, with the active metric's count
taking the accent.

### 4. Statistics — the Projects section

A new `SectionCard` titled **Projects**, placed immediately after "Effort &
Outings", with a matching jump-nav chip and a matching `### Projects` heading in
`docs/HELP.md`.

**Icon:** lucide `ClipboardList`. It reads as a survey you fill in, is legible at
16px, and collides with nothing else on the tab. (`Handshake` was built first and
rejected: five paths turn to mush at 16px.)

The card has two zones.

**Zone A, the state block** (always present). Structurally the shipped
`.sr-exotic` block, renamed `.sr-proj-*`:

```
[status row]  role="status" aria-live="polite", present from first render
              icon + sequence-keyed message span        [trailing action(s)]
[progress]    conditionally rendered, never `hidden`
              role="progressbar" + "N / M" readout
[note]        the supporting line: cost, floor, or scope
[skipped]     only when nonzero
```

**Zone B, the results** (present once `checked > 0` and at least one project was
found):

```
Divider
SUBLABEL  Projects you have contributed to
  row:  {label}                              {n} checklists
        {share} of the {checked} checked · {first} – {last}
Divider
SUBLABEL  How you submitted
  note:   The app or portal a checklist came in through, not a project.
          A project with its own portal appears in both places.
  row:  {label}                              {n} checklists
        {share} of the {checked} checked
```

Project rows carry **no rank numbers** and are ordered by checklist count
descending, label ascending as tie-break.

**Row geometry.** Name (`flex: 1 1 12rem; min-width: 0`) and count
(`flex: 0 0 auto`) share the first line; the meta line is `flex: 1 1 100%;
min-width: 0` so it takes its own row and can still shrink. In the phone tier the
row flips to `flex-direction: column`, and every child takes
`align-self: stretch; width: 100%; min-width: 0` (the v0.5.83 cross-axis rule).
`.sr-only` is excluded from that `> *` rule (the v1.0.4 rule).

**A project with no published name** renders its raw identifier in
`var(--font-mono)` plus one muted line: "No public eBird endpoint gives this
project a name, so its identifier is shown exactly as eBird reports it." Nothing
is invented, and no identifier is ever a link or a URL segment.

---

## The eleven display states (OQ-06, answered)

The PRD left the sentences to this stage. They are **not eleven hand-written
strings**. There is one pure tally clause plus one clause per state, so the
denominator is carried by the function rather than by discipline and a twelfth
state is one row of copy.

```
checkedClause(checked, total) =
  checked === total ? `all ${total} of your checklists`
                    : `${checked} of ${total} checklists checked`

tally(found, checked, total) =
  checked === 0 ? ''                                    // FR-49: no zero
  : found === 0 ? `No projects found across ${checkedClause}.`
  : `${found} project(s) across ${checkedClause}.`
```

`estimateMinutes(n) = max(1, round(n * ACTIVITY_START_SPACING_MS / 60000))`,
derived from the count, never hardcoded.

| # | State (`kind`) | Status sentence | Controls |
|---|---|---|---|
| 1 | `never-run` | Projects have not been checked yet. | **Check projects** (primary) |
| 2 | `running` | Checking projects: {checked} of {total} checklists.[ {found} project(s) so far.] | Stop |
| 3 | `cooldown` | eBird asked the app to slow down, so the check is waiting about {n} seconds. {checked} of {total} checklists checked, and it carries on by itself. | Stop |
| 4 | `stopped` | Stopped at {checked} of {total} checklists checked. Every answer so far is kept. | Resume |
| 5 | `partial` | {checked} of {total} checklists checked. The other {remaining} have not been asked about yet. | Check the rest |
| 6 | `complete` | {tally} Nothing is left to ask about. | Check again |
| 7 | `unanswered` | {tally} {failed} checklist(s) could not be answered and are not counted. | Try again |
| 8 | `at-capacity` | {tally} Stored answers are full at {capacity} checklists, so the rest cannot be added. | none |
| 9 | `no-key` | Projects cannot be checked without an eBird API key. + inline **Add a key in Settings** | inline link only |
| 10 | `offline` (checked > 0) | Offline, so the rest cannot be checked. {tally} Those answers are already on this device. | none |
| 10b | `offline` (checked = 0) | Offline, so projects cannot be checked yet. Nothing has been asked about. | none |
| 11 | `error` (checked > 0) | eBird could not be reached. {tally} Nothing further was asked. | Try again |
| 11b | `error` (checked = 0) | eBird could not be reached, so no checklist has been asked about yet. | Try again |

**Supporting notes**, one per state, in the `.sr-proj-rule` slot:

| State | Note |
|---|---|
| `never-run` | Your eBird backup does not record them, so each checklist has to be asked about on its own: {total} requests, about {est} minutes at the fastest pace the app allows. That is a floor, and it takes longer if eBird asks the app to slow down. Nothing is sent until you press Check projects. |
| `running` / `cooldown` | Counts below cover only the checklists checked so far, so they can only go up. |
| `stopped` | Resuming asks only about the other {remaining}, about {est} minutes. |
| `partial` | Counts below cover only those {checked}. Checking the rest takes about {est} minutes. |
| `complete` | Every checklist in this backup has been checked, so these counts are complete for it. Checking again asks eBird about all {total} a second time, about {est} minutes. A checklist keeps the project it was submitted to, so that is only worth doing if you think an answer is wrong. |
| `unanswered` | Try again asks only about those {failed}. |
| `at-capacity` | Nothing already answered is discarded to make room. The counts above stay true for the {checked} checklists behind them. |
| `no-key` | The key stays on this device. It is the same key the Map Explorer and the weather lookups already use. |
| `offline` (checked > 0) | Counts below cover only those {checked}. They will pick up where they left off when you are back online. |
| `offline` (checked = 0) | Nothing is stored yet, so there is nothing to show. County shading on the maps above still works offline. |
| `error` | Counts below cover only those {checked}. / Nothing has been stored, so no count is shown. |

**Skipped ids** (FR-47), appended only when nonzero: `{n} row(s) in this backup
carry no usable checklist id, so they are outside the {total}.`

**Mapping to the orchestrator's framing of the eleven:** *paused/stopped* is
`stopped`; *interrupted by a quit* and *re-run after a newer export* are both
`partial` (identical copy, because after a relaunch the app genuinely cannot tell
them apart, and the sentence states counts only); *resumed* is `running` reached
from `stopped` or `partial`; *the partial-tally case* is the standing floor note,
present in every incomplete state.

**Voice rules honoured:** every state says what the *number* is doing, not just
what the network is doing. No em dashes anywhere. Straight apostrophes.
"eBird" is always the actor when eBird is the actor.

---

## Component Usage

| Component | Where | Change |
|---|---|---|
| `ToggleSwitch` (boxed) | Counties, both surfaces | none |
| `ToggleSwitch` (`bare`) | Use Textures, both surfaces | none |
| `SegControl` | Statistics metric group | none |
| `SectionCard` / `SectionHead` | Projects card, Geographic Stats | **one additive change**: optional trailing `action` slot in the head row |
| `SubLabel` | "Projects you have contributed to", "How you submitted" | none |
| `Divider` | between Zone A, projects, portals | none |
| `CountyLayer` + `BasemapDesaturation` | three new mount sites | none |
| `CountyPopupTop` | per-species popup | caption text only |
| `HotspotLink` / `OutboundLink` | popup rows, county name | none |
| `RankIcon` | Geographic Stats | none |
| Lucide | `ClipboardList` (card), `Loader2`, `Check`, `AlertCircle`, `KeyRound`, `WifiOff`, `Circle` (dashed), `Clock`, `Square`, `RotateCw`, `Play` | 11-15px, stroke 2.2 |

New CSS classes, all in `globals.css`, never inline: `.sr-proj`,
`.sr-proj-statusrow`, `.sr-proj-status`, `.sr-proj-icon`, `.sr-proj-msg`,
`.sr-proj-actions`, `.sr-proj-act`, `.sr-proj-act--primary`, `.sr-proj-link`,
`.sr-proj-progress`, `.sr-proj-track`, `.sr-proj-fill`, `.sr-proj-count`,
`.sr-proj-rule`, `.sr-proj-rows`, `.sr-proj-row`, `.sr-proj-name`, `.sr-proj-n`,
`.sr-proj-meta`, `.sr-proj-unnamed`, `.sr-proj-portals`, `.sr-proj-portalrow`,
plus `.sr-countypanel*` and `.sr-countylegend*` for the shading panel and
`.sr-cardhead-action` for the header slot.

---

## Design Tokens Applied

Nothing new. Existing tokens only, both themes:

- **Ramp:** `--sr-county-1..10` (+ `-rgb` for the hatch), unchanged, still
  map-anchored and identical in both themes. `countyContrast.test.ts` untouched.
- **Accent:** `--sr-accent` on links, the switch-on track, the running spinner,
  the progress fill, the complete check, and the one primary button
  (`--sr-accent` fill with `--sr-on-accent` text: 5.7:1 light, 7.9:1 dark).
- **State palettes:** `--sr-warning` for cooldown / stopped / partial /
  unanswered / at-capacity, `--sr-error` for `error` only, `--sr-text-muted` for
  never-run / no-key / offline.
- **Surfaces / text / borders:** `--sr-surface`, `--sr-surface-subtle`,
  `--sr-border`, `--sr-border-subtle`, `--sr-border-input`, `--sr-text`,
  `--sr-text-muted`, `--sr-text-disabled` (rank digits in the popup only, which
  are decorative ordinals beside a named row).
- **Switch:** `--sr-switch-thumb`, `--sr-switch-thumb-shadow`, `--sr-gray-400`.
- **Mono:** `var(--font-mono)` for an unresolved project identifier.

The mockup declares two `--sr-mock-*` values (a Positron land tint and a water
tone) purely to stand in for basemap raster tiles. **They are not proposed
tokens and the Engineer introduces none of them.**

---

## Interaction Notes

- **Counties off is the pre-change build.** No geometry import, no
  `BasemapDesaturation`, no dimming, no new DOM. Asserted separately for the
  Species Detail Pins branch, the Species Detail Heatmap branch, and the
  Statistics map.
- **Switching Pins/Heatmap keeps the shading on and keeps the same counties
  shaded.** Two mounts, two wirings, a test for each.
- **Switching species reshades in place**: no reload, no second geometry import,
  no reset of viewport, map mode, or the Counties control.
- **The shading panel is a CSS-collapsed disclosure**, so it carries `inert`
  while closed, asserted as the literal attribute in both states. The Projects
  live region is **outside** any inert-able element.
- **The progress bar measures `checked / total`, not `done / target`.** This is a
  deliberate refinement of schema.md §D.4 and is the reason a resume never
  restarts the bar at zero: `aria-valuenow={checked}`, `aria-valuemax={total}`,
  readout `{checked} / {total}`, and the status sentence quotes the same pair. One
  pair of numbers on the whole card means the sentence, the bar and the readout
  cannot disagree, structurally rather than by discipline. A pass with failures
  correctly stops short of 100%, which is honest and is explained by the
  `unanswered` state.
- **Live region:** `role="status" aria-live="polite"`, rendered from first paint,
  never `display: none` in any state, message in a sequence-keyed child.
  Emission throttled at the source at 2,000 ms; the first definite figure, every
  `kind` change and every terminal status bypass it.
- **The cooldown seconds figure is rounded in the ticker**, never in a render
  body or memo.
- **Popup dismissal** stays the shipped single close path.
- **Nothing starts without a press.** No auto-start effect anywhere.

---

## Motion Spec

Every transition is ease-out `cubic-bezier(0.16, 1, 0.3, 1)` (the shipped curve)
or `ease-out`, all under 300ms, all with a `prefers-reduced-motion` fallback that
collapses duration to `0.01ms`. Implemented in **CSS** throughout; no motion
library is added.

| Element / interaction | Easing | Duration | Origin | Reduced motion | Implementation |
|---|---|---|---|---|---|
| County shading panel reveal (`grid-template-rows` 0fr to 1fr + opacity) | `cubic-bezier(0.16,1,0.3,1)` | 200ms | `top center` (grows from the switch that opened it) | instant open, no height animation | CSS |
| County fill appear / tier change (`fill-opacity`) | `cubic-bezier(0.16,1,0.3,1)` | 200ms | n/a | instant | CSS |
| Basemap muting (land tint swap) + county line reveal | `cubic-bezier(0.16,1,0.3,1)` | 200ms | n/a | instant | CSS (the real path is `setPaintProperty`, which is instant; the transition is the mockup's stand-in and the Engineer should not add one to the GL layer) |
| Pin / heat dimming (`opacity` 1 to 0.4) | `cubic-bezier(0.16,1,0.3,1)` | 200ms | n/a | instant | CSS |
| `ToggleSwitch` track colour + knob travel | `ease-out` | 180ms | n/a | instant | CSS (shipped) |
| `SegControl` / mode-group option change | `cubic-bezier(0.16,1,0.3,1)` | 150ms | n/a | instant | CSS |
| Status message swap (`opacity` + 3px `translateY`) | `cubic-bezier(0.16,1,0.3,1)` | 160ms | in place | instant | CSS keyframe (shipped `sr-exotic-msg-in` shape) |
| Progress fill `width` | `cubic-bezier(0.16,1,0.3,1)` | 300ms | left edge | instant | CSS (shipped) |
| Running spinner (`Loader2` rotate) | linear | 700ms loop | centre | **still rotates**: it is the only cue that a multi-minute job is alive, and it is the shipped `.spin` | CSS keyframe (shipped) |
| Action button hover (background / border / colour) | `cubic-bezier(0.16,1,0.3,1)` | 160ms | n/a | instant | CSS |
| County popup open (`opacity` + `scale(0.94)` + 4px `translateY`) | `cubic-bezier(0.16,1,0.3,1)` | 180ms | the pin: `transform-origin` follows MapLibre's chosen anchor | instant | CSS keyframe (shipped `sr-share-pop-in` shape) |
| Counties-in-view chevron rotate | `cubic-bezier(0.16,1,0.3,1)` | 150ms | centre | instant | CSS (shipped) |

**Not used, deliberately:** no pulsing indicator, no blur-in, no hover-scale on
rows, no staggered fade across the state gallery, no spring on a utility control,
no motion on mount for static content.

---

## Content Notes

- **Voice:** informative, never promotional. Plain sentences that state a fact
  and stop. Same register as `lib/exoticCopy.ts`, which is the reference file.
- **No em dash (U+2014) anywhere.** Verified: `grep -c` over `design.html`
  returns 0. En dashes are used, and only in numeric ranges ("19–31",
  "Feb 14 – Jun 28, 2026"), matching `formatDateRange` and the shipped legend.
- **Straight apostrophes** throughout.
- **Copy lives in `lib/projectsCopy.ts`**, not beside the component, for the same
  `react-refresh/only-export-components` reason `exoticCopy.ts` cites. It exports
  the tally function, the per-state clause function and the estimate helper as
  pure, total functions.
- **Label table** (`lib/projectLabels.ts`) must cover the portal codes as well as
  the project ones, or the "How you submitted" block renders raw codes for the
  two commonest values: `EBIRD` to "eBird", `EBIRD_MERLIN` to "Merlin",
  `EBIRD_ATL_CA` and `1050` to "California Breeding Bird Atlas". Everything else
  renders verbatim.
- **Legend unit agreement.** The shipped legend appends the unit to the first row
  only, which reads "1 checklists" whenever the minimum is 1 (it is, on both new
  surfaces). The new surfaces render "1 checklist". One word, and the Map
  Explorer can inherit it later.

---

## Realistic content used in the mockup

Drawn from the user's own export at
`~/Library/Application Support/com.snowraven/data/ebird-backup.csv`.

**Real and verifiable:**
- 3,252 checklists, 21,369 observations, 36 US counties.
- County geometry: the actual `assets/us-counties.json` polygons for California
  and Nevada, projected and simplified.
- Common Raven: 251 checklists across 17 US counties (Alameda 123, Contra Costa
  31, Los Angeles 26, Douglas NV 18, Riverside 11, down to 1). Quantile breaks
  computed with the shipped `computeCountyTiers` algorithm: 8 classes at
  `1 / 2–3 / 4 / 5 / 6–7 / 8–18 / 19–31 / 32+`.
- Statistics checklists metric: 10 classes,
  `1 / 2 / 3 / 4 / 5–8 / 9–15 / 16–20 / 21–45 / 46–61 / 62+`.
- Statistics species metric: 10 classes,
  `1–2 / 3 / 4 / 5–10 / 11–14 / 15–18 / 19–35 / 36–45 / 46–67 / 68+`.
- Location names and per-location counts (Pierce and Washington, Solano Hill -
  Gateview Crest, Albany Hill Park, and the rest).

**Illustrative, and labelled as such in the mockup** (the sweep has not run, so
these cannot be real yet): the atlas total of 147 checklists, the span
Feb 14 – Jun 28, 2026, the portal split (eBird 2,894 / Merlin 211 / atlas 147),
and the unknown project identifier `1103`. They are consistent with the Stage 1
sample (7 of 45 checklists `EBIRD_ATL_CA`, 3 of 45 `EBIRD_MERLIN`, all atlas
checklists dated 2026) and with the 785 checklists the export holds for 2026.

---

## Accessibility

- WCAG 2.1 AA at **320px and 200% in-app text scale, both themes**. Measured in
  headless Chrome against a true 320px viewport with the specimen clamped to a
  320px box: 18 app surfaces, 942 elements, each measured against its container's
  content box. Zero overflow at 1x and 2x, light and dark. Page `scrollWidth`
  equals `clientWidth` in every case.
- Every new switch carries `role="switch"` + `aria-checked` and an accessible
  name; the metric group carries `role="group"` + `aria-label` and `aria-pressed`
  per option. Verified: 0 controls without an accessible name.
- Phone-tier touch targets: every new button, switch and segmented option takes
  `min-height: 2.75rem` in the `<= 640` tier.
- No layout is made responsive with an inline style. `flex-shrink: 0` on the
  action cluster is paired with `max-width: 100%` (the v0.5.82 rule). The phone
  column flip fixes cross-axis width at the child with
  `align-self: stretch; width: 100%; min-width: 0`, excluding `.sr-only` from the
  `> *` rule (the v1.0.4 rule).
- The live region is never `display: none`, is present in the accessibility tree
  from first render, and its message is a sequence-keyed child.
- Colour is never the only cue: every state carries a distinct icon and says the
  same thing in words.

---

## Deliberate deviations, for `decisions.md`

1. **The doctrine's "distinctive display face" rule is not applied.** The mockup
   uses the shipped `--font-sans` stack, because `design-system.md` governs
   specifics and this mockup represents shipped screens; a second face would
   misrepresent the app. `weft-design-lint` reports clean because the shipped
   stack lives behind a `--font-sans` custom property, exactly as
   `globals.css:800` declares it. Stated rather than slipped past.
2. **The progress bar measures `checked / total`**, not schema.md §D.4's
   `done / target`. Rationale in *Interaction Notes*.
3. **`SectionCard` gains an optional trailing action slot.** Additive; existing
   callers unchanged. It buys one placement rule for the Counties switch across
   both surfaces.
4. **Use Textures sits below the map**, not in an above-map control strip.
   Rationale in *Screens / Views 1*.
5. **The per-species empty-legend note's second sentence is adapted.** The
   shipped "Add records or load a backup with county data" is wrong advice when a
   backup is loaded and the species is simply narrow.
6. **"1 checklist", not "1 checklists"**, on the new surfaces' legends.
7. **A single project still renders as a row, not a sentence**, despite the
   v1.0.3 "a ranked list that degenerates renders a sentence at one item" rule.
   That rule's trigger is rank numbers, a count column and a show-all expander,
   all of which presuppose a comparison and none of which exist here. The row
   carries four facts (label, count, share, date span) that a sentence cannot
   hold cleanly, and the section-level tally sentence above it already states the
   count in prose. Flagged for the user: if they would rather see a sentence at
   one project, it is a small change.

---

## Open questions for the user

1. **Section icon.** `ClipboardList` shipped in the mockup; `Handshake` was built
   and rejected for legibility at 16px. Easy to swap.
2. **One project, one row** (deviation 7 above).
3. **Section placement.** OQ-03's default, immediately after "Effort & Outings",
   is what the mockup assumes.
