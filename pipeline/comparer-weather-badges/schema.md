# schema.md — Comparer Weather + Badges (Technical / Component Design)

**Feature:** comparer-weather-badges
**Stage:** 3 — The Architect
**Path:** Frontend-only — no database, no schema, no migration, no backend edits.
**Source of truth:** `pipeline/comparer-weather-badges/prd.md` (22 FRs).

> **Data-layer statement (frontend-only).** This feature stores nothing and
> changes no persisted shape. It reuses three existing HTTP contracts
> (`/checklists/{id}`, `/weather/{id}`, `/tide/{id}`) and existing client types
> verbatim. **NFR-02 confirmed: no file under `backend/` is touched.** What
> follows is the *component* design — the real symbols, props, types, and reducers
> the Engineer (Stage 5) builds against.

---

## 0. Locked decisions (resolved here)

| OQ / decision | Resolution |
|---|---|
| **OQ-1 — nudge gating** | **Gate up front on `keyStatus`** (the PRD default). Recommendation + rationale in §6. |
| **OQ-2 — tide override** | Included per-side; logic **extracted to a shared helper** (`lib/tideNotice.ts`) — see §7. |
| **OQ-3 — copy buttons** | Three per side, via `copyText()`, **no auto-copy on Load** — see §5. |
| **OQ-4 — comment-badge icons** | `CloudSun` (weather-info) + `Waves` (tide-info). Both confirmed present in installed `lucide-react`. |
| Reconciliation-note wording | Use the PRD's suggested copy verbatim (§ FR-18) — see §4.4. |

Confirmed available in the installed `lucide-react`: `CloudSun`, `Waves`, `Dna`,
`ClipboardCopy`, `Check`, `AlertCircle`, `Camera`, `Mic`, `Video`, `Loader2`.

---

## 1. Where this lands — files at a glance

### New files (frontend only)

| File | Purpose | Tested? |
|---|---|---|
| `frontend/src/lib/commentBlocks.ts` | Pure `hasWeatherBlock` / `hasTideBlock` detectors (FR-06). | ✅ vitest |
| `frontend/src/lib/commentBlocks.test.ts` | Detection matrix (QA-17). | — |
| `frontend/src/lib/checklistBadges.ts` | Pure presence reducers over `species[]` (FR-02/04). | ✅ vitest |
| `frontend/src/lib/checklistBadges.test.ts` | Reducer matrix (NFR-07). | — |
| `frontend/src/lib/tideNotice.ts` | Shared tide-notice copy + override extraction (OQ-2, FR-15). | ✅ vitest (copy strings) |
| `frontend/src/components/ChecklistBadges.tsx` | The per-card badge row (FR-01–08). | — |
| `frontend/src/components/WeatherTideSection.tsx` | Bottom section: owns both sides' load/state, renders two `WeatherTidePanel`s or the nudge (FR-09–22). | — |
| `frontend/src/components/WeatherTidePanel.tsx` | One side's weather + tide + copy + reconciliation note (FR-13–18). | — |

> **Why split `WeatherTideSection` (owner) from `WeatherTidePanel` (per-side
> view):** FR-11 requires the two sides to be *independent* (one failure never
> blanks the other) but loaded by *one* action (FR-12). The section owns the two
> independent state objects and the single Load action; each panel is a near-pure
> view of one side's state. This mirrors how App.tsx keeps `state` (weather) and
> `tideState` (tide) as separate objects fired by one `handleLookup`.

### Edited files (frontend only)

| File | Change | FR |
|---|---|---|
| `frontend/src/components/ChecklistComparer.tsx` | Accept two new props; render `<ChecklistBadges>` inside `ChecklistTag`; render `<WeatherTideSection>` after `<CommentsTable>`; thread `idA`/`idB`/`metaA`/`metaB` in. | FR-01, FR-09, FR-20 |
| `frontend/src/components/ListComparer.tsx` | Accept `keyStatus` + `onGoToSettings`; pass both to `<ChecklistComparer>`. | FR-20 |
| `frontend/src/App.tsx` | Pass `keyStatus` + `onGoToSettings={() => setActiveTab('settings')}` into `<ListComparer>` at line 889. | FR-20 |

**No other files change. Nothing under `backend/` is touched (NFR-02).**

---

## 2. Component breakdown & prop wiring

### 2.1 Prop path: App → ListComparer → ChecklistComparer (FR-20)

App.tsx already holds `keyStatus: { ebird: string | null; openweather: string | null }`
(state at line 153, fetched on mount via `fetchKeyStatus` at line 257) and already
uses `() => setActiveTab('settings')` for every other tab's nudge. The plumbing is
purely additive:

```tsx
// App.tsx ~line 889 — current:
{mountedTabs.has('comparer') && <ListComparer onOpenSpecies={navigateToSpeciesDetail} />}
// becomes:
{mountedTabs.has('comparer') && (
  <ListComparer
    onOpenSpecies={navigateToSpeciesDetail}
    keyStatus={keyStatus}                              // KeyStatus | null
    onGoToSettings={() => setActiveTab('settings')}
  />
)}
```

```tsx
// ListComparer.tsx — signature change:
export function ListComparer({ onOpenSpecies, keyStatus, onGoToSettings }: {
  onOpenSpecies?: (commonName: string) => void
  keyStatus: KeyStatus | null
  onGoToSettings: () => void
}) { … }

// …and forwarded to the Checklists-mode child (line 164):
<ChecklistComparer onOpenSpecies={onOpenSpecies} keyStatus={keyStatus} onGoToSettings={onGoToSettings} />
```

> **`KeyStatus` type location.** It's currently a local `type` inside `App.tsx`
> (line 84), not exported. **Decision: move it to a shared module** —
> `frontend/src/lib/keyStatus.ts` exporting
> `export type KeyStatus = { ebird: string | null; openweather: string | null }`,
> and import it in App.tsx, ListComparer.tsx, ChecklistComparer.tsx,
> WeatherTideSection.tsx. (Re-declaring it in three files invites drift; one
> 1-line module is cheaper than three copies.) This is the only structural
> "shared type" the feature adds.

`ChecklistComparer` keeps all existing structure; the signature gains the two props:

```tsx
export function ChecklistComparer({ onOpenSpecies, keyStatus, onGoToSettings }: {
  onOpenSpecies?: (commonName: string) => void
  keyStatus: KeyStatus | null
  onGoToSettings: () => void
}) { … }
```

### 2.2 `ChecklistBadges` — slots **inside** `ChecklistTag` (FR-01)

`ChecklistTag` (line 407) renders one card. Per FR-01 the badge row appears in the
results state only (which `ChecklistTag` already is — it's rendered only at lines
265–266 inside `if (result)`), **after** the effort `metaBits` strip and **after**
the Notes disclosure. So `ChecklistBadges` is rendered as the last child of the
inner column `<span>` (the one starting line 428), after the Notes `<>…</>` block.

`ChecklistTag` needs the species list to derive media/breeding presence, but it
currently receives only `meta: ChecklistMeta` (which deliberately omits `species`,
see `toMeta` in compareChecklists.ts). **Decision: pass a precomputed
`badges: BadgeFlags` prop into `ChecklistTag`** rather than the whole species array —
the comparer already holds the full `ChecklistComparison`, and deriving the flags
at the call site keeps `ChecklistTag` a pure presenter.

```tsx
// ChecklistComparer.tsx results render (lines 265–266) becomes:
<ChecklistTag badge="A" id={idA} meta={result.metaA} badges={badgesA} />
<ChecklistTag badge="B" id={idB} meta={result.metaB} badges={badgesB} />
// where badgesA / badgesB are computed once from the comparison + meta (§4.1).
```

```tsx
function ChecklistTag({ badge, id, meta, badges }: {
  badge: 'A' | 'B'; id: string; meta: ChecklistMeta; badges: BadgeFlags
}) { … <ChecklistBadges flags={badges} /> … }
```

`ChecklistBadges` props:

```tsx
interface ChecklistBadges Props { flags: BadgeFlags }   // (see BadgeFlags in §4.1)
```

It renders six badges in a fixed order — `Camera`, `Mic`, `Video`, `Dna`,
`CloudSun`, `Waves` — each via one shared internal `<Badge>` presenter so A and B
align column-for-column (FR-03 "all three always shown"). Styling precedent:
`BreedingBadge` (line 48) and `MediaIcons` (line 67) — small pill, icon ~11–12px,
`var(--sr-*)` only.

### 2.3 `WeatherTideSection` — slots **after** `<CommentsTable>` (FR-09)

In `ChecklistComparer`'s results return, the last child today is `<CommentsTable …/>`
(line 338). Append:

```tsx
<WeatherTideSection
  idA={idA} idB={idB}
  metaA={result.metaA} metaB={result.metaB}
  keyStatus={keyStatus}
  onGoToSettings={onGoToSettings}
/>
```

It is self-contained: it renders its own "Weather & Tide" panel header, the Load
button (or the keys nudge), and the two-column grid of `WeatherTidePanel`s. It uses
the same two-column → stacked pattern the comparer uses elsewhere
(`gridTemplateColumns: '1fr 1fr'`, line 324) — wrap each side at the narrow
breakpoint by reusing the comparer's existing grid idiom.

`metaA`/`metaB` are passed so the section can (a) re-show the same A/B identity
header (`badge + locName + date + id`, the same fields `ChecklistTag` displays) and
(b) read `meta.comments` to compute the per-side weather-block flag that drives the
reconciliation note (FR-16).

### 2.4 `WeatherTidePanel` — one side (FR-13–18)

Pure view of one side's combined state:

```tsx
interface WeatherTidePanelProps {
  badge: 'A' | 'B'
  id: string
  meta: ChecklistMeta            // for the identity header + comments (note trigger)
  weather: SideWeatherState      // discriminated union, §4.3
  tide: SideTideState            // discriminated union, §4.3
  hasEmbeddedWeatherBlock: boolean   // FR-16 note trigger for this side
  onCopyWeather: () => void
  onCopyTide: () => void
  onCopyBoth: () => void
  onTideOverride: () => void     // FR-15 / OQ-2
}
```

It renders, per the side's state: a `Loader2` spinner (FR-13), the weather `pre`
block or scoped error (FR-14), the tide block / notice / override / error (FR-15),
the copy buttons for whatever loaded (FR-15.1), and the reconciliation note when
`hasEmbeddedWeatherBlock && weather.status === 'success'` (FR-16). All copy/tide
text is rendered in a `<pre>` matching the Weather tab's monospace style (App.tsx
lines 788–805 / 856) — reuse the same font stack and `var(--sr-surface-subtle)`
background.

---

## 3. `lib/commentBlocks.ts` — detection (FR-06)

### 3.1 Signatures

```ts
/** True if the decoded comment contains a SnowRaven/raincrow WEATHER block. */
export function hasWeatherBlock(rawComment: string): boolean

/** True if the decoded comment contains a SnowRaven TIDE block. */
export function hasTideBlock(rawComment: string): boolean
```

Both are pure, decode-first (via `decodeEntities` from `lib/commentText.ts`), and
case-insensitive. eBird returns comments HTML-entity-encoded, so detection MUST run
on decoded text (NFR-05, QA-04 "entity-encoded block is still detected"). No
`innerHTML`.

### 3.2 Confirmed weather markers — from `lib/weatherFormatter.ts`

`formatWeatherBody()` (lines 128–139) emits these labeled lines, in this order:

```
<emoji>
<condition>
Temperature: …
Wind: …
Wind Direction: …
Cloud Cover: …
Humidity: …
Dew point: …
Sunrise: …
Sunset: …
```

and `formatWeather()` (line 142) appends `ATTRIBUTION` =
`Weather generated by <a href="https://github.com/dtgibson/snowraven">SnowRaven</a>`.

> ⚠️ **PRD vs. code discrepancy (flagging, not silently fixing).** FR-06a lists
> `Dew point:` **after** `Humidity:` in the formatter — that matches the code
> (`Humidity` then `Dew point`). FR-06a's *enumerated marker list* is correct. No
> action needed; just confirming the markers are exactly the eight above.

**`hasWeatherBlock` rule (FR-06a):** positive when the decoded comment contains, as
a case-insensitive substring, **either**

- **≥ 2** of these labeled markers: `Temperature:`, `Wind:`, `Wind Direction:`,
  `Cloud Cover:`, `Dew point:`, `Humidity:`, `Sunrise:`, `Sunset:` — **OR**
- the attribution signature: `Weather generated by` **or** the bare token
  `SnowRaven` **or** `github.com/dtgibson/snowraven`.

> Define the eight markers as a `const WEATHER_MARKERS = [...] as const` and the
> three attribution tokens as `WEATHER_ATTRIB_TOKENS`. The `≥2` threshold (not 1)
> avoids a false positive from a comment that just happens to say "Wind: gusty" in
> prose. The attribution-token OR catches a SnowRaven block even if it was trimmed
> to only the emoji + condition + attribution.

### 3.3 Confirmed tide markers — from `lib/tideFormatter.ts` (twin: `backend/formatters/tide.py`)

`formatTideBody()` (frontend lines 29–42; Python `format_tide_body` lines 17–34,
**verified identical**) emits:

```
🌊
<Observed | Predicted>
Water level: <lo> – <hi> ft        ← literal "Water level: " prefix
Tide: <Rising | Falling>[ (turned during your checklist)]   ← literal "Tide: " prefix
[Previous <high|low>: … ft at …]
[Next <high|low>: … ft at …]
Station: <name> (<id>), <dist> mi away    ← literal "Station: " prefix
Relative to MLLW                            ← literal, always present
Tide data from NOAA CO-OPS                  ← NOAA_CREDIT, always present
```

`formatTide()` swaps the trailing `Tide data from NOAA CO-OPS` for
`TIDE_ATTRIBUTION` = `Tide data from NOAA CO-OPS · via <a …>SnowRaven</a>`. So
**`Relative to MLLW`** and **`Water level:`** are the two most distinctive,
always-present tide markers; `Station:` is always present; `Tide:` is always present.
`Tide data from NOAA CO-OPS` is the attribution signature.

**`hasTideBlock` rule (FR-06b):** positive when the decoded comment contains, as a
case-insensitive substring, **either**

- both **`Relative to MLLW`** **and** **`Water level:`** — OR
- **`Relative to MLLW`** plus one of **`Station:`** / **`Tide:`** — OR
- the NOAA attribution signature **`Tide data from NOAA CO-OPS`**.

> `Relative to MLLW` is the single strongest discriminator (it appears in no
> weather block and no ordinary birding prose), so any rule path requires it OR the
> NOAA-credit attribution. This tolerates the combined "Copy Weather and Tide
> Together" block (which contains both the weather markers AND the tide markers) —
> a combined block returns `true` from *both* detectors, satisfying QA-03.

> ⚠️ **Note on the `–` character.** `Water level:` uses a Unicode en-dash (`–`,
> U+2013) in the range, and `formatTideBody` uses it; eBird may return it encoded
> (`&#8211;`). Detection only substring-matches the `Water level:` **prefix** (not
> the dash), so encoding of the dash is irrelevant — but the unit tests must cover
> an entity-encoded body to prove decode-first works (QA-04/17).

### 3.4 Unit-test matrix (`commentBlocks.test.ts`, NFR-07 / QA-17)

| # | Input | `hasWeatherBlock` | `hasTideBlock` |
|---|---|---|---|
| 1 | `formatWeather([...])` output (real weather block) | `true` | `false` |
| 2 | `formatTide(reading)` output (real tide block) | `false` | `true` |
| 3 | `buildCombined(weather, tideBody)` output (combined) | `true` | `true` |
| 4 | Entity-encoded weather block (`&#x1f325;`, `&amp;` etc.) | `true` | `false` |
| 5 | Entity-encoded tide block (`Relative to MLLW` intact, emoji encoded) | `false` | `true` |
| 6 | Plain prose ("Lovely morning, lots of warblers.") | `false` | `false` |
| 7 | `''` (empty) and whitespace-only | `false` | `false` |
| 8 | Prose containing one stray `Wind: light` only | `false` (1 < 2 markers) | `false` |
| 9 | Weather block trimmed to emoji + condition + attribution only | `true` (attrib token) | `false` |
| 10 | Tide notice with `Station:` + `Tide:` but no `Relative to MLLW` and no NOAA credit | `false` | `false` |

> Build inputs 1–3 by importing the **real** `formatWeather` / `formatTide` /
> `formatWeatherBody` / `formatTideBody` and a fixture `HourlyResponse[]` /
> `TideReading` — so the test is coupled to the actual emitted strings and breaks
> if a formatter's wording drifts. (`compareChecklists.test.ts` is the precedent
> for importing the real pure fns.)

---

## 4. Badge derivation & state model

### 4.1 `lib/checklistBadges.ts` — pure reducers (FR-02/04, NFR-07)

```ts
import type { ChecklistComparison } from './compareChecklists'
import { hasWeatherBlock, hasTideBlock } from './commentBlocks'

export interface BadgeFlags {
  photo: boolean
  audio: boolean
  video: boolean
  breeding: boolean
  weatherComment: boolean   // FR-05 weather-info badge
  tideComment: boolean      // FR-05 tide-info badge
}

/** OR media/breeding presence across one side's species + detect comment blocks. */
export function deriveBadges(
  comp: ChecklistComparison,
  side: 'a' | 'b',
): BadgeFlags
```

**Media presence (FR-02):** OR `media.{photo,audio,video} > 0` across that side's
species. The comparison splits species across `both` / `aOnly` / `bOnly`, with each
`ChecklistRow` carrying `mediaA: MediaPresence | null` and `mediaB`. For side A,
scan `both ∪ aOnly` reading `mediaA`; for side B, `both ∪ bOnly` reading `mediaB`.
(`null` ⇒ that species not on that side ⇒ contributes nothing.)

**Breeding presence (FR-04):** OR `breedingA`/`breedingB` non-null/non-empty across
the same per-side species set. (`compareChecklists` already maps `breedingCode || null`.)

**Comment blocks (FR-05/06):** `weatherComment = hasWeatherBlock(meta.comments)`,
`tideComment = hasTideBlock(meta.comments)` where `meta = comp.metaA | comp.metaB`.

> `deriveBadges` takes the *comparison* (not raw `ChecklistData`) because that's
> what the comparer holds post-`handleCompare`. The reducers are pure and unit-
> tested independent of React.

**Test matrix (`checklistBadges.test.ts`):** a comparison where A has a photo on one
species and B has none → `badgesA.photo === true`, `badgesB.photo === false`; A has a
`breedingCode` → `badgesA.breeding === true`; A's `metaA.comments` contains a weather
block → `badgesA.weatherComment === true`. Plus the key-independence case is a UI
concern (no key in the data path), covered by QA-05 manually.

### 4.2 Badge presentation (FR-03/07, NFR-03/04)

One shared `<Badge>` presenter inside `ChecklistBadges`:

- **present:** full-opacity icon, `var(--sr-accent)` (or `--sr-text`) tint, present
  `title`/`aria-label`.
- **absent:** muted (`opacity` + `var(--sr-text-disabled)`), absent `title`/`aria-label`.
- All six always render (never hidden) so A/B align (FR-03).
- State conveyed by **icon + opacity + label text**, not color alone (NFR-04).

Labels (FR-03/04/05):
- Photo: `"Photos reported"` / `"No photos reported"`
- Audio: `"Audio reported"` / `"No audio reported"`
- Video: `"Video reported"` / `"No video reported"`
- Breeding (`Dna`): `"Breeding codes reported"` / `"No breeding codes reported"`
- Weather (`CloudSun`): `"Weather block in comment"` / `"No weather block in comment"`
- Tide (`Waves`): `"Tide block in comment"` / `"No tide block in comment"`

### 4.3 Per-side weather/tide state (FR-11/13/14/15)

Mirror App.tsx's `AppState` / `TideState` shapes so the Engineer reuses known
patterns. Defined in `WeatherTideSection.tsx` (or a small `lib/weatherTideTypes.ts`
if shared with the panel — Engineer's discretion; recommend co-locating in the
section file unless the panel needs them, which it does → **put them in the panel
file and import into the section**, since the panel's props reference them):

```ts
// Weather — one side. Mirrors App.tsx AppState minus the unused locName/obsDt
// (the panel already gets identity from `meta`).
type SideWeatherState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; formatted: string }   // /weather → data.formatted (ends with ATTRIBUTION)
  | { status: 'error'; message: string }        // TransportError.detail-aware (FR-14)

// Tide — one side. Mirrors App.tsx TideState exactly.
type SideTideState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; formatted: string; body: string }   // formatted = standalone; body = for combined copy
  | { status: 'too-far'; station: string; distanceMi: number }
  | { status: 'outside-us'; station: string; distanceMi: number }
  | { status: 'unavailable' }
  | { status: 'error' }
```

The reused HTTP response types are **already defined** — reuse them, do not red`fine`:
- Weather: `{ formatted: string; checklist_id: string; loc_name: string; obs_dt: string }`
  (the inline type App.tsx uses at line 407). Only `formatted` is needed here.
- Tide: `TideResponse` `{ status; formatted?; body?; station?; distanceMi? }` — this
  type is currently **local to App.tsx (line 66)**. **Decision: move `TideResponse`
  into `lib/tide.ts`** (where `TideReading` already lives) and import it in both
  App.tsx and WeatherTideSection.tsx. One shared definition, no drift.

`WeatherTideSection` holds:

```ts
const [weatherA, setWeatherA] = useState<SideWeatherState>({ status: 'idle' })
const [weatherB, setWeatherB] = useState<SideWeatherState>({ status: 'idle' })
const [tideA, setTideA] = useState<SideTideState>({ status: 'idle' })
const [tideB, setTideB] = useState<SideTideState>({ status: 'idle' })
const [loaded, setLoaded] = useState(false)   // gates the section from idle → loaded view
```

### 4.4 The single Load action (FR-11/12) — fires both sides concurrently

```ts
const loadConditions = useCallback(async () => {
  setLoaded(true)
  await Promise.all([
    loadSideWeather(idA, setWeatherA), loadSideTide(idA, false, setTideA),
    loadSideWeather(idB, setWeatherB), loadSideTide(idB, false, setTideB),
  ])
  // NO copyText() here. This is the deliberate divergence from App.tsx handleLookup,
  // which auto-copies. (FR-15.1 / QA-18)
}, [idA, idB])
```

`loadSideWeather` / `loadSideTide` are per-side twins of App.tsx's `loadWeather`
(line 404) and `loadTide` (line 381) — same `transport.get('/weather/{id}')` /
`transport.get('/tide/{id}', force ? {force:'1'} : undefined)` calls, same
`TransportError.detail` handling (FR-14), but writing the *passed-in setter* so each
side is independent (FR-11/21). `Promise.all` lets them run concurrently while each
resolves into its own state (a rejected side can't reject the whole `all` because
each helper catches and sets its own error state — exactly like App.tsx's loaders,
which never throw). **Results persist** in these four state objects until a "New
comparison" reset (which unmounts the whole results tree, clearing them) — satisfying
FR-12's "remain visible until a new comparison."

> The override (FR-15/OQ-2) calls `loadSideTide(id, /*force*/ true, setTide_)` for
> the one side whose tide is `too-far`/`outside-us`, re-fetching with `force: '1'`,
> exactly as App.tsx's `handleTideOverride` (line 439) does — but scoped to the side.

---

## 5. Copy logic (FR-15.1 / OQ-3 / QA-18)

Three copy actions per side, all through `copyText()` from `lib/clipboard.ts`
(never `navigator.clipboard` — NFR-06). Lives in `WeatherTidePanel` (or handlers
passed from the section; the panel knows the side's resolved strings):

```ts
// Copy weather — only rendered when weather.status === 'success'
onCopyWeather: () => copyText(weather.formatted)          // weather.formatted ends with ATTRIBUTION

// Copy tide — only rendered when tide.status === 'ok'
onCopyTide: () => copyText(tide.formatted)                // standalone tide block (NOAA + SnowRaven)

// Copy weather & tide together — only when BOTH weather success AND tide ok
onCopyBoth: () => copyText(buildCombined(weather.formatted, tide.body))
```

**`buildCombined` must match the Weather tab byte-for-byte.** Reuse App.tsx's exact
construction (line 377):

```ts
`${weatherFormatted.replace(`\n${ATTRIBUTION}`, '')}\n\n${tideBody}\n\n${COMBINED_ATTRIBUTION}`
```

- strips the weather block's own `\nATTRIBUTION` tail,
- keeps the tide **body** (which ends with the inline `Tide data from NOAA CO-OPS`
  credit — `tide.body`, NOT `tide.formatted`),
- appends the single `COMBINED_ATTRIBUTION` = `Weather and tide generated by …SnowRaven`.

> **Decision: extract `buildCombined` into `lib/tideFormatter.ts`** (next to
> `COMBINED_ATTRIBUTION`, where it conceptually belongs) and import it in both
> App.tsx and `WeatherTidePanel`. Currently it's an inline arrow in App.tsx (line
> 377) that closes over the imported `ATTRIBUTION`/`COMBINED_ATTRIBUTION`. Moving it
> guarantees the comparer's combined copy is *identical* to the Weather tab's
> (single SnowRaven attribution — QA-18) and can't drift. Signature:
> `export function buildCombined(weatherFormatted: string, tideBody: string): string`.

**No auto-copy guarantee (the headline divergence from the Weather tab):**
`loadConditions` (§4.4) does **not** call `copyText`. App.tsx's `handleLookup`
(line 433) auto-copies on success; the comparer deliberately does not. Copy buttons
appear only after load and copy only on press (a transient "Copied!" via a per-button
timeout, mirroring App.tsx's `copied`/`tideCopied`/`bothCopied` 2s pattern). Buttons
render only for content that loaded: no "Copy tide" when `tide.status !== 'ok'`; no
"Copy both" unless weather success AND tide ok.

---

## 6. Key-status plumbing & nudge gating (FR-19/20, OQ-1)

**Recommendation: gate up front on `keyStatus` (the PRD default).** Reasons:

1. **No wasted round-trip.** Attempt-and-catch fires 4 third-party calls (eBird
   resolve + OpenWeather fan-out per side) only to surface a 500 — against the
   user's rate-limited OpenWeather quota (the exact cost FR-12 exists to bound).
2. **Matches the existing pattern.** The Weather tab already gates its notices on
   `keyStatus` (App.tsx line 578). Same mental model, same copy.
3. **Cleaner UX.** The user sees "add your keys" *instead of* a Load button, rather
   than clicking Load and getting an error.

**Gating logic in `WeatherTideSection`** (required keys per FR-19: **eBird** —
needed to resolve both checklists for weather *and* tide; **OpenWeather** — needed
for weather; tide's NOAA source is keyless but still needs eBird):

```ts
const missing: ('eBird' | 'OpenWeather')[] = []
if (keyStatus && keyStatus.ebird === null) missing.push('eBird')
if (keyStatus && keyStatus.openweather === null) missing.push('OpenWeather')
const keysMissing = missing.length > 0
```

- `keyStatus === null` (not yet fetched): treat as "still resolving" — render the
  Load button normally (the fetch completes on mount essentially immediately; a
  brief flash is acceptable and matches App.tsx, which also renders nothing until
  `keyStatus` resolves). **Do not** show the nudge for `null` — only for a resolved
  status with a `null` key.
- `keysMissing`: replace the Load button + panels with the nudge — a muted/info box
  naming the missing key(s) and a **"Go to Settings →"** button calling
  `onGoToSettings`. Reuse the Weather tab's notice copy (App.tsx lines 587/606) for
  consistency (FR-19): e.g. eBird → *"eBird API key not configured — weather & tide
  lookups require an eBird API key."*; OpenWeather → *"OpenWeather API key not
  configured — weather lookups won't return conditions."* Styled with
  `var(--sr-warning-*)` tokens like the existing notices.

> **Badges are unaffected** (FR-08/19/22): they render from the already-fetched
> comparison data, before/independent of this gate. The gate only governs Area B.

> **`keysVersion` note:** App.tsx bumps `keysVersion` when keys are saved and passes
> it to Settings-aware tabs so they re-read. The comparer reads `keyStatus` directly
> (a prop), which re-renders when App updates it post-save (`onKeysSaved →
> fetchKeyStatus → setKeyStatus`). No `keysVersion` plumbing is needed here — the
> prop *is* the live value.

---

## 7. Tide override reuse (OQ-2, FR-15)

The Weather tab's too-far/outside-US notice + one-tap override is ~15 lines of JSX
+ copy (App.tsx lines 824–840) plus the `handleTideOverride` (line 439) that re-fetches
with `force: true`. The comparer needs the *same* notice on each side.

**Recommendation: extract the notice copy + button labels into `lib/tideNotice.ts`,
replicate the (tiny) override fetch per side.**

```ts
// lib/tideNotice.ts — pure copy helpers, unit-testable (string assertions).
export function tideTooFarNotice(station: string, distanceMi: number, kind: 'too-far' | 'outside-us'): string
export function tideOverrideLabel(kind: 'too-far' | 'outside-us'): string  // 'Show it anyway' | 'Show nearest US station'
```

Rationale:
- The **copy** (the user-facing sentences and button labels) is the part that must
  stay consistent between the two surfaces (FR-15 "mirroring the Weather tab's
  notice copy") — extracting *that* prevents drift and is trivially testable.
- The **override mechanism** (call the tide loader with `force`) is already a 1-line
  per-side call (`loadSideTide(id, true, setTide_)`); extracting a "hook" for it
  would be more abstraction than it saves. Replicate the 1-liner per side.
- Refactoring App.tsx's Weather tab to *consume* `tideNotice.ts` is optional and
  out of this feature's required scope (NFR-02 is about backend; this is a frontend
  niceness). **Recommend doing it** (App.tsx imports the same two helpers) so the
  two surfaces are provably identical — but flag it as a small App.tsx edit if the
  user wants to keep this feature's diff minimal. **Defaulting to: extract +
  consume in both** (one source of truth for the copy).

---

## 8. Risks & edge cases

| # | Risk / edge case | Handling |
|---|---|---|
| R1 | **Combined-copy attribution drift** — comparer's combined block must carry exactly one SnowRaven attribution (QA-18). | Extract `buildCombined` to `lib/tideFormatter.ts`; both surfaces import it. Test asserts exactly one `COMBINED_ATTRIBUTION` and zero standalone `ATTRIBUTION` in the output. |
| R2 | **False-positive weather detection** from prose ("Wind: gusty all day"). | `≥2` marker threshold (not 1) + the attribution-token OR path. Test #8 locks it. |
| R3 | **Entity-encoded comments** not detected. | Decode-first via `decodeEntities`; tests #4/#5 use encoded fixtures. |
| R4 | **One side unresolvable at lookup time** (FR-21/QA-15) — e.g. idB 404s. | Each side's loader catches and sets its own error state; `Promise.all` of always-resolving helpers never rejects. A's content renders fully; B shows scoped error. |
| R5 | **Tide override skews the local-time window** for a far station. | Pre-existing, accepted behavior (`lib/tide.ts` header note). Override is explicit; same as the Weather tab. No new handling. |
| R6 | **`keyStatus` is `null` on first results paint.** | Treat `null` as "resolving" → show Load (not nudge). Resolves near-instantly on mount; never shows a false nudge. |
| R7 | **Badge alignment** A vs B when one side lacks a media type. | All six badges always render (present/absent), fixed order — A and B line up column-for-column (FR-03). |
| R8 | **`ChecklistTag` lacked species data.** | Pass precomputed `BadgeFlags` (not the species array) to keep `ChecklistTag` a pure presenter; derive once at the comparer call site. |
| R9 | **Comment block but failed fresh lookup** → no reconciliation note (FR-16/QA-12). | Note gated on `hasEmbeddedWeatherBlock && weather.status === 'success'` — both required. |
| R10 | **Tide block alone triggers the note.** It must not (FR-16/QA-12). | Note keyed off the *weather* embedded-block flag only; tide-info badge never feeds it. |
| R11 | **`copyText` returns false on web without a gesture** after an `await`. | Copy fires on a button click (a gesture), and `copyText` has the `execCommand` fallback. No auto-copy, so no after-`await`-without-gesture path. |
| R12 | **Section persists stale weather across a different comparison.** | "New comparison" (`handleReset`, line 250) sets `result = null`, which unmounts the whole results subtree including `WeatherTideSection` — its state is gone. Re-comparing mounts a fresh section at `idle`. (FR-12 / out-of-scope "no persistence across reset".) |
| R13 | **Theming / a11y regressions.** | `var(--sr-*)` only (NFR-03); badges convey state via icon+opacity+label (NFR-04); Load/Copy/Settings/override are `tabIndex={0}` buttons; loading uses `role="status"`, errors `role="alert"` — matching the component's existing usage. |

---

## 9. Test plan (aligned to QA-01..18)

**Unit (vitest, new):**
- `commentBlocks.test.ts` → QA-17 (and the §3.4 10-case matrix; covers QA-03/04).
- `checklistBadges.test.ts` → media/breeding reducers + comment-flag wiring
  (supports QA-01/02, NFR-07).
- `tideNotice.test.ts` → notice/label copy strings (supports QA-10 consistency).
- `tideFormatter.test.ts` (extend existing if present, else add) → `buildCombined`
  emits exactly one `COMBINED_ATTRIBUTION`, no standalone `ATTRIBUTION` (QA-18).

**Component / manual (per the PRD's QA table):**
- QA-01/02 badges reflect content; QA-03/04 detection positive/negative/combined/
  encoded; QA-05 key-independent badges; QA-06 placement + stacking; QA-07
  explicit-action (no call until Load); QA-08 dual-runtime same formatted output;
  QA-09 per-side independence; QA-10 tide states + override; QA-11/12 reconciliation
  note present/absent; QA-13/14 nudge + Settings nav; QA-15 partial resolution;
  QA-16 `git diff` touches no `backend/`, tokens-only, dark-mode, a11y; QA-18 no
  auto-copy + the three copy buttons.

**Regression guard for QA-16/NFR-02:** after implementation,
`git diff --name-only main | grep '^backend/'` must return empty.

---

## 10. Summary for the Engineer

- **8 new frontend files** (3 lib + 2 lib tests + 3 components), **3 edited**
  (App.tsx 1-line prop, ListComparer prop forward, ChecklistComparer 2 inserts),
  plus **3 small "move-to-shared" refactors** (`KeyStatus` → `lib/keyStatus.ts`,
  `TideResponse` → `lib/tide.ts`, `buildCombined` → `lib/tideFormatter.ts`) and an
  **optional** App.tsx consume-`tideNotice` edit.
- **Zero backend files. Zero new endpoints. Zero schema.** Reuses
  `/checklists/{id}`, `/weather/{id}`, `/tide/{id}` and existing types verbatim.
- All markers in §3 are **quoted from the real formatters** (frontend + the Python
  twin), not guessed.
- Open product calls were resolved to the PRD defaults; the only thing genuinely
  worth a user nod is **§7's optional App.tsx refactor** to consume the shared
  `tideNotice` helpers (do it for one-source-of-truth, or skip to keep the diff
  surgical).
