# Design Spec — Comparer Weather + Badges

**Feature:** comparer-weather-badges
**Stage:** 4 — The Designer
**Mode:** Extend, don't reinvent. SnowRaven's brand system (`brand.md`) is
established; this is an *in-app* feature inside the existing Checklist Comparer.
Every surface here matches the existing `ChecklistComparer.tsx` and Weather-tab
(`App.tsx`) visual language. **No new design patterns, no new tokens, no new
dependencies.** All color via `var(--sr-*)`; all icons from `lucide-react`.

---

## Visual Direction

Quiet utility. This feature adds *information density without visual noise* — a
compact, scannable badge row that reads like the existing `BreedingBadge` /
`MediaIcons` pills, and a weather/tide section built entirely from parts the user
already knows from the Weather tab (the monospace `<pre>` block, the
accent-bordered Copy buttons, the amber tide notice). Nothing here should feel
like a new screen; it should feel like the comparer *grew two more rows*. The
accent green marks presence and the primary Load action (an AA-safe
`--sr-accent-strong` on the small badge/Copy text, full `--sr-accent` on the Load
fill); a plain/outlined pill with a readable muted label (`--sr-text-muted`) marks
absence — conveyed by fill, not by dimmed text; amber (`--sr-warning-*`) marks the
tide-out-of-range and keys-missing notices — exactly the role each color already
plays elsewhere in the app.

---

## Screens / Views

This feature touches **one** view: the Checklist Comparer's **Checklists-mode
results state** (`ChecklistComparer.tsx`, rendered when `result` is set). It adds
two things — a badge row on each info card, and a Weather & Tide section below the
Comments table. The input form, stats bar, In-Both panel, A/B-only panels, and
Comments table are unchanged.

### A. The badge row (inside `ChecklistTag`)

**Placement.** Last child of the `ChecklistTag` inner column `<span>` (the one at
`ChecklistComparer.tsx:428`), rendered **after** the effort `metaBits` strip and
**after** the Notes disclosure — so the card reads top-to-bottom: A/B badge +
location → date · ID → effort strip → Notes disclosure → **badge row**. Results
state only (FR-01). `marginTop: 5` separates it from the strip above.

**The six badges, fixed order, always all six rendered** (so A and B align
column-for-column — FR-03/R7): `Camera` (photo) · `Mic` (audio) · `Video` (video)
· `Dna` (breeding) · `CloudSun` (weather-info) · `Waves` (tide-info). A thin
1px-wide divider (`var(--sr-border)`, `height: 13px`, `opacity: 0.7`) sits between
the third and fourth badge (media | breeding) and between the fourth and fifth
(breeding | comment-blocks) to group them: *media · breeding · comment-blocks*.

**Single shared `<Badge>` presenter** — one component, two states:

| Property | Present | Absent |
|---|---|---|
| Icon | the lucide icon, `size={12}`, `strokeWidth={2.25}` | same icon, same size |
| Icon/text color | `var(--sr-accent-strong)` | `var(--sr-text-muted)` |
| Background | `var(--sr-accent-bg)` | `transparent` |
| Border | `1px solid var(--sr-accent-border)` | `1px solid var(--sr-border)` |
| Opacity | `1` (no per-pill opacity) | `1` (no per-pill opacity) |
| `title` / `aria-label` | present copy (below) | absent copy (below) |

The badge is a pill: `display: inline-flex; align-items: center;
padding: 2px 6px; border-radius: 5px; gap: 4px; line-height: 1.4`. The icon is
always shown plus a short text label at `fontSize: 0.625rem; fontWeight: 600;
letter-spacing: 0.02em` — the label text is the *type*, not the state ("Photo",
"Audio", "Video", "Breeding", "Weather", "Tide"). State is conveyed by **icon +
fill/outline + the `title`/aria-label**, never by color alone (FR-07/NFR-04).
The whole row is `display: flex; flex-wrap: wrap; gap: 5px; align-items: center`.

> **Accessibility (WCAG AA — corrected after Stage-4 review).** Two contrast
> failures in the first draft are fixed here and must be implemented exactly:
>
> 1. **Absent badge.** The original draft dimmed the whole pill
>    (`var(--sr-text-disabled)` + `opacity: 0.55`) → **~1.5:1**, failing AA.
>    "Absent" is now conveyed by the **plain/transparent fill + a subtle
>    `var(--sr-border)` outline** — *not* by text opacity. The label/icon use
>    `var(--sr-text-muted)` (`#71717A` light → **4.6:1** on `--sr-bg`; `#A1A1AA`
>    dark → **7.8:1**). There is **no per-pill `opacity`** on either state.
> 2. **Present badge.** `var(--sr-accent)` (`#2D8653`) on `var(--sr-accent-bg)`
>    (`#E8F5EE`) is **4.03:1** for 10px/600 text — below AA. The label/icon use
>    **`var(--sr-accent-strong)`** (`#1A5C38`, **7.1:1** on `--sr-accent-bg`) in
>    light. In dark, `--sr-accent-strong` resolves to the same emerald as
>    `--sr-accent` (`#34D399`, **7.8:1** on the dark `--sr-accent-bg`), which
>    already passes.
> 3. **`--sr-accent-strong` is a NEW token the implementation must add to
>    `globals.css`** (it does not exist yet — `#1A5C38` is already used as
>    `--sr-map-target-old-text`, so the value is precedented). Add it to **both**
>    `:root` (`#1A5C38`) and `[data-theme="dark"]` (`#34D399`). It is reused by
>    the per-block / combined Copy buttons and the tide override (same
>    accent-on-accent-bg pairing — see §B2/§B5).
> 4. **State must reach screen readers.** The visible icon+word is identical for
>    present and absent, so **every badge span carries an `aria-label` with the
>    full stateful copy** (the table below), in addition to a matching `title`
>    for mouse hover. The badge label/icon contrast is the load-bearing signal,
>    so it must stay ≥4.5:1 in both themes.

> **Sizing precedent.** The badge borrows `BreedingBadge`'s pill geometry
> (`padding`, `border-radius`, `fontSize 0.625rem`, `fontWeight ~600–700`) and
> `MediaIcons`' icon sizing (`size 11–12`, `strokeWidth 2.5`). It does **not**
> introduce a larger pill than those — it sits visually one notch above the
> per-row media icons, which is correct (this is a checklist-level summary).

**`title` / aria-label copy (FR-03/04/05):**

| Badge | Icon | Present | Absent |
|---|---|---|---|
| Photo | `Camera` | "Photos reported" | "No photos reported" |
| Audio | `Mic` | "Audio reported" | "No audio reported" |
| Video | `Video` | "Video reported" | "No video reported" |
| Breeding | `Dna` | "Breeding codes reported" | "No breeding codes reported" |
| Weather | `CloudSun` | "Weather block in comment" | "No weather block in comment" |
| Tide | `Waves` | "Tide block in comment" | "No tide block in comment" |

### B. The Weather & Tide section (`WeatherTideSection`, below Comments)

**Placement.** Appended after `<CommentsTable>` in the results return
(`ChecklistComparer.tsx:338`), spanning the comparison width (`maxWidth: 880`,
matching the results container). `marginTop: 20` (same rhythm the Comments table
uses).

**Section frame.** A single card matching the existing `Panel` / `CommentsTable`
frame exactly: `border: 1px solid var(--sr-border); border-radius: 10px;
background: var(--sr-surface); overflow: hidden`. A header bar matching `Panel`'s:
`padding: 10px 14px; border-bottom: 1px solid var(--sr-border-subtle)`, with the
title **"Weather & Tide"** at `fontSize: 0.8125rem; fontWeight: 600;
color: var(--sr-text)`. To the right of the title in the header sits the **Load**
button (idle state) or nothing (once loaded — the two side panels carry the
content). Body padding `14px`.

#### B1 — Idle state (before Load)

The body shows a short one-line explainer at `fontSize: 0.8125rem;
color: var(--sr-text-muted); line-height: 1.55`:
*"Pull a fresh weather and tide reading for each checklist to compare conditions
side by side. Nothing is copied automatically."* — and the **Load** button.

**Load button** (the primary action — full accent fill, matching the comparer's
"Compare checklists" / Weather tab "Get weather" button): `height: 38;
padding: 0 16px; background: var(--sr-accent); color: var(--sr-on-accent);
border: none; border-radius: 8px; fontSize: 0.8125rem; fontWeight: 600;
display: inline-flex; align-items: center; gap: 7px; cursor: pointer`. Icon
`CloudSun size={15} strokeWidth={2.5}`. Label: **"Load weather & tide"**. When the
section is in the header (loaded), the button is omitted; while loading it shows
`Loader2 size={15} className="spin"` and the label **"Loading…"** at `opacity:
0.65; cursor: not-allowed`.

#### B2 — Loaded state (two side panels, `WeatherTidePanel`)

A two-column grid: `display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
align-items: start` — the same idiom the comparer uses for its A-only/B-only
panels (`ChecklistComparer.tsx:324`) and the global `.sr-two-col`. **The
implementation reuses `.sr-two-col`**, so the two columns stack at the existing
**≤640px** breakpoint (`globals.css:559`→`:563`) — **do not introduce a new
720px (or any other) breakpoint**. (The standalone mockup hard-codes the same
`@media (max-width: 640px)` rule only because it can't import `globals.css`.)

**Each `WeatherTidePanel`** is a sub-card: `border: 1px solid var(--sr-border);
border-radius: 8px; background: var(--sr-surface); overflow: hidden`. It has:

1. **Identity header** — mirrors `ChecklistTag`'s top two lines so the side is
   unmistakable: the same A/B square badge (`width: 22; height: 22;
   border-radius: 6; background: var(--sr-accent-bg); color: var(--sr-accent);
   fontSize: 0.75rem; fontWeight: 700`), then a column with the location name
   (`fontSize: 0.8125rem; fontWeight: 600; color: var(--sr-text)`, ellipsized)
   and `date · ID` (`fontSize: 0.6875rem; color: var(--sr-text-muted)`, the ID an
   accent-underlined eBird link, exactly as `ChecklistTag`). Header padding
   `12px 14px`, `border-bottom: 1px solid var(--sr-border-subtle)`.

2. **Body** (`padding: 14px; display: flex; flex-direction: column; gap: 14px`):
   the weather block, then the tide block, then the per-side copy row.

**The monospace weather/tide blocks** are the Weather tab's `<pre>` **verbatim**
(`App.tsx:788` / `:856`): `background: var(--sr-surface-subtle);
border: 1px solid var(--sr-border); border-radius: 8px; padding: 14px 16px`
(slightly tighter than the Weather tab's `18px 20px` because the panel is
narrower); `fontFamily: ui-monospace, "Cascadia Code", "Fira Code", Consolas,
monospace; fontSize: 0.8125rem; lineHeight: 1.7; whiteSpace: pre;
overflowX: auto; margin: 0; color: inherit`. Above each block, a small uppercase
label matching the Weather tab's "Weather output" / "Tide output" eyebrow:
`fontSize: 0.6875rem; fontWeight: 600; letter-spacing: 0.08em;
text-transform: uppercase; color: var(--sr-text-muted)`. The label and that
block's single Copy button sit on one `space-between` row (`marginBottom: 9`).

**The per-block Copy buttons** (FR-15.1) match the Weather tab's exactly: each
block's eyebrow row carries a **Copy** button at `height: 28; padding: 0 11px;
background: var(--sr-accent-bg); color: var(--sr-accent-strong);
border: 1.5px solid var(--sr-accent-border); border-radius: 6px;
fontSize: 0.75rem; fontWeight: 500; display: inline-flex; align-items: center;
gap: 5px`, with `ClipboardCopy size={12} strokeWidth={2.5}` → **"Copy"**. The idle
label uses **`var(--sr-accent-strong)`**, not `var(--sr-accent)` — the latter on
`--sr-accent-bg` is the same marginal **4.03:1** that failed on the present badge
for this small 0.75rem text (the corrected `var(--sr-accent-strong)` is 7.1:1 in
light, and resolves to the passing emerald in dark). On a
successful copy it flips for ~2s to the *pressed* style:
`background: var(--sr-accent); color: var(--sr-on-accent);
border-color: var(--sr-accent)`, `Check size={12}` → **"Copied!"** — the identical
2s confirmation the Weather tab uses. Below both blocks, when **both** weather
succeeded and tide is `ok`, a full-width **"Copy weather & tide together"** button:
`width: 100%; height: 34; background: var(--sr-accent-bg);
color: var(--sr-accent-strong); border: 1.5px solid var(--sr-accent-border);
border-radius: 8px; fontSize: 0.8125rem; fontWeight: 600; gap: 6px` (same
`--sr-accent-strong` label for AA) with the same Copy→Copied! flip, mirroring the
Weather tab's combined button. The combined-case button is the **core new element**
this feature adds — it appears whenever a side has both a weather block and a tide
block (see the mockup's Side A, whose comment holds both). **No button is shown for content that didn't load** (no
"Copy tide" when the side's tide is `unavailable`; no combined button unless both
are present). **Nothing copies on Load** — copy is press-only (FR-15.1/QA-18).

#### B3 — Per-side loading state (FR-13)

While a side is loading, that panel's **body** shows a centered row: `Loader2
size={14} className="spin"` + the text **"Loading weather & tide for Checklist A…"**
at `fontSize: 0.8125rem; color: var(--sr-text-muted)`, wrapped in
`role="status"`. The identity header is already rendered (so the side is
labeled). Padding `18px 14px`. The other side renders independently — one side may
show content while the other still spins (FR-11/FR-21).

#### B4 — Per-side weather error (FR-14)

A scoped, non-blocking error line inside that side's body, in the **weather**
slot only (tide of the same side renders separately): `display: flex;
align-items: flex-start; gap: 8px; padding: 9px 13px;
background: var(--sr-error-bg); border: 1px solid var(--sr-error-border);
border-radius: 6px; fontSize: 0.8125rem; color: var(--sr-error)`, with
`AlertCircle size={14} strokeWidth={2.5}` and the surfaced `TransportError.detail`
text (e.g. *"Checklist not found (404)."*), `role="alert"`. The other side and
this side's tide are unaffected (R4/QA-09).

#### B5 — Tide states (FR-15)

- **`ok`** → the formatted tide `<pre>` block + its Copy button (as B2).
- **`too-far` / `outside-us`** → the Weather tab's amber notice **verbatim**
  (`App.tsx:824`): `display: flex; align-items: center;
  justify-content: space-between; gap: 12px; background: var(--sr-warning-bg);
  border: 1px solid var(--sr-warning-subtle); color: var(--sr-warning);
  border-radius: 8px; padding: 13px 15px; fontSize: 0.8125rem; line-height: 1.5`,
  with `AlertCircle size={15} strokeWidth={2}` and the same sentence
  ("The nearest tide station is N miles away (Station). Tide data may not reflect
  your spot." / "Tide information is only available in the US. The nearest US
  station is Station, N miles away."), and the **one-tap override** button on the
  right: `height: 30; padding: 0 12px; background: var(--sr-accent-bg);
  color: var(--sr-accent-strong); border: 1.5px solid var(--sr-accent-border);
  border-radius: 6px; fontSize: 0.75rem; fontWeight: 600` → **"Show it anyway"**
  (too-far) / **"Show nearest US station"** (outside-us). The label uses
  `var(--sr-accent-strong)` for AA (same accent-on-accent-bg pairing as the Copy
  buttons). Override re-fetches that side with `force` only (OQ-2/FR-15).
- **`unavailable`** → a brief muted line: **"No tide reading available."**
  (`fontSize: 0.8125rem; color: var(--sr-text-muted)`, `role="status"`). This is
  the *no-station-in-range / no-prediction* case — **not** a fetch failure.
- **tide fetch error** → a brief muted line: **"Tide data unavailable right now."**
  (same muted style, **distinct copy** from `unavailable` — mirrors the Weather
  tab's tide-error wording; this is the NOAA lookup itself failing).

All five tide states (`ok`, `too-far`, `outside-us`, `unavailable`, fetch-error)
are rendered in the mockup: `ok` as the formatted block in the loaded section, and
the four non-`ok` states in the "other states" section.

Tide failure never affects that side's weather or the other side.

#### B6 — Reconciliation note (Area C, FR-16)

Shown **only** when, for that side, the fresh weather lookup **succeeded** AND the
checklist's comment was detected as containing an embedded weather block. Attached
directly under that side's weather block (above the tide block), as a muted *info*
treatment — **not** an error. Style: `display: flex; align-items: flex-start;
gap: 8px; padding: 10px 12px; background: var(--sr-accent-bg);
border: 1px solid var(--sr-accent-border); border-radius: 6px; fontSize: 0.75rem;
line-height: 1.5; color: var(--sr-text-muted)`, with an `Info size={13}
strokeWidth={2.25}` icon in `var(--sr-accent)`. Copy (verbatim from FR-18):
*"This checklist's comment already includes a weather block. OpenWeather revises
its historical data over time, so this fresh lookup may differ from what's in the
comment — SnowRaven shows what the API returns now."* No value-by-value diff
anywhere (FR-17). A tide block alone never triggers it (R10).

#### B7 — Keys-missing nudge (Area D, FR-19)

When required keys are absent, the **entire** Weather & Tide *body* (Load button +
panels) is replaced by the nudge; the section header ("Weather & Tide") still
renders, and **the badges and the whole species comparison are untouched**
(FR-08/22). The nudge mirrors the Weather tab's key notices **verbatim**
(`App.tsx:580/599`): one amber row per missing key — `display: flex;
align-items: center; justify-content: space-between; gap: 12px;
padding: 10px 14px; background: var(--sr-warning-bg);
border: 1px solid var(--sr-warning-subtle); border-radius: 8px;
fontSize: 0.8125rem; color: var(--sr-warning)` — naming the missing key:

- eBird → *"eBird API key not configured — weather & tide lookups require an eBird
  API key."*
- OpenWeather → *"OpenWeather API key not configured — weather lookups won't
  return conditions."*

Each row's right side is a **"Go to Settings →"** button: `background: none;
border: none; padding: 0; fontSize: 0.75rem; fontWeight: 600;
color: var(--sr-warning); cursor: pointer; white-space: nowrap` calling
`onGoToSettings`. If both keys are missing, both rows show (stacked, `gap: 8`).

---

## Component Usage

| Component (new) | Library parts reused |
|---|---|
| `ChecklistBadges` | one internal `<Badge>` presenter; lucide `Camera`, `Mic`, `Video`, `Dna`, `CloudSun`, `Waves` |
| `WeatherTideSection` | the `Panel`/`CommentsTable` card frame; the two-column `1fr 1fr` grid (`.sr-two-col` stacking); the accent Load button (lucide `CloudSun`, `Loader2`) |
| `WeatherTidePanel` | the `ChecklistTag` identity header (A/B square badge + loc/date/ID link); the Weather-tab `<pre>` block; the Weather-tab Copy buttons (lucide `ClipboardCopy`, `Check`); the amber tide notice + override; lucide `AlertCircle`, `Info`, `Loader2` |

No shadcn primitive is added beyond what the comparer/Weather tab already use
(everything is inline-styled `<div>`/`<span>`/`<button>`/`<pre>` with `--sr-*`
tokens, consistent with `ChecklistComparer.tsx` and `App.tsx`).

---

## Design Tokens Applied

**New token — `--sr-accent-strong`.** This feature adds one token to
`globals.css`: an AA-safe accent for small text on `--sr-accent-bg`. `:root` =
`#1A5C38` (7.1:1 on `#E8F5EE`); `[data-theme="dark"]` = `#34D399` (same as
`--sr-accent`, 7.8:1 on `#052E16` — the dark accent already passes). Used by the
present badge, all Copy buttons, and the tide override.

**Badges** — present: `--sr-accent-strong` (icon/text), `--sr-accent-bg` (fill),
`--sr-accent-border` (border). Absent: `--sr-text-muted` (icon/text — ≥4.6:1),
`transparent` fill, `--sr-border` (outline). **No per-pill `opacity`** on either
state (the old `opacity: 0.55` is removed — it dropped the absent label to
~1.5:1). Dividers: `--sr-border`.

**Section frame / panels** — `--sr-surface` (card bg), `--sr-border` (card
border), `--sr-border-subtle` (header rule / panel sub-borders), `--sr-text`
(titles), `--sr-text-muted` (eyebrows, explainer, ID).

**Load + Copy buttons** — Load (primary): `--sr-accent` fill, `--sr-on-accent`
text. Copy (idle): `--sr-accent-bg` fill, **`--sr-accent-strong`** text (not
`--sr-accent` — that's 4.03:1 on the fill, below AA), `--sr-accent-border`
border. Copy (pressed, 2s): `--sr-accent` fill, `--sr-on-accent` text,
`--sr-accent` border. The tide override button uses the same idle Copy tokens
(`--sr-accent-bg` fill / `--sr-accent-strong` text).

**Monospace blocks** — `--sr-surface-subtle` (bg), `--sr-border` (border),
`color: inherit` (text), font stack
`ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace`.

**Reconciliation note** (info) — `--sr-accent-bg` (bg), `--sr-accent-border`
(border), `--sr-text-muted` (text), `--sr-accent` (icon).

**Tide notice + keys nudge** (warning) — `--sr-warning-bg` (bg),
`--sr-warning-subtle` (border), `--sr-warning` (text + Settings button); override
button uses the accent Copy-button tokens.

**Per-side error** (weather) — `--sr-error-bg` (bg), `--sr-error-border`
(border), `--sr-error` (text + icon).

**Focus** — all interactive controls inherit the global 3px `--sr-accent` focus
ring from `globals.css:505`; inputs/links unchanged.

**Dark mode** — every token above (including the new `--sr-accent-strong`) is
defined in both `:root` and `[data-theme="dark"]` in `globals.css`, so the same
rules render correctly in dark with no per-mode branching. Specifically: accent
flips green→emerald (`#2D8653`→`#34D399`); `--sr-accent-strong` flips
`#1A5C38`→`#34D399` (the dark emerald already clears AA on the dark
`--sr-accent-bg`, so accent-strong == accent there); `--sr-accent-bg` flips
light-mint→deep-forest (`#E8F5EE`→`#052E16`); `--sr-text-muted` (the absent-badge
label) flips `#71717A`→`#A1A1AA` (4.6:1→7.8:1); warning flips
brown-on-cream→amber-on-near-black; surfaces darken (`#FFFFFF`→`#18181B`, subtle
`#F4F4F5`→`#27272A`); `--sr-on-accent` flips white→dark-green so the pressed Copy
button and Load button stay legible. Every text/background pairing clears 4.5:1
in **both** themes.

---

## Interaction Notes

- **Load is explicit and one-shot per comparison** (FR-12): the section fires
  zero `/weather` or `/tide` calls until the user presses Load; on press it
  fetches weather + tide for **both** A and B concurrently (`Promise.all`), each
  side resolving into its own independent state (FR-11). Results persist until
  "New comparison" resets the whole results tree.
- **Per-side independence (FR-21)**: one side loading, succeeding, or erroring
  never blocks or blanks the other; within a side, tide failure never affects
  weather. The section always renders the **real `1fr/1fr` grid** even when only
  one side resolved — a fully-resolved A sits normally beside a scoped-error B in
  the same grid; the failed side shows its scoped error/notice in place, the
  resolved side is untouched, and the grid is **never collapsed or blanked**. The
  mockup renders this exact partial layout.
- **Copy is press-only, no auto-copy** (FR-15.1/QA-18): Load writes nothing to the
  clipboard. Each Copy button copies its block via the `copyText()` seam; the
  combined button carries a single SnowRaven attribution. Each shows the 2s
  "Copied!" flip.
- **Tide override** re-fetches only the side whose tide was out of range, with
  `force`, and swaps that side's tide slot to its resolved `ok`/notice state.
- **Settings nudge** click → `onGoToSettings()` switches the app to the Settings
  tab.
- **a11y**: loading rows use `role="status"`, errors `role="alert"`; all buttons
  are keyboard-focusable with the global visible focus ring. Badge state is
  conveyed by icon + fill/outline + **`aria-label`** (full stateful copy, with a
  matching `title` for mouse) — never by color alone, and never by text opacity.
  Every badge label/Copy-button label clears WCAG AA (4.5:1) in both themes via
  `--sr-text-muted` (absent) and `--sr-accent-strong` (present/Copy).

---

## Content Notes

- All copy is plain, calm, and informational — matching the app's "quiet utility"
  voice. Notices borrow the Weather tab's exact wording so the two surfaces read
  identically.
- Mockup content is realistic SnowRaven data: real-feeling US coastal/inland
  hotspot names, real eBird-style checklist IDs (`S148820194`), and weather/tide
  blocks rendered in the **exact** line format the formatters emit
  (`weatherFormatter.ts` / `tideFormatter.ts`) — emoji + condition +
  `Temperature:` / `Wind:` / … and `🌊` + `Water level:` / `Tide:` / `Station:` /
  `Relative to MLLW` / NOAA credit — so the `<pre>` blocks are byte-faithful to
  what the app actually pastes.
- Side A in the mockup carries embedded **weather and tide** blocks in its comment
  (so both the Weather and Tide info badges show present on card A, the
  reconciliation note shows on A's weather block, and A demonstrates the combined
  "Copy weather & tide together" case); side B has neither block (so its Weather/
  Tide badges show absent and it gets no note), demonstrating FR-16's
  present/absent trigger.
- The badge state-matrix and the broadened card states render **all six badges in
  both present and absent** (including Video-present, Breeding-absent, and
  Photo-absent, which the first draft never showed), and the "other states"
  section renders **all five FR-15 tide states** plus the FR-21 partial-section
  layout (one resolved side beside one scoped-error side in the real grid).
</content>
</invoke>
