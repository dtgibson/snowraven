# Change Brief — Calendar Views + Em-Dash Removal

Two independent Improve-lane refinements to already-shipped surfaces, bundled as one
patch. Feature-check: **both are Improve** (confirmed against the code — see each
sub-section). Neither introduces a new capability, surface, data model, or from-scratch
design.

---

## Item 1 — Calendar Compact/Large view modes

### What is changing
The Calendar tab's two existing view modes each render the wrong half of the picture,
and on mobile they render identically. Fix so:
- **Compact** shows the per-day **data/counts** but NOT the day-of-month date.
- **Large** shows the day-of-month **dates + shading** but NOT the per-day count (the
  data appears when a day is clicked → the existing `DayPopup`).
- **The two modes render distinctly on mobile too** (today they don't — see below).

### Current reality (verified in `Calendar.tsx` + `globals.css`, v0.5.63/64)
The view is one state (`viewMode: 'months' | 'overview'`, session-only, label-agnostic
values). `'months'` renders `MonthGrid` (big grids, labeled **"Compact"**); `'overview'`
renders `YearOverview` → `MiniMonth` thumbnails (labeled **"Large"**). Both show the whole
year; only cell size differs. Day-click opens the same `DayPopup` from either mode.

| | Compact (`MonthGrid`) — **desktop** | Large (`MiniMonth`) — **desktop** |
|---|---|---|
| Count/data | shown (centered number) | **NOT shown** (shading only) |
| Day-of-month date | **NOT shown** | shown (corner number, ≥152px container-query floor) |
| Shading | yes | yes |
| Day click | opens `DayPopup` | opens `DayPopup` |

So on **desktop**, the desired end state is nearly the CURRENT state — with ONE swap:
today **Compact hides the date and Large hides the count**, which is exactly what the
user wants. **The desktop behavior is already correct.** (Confirm on live preview; the
user's complaint may be phrased around the mobile bug and a mis-remembered desktop state,
but the code shows desktop already does Compact=count-no-date / Large=date-no-count.)

**Why the two modes look identical on mobile — the exact mechanism:**
1. `effectiveMode: ViewMode = isPhone ? 'months' : viewMode` (`Calendar.tsx` ~line 922)
   FORCES Compact on phones (`useIsPhone`, a `matchMedia(max-width:640px)` store).
2. The View toggle is CSS-hidden on phone: `.sr-cal-view-toggle { display:none }` in the
   ≤640 block. So the toggle can't switch anything on a phone.
3. Worse, the forced phone-Compact cell shows **BOTH** the count AND the date: the
   `.sr-cal-bigday` corner span (hidden on desktop, `display:inline` at ≤640) was added
   in v0.5.64 to restore the date on the phone's single forced view.

Net: on a phone, tapping Compact vs Large does nothing (toggle hidden, mode forced), and
the one view shown carries everything — so the two modes are indistinguishable.

### Desired end state — what changes
Make **both modes available and distinct on the phone**, each showing its designated
half:
- Stop forcing a single mode on phone: drop the `isPhone ? 'months' : viewMode` force
  (or generalize `effectiveMode` so the toggle governs on phone too).
- Un-hide the View toggle on phone: remove/adjust `.sr-cal-view-toggle { display:none }`
  in the ≤640 block.
- Remove the phone-only date-on-Compact hack so Compact stays count-only on phone: the
  `.sr-cal-bigday` corner + its ≤640 reveal (`DayCorner ... bigPhone` on the Compact
  cells; `.sr-cal-bigday`, `.sr-cal-daynum` phone bump). Compact = count, no date, at all
  widths. Large already carries the date on its mini-cells at all widths (the mini-month
  card at phone single-column width is far wider than the 152px container floor, so the
  Large date shows on phone — verified).
- Verify `Large` (`.sr-cal-year` → 1-up at ≤640) is usable on a phone: single-column
  mini-months, dates visible via the container-query floor, day-click opens the popup.

Likely-touched: `frontend/src/components/Calendar.tsx` (the `effectiveMode` phone-force,
the `DayCorner ... bigPhone` calls on `DayCellButton`), `frontend/src/globals.css` (the
≤640 `.sr-cal-view-toggle` / `.sr-cal-bigday` / `.sr-cal-daynum` rules), and
`frontend/src/components/Calendar.test.tsx` (the phone-force tests and the "phone-only
date corner" describe currently LOCK the old behavior — they must be rewritten, not just
left green). No change to `calendar.ts` derivation, the `--sr-cal-*` ramp,
`calendarContrast.test.ts`, or `calendarTextures.test.ts` (geometry/render-branch only).

### Feature-check (Item 1)
**Improve.** Refines how two ALREADY-EXISTING view modes render (which of the
already-present date / count / shading each shows) and fixes them rendering identically
on mobile. No new capability, surface, data model, or from-scratch design — the modes,
the data, the day popup all already exist. Only escalate if the build surfaces something
a user couldn't see/do before (none found in scoping).

---

## Item 2 — Remove em dashes from user-facing copy

### What is changing
Replace every em dash (—, U+2014) in **our own user-facing copy** with context-appropriate
punctuation (period / comma / colon / parentheses / restructure — NOT a blind delete;
exact wording is The Engineer's call per sentence). Cleaner product voice; Weft's own
product-copy guidance discourages em dashes.

### Scope (survey complete — counts are rough)
- **IN SCOPE (~127 occurrences):**
  - `docs/HELP.md` — **57** (whole file renders in-app via `HelpDocs`, `?raw` import).
  - `.tsx`/`.ts` **rendered strings** — **~70**: JSX text, and `label`/`title`/
    `placeholder`/`aria-label` attribute values, headings, buttons, messages, empty
    states, template literals assigned to display vars. Heaviest files: `BirdingStats.tsx`
    (~6), `Calendar.tsx` (~5, incl. day-cell aria-labels + the house-header prose + the
    SegControl tooltip), `WeatherBacklog.tsx` (~4), `ChecklistComparer.tsx` (~4),
    `SnowMap.tsx` (~3), `Settings.tsx` (~3), `MapExplorer.tsx` (~3), plus scattered
    `lib/` string builders (~14) and `App.tsx` (~2).
  - NOTE: some in-scope aria-labels sit in `Calendar.tsx` code we touch for Item 1
    (e.g. `` `${dateLabel} — ${desc.count}...` ``). The two items overlap only there;
    handle both in the same edit.
- **OUT OF SCOPE — exclude (~1,270 occurrences):** code comments/JSDoc (~893), test
  files (~419), and any non-rendered internal string. eBird/Macaulay DATA passthrough
  (bird names, place names, user comments) is not our copy — exclude. Do NOT touch
  comments or tests just because they contain "—".
- **En dashes (–, U+2013) are OUT** (user said em dashes specifically): e.g. the
  Calendar year-span `All years · 2019–2025` and the legend range `min–max`. Leave them.

### Flagged edge — weather/tide block format (RESOLVED to non-issue)
The generated weather/tide block (`lib/weatherFormatter.ts`, `lib/tideFormatter.ts`, and
`backend/formatters/weather.py|tide.py`) mirrors RainCrow and is a parity-locked OUTPUT
format, so it was flagged as a scope question with a default to EXCLUDE. Survey finding:
**the block output contains NO em dashes** — the only dash in the output is the tide-range
**en dash** (`"3.1 – 5.4 ft"`), which is out of scope anyway. So there is nothing to
exclude and nothing to change here. Default stands (exclude the block format); no user
override needed unless they also want en dashes gone (they didn't ask).

### Replacement approach (general — The Engineer decides per sentence)
Not a blind character delete. Per context: a full stop where the em dash joins two
independent clauses; a comma for a light aside; a colon before a list/definition;
parentheses for a true parenthetical; or a small restructure. Preserve meaning and the
app's voice. Watch spacing (SnowRaven em dashes are space-padded ` — `; collapse the
surrounding spaces to match the replacement).

### Feature-check (Item 2)
**Improve.** Copy polish correcting our own copy toward cleaner product voice. No new
user-facing behavior, surface, capability, data, or design judgment (canonical-voice
copy fix). `docs/HELP.md` is documentation of existing behavior, not new copy.

---

## Why now
Off-roadmap user request this run (Studio-Style Improve). Item 1 fixes a real mobile
defect (the two Calendar modes are indistinguishable on a phone because the toggle is
hidden and the mode is force-pinned). Item 2 is a voice-cleanup sweep the user asked for
across the whole app.

## User-facing impact
- **Item 1:** Calendar mobile users gain a working Compact/Large toggle with two visually
  distinct views (Compact = counts, Large = dates + shading, data-on-tap). Desktop
  behavior is unchanged (already correct). No count/data changes — layout/label placement
  and the phone render-branch only.
- **Item 2:** Punctuation-only copy changes across many surfaces + the in-app Help. No
  behavior change. Meaning preserved.

## Decisions touched
Item 1 **reverses part of the recent Calendar-view decision chain** — name these
explicitly for The Chronicler:
- **v0.5.64** (`.sr-cal-bigday` phone-Compact date restore) — **REVERSED**: the phone
  Compact cell should be count-only again (no date corner), because the phone will now
  offer the Large view for dates instead of cramming both into a forced single view.
- **v0.5.61** ("Phones force the Large [now Compact] calendar view" via `useIsPhone`) —
  **REVERSED**: phones no longer force a single view; the toggle governs at all widths.
  (The `useIsPhone` hook stays; it's used elsewhere and the pattern is CLAUDE.md-blessed —
  only the Calendar's *use* of it to force a mode is removed.)
- **v0.5.63 / v0.5.62 / v0.5.60** (which VIEW carries the date: dates on the Large
  thumbnails, big grids count-only; the "Compact"/"Large" label swap; `'months'`/
  `'overview'` label-agnostic values) — **UNTOUCHED and still binding.** The desktop
  Compact=count-no-date / Large=date-no-count split those decisions established IS the
  user's desired end state; Item 1 extends it to the phone, it does not reverse it.
- The Calendar **offline / zero-network** guarantee and the plain-text (non-`HotspotLink`)
  popup location (v0.5.63, and a CLAUDE.md convention) — **UNTOUCHED**; do not regress.

Item 2 touches no recorded decision (no DECISIONS.md entry governs em-dash punctuation).
The `.sr-input-16` / container-query / phone-boundary (640px) conventions in CLAUDE.md
constrain HOW Item 1 is done but are not reversed.

## What done looks like
- **Item 1:** On a phone (≤640, verified live at 320px + 200% text scale per CLAUDE.md),
  the Calendar View toggle is visible and switches between two DISTINCT views — Compact
  shows per-day counts with no day-of-month date; Large shows dated, shaded mini-months
  with no count; a day tap opens the same `DayPopup` from either. Desktop unchanged.
  `Calendar.test.tsx` phone/date describes rewritten to the new behavior; `tsc -b`, lint
  (incl. `react-hooks/purity`), vitest, and `npm run build` green; Calendar stays a lazy
  chunk (no maplibre/county entry-chunk regression).
- **Item 2:** No em dash (—) remains in any user-facing rendered string or in
  `docs/HELP.md`; en dashes and the weather/tide block format are untouched; comments,
  tests, and eBird/ML data passthrough are untouched; replacements read naturally in the
  app's voice. `grep -rn '—'` over rendered copy + HELP.md returns clean.
