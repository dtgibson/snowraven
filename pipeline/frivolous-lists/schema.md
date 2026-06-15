# Data Layer Design — Frivolous Lists

**Feature:** frivolous-lists
**Stage:** 3 — The Architect
**Path:** **Frontend Only** — no database, no migrations, no backend, no persisted state.

## Data Layer Changes
**None.** The section is computed in the browser from the eBird backup already parsed for the Statistics page. The Python backend is untouched; no new route, provider, or stored data. This file documents the **client data flow** The Engineer implements.

## What already exists (the substrate)
- `BirdingStats.tsx` holds the parsed observations and exposes, in scope: the per-species taxon-code resolver `codeFor(name)`, the backbone membership `hasEntryFor(name)`, and `onOpenSpecies` (name → Species Detail). It also owns `NAV_SECTIONS` (the jump-nav) and renders each section as `<SectionCard title icon>` (from `statsPrimitives.tsx`). New section inserts after the optional Media section (~line 1776), inside the `{computed && …}` block.
- `ObservationEntry` (`types.ts`, lines 57–81): `commonName`, `scientificName`, `date` (`YYYY-MM-DD`, sorts correctly as a string), `location`, `submissionId`, plus coords/county/etc. One row per observation.
- `normalizeSpeciesName()` (`speciesUtils.ts`) folds subspecies parentheticals to the parent; `isSpuhOrSlash()` filters `sp.`/slash; `computeLifeList()` (`birdingStats.ts`) is the backbone precedent.
- Shared UI: `<BirdName>` (commonName, scientificName?, taxonCode?, hasEntry?, onOpenSpecies?, size), `<ChecklistLink>` (guards `submissionId` via `SUBMISSION_ID_RE` `/^S\d+$/`; `label`, `compact`, `size`), `formatObsDate()` (`compareChecklists.ts` → `formatDate(…, {withTime:true})`), and `SubLabel`/`Divider` (`statsPrimitives.tsx`). The **milestone** tokens (`--sr-milestone-N-{bg,border,num,check}`) are the checkmark/badge precedent (green `#2D8653` check, theme-invariant light chips).

## New pure module — `frontend/src/lib/frivolousLists.ts` (unit-tested)

```ts
export const AVIAN_AMERICAN: string[]        // the 22 names, in given order
export const CALIFORNIA_DREAMER: string[]    // the 7 names, in given order
export const RAINBOW_COLORS = ['red','orange','yellow','green','blue','indigo','violet'] as const
export type RainbowColor = typeof RAINBOW_COLORS[number]

export interface SpeciesTick { commonName: string; recorded: boolean }
export interface RainbowEntry {
  color: RainbowColor
  bird: { commonName: string; scientificName: string; date: string; location: string; submissionId: string } | null
}
export interface NameListResult { items: SpeciesTick[]; recorded: number; total: number; complete: boolean }
export interface FrivolousListsData {
  avianAmerican: NameListResult
  californiaDreamer: NameListResult
  rainbowWarrior: { rows: RainbowEntry[]; filled: number; total: 7; complete: boolean }
}

export function computeFrivolousLists(observations: ObservationEntry[]): FrivolousListsData
```

**Algorithm (one linear pass; no `Date.now()` — dates are immutable backup values):**
1. Filter out `isSpuhOrSlash` and hybrid (` x `) names; for the rest, build `firstSeen: Map<normName, {date, location, submissionId, commonName, scientificName}>`, keeping the **earliest** `date` per normalized species (string compare). The backbone set is the map's keys.
2. **Avian American / California Dreamer:** each hardcoded name → `{ commonName, recorded: backbone.has(normalizeSpeciesName(name)) }`; `recorded`/`total`/`complete` follow.
3. **Rainbow Warrior:** for each color, among `firstSeen` entries whose `commonName` matches `/\b{color}\b/i`, pick the one with the **earliest `date`** (ties → earliest date then lowest `submissionId`, for deterministic tests). One bird may fill more than one color. No match → `bird: null`.

The seven color regexes are **module-level constants with no `/g` flag** (`.test()` on a non-global regex is stateless — sidesteps the `lastIndex` hazard in CLAUDE.md). Whole-word matching means `Red-tailed Hawk` fills red while `Reddish Egret`, `Black Redstart`, and `American Redstart` do not.

## New component — `frontend/src/components/FrivolousListsSections.tsx`
Mirrors `MediaStatsSections.tsx`. Props: `{ observations: ObservationEntry[]; codeFor: (name: string) => string | undefined; hasEntryFor: (name: string) => boolean; onOpenSpecies?: (commonName: string) => void }`; data via `useMemo(() => computeFrivolousLists(observations), [observations])`.

- **Avian American / California Dreamer:** a `SubLabel` heading + a `recorded/total` count + a completion badge (when `complete`); each row is a checkmark (milestone-green, shown only when `recorded`, with a fixed-width spacer when not) + `<BirdName commonName={name} taxonCode={codeFor(name)} hasEntry={hasEntryFor(name)} onOpenSpecies={onOpenSpecies} />`.
- **Rainbow Warrior:** seven rows in spectrum order — a color swatch (`aria-hidden`) + the color name (the accessible text) + `<BirdName>` + the first-seen date rendered through `<ChecklistLink submissionId={bird.submissionId} label={formatObsDate(bird.date)} />` + the location; an unfilled color shows a muted blank, no link. Completion badge when all seven are filled.
- **A11y (WCAG 2.1 AA):** `aria-label`s on the checkmark/badge/rows ("American Robin: recorded" / "American Robin: not yet recorded" / "red: Red-winged Blackbird, first seen Mar 3, 2019" / "indigo: none yet"); swatch decorative; contrast verified in both themes.

## Wiring — `BirdingStats.tsx`
- Add `'Frivolous Lists'` to `NAV_SECTIONS` (unconditional — needs only eBird data).
- Render `<SectionCard title="Frivolous Lists" icon={<Sparkles/>}>` as the **last** section (after the optional Media section), inside the existing `{computed && …}` block, passing the **all-time** observations (not a county/date-filtered subset — these are life-list questions), `codeFor`, `hasEntryFor`, `onOpenSpecies`.

## New tokens — `globals.css`
Seven `--sr-rainbow-{red,orange,yellow,green,blue,indigo,violet}` swatch fills, added to **both** `:root` and `[data-theme="dark"]` (decorative swatch fills; hues chosen by The Designer for legibility on both surfaces). Checkmarks/badges reuse the milestone tokens — no new ones needed there.

## Files touched (no new data files)
- **NEW** `frontend/src/lib/frivolousLists.ts` + `frontend/src/lib/frivolousLists.test.ts` (vitest, node — no jsdom docblock, no recharts `afterAll(120ms)` caveat: this feature mounts no charts).
- **NEW** `frontend/src/components/FrivolousListsSections.tsx` (+ optional jsdom component test if a render test is added).
- `frontend/src/components/BirdingStats.tsx` (nav entry, import, final `<SectionCard>`).
- `frontend/src/globals.css` (seven `--sr-rainbow-*` tokens in both theme blocks).
- Docs/version at ship (Engineer/Chronicler): `CHANGELOG.md`, `docs/HELP.md`, `README.md`, `website/index.html` (version pill + footer), and the lockstep `frontend/package.json` + `src-tauri/tauri.conf.json` bump.

## Risks & edge cases
- **Life-list source (decision):** compute from the complete observation set, independent of any active Statistics-tab filter, so "have I ever seen this?" is answered all-time. The Engineer confirms the in-scope `observations` reference isn't a UI-filtered slice; if it is, source the unfiltered set.
- **Favicons on *unseen* rows (Engineer choice):** `codeFor` only resolves codes for species in the user's data, so unseen American/California birds render as a plain name (no favicons, no link — correct, they're not recorded). Optional polish: batch-resolve codes for the 29 hardcoded names (via the existing `/taxonomy/codes` pattern) so their eBird/BOW favicons show even when unseen. Default if skipped: plain name, never a dead link — acceptable.
- **Normalized matching** means a subspecies entry (e.g. "American Robin (eastern)") still ticks "American Robin"; **legacy pre-split names** in an old export won't tick (OQ-01, accepted; re-download resolves it).
- **Determinism:** earliest-date ties broken by lowest `submissionId` so tests are stable.
- **No data loaded:** the section lives inside the Statistics data-gated `{computed && …}` block, so it only renders once the eBird backup is present.
- **No new network / no regression to existing sections:** the section only reads already-loaded data; when present it appends, changing nothing above it.
