# PRD — County Shading and Project Contributions
**Feature:** county-shading-and-project-stats
**Date:** 2026-08-27
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Two additions in one build. The shipped county overlay reaches two maps that
carry none today: Species Detail's Sighting Locations map, shaded by how often
the selected species was recorded in each county, and Statistics' Geographic
Stats map, shaded by species or checklists across the whole export. And the
Statistics tab gains a **Projects** section reporting which eBird projects the
birder's checklists were submitted to, built from a user-initiated, stoppable,
resumable, durably-cached sweep of their own checklists through their own eBird
key.

---

## Context The Architect And The Engineer Must Not Re-Derive

Verified in source and against the user's real account during Stages 1 and 2.
This PRD stands on these facts; do not re-check them, and do not assume the
opposite of any of them.

| Fact | Value |
|---|---|
| Where project membership lives | `GET /v2/product/checklist/view/{subId}` → `projId` (string) and `projectIds` (number[]) |
| Real sample, this user's account | 35x `EBIRD`, 7x `EBIRD_ATL_CA` with `projectIds: [1050]` (all 2026), 3x `EBIRD_MERLIN` |
| Backup CSV columns | 23, none of them a project |
| This user's data | 3,252 checklists, 21,369 observation rows |
| Sweep cost at the shipped floor | 3,252 x 150 ms ≈ 8.1 minutes, one request at a time |
| Where the overlay is mounted today | `MapExplorer.tsx` only. `AtlasLayer` and `CountyLayer` are not on Species Detail or Statistics |

Eight things verified in source at Stage 2 that change the shape of the work:

1. **`CountyLayer` does not load its own geometry.** It takes
   `data: CountyFC | null` and returns `null` when that is null. The only load
   site in the app is `MapExplorer.tsx:1005`,
   `await import('../assets/us-counties.json')`, cached in that component's own
   `useState`. Three call sites need a shared loader; the per-mount state cache
   does not generalize.

2. **The "Counties in view" keyboard list lives inside `CountyLayer`**
   (`CountyLayer.tsx:435-536`), not in `MapExplorer`. It comes free at each new
   mount site, and so do the popup, the over-cap chip, the hatch sprites and the
   theme observer.

3. **Species Detail's map is TWO mounts, not one.** The Pins branch renders
   `<SightingsMap>` (which owns its own `SnowMap`); the Heatmap branch renders
   `<SnowMap>` directly with `HeatmapLayer`. The file already carries a comment
   recording that the share-pin fix needed "two branches, two fixes, and a test
   for each." The same applies here.

4. **`SightingsMap` is shared.** It is also the per-row map on Named Birds,
   which is explicitly out of scope for county shading. Any change to
   `SightingsMap` must be opt-in and default to today's behavior.

5. **The metric key `records` already renders as the label "Checklists".**
   `CountyMetric = 'species' | 'records'`;
   `COUNTY_METRIC_META.records.label === 'Checklists'` and its title is
   "Total checklists per county". `CountyAggregate.records` is a checklist
   count, not a tally of individual birds. The brief's word "records" is this
   key; the user-facing word stays "Checklists".

6. **The backend turns an upstream eBird 429 on the checklist path into a 502.**
   `checklists.py` catches everything in a bare `except Exception` and raises
   502 with no `Retry-After`. `_raise_ebird_http_error` and
   `_parse_retry_after_seconds` exist only in `backend/routers/map.py` and are
   never called from the checklist route. On the desktop side,
   `throwEbirdHttpError` is module-private in `tauri/mapService.ts` and
   `checklistService.ts` rolls its own error handling, so a 429 arrives with
   `status: 429` but no `retryAfterSec` and no shared detail. **As shipped, a
   sweep on this path cannot detect a 429 on web and cannot honor a
   `Retry-After` on either transport.** Closing this is in scope; without it
   the pacing contract is unenforceable here.

7. **`/checklists/{id}` is in neither `CACHED_GET_PATHS` nor
   `EBIRD_GATED_PATHS`, and cannot join the latter as written** — both sets are
   matched with `Set.has(path)` on the exact path string, and this is a prefix
   route carrying an id. The sweep therefore owns its own enforcement point over
   the shared gate state, the same shape as the hotspot-activity pump.

8. **The escapee sweep has no start button.** `useExoticProvenance` auto-starts
   from an effect; `retry()` is reachable only from `partial` and `error`. Its
   copy, icon vocabulary, live-region shape, progress bar and 2,000 ms throttle
   all transfer to this feature. The start affordance does not exist yet and is
   new work.

---

## User Stories

> **US-01** — As a birder looking at one species, I want the counties I have
> recorded it in shaded on its map, so that I can see my range for that bird at
> the unit birders actually think in.

> **US-02** — As a birder comparing species, I want the shading to change the
> moment I pick a different bird, so that flipping through species stays as fast
> as it is today.

> **US-03** — As a birder reading Statistics, I want the Geographic Stats map to
> shade every county by my species or checklist count, so that I can see the
> shape of my coverage instead of six ranked pins on a continent.

> **US-04** — As a birder with no connection and no key entered, I want county
> shading on both maps to work anyway, so that a feature computed entirely from
> my own file never asks me for anything.

> **US-05** — As any user who never turns Counties on, I want both maps to
> behave exactly as they do today and the app to start no slower, so that a
> feature I do not use costs me nothing.

> **US-06** — As a birder who has never checked projects, I want to be told what
> checking will cost before anything is sent, and to be shown no number at all
> until I have paid for one, so that I am never given a figure the app has not
> earned.

> **US-07** — As a birder mid-check, I want every tally shown with the number of
> checklists it was drawn from, so that a partial answer reads as a floor and
> never as a finished total.

> **US-08** — As a birder who stopped the check, closed the tab, or quit the
> app, I want every answer already paid for to still be there when I come back,
> and resuming to ask only about what is left, so that eight minutes is a
> one-time cost.

> **US-09** — As a California Breeding Bird Atlas contributor, I want the
> Projects section to name the atlas with my checklist count and the span of
> dates I contributed over, so that I can see a contribution eBird holds but
> does not show me.

---

## Functional Requirements

### The shared county-shading foundation

> **FR-01** — The app shall load `assets/us-counties.json` through a single
> shared module that dynamic-imports it on first request, keeps the parsed
> `CountyFC` in module scope, and dedupes concurrent requests through one
> in-flight Promise, so that enabling the overlay on a second map in the same
> session parses no geometry a second time and issues no second import.

> **FR-02** — `MapExplorer.tsx` shall load its geometry through that shared
> module rather than its own `await import` and component state. Its rendered
> output, its loading copy, and the timing of its first enable shall be
> unchanged.

> **FR-03** — Both new mount sites shall render the shipped `CountyLayer`
> component unmodified in its shading behavior: the same `sr-county-fill` layer
> id, the same `--sr-county-1..10` tokens, the same `computeCountyTiers`
> quantile ramp at `COUNTY_CLASS_COUNT`, the same hatch sprites, the same
> viewport cap of 800 with the "Zoom in to see counties" chip, the same theme
> `MutationObserver`, the same popup, and the same "Counties in view" keyboard
> disclosure. No shipped county metric, ramp, tier, token, or contrast value
> shall change.

> **FR-04** — Both new mount sites shall offer the shipped **Use Textures**
> control (off by default, session-scoped, no persistence) wired to
> `CountyLayer`'s `useTextures` prop, so that the ramp is readable without
> relying on color at every place it is drawn.

> **FR-05** — While county shading is on, each new map shall mute its basemap
> through the shipped `BasemapDesaturation` child and dim its own pins or
> heatmap beneath the county fill, using the same mechanism the Map Explorer
> uses. With shading off, neither shall be applied.

### Species Detail: per-species county shading

> **FR-06** — The Sighting Locations section shall carry a single on/off
> **Counties** control in its existing header row, alongside the Pins/Heatmap
> group. It shall be off on mount, session-scoped, and shall carry an explicit
> accessible name and `aria-checked` in the shipped switch idiom.

> **FR-07** — The overlay shall be mounted on **both** branches of that map: the
> Pins branch (through `SightingsMap`) and the Heatmap branch (the direct
> `SnowMap`). Turning Counties on and switching between Pins and Heatmap shall
> keep the shading on and keep the same counties shaded.

> **FR-08** — Any change to `SightingsMap` shall be opt-in through a prop that
> defaults to today's behavior. Every existing caller other than Species Detail,
> Named Birds included, shall render exactly as it does today, with no county
> layer, no geometry request, and no basemap muting.

> **FR-09** — The shading shall be built from `buildCountyAggregates` over
> exactly the observation set that already feeds this map (`speciesObs`), so
> that the active County filter, the active date range, the "Show subspecies"
> setting, and the "Show all forms" setting apply to the shading exactly as they
> already apply to the pins.

> **FR-10** — The metric shall be `records` (the user's checklists in that
> county that reported the selected species). The legend title shall name the
> selected species rather than reading "Total checklists per county", and the
> popup shall not render a "1 species" count. The popup shall carry the county
> name, the state, the selected species' checklist count in that county, and the
> user's top locations for it there, reusing the shipped `CountyPopupTop`
> top-locations rendering.

> **FR-11** — Switching species shall reshade without a page reload, without
> re-importing geometry, and without resetting the map viewport, the
> Pins/Heatmap mode, or the Counties control.

> **FR-12** — A compact legend showing the active quantile ranges shall render
> beneath the map while shading is on, with the same range wording and the same
> "No records (outline only)" row the Map Explorer uses. When the filtered
> species has no US county rows, the legend shall render the shipped
> "no recorded counties to shade" note rather than an empty ramp.

### Statistics: county shading on the Geographic Stats map

> **FR-13** — The Geographic Stats section shall carry a **Counties** on/off
> control and, while it is on, a **Species / Checklists** metric group matching
> the Map Explorer's first two `SegControl` options exactly in value and label.
> Both shall be off/default on mount and session-scoped, with `aria-pressed` on
> the metric group and an explicit group label.

> **FR-14** — The shading shall be built by `buildCountyAggregates` over the
> exact `filteredObs` and `checklists` memos that already feed `computeGeo` for
> the ranked county tables in the same section, so that the map and the tables
> beside it cannot disagree by construction.

> **FR-15** — With the tab's **Count all forms** checkbox off (its default), a
> county's Species and Checklists values on this map shall equal the Map
> Explorer's for the same county and the same metric. With it on, the map shall
> follow the tab. If a measured inequality appears at the default setting, the
> Engineer shall report its cause rather than weaken the assertion.

> **FR-16** — **Completeness shall not appear on this map.** The metric group
> shall offer exactly two options, and no code path on this surface shall
> consult the completeness controller, request `/map/county-species`, or import
> `lib/useCountyCompleteness.ts`.

> **FR-17** — The section's existing behavior shall be preserved: the ranked
> pins, the numbered `RankIcon` markers, the popup, the share pin, the
> `fitToPins` load handler, the `mapReady` idle deferral, the legend row beneath
> the map, and the `clPins.length === 0 && spPins.length === 0` guard that
> suppresses the whole block.

> **FR-18** — The metric legend shall render the active quantile ranges with the
> shipped `COUNTY_METRIC_META[metric].title` wording and the same "Ranges are
> quantiles of your own non-zero counties" note.

### Overlay-off parity, offline, and the entry chunk

> **FR-19** — With Counties off, each of the three new mount points shall behave
> exactly as the pre-change build: the same rendered layers and paint, no
> geometry import issued, no `BasemapDesaturation` effect applied, no pin or
> heatmap dimming, and no new DOM. This shall be asserted separately for the
> Species Detail Pins branch, the Species Detail Heatmap branch, and the
> Statistics map; one combined assertion would pass on a half-fix.

> **FR-20** — County shading on both new maps shall issue zero network requests
> and shall require no API key. It shall work on a first-ever cold start with no
> connection once the export is loaded.

> **FR-21** — Neither `CountyLayer`, the county geometry asset, the shared
> geometry loader, nor maplibre shall become statically reachable from
> `App.tsx`. `frontend/src/lib/entryChunk.test.ts` shall be extended with: a
> reusable subtree walker replacing the Calendar test's ad-hoc copy; per-subtree
> assertions that neither `components/SpeciesDetail.tsx` nor
> `components/BirdingStats.tsx` statically imports `assets/us-counties.json` or
> the shared loader; the new shared loader added to the App-graph negatives; and
> a guard-the-guard per host asserting both that the host is absent from the App
> closure and that its subtree walk actually reaches
> `components/map/CountyLayer.tsx`, so the new assertions cannot pass vacuously.

> **FR-22** — A production build shall show `vendor-maplibre`, the county
> geometry chunk, and `CountyLayer` absent from `dist/index.html`'s
> `modulepreload` set, and the entry chunk shall gain no modules.

### The checklist seam: `projId` and `projectIds` on both transports

> **FR-23** — `GET /checklists/{id}` shall return two additional top-level
> fields on both transports: `projId` (string, `""` when absent or malformed)
> and `projectIds` (array of non-negative integers, `[]` when absent or
> malformed). No new endpoint path shall be introduced, and
> `frontend/vite.config.ts` shall not change: `/checklists` is already proxied.

> **FR-24** — Both transports shall normalize these fields identically before
> returning them. `projId` shall be accepted only when it matches
> `^[A-Z0-9_]{1,32}$` under explicit ASCII classes and a full match on both
> sides, and rejected values shall become `""`. Each element of `projectIds`
> shall be accepted only when it is a non-negative integer within a stated
> bound; non-integers and out-of-range values shall be dropped, and the array
> shall be capped at a stated length. This pair shall be locked by a shared JSON
> fixture exercised by both runtimes, following the shipped
> `checklistProvenance.fixture.json` precedent, and that fixture shall include a
> trailing-newline row and a non-ASCII-digit row.

> **FR-25** — The `fields=` flag shall gain the value `projects` on both
> transports, requested by the sweep and by nothing else. Under it, the route
> shall skip the outbound location-name resolution (as `fields=provenance`
> already does) and shall skip the species resolution entirely, returning
> `species: []`. All other response fields shall keep their current shape.

> **FR-26** — `fields=provenance` and an absent, empty, or unrecognized `fields`
> value shall behave exactly as they do today, byte for byte, on both
> transports. The escapee pass, the Weather tab, the Weather Backlog, the
> Checklists tab, and the List Comparer shall be unaffected by this change.

> **FR-27** — The desktop path shall carry the flag through `ChecklistOptions`
> in the shape the shipped `skipLocName` boolean already uses, translated in
> `transport.ts` from `params?.fields`, with the checklist id still sliced off
> the path so a query string can never contaminate it.

> **FR-28** — `/checklists/{id}` shall stay out of `CACHED_GET_PATHS` (the
> durable stores own this path's caching) and out of `EBIRD_GATED_PATHS` (the
> sweep is its own enforcement point). A test shall assert both absences so a
> later well-meaning addition cannot create a shadowed cache or a second
> enforcement point.

> **FR-29** — A project identifier from the response shall never be
> interpolated into a URL, an `href`, or any outbound request. No public eBird
> endpoint resolves one, and this feature shall not invent a destination for it.

### eBird 429 parity on the checklist path

> **FR-30** — The backend shall surface an upstream eBird 429 on
> `/checklists/{id}` **as a 429**, with the shared rate-limit detail and a
> bounded, re-serialized `Retry-After` header, through the same mapper
> `/map/*` uses. That mapper and its `Retry-After` parser shall be single-sourced
> into a module both routers import, rather than copied.

> **FR-31** — The desktop `checklistService` shall raise a 429 through the same
> shared frontend mapper `mapService` uses, carrying `retryAfterSec` and the
> shared `EBIRD_RATE_LIMIT_DETAIL`. That mapper shall be extracted from
> `mapService.ts` into a shared module rather than duplicated.

> **FR-32** — Every non-429 outcome on this route shall keep its current status
> code and its current detail string on both transports: 400 for a malformed
> id, 404 with "Checklist not found. Check the ID and try again.", 401 on the
> desktop missing-key path, and 502 with the existing reflected detail for
> everything else. Only the 429 case changes.

### The projects store

> **FR-33** — Answers shall persist in a durable storage-seam document following
> the shipped `hotspotActivityCache` / `countyCompletenessCache` pattern: a
> versioned envelope whose key carries the version suffix, one disk read per
> session into an in-memory mirror, per-entry shape validation on load with
> malformed entries dropped and never thrown on, an `_inflight` `Map` cleared in
> a `finally`, a 250 ms debounced whole-document write through
> `storage.setSetting`, and `_get…WorkStatsForTests` / `_reset…ForTests` seams.
> Persistence shall go through the storage seam only; `localStorage` shall not
> be touched.

> **FR-34** — The document shall be keyed by submission id validated with
> `^S[0-9]{1,15}$` and shall hold, per checklist, only the normalized `projId`,
> the normalized `projectIds`, and a fetch timestamp. Every displayed count,
> date and share shall be derived by joining these keys against the currently
> loaded backup, so a newer export automatically corrects dates and drops
> checklists it no longer contains.

> **FR-35** — Admission shall be **fill-and-stop**, never FIFO: once the store
> holds its capacity of distinct checklists, a new key is refused and no
> existing entry is evicted. Admission shall be gated on the container's own
> size, never on a separate counter. Merging a fresh answer into an existing key
> shall never be blocked by the cap, and a test shall re-merge one id at least
> fifty times to prove admission capacity is not silently consumed.

> **FR-36** — No payload byte budget shall be added. Every field is fixed-shape
> and length-bounded by FR-24, so no unbounded string can exist in the document,
> which is the same reasoning `hotspotActivityCache` records for omitting one.

> **FR-37** — The TTL shall govern re-consultation only, never display. An
> expired entry shall keep counting as checked and keep displaying; the next
> sweep shall re-ask it. An error of any kind, a 429 included, shall never be
> written to the store.

> **FR-38** — All writes shall pass through one `dedupedFetch`-shaped chokepoint
> in the store module, so every persisted entry is fixed-shape by a single write
> path rather than by each caller's discipline.

### The sweep

> **FR-39** — Nothing shall be fetched without a press. There shall be no
> automatic start, no background start, no start on tab open, and no scheduled
> or retried start. The only entry points shall be the explicit start control
> and the explicit resume/retry controls.

> **FR-40** — The sweep controller shall be mounted only by the Statistics tab.
> No other surface shall mount it or initiate a projects request.

> **FR-41** — The target set shall be computed, at every start and resume, as
> the shape-valid distinct submission ids in the currently loaded backup, minus
> the ids already answered and still fresh in the store. There shall be no
> serialized cursor. This is what makes a resume after a quit and a second run
> after a newer export the same operation.

> **FR-42** — The sweep shall request newest first, ordered by checklist date
> descending with the submission id descending as a deterministic tie-break.

> **FR-43** — Every request shall go through `transport` and through
> `gatedEbirdCall` from `lib/ebirdGate.ts`, so the sweep shares one key-global
> pacing state with the rest of the app: at least 150 ms between request starts,
> one shared cooldown opened by any 429 honoring a bounded `Retry-After` and
> otherwise a jittered 2 s to 30 s ladder, and at most
> `ACTIVITY_RATE_LIMIT_RETRIES` retries per checklist. A 429 raised anywhere on
> the key shall slow this sweep, and a 429 raised by this sweep shall slow the
> Map Explorer.

> **FR-44** — A checklist that still fails after its bounded retries shall be
> left unanswered. It shall not be written to the store, shall not count toward
> the checked figure, and shall be counted in a stated failure figure with a
> control that re-asks only the unanswered ids.

> **FR-45** — Pressing Stop shall halt the pass without discarding any answer
> already written. In-flight requests may complete; no further request shall
> start.

> **FR-46** — Loading a different export while a pass is running shall cancel
> the pass and recompute the target set against the new backup.

> **FR-47** — Every submission id shall be shape-guarded with `^S[0-9]{1,15}$`
> and `encodeURIComponent`-wrapped before it reaches a URL. An id that fails the
> guard shall be excluded from the denominator, never requested, and reported as
> a stated skipped count when nonzero.

### The Projects section

> **FR-48** — A **Projects** section shall be added to the Statistics tab, with
> a matching jump-nav chip and a matching `### Projects` heading in
> `docs/HELP.md` at the same position in the section order.

> **FR-49** — Before a sweep has ever run, the section shall show **no count of
> any kind, and no zero**. It shall state what checking will do, name the exact
> number of checklists it will ask about, give a duration estimate derived from
> that number and the shipped 150 ms spacing rather than a hardcoded figure,
> say the estimate is a floor that grows if eBird asks the app to slow down, and
> offer a single explicit start control.

> **FR-50** — Every figure the section renders shall carry its denominator. A
> project's checklist count shall always be read against the number of
> checklists actually checked and the number in the export, and no tally shall
> ever render without that context.

> **FR-51** — The section shall render a distinct display state, with distinct
> copy, for each of: **never run**; **running**; **waiting out an eBird
> cooldown** while running; **stopped by the user this session**; **partial**
> (a prior pass did not finish, or a newer export added checklists);
> **complete**; **some checklists could not be answered**; **store at
> capacity**; **no eBird key**; **offline**; **eBird unreachable**. The
> stopped and partial states shall not claim knowledge the app does not have:
> after a relaunch the app cannot tell a deliberate stop from a quit, so the
> partial sentence shall state only the counts. Each state's controls shall be:
> start (never run), Stop (running and cooldown), Resume (stopped), Check the
> rest (partial), Try again (unanswered and error), Add a key in Settings
> (no key), Check again (complete). Offline and at-capacity shall offer no
> action they cannot perform.

> **FR-52** — Progress shall be announced from a `role="status"` live region
> that is present in the accessibility tree from first render, never hidden with
> `display: none`, and whose message sits in a sequence-keyed child so a
> repeated identical message still announces. Emission shall be throttled at the
> source, not at the announcement, at the shipped 2,000 ms interval, so the
> sentence, the progress bar and the `N / M` readout cannot disagree. The first
> definite figure, every shape change, and every terminal status shall bypass
> the throttle. The rate shall be measured against a real-duration pass, never a
> fast mock.

> **FR-53** — While running, a `role="progressbar"` with an explicit
> `aria-label`, `aria-valuenow` and `aria-valuemax` shall render alongside an
> `N / M` text readout.

> **FR-54** — After any sweep that has answered at least one checklist, the
> section shall list the projects found, each with its label, its checklist
> count, the span of dates the user contributed over, and its share of the
> checklists checked. Share display shall route through `fmtSharePct` so a
> nonzero share never renders a bare rounded "0%". Rows shall be ordered by
> checklist count descending with the label ascending as a tie-break, and shall
> carry no rank numbers. A checklist that names the same project by both a code
> and a numeric id shall count once.

> **FR-55** — Projects shall be driven by `projectIds` plus any `projId` value
> not in a small bundled set of generic submission portals, so an unknown
> project portal is shown as a project rather than silently dropped. When a
> sweep has checked at least one checklist and found no project, the section
> shall say so against its denominator rather than rendering an empty list.

> **FR-56** — A separate, secondarily-labelled **how you submitted** block shall
> report each distinct `projId` value with its checklist count and share of the
> checklists checked. It shall be visually and semantically subordinate to the
> projects list and shall never be presented as a project.

> **FR-57** — Project and portal labels shall come from a bundled table keyed by
> both string codes and numeric ids, resolving both forms of the same project to
> one canonical entry, following the `PROTOCOL_NAMES` precedent. An identifier
> not in the table shall render its raw value verbatim; no name shall be
> invented. Every lookup into that table shall be read through `Object.hasOwn`,
> because the key is an unvalidated string from an external API. The two
> pre-existing bare-index lookups in `checklistMeta.ts` (`protocolName` and
> `submissionAppName`, both keyed on eBird-supplied values) shall be converted
> to the same guard in this change.

### Documentation, published surfaces, and release

> **FR-58** — `docs/HELP.md` shall be updated in the same change: a `### Projects`
> section under Statistics describing what the check does, what it costs, that
> nothing is sent without a press, that it can be stopped and resumed, that
> answers persist, that a partial tally is a floor, and that it needs a key and
> a connection; plus the county-shading additions to the Species Detail and
> Statistics sections. `HelpDocs.tsx`'s hand-kept `TOC` array and
> `frontend/src/lib/helpToc.test.ts` shall be extended in the same edit.

> **FR-59** — `README.md` and `website/` shall be updated in the same change, in
> the site's informative, non-promotional voice, with the version pill and
> footer version kept in lockstep.

> **FR-60** — `PRIVACY_POLICY.md`'s eBird bullet shall gain a sentence naming
> the per-checklist project lookup: one request per checklist, only the user's
> own checklist ids, only after an explicit press, stored on the device, nothing
> sent without one. `website/privacy.html` shall carry the same sentence in the
> same edit. The sentence shall claim nothing beyond what the shipped code does.

> **FR-61** — No em dash (U+2014) shall appear in any new user-facing copy, in
> `docs/HELP.md`, or in any published prose surface touched by this change.

> **FR-62** — `frontend/package.json` and `src-tauri/tauri.conf.json` shall both
> be bumped to the same new patch version, and `CHANGELOG.md` shall carry an
> entry.

---

## Non-Functional Requirements

> **NFR-01 — Per-species aggregate performance:** rebuilding the county
> aggregates for a newly selected species on a 21,369-row export shall complete
> under 50 ms, measured as the minimum of seven complete executions. The Engineer
> shall report the isolated baseline's ratio to that ceiling; under 10x, the
> approach changes rather than the ceiling.

> **NFR-02 — Full-export aggregate performance:** building the county aggregates
> for the Statistics map over the full 21,369-row export shall complete under
> 200 ms under the same measurement rule and the same 10x margin requirement.

> **NFR-03 — Store performance:** the projects store shall be measured at
> capacity plus one, asserting **work done** (network calls avoided, entries
> admitted) rather than elapsed time, and shall demonstrate that one key past
> capacity is never much worse than not caching.

> **NFR-04 — Entry chunk:** no growth. `lib/entryChunk.test.ts` shall pass with
> the FR-21 extensions, and a fresh `npm run build` shall show the county
> geometry, `CountyLayer` and `vendor-maplibre` absent from the entry chunk's
> modulepreload set.

> **NFR-05 — Accessibility:** WCAG 2.1 AA shall hold at 320px and at 200% in-app
> text scale, in both themes, for every new control, legend, list, status region
> and section. Nothing shall introduce horizontal page scroll at 320px, and no
> new layout shall be made responsive with an inline style where a class is the
> correct instrument. Every new `select`, switch and grouped control shall carry
> an explicit accessible name; segmented controls shall carry `aria-pressed`.
> Any CSS-collapsed disclosure shall carry `inert` while closed, asserted as the
> literal attribute in both states. New touch targets shall meet the shipped
> minimum. Overflow shall be verified against a real render at both widths and
> both text scales, measuring the element against its container, never page
> `scrollWidth`.

> **NFR-06 — Color:** every new color shall come from `var(--sr-*)` tokens
> defined in both themes, with text meeting AA against the surface it sits on.
> The county ramp, its hatch sprites and its contrast guarantees shall be reused
> unchanged, and `countyContrast.test.ts` shall still pass.

> **NFR-07 — Offline:** county shading on both new maps shall be fully offline
> and keyless. The Projects section shall degrade to its offline state without
> losing already-paid-for answers, and shall never render a broken or blank
> block. No other tab shall gain a network dependency.

> **NFR-08 — Network etiquette:** all outbound requests shall go device to eBird
> with the user's own key, on demand only, one request start at a time under the
> shared 150 ms spacing, with no background or scheduled polling and no
> concurrency added beyond what the shared gate permits.

> **NFR-09 — Security:** checklist ids shall be shape-guarded and
> `encodeURIComponent`-wrapped before reaching a URL. Every field read from the
> eBird response shall be treated as untrusted and validated to an explicit ASCII
> pattern with matching anchors on both transports. Every lookup keyed on a
> response-derived string shall be read through `Object.hasOwn`. No project
> identifier shall become an href or steer an outbound request.

> **NFR-10 — Render purity:** no `Date.now()` or other impure call in a render
> body, `useMemo` or `useCallback`. TTL and freshness reads belong in handlers
> and effects or a module-level session constant; `react-hooks/purity` is
> build-blocking.

> **NFR-11 — Persistence:** everything durable shall go through the storage
> seam. Session-scoped UI toggles introduced by this feature shall use plain
> `useState` and shall be described in prose as "per-session, resetting on
> relaunch", matching the shipped mount-lifetime fact that a tab stays mounted
> once opened.

> **NFR-12 — Transport parity:** the desktop and FastAPI implementations of
> `projId`, `projectIds`, the `fields=projects` flag, and the 429 mapping shall
> be locked together by parity tests over a shared fixture, and each route or
> function shall keep its own 429 test even though the mapper is single-sourced.

> **NFR-13 — Tests:** vitest and pytest coverage for the shared geometry loader,
> the per-species aggregate path, the two new mount sites' on and off states
> (three separate parity assertions per FR-19), the store lifecycle including
> admission at capacity plus one, the sweep's target-set derivation across quit,
> resume and newer-export cases, each of the FR-51 display states, the label
> table's canonicalization and its unknown-identifier fallback, and the
> dual-transport field and 429 parity. Guards shall be mutation-checked in the
> forms the defect could actually return in, and any guard that partitions its
> work shall carry a per-partition non-vacuity assertion.

> **NFR-14 — Pre-push gate:** `npm run build` (not vitest and eslint alone)
> shall pass before this feature is pushed, and the backend suite shall pass.

---

## Out of Scope

- **Non-US counties.** The bundled geometry is US Census/TIGER only.
- **Completeness on either new map**, and every code path that would reach it
  from those surfaces.
- **Aligning Geographic Stats' per-county species counts with the escapee rule.**
  Named as the prerequisite for Completeness later, not done here.
- **County shading on the Calendar, Named Birds, or Map Explorer.** The Map
  Explorer's shipped behavior is unchanged except for FR-02's loader swap.
- **Changes to the shipped county metrics, ramp, tiers, or contrast tokens.**
- **Species-per-project**, per-project species lists, per-project maps, or any
  cross-tab drilldown from a project.
- **A project directory**, or anything about projects the user has not
  contributed to.
- **Any automatic or background sweep**, including a resume on relaunch.
- **Inferring project membership from the export.** It is not in the file.
- **Linking a project identifier anywhere.** No endpoint resolves one.
- **Persisting the new UI toggles across relaunches.** They match their
  session-scoped neighbours.
- **Changing how the escapee provenance pass acquires or paces its requests**,
  beyond the 429 mapping it inherits from FR-30 and FR-31.

---

## Open Questions

**OQ-01 — What TTL should a project answer carry?**
A submitted checklist's project assignment does not change retroactively, which
argues for a very long life; but an unbounded cache has no repair path if eBird
ever restates one. A 30-day TTL, matching the escapee store, would force a full
eight-minute re-sweep every month and destroy the feature's premise.
*Default if unanswered:* 365 days, governing re-consultation only per FR-37, so
an expired entry still counts and still displays.

**OQ-02 — What capacity should the store hold?**
`PROVENANCE_MAX_CHECKLISTS` is 32,768 for the same key type, which is 10x this
user's total but is genuinely reachable by a high-volume eBirder, and the
at-capacity state exists precisely because fill-and-stop admission never evicts.
*Default if unanswered:* 65,536, with the entry kept compact enough that the
document stays a reasonable settings blob, and the at-capacity display state
shipped per FR-51 regardless of the number chosen.

**OQ-03 — Where does the Projects section sit in the Statistics order?**
It is a contribution reading, which sits naturally with Effort and Outings, but
it is also the tab's only user-initiated network section, which argues for
placing it lower where it is less likely to be pressed by reflex.
*Default if unanswered:* immediately after "Effort & Outings", with the jump-nav
chip and the `docs/HELP.md` heading in the same position.

**OQ-04 — Should the Species Detail Counties control also offer a metric?**
Per species, "species" is always 1, so a metric switch would offer one useful
option and one meaningless one.
*Default if unanswered:* a single on/off control per FR-06, metric fixed to
`records`, per the strategic brief.

**OQ-05 — Should a completed sweep offer "Check again"?**
Re-running a complete sweep costs eight minutes and, under OQ-01's default, can
return nothing new for a year. Omitting it leaves a user who suspects a stale
answer with no route; including it invites an expensive press.
*Default if unanswered:* offer it, worded so the cost is visible before the
press, matching the escapee pass's approved `Check again` deviation.

**OQ-06 — What is the exact wording of each of the eleven display states?**
FR-51 fixes the state set, the controls, and the requirement that each carries
its denominator; the sentences themselves are The Designer's.
*Default if unanswered:* the escapee section's voice and sentence shapes,
adapted to checklists and projects, with no em dashes.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Shared geometry loader | Enabling Counties on two maps in one session issues one dynamic import and parses the geometry once; concurrent first enables share one Promise |
| QA-02 | Map Explorer unchanged by the loader swap | The Map Explorer's county rendering, loading copy, and first-enable behavior are identical to the pre-change build |
| QA-03 | Layer reuse | Both new mounts render layer id `sr-county-fill`, the 10 `--sr-county-N` tokens, the 800-feature cap with its chip, and the shipped popup and Counties-in-view list |
| QA-04 | Ramp untouched | `countyContrast.test.ts` and the existing county shading tests pass unchanged; no ramp, tier, token or metric value differs from HEAD |
| QA-05 | Use Textures on the new maps | With the toggle on, each new map paints `fill-pattern` from `sr-county-hatch-1..10`; with it off, the fill paint is byte-identical to the color branch |
| QA-06 | Basemap muting | Turning shading on mutes the basemap and dims pins/heatmap on each new map; turning it off restores both exactly |
| QA-07 | Species Detail control | The Counties control is off on mount, session-scoped, and carries an accessible name and `aria-checked` |
| QA-08 | Both Species Detail branches | Counties shades in Pins mode and in Heatmap mode, and switching between them preserves the shading and the shaded set |
| QA-09 | SightingsMap opt-in | Named Birds rows render with no county layer, no geometry request, and no basemap muting; every non-Species-Detail caller is byte-identical to HEAD |
| QA-10 | Filters apply | With a County filter, a date range, "Show subspecies", or "Show all forms" active, the shaded counties match the pins on the same map exactly |
| QA-11 | Per-species popup | The popup names the county and state, gives the selected species' checklist count there and its top locations, and renders no "1 species" count |
| QA-12 | Per-species legend | The legend names the selected species rather than "Total checklists per county", and a species with no US county rows renders the "no recorded counties to shade" note |
| QA-13 | Species switch | Selecting a different species reshades with no reload, no second geometry import, and no reset of viewport, map mode, or the Counties control |
| QA-14 | Statistics controls | The metric group offers exactly `species` ("Species") and `records` ("Checklists"), carries `aria-pressed` and a group label, and defaults to Species with Counties off |
| QA-15 | One input for map and tables | The Statistics map's aggregates are built from the same `filteredObs` / `checklists` memos that feed `computeGeo`, proven by a test that perturbs the input and sees both move |
| QA-16 | Cross-surface agreement | With Count all forms off, a county's Species and Checklists values on Statistics equal the Map Explorer's for the same county and metric |
| QA-17 | Count all forms | With the checkbox on, the Statistics map's values follow the tab |
| QA-18 | No Completeness | The Statistics surface offers no Completeness option, imports no completeness module, and issues no `/map/county-species` request in any state |
| QA-19 | Geographic Stats preserved | Ranked pins, `RankIcon` markers, popup, share pin, `fitToPins`, `mapReady` deferral, legend row, and the empty-pins suppression all behave as at HEAD |
| QA-20 | Overlay-off parity, three sites | With Counties off, the Species Detail Pins branch, the Species Detail Heatmap branch, and the Statistics map each render identically to the pre-change build, with three separate assertions |
| QA-21 | Zero network for shading | With the network disabled and no key entered, both maps shade from the loaded export and issue zero requests |
| QA-22 | Entry chunk guard | `entryChunk.test.ts` asserts neither new host statically imports the geometry or the shared loader, asserts the loader is off the App graph, and its guard-the-guard proves each subtree walk reaches `CountyLayer` |
| QA-23 | Build check | A fresh `npm run build` shows no county geometry, `CountyLayer`, or `vendor-maplibre` in `dist/index.html`'s modulepreload, and the entry chunk gains no modules |
| QA-24 | New fields present | `GET /checklists/{id}` returns `projId` and `projectIds` on both transports, with `""` and `[]` when eBird omits them |
| QA-25 | Field normalization parity | A shared fixture including a trailing-newline value and a non-ASCII-digit value produces identical `projId` / `projectIds` output on both runtimes |
| QA-26 | `fields=projects` | Under the flag both transports skip the location-name call and return `species: []`; the outbound eBird request count per checklist is exactly one |
| QA-27 | Existing callers unchanged | `fields=provenance` and an absent or unknown `fields` return byte-identical responses to HEAD; the escapee pass, Weather, Weather Backlog, Checklists, and List Comparer are unaffected |
| QA-28 | No new path prefix | `frontend/vite.config.ts` is unchanged, and the web path reaches the backend under `npm run dev` |
| QA-29 | Path set hygiene | `/checklists/` is absent from both `CACHED_GET_PATHS` and `EBIRD_GATED_PATHS`, asserted by test |
| QA-30 | No invented URL | No project identifier appears in any href, URL, or outbound request in any state |
| QA-31 | Backend 429 | An upstream 429 on `/checklists/{id}` returns 429 with the shared detail and a bounded, re-serialized `Retry-After`; the mapper is imported, not copied |
| QA-32 | Desktop 429 | The desktop checklist path raises with `status: 429`, `retryAfterSec`, and the shared detail, through the same extracted mapper `mapService` uses |
| QA-33 | Non-429 unchanged | 400, 404, 401, and 502 outcomes keep their exact status codes and detail strings on both transports |
| QA-34 | Store shape | The store validates every entry on load, drops malformed entries without throwing, dedupes in-flight requests, and survives a corrupt document as an empty store with no crash |
| QA-35 | Join-derived display | Every displayed count, date and share is derived by joining store keys against the loaded backup; the store itself holds no dates, names or counts |
| QA-36 | Fill-and-stop admission | At capacity a new key is refused and no existing entry is evicted; measured at capacity plus one as work done, not elapsed time |
| QA-37 | Admission not consumed | Re-merging one existing id fifty times admits no new key and leaves remaining capacity unchanged |
| QA-38 | Errors never cached | After a failed request or a 429, the store holds no entry for that id and a retry issues a fresh outbound request |
| QA-39 | TTL semantics | An expired entry still counts as checked and still displays; the next sweep re-asks it |
| QA-40 | One write path | Every persisted entry is written through the store's single chokepoint; a test fails if a caller can write directly |
| QA-41 | Nothing without a press | Opening Statistics, switching tabs, relaunching, and loading a new export each issue zero project requests |
| QA-42 | Statistics-only initiation | Mounting any other tab issues zero project requests and imports no sweep module |
| QA-43 | Target-set derivation | With no cursor stored, resuming after a simulated quit asks only about unanswered ids; loading an export with 158 added checklists asks only about those 158 |
| QA-44 | Newest first | The request order is checklist date descending with submission id descending as tie-break, asserted on a fixture with date ties |
| QA-45 | Pacing | Request starts are at least 150 ms apart, measured on client observation of starts with a settled main thread; concurrency never exceeds the shared gate's |
| QA-46 | Shared cooldown, both directions | A 429 raised by the sweep delays a subsequent Map Explorer eBird call, and a 429 raised by the Map Explorer delays the sweep; the sweep waits the cooldown out and resumes |
| QA-47 | Bounded per-item retries | A checklist failing repeatedly stops after the shipped retry bound, is left unanswered, is excluded from the checked figure, and is counted as a failure |
| QA-48 | Retry scope | The retry control re-asks only the unanswered ids and issues no request for an already-answered one |
| QA-49 | Stop | Pressing Stop starts no further request, retains every answer already written, and leaves the section in its stopped state |
| QA-50 | Export swap mid-pass | Loading a different export cancels the running pass and recomputes the target set |
| QA-51 | Id guard | A malformed submission id is never requested, is excluded from the denominator, and is reported as a skipped count when nonzero |
| QA-52 | Never-run state | Before any sweep the section shows no count and no zero, names the exact checklist total, derives its duration estimate from that total and the 150 ms spacing, says the estimate is a floor, and offers exactly one start control |
| QA-53 | Denominator always present | In every state that shows a tally, the checked count and the export total both render; no tally renders alone |
| QA-54 | Eleven states | Never run, running, cooldown, stopped, partial, complete, unanswered-remaining, at-capacity, no-key, offline, and error each render distinct copy and exactly the controls FR-51 assigns them |
| QA-55 | Partial claims nothing extra | After a simulated relaunch mid-sweep the partial sentence states counts only and does not claim the user stopped it |
| QA-56 | Live region | The status region is in the accessibility tree from first render, is never `display: none`, announces a repeated identical message twice, and its emission is throttled at the source at 2,000 ms with terminal statuses and the first definite figure exempt |
| QA-57 | Announcement rate | The rate is measured against a real-duration pass, not a fast mock, and the sentence, progress bar and `N / M` readout never disagree on screen |
| QA-58 | Progress bar | While running, a `role="progressbar"` renders with an explicit `aria-label`, `aria-valuenow` and `aria-valuemax`, beside an `N / M` readout |
| QA-59 | Project rows | Each row carries a label, a checklist count, a contributed date span, and a share routed through `fmtSharePct`; rows are ordered by count then label and carry no rank numbers |
| QA-60 | Atlas correctness | On the reference account the section names the California Breeding Bird Atlas with a checklist count and date span matching a manual audit of those checklists |
| QA-61 | Counted once | A checklist naming one project by both `EBIRD_ATL_CA` and `1050` contributes one to that project's count |
| QA-62 | Unknown project shown | A `projId` outside the generic portal set, and an unrecognized numeric id, both appear as projects with their raw identifiers rendered verbatim |
| QA-63 | Earned zero | With at least one checklist checked and no project found, the section states that against its denominator rather than rendering an empty list |
| QA-64 | Portal block separate | The `projId` breakdown renders as a subordinate "how you submitted" block and is never presented as a project |
| QA-65 | Label table safety | `PROJECT_LABELS` and both `checklistMeta.ts` tables are read through `Object.hasOwn`; `protocolName('constructor')` and the equivalents return the raw input, not an inherited member |
| QA-66 | Per-species performance | Rebuilding aggregates for a newly selected species on a 21,369-row fixture completes under 50 ms as the minimum of seven complete executions, with the isolated baseline at least 10x under |
| QA-67 | Full-export performance | Building the Statistics aggregates over the same fixture completes under 200 ms under the same rule and margin |
| QA-68 | Accessibility at 320px | No new control, legend, list, status region or section produces horizontal overflow at 320px in either theme, measured element against container in a real render |
| QA-69 | Accessibility at 200% | The same surfaces stay legible and operable at 200% in-app text scale in both themes, verified by screenshot for any native control |
| QA-70 | Names and states | Every new switch, group and control carries an explicit accessible name; segmented controls carry `aria-pressed`; any collapsed disclosure carries the literal `inert` attribute, asserted in both states |
| QA-71 | Color tokens | Every new color reads a `var(--sr-*)` token defined in both themes and meets AA against its own surface; no hardcoded hex or RGB is introduced |
| QA-72 | Render purity | `npm run build` passes with `react-hooks/purity` enforced; no `Date.now()` in a render body or memo |
| QA-73 | Storage seam | No `localStorage` access is introduced; every durable write goes through the storage seam |
| QA-74 | Offline degradation | Offline, county shading works and the Projects section keeps every answered result, renders its offline state, and offers no action it cannot perform |
| QA-75 | Docs in sync | `docs/HELP.md`, `README.md` and `website/` describe the shipped behavior; `HelpDocs.tsx`'s TOC and `helpToc.test.ts` cover the new heading; any duration claim reads "per-session, resetting on relaunch" |
| QA-76 | Privacy statement | `PRIVACY_POLICY.md` and `website/privacy.html` name the per-checklist project lookup in the same edit, and every clause is true of the shipped request behavior |
| QA-77 | No em dashes | `grep -n '—'` over all new user-facing copy, `docs/HELP.md`, and the touched published surfaces returns nothing |
| QA-78 | Release hygiene | `frontend/package.json` and `src-tauri/tauri.conf.json` are bumped to the same version and `CHANGELOG.md` has an entry |

### Requirement coverage map

Written out per requirement rather than as ranges, so a gap is visible rather
than implied.

| Requirement | Checks |
|---|---|
| FR-01 | QA-01 |
| FR-02 | QA-02 |
| FR-03 | QA-03, QA-04 |
| FR-04 | QA-05 |
| FR-05 | QA-06 |
| FR-06 | QA-07 |
| FR-07 | QA-08 |
| FR-08 | QA-09 |
| FR-09 | QA-10 |
| FR-10 | QA-11 |
| FR-11 | QA-13 |
| FR-12 | QA-12 |
| FR-13 | QA-14 |
| FR-14 | QA-15 |
| FR-15 | QA-16, QA-17 |
| FR-16 | QA-18 |
| FR-17 | QA-19 |
| FR-18 | QA-12, QA-14 |
| FR-19 | QA-20 |
| FR-20 | QA-21, QA-74 |
| FR-21 | QA-22 |
| FR-22 | QA-23 |
| FR-23 | QA-24, QA-28 |
| FR-24 | QA-25 |
| FR-25 | QA-26 |
| FR-26 | QA-27 |
| FR-27 | QA-26, QA-27 |
| FR-28 | QA-29 |
| FR-29 | QA-30 |
| FR-30 | QA-31 |
| FR-31 | QA-32 |
| FR-32 | QA-33 |
| FR-33 | QA-34, QA-73 |
| FR-34 | QA-35 |
| FR-35 | QA-36, QA-37 |
| FR-36 | QA-34 |
| FR-37 | QA-38, QA-39 |
| FR-38 | QA-40 |
| FR-39 | QA-41 |
| FR-40 | QA-42 |
| FR-41 | QA-43 |
| FR-42 | QA-44 |
| FR-43 | QA-45, QA-46 |
| FR-44 | QA-47, QA-48 |
| FR-45 | QA-49 |
| FR-46 | QA-50 |
| FR-47 | QA-51 |
| FR-48 | QA-75 |
| FR-49 | QA-52 |
| FR-50 | QA-53 |
| FR-51 | QA-54, QA-55 |
| FR-52 | QA-56, QA-57 |
| FR-53 | QA-58 |
| FR-54 | QA-59, QA-60, QA-61 |
| FR-55 | QA-62, QA-63 |
| FR-56 | QA-64 |
| FR-57 | QA-62, QA-65 |
| FR-58 | QA-75 |
| FR-59 | QA-75 |
| FR-60 | QA-76 |
| FR-61 | QA-77 |
| FR-62 | QA-78 |
| NFR-01 | QA-66 |
| NFR-02 | QA-67 |
| NFR-03 | QA-36 |
| NFR-04 | QA-22, QA-23 |
| NFR-05 | QA-68, QA-69, QA-70 |
| NFR-06 | QA-04, QA-71 |
| NFR-07 | QA-21, QA-74 |
| NFR-08 | QA-41, QA-45 |
| NFR-09 | QA-25, QA-30, QA-51, QA-65 |
| NFR-10 | QA-72 |
| NFR-11 | QA-73, QA-75 |
| NFR-12 | QA-25, QA-31, QA-32, QA-33 |
| NFR-13 | QA-20, QA-22, QA-34, QA-43, QA-54 |
| NFR-14 | QA-23, QA-72 |
