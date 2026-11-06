# Strategic Brief: Hotspot Share Stat

## What We're Building
One new statistic on the Statistics tab: the share of the user's checklists
submitted at public eBird hotspots versus personal locations, shown as a
two-segment share bar with its counts ("1,234 of 3,300 at hotspots"), placed
in the **Geographic Stats** section directly above "Top locations by
checklists".

## Why Now
The user asked for it in those words ("the percentage of checklists that are
reported from personal locations versus public hotspots, in an appropriate
section"). The Statistics tab already answers the two neighbouring questions,
where you bird (top locations, counties, states) and how (protocol
distribution, complete-checklist share), and this is the one question between
them that eBird's own site never answers about your data. Every ingredient is
already on the tab: the per-checklist location ids, the public-hotspot
classification the section already uses to decide which location names get a
hotspot link, and the share-bar idiom from Effort & Outings. The cost is one
pure derivation and one block of JSX, which is why it earns a build slot now
rather than queueing behind larger work.

## The User Problem
A birder with years of checklists has no way to see, from eBird, how much of
their birding is "hotspot birding" versus their own patches, yard, and
one-off personal pins. The export does not carry the distinction, so the only
way to know is to page through locations by hand. SnowRaven already knows
which of the user's locations are public hotspots (it links them), so the
number is a few lines away and the user should simply be able to read it.

## What the computation must rely on (established from the repo)
- **The export has no hotspot column.** `MyEBirdData.csv` carries a
  `Location ID` (`L…`) and a location name; whether that id is a public
  hotspot or a personal location is not in the file (`lib/hotspotSet.ts`
  header comment, and the parser in `lib/parseEbird.ts`).
- **The app already classifies it, and the Statistics tab already uses that
  classification.** `lib/hotspotSet.ts` builds one region-scoped Set of
  public-hotspot location ids per distinct `stateProvince` region in the
  backup (one `GET /map/hotspot-region` per region, typically one to three,
  dual-transport, gated by the eBird pacing contract, with the bounded
  re-ask rounds for a 429). Today that answer lives only in memory and in
  the ~90 s `CACHED_GET_PATHS` layer, so every launch asks eBird again.
  `BirdingStats.tsx` calls `useHotspotSet()` at its top level today to
  render `HotspotLink` on every location name in the section. The statistic
  reads the same Set through the same hook call.
- **The answer is persisted after its first lookup (user direction at the
  design review, `decisions.md` section 1).** The per-region hotspot answer
  is written once it has been looked up, in the project's long-TTL durable
  cache shape (`lib/countyCompletenessCache.ts` as the reference: a
  storage-seam document with an in-memory mirror, TTL-gated reads, per-entry
  validation on load with malformed entries dropped, a strict entry cap plus
  a serialized payload budget with eviction, an in-flight dedupe map, errors
  and 429s never cached, and a stale entry served when a refresh cannot be
  made). A later launch reads the persisted answer with no request. A region
  the export newly introduces is the only new request. A region already
  answered is asked again only when its entry has aged past the TTL, and a
  refresh that fails keeps serving the stale answer rather than dropping
  the region to unresolved. This is the same pattern the Targets and Map
  Explorer statistics already follow to avoid burdening eBird's servers.
- **Network posture, in the durable form:** the statistic adds no third-party
  request, no new endpoint or host, and no request moved between components;
  the only network dependency is the region fetch the hotspot links already
  issue, with the user's own eBird key. The change in posture is downward:
  one request per region the export has newly introduced, plus one bounded
  TTL refresh per already-answered region, and zero requests on a launch
  whose regions are all answered and within TTL. The eBird pacing contract
  and the 429 re-ask rounds are unchanged; the durable store becomes the
  single caching layer for `/map/hotspot-region`, which therefore leaves
  `CACHED_GET_PATHS` (one caching layer per call). The Tauri CSP and
  `http:allow-fetch` scope need no change. On web/Pi the fetch goes through
  the user's own server as every `/map/*` call does, and the persisted
  document rides the settings route like the reference store.
- **The honest options were three, and the first is the decision, now with
  persistence.** (1) Reuse the existing hotspot Set AND persist it: no new
  kind of request, consistent with the links beside it, and after the first
  answer the classification is available offline and on every later launch
  without asking eBird; it is still unavailable until the user has an eBird
  key and a region has answered once. (2) Ask eBird per location
  (`ref/hotspot/info/{locId}`): one request per distinct location, thousands
  for a big export, against the standing rule that a statistic over the
  user's own file should not need a network call; rejected. (3) Infer from
  the file alone (for example, a location visited by the user on many days):
  a guess dressed as a statistic; rejected. Option 1, persisted, is the
  decision.

## Success Criteria
- With an eBird key entered and the backup loaded, the Geographic Stats
  section shows the share bar with the hotspot percentage, the personal
  percentage, and the counts behind them, and the numbers agree with the
  hotspot links in the same section (every top location drawn as a link
  counts as a hotspot checklist; every plain one does not).
- The denominator the bar states is the number of checklists in the export
  (distinct Submission IDs), and it does not move when "Count all forms" is
  toggled.
- With no eBird key, the block says that it needs the key (the Projects
  section's no-key idiom, with the inline Settings link), and never shows a
  percentage.
- While a region's first lookup is still pending, or when a region has never
  answered (offline before any answer, a failed first fetch, a 429 still in
  its re-ask rounds, or a checklist whose region code cannot be asked), the
  block says how many checklists are not yet classified rather than folding
  them into "personal"; it never renders a bare "0% hotspots" for an
  unresolved state. When a re-ask round later adds ids, the bar updates on
  the mounted tab with no user action, through the existing hotspot-set
  epoch.
- After every region in the backup has answered once, a later launch, online
  or offline, shows the percentages from the persisted answer with no
  request to eBird; the links beside the bar read the same persisted Set.
- A region whose persisted answer has aged past the TTL is refreshed with one
  request, and until that request answers (or if it fails or is rate
  limited) the bar keeps showing the stale answer rather than flipping to
  unclassified.
- Replacing the backup with one that introduces a new region triggers that
  region's request and no other; the regions already answered are read from
  the persisted document (purge on clear only, never on replace).
- "Delete all data" in Settings, and both iCloud clear paths, remove the
  persisted hotspot answer along with the other derived stores; the next
  backup starts from an unresolved state and asks again.
- The persisted document stays within the web/Pi settings-route budget at its
  worst case (a region's hotspot list can run to tens of thousands of ids),
  with the cap proven through the store's own load path.
- A nonzero share that rounds to zero displays as "<1%" (`fmtSharePct`), and
  the two displayed whole percentages come from one rounding so they read
  as a partition of 100%.
- A file whose checklists are all at hotspots, or none, renders a full bar
  with its counts, not an empty state.
- The block is readable in both themes at 320px and 200% text, with the
  percentages as surface text beside the bar (the F032 pattern the
  Complete-checklists bar already follows), and the bar itself `aria-hidden`
  with the sentence carrying the information.
- `docs/HELP.md`'s Geographic Stats paragraph gains one sentence naming the
  statistic in the same change.

## Scope
- A pure helper (in `lib/birdingStats.ts` or a sibling `lib/` module) that
  takes the checklist rows and the hotspot Set, plus the set of regions that
  answered, and returns `{ hotspot, personal, unclassified, total }`, unit
  tested at the three edge shapes (all hotspot, none, unresolved) and on a
  mixed fixture.
- The Set membership test is the existing `isPublicHotspot` (the shipped
  `LOC_ID_RE` shape check plus an O(1) `Set.has`); the derivation is one
  linear pass over the checklist rows on the main thread, memoised on the
  checklist array and the Set, and it is declared in the schema as a loop
  over parsed rows with its linear cost per draw, per `.claude/rules/security.md`.
- Exposing which regions have answered from `lib/hotspotSet.ts` (it already
  knows: `askRegions` returns the answered ids and the 429-limited regions;
  a failed region is currently skipped silently). The smallest honest shape
  is a resolution summary read beside the Set and moved by the same epoch,
  so "pending", "answered" and "unanswered" are distinguishable from
  "answered and empty". Consumers of the Set are unchanged.
- A persisted per-region hotspot document behind `lib/hotspotSet.ts`, in the
  `countyCompletenessCache` shape: its own storage-seam key, one entry per
  region (the id list and its fetch time), a long TTL, validation on load,
  an entry cap and a serialized payload budget sized against the settings
  route (`settingsRouteBudget.test.ts` gains a row), in-flight dedupe, and
  no entry written for an error or a 429. The Set the hook returns is the
  union of the persisted entries plus whatever this session has fetched.
- Registration of that document in `lib/clearDerived.ts`
  (`purgeDerivedOnClear`) with a production purge export and a
  `cacheInventory.test.ts` row, because its KEY SET is the list of regions
  the user has birded, read off the export; the purge supersedes in-flight
  work per the registry's rules (generation captured at the fetch
  chokepoint).
- Removing `/map/hotspot-region` from `CACHED_GET_PATHS`, so the durable
  store is the route's one caching layer; the eBird gate stays where it is.
- The JSX block in Geographic Stats, reusing the Effort section's
  two-segment share bar idiom, `SubLabel`, `Divider`, the `--sr-*` tokens
  already used there, and the Projects no-key sentence and link.
- The count-bearing sentences live in a copy module and ride the existing
  plural-agreement and em-dash sweeps.
- Help copy (one sentence), the CHANGELOG entry, and the standard six-file
  version bump at ship.

## Out of Scope
- Any new eBird request, endpoint, host, or per-location lookup.
- A per-location breakdown (which personal locations, a ranked list of
  hotspots): the top-location lists beside it already do that.
- A share of distinct locations (how many of your places are hotspots) as a
  second figure; it is a different question and can be its own idea.
- A species or lifer split by hotspot versus personal.
- Changing how `HotspotLink` or the Map Explorer classify hotspots, or
  changing the eBird pacing or the 429 re-ask policy. The hotspot answer's
  lifetime does change (it is persisted); its membership test, its source
  endpoint and its pacing do not.
- Syncing the persisted hotspot answer through iCloud Sync. It is eBird's
  public data, re-derivable on any device for one request per region, and
  the reference store (`county-completeness-v1`) is likewise excluded from
  sync; carrying it would add a per-item kind with a Rust twin for no gain
  the user can see.
- A per-launch or on-demand "refresh hotspots" control; the TTL is the only
  refresh.
- Showing the statistic on the Calendar tab or any zero-network surface.
- README and website copy: a sub-statistic inside an existing section does
  not earn a sentence there; no proposal is made.

## Key Decisions
- **Section: Geographic Stats, above "Top locations by checklists".** The
  question is about where the user birds, and that section is where the
  app already draws the hotspot distinction (linked versus plain names), so
  the bar explains the links beneath it. Effort & Outings was considered for
  its share-bar idiom and rejected because hotspot status is a property of
  the location, not of effort.
- **Denominator: every checklist in the export (distinct Submission ID),
  computed from the unfiltered observations, as the Projects section does
  (`projectChecklists` from `effectiveObs`).** The countability filter
  ("Count all forms") governs species counts, not whether a checklist
  exists; a checklist whose only row is a spuh is still a checklist at a
  location. The Life List Totals "Checklists" tile uses the filtered memo,
  so the two can differ by the handful of spuh-only checklists; the bar
  states its own "n of m" so no cross-tile arithmetic is implied. This is the
  precedent already accepted in `BirdingStatsProjectsDenominator.test.tsx`.
- **Shared checklists need no special handling.** Each sharer's copy has its
  own Submission ID in that user's export, so one row per Submission ID is
  the right count. Countability does not bear on the denominator.
- **Classification source: the existing region-scoped hotspot Set, now
  persisted after its first lookup, nothing else.** No new kind of network
  call, and fewer calls over time: a region is asked once, then only
  re-asked after a long TTL, and a launch with every region answered asks
  nothing (user direction, `decisions.md` section 1: "cache it once it is
  looked up once, then only look up the new changes, like we do with other
  stats to avoid burdening eBird's servers"). The accepted lag (a hotspot
  promoted or demoted since the last fetch) grows from one session to the
  TTL, and the links beside the bar carry the same lag because they read
  the same Set. The TTL is of the order of the reference store's 30 days;
  the Architect fixes the number.
- **The durable store is the one caching layer for the route.**
  `/map/hotspot-region` leaves `CACHED_GET_PATHS`; the store owns TTL,
  dedupe and eviction, and the eBird gate keeps owning pacing. A 429 or any
  error writes nothing, so a failed region retries by the existing re-ask
  rounds and, once persisted, a stale answer outlives a failed refresh.
- **Purge on clear only, never on replace.** The document registers in
  `lib/clearDerived.ts` because its keys are the regions read off the
  user's export; "Delete all data" and the iCloud clear paths remove it.
  A replaced or newer backup keeps every answered region and asks only for
  a region it newly introduces, which is what makes the request count fall
  over time rather than reset on every upload.
- **Not synced.** The persisted answer stays on the device that fetched it,
  as the reference store does; each device pays one request per region once.
- **Unresolved is a third state, never "personal".** A checklist whose
  region has never answered is reported as not yet classified. With
  persistence this state is confined to the first lookup of a region (a
  fresh install, a cleared store, or a newly introduced region); a region
  with a persisted answer, fresh or stale, is always classified. This needs
  the small resolution-summary export from `lib/hotspotSet.ts` named in
  Scope; the Planner and Architect decide its exact shape, but the bar must
  never show a percentage computed over a never-answered region as if it
  were settled.
- **No key: the Projects idiom.** The block renders the "needs your eBird
  API key" sentence with the Settings link, read from the component's
  existing `hasEbirdKey`, and no bar.
- **Display rules carried forward:** `fmtSharePct` for the lone share, one
  rounding for the pair, percentages as surface text not in-bar text, the
  bar `aria-hidden`, counts formatted with `fmt`, no em dashes.
- **Published copy at ship:** the only user-approval stop this feature
  creates is the Fastlane changelog text at release; Help and in-app text
  need no stop.
