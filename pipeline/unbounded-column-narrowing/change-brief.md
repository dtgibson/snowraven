# Change Brief — Unbounded Column Narrowing (Breeding Codes matrix)

## What is changing
Complete the v0.5.69 phone code-column narrowing so it also takes effect in the
Breeding Codes matrix's **"↔ Unbounded" (wideMode)** view. Today the ≤640px
`.sr-bc-code-col { width: 30px }` dot-width narrowing is visibly honored in
**Normal** (bounded) view but NOT in **Unbounded**, where each code column stays
full-width. This finishes the original 0.5.69 intent — "breeding codes would
work better unbounded if the columns were only as wide as each breeding code
dot" — which the shipped change addressed only in the bounded view.

## Why now
The v0.5.69 update narrowed the code columns but the effect never reached the
Unbounded view, which is the mode the user actually uses for scanning breeding
codes. The narrowing was promised for both modes and only landed in one.

**True root cause (verified, not assumed):** the matrix `<table>` uses the
default `table-layout: auto`, where a `<th>/<td>` `min-width: 30px` is a *floor*,
not an authoritative width — columns still grow to distribute the table's
content width. In **Normal** mode the table's TOTAL width is squeezed by the
scroll container (card is bounded to its flex parent with `minWidth:0`, and the
wrapper's `overflowX:auto` + `minWidth:0` clamps the table and lets it scroll),
so the columns collapse down to their 30px floor — the narrowing shows. In
**Unbounded** mode the card is `width: max-content` (BreedingCodeTable.tsx L147)
and the wrapper is `{}` (L161), so nothing caps the table's total width; `auto`
layout is then free to size each code column ABOVE the 30px floor to its natural
content, and the columns stay wide. The 30px is a floor the columns are never
forced down to. (Same code cells, same class — the difference is purely the
outer constraint. `LifeListTable`/Multimedia has an analogous wideMode
`max-content` path but is NOT affected here — see below.)

## Fix approach (stays inside the `.sr-bc-code-col` class convention)
Make the declared column widths authoritative instead of advisory by setting
`table-layout: fixed` on the matrix `<table>` (in BreedingCodeTable.tsx). Under
`fixed` layout the first-row/`<colgroup>` widths bind exactly, so the existing
`.sr-bc-code-col` widths (44px base, 30px at ≤640) become the actual column
widths in BOTH modes — the phone narrowing then holds in Unbounded with no new
inline width and no per-mode branch. The name column already carries an explicit
`NAME_COL_WIDTH`, so it is unaffected. This is a considered extension of the
existing class-based width single-sourcing (CLAUDE.md's "change phone narrowing
through `.sr-bc-code-col`, not inline width"), NOT a new inline hack.

Scope guards to verify at build time:
- Phone-tier only (≤640): Unbounded at ≤640 gets the same 30px columns; **desktop
  Unbounded stays wide** (desktop keeps the 44px base — intentionally wide). The
  possibility the user is on desktop was considered, but their Unbounded usage +
  original phone intent point squarely at the ≤640 wideMode gap.
- No regression to the sticky name column, the tier-dot cells, the column
  separators, or Normal mode. Confirm `table-layout: fixed` doesn't clip the
  0.625rem code headers at 30px (they already fit; verify live).
- Live desktop preview against real data before ship (user preference), plus the
  ≤640 tier check at 320px and 200% text scale.

## Multimedia — recommended OUT of scope (verified)
The user recalled v0.5.69 narrowing "breeding codes AND multimedia." It did not:
`LifeListTable.tsx` (Multimedia) was last touched in **v0.5.57** and had no
v0.5.69 change. Structurally it also doesn't fit the same treatment — its
columns are Photo/Audio/Video **count columns with text+icon headers** ("Photo",
"Audio", "Video"), only ~3 of them, not a many-column dot grid; there is no
`.sr-bc-code-col` equivalent and a 30px column couldn't hold the "Photo" label.
So there is no dot-width narrowing to "complete" there.

**Recommendation:** ship Breeding Codes only. One open question for the user
(Orchestrator to confirm): are you satisfied with Multimedia as-is, or do its
Unbounded columns also feel too wide and worth a separate, differently-shaped
tightening? Default to the leaner Breeding-Codes-only scope unless the user asks.

## Decisions touched
- **DECISIONS.md — "Mobile Breeding Codes matrix: dot-width columns + native
  pinch…" (v0.5.69).** This EXTENDS that decision (the same `.sr-bc-code-col`
  narrowing, now honored in wideMode too); it does not reverse it. Does not touch
  the native-pinch call or the reverted frozen-header/capped-box call.
- **CLAUDE.md conventions:** the Breeding-Codes-matrix note ("change phone
  narrowing through `.sr-bc-code-col`, not inline width") and the responsive
  "lift layout to a class; inline beats a media query" rule. `table-layout:
  fixed` on the `<table>` keeps the widths on the class and is the sanctioned way
  to make them bind — consistent with both. If review finds `fixed` layout can't
  cleanly hold, the fallback (a per-mode explicit width) would deviate and must
  be flagged; not expected.

## What done looks like
- In the Breeding Codes matrix at ≤640px, toggling "↔ Unbounded" keeps the code
  columns at ~30px dot-width (matching Normal), not full-width.
- Desktop Unbounded is unchanged (columns stay wide); Normal mode is unchanged in
  both tiers; sticky name column, tier dots, and column separators intact.
- Version bump + CHANGELOG + HELP/README/website sync per project rules; tests
  green (`npm run build`), live desktop preview reviewed before ship.

## Rough size
Small, well-contained. Frontend-only, likely a one-to-few-line change
(`table-layout: fixed` on the matrix `<table>` in `BreedingCodeTable.tsx`, plus a
possible ≤640 CSS touch-up if a header clips). No new data model, network call,
route, token, or persisted setting. Feature-check: clean IMPROVE (see summary).
