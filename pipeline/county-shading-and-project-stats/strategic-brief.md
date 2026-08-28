# Strategic Brief — County Shading and Project Contributions

## What We're Building

Two additions, one build. **County shading reaches the Species Detail and
Statistics maps**: on Species Detail, shaded per species, so a birder can see at
a glance exactly which counties they have recorded that bird in; on Statistics'
Geographic Stats map, the all-species county view the Map Explorer already
offers. And **the Statistics tab gains a "Projects" section** reporting which
eBird projects the user has contributed to — the California Breeding Bird Atlas
first among them — built from a paced, resumable, persistent sweep of their own
checklists through their own eBird key.

## Why Now

The county overlay has been shipped and hardened since v0.5.46, gained
Completeness in v0.5.54, and is exercised daily on the Map Explorer. Extending it
is reuse of a proven component, not new machinery, and both target maps have sat
on the roadmap's *On the Horizon* list ("County shading on the Species Detail and
Statistics maps" and "Per-species county choropleth") since that feature landed.
This run merges them, which is the right shape: the per-species case is the same
component fed filtered input, not a second feature.

The projects half is newly asked for and newly *true*. Sampling the user's own
checklists established that they became an active California Breeding Bird Atlas
contributor in 2026 — seven atlas checklists in the sample of forty-five — and
the app has no way to show it. Statistics already answers "how am I doing" from
every other angle; contribution to the shared projects a birder's records feed
into is a real gap in that dashboard.

And with the App Store debut shipped at 1.0.4 and *Up Next* down to Windows code
signing alone, this is the first substantive feature run after the store release.

## The User Problem

**Counties.** A birder looking at a species asks "where have I found this bird?"
and gets a pin map. Pins answer "at which spots," not "across which counties" —
and county is the unit birders actually think and compete in. The information is
already in the export (every observation carries State/Province and County) and
the app already draws it, just not here. The same gap exists one level up on
Statistics: the Geographic Stats map shows six ranked location pins on a
continent, which says nothing about the shape of a birder's geographic coverage.

**Projects.** eBird projects are how a birder's personal records become a
contribution to something shared. A breeding atlas checklist is the same act of
birding as any other, but it feeds a survey with a start and an end date and a
coverage goal. A birder has no easy way to see how much they have given to one —
eBird itself does not surface a personal project tally — and SnowRaven, which
exists to show a birder their own data in ways eBird does not, is the natural
place for it.

## Success Criteria

- On Species Detail, turning on Counties shades the counties where the selected
  species has been recorded, and only those; switching species reshades without a
  reload; a county's popup names the county and how many times that bird was
  recorded there.
- On Statistics, the Geographic Stats map can shade counties by species count or
  by checklist count, and the numbers it shows agree with the Map Explorer's for
  the same county and metric.
- Neither map loads the 3.85 MB county geometry until a user turns the overlay
  on, and the entry chunk is unchanged. Both maps behave exactly as they do today
  when the overlay is off.
- County shading needs no network and no API key: it works offline, immediately,
  over the loaded export.
- The Projects section, before it has ever been run, shows no numbers at all —
  not a zero — states plainly what running it would cost, and offers to run it.
- After a completed sweep, the section names the California Breeding Bird Atlas
  (and any other project in the user's data) with a checklist count and a date
  range that match what a manual audit of those checklists would give.
- A partial or interrupted sweep shows its tally *with its denominator* — "across
  N of 3,252 checklists checked" — so the number reads as a floor, never as a
  finished answer.
- Stopping the sweep, closing the tab, or quitting the app keeps every answer
  already paid for; resuming asks only about checklists not yet answered.
- A second run after loading a newer export asks only about the checklists the
  new export added.
- The sweep never outpaces the app's existing eBird pacing contract, and a 429
  anywhere still slows everything on the key.

## Scope

**County shading**

- Mount the shipped `CountyLayer` on Species Detail's Sighting Locations map and
  on Statistics' Geographic Stats map, both currently plain `<SnowMap>` mounts.
- Species Detail: a single on/off **Counties** control, shaded by the user's
  record count for the selected species. Popup content adapted to the
  one-species case (county, state, records of this bird, and its top locations
  there).
- Statistics: metric choice between **species** and **records**, matching the Map
  Explorer's two count metrics and its quantile ramp, tokens, textures, and
  contrast guarantees.
- Aggregates built from the same `buildCountyAggregates` path over the same
  parsed export; the per-species case is that function over species-filtered
  observations, so both maps and the Map Explorer answer from one implementation.
- County geometry stays dynamic-imported on first enable, off the entry chunk,
  with the existing `entryChunk.test.ts` guard extended to cover the two new
  call sites.

**Projects**

- Expose eBird's `projId` and `projectIds` on the existing `/checklists/{id}`
  path on **both** transports (FastAPI and the Tauri service), additively, in
  the shape the shipped `exoticCategory` / `protocolId` fields already use.
- A **Projects** section on Statistics: the projects contributed to, each with a
  checklist count, a date range, and its share of the checklists swept.
- A clearly separate, secondarily-labelled **how you submitted** reading from
  `projId` (eBird web/app vs. Merlin), which comes free in the same response.
- A user-initiated, cancellable, resumable sweep over the user's checklists,
  newest first, running through the existing `lib/ebirdGate.ts` pacing contract,
  with results in a durable storage-seam cache following the shipped
  `hotspotActivityCache` / `countyCompletenessCache` pattern.
- A bundled label table for known project codes and ids, falling back to the raw
  identifier when a project is unknown.
- Honest states throughout for offline, missing key, and provider failure, in the
  three shapes the app already uses.
- `docs/HELP.md`, `README.md`, `website/`, and the `PRIVACY_POLICY.md` eBird
  bullet updated in the same change — the privacy bullet gains a sentence naming
  the per-checklist project lookup, exactly as v0.5.92 named the per-hotspot
  activity call.

## Out of Scope

- **Non-US counties.** v0.5.46 draws US Census/TIGER geometry only; other
  countries need different boundary sources and stays a separate roadmap item.
- **The Completeness metric on the two new maps** — see Key Decisions.
- **Aligning Geographic Stats' per-county species counts with the escapee rule**
  (the standing roadmap item deferred out of v0.5.87). Named here because it is
  the prerequisite for Completeness later, not because it is being done now.
- **Species-per-project**, per-project species lists, per-project maps, or any
  cross-tab drilldown from a project.
- **A project directory** — browsing or discovering projects the user has not
  contributed to. This section reports the user's own contribution, nothing more.
- **Any automatic or background sweep.** Nothing is fetched without a press.
- **County shading on the Calendar, Named Birds, or Map Explorer.** The Map
  Explorer is unchanged by this run.
- **Changes to the shipped county metrics, ramp, tiers, or contrast tokens.**
- **Inferring project membership from the export.** It is not in the file; see
  Key Decisions.

## Key Decisions

- **The premise that both target maps already draw the breeding atlas is wrong,
  and the brief is written on the corrected fact.** `AtlasLayer` and
  `CountyLayer` are mounted only on `MapExplorer.tsx`. Species Detail's map
  (`SightingsMap` / the heatmap branch) and Statistics' Geographic Stats map are
  plain `<SnowMap>` mounts with pins. The work is therefore "mount an overlay on
  two maps that carry none," not "add one more overlay beside an existing one."
  It remains small — `CountyLayer` is self-contained and both targets are
  `<SnowMap>` children — but the geometry, the toggle, the popup, and the entry-
  chunk guard all have to be wired at each site rather than inherited.

- **The two new maps carry species and records; Completeness stays on the Map
  Explorer.** This deliberately contradicts the roadmap entry's note that the
  extension "would now carry all three metrics." Three reasons: Completeness is
  the one metric that makes an eBird call per county, and this run already
  carries a 3,252-call sweep; on Statistics it would sit inches from the
  Geographic Stats county tables, whose species counts use a *different*
  numerator rule (the escapee alignment deferred in v0.5.87), making a known
  disagreement visible side by side; and per species, Completeness has no
  meaning at all. Reversal condition: close the escapee-numerator alignment
  first, then Completeness can join the Statistics map as a follow-on.

- **Project membership is not in the eBird backup file and cannot be inferred
  from it.** All 23 columns were checked; none names a project, and the Protocol
  column carries only generic protocols. The fact lives on eBird's
  `/product/checklist/view/{subId}` response as `projId` and `projectIds`, at
  one API call per checklist. There is no cheaper source, and no offline
  heuristic will be substituted for the real answer — the same rule the escapee
  work applied when it refused to classify provenance from the bundled taxonomy.

- **This is a thing you run, not a number that appears, and the section says so.**
  The escapee pass resolves 264 species from a 73-checklist greedy cover because
  provenance is a per-species question with a monotone answer. Project membership
  is a per-checklist fact with no cover reduction available: a complete tally
  means asking about all 3,252 checklists, which at the app's 150 ms request
  spacing is roughly eight minutes at the floor. The section is therefore
  explicitly user-initiated, states the cost before the first request, reports
  progress against a definite denominator, and is stoppable at any point.

- **Every tally is shown with its denominator, and a partial tally is a floor.**
  "3 projects across 412 of 3,252 checklists checked" is honest; "3 projects" on
  a partial sweep is not. A never-run section shows no count at all rather than a
  zero, because zero is a claim the app has not earned.

- **The sweep is one-time-expensive and then cheap forever, which is what makes
  it viable.** A submitted checklist's project assignment does not change
  retroactively, so answers persist under a long TTL and a later run asks only
  about checklists a newer export added. This is what turns an eight-minute cost
  into a one-time cost.

- **The projects cache uses fill-and-stop admission, not FIFO.** Evicting an
  entry here destroys a paid-for network answer and, at capacity+1, would do so
  on every pass forever — the exact reasoning recorded for the v0.5.87 escapee
  species index. The county-completeness FIFO precedent does not apply, because
  there an eviction costs one redundant request and loses no answer.

- **The sweep runs newest-first.** Recent checklists are where project
  participation is most likely and most interesting, so a partial sweep is useful
  long before it is complete. All seven atlas checklists in the sample were dated
  2026.

- **The unit is checklists.** A project contribution is naturally "how many
  checklists I submitted to it," reported with a date range and a share of the
  checklists swept. Species-per-project is derivable but adds a join and a
  display surface for a second-order question; it stays out.

- **"Submitted via Merlin" is not a project, and the section will not present it
  as one.** `projId` mixes a submission portal (`EBIRD`, `EBIRD_MERLIN`) with a
  project portal (`EBIRD_ATL_CA`), while `projectIds` (`[1050]` for the
  California atlas) is the membership array. Projects are driven by
  `projectIds` plus non-generic `projId` values; the portal breakdown renders
  separately and is labelled as how a checklist was submitted.

- **A project's name is never invented.** No public eBird endpoint resolves
  project id 1050 to "California Breeding Bird Atlas." A small bundled label
  table covers known codes and ids; anything unknown shows its raw identifier
  verbatim.

- **The sweep asks for the minimum, using the `fields=` flag pattern already on
  the route.** `fields=provenance` established that this path can skip work a
  caller does not need; a projects pass needs neither the location name nor the
  resolved species list, so it should ask for neither. Both transports stay in
  parity, as they must.

- **Alignment with the founding brief holds on both halves.** County shading is
  pure offline computation over the user's own file. The projects sweep is a
  device-to-provider call to eBird with the user's own key, on demand, in exactly
  the shape three shipped features already use — no new provider, no account, no
  developer-operated server, nothing collected. It works alongside eBird by
  showing a birder something eBird holds but does not surface to them.
