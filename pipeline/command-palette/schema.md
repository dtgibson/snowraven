# Schema — Command Palette

**Feature:** command-palette
**Date:** 2026-09-05
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md

---

## Path

**Frontend Only — no data layer changes required.**

No table, column, relationship, migration, backend route, storage-seam document,
persisted setting, `CACHED_GET_PATHS` entry or `clearDerived.ts` row. The Engineer
proceeds straight to UI work; there is no migration to write and none to run.

### Confirmation

The classification was checked against all 58 functional and 11 non-functional
requirements, with attention to the one thing that would break it: **this project's
data layer includes the `storage` seam**, so a remembered query, a recent-commands
list, or a "palette enabled" preference would make this an incremental change
against `data/settings.json`. **No such requirement exists**, and the PRD forecloses
it in five places:

- **FR-13** — "the query input shall be empty on every open. The palette shall not
  remember the previous query."
- **FR-22** — "shall make no network call and shall create no persisted document,
  cache, or file of its own."
- **FR-55** — "`PRIVACY_POLICY.md` shall require no edit; the change shall add no
  `clearDerived.ts` row, no `CACHED_GET_PATHS` entry, and no persisted document."
- **NFR-06** — "shall persist nothing."
- **Out of Scope** — "Persisting anything about the palette (last query, recent
  destinations, a 'palette enabled' preference). The palette has no settings surface."

**QA-53** asserts the absence: `PRIVACY_POLICY.md` unchanged, `cacheInventory.test.ts`
unchanged, no new persisted document.

Two adjacent persisted documents are **read through code the palette does not own**
and must keep behaving exactly as today:

- `sr-tab-layout` (localStorage, via `loadTabLayout()` in `lib/tabLayout.ts`) — the
  saved order and hidden set. The palette never reads or writes it; it consumes
  `App.tsx`'s already-derived `navItems` (D-05).
- `data/metadata.json` (the `storage` seam, via `storage.getFilesStatus()`) — read-only,
  to distinguish FR-33 from FR-35. Read, never written.

**State model for the feature itself:** one boolean plus two refs in `App.tsx`, one
module-scope memo slot in a lazy chunk (D-01), and component state inside the overlay
for the lifetime of one open. No store, no context, no reducer, no new epoch module.

---

## Existing Data Used by This Feature

All read-only. The feature adds no query, no fetch and no field. Listed so the
Engineer does not re-derive what is already on hand.

### `NavItem[]` (in-memory, already built in `App.tsx`)
- **Built by:** `App.tsx:716-724`, `useMemo` over `visibleTabs(tabLayout)` mapped to
  `{ id, label: TAB_LABELS[tab], icon: TAB_ICONS[tab] }`, then
  `items.push({ id: 'settings', label: 'Settings', icon: TAB_ICONS['settings'] })`.
- **Fields used:** all three, unchanged.
- **How used:** handed to the palette as its complete destination list. This is
  literally FR-16's three sources, already composed, already ordered, already filtered.
  See **D-05**.
- **Note:** `'settings'` is not a `ConfigurableTab`; it exists only in the `Tab` union
  and is appended by every nav renderer itself. `TAB_ICONS` is keyed by `Tab`, so it
  does carry a `'settings'` glyph (`lib/tabIcons.tsx:93`). `TAB_LABELS` is keyed by
  `ConfigurableTab` and does **not**.

### `LoadedEbird.observations: ObservationEntry[]` (in-memory, shared parse)
- **Loaded by:** `loadEbirdObservations()` in `lib/observationsCache.ts` — a
  parameterless, module-scope, single-slot memo with in-flight dedupe, an off-thread
  parse, and a `generation` guard. Returns `Promise<LoadedEbird | null>`;
  **structurally cannot reject**; `null` covers all three failure kinds.
- **Fields used:** `commonName` and `scientificName`. **Nothing else.** The other 20
  fields on `ObservationEntry` are untouched.
- **How used:** the sole source of the species index (**D-01**).
- **Invalidation, and this is load-bearing:** the cache has no key. It is cleared
  explicitly by `clearEbirdObservationsCache()`, called from exactly three places —
  `Settings.tsx:1917` (upload/replace), `Settings.tsx:1964` (clear), and
  `icloudSync.ts:1530` (synced arrival). **In all three the clear runs BEFORE the
  files epoch is bumped** (`Settings.tsx:1922`, `:1976`, and the controller's
  `notifyFiles()`). That ordering is what makes FR-31 work with a plain
  epoch-keyed re-load and nothing else. See **D-01** and **R-01**.

### `FilesStatus` (the `storage` seam, read-only)
- **Read by:** `storage.getFilesStatus(): Promise<FilesStatus>`, where
  `FilesStatus = { ebird: FileMetadata | null; ml: FileMetadata | null }`.
- **Field used:** `status.ebird` truthiness only. There is no boolean and no size field;
  "a backup is stored" is `status.ebird !== null`.
- **How used:** distinguishes FR-33 (no backup saved) from FR-35 (stored but unloadable).
  This is the question `weatherBacklogLoad.ts` exists to ask in the right order.
- **Caveat carried from that module:** on web/Pi, `WebStorage.getFilesStatus` swallows a
  non-ok response into `{ebird: null, ml: null}` but **can still reject** on an
  unreachable backend. A rejection must land on FR-35, never on FR-33. See **D-06**.

### Persisted documents — all untouched
| Document | Read | Written |
|---|---|---|
| `data/settings.json` | no | **no** |
| `data/api-keys.json` | no | **no** |
| `data/metadata.json` | yes (`getFilesStatus`) | **no** |
| `data/ebird-backup.csv` | indirectly, through the shared parse | **no** |
| `data/replay.json`, the three derived caches | no | **no** |
| `sr-tab-layout` (localStorage) | indirectly, through `navItems` | **no** |

---

## Structural Decisions

No schema changes, but the feature has real structural questions. Each decision is
binding on the Engineer and is tied to the PRD IDs it satisfies.

---

### D-01 — The species index: derived in the lazy chunk, memoized on the parse's identity, released by a `WeakRef`

**Where it comes from.** `loadEbirdObservations()` and nothing else. No network call,
no second CSV walk, no new file. The palette may start that parse if nothing has, and
must never block on it (**FR-32**).

**Where it lives.** A new module, `frontend/src/lib/speciesIndex.ts`, **off** the entry
graph (NFR-01 names it). Its only import is a type-only `import type { ObservationEntry }
from '../types'`, which is erased and is invisible to `entryChunk.test.ts`'s walker.

```ts
export interface SpeciesIndexEntry { name: string; sciName: string }

/** Pure. One pass, de-duped, sorted. Unit-testable with no component (NFR-11). */
export function buildSpeciesIndex(observations: ObservationEntry[]): SpeciesIndexEntry[]
```

**Build rules, each binding:**

1. **One pass**, accumulating into a **`Map<string, SpeciesIndexEntry>`** keyed by
   `commonName`. A `Map`, never an object literal — the keys are CSV-derived external
   strings, and `.claude/rules/security.md` requires `Object.create(null)` or a `Map`
   on the write side (NFR-07, QA-62). First `scientificName` seen per common name wins.
2. **Every distinct name**, including subspecies and other forms and species that
   Species Detail hides at its defaults (**FR-30**). No countability filter, no
   normalization, no `truncateAtFirstParen`.
3. **Sort by `name.toLowerCase()` ascending using `<` / `>`, never `localeCompare`.**
   FR-25 requires the order to be "deterministic and identical on every platform", and
   `localeCompare` is locale- and ICU-version-dependent across the six targets —
   JavaScriptCore with Apple ICU on macOS/iOS/iPadOS, V8 with Chromium ICU on
   Windows/web. Bird names are full of hyphens and apostrophes ("Bay-breasted Warbler",
   "Wilson's Warbler"), which is exactly where those collations diverge. Code-unit
   comparison on the lowercased string is identical everywhere.
4. **Tie-break on the raw `name`** when the lowercased forms are equal, so the output
   depends only on the *set* of pairs and not on their arrival order in the CSV. That
   is the stronger property and the one QA-24's "same order on two consecutive runs"
   should be written against.

**Memoization (NFR-02, QA-58).** A module-scope single slot in the same file, keyed on
the **identity of the `observations` array**, not on the files epoch:

```ts
let memoSource: WeakRef<ObservationEntry[]> | null = null
let memoIndex: SpeciesIndexEntry[] | null = null

export function speciesIndexFor(observations: ObservationEntry[]): SpeciesIndexEntry[] {
  if (memoIndex && memoSource?.deref() === observations) return memoIndex
  memoIndex = buildSpeciesIndex(observations)
  memoSource = new WeakRef(observations)
  return memoIndex
}
```

Four things this settles, each of which was a live alternative:

- **Identity, not epoch.** `loadEbirdObservations` hands back the same `LoadedEbird`
  object for the whole life of its own cache and replaces it only through
  `clearEbirdObservationsCache()`. So identity changes exactly when the parse changes:
  no epoch arithmetic, no stale window, and no way for the index to describe a file
  that is gone.
- **The capacity+1 rule does not apply, and here is why.** `.claude/rules/testing.md`
  (v0.5.85) records that a one-slot memo is defeated by two *alternating* keys. That
  cannot happen here: there is at most one live `observations` array in the process,
  and the previous one is unreachable the moment the parse cache is replaced. Two keys
  cannot alternate. State this in the module, because it is the first thing a reviewer
  will raise.
- **`WeakRef` on the source, strong on the index.** Without it, this module would hold
  a dead `ObservationEntry[]` — tens of MB on a real export — alive after the user
  clears their backup, and there would be no teardown that reaches it (see below). With
  it, the memo retains only the derived index (~1,000 small objects, bounded), the
  source is collectable the instant `observationsCache` drops it, and a collected source
  simply means one rebuild. While the parse cache is warm, `deref()` returns the array,
  so the memo hits under exactly the condition it should.
- **`WeakRef` availability is cleared, by the same check `Object.hasOwn` needed.**
  Safari 14.1 / Chrome 84, comfortably under `minimumSystemVersion: "16.0"`,
  `IPHONEOS_DEPLOYMENT_TARGET = 16.0`, and evergreen WebView2. `.claude/rules/security.md`
  requires that check to be made explicitly at each such crossing; it is made here.

**No `clearDerived.ts` row, and the reason is structural rather than a preference
(FR-55, QA-53).** That registry deletes **documents from the storage seam** — every one
of its four rows ends in a `storage.deleteSetting`. There is nothing on disk here to
delete. `cacheInventory.test.ts` asserts the registry holds exactly four `slot: 'ebird'`
rows and pairs each to an exported production purge; adding a fifth row with no
document would turn that guard red for a store that does not exist. The in-memory
equivalent of a teardown is the `WeakRef` above, which needs no caller discipline and
cannot be forgotten.

**FR-31 — invalidation on a file change.** The palette's species load effect carries
`useFilesEpoch()` in its deps. Because `clearEbirdObservationsCache()` runs *before*
`notifyFilesChanged()` on all three mutation paths, the re-load starts a fresh parse
and `speciesIndexFor` sees a new array identity. Nothing else is required, and nothing
new is wired. **That ordering is not the palette's to enforce** — see **R-01**.

**Satisfies:** FR-22, FR-25, FR-30, FR-31, FR-32, FR-55, NFR-02, NFR-06, NFR-07,
NFR-11, QA-21, QA-24, QA-29, QA-30, QA-53, QA-58, QA-62, QA-66.

---

### D-02 — The match predicate is EXTRACTED and single-sourced, not duplicated and asserted equivalent

FR-23 offers both. **Extract.**

New module `frontend/src/lib/speciesMatch.ts`, importing nothing:

```ts
/** The one copy of the species-picker match predicate (FR-23). */
export function normalizeSpeciesQuery(raw: string): string {
  return raw.trim().toLowerCase()
}

/** `q` is already normalized: callers normalize ONCE per keystroke, not per row (NFR-02). */
export function matchesSpeciesQuery(o: { name: string; sciName?: string }, q: string): boolean {
  return o.name.toLowerCase().includes(q) || (o.sciName ?? '').toLowerCase().includes(q)
}
```

`SpeciesCombobox.tsx`'s `filtered` memo is rewritten to call these two, **behaviour
preserving, byte-equivalent semantics**: same `trim().toLowerCase()`, same OR, same
`?? ''` so a missing scientific name never matches. Do not silently upgrade a shipped
component while extracting from it — the same rule the fullscreen build's D-08 applied
to `useFocusTrap`.

**Why extraction rather than a parity fixture.** This repo's parity-test convention
(`checklistId.parity.test.ts`, `hotspotActivity.parity.test.ts`) exists for
**cross-runtime twins** — TypeScript against Python — that genuinely cannot share code.
These two can. `.claude/rules` says the opposite thing wherever sharing is possible:
"single-sourcing prevents drift" (the 429 mappers), and `pipeline/design-system.md` puts
every species picker through one shared component for exactly this reason. QA-22 then
becomes a table over the **one** function plus a source scan asserting both files import
it, which is strictly stronger than a table comparing two implementations.

**Entry graph:** off it. `SpeciesCombobox` is off (all three call sites are lazy) and the
palette overlay is off. The module imports nothing, so it could ride either half harmlessly.

**NFR-07 / QA-62:** the query reaches only `String.prototype.includes`. No `RegExp` is
constructed anywhere on the query path, and this module is the single file a source scan
has to check.

**Satisfies:** FR-23, NFR-02, NFR-07, NFR-11, QA-22, QA-62, QA-66.

---

### D-03 — Module graph: an entry-safe hotkey hook plus a `lazy()` overlay on the `HelpDocs` pattern — deliberately NOT the iCloud store/controller pattern

**The split.**

| File | Entry graph | Contents |
|---|---|---|
| `lib/usePaletteHotkey.ts` | **ON** | the one keydown listener (D-04). Imports `react` only. |
| `lib/paletteHint.ts` | **ON** | `resolveChordHint()` (D-07). Imports `lib/platform.ts` only, already on the graph. |
| `lib/paletteCopy.ts` | **ON** | every user-facing string (FR-56). Imports nothing. |
| `components/CommandPalette.tsx` | **OFF** | the overlay |
| `lib/speciesIndex.ts` | **OFF** | D-01 |
| `lib/speciesMatch.ts` | **OFF** | D-02 |
| `lib/paletteRows.ts` | **OFF** | the pure row builder (D-08) |
| `lib/paletteSpeciesLoad.ts` | **OFF** | the four-state resolver (D-06) |
| `lib/paletteFocus.ts` | **ON** | `restoreOpenerFocus()` (D-05). Imports nothing. |

`paletteCopy.ts` rides the entry chunk **as one module, not two.** The
`countabilityCopy.ts` precedent — split out of `exoticCopy.ts` so an entry-graph
component would not drag 3.7 KB for one string — does not bind here: the palette's
whole copy set is a handful of short sentences, well under 1 KB, and splitting it would
put the palette's strings in two files and defeat FR-56's entire purpose (one module
that rides the repo's em-dash and agreement sweeps).

**`EBIRD_BACKUP_LOAD_ERROR` is imported directly from `components/setupCopy.tsx` by the
overlay and is NOT re-exported through `paletteCopy.ts`.** FR-35 requires it verbatim,
and a second name for one string would break `honestLoadFailures.test.tsx`'s
delivery-versus-content split, which is the whole reason that constant lives where it does.

**The lazy shape is `HelpDocs`, not iCloud.** In `App.tsx`, beside the seven existing
thunks:

```tsx
const importCommandPalette = () => import('./components/CommandPalette')
const CommandPalette = lazy(() => importCommandPalette().then(m => ({ default: m.CommandPalette })))
...
{paletteOpen && (
  <Suspense fallback={null}>
    <CommandPalette ... />
  </Suspense>
)}
```

**Why not the `icloudState` / `icloudSync` store-plus-installed-actions pattern.** That
pattern exists to solve a problem this feature does not have: a native controller with
**cross-cutting readers and no single React owner**, where `Settings.tsx` must hold a
stable action reference before the controller has loaded. The palette has exactly one
owner (`App.tsx`), one render site, and three prop consumers — the same depth `onSelect`
is already threaded through `TabNav`. An actions slot and an external store would add a
module and an indirection to buy nothing, and the repo already ships the correct
precedent three lines away in the same file.

**The idle prefetch is what makes FR-20 true on the FIRST invoke, and it is the single
easiest thing to miss.** `Suspense fallback={null}` means a cold chord press renders
*nothing* until the chunk lands. Add one line to the existing `warm()` function
(`App.tsx:448-459`), **first in the list**, because the palette is the only chunk
reachable from a global chord at any moment while every other needs a deliberate tab
switch:

```ts
void importCommandPalette().catch(() => {})
```

`warm` runs on `requestIdleCallback` with a 3,000 ms timeout, falling back to
`setTimeout(warm, 1500)`. It is ungated, so it runs on every platform. First paint is
unaffected: the chunk is fetched after paint, during idle.

**`entryChunk.test.ts` assertions (QA-57), in that file's established paired form** —
every negative gets a positive that guards it:

```ts
// negatives
expect(has('components/CommandPalette.tsx')).toBe(false)
expect(has('lib/speciesIndex.ts')).toBe(false)
expect(has('lib/speciesMatch.ts')).toBe(false)
expect(has('lib/paletteRows.ts')).toBe(false)
expect(has('lib/paletteSpeciesLoad.ts')).toBe(false)
expect(has('components/SpeciesCombobox.tsx')).toBe(false)
// NOTE: NO App-level assertion for BirdName. See the correction below.

// positives — guard the guard
expect(has('lib/usePaletteHotkey.ts')).toBe(true)
expect(has('lib/paletteCopy.ts')).toBe(true)
expect(has('lib/paletteHint.ts')).toBe(true)
expect(has('lib/paletteFocus.ts')).toBe(true)

// the dynamic edge the walker cannot see (the file's one source-text form)
expect(appSrc).toContain("import('./components/CommandPalette')")

// the subtree really does reach what the negatives exclude
const pal = closureFrom(resolve(SRC, 'components/CommandPalette.tsx'))
expect(hasIn(pal.files, 'lib/speciesIndex.ts')).toBe(true)
expect(hasIn(pal.files, 'lib/speciesMatch.ts')).toBe(true)
expect(pal.files.size).toBeGreaterThan(5)
```

Note `has(...)` is a **path-suffix match on resolved on-disk paths**, not a bundler
module id and not a source-text scan.

**PRD CORRECTION — `BirdName` is already on the entry graph, and NFR-01 / QA-57 cannot be
written as stated.** The strategic brief's Key Decision 8 says "`SpeciesCombobox` and
`<BirdName>` are off the entry graph today (all their consumers are lazy)", and NFR-01
carries it forward. **That is true of `SpeciesCombobox` and false of `BirdName`**, which is
statically reachable from `App.tsx` by **three independent paths**, none of them removable
by this feature:

| # | Chain |
|---|---|
| 1 | `App.tsx:29` → `components/NamedBirds.tsx:20` |
| 2 | `App.tsx` (`LifeList`) → `components/LifeList.tsx:16` → `components/LifeListTable.tsx:6` |
| 3 | `App.tsx` (`BreedingCodeList`) → `components/BreedingCodeList.tsx:12` → `components/BreedingCodeTable.tsx:5` |

`SpeciesCombobox` really is off it: its only three importers are `Calendar`,
`SpeciesDetail` and `MapExplorer`, all lazy.

**So `expect(has('components/BirdName.tsx')).toBe(false)` would go RED on arrival**, and the
tempting repair is to edit the assertion — which `entryChunk.test.ts`'s own header names as
*the* failure mode ("Making it pass by editing it is the failure mode"). Do neither. The
palette's real obligation is **not to add a fourth edge**, and FR-27 already forbids the
only way it could. Write the honest assertion instead, on the palette's own subtree:

```ts
expect(hasIn(pal.files, 'components/BirdName.tsx')).toBe(false)
expect(hasIn(pal.files, 'components/SpeciesCombobox.tsx')).toBe(false)
```

paired with QA-26's source scan (the palette's files contain no `BirdName` import and its
rendered listbox contains no `<a href>` and no nested `<button>`). That pair states exactly
what this feature controls and is not satisfiable by a chain the feature did not create.
**Do not add the App-level negative later as if it were an oversight**; moving `BirdName`
off the entry graph means moving `NamedBirds`, `LifeListTable` and `BreedingCodeTable` off
it, which is a separate build and belongs on the ROADMAP, not in this one.

**Satisfies:** FR-20, FR-56, NFR-01, NFR-10, QA-20, QA-54, QA-57, QA-65.

---

### D-04 — Escape and the chord: ONE always-armed listener, in the CAPTURE phase at `window`

**The problem, restated exactly.** The app has eleven `document` keydown listeners.
Exactly one is capture phase (`SharePopup.tsx:142`, with `stopPropagation()`); the other
ten are bubble. **There is not a single `window` keydown listener in the app.** So:

- A bubble-phase listener cannot beat `SharePopup`.
- A **capture**-phase listener on `document` fires in **registration order** against
  `SharePopup`'s, and `SharePopup` registers first whenever its popup was already open
  when the palette opened. FR-49's own note says this must not be left to registration
  order — and QA-47 tests precisely that case.

**The decision: bind at `window`, capture phase.** `Window` is the root of the event
propagation path (`window → document → html → … → target`), so a capture listener there
runs **before every `document` listener of either phase, by the propagation path rather
than by registration order.** That is deterministic by specification, not by experiment,
and it is the property FR-49 asks for.

**One listener, always armed**, in `lib/usePaletteHotkey.ts`. Bound once with `[]` deps;
`open` and the callbacks are read through refs so the listener is never re-registered and
no press can fall into a re-bind window.

```
if (e.repeat) return
if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
  e.preventDefault()          // FR-02: the web/Pi build must not hand the chord to the host
  e.stopPropagation()         // FR-51: nothing beneath even sees the press
  toggleRef.current()         // FR-04: a second press closes through the same close path
  return
}
if (e.key === 'Escape' && openRef.current) {
  e.preventDefault()
  e.stopImmediatePropagation()
  closeRef.current()
  return
}
return                        // untouched
```

Five points that are binding rather than incidental:

- **`e.key`, never `e.code`.** `e.code === 'KeyK'` fires on the physical K position,
  which is a different letter on AZERTY and Dvorak. The user presses the letter they see.
- **`!e.altKey`** so Option/Alt+Cmd+K stays available to the platform.
- **`e.repeat` guard**, or a held chord toggles the palette repeatedly.
- **`stopImmediatePropagation()` on Escape, not `stopPropagation()`.** The latter stops
  other *nodes*; a second listener on `window` itself would still run. There is none
  today, and this makes the claim structural rather than a survey that can go stale.
- **FR-50 holds structurally, not by discipline.** While `openRef.current` is false the
  Escape arm returns before touching the event, so `SharePopup`'s capture dismiss, the
  Map Explorer's two handlers, the More sheet, `ModalDialog`, `HelpDocs`, the Calendar
  day popup, `WelcomeScreen`, the rail tooltip and `useMapFullscreen` all behave exactly
  as on the previous release. **QA-48's "their existing tests pass unchanged" is
  satisfied because those tests never open the palette.** Guard both directions in jsdom
  with a `document`-level probe listener — consumed while open, delivered once closed —
  the shape `SpeciesCombobox.test.tsx` already uses for the same class of claim.

**The palette's own arrow/Enter keys are unaffected**: they are handled by a React
`onKeyDown` on the `<input>`, a bubble-phase element handler, and the window-capture
listener returns for them untouched.

**FR-51 — opening disturbs nothing.** The chord arm calls `stopPropagation()`, so the
press never reaches any other listener; the palette sets no state outside itself except
`paletteOpen`; and the fullscreen map, an open `SharePopup` and a dropped share pin are
all state the palette holds no handle on.

**FR-14 — operable over an `inert` navigation.** `chromeInert` (`App.tsx:733`) is applied
to exactly three boxes: the non-phone `<TabNav>` root, the phone `<header>`, and the
footer `<p>`. The palette renders as a sibling of `.sr-shell` at the App root — the same
position as `WelcomeScreen` and `HelpDocs` — so it is outside all three **by
construction**, and no `inert` handling is needed anywhere.

**No shared layer registry.** One always-armed listener at a phase nothing else occupies
answers the whole of Section H. A registry would be a second source of truth for
something a single readable predicate already decides.

**Satisfies:** FR-01, FR-02, FR-03, FR-04, FR-11, FR-14, FR-47, FR-49, FR-50, FR-51,
QA-01, QA-02, QA-03, QA-04, QA-11, QA-14, QA-45, QA-47, QA-48, QA-49.

---

### D-05 — The wiring seam: ordinary props through the `lazy()` boundary, plus two wrappers App must supply

**There is no seam to invent.** `React.lazy` keeps the module off the static graph while
the component still takes ordinary props. `App.tsx` renders:

```tsx
<CommandPalette
  items={navItems}                    // FR-16, FR-17, FR-18 — see below
  onSelectTab={selectTabFromPalette}  // the wrapper, below
  onOpenSpecies={openSpeciesFromPalette}
  onClose={closePalette}
/>
```

**`items={navItems}` satisfies FR-16 through FR-18 structurally.** `navItems` *is*
`visibleTabs(tabLayout)` labelled from `TAB_LABELS`, drawn with `TAB_ICONS`, in the
user's saved order, with hidden tabs already filtered and Settings already appended last.
Consequences, each of them a QA row that then passes by construction rather than by care:

- The palette's own files contain **no destination list at all** (QA-16's source scan).
- A destination added in a future release appears with **no registration step**, because
  `App.tsx` already builds it (QA-16's hypothetical-tab test).
- Hidden destinations cannot appear (QA-18), and the order cannot drift from the nav's
  (QA-17), because there is only one array.
- Icon scale comes from the `NAV_ICON` presets; the palette picks one of the four
  (`sheet` at 17 / 2.1 is the closest register to a list row) and introduces no new
  number (FR-16).

**Two wrappers, both required, and the second is a load-bearing finding.**

```ts
// FR-19. Collapse a fullscreen Map Explorer when navigating AWAY from it — but not
// when the palette selects the Map Explorer itself, which must not collapse a map
// the user is looking at and did not ask to collapse.
const selectTabFromPalette = useCallback((tab: Tab) => {
  if (tab !== 'map-explorer') setMapFullscreen(false)
  setActiveTab(tab)
}, [])

// FR-28. Byte-for-byte the wrapper MapExplorer already receives (App.tsx:1366).
const openSpeciesFromPalette = useCallback((name: string) => {
  setMapFullscreen(false)
  navigateToSpeciesDetail(name)
}, [navigateToSpeciesDetail])
```

`setActiveTab` must **not** be passed raw the way `TabNav` receives it. See **D-09** for
why, and for what happens if it is.

**FR-29** falls out for free: `navigateToSpeciesDetail` sets `activeTab='species-detail'`
and `requestedSpecies`, and `SpeciesDetail`'s consume effect is single-use and pending
until `phase === 'ready'`. Neither consults the layout, so a hidden Species Detail tab
still opens — matching `BirdName`, Statistics and the Map Explorer. **FR-30**'s reveal is
`SpeciesDetail`'s shipped v1.0.18 behaviour and needs nothing from the palette.

**Entry points and their prop threading.** `TabNav` gains one prop,
`onOpenPalette: (opener: PaletteOpener) => void`, threaded to `NavColumn` and
`NavBottomBar → NavMoreSheet` at the same depth `onSelect` already travels.

- **Sidebar and rail (FR-05, FR-06)** — a `<button tabIndex={0}>` in `NavColumn`,
  rendered **between the brand/tagline block and `<nav className="sr-nav-list">`**, and
  therefore **outside** the `role="tablist"` div, which holds `role="tab"` children only.
  It takes `{...tip.handlers(label)}` from the existing `useRailTooltip`, giving it the
  rail's shipped hover, `:focus-visible` and 350 ms touch-hold name treatment for free,
  and carries `aria-label={rail ? label : undefined}` exactly as the destination buttons
  do — so `getByRole('button', { name })` resolves it at both densities (QA-06). It calls
  `onOpenPalette({ trigger: () => searchBtnRef.current })`.
- **Phone (FR-07, FR-08)** — a row at the top of `NavMoreSheet`. The bottom bar's anatomy
  is untouched: `favourites = items.filter(it => it.id !== 'settings').slice(0, 4)` plus
  More, no fifth cell. Activating the row calls **`closeSheet(false)`** — deliberately
  *not* `closeSheet(true)`, because focus is going to the palette's input, not back to
  the More button — and then
  `onOpenPalette({ trigger: () => moreRef.current })`. `moreRef` lives in
  `NavBottomBar`, so the getter is created there, which is why the opener is passed as a
  getter rather than an element.
- **The stated FR-07 consequence stands unchanged and no entry point is invented for it:**
  at phone density `App.tsx:1483` omits the whole nav while a Map Explorer map is
  fullscreen (`{isPhone && !chromeInert && ...}` — removed, not made `inert`, because
  `.sr-navbar` is fixed at z-index 1200 and would paint over the map). In that one state
  a phone has no visible entry point. The user leaves fullscreen first.

**Focus return (FR-12), on the shipped `ModalDialog` trigger-getter contract.** The
restore **must live in `App.tsx`, not in the palette**, because the palette unmounts on
close and an effect inside it cannot run after the close commits. The decision itself
lives in a pure helper so it is testable without rendering `App.tsx`:

```ts
// lib/paletteFocus.ts — entry-safe, imports nothing.
export interface PaletteOpener {
  trigger: () => HTMLElement | null
  fallback?: () => HTMLElement | null
}
/** Returns which target was used, so a test can assert the branch. */
export function restoreOpenerFocus(
  opener: PaletteOpener | null,
  finalFallback: HTMLElement | null,
): 'trigger' | 'fallback' | 'final' | 'none'
```

Liveness gate, in order: the trigger element, if it is non-null, `document.contains(...)`,
not `disabled`, and **not inside an `inert` subtree (`!el.closest('[inert]')`)**; then
`opener.fallback?.()` under the same gate; then `finalFallback`. `App.tsx` supplies
`mainRef.current` as the final fallback — `<main id="sr-main" ref={mainRef} tabIndex={-1}>`
already exists (`App.tsx:811`) and is never inert, so **focus can never land on `<body>`**,
which is what FR-12 forbids.

App's side is the `restoreFiltersFocusRef` shape from `MapExplorer.tsx:548-563`, so the
restore runs on the commit *after* the close:

```ts
const paletteOpenerRef = useRef<PaletteOpener | null>(null)
const restorePaletteFocusRef = useRef(false)
const [paletteOpen, setPaletteOpen] = useState(false)

const openPalette = useCallback((opener: PaletteOpener | null) => {
  paletteOpenerRef.current = opener
  setPaletteOpen(true)
}, [])
const closePalette = useCallback(() => {
  restorePaletteFocusRef.current = true
  setPaletteOpen(false)
}, [])
useEffect(() => {
  if (paletteOpen || !restorePaletteFocusRef.current) return
  restorePaletteFocusRef.current = false
  restoreOpenerFocus(paletteOpenerRef.current, mainRef.current)
}, [paletteOpen])
```

**The chord's opener is captured EAGERLY, at press time.** `usePaletteHotkey` reads
`document.activeElement` inside the keydown handler and closes over that element:
`openPalette({ trigger: (el => () => el)(document.activeElement as HTMLElement | null) })`.
A getter that re-read `document.activeElement` later would return the palette's own input.

**Satisfies:** FR-05, FR-06, FR-07, FR-08, FR-09, FR-12, FR-16, FR-17, FR-18, FR-19,
FR-28, FR-29, FR-30, QA-05, QA-06, QA-07, QA-08, QA-12, QA-16, QA-17, QA-18, QA-19,
QA-27, QA-28, QA-29.

---

### D-06 — The four species states: one injected-deps resolver on `resolveBacklogRows`'s exact shape

`frontend/src/lib/paletteSpeciesLoad.ts`, modelled line for line on
`lib/weatherBacklogLoad.ts`, which is the same decision on the same two questions:

```ts
export const PALETTE_SPECIES_UNLOADABLE = 'palette-species-unloadable'
export const PALETTE_SPECIES_SUPERSEDED = 'palette-species-superseded'
export type ResolvedSpecies =
  SpeciesIndexEntry[] | null | typeof PALETTE_SPECIES_UNLOADABLE

export interface PaletteSpeciesDeps {
  getFilesStatus: () => Promise<{ ebird: unknown }>
  loadObservations: () => Promise<{ observations: ObservationEntry[] } | null>
  buildIndex: (observations: ObservationEntry[]) => SpeciesIndexEntry[]
  isCurrent: () => boolean
}
export async function resolvePaletteSpecies(
  deps: PaletteSpeciesDeps,
): Promise<ResolvedSpecies | typeof PALETTE_SPECIES_SUPERSEDED>
```

Four settled outcomes, one per PRD state, all distinguishable (QA-35):

| Component state | PRD | Renders |
|---|---|---|
| `undefined` (not yet settled) | **FR-34** | the loading line, species half only |
| `null` | **FR-33** | "searching species needs an eBird backup", pointing at Settings |
| `PALETTE_SPECIES_UNLOADABLE` | **FR-35** | `EBIRD_BACKUP_LOAD_ERROR` **verbatim** |
| `SpeciesIndexEntry[]` | loaded | rows, or FR-36's no-matches line when the query is non-empty and nothing matched |

**Six rules copied from the reference, each of which was a shipped defect there:**

1. **Every dependency call happens inside a `try`, including both `isCurrent()` calls.**
   The second one sitting outside every `try` is exactly what made the backlog promise
   reject and park the section on its spinner for the session.
2. **`return await deps.buildIndex(...)`, not `return`.** The `await` is load-bearing even
   though the type says a plain array. CLAUDE.md's own promise-boundary rule was written
   about this very module family: an async function's `return v` performs promise
   resolution *after* the try block exits, so both the `Get(v, "then")` lookup and the
   `then` call escape a statement that looks entirely enclosed. Cost on the array path is
   one microtask tick.
3. **This promise never rejects, and the call site has no `.catch`.** State the one named
   boundary at the definition site: rejection is closed, **non-settlement is not** — a
   dependency that hangs leaves the species half on its loading line forever, no `try`
   closes that, and the answer is a timeout owned by whoever introduces such a dependency.
   None of the four can hang today. A totality claim with an unnamed exception is worse
   than an honest partial one.
4. **A rejecting `getFilesStatus` lands on `PALETTE_SPECIES_UNLOADABLE`, never on
   `null`.** That is the precise lie the reference module exists to remove: telling a
   birder to go import a file Settings plainly lists as saved.
5. **`SUPERSEDED` writes no state.** A newer files epoch or an unmount must not push a
   settled half back to its loading line. TypeScript enforces the narrowing.
6. **FR-34's line never outlives the answer** because it *is* the `undefined` state and
   every path assigns one of the other three. QA-33's "never present at the same time as
   either" is then a property of the type, not of the render.

**FR-32 — species join the SAME open session.** The effect runs on mount and on epoch
change; while pending the state is `undefined`; when it settles the state updates and
rows appear with no close and reopen. That is automatic from the effect-plus-state shape.

**FR-20 — destinations are never blocked.** They come from a prop that is already
computed, and the species state starts `undefined`. The destination list renders in the
first commit and structurally cannot wait on anything.

**The `honestLoadFailures.test.tsx` roster (FR-35, QA-34).** Add one row to
`EBIRD_MESSAGE_TABS`, supplying its five fields — `name`, `files: EBIRD_ONLY`, a
fully-propped `element`, `setupTitle`, `stepsMarker`. That row proves **delivery** only;
the content claim stays pinned once, in that file's first test. If the palette also joins
`CANCEL_GUARDED`, its `retrigger` is **`'epoch'`**, not `'prop'` — it re-loads on
`useFilesEpoch()` and has no `filesVersion` prop, and a prop-driven row would pass by
never re-running the effect it exists to test.

**FR-37 — the live-region shape. Default: render no live region at all.** The PRD's own
Out of Scope makes announcing counts a Designer decision defaulting to "no", and
`aria-activedescendant` already announces the active option, which is the ARIA-correct
channel for a combobox. The four state lines are ordinary visible text inside the panel,
not options and not announcements. **If the Designer adds one**, four constraints bind:
it is mounted empty from the first commit (never created with its first message), it
holds the sentence and nothing else, its message is a sequence-keyed child, and no rule
in the stylesheet sets a hiding value on it or any ancestor. It is also outside any
`inert`-able element — the palette has none, which keeps that free.

**Satisfies:** FR-20, FR-32, FR-33, FR-34, FR-35, FR-36, FR-37, QA-20, QA-31, QA-32,
QA-33, QA-34, QA-35, QA-36.

---

### D-07 — Focus containment, the platform hint, and the presentation contract

**`containOutsideFocus` stays OFF** (`useFocusTrap(true, panelRef)`, no options — exactly
what `NavMoreSheet` ships). Two reasons, both of which must be written into
`CommandPalette.tsx`'s header:

1. **The markup makes the keydown arm's prediction correct by construction.** The
   `focusin` arm exists because a keydown-only trap *predicts* the engine's tab order, and
   WebKit's default tab mode — what the shipped Mac, iPhone and iPad apps run — visits
   only explicitly-`tabindex`ed elements, native form controls and `<summary>`. The
   palette's only focusables are a native `<input>` (visited) and any `<button>` it draws
   at a literal `tabIndex={0}` (visited). `role="option"` rows carry no `tabindex`, so
   `FOCUSABLE_SELECTOR`'s `[tabindex]:not([tabindex="-1"])` clause does not match them
   and they are in neither list. The prediction and the engine agree.
2. **Turning it on breaks FR-12.** The `focusin` arm pulls focus back into an overlay
   that is about to unmount, and focus then drops to `<body>` — the measured F061 defect
   in `NavMoreSheet`'s own header. The restore would have to move into a post-commit
   effect. D-05 puts it there anyway, but the option still buys nothing here and costs a
   working close path.

**The corollary is the requirement, and it must be stated in the component:** adding any
focusable to the panel without a literal `tabIndex={0}` silently reopens the v1.0.15
hole. **QA-15's source assertion is the guard**, and it is not optional. One further
constraint follows from the same measurement: **the palette renders no `<details>` /
`<summary>`** — WebKit visits `<summary>` and `FOCUSABLE_SELECTOR` does not match it,
which is the one live gap the trap cannot close.

**`FOCUSABLE_SELECTOR` is copied into four other files against the rule. Do not fix that
here** — it is a separate queued build and touching it would collide.

**Tab-order roster (FR-44, QA-42).** As designed, `EXCLUSIONS` stays at four rows and
`ACCESSIBILITY.md`'s Keyboard Navigation roster at three items: every `<button>` and
`<a href>` this change renders carries a literal `tabIndex={0}`, and `role="option"`
divs are outside the AST guard's population entirely (it walks intrinsic `button` and
`a[href]` only). **If the implementation nevertheless introduces an exclusion** — a
`tabIndex={-1}` chevron of the kind `SpeciesCombobox` has — both rosters move in the same
change and must agree, and the new row needs its own `count`, because a roster row keyed
on file-plus-attribute is otherwise a blanket pardon for its whole file.

**The platform hint (FR-45 to FR-48).** `frontend/src/lib/paletteHint.ts`, entry-safe,
importing `lib/platform.ts` only:

```ts
export type ChordHint = 'none' | 'cmd' | 'ctrl'
export function resolveChordHint(): ChordHint
```

Resolution order, exactly FR-45: (a) `isIOS()` **or** a coarse primary pointer → `'none'`;
(b) `isMacOS()` → `'cmd'`; (c) `!isTauri()` **and** `navigator.userAgent` carries an Apple
platform token → `'cmd'`; (d) otherwise → `'ctrl'`. Three binding details:

- **The `matchMedia` read is guarded**: `typeof matchMedia === 'function'` inside a
  `try`/`catch`. jsdom has no `matchMedia`, and a throw here would take the whole
  navigation down — the same reasoning as `isFocusVisible`'s `try { el.matches(...) }` in
  `TabNav.tsx:417`.
- **The `navigator.userAgent` read is hint-only, and its definition site says so**
  (FR-48, QA-46), so it is never later mistaken for a platform predicate in the sense
  `lib/platform.ts` uses that word — a file whose own comments say UA sniffing is
  unreliable on exactly the device family iPadOS is in. The Apple-token test is a
  module-level regex literal over a bounded string with **no `/g` flag**; it is not built
  from the query and is outside NFR-07's scan, which is scoped to the query path.
- **Evaluated at render, with no `matchMedia` listener.** A pointer-capability change
  mid-session is not worth a subscription; if the Designer wants it live, that is a
  listener and not a redesign.

FR-46: where the helper returns `'none'`, the entry-point control renders its name and
**no key hint at all** — not a disabled hint, not a tooltip. FR-47: the listener accepts
both chords regardless (D-04 never consults this helper).

**Presentation contract (NFR-03, NFR-05, NFR-09, and `.claude/rules/ui.md`).**

- **Positioning lives in a class in `globals.css`, never inline.** An inline `inset: 0`
  is specificity 1,0,0 and would put the iOS safe-area inset permanently out of reach.
  `.sr-palette-root` (the scrim) and `.sr-palette-panel`.
- **z-index 1280**, and the number is reasoned rather than nominal: above
  `.sr-nav-sheet-root`'s 1260 and `.sr-nav-tip`'s 1250 so the palette rises over both,
  and below `.sr-skip-link:focus`'s 1300 — which is harmless, because the skip link is
  parked off-screen until focused and the trap makes it unreachable while the palette is
  open. Write that rationale at the declaration, per house convention.
- **Backdrop `var(--sr-scrim)`**; panel on the app's surface, border and shadow tokens.
  Every colour resolves from a `var(--sr-*)` token defined in **both** `:root` and
  `[data-theme="dark"]`; no hex, no `rgb()` (QA-60).
- **Its own `.sr-ios-app`-gated safe-area rule**, like every other 1200-tier fixed panel.
  A full-screen overlay does not inherit the body's inset.
- **`className="sr-input-16"` on the `<input>`**, the iOS zoom guard every
  `SpeciesCombobox` call site passes.
- **NFR-03:** a full-height sheet at phone width rather than a centred box, so the input
  and the first results stay visible with a software keyboard raised. AA at 320px and
  200% in-app text scale, both themes.
- **NFR-09:** reuse the shipped listbox entrance — 140 ms ease-out,
  `cubic-bezier(0.2, 0, 0, 1)`, transform-origin top — collapsed by the global
  `prefers-reduced-motion` block. No new curve.
- **FR-27 row rendering:** escaped plain text, muted scientific name, and the four
  load-bearing bits from `SpeciesCombobox`'s row — primary `flex: 1`, secondary
  `flex: 0 1 auto` **plus** `max-width: 40%`, and `.sr-truncate` on **both** spans. In a
  new component these belong in classes (`.sr-palette-row-name`, `.sr-palette-row-sci`),
  not inline styles. **No `<BirdName>`**: it composes a button and two anchors, which
  would nest interactive controls inside `role="option"` and add tab stops. This is the
  standing form-control exclusion in `.claude/rules/bird-names.md` and
  `pipeline/design-system.md`, not a shortcut.
- **FR-57:** every destination name comes from `TAB_LABELS`, never a component or file
  name. `life-list` reads **Multimedia**; `birding-stats` reads **Statistics**.

**Satisfies:** FR-10, FR-15, FR-27, FR-42, FR-43, FR-44, FR-45, FR-46, FR-47, FR-48,
FR-57, NFR-03, NFR-04, NFR-05, NFR-09, QA-09, QA-10, QA-15, QA-26, QA-41, QA-42, QA-43,
QA-44, QA-45, QA-46, QA-55, QA-59, QA-60, QA-64.

---

### D-08 — One flat selectable list, built by a pure function

`frontend/src/lib/paletteRows.ts`, off the entry graph, pure, no component (NFR-11):

```ts
export type PaletteRow =
  | { kind: 'tab'; id: Tab; label: string; icon: TabIcon }
  | { kind: 'species'; name: string; sciName: string }

export const SPECIES_CAP = 50   // FR-26, OQ-03. One constant.

export function buildPaletteRows(input: {
  items: NavItem[]
  index: SpeciesIndexEntry[] | null
  query: string
  cap?: number
}): { rows: PaletteRow[]; destinationCount: number; speciesTruncated: boolean }
```

- Destinations first, then species — **one flat array with one `activeIdx`**, which is
  what makes FR-39's arrow navigation cross the group boundary for free.
- Empty query → all destinations, **zero species** (FR-21, FR-24).
- Non-empty query → destinations filtered on their label, species filtered through
  `matchesSpeciesQuery` against a query normalized **once** per call, never per row.
- **Destinations are never capped**; species are capped at `SPECIES_CAP` after sorting,
  with `speciesTruncated` true when more matched (FR-26).
- Group headings ("Destinations", "Species"), the cap line and the four state lines are
  **not in `rows`**. They are rendered as interleaved elements carrying
  `role="presentation"`, so they are not options, not focusable, and not reachable by the
  arrow keys (FR-41, QA-40). Their text stays readable; `role="presentation"` removes the
  element's own semantics, not its children's text.

**Keyboard model, matching the shipped `SpeciesCombobox` deliberately:**

- `activeIdx` starts at `-1` and is **clamped**, never wrapped:
  `ArrowDown → Math.min(i + 1, rows.length - 1)`, `ArrowUp → Math.max(i - 1, -1)`
  (FR-39, OQ-11). Wrapping would make one key answer differently on two surfaces of one app.
- Reset to `-1` on every query change, which is also what keeps the index valid as `rows`
  shrinks.
- Scroll into view with `document.getElementById(optionId(activeIdx))?.scrollIntoView?.({ block: 'nearest' })`
  — the optional call is required because jsdom lacks the method.
- **Enter differs from `SpeciesCombobox` in one respect, deliberately**: with no active
  option and at least one result, the palette activates **`rows[0]`** (FR-40). The
  combobox prefers the first *species* match because it has a synthetic "All species"
  clearing row at index 0; the palette has no such row, so "the first row" is unambiguous.
  Record the difference so it is not later read as drift.
- With no results, Enter does nothing and the palette stays open (QA-39).

**ARIA (FR-38):** `role="combobox"` on the input with `aria-expanded`, `aria-controls`,
`aria-autocomplete="list"`, `aria-haspopup="listbox"` and `aria-activedescendant`;
`role="listbox"` on the results container; `role="option"` with `aria-selected` on each
row. Ids `useId()`-namespaced (`${uid}-listbox`, `${uid}-option-${idx}`) so a second
instance could never collide.

**Close paths (FR-11).** Escape (D-04), a backdrop **`mousedown`** where
`e.target === e.currentTarget` (not `click` — a drag that starts inside the panel and ends
on the backdrop must not close it, the `NavMoreSheet` rule), selecting any row, and a
second chord press all call the **same** `onClose`. QA-11 spies on it.

**Satisfies:** FR-11, FR-21, FR-24, FR-26, FR-38, FR-39, FR-40, FR-41, NFR-02, NFR-11,
QA-11, QA-23, QA-25, QA-37, QA-38, QA-39, QA-40, QA-58, QA-66.

---

### D-09 — Load-bearing finding: `mapFullscreen` is not reset on tab change, and the palette is the first surface that can navigate out of a fullscreen map

**Not a data question, but it will ship a visible defect if the Engineer passes
`setActiveTab` raw, so it belongs here.**

`mapFullscreen` is a plain `useState(false)` at `App.tsx:162`. **Nothing resets it on a
tab change.** Instead there is a shipped convention: every App-level path that navigates
away from a fullscreen Map Explorer collapses it first, and there are exactly three —
`onGoToSettings` (`:1361`), `onNavigateToMediaList` (`:1362`) and `onOpenSpecies`
(`:1366`), each of which opens with `setMapFullscreen(false)`.

Today that convention cannot be violated, because while the map is fullscreen the wide
nav is `inert` and the phone bar is not rendered at all — there is no way to reach another
destination. **The palette is the first surface that can** (FR-14 requires it to be fully
operable in exactly that state). Pass `setActiveTab` raw and selecting "Calendar" from a
fullscreen map leaves `mapFullscreen === true` with `activeTab === 'calendar'`: the nav
correctly returns (`chromeInert` goes false) and the scroll lock correctly releases (its
effect is keyed on `mapFullscreen && activeTab === 'map-explorer'`), but the user is
silently returned to a fullscreen map the next time they open the Map Explorer.

**The fix is D-05's `selectTabFromPalette`**, which collapses on navigation away and
**not** when the selected destination is the Map Explorer itself — collapsing a map the
user is looking at and did not ask to collapse would be a second defect in the other
direction.

**This does not conflict with FR-51.** FR-51 governs *opening*: the palette must leave a
fullscreen map expanded, a popup open and a pin dropped. Collapsing on *selection* is a
navigation, and it is the shipped convention every other App-level navigation already
follows. Both hold at once, and QA-49 (opening and closing changes nothing) and QA-47
(one Escape closes only the palette) both remain true.

**One related state is stated and accepted rather than solved.** The *embedded* map
fullscreen (`lib/useMapFullscreen.ts`, on Species Detail, Named Birds and Statistics) is
component-local state at three lazy hosts; `App.tsx` holds no handle on it and sets no
`inert` for it. Navigating away from an expanded embedded map via the palette leaves that
map expanded when the user returns. The overlay itself vanishes correctly (its
`position: fixed` box is inside a tabpanel that goes `display: none`, which is not
rendered), so there is no paint or focus artefact — only the map's remembered state,
which is what `useMapFullscreen`'s `resetKey` design already implies (it resets on a
species change, not on a tab change). Reaching those three states from `App.tsx` would
mean a new cross-cutting store for per-map component state, which is precisely the
"second source of truth" the strategic brief's Key Decision on the action registry
refuses. **Give QA a note; do not build the store.**

**Satisfies:** FR-14, FR-19, FR-51, QA-14, QA-19, QA-49. **Flagged for QA and The
Evaluator.**

---

## Tests This Design Obligates

Beyond the 66 QA rows, the design creates these specific obligations:

| Test | What it must assert | Why it is named here |
|---|---|---|
| `lib/entryChunk.test.ts` | D-03's assertion set, each negative paired with a positive, **and the subtree form for `BirdName` rather than the App-level one** | The file's own convention: an unpaired negative passes vacuously |
| `lib/speciesIndex.test.ts` | build, de-dupe, sort determinism, memo hit-count across ten calls, `WeakRef` miss rebuilds | NFR-02, FR-25, QA-24, QA-58 |
| `lib/speciesMatch.test.ts` | the FR-23 table; **plus a source scan that both `SpeciesCombobox.tsx` and the palette import it** | Single-sourcing is the claim; the scan is what makes it structural |
| `lib/paletteSpeciesLoad.test.ts` | the four outcomes; a `try`-coverage sweep that **iterates the deps OBJECT** and throws on each of the first several calls to each member | The reference's own guard shape, so a fifth dep is covered without anyone remembering |
| `lib/usePaletteHotkey.test.ts` | chord `preventDefault`; both chords; `e.repeat`; **and a `document`-level probe proving Escape is consumed while open and delivered while closed** | FR-50's structural claim, mutation-checked in both directions |
| `lib/paletteRows.test.ts` | ordering, cap, empty-query, headings-are-not-rows | NFR-11, QA-25, QA-40, QA-66 |
| `lib/paletteFocus.test.ts` | each branch of the liveness gate, including the `[inert]` ancestor case | FR-12 — never `<body>` |
| `components/honestLoadFailures.test.tsx` | one new `EBIRD_MESSAGE_TABS` row; `retrigger: 'epoch'` if it also joins `CANCEL_GUARDED` | FR-35, QA-34 |
| `lib/tabOrderCoverage.test.ts` | passes unchanged, `EXCLUSIONS` still four rows | FR-44, QA-42 |
| `lib/cacheInventory.test.ts` | **unchanged** | QA-53 — the absence is the assertion |
| Browser (Playwright, Chromium **and** WebKit) | QA-15's containment on the production build; QA-59's 320px / 200% geometry | jsdom has no tab order and no layout engine; a jsdom containment test only re-asserts the broken assumption |

**Two measurement rules apply to QA-58.** Anchor the assertion to a **same-run quotient**
(`ceiling / best >= N`), never to an absolute headroom measured on the build machine —
`countyShadingPerSpecies.test.ts` shipped that mistake to production. And give each timed
run a distinct input so the memo does not turn the guard into a cache-hit measurement.

---

## Risks Carried Forward and Engineer Verify-Items

- **R-01 — FR-31 rests on an ordering invariant the palette does not own.**
  `clearEbirdObservationsCache()` runs before `notifyFilesChanged()` at `Settings.tsx:1917`,
  `Settings.tsx:1964` and `icloudSync.ts:1530`. Reverse any one of those and the palette
  offers species from a file that is gone, while every other tab keeps working (they hold
  parsed data in their own state and re-load on the epoch too, but they do not memoize on
  the array identity). **Write QA-30 as a real integration test through the real
  `observationsCache`**, not against a mocked loader, so the ordering is what is under
  test. Verify on both the Settings clear path and the Settings replace path.
- **R-02 — the idle prefetch is the whole of FR-20's "no wait" on a cold first invoke.**
  Omit the one line in `warm()` and QA-20 still passes (it tests the parse, not the chunk)
  while a real user's first Cmd-K shows an empty overlay. Verify by hand on a cold load.
- **R-03 — the `window`-capture decision is correct by specification and has one
  assumption**: that nothing else ever binds a `window` keydown listener. Nothing does
  today. If one is ever added, `stopImmediatePropagation()` on Escape covers the palette's
  side, but a new `window`-capture listener registered *before* the palette's would beat
  it. Say so in `usePaletteHotkey.ts`.
- **R-04 — extracting the predicate touches a shipped component.** `SpeciesCombobox` has
  three call sites and its own test file plus five ancillary suites. Extract with
  **behaviour preserved exactly**; if `SpeciesCombobox.test.tsx` goes red, the extraction
  is wrong, not the test.
- **R-05 — `role="presentation"` inside `role="listbox"`.** A listbox whose children are
  not all options is a known ARIA soft spot. Settle QA-37 and QA-40 against a **real
  accessibility tree** (Playwright `ariaSnapshot` in Chromium *and* WebKit), not jsdom,
  which has no accessibility tree at all. If the snapshot is unhappy, the fallback is
  `role="group"` wrappers with `aria-label` per group, which is a render change and not a
  design change.
- **R-06 — D-09's embedded-map state** is a stated, accepted consequence. QA should see it
  once and not file it as a defect.
- **R-08 — NFR-01 and QA-57 are half wrong as written** (see the PRD CORRECTION in D-03).
  `BirdName` is on the entry graph by three chains this feature cannot touch. The Engineer
  writes the subtree assertion, not the App-level one; QA scores NFR-01 against "the palette
  adds no new edge", not against the literal sentence. **Flagged for The Evaluator.**
- **R-07 — `FOCUSABLE_SELECTOR` is duplicated in four files** against the standing rule.
  **Do not repair it in this build** — it is a separate queued change and touching it
  would collide. The palette uses the canonical hook and adds no fifth copy.

---

## No Data Layer Work Required

No migration to write and none to run. No table, column, relationship, index, backend
route, storage-seam document, persisted setting, `CACHED_GET_PATHS` entry or
`clearDerived.ts` row is added, modified or removed. `PRIVACY_POLICY.md` needs no edit,
and the reason is unusually clean: everything the feature reads is already parsed and
already local, and it writes nothing at all.

The Engineer proceeds to UI implementation, binding to D-01 through D-09.
