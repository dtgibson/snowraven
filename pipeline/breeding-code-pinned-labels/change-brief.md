# Change Brief — Breeding Code Pinned Labels

## What is changing
An opt-in "Pin code labels" toggle on the Breeding Codes tab, sitting beside the existing "↔ Unbounded" button, that keeps the code header row (NB, FL, CF, ...) visible while the species matrix scrolls. Default OFF and session-only, so the shipped natural full-height page-scrolling table is byte-identical for anyone who never turns it on.

One toggle, two mechanisms, because the two existing views differ structurally. In **Unbounded** (wideMode) the header can pin against the PAGE with no height cap at all: neither the card nor the inner wrapper sets `overflow` in that branch, and `.sr-panel` has none, so a `position: sticky; top: 0` header anchors to the viewport and the table keeps its full natural height. In **Normal** the `overflow-x: auto` wrapper IS the scrollport, so pinning there still requires the capped-height inner scroll box — the v0.5.69 limit, unchanged.

Recommending **(a) opt-in pinning** over **(b) a per-circle readout**. The user's goal is scanning a row of circles; a tap-to-reveal or hover tooltip answers one circle at a time, which is strictly worse for scanning and repeats the hover-inert-on-touch problem v0.5.56 already fixed once. The v0.5.56 legend answers "what does NB mean"; nothing today answers "which column is this circle in", and that is the actual gap.

**Files changing:** `frontend/src/components/BreedingCodeTable.tsx` + `BreedingCodeTable.test.tsx`, `frontend/src/components/BreedingCodeList.tsx` (the control + its state), `frontend/src/globals.css` (`.sr-bc-*`). **Not changing:** the breeding-code data model, `lib/breedingCodes.ts`, the tier legend contents, sort/filter behavior, the horizontal name-column freeze, native pinch magnification, any backend route, any persisted setting, any other tab.

## Why now
The user's own saved idea, pulled from their build queue, verbatim: "In the breeding code tab, give the user an option to freeze or pin the label row as the table is scrolled, so it is easy to see what breeding code each circle corresponds to."

Today the header row scrolls away with the page and a circle's meaning is purely positional, so partway down a long species list the columns become unreadable. Build 2 of a bundled Spool release.

## User-facing impact
Real, and deliberately opt-in.

- **Off (default):** nothing changes, in either view, at any width.
- **On, in Unbounded:** the header row stays pinned to the top of the viewport, the table keeps its full natural height, the page still scrolls as one. Nothing is given up.
- **On, in Normal:** the matrix becomes a capped-height inner scroll box. The species list scrolls inside that box instead of the page, fewer rows are visible at once (worst on a phone), and the tier legend sits below a fixed box rather than following the last row.

That last bullet is exactly the shape the user rejected in v0.5.69, so it must be something they choose deliberately, never something they land in. **Open call for The Designer:** whether to offer pinning in Normal view at all, or offer it only where it is free.

## Design pass
**Needed.** This changes how an existing surface looks and behaves: a new control in an already-dense filter/action row, a pinned header that needs a visible boundary against the rows scrolling beneath it, and (in Normal view) a capped scroll box whose height, legend placement, and scroll affordance all have to read clearly.

Surfaces being refined: the Breeding Codes control row and the matrix header, in both Normal and Unbounded, at 320px and 200% in-app text scale. The Designer also owns the open call above.

## Decisions touched
- **v0.5.69, "Mobile Breeding Codes matrix: dot-width columns + native pinch, NOT a custom zoom control and NOT a frozen-header data-grid" (DECISIONS 303-313) — TOUCHED, NOT REVERSED.** Its "do NOT re-introduce the capped-height frozen-header box" holds as the default and the shipped behavior. What this adds is a user-chosen mode on top. Its empirical CSS limit is respected rather than fought: in Normal view `overflow-x: auto` forces the vertical axis to auto/hidden, so page-frozen header + unbounded height + contained horizontal scroll remain mutually exclusive. The promoted CLAUDE.md line ("a NATURAL full-height, page-scrolling table at ALL widths") will need re-wording to say "by default".
- **v0.5.70, unbounded-view column narrowing (DECISIONS 286-288) — TOUCHED.** At ≤640 the Unbounded table runs `table-layout: fixed; width: max-content` inside a `width: min-content` card. A sticky `<th>` must be verified against that, and against `border-collapse: separate` (already in use, and required for sticky table headers to work).
- **v0.5.56, breeding-code meanings as visible legend text — COMPLEMENTARY, not superseded.** It answers what a code means; this answers which column a circle sits in. The legend stays.
- **v0.5.64 / v0.5.69 native-pinch (no CSS `zoom` / `transform: scale`) — UNTOUCHED.** Nothing here reintroduces a zoom control.
- **Session-only view-toggle precedent — FOLLOWED, not touched:** `wideMode` in this very component, Point Size (v0.5.53), county Use Textures (v0.5.51), the Calendar view toggle (v0.5.62).

## What done looks like
- Default off: the Breeding Codes tab renders identically to today in both views, at every width, and the existing test suite passes unchanged.
- On in Unbounded: the header row stays visible while scrolling a long species list, the table keeps its full height, and the ≤640 30px dot-width columns still hold.
- On in Normal: the header stays visible while the matrix scrolls, with a clear boundary, the name column keeps its horizontal freeze, and the legend is still reachable.
- Holds at 320px and 200% in-app text scale; the toggle meets the ~44px touch posture on the ≤640 tier; no em dashes in its copy; layout lifted to `.sr-bc-*` classes, never an inline style.
- State is session-only `useState` (matching `wideMode` right beside it), or the `storage` seam if The Designer wants it to persist. Never raw `localStorage`.
