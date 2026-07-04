# decisions.md — Calendar Tab

- **Feature:** calendar-tab
- **Purpose:** Log the deliberate design decisions for the Calendar tab — the
  three additive requirements approved at the design stage, the Studio-Style
  auto-advance context under which they were approved, and the load-bearing
  decisions carried forward from the Architect (the `--sr-cal` ramp and the
  lexical-date discipline). Anything logged here overrides nothing in
  `CLAUDE.md`; it records *why* a choice was made so a later builder or reviewer
  does not re-litigate it.

---

## Process context — Studio-Style auto-advance

The design stage ran **Studio-Style (auto-advance)**: the Designer produced the
visual mockup (`design.html`) and design spec, and rather than pausing for a
manual approval gate between stages, the pipeline auto-advanced the approved
design forward. Three enhancements surfaced and were **approved during that
design stage** — they are additive to the PRD/schema that preceded them, so this
closeout pass **folds them back into the written record** (prd.md FR-44/FR-45/
FR-46 + QA-48/QA-49/QA-50; schema.md the `includeNonCountable` threading, the
`ViewDensity` state, the `YearOverview`/`MiniMonth` subcomponents, and the
simplified thumbnail crosshatch) so the record is coherent for the Engineer and
the Tester's QA covers them. No source code was touched in this closeout — it is
a documentation-only reconciliation of the spec to the approved design.

---

## The three design-stage additions

### 1. View-density toggle (Months | Year) + Year Overview — FR-44

- **What:** A second `SegControl` (**Months | Year**, `aria-pressed`,
  `ariaLabel="View density"`) on the primary controls row. **Months is the
  default** (the twelve big month grids). **Year** renders a **Year Overview** —
  all twelve months as small heatmap thumbnails in a **3×4 grid** (reflowing
  3 → 2 at ≤1024px → 1 at phone), day numbers dropped (shading/texture is the
  entire signal), the three cell states preserved but number-free, texture mode
  honored with a **simplified single-direction (45°) hatch** for the tiny cell,
  and click-a-thumbnail → back to Months scrolled to that month.
- **Why (one line):** A year-at-a-glance density answers "what's the *shape* of my
  whole birding year" in one screen — the wall-calendar back-page view — at zero
  data cost (it re-renders the same `DayCellMap`/`tiers`, a pure layout choice, no
  re-derivation), and it stays orthogonal to the metric/year/textures selections.

### 2. Include-non-countable-forms toggle ("Count spuh, slash & hybrids") — FR-45

- **What:** A small `ToggleSwitch` (default **OFF**, session-only) on its own
  low-emphasis settling row at the bottom of the control strip. OFF = the base
  FR-10 behavior (Species excludes spuh/slash/hybrid via `isNonCountableSpecies`).
  ON = each distinct non-countable name counts in the **Species metric only**,
  which re-tiers/re-shades the Species grid, converts present-but-zero "0" days
  into real numbered/tiered days, and updates the legend endpoints + the day
  popup's species count (labeled "species (incl. forms)"). The **Checklists
  metric is never affected**; under the Checklists metric the row is dimmed +
  inert. `buildDayCells` keeps **both** a countable and an all-forms species set
  per day; the flag is threaded through `metricCount`/`nonZeroMetricCounts` so the
  toggle re-reads **without re-parsing** (NFR-01 preserved).
- **Why (one line):** Some birders want their "species seen that day" to include
  the spuh/slash/hybrid records they logged; making it an explicit, default-OFF,
  Species-only refinement gives that option without disturbing the canonical
  life-list default or the checklist (effort) count.

### 3. Header layout — primary row + settling row — FR-46

- **What:** The four **primary controls** (Species | Checklists, year navigator +
  All years, Months | Year density, Use Textures) sit on **one clean row that
  wraps gracefully** at every width (single-line at 1280px/1024px, stacking on a
  phone); the FR-45 spuh toggle sits on its **own settling row beneath**.
- **Why (one line):** Keeping the low-emphasis, Species-only refinement off the
  primary row means the primary controls stay a stable, clean line and never get
  reflowed or pushed around by the secondary toggle.

---

## Decisions carried forward from the Architect (locked)

### The `--sr-cal-1..5` day-shade ramp (schema.md §1) — LOCKED

- **Decision:** A **new, purpose-built** calendar ramp `--sr-cal-1..5` (+ `-rgb`
  triplets) with a single **white** on-cell number `--sr-cal-fg = #FFFFFF`, **5
  classes**, **theme-identical** deep-green fills (`#357E56 → #0C271A`), added to
  **both** `:root` and `[data-theme="dark"]` in `globals.css`.
- **Why not reuse `--sr-county-1..10`:** proven impossible to make AA-safe for a
  **number-bearing** cell — county tier 7 (`#358758`, L≈0.188) is a dead zone
  where neither a light nor a dark number clears 4.5:1 (best 4.28:1, pure white
  only 4.41:1), and no 10-class single-hue ramp can satisfy BOTH the 4.5:1
  on-number rule AND the 1.2:1 adjacency floor at once. The 5-class deep ramp
  clears both with margin (min on-number **4.92:1** at tier 1, min adjacency
  **1.313:1**), identical in light and dark so there is no crossover fragility.
  This is the 0.5.44 milestone-badge lesson applied cleanly (deep tiles + one
  re-tuned on-tile text color, guarded at the token).
- **Guard:** `calendarContrast.test.ts` (parse-the-tokens) asserts, in **both**
  themes, the ramp monotonicity, ≥1.2:1 adjacency, and — the assertion
  `countyContrast.test.ts` omits — the `--sr-cal-fg` number ≥ **4.5:1** against
  **every** tier fill. Any future ramp edit that breaks AA fails the suite, not
  the user's eyes.
- **Class count = 5** is a locked consequence of the AA + adjacency math (OQ-05
  permitted reducing below the county's 10; here it is *required* for a
  number-bearing cell). The reused pure `computeCountyTiers` is called with
  `maxClasses = 5`.

### Lexical / component-based date handling — LOCKED (QA-08)

- **Decision:** ALL date handling in `calendar.ts` is **lexical / arithmetic** —
  slice `YYYY-MM-DD` into components, an arithmetic `daysInMonth` leap rule, a
  Sakamoto/Zeller `dayOfWeek`, and an explicit **ASCII** shape guard
  `/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/` + `isValidCalendarDay`. **Never `new Date(str)`.**
- **Why:** `new Date(dateStr)` timezone-shifts the day (a checklist logged on
  `2026-03-14` must land on March 14 regardless of the viewing device's timezone,
  verified at the UTC+14 / UTC−12 extremes, QA-08). The parser stores `.date`
  verbatim and unvalidated, so the Calendar module owns validation (FR-08/FR-12);
  a malformed row is dropped per-row and never rolled onto a neighbor. The
  explicit ASCII digit class (not `\d`) mirrors the 0.5.54 discipline and matches
  the QA-12 non-ASCII-digit fixture, even though there is no Python twin here.

### Other carried decisions (unchanged)

- **`computeCountyTiers` imported as-is** from `lib/countyShading.ts` (not lifted
  to a neutral module) — it is pure and domain-agnostic; lifting is churn for zero
  behavior change (schema.md §2b).
- **DOM crosshatch = `repeating-linear-gradient`**, NOT the MapLibre
  sprite/`ImageData`/`addImage`/MutationObserver path — the calendar reuses ONLY
  the pure monotonic density *shape* from `countyTextures.ts` (re-tuned as
  `CAL_HATCH`), never its map machinery (schema.md §3, No-reuse ledger). The FR-44
  thumbnail hatch (`CAL_MINI_HATCH`, simplified single-direction) is sourced from
  the same table so both curves are covered by the one monotonic guard.
- **Session-only state** for all five controls (view, metric, textures, density,
  includeForms) — plain `useState`, no storage seam, matching the county overlay's
  session-scoped controls (FR-34).
- **Frontend-only, zero-network** — no backend route, provider, bundled dataset,
  or telemetry; `PRIVACY_POLICY.md` needs no change; the tab is `React.lazy`-loaded
  and statically imports no map/maplibre module (FR-43/NFR-08).
