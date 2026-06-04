# PRD — Standardized Bird-Name Format

**Lane:** New Feature · **Date:** 2026-06-04 · Builds on strategic-brief.md

## 1. The `<BirdName>` component (new, shared)

`frontend/src/components/BirdName.tsx` — the single way to render a bird name.

```ts
interface BirdNameProps {
  commonName: string                 // may include subspecies parenthetical
  scientificName?: string            // shown only when showSci + space allow
  taxonCode?: string                 // for favicons + eBird fallback link
  hasEntry?: boolean                 // true ⇒ link common name to Species Detail
  onOpenSpecies?: (commonName: string) => void  // navigate → Species Detail
  showSci?: boolean                  // caller opts in where there's room (default false)
  size?: 'sm' | 'md'                 // favicon/text scale (default 'md')
}
```

**Render rules:**
- **Common name:**
  - If `hasEntry && onOpenSpecies` → render as an accessible inline button/link
    that calls `onOpenSpecies(commonName)` (styled as a link, `tabIndex={0}`,
    keyboard-activatable per the WKWebView convention).
  - Else (D1) → plain text (no link).
- **Favicons:** always render `<SpeciesLinks speciesCode={taxonCode} />` after
  the name (it already no-ops when `taxonCode` is undefined). On a no-entry bird
  the favicons are the only links.
- **Scientific name:** only when `showSci === true` and `scientificName` present;
  italic, muted, after the name (before or after favicons — Designer decides),
  and it must be allowed to truncate/hide on narrow widths via CSS (never force
  horizontal overflow).
- Component is purely presentational — no data fetching, no taxon resolution.

## 2. Navigation contract (click bird → Species Detail)

Mirror the existing single-use `requestedFilter` pattern.

**App.tsx:**
- New state `requestedSpecies: string | undefined`.
- `navigateToSpeciesDetail(commonName)` = `setActiveTab('species-detail')` +
  `setRequestedSpecies(commonName)`.
- Pass `onOpenSpecies={navigateToSpeciesDetail}` down to every tab that renders
  `<BirdName>`; pass `requestedSpecies` + `onRequestedSpeciesConsumed` to
  `SpeciesDetail`.

**SpeciesDetail.tsx:**
- New props `requestedSpecies?: string`, `onRequestedSpeciesConsumed?: () => void`.
- Effect: when `phase.tag==='ready'` and `requestedSpecies` set, resolve the
  target name against the current list (apply `normalizeSpeciesName` when
  `mergeSubspecies`), `selectSpecies(target)`, scroll the detail into view, then
  call `onRequestedSpeciesConsumed()` (single-use).
- If the species isn't found in the list (shouldn't happen — callers only link
  when `hasEntry`), no-op and still consume.
- If `phase` is `setup-required`/`loading-saved`, keep `requestedSpecies`
  pending until ready (don't consume); the consume happens once ready.

**"hasEntry" determination:** a caller sets `hasEntry` when the common name is
present in the user's loaded observations (the same dataset Species Detail uses).
Each tab already has its species list; for Stats lists sourced from non-backup
data (nemesis/targets), `hasEntry=false` unless the species is also in the
backbone.

## 3. Per-site acceptance criteria

### Statistics (BirdingStats.tsx) — main conversion
- **AC-S1 Most Photographed / Audio / Video:** name → Species Detail (it IS in
  the backup, hasEntry=true); the **media count** becomes the Macaulay Library
  link (the link the name used to carry); favicons after the name; sci name if
  room.
- **AC-S2 Milestones:** the milestone species name → `<BirdName>` (hasEntry=true;
  it's a lifer). Keep the checklist link on the milestone's **date/checklist**
  element, not the name.
- **AC-S3 Nemesis / Top Local Targets:** name → `<BirdName>`; **hasEntry=false**
  for birds not in the backup (plain name + favicons via nemesisTaxonMap). The
  recency dot and any date stay. (Most targets are not in the life list.)
- **AC-S4 Single-Checklist Birds & One-and-Done:** name → Species Detail
  (hasEntry=true); the existing **checklist link moves to the count/date**.
- **AC-S5 Biggest single-species counts:** name → `<BirdName>` (count already a
  link — keep it); add favicons + sci if room.
- **AC-S6 First species (and any other plain-text species mentions):** wrap in
  `<BirdName>`.

### Map Explorer (MapExplorer.tsx)
- **AC-M1 Target popups (single + multi-species):** each species name →
  `<BirdName>` (hasEntry per backbone; targets usually false → plain + favicons).
- **AC-M2 Nearest-targets sidebar:** name → Species Detail (when hasEntry); the
  **map-pan** moves to a distinct element (distance label or a locate icon) per
  D2. Favicons after the name.
- **AC-M3 Excluded:** the species **filter dropdown** (`<select>`) and manual
  target **checkboxes** — unchanged (form controls).

### Already compliant — audit + align to `<BirdName>`
- **AC-A1 Media List, Breeding Codes, Life List Comparer panels, Species Detail
  (Reported With, Top Locations):** currently use `SpeciesLinks` ad hoc. Refactor
  to `<BirdName>` so the format (incl. the new common-name→Species Detail link
  and consistent sci-name handling) is uniform. Behavior must not regress.
  - Note: in Species Detail's own "Reported With" / "Top Locations", clicking a
    name navigates to that other species' detail (same-tab re-selection via
    `onOpenSpecies`), which is in-tab and fine.

### Unchanged
- **AC-U1 Species Detail entry header:** stays as-is (heading + badges/buttons).

## 4. Scientific-name "where there's room" policy
- **Show** in: Breeding Codes (already), Media List (already), Statistics lists
  with a wide row, Species Detail sections, List Comparer panels.
- **Omit** in: compact pills (milestones), map popups (narrow), dense inline
  contexts, mobile-narrow.
- Implemented as the caller passing `showSci` per site; never causes overflow.

## 5. Non-functional
- No backend changes. No new dependencies. Taxon codes use existing
  `/taxonomy/codes` batched per tab; extend code maps only where a site lacks
  one (Architect to enumerate).
- A11y: name link keyboard-focusable (`tabIndex={0}`), favicons already are;
  `aria-label` on icon links is present in SpeciesLinks.
- Theming: tokens only.
- Tests: unit-test `<BirdName>` (link vs plain by hasEntry; favicons present;
  sci shown only when asked). Existing 266 tests stay green.

## 6. Acceptance (feature-level)
Every user-facing bird name outside form controls and the Species Detail header
renders via `<BirdName>`: common name → Species Detail when an entry exists,
eBird/BoW favicons always, scientific name where space allows, and any
pre-existing link relocated to the associated number/element. Clicking a name
navigates to and selects that species on Species Detail.

## 7. Out of scope
Backend; the Species Detail header; filter inputs; changing which species each
tab lists; vector-map or unrelated work.
