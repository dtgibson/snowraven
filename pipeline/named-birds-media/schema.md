# Technical Design — Named Birds Media

**Feature:** named-birds-media
**Stage:** 3 — The Architect
**Path:** Frontend Only (no database, no schema, no migration)
**Source:** prd.md (approved) · strategic-brief.md · pipeline.config.json

> **Why "Frontend Only":** SnowRaven has no application database. All data is the
> locally-loaded eBird backup + Macaulay Library (ML) export CSVs, parsed in the
> browser. This feature persists nothing, adds no backend route, and introduces no
> new provider. Its "data layer" is a pure client-side matcher over the already-parsed
> `mlExportCache`, plus presentation. This document is therefore a technical design +
> data-flow + file-by-file change plan, not a DB schema.

---

## 1. Overview

Below each named individual's existing sightings map on the Named Birds tab, render
that individual's own Macaulay Library media (photo/audio/video) as inline embeds,
each labeled with its capture date and a checklist link. A named bird's media is the
set of ML-export rows whose **own** per-asset comment (`caption` / `mediaNotes`,
**not** `observationDetails`) names that individual, read with the existing
`parseNameTags` `[name:…]` parser and keyed by **name + normalized species** — the
same identity `computeNamedBirds` uses, so the same name on two species never
cross-attributes.

The matcher runs **once** over the whole ML export, memoized, producing a
`Map<birdKey, matchedAsset[]>` grouped by named-individual key. The map is threaded
from the `NamedBirds` container down through `NamedBirdsTable` into `NamedBirdRow`,
which looks up its own bird's assets by `bird.key` and renders a new
`<NamedBirdMedia>` section **below** the existing map block. Matching + the date/
checklist labels are **fully local** (no network); only the embed player needs the
network. Embeds are deferred to row expansion (the tab's single-open accordion),
mounted in a bounded initial batch (~6) with a keyboard-accessible "Show more", and
lazy-mounted via IntersectionObserver. Each item degrades — when offline or when the
iframe fails to load — to a placeholder that keeps the date + `<ChecklistLink>` and
adds an `<OutboundLink>` to the canonical single-asset ML URL, never a broken frame.

The design reuses every relevant convention already in the codebase: the
`mediaComments.ts` "caption + mediaNotes only, exclude observationDetails" precedent,
the `mlExportCache` shared parse, the `.sr-media-grid`/`.sr-media-iframe` embed CSS,
`ChecklistLink` / `OutboundLink` / `mlAssetUrl`, the `navigator.onLine` +
`window` `offline`/`online` effect pattern (SnowMap.tsx), and the entry-chunk
maps-lazy discipline (an iframe is light, so no new lazy boundary is needed for the
media component itself).

---

## 2. Data flow & matching

### 2.1 Where the data lives today (verified)

- **`MLExportRow`** (`frontend/src/lib/parseMLExport.ts`) already carries every field
  needed, per-asset: `catalogId` (digits only, `^ML` already stripped, parser guards
  `^\d+$`), `commonName` (already `normalizeSpeciesName`-collapsed to parent species),
  `format: 'Photo' | 'Audio' | 'Video'` (**confirmed** — the parser validates against
  `VALID_FORMATS = {'Photo','Audio','Video'}` and drops any other value), `date`
  (raw export string, `''` when absent), `checklistId` (`''` when absent), and the
  three free-text fields `caption`, `mediaNotes`, `observationDetails`.
- **`mlExportCache`** (`frontend/src/lib/mlExportCache.ts`) parses the ML CSV once and
  shares `MLExportResult` (`{ entries, mediaMap, rows }`) across tabs, invalidated on
  file save/clear. `loadMLExport()` returns `null` when no ML file is stored — the
  matcher must treat `null` as "no media for anyone" (FR-17).
- **`NamedBird.key`** (`frontend/src/lib/namedBirds.ts`, `computeNamedBirds`) is
  `` `${name.toLowerCase()}::${normalizeSpeciesName(commonName).toLowerCase()}` `` using
  `speciesUtils.normalizeSpeciesName` (strips a trailing `(…)` parenthetical). This is
  the join key the matcher must reproduce byte-for-byte.

**OQ-04 — field selection confirmed.** `caption` + `mediaNotes` are the correct and
only per-asset comment fields; `observationDetails` is correctly excluded. This is
not a guess — `frontend/src/lib/mediaComments.ts` already established exactly this
selection for the Multimedia tab's Media Comments section, with the same documented
rationale ("the ML export copies the eBird observation comment onto every media asset
from that observation — so it repeats across items and is intentionally excluded").
The new matcher reuses that field contract.

### 2.2 The pure matcher — new file `frontend/src/lib/namedBirdMedia.ts`

A single pure function (no React, no I/O), unit-tested:

```ts
import type { MLExportRow } from './parseMLExport'
import { parseNameTags } from './namedBirds'
import { normalizeSpeciesName } from './speciesUtils'

export interface NamedBirdAsset {
  catalogId: string      // digits only (parser-guaranteed ^\d+$)
  format: 'Photo' | 'Audio' | 'Video'
  date: string           // raw export date string (formatted at render via formatDate)
  checklistId: string    // '' when absent; ChecklistLink guards ^S\d+$ at render
}

/**
 * Build the media join for named birds: map of NamedBird.key -> that individual's
 * matched assets, newest first (catalogId breaks ties). Pure, no network.
 *
 * Matching rule (FR-01..FR-04):
 *  - read name tags from caption + mediaNotes ONLY (never observationDetails)
 *  - key by name (lowercased) + normalized species (lowercased) — identical to
 *    computeNamedBirds' key, so the same name on two species never cross-attributes
 *  - a row whose caption+mediaNotes carry no [name:…] tag matches nothing (fine)
 *  - dedupe a catalogId within one bird (a row could tag the same name twice)
 */
export function computeNamedBirdMedia(
  rows: MLExportRow[] | null | undefined,
): Map<string, NamedBirdAsset[]>
```

**Algorithm:**
1. If `rows` is null/empty → return an empty `Map` (FR-17 offloads cleanly).
2. For each row, `parseNameTags(row.caption + '\n' + row.mediaNotes)` — join the two
   fields with a separator so a `[name:` opened in one field can't accidentally close
   with a `]` in the other (`parseNameTags` already dedupes distinct names within a
   comment and is ReDoS-bounded by `NAME_TAG_RE`'s `{0,120}` cap; the separator keeps
   the two independent). Exclude `observationDetails` entirely.
3. For each parsed name, compute
   `` key = `${name.toLowerCase()}::${normalizeSpeciesName(row.commonName).toLowerCase()}` ``.
   (Re-normalizing via `speciesUtils.normalizeSpeciesName` even though the parser
   already collapsed `commonName` — this makes the keying **provably identical** to
   `computeNamedBirds` and immune to any future parser change; the fn is memoized so
   it is cheap.)
4. Push `{ catalogId, format, date, checklistId }` into the key's bucket, skipping a
   `catalogId` already present in that bucket (per-bird dedupe).
5. After the pass, sort each bucket **newest-first by `date`, `catalogId` as a stable
   tie-break** (OQ-03 default; mirrors `mediaComments.ts`'s exact sort and the tab's
   newest-first sightings). Empty-string dates sort to the end deterministically.

**Complexity:** O(rows × tags-per-row); one linear pass + per-bucket sort. No network,
no per-asset call (NFR-01). Matches are attributed only to keys that also exist as
named birds — buckets whose key has no corresponding `NamedBird` are simply never
looked up (harmless; a name tagged on media but never in a species comment produces
no row on the tab, which is correct — the tab is driven by species comments).

**Purity (NFR-07):** no `Date.now()` / `new Date()` anywhere; date strings are compared
lexically (ISO `YYYY-MM-DD`), never parsed to `Date` for ordering.

### 2.3 Where it runs and memoization

The matcher runs in the **`NamedBirds` container** (`frontend/src/components/NamedBirds.tsx`),
alongside the existing eBird-backup load, so it runs **once per ML load**, not per row:

- Add a second async load in the existing `autoLoad` effect (or a sibling effect keyed
  on `filesVersion`): `const ml = await loadMLExport()` → store `ml?.rows ?? null` in
  state (`mlRows`).
- `const mediaByBird = useMemo(() => computeNamedBirdMedia(mlRows), [mlRows])` — a
  single memoized `Map`, identity-stable until the ML file changes (`filesVersion`
  already drives re-load). Pure inside the memo (NFR-07 satisfied — no impure call).
- Pass `mediaByBird` into `<NamedBirdsTable>`; the table forwards each row's slice
  `mediaByBird.get(bird.key) ?? []` into `<NamedBirdRow>`.

ML is **optional** and orthogonal to the eBird backup: the tab must render normally
when ML is absent (FR-17, NFR-09). So the ML load failure/absence sets `mlRows = null`
and the tab behaves exactly as today (no media section anywhere) — it never blocks or
errors the named-birds computation, which is driven by the eBird backup.

---

## 3. Components

### 3.1 `frontend/src/components/NamedBirdMedia.tsx` (new)

The per-individual media section. Rendered by `NamedBirdRow` **below the map block**.

**Props:**
```ts
interface NamedBirdMediaProps {
  birdName: string                 // for the section header + iframe titles
  assets: NamedBirdAsset[]         // this individual's matched assets (may be empty)
  open: boolean                    // parent's expanded state — gates all embed mounting (FR-11)
  initialCount?: number            // bounded initial batch; default 6 (OQ-02 default)
  batchSize?: number               // how many more "Show more" reveals; default = initialCount
}
```
- `initialCount` / `batchSize` are **props with defaults** so the Designer can tune the
  cap/paging without touching component internals (OQ-02).

**Behavior:**
- **Empty state (FR-16):** `assets.length === 0` → a muted one-line
  "No media matched to this bird" using `--sr-text-muted` (AA in both themes,
  NFR-05). Not an empty gap, not an error.
- **Not open (FR-11/FR-13):** when `open` is false the component renders nothing that
  mounts an embed. Because the tab is single-open and the parent only renders the
  expanded body when `open`, this composes with the accordion: collapsing (or opening
  another individual) unmounts the whole section → releases every iframe (FR-13, QA-10).
  A `revealCount` state (initialized to `initialCount`) resets whenever `open`
  transitions false→true (effect keyed on `open`) so re-expanding starts from the
  bounded batch, never accumulating.
- **Bounded render (FR-12, NFR-01):** render only `assets.slice(0, revealCount)` as
  live embed items. If `assets.length > revealCount`, render a keyboard-operable
  "Show more" `<button>` (`.sr-touch-target`, accessible name e.g.
  "Show N more media of {name}") that does `setRevealCount(c => c + batchSize)`.
  A count line ("Showing X of Y") gives context.
- **Layout:** reuse `.sr-media-grid` (3-up, collapses to 1 column ≤640 — already in
  `globals.css`, NFR-06) and `.sr-media-item`. No inline breakpoint styles.
- Header: a small uppercase label consistent with the map block's
  "Where {name} has been seen" (e.g. a `Play`/`Image` lucide icon +
  "Media of {name}"), `--sr-text-muted`.

### 3.2 `MediaEmbed` — one item (component within `NamedBirdMedia.tsx`, or a sibling file)

Renders a single asset: the embed iframe (or its fallback) + the date + checklist
labels. Props: `{ asset: NamedBirdAsset, birdName: string }`.

**Lazy-mount mechanism (NFR-01, on-demand):**
- The iframe is mounted only after the item scrolls into view, via an
  **IntersectionObserver** on the item's wrapper (`useRef` + one observer per item, or
  a shared observer — a small `useInView` hook is fine). Until in-view, render the
  placeholder frame (same footprint, so no layout shift). This bounds the number of
  **simultaneously live** players even within the revealed batch — combined with the
  `open`-gate and the `revealCount` cap, concurrent players stay bounded (QA-08, QA-09).
- Keep `loading="lazy"` on the iframe as a second-line native deferral, mirroring the
  Species Detail precedent.

**Offline / failed-load degradation (FR-14/FR-15, NFR-04) — the gap this feature closes:**
The Species Detail precedent has **no** degradation. This feature adds it in a
reusable shape:
- **Online detection (no impure render read, NFR-07):** an `online` boolean from a
  small hook (`useOnline` — reuse the exact SnowMap.tsx pattern: `useState(() =>
  typeof navigator !== 'undefined' && navigator.onLine !== false)` initializer +
  a `useEffect` that adds `window` `'online'`/`'offline'` listeners and cleans them up).
  `navigator.onLine` is read in the state initializer and in event handlers — never in
  the render body or a memo.
- **Failed-load detection:** the iframe's `onError` sets a per-item `failed` flag.
  (`onError` on cross-origin iframes is not fully reliable across engines, so it is a
  best-effort belt; the offline signal is the primary trigger, and a short
  mount-timeout fallback — a `setTimeout` armed in a `useEffect`, cleared on `onLoad` —
  can flip to the fallback if neither `onLoad` nor `onError` fires. `Date.now()` is not
  needed; a plain timer id is fine and the timer lives in an effect, not render.)
- **Fallback render:** when `!online || failed`, render the **placeholder** instead of
  the iframe — same box footprint, a muted "Media unavailable offline — open on
  Macaulay Library" line, plus an `<OutboundLink href={mlAssetUrl(asset.catalogId)}>`
  ("View on Macaulay Library"). `mlAssetUrl` already `encodeURIComponent`-wraps the
  catalog id; the id is parser-guaranteed `^\d+$`. When the app comes back online the
  `online` flip re-renders and (if in view) the iframe mounts. **Date + checklist are
  always shown, in both the embed and fallback states** (FR-15).

**Media-type handling (FR-07, QA-05):** photo/audio/video use the **same** embed URL
`https://macaulaylibrary.org/asset/<catalogId>/embed` — only the `format` label and
player height vary. `format` drives:
- the type label ("Photo" / "Audio" / "Video"),
- the iframe height class (see §3.3 — audio can be shorter; video/photo taller). The
  Designer sets exact sizes; the component maps `format → height class`.

**Labels (FR-08/FR-09):**
- Date: `formatDate(asset.date)` (honors the Settings date-format preference via the
  module `currentPref`; `formatDate` is safe on `''` → returns `''`, in which case the
  date line is omitted).
- Checklist: `<ChecklistLink submissionId={asset.checklistId} compact? />`. The shared
  component already guards `^S\d+$` and renders nothing/plain when the id is
  absent/invalid — so FR-09 (omit rather than 404) is satisfied for free.
- iframe `title` (NFR-05): descriptive, e.g. `` `${format} of ${birdName} (${date})` ``.

**Safe rendering (FR-18, QA-20):** the component renders **its own** labels
(date, "Photo"/"Audio"/"Video", checklist link) — it does **not** echo the raw
caption/mediaNotes text. If a future iteration surfaces asset caption text, it MUST go
through `<CommentText>` (escaped); no `dangerouslySetInnerHTML` on asset-derived text.
Catalog id is `^\d+$`-guaranteed and `encodeURIComponent`-wrapped (by `mlAssetUrl` and
in the iframe `src`); submission id goes through `ChecklistLink`'s guard.

### 3.3 CSS (add to `frontend/src/globals.css`, tokens only)

- Reuse `.sr-media-grid` / `.sr-media-item` / `.sr-media-iframe` (already
  responsive: `.sr-media-grid` → 1 column ≤640; `.sr-media-iframe` → `height:360px`
  ≤640). `.sr-media-iframe` is already `width:100%` + `max-width` implied — responsive
  from 320px (NFR-06).
- If per-`format` heights are wanted (e.g. a shorter audio player, per the brief's
  "audio+video use medium"), add small modifier classes (`.sr-media-iframe--audio`
  etc.) rather than inline heights — colors/tokens only, no hardcoded hex. **The
  Designer specifies the exact sizes**; small 320×510 / medium 640×510 / large
  800×550 from the brief are the starting reference, expressed responsively
  (`max-width:100%`, never a fixed 640px on a 320px phone).
- The placeholder/fallback frame reuses the same footprint (a `.sr-media-fallback`
  block sized to match) so switching embed↔fallback causes no layout shift.

### 3.4 Entry-chunk / maps-lazy (NFR-02, QA-15)

`NamedBirdMedia` renders **an iframe** — it does **not** import `SightingsMap`,
`SnowMap`, or `react-map-gl/maplibre`, so it adds no maplibre pull. `NamedBirdRow`
already imports `SightingsMap` **lazily** (`lazy(() => import('./SightingsMap'))`);
`NamedBirdMedia` is a plain static import into `NamedBirdRow` — light, no lazy
boundary needed. `entryChunk.test.ts` stays green (the new file appears in App's
static graph but pulls no forbidden module). **Deliverable:** confirm a fresh
`npm run build` still shows `vendor-maplibre` absent from `dist/index.html`
modulepreload (QA-15), and — following the CLAUDE.md convention — extend
`entryChunk.test.ts` only if a new off-entry-chunk asset were introduced (none is here).

---

## 4. Integration — threading the matched assets

The `NamedBird` type carries **no** catalog ids today, so assets are threaded, not
attached to the type. Flow:

```
NamedBirds (container)
  ├─ loadMLExport() → mlRows: MLExportRow[] | null            [existing cache]
  ├─ mediaByBird = useMemo(computeNamedBirdMedia(mlRows))     [Map<key, asset[]>]
  └─ <NamedBirdsTable ... mediaByBird={mediaByBird} />
        └─ for each bird:
             <NamedBirdRow ... media={mediaByBird.get(bird.key) ?? []} />
                  └─ (below the map block) <NamedBirdMedia birdName={bird.name}
                        assets={media} open={open} />
```

- **`NamedBirds.tsx`:** add ML load + `mediaByBird` memo (§2.3); pass `mediaByBird`
  into the table. No change to the eBird-backup path.
- **`NamedBirdsTable.tsx`:** add a `mediaByBird?: Map<string, NamedBirdAsset[]>` prop
  (optional). For each row pass `media={mediaByBird?.get(bird.key) ?? []}`. **Species
  Detail's** use of `NamedBirdsTable` (the map-less "Named Individuals" section) simply
  **omits** `mediaByBird` → every row gets `[]` → `NamedBirdMedia` renders nothing
  there. This keeps Species Detail's section media-less (out of scope; NFR-09, QA-13).
  A cleaner gate: only render `<NamedBirdMedia>` when `showMap` is true (the Named
  Birds tab flag), mirroring how the per-row map is Named-Birds-tab-only. Recommended:
  gate on `showMap` **and** pass `media` — so the media section, like the map, is a
  Named-Birds-tab-only surface, and Species Detail is untouched with zero risk.
- **`NamedBirdRow.tsx`:** accept `media: NamedBirdAsset[]` (default `[]`). After the
  existing map block (`{showMap && cardMarkers.length > 0 && (...map...)}`), render:
  ```tsx
  {showMap && (
    <NamedBirdMedia birdName={bird.name} assets={media} open={open} />
  )}
  ```
  Placement is **within the expanded body**, after the map, so FR-06 holds whether or
  not the individual has coordinates: when there is no map (`cardMarkers.length === 0`)
  the media still renders in the same position (the map block is conditional, the media
  block is not — it renders its own empty state if `assets` is empty).

- **Keying (FR-03):** the lookup key is `bird.key`, which is exactly the key
  `computeNamedBirdMedia` buckets on — guaranteeing name+species scoping and no
  cross-attribution (QA-04). This is the single load-bearing correctness pin; a
  unit test asserts the two key formulas stay identical.

- **Empty state (FR-16) vs no-ML (FR-17):** if ML is loaded but this individual has
  no matched assets → `assets = []` → `NamedBirdMedia` shows the muted "No media
  matched" line. If ML is **not loaded** → `mediaByBird` is empty for everyone →
  every individual gets `[]`. To distinguish "looked and found none" (show empty
  state) from "no ML at all" (show nothing), thread a boolean `hasML` (derived from
  `mlRows !== null`) down to `NamedBirdMedia`: `hasML && assets.length === 0` → empty
  state; `!hasML` → render nothing (FR-17, QA-13). `hasML` rides alongside
  `mediaByBird` from the container.

---

## 5. CSP / webview verification result (OQ-01) — REQUIRED DELIVERABLE

**Result: the external `macaulaylibrary.org` embed iframe is already permitted in all
three shipped webviews with NO config change required.** Verified against the actual
config files:

| Surface | File | Finding |
|---|---|---|
| **CSP** | `src-tauri/tauri.conf.json` | `app.security.csp` is **`null`** (confirmed, line 24). No config-level CSP → no `frame-src`/`connect-src` restriction on any platform. The Species Detail ML embed already relies on this and ships on desktop today (direct precedent). |
| **Desktop capabilities** | `src-tauri/capabilities/default.json`, `desktop.json` | No webview **navigation** or **asset-load** restriction. Grants are `core:*`, `opener`, `http` (`http:allow-fetch` for `https://**`), `os`, `clipboard-manager:allow-write-text`, and `fs:*` scoped to `$APPLOCALDATA/**`. The `http:allow-fetch` grant governs the Tauri **HTTP plugin** (Rust-side `fetch`), **not** an in-DOM `<iframe>` load — an iframe embed is ordinary WKWebView/WebView2 subframe navigation, which is unrestricted because CSP is null and no `dangerousRemoteDomainIpcAccess`/nav-scope is set. Nothing to change. |
| **iOS/iPadOS capabilities** | `src-tauri/capabilities/mobile.json` | iOS-only grants are `geolocation:*` + `dialog:allow-open`. No webview restriction; the same null-CSP applies. Nothing to change. |
| **iOS build overlay** | `src-tauri/tauri.ios.conf.json` | Sets only `identifier` (`com.dtgibson.snowraven`). No CSP, no navigation policy override. Nothing to change. |
| **iOS ATS** | `src-tauri/Info.ios.plist` | **No ATS exceptions**, by design — the file's own comment states "no ATS exceptions (every provider is HTTPS)". `macaulaylibrary.org` is **HTTPS**, so it satisfies the ATS default (which requires TLS ≥1.2, forward secrecy — the Macaulay Library CDN meets this; it's a Cornell/eBird-grade host, same origin already embedded on desktop). **No `NSAppTransportSecurity` dictionary is needed** and none should be added (adding a blanket `NSAllowsArbitraryLoads` would weaken the app and trip App Store review). |

**Confirmation on iOS specifically (the question the PRD flags):** the Species Detail
embed precedent proves the webview allows the iframe on **desktop**. For **iOS/iPadOS**
the same holds because (a) the CSP is `null` app-wide (one config, all platforms), (b)
no mobile capability restricts webview navigation, (c) the iOS overlay adds no policy,
and (d) ATS is satisfied by the HTTPS origin with no exception required. **No CSP,
capability, `tauri.ios.conf.json`, or `Info.ios.plist` change is required for this
feature.**

**Standing note if a CSP is ever introduced later** (not by this feature): a future
CSP would need `frame-src https://macaulaylibrary.org` (and its embed player may pull
sub-resources — media/CDN hosts — from `*.macaulaylibrary.org` / eBird CDN, so a
`frame-src`/`child-src` allowance plus whatever the player itself fetches). Since CSP
is null today, this is informational only and out of scope for this run. If a CSP is
added in a later feature, both the Species Detail and Named Birds embeds must be
covered together.

---

## 6. File-by-file change plan

### New files

| File | Purpose | Unit-tested |
|---|---|---|
| `frontend/src/lib/namedBirdMedia.ts` | The pure matcher `computeNamedBirdMedia(rows)` + `NamedBirdAsset` type. | **Yes — the load-bearing test.** |
| `frontend/src/lib/namedBirdMedia.test.ts` | Matcher tests (see §7 below). | — |
| `frontend/src/components/NamedBirdMedia.tsx` | The per-individual media section: bounded batch, "Show more", lazy-mount, offline/failed fallback, empty state, `MediaEmbed` item. | Component test (jsdom) — see §7. |
| `frontend/src/components/NamedBirdMedia.test.tsx` | Component behavior (empty state, bounded count, fallback, safe ids). Uses the per-file `// @vitest-environment jsdom` docblock. | — |
| `frontend/src/lib/useOnline.ts` *(optional)* | Extract the SnowMap.tsx `navigator.onLine` + `online`/`offline` listener pattern into a shared hook, if not already extracted. If a shared hook already exists, reuse it instead of adding one. | Small hook test optional. |

### Modified files

| File | Change |
|---|---|
| `frontend/src/components/NamedBirds.tsx` | Load `loadMLExport()` in the existing `filesVersion`-keyed effect; hold `mlRows: MLExportRow[] \| null`; `mediaByBird = useMemo(computeNamedBirdMedia(mlRows))`; pass `mediaByBird` + `hasML` to `<NamedBirdsTable>`. ML load is optional and never blocks/erroring the named-birds computation. |
| `frontend/src/components/NamedBirdsTable.tsx` | Add optional props `mediaByBird?: Map<string, NamedBirdAsset[]>` and `hasML?: boolean`; forward `media={mediaByBird?.get(bird.key) ?? []}` and `hasML` to each `<NamedBirdRow>`. Species Detail's caller omits both → media-less (unchanged). |
| `frontend/src/components/NamedBirdRow.tsx` | Accept `media?: NamedBirdAsset[]` (default `[]`) and `hasML?: boolean`; render `<NamedBirdMedia birdName={bird.name} assets={media} open={open} hasML={hasML} />` **after** the map block, gated on `showMap` (Named-Birds-tab-only, like the map). Import is a plain static import (light iframe — no lazy boundary, no maplibre pull). |
| `frontend/src/globals.css` | Add per-`format` iframe height modifier classes and a `.sr-media-fallback` block if needed (§3.3). Tokens only, no hardcoded colors. The Designer sets exact sizes. |
| `frontend/src/lib/entryChunk.test.ts` | Only if the new component/asset changes the static graph in a way worth guarding — likely a no-op here (no new off-entry-chunk asset). Re-run to confirm green. |
| `PRIVACY_POLICY.md` | **FR-19 (required this run):** the "Embedded Bird Media and Link Icons" → Macaulay Library embeds bullet must name the **Named Birds tab** as a surface that embeds `macaulaylibrary.org` media (today it names only Species Detail). |
| `docs/HELP.md` | **FR-20:** describe the new Named Birds media capability. |
| `README.md` | **FR-20:** reflect the new capability in the feature list. |
| `website/` (`index.html` / copy, per docs-sync) | **FR-20:** describe the capability (informative voice, per the website convention). Version pill stays in lockstep on the app version bump. |
| `frontend/package.json` + `src-tauri/tauri.conf.json` | Version bump (both, same version — CLAUDE.md); `CHANGELOG.md` entry. (Engineer/closeout, not a design change, but noted so it isn't dropped.) |

**No changes to:** `parseMLExport.ts` (all needed fields already present),
`namedBirds.ts` (`parseNameTags` reused as-is — no vocabulary change, per scope),
`mlExportCache.ts` (reused as-is), any backend file (no route), any Tauri config
(OQ-01: no CSP/capability/ATS change), Species Detail (its Named Individuals section
stays media-less).

---

## 7. Unit-test plan (the pure matcher especially)

**`namedBirdMedia.test.ts` (the load-bearing tests, covering QA-02/03/04 + OQ-03/04):**
- A row whose `caption` contains `[name:X]` → asset appears under X's key. (QA-02)
- A row whose `mediaNotes` contains `[name:X]` → asset appears under X. (QA-02)
- A row whose name tag appears **only** in `observationDetails` → asset appears under
  **no** key. (QA-02 — the `observationDetails` exclusion, the crux.)
- A row with no `[name:…]` in caption+mediaNotes → matches nothing. (QA-03)
- `[name:Pete]` on species A does **not** land under a `[name:Pete]` key of species B
  — assert the two keys differ and buckets don't merge. (QA-04, species scoping.)
- Case-insensitivity: `[NAME:pete]` and `[name:Pete]` land in the same key. (FR-03)
- Ordering: a bird's assets are newest-date-first, `catalogId` tie-break. (OQ-03)
- Dedupe: a row that tags the same name twice (or two rows same catalogId) → one asset
  per catalogId per bird.
- `null`/empty rows → empty `Map` (FR-17).
- **Parity guard:** a dedicated assertion that the key produced by
  `computeNamedBirdMedia` equals the key produced by `computeNamedBirds` for the same
  (name, species) — locking the join so a future refactor of either can't drift them
  apart (the FR-03/QA-01 correctness pin). Reuse a shared key helper if extracted.

**`NamedBirdMedia.test.tsx` (jsdom):**
- Empty assets + `hasML` → renders the muted empty-state text (FR-16, QA-12).
- `!hasML` → renders nothing (FR-17, QA-13).
- `assets.length > initialCount` → only `initialCount` items rendered; "Show more"
  present, keyboard-operable, accessible name; clicking reveals `batchSize` more.
  (FR-12, QA-09.)
- `open === false` → no embed mounted (FR-11, QA-08). (Assert no iframe in the tree.)
- Fallback: simulate offline (`navigator.onLine === false` / dispatch `offline`) →
  each item shows the placeholder + `mlAssetUrl` `<OutboundLink>` + date +
  `ChecklistLink`, no iframe. (FR-14/15, QA-11.)
- Safe ids: an asset with an invalid `checklistId` renders no checklist link (via
  `ChecklistLink`'s guard); the `mlAssetUrl` for a `^\d+$` id is `encodeURIComponent`-
  wrapped. (FR-18, QA-20.) Follow the chart-file `afterAll` teardown convention only if
  the file mounts recharts (it does not — iframes only).

---

## 8. Risks / open questions for the Designer

1. **OQ-02 — browse affordance & cap (Designer owns).** The mechanism is built as
   props (`initialCount` default 6, `batchSize`); the Designer decides the exact
   initial count, whether "Show more" batches or a different affordance (paging /
   lazy-on-scroll), and the media grid density. IntersectionObserver already bounds
   *live* players within a batch, so the cap is primarily a UX/scannability choice, not
   a hard performance ceiling. **Recommendation:** keep the small initial batch + "Show
   more" (the PRD default) — simplest, keyboard-friendly, composes with the accordion.
2. **Per-`format` player sizing.** Brief suggests small 320×510 / medium 640×510 /
   large 800×550, audio+video = medium. Inside a 3-up grid at ≤640 the grid is already
   1-column; the Designer confirms the per-type heights and whether photos get a taller
   frame than audio. Sizes must be responsive (`max-width:100%`), never a fixed px width
   that overflows a 320px phone.
3. **Header wording / iconography.** "Media of {name}" vs another label, and which
   lucide icon, to sit consistently beside the existing "Where {name} has been seen"
   map header.
4. **Failed-load detection reliability (residual, Engineer-facing).** Cross-origin
   iframe `onError` is best-effort; the offline signal is the primary trigger, with an
   optional mount-timeout belt. The Designer should be aware the fallback is guaranteed
   for the **offline** case and best-effort for a **loaded-but-broken** embed — the
   metadata (date + checklist + link-out) is always present regardless, so the item is
   never useless.
5. **Ordering visibility.** Newest-first is the default (OQ-03); the Designer may
   surface it (e.g. a subtle date on each item, already required by FR-08) but sorting
   controls are out of scope for v1.

No residual **Architect** blockers: matching, keying, data flow, and the CSP/webview
question are all resolved. The feature is buildable as specified with no backend,
schema, or Tauri-config change.
