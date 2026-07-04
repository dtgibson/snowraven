# Strategic Brief — Calendar Tab

## What We're Building
A new top-level **Calendar** tab that lays out a full year as twelve
monthly grids — like a wall calendar's twelve pages — with a number on
each day showing either the species seen that day or the checklists
reported that day (a user-controlled toggle). Each day is color-shaded
by its count relative to the year, the user can page back and forward
through every year their data covers (plus an "all years combined"
view), a colorblind crosshatch-density mode mirrors the app's existing
map textures, and clicking a day opens a popup with that day's detail
and links to its eBird checklists.

## Why Now
SnowRaven already gives birders many lenses on their own eBird data —
per-species history, maps, statistics, checklist browsing — but none of
them answer the plainly temporal question every birder asks: *when do I
bird, and how much?* A calendar is the most intuitive possible view of
effort and activity over time, and every ingredient already exists in
the app: the parsed backup (`observationsCache`), the shared
`ChecklistLink`, the county-texture crosshatch model, and the responsive
grid/layout vocabulary. This is a high-value, low-risk lens that reuses
mature infrastructure and needs no new data source, provider, or network
call.

## The User Problem
A birder can see *what* they've recorded and *where*, but has no simple
way to see the shape of their birding year — the busy migration weeks,
the quiet stretches, the days they went out versus the days they didn't.
The existing temporal stats on the Statistics tab are aggregate charts,
not a day-by-day surface they can scan, compare across years, and click
into. There's no at-a-glance "which days did I bird, and how hard?" view,
and no fast path from a specific calendar day to that day's checklists.

## Success Criteria
- A birder opens the Calendar tab and immediately sees a familiar
  twelve-month grid for a year of their data, each day carrying its count.
- Flipping the Species / Checklists toggle re-labels and re-shades every
  day, and the meaning of the switch is obvious.
- The shading makes busy and quiet days legible at a glance, and the
  colorblind crosshatch mode conveys the same information without relying
  on hue or brightness.
- The user can move to any other year their backup covers, and can
  compress all years into one combined twelve-month view.
- Clicking a day opens a popup with that day's summary and working links
  to that day's eBird checklists (via the shared `ChecklistLink`).
- It reads cleanly in both themes, on a phone (≤320px) and at 200% text
  scale, and is keyboard-operable — consistent with the app's shipped
  accessibility posture.

## Scope
- A new top-level **Calendar** tab, registered in the tab layout like
  the other tabs.
- **Twelve monthly grids** for a single year, laid out like calendar
  pages, each day cell showing a count.
- **Per-day count metric = species-seen-that-day OR checklists-that-day**,
  chosen by a user toggle (species is the default lens; both computed
  from the already-loaded backup).
- **Year navigation** — back/forward across every year for which the
  user has data (years with no data are not navigable dead ends).
- **All-years-combined view** — an option that compresses every year into
  one twelve-month grid (each calendar day aggregating that day-of-year
  across all years).
- **Relative per-day shading** — each day shaded by its count relative to
  the range in the active view, both themes, reusing the app's tiered
  shading conventions.
- **Colorblind crosshatch-density option** — a "Use Textures" mode that
  encodes the tier as crosshatch density, mirroring the existing county /
  atlas texture model (`lib/countyTextures.ts` / `lib/atlasTextures.ts`)
  so the day grid reads without depending on color.
- **Click-a-day popup** — day detail (date, species count, checklist
  count) plus links to that day's checklists through the shared
  `components/ChecklistLink.tsx` (with its `SUBMISSION_ID_RE` guard).

## Out of Scope
- Editing, adding, or annotating any eBird data — the tab is read-only.
- Week or single-day drill-down views, agenda/list layouts, or any
  granularity other than the twelve month-grids the request describes.
- Any non-eBird data source (e.g. weather/tide overlaid on the calendar,
  media, breeding codes) — the day count is species OR checklists only.
- Non-count metrics on a day (e.g. individual-bird totals, effort hours,
  distance) — v1 is exactly the two requested metrics.
- Any new network call, provider, backend route, or bundled dataset.
- Year-over-year trend charts or statistics beyond the two grid views
  (single year, all-years-combined) that were requested.
- Export, printing, or sharing of the calendar.

## Key Decisions
- **Frontend-only, offline, zero-network.** Every count is derived from
  the already-parsed eBird backup via the existing `observationsCache`;
  the tab adds no backend route, no provider, no bundled data, and no
  telemetry. Privacy posture is unchanged — this is another lens on data
  already loaded on the user's device. (Alignment with `product-brief.md`
  is clean.)
- **Species is the default metric**, with the Checklists switch as the
  alternate — species-per-day is the more birder-native "how good was
  that day" reading; both are one derivation from the same parsed rows.
- **Reuse, don't reinvent, the colorblind path.** The crosshatch-density
  option is modeled on the shipped county/atlas texture system, with a
  guard test analogous to `countyTextures.test.ts`, so the calendar's
  accessible mode is consistent with the maps' and can't drift.
- **Shading is relative to the active view.** In single-year mode the
  ramp is scaled to that year's range; in all-years-combined mode it is
  scaled to the combined range — so the shading always reads meaningfully
  for what's on screen.
- **All day → checklist links go through the shared `ChecklistLink`**, so
  the id shape-guard, accessible-name formula, and new-tab behavior are
  inherited app-wide rather than hand-rolled.
- **Register via the tab-layout seam** (`lib/tabLayout.ts`) so
  `parseLayout` auto-appends the new tab to existing saved layouts, per
  the Named Birds / Checklists precedent.
- **Session-only view state** (selected year, metric toggle, textures
  on/off) unless a later decision says otherwise — matching the county
  overlay's session-scoped controls; no new persisted settings for v1.
