# Schema — Media Card on the Statistics Tab

## Path
Frontend Only — No data layer changes required

## Confirmation
All PRD requirements read from `MLExportRow[]` data already loaded in `BirdingStats.tsx`. No new tables, columns, migrations, or backend endpoints are needed.

---

## Existing Data Used by This Feature

### `MLExportRow` (from `frontend/src/lib/parseMLExport.ts`)
- Fields used: `date: string` (observation date, YYYY-MM-DD), `format: 'Photo' | 'Audio' | 'Video'`, `commonName: string`, `catalogId: string`
- How used: Rows are bucketed by `date` into time periods; counted by `format` to produce per-period photo/audio/video totals for the chart. `commonName` + `catalogId` power the rankings.
- Available in `BirdingStats.tsx` as `phase.mlRows: MLExportRow[]` (already loaded from Settings auto-load)

### `MediaMap` (from `MLExportResult.mediaMap: Record<string, string>`)
- How used: The existing `mlCatalogUrl()` helper in `BirdingStats.tsx` already uses this to build Macaulay Library links for the three rankings. No change needed.

### Existing helpers in `sightingsGraph.ts`
- `isoWeekKey(dateStr)` — converts YYYY-MM-DD → YYYY-Www; reused by `buildMediaGraphData`
- `mondayOfISOWeek(weekKey)` — converts YYYY-Www → Monday Date object; reused for weekly gap-fill
- `formatPeriodLabel(key, interval)` — already handles weekly/monthly/yearly formatting for X-axis labels; used by the new chart

---

## New Code Required (Frontend Only)

### 1. `frontend/src/lib/sightingsGraph.ts` — extend with new types and function

**New exports:**

```typescript
export type MediaGraphInterval = 'weekly' | 'monthly' | 'yearly' | 'total'

export type MediaGraphPoint = {
  key: string
  photo: number
  audio: number
  video: number
  total: number
}
```

**New function:**

```typescript
export function buildMediaGraphData(
  mlRows: MLExportRow[],
  interval: MediaGraphInterval
): { data: MediaGraphPoint[]; interval: MediaGraphInterval }
```

Behaviour by interval:
- `'weekly'` / `'monthly'` / `'yearly'`: same bucketing logic as `buildGraphData` using the existing `isoWeekKey` / `mondayOfISOWeek` helpers; gap-fill to produce a continuous x-axis; returns raw per-period counts
- `'total'`: bucket by calendar day (key = `date.slice(0, 10)`, i.e. YYYY-MM-DD); no gap-fill; sorted chronologically; returns per-day counts (the component applies cumulative in its `useMemo`)
- Returns `{ data: [], interval }` when fewer than 2 distinct period keys exist (consistent with `buildGraphData`)
- Rows with empty `date` are skipped

`total` for each `MediaGraphPoint` = `photo + audio + video` computed inside the function.

The existing `GraphInterval` type and `buildGraphData` function are **unchanged**.

---

### 2. `frontend/src/components/BirdingStats.tsx` — state and JSX additions

**New state (declared before all early returns, consistent with existing hooks):**

```typescript
const [mediaInterval, setMediaInterval] = useState<MediaGraphInterval>('monthly')
const [mediaViewMode, setMediaViewMode] = useState<'per-period' | 'cumulative'>('per-period')
```

**New useMemos (declared before all early returns):**

```typescript
const mediaGraphResult = useMemo(
  () => buildMediaGraphData(phase.mlRows ?? [], mediaInterval),
  [phase.mlRows, mediaInterval]
)

const mediaDisplayData = useMemo(() => {
  const useCumulative = mediaInterval === 'total' || mediaViewMode === 'cumulative'
  if (!useCumulative) return mediaGraphResult.data
  let rPhoto = 0, rAudio = 0, rVideo = 0
  return mediaGraphResult.data.map(p => {
    rPhoto += p.photo; rAudio += p.audio; rVideo += p.video
    return { ...p, photo: rPhoto, audio: rAudio, video: rVideo, total: rPhoto + rAudio + rVideo }
  })
}, [mediaGraphResult.data, mediaInterval, mediaViewMode])
```

**JSX placement:** Media card inserted between the Breeding Stats card and the Other Statistics card (FR-01). Conditional on `phase.mlRows?.length > 0` (FR-02).

**Removed from Other Statistics:** The three Most Photographed / Most Audio / Most Video ranking sub-sections (FR-13). Nemesis Birds remains.

---

### 3. `frontend/src/globals.css` — new color token

```css
/* In :root */
--sr-graph-media-total: #64748b;   /* slate-500 — neutral, reads as "combined" */

/* In [data-theme="dark"] */
--sr-graph-media-total: #94a3b8;   /* slate-400 — lighter for dark backgrounds */
```

The Designer may adjust these values. The token name is fixed: `--sr-graph-media-total`.

---

### 4. `frontend/src/lib/sightingsGraph.test.ts` — new test cases for `buildMediaGraphData`

Minimum coverage:
- No rows → `data: []`
- Single period → `data: []`
- Monthly bucketing — correct photo/audio/video/total counts per month
- Weekly bucketing — correct ISO week keys
- Yearly bucketing — correct year keys
- `'total'` interval — daily keys, per-day counts
- Rows with empty `date` are skipped
- Gap-fill produces zero-count periods between real data (monthly)

---

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run.
