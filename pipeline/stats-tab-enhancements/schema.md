# Schema — Statistics Tab Enhancements

## Path
Frontend Only — No data layer changes required

## Confirmation
Every functional requirement in the PRD was assessed against the full list of criteria (new records, new reads, new writes, new relationships, new stored derivations). All 32 FRs involve either (a) computing additional values from already-parsed data in client-side `useMemo` hooks, (b) adding links and text to existing JSX, or (c) replacing text-heavy layouts with Recharts visualizations. No new tables, columns, API endpoints, migrations, or backend changes are required.

---

## Existing Data Used by This Feature

### `ObservationEntry` (from `parseEbirdObservations.ts`)
Each row in the eBird backup CSV is one `ObservationEntry`. Every field below is already parsed and available.

| Field | Type | Used for |
|---|---|---|
| `submissionId` | `string` | Checklist links on milestones, first/last obs, biggest day, one-and-done pills |
| `commonName` | `string` | Species name on milestone entries |
| `date` | `string` (YYYY-MM-DD) | Total-mode accumulation x-axis; first/last observation cards |
| `location` | `string` | Location name on first/last observation cards |
| `locationId` | `string` | Already used in location grouping |
| `stateProvince` | `string \| null \| undefined` | eBird region links for county and state entries (`US-MI` format) |
| `county` | `string \| null` | Already used in county grouping |
| `count` | `number \| null` | Already used in quality/biggest-counts |
| `protocol` | `string \| null \| undefined` | Already used in effort protocolRows |
| `duration` | `number \| null \| undefined` | Already used in effort avgDurationMin |
| `distance` | `number \| null \| undefined` | Already used in effort avgDistanceKm |
| `numObservers` | `number \| null \| undefined` | Already used in effort observerDist |
| `allObsReported` | `boolean \| null \| undefined` | Already used in effort completeRatio |
| `checklistComments` | `string \| undefined` | Already used in quality comment coverage |

### `ChecklistEntry` (built from `checklists` useMemo in `BirdingStats.tsx`)
One entry per unique `submissionId`, built from the first `ObservationEntry` for each checklist.

| Field | Type | Used for |
|---|---|---|
| `submissionId` | `string` | Biggest-single-day checklist link; first/last observation checklist link |
| `date` | `string` | Already used throughout |
| `location` | `string` | Location name on first/last observation cards |
| `stateProvince` | `string \| null` | eBird region links for county/state entries |
| `protocol` | `string \| null` | Protocol bar chart in Effort & Methodology redesign |
| `duration` | `number \| null` | Average-by-protocol table |
| `distance` | `number \| null` | Average-by-protocol table |
| `numObservers` | `number \| null` | Observer distribution bar chart |
| `speciesCount` | `number` | Biggest-single-day link; already computed |
| `checklistComments` | `string` | Comment coverage bar chart |

### Existing `useMemo` computations that need enhancement (not replacement)

**`accumulation` useMemo** — currently returns `{ chartData, milestones: Map<number, string>, firstSpecies }`. Needs to also return:
- Per-milestone: species name (the species at position N in the chronological lifer sequence) and the `submissionId` of the observation that triggered it
- `liferPoints`: an array of `{ date, species, count, submissionId }` for Total-mode chart rendering
- First and last observation `submissionId` and `location` (currently only `firstSpecies.date` and `firstSpecies.name` are returned)

**`funStats` useMemo** — `oneDoneBirds` currently returns `string[]` (just species names). Needs to return `{ name: string; submissionId: string }[]` to support one-and-done pill links.

**`geo` useMemo** — `topCounties` currently returns `{ name, count }[]` without the `stateProvince` code needed for region links. Needs to carry the stateProvince per county. The county→stateProvince mapping is available in the `checklists` array (each `ChecklistEntry` has both `county` and `stateProvince`).

**`quality` useMemo** — `biggestCounts` already carries `submissionId` per entry. The Data Quality redesign also needs the observation's `date` and `location` for the biggest-counts table — these can be resolved from the `checklists` lookup by `submissionId`.

**`effort` useMemo** — `protocolRows` already has `name`, `count`, `pct`. The average-by-protocol table additionally needs avg duration and avg distance per protocol — requires grouping `checklists` by `protocol` and computing means.

### Existing endpoints called by this feature
- `GET /settings/files` — auto-load status check (unchanged)
- `GET /settings/files/ebird` — eBird backup CSV (unchanged)
- `GET /settings/files/ml` — ML export CSV (unchanged, optional)
- `GET /settings/map-defaults` — for nemesis lat/lng (unchanged)
- `GET /stats/nemesis` — nemesis birds (unchanged)

### Chart library
Recharts is already installed and used for `AreaChart` in the accumulation curve. The new pie charts use `PieChart`, `Pie`, `Cell`, and `Legend` from the same package. The horizontal bar charts in the Effort & Methodology and Data Quality redesigns use the existing `BarChart` / `Bar` components. No new libraries are added.

---

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
