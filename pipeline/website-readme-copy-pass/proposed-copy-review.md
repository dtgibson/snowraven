# Proposed copy: website and README, written from scratch

For the user, before anything is written to `website/` or `README.md`. Everything below
describes files in `pipeline/website-readme-copy-pass/proposed/`; the live files are
byte-identical to HEAD.

## Word counts

| File | Today | Proposed | Change |
|---|---|---|---|
| `README.md` (whole file) | 2,043 | 833 | -59% |
| `website/index.html` (whole file, markup included) | 4,939 | 2,875 | -42% |
| `website/index.html` (readable prose only, tags stripped) | 2,868 | 953 | -67% |

The register, as applied per sentence: each section is one sentence saying what the tab is
and, where it changes whether a reader wants the app, one more saying what they get. No
control, action, section within a tab, threshold, chart, list or screen position. No
sentence about what the app does not do outside the privacy posture. No in-app label a
stranger could not read. No "you already have", "your own", "actually", "right now". No
"so you can" closer that explains the obvious purpose. No inventory: two or three things
per section, and the screenshot and the docs carry the rest. Ceiling: two sentences per
website section, one or two in the README.

## What a reader meets, in order

### Website

| Section | Sentences | Text |
|---|---|---|
| Hero | 2 | SnowRaven reads your eBird and Macaulay Library exports and gives you weather and tides for your checklists, your history with every species, life-list statistics and an interactive map. It runs on your own device. |
| Privacy band | 2 + link | No account, no analytics, no telemetry, and no server we run. Your eBird backup, Macaulay Library export and API keys stay on your device unless you turn on iCloud syncing between your devices, and anything you sync goes to your own iCloud account and nowhere else. The four cards beneath are labels only: No accounts, No tracking, Keys & data stay local, No developer server. |
| Features head | 1 | "What each tab does." Built on your eBird and Macaulay Library exports. |
| 1 Weather | 2 | Paste an eBird checklist ID and get a weather and tide summary ready to drop into the checklist comment, or look up the conditions where you are now, or the forecast for any place and time ahead. The Weather/tide Planner lays out the coming sunrises and sunsets, each with its tide and forecast weather. |
| 2 Statistics | 2 | A dashboard built from your eBird backup: life-list totals and growth, milestones, and when and where you bird. A weather section reads back the weather blocks SnowRaven and RainCrow write into checklist comments: the conditions on the outings you wrote a block for. Caption: Dark mode shown. |
| 3 Map Explorer | 2 | Your sightings on an interactive map, with nearby eBird hotspots and where species new to you were reported recently. Counties shade by your counts or by how complete your county list is, with a California Breeding Bird Atlas overlay. |
| 4 Species Detail | 2 | Your whole history with one bird: sightings, field notes, breeding codes and a map of every observation. A weather card shows the skies and temperatures you have found this bird in, drawn from the same SnowRaven and RainCrow weather blocks. |
| 5 Calendar | 2 | A year of your birding as twelve month grids, each day shaded by how many species you saw. Fold the years together, or narrow it to a single species. |
| 6 Multimedia | 2 | Your life list as a media checklist: which species you have photographed, recorded and filmed, and which you still need. Narrow it by sex and age. |
| 7 Breeding Codes | 1 | Every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier. |
| 8 Checklists | 1 | Your checklists as whole outings: search every comment you have written, and filter by what an outing has. |
| 9 List Comparer | 1 | Two life lists side by side, or any two public checklists: what they share and what only one has. |
| 10 Named Birds | 2 | Tag an individual bird by name in a species comment and SnowRaven gathers everything you have on it: sightings, places, a timeline, its own media. With several named birds, one strip puts them all on a shared time axis. |
| Platforms | 2 | Where it runs; one universal Mac build, and the self-hosted version works in a phone or tablet browser. |
| Install cards | as today | The iOS card no longer says "needs no account"; "Already installed?" is "Updating:". |
| What you'll need | 3 short items | The two keys and the two files. |
| Closing | 1 | SnowRaven is free and open source, built by one birder for their own data. |
| Footer | as today | Attribution and version line byte-identical. |

Ten `feature-row` articles, the ten tabs in `DEFAULT_TAB_ORDER`, odd rows media-right and
even rows `reverse`, figures and alt text verbatim, exactly per `design-refinement.md`. One
paragraph per row. Every `href` and `src` in the file is unchanged as a multiset.
`v1.0.32` appears twice and `aria-label="Version 1.0.32"` once, as today. No em dash, no
standalone `Predict`, no `Get forecast`, no count in a heading, no mention of offline
anywhere in the file. The two survivors of the "your own" sweep are "on your own device"
(hero, once) and "your own iCloud account" (band, once), both by direction.

### README

| Section | Sentences | Notes |
|---|---|---|
| Title and intro | 1 + 2 lines | What it is; the one-sentence overview; where to see it; one line naming SnowRaven Mini as a separate browser extension. |
| `## What it does`, ten `###` sections | 2, 2, 2, 2, 2, 2, 1, 1, 1, 2 | Word for word the website's sections, minus the markup. |
| `## Privacy` | 2 + links | Private by default, and in your control; then the same sentence as the band. |
| `## What you'll need` | 2 items + 1 | Renamed from `## Requirements` to match the website's aside. Keys, then files. "Even though the free tier is free" is gone. |
| `## Installation`, `## Build from source`, `## Attribution` | as today | The `npm audit` parenthetical and "no account" are gone; Attribution unchanged apart from a lowercase "weather lookup". |

## Coverage: every claim the two surfaces publish today, and where it went

Legend: **Kept** (still on both surfaces, or the one that had it); **Moved** (now on a
different surface, named); **Retired, covered** (gone from README and the website, with
the HELP section or policy passage that carries it); **Retired, decision** (gone and
covered nowhere else: yours to confirm).

### The Weather tab (README bullet `Weather & Tide Lookup`; website `Weather & Tide Lookup`)

| Claim today | Disposition |
|---|---|
| Paste a checklist ID for a paste-ready historical weather summary | Kept (both), as "a weather and tide summary ready to drop into the checklist comment" |
| The summary's fields: temperature, wind, humidity, dew point, sunrise and sunset, moon phase on night checklists (website) | Retired, covered: HELP `## Weather`, paragraph 2 |
| The tide from the nearest NOAA station | Kept as "weather and tide summary"; the station is HELP `### Tides` |
| Current: live weather and tide for where you are | Kept as the property, "the conditions where you are now" (both); the control's name is HELP `### Current and Plan` |
| Plan: forecast weather and tide for a place and time you choose | Kept as the property, "the forecast for any place and time ahead" (both); the control's name is HELP. Forward-only, as the app is: Plan's date input starts at today and `/weather/at` is forecast-only, so historical conditions come only through the checklist lookup. |
| A backlog lists recent checklists with no weather block; each action keeps its own target | Retired, covered: HELP `### Weather backlog: checklists with no weather block` |
| The Weather/tide Planner, a second action in Plan | Kept as the name (both); "a second action in Plan" is HELP's |
| Lists every sunrise and sunset to the end of the forecast, each with predicted tide and forecast weather | Kept (both), as "lays out the coming sunrises and sunsets, each with its tide and forecast weather" |
| On one chart and in one list; the tap-or-arrow-keys readout; the sun's height drawn; each day's moon phase; stops where the forecast stops; ranks and recommends nothing; re-shows offline; Days in view | Retired, covered: HELP `### Current and Plan` (the readout also in ACCESSIBILITY.md). The last four are, respectively, the user's own example of the obvious, reassurance, the offline decision, and a control. |
| SnowRaven Mini, the companion extension (README paragraph) | Kept (README), one line in the intro; HELP `### SnowRaven Mini` carries how it works |

### Species Detail (README bullet; website article)

| Claim today | Disposition |
|---|---|
| Your complete history with any species: stats, field notes, breeding codes, a map of every observation | Kept (both) |
| Top locations; subspecies breakdowns (the Subspecies Explorer) | Retired, covered: HELP `## Species Detail`, "Subspecies and forms" and the Top Locations bullet |
| Sightings-over-time graphs (website) | Retired, covered: HELP `## Species Detail`, "Graph options" |
| County shading on the map; offline, from your own file, no API key | Retired, covered: HELP `## Species Detail`, Sighting Locations map bullet |
| The map expands to fill the window | Retired, covered: HELP `## Map Explorer`, "Fullscreen on the other maps" |
| Recent Media plays your latest photo, audio and video inline; plain links when an embed cannot load | Retired, covered: HELP `## Species Detail`, Recent Media bullet |

### The Weather card on Species Detail (README bullet `Weather on the bird's own page`; website paragraph under Statistics)

| Claim today | Disposition |
|---|---|
| A Weather card on Species Detail shows the skies and temperatures you have recorded the selected bird in | Kept (both), as "A weather card shows the skies and temperatures you have found this bird in". **Moved** on the website from the Statistics article to the Species Detail article. |
| Reads the blocks SnowRaven and RainCrow write into checklist comments | Kept (both), as "drawn from the same SnowRaven and RainCrow weather blocks", naming RainCrow where the claim is made |
| No picker of its own; you are already looking at a bird | **Moved to HELP**: `proposed/HELP-additions.md` (a) |
| Same derivation as the Statistics section; two wholes, nothing divides them; too few checklists is the ordinary outcome; never predicts; offline | Retired, covered: HELP `## Species Detail` Weather bullet and `### Weather` under Statistics |

### Statistics (README bullet; website article)

| Claim today | Disposition |
|---|---|
| Life-list totals and growth, milestones, temporal and geographic patterns | Kept (both), as "life-list totals and growth, milestones, and when and where you bird" |
| Effort, data quality, breeding and media stats, Frivolous Lists | Retired, covered: HELP `### Effort and Outings`, `### Data Quality`, `### Breeding Stats`, `### Media`, `### Frivolous Lists`. The screenshot beside the section shows the section navigation. |
| Count all forms and Count escapees, following eBird's own rules; per-session | Retired, covered: HELP `## Statistics`, paragraphs 3 to 6 |
| Geographic Stats county shading; its numbers match the county tables and the Map Explorer's while Count all forms is off | Retired, covered: HELP `### Geographic Stats`. The guard keeps a conditional leg on both surfaces so the parity claim can never come back unconditioned. |
| Projects: which eBird projects your checklists were submitted to, checked on demand with your own key; cost stated first; stop and resume; denominators | Retired, covered: HELP `### Projects` |
| A Weather section reads back the blocks SnowRaven and RainCrow write into comments | Kept (both), as "A weather section reads back the weather blocks SnowRaven and RainCrow write into checklist comments" |
| What it shows: distribution across sky, temperature, wind and day versus night; species per checklist per band; any bird you pick | Retired, covered: HELP `### Weather`. Both surfaces say "the conditions on the outings you wrote a block for", which is the section's own scope (HELP: every figure is about those checklists, never about "your birding"). |
| Coverage fraction stated first; never-birded bands kept as zero; too-few bands not averaged; never predicts or ranks; offline | Retired, covered: HELP `### Weather` |

### Calendar

| Claim today | Disposition |
|---|---|
| Twelve month grids, each day shaded by how busy | Kept (both), as "each day shaded by how many species you saw", the default metric and what the screenshot's alt text says |
| Each day carries species, checklists or total count | Retired, covered: HELP `### Reading the calendar` |
| Filter to a single species; fold the years into one grid | Kept (both) |
| Page across years; click any day; Large view thumbnails; texture mode; entirely offline | Retired, covered: HELP `### Moving through your data`, `### The day popup`, `### View: Compact or Large`, `### Textures (colorblind mode)`, `## Calendar` |

### Map Explorer (README bullet; website article; README bullet `Maps that get out of the box`)

| Claim today | Disposition |
|---|---|
| Your sightings on a map; nearby eBird hotspots; Nearby Lifers mapping where species you have not recorded were reported recently; a California Breeding Bird Atlas overlay | Kept (both); Nearby Lifers as "where species new to you were reported recently" |
| County lines; shading by your own counts or by how complete your county list is | Kept (both) |
| Heatmap; filters; hotspot pin coloring and tier rings; Completeness needs a connection and a key; texture mode; place search, use your location, drop a pin, Search this area; basemaps and trails | Retired, covered: HELP `### My Sightings`, `### Hotspots` (including its **County lines & shading** and **County Completeness** lead-ins), `### Searching the area you are looking at`, and the "Base maps and layers" lead-in under `## Map Explorer` |
| Media Targets | Retired, covered: HELP `### Media Targets` |
| Fullscreen on the other maps | Retired, covered: HELP `## Map Explorer`, "Fullscreen on the other maps" |
| Share a spot: plant a pin, copy coordinates plus map links, assembled locally | Retired, covered: HELP `### Copying a location from a map` and `### Sharing` |

### Multimedia

| Claim today | Disposition |
|---|---|
| Photo, audio and video coverage for every species on your life list, what you still need to capture | Kept (both) |
| Sex and age filters | Kept (both), as "narrow it by sex and age"; the examples are HELP `## Multimedia` |
| Counts and links straight to the matching media in your Macaulay Library | Retired, covered: HELP `## Multimedia`, paragraph 3 |

### Breeding Codes

| Claim today | Disposition |
|---|---|
| Every species with breeding evidence, as a color-coded matrix across eBird codes | Kept (both), as "a matrix against eBird's breeding codes, colored by evidence tier" |
| Tier and per-code filters; a legend; phone column layout | Retired, covered: HELP `## Breeding Codes` |

### Named Birds

| Claim today | Disposition |
|---|---|
| Name a bird in a species comment with a `[name:…]` tag; the app gathers every sighting with its location | Kept (both), as "tag an individual bird by name in a species comment and SnowRaven gathers everything you have on it: sightings, places"; the tag's syntax is HELP `## Named Birds` |
| A timeline in each card; its own media | Kept (both) |
| One strip puts every named bird on a shared axis | Kept (both), conditioned "with several named birds" |
| So you can see which birds you were following when | Retired, covered: HELP `## Named Birds`, "All named birds over time" |
| How long followed and which two dates; press a mark or the arrow keys; the Measure-to switch; its own map and top locations; media matched by the same tag; Disable embedded media | Retired, covered: HELP `## Named Birds` (and ACCESSIBILITY.md for the keys); `### Appearance` for the setting |

### Checklists

| Claim today | Disposition |
|---|---|
| Search every checklist comment and species comment you have written | Kept (both), as "search every comment you have written" |
| Filter by has and does-not-have across comments, media, breeding codes, completeness, protocol, county, dates | Kept as "filter by what an outing has" (both); the categories are HELP `## Checklists` |
| Pasted weather and tide blocks stay hidden and out of search until you ask | Retired, covered: HELP `## Checklists`, "Show weather & tide blocks" |

### List Comparer

| Claim today | Disposition |
|---|---|
| Two life lists: shared and unique species; two checklists side by side | Kept (both), as "two life lists side by side, or any two public checklists: what they share and what only one has" |
| Per-species counts, breeding codes, media, comments; the higher count emphasized; effort details; side-by-side weather and tide | Retired, covered: HELP `### Checklists mode` |

### Retired whole, by your decision at the design gate

| Section today | Disposition |
|---|---|
| Search anything by name (README bullet, website article and its mock) | Retired, covered: HELP `## Search`. A guard leg now fails if a Search heading returns to either surface. |
| Navigation that fits the window (README) | Retired. Three of its four claims are HELP `### Tab Layout`; the fourth **moves to HELP**: `proposed/HELP-additions.md` (b). |
| Settings (README) | Retired, covered: HELP `## Settings`. The two keys and two files stay in What you'll need on both surfaces. |
| Offline (README bullet; website article and its no-signal mock; every offline clause elsewhere) | Retired, covered: HELP `## Using SnowRaven offline`, still asserted by `icloudKeysPublishedClaims`. Under DECISIONS v1.0.20 the retired mock is a behavioural claim withdrawn, recorded as a decision. A guard leg now fails if an Offline heading, or the word offline, returns to either surface. |
| Desktop window (README) | Retired, covered: HELP `## Getting Started`, "The desktop window remembers itself" |

### Privacy, sync, the aside, the hero and the closing

| Claim today | Disposition |
|---|---|
| No account, no analytics, no telemetry, no developer-operated server | Kept (both), once, in the posture sentence |
| Files and keys never leave the device unless you turn on iCloud Sync; off by default; your own account and nowhere else | Kept (both), as "stay on your device unless you turn on iCloud syncing between your devices, and anything you sync goes to your own iCloud account and nowhere else" |
| The Sync API keys switch and its note; Mac, iPhone or iPad; only the two files and their details; settings and caches never synced; the developer never sees it | Retired, covered: HELP `### iCloud Sync (Mac, iPhone and iPad)`, `website/privacy.html` line 170, `PRIVACY_POLICY.md` `## iCloud Sync` |
| Requests go directly to the services; no SnowRaven server in the middle; the keyless services named; Disable embedded media | Retired, covered: `website/privacy.html` under "Connections to Bird and Weather Services", "Map Tiles" and "Embedded Bird Media and Link Icons"; `PRIVACY_POLICY.md`; HELP `### Appearance` |
| The four privacy cards' text: "Nothing to sign up for. Just open it and go.", "Zero analytics or telemetry, on every platform.", "Your files and API keys live on your machine; syncing either through iCloud is your own opt-in", "We run nothing. There is no SnowRaven cloud." | Retired: the band sentence carries the posture and the four labels stay |
| Hero meta line "No account, no telemetry" | Retired: the band carries it |
| Hero: media coverage, breeding evidence, a calendar of your birding | Retired from the hero's list; each has its own section below |
| Privacy policy and accessibility statement linked | Kept (both) |
| Two free API keys and where to get each; One Call by Call, the payment card, a usage cap | Kept (both); "even though the free tier is free" cut |
| What the eBird key powers (website aside) | Retired, covered: HELP `### eBird API key` |
| Your eBird backup and an optional Macaulay Library export | Kept (both) |
| The 30-second inactivity paragraph | Retired, covered: HELP `### ML export`, last paragraph |
| Installation and updating per platform; SmartScreen; updates cryptographically verified | Kept (both); the iOS "needs no account" cut |
| "The npm security summary ... a production-scoped npm audit --omit=dev reports zero" (README Updating) | **Retired, decision.** A maintainer note; if a self-hoster needs it, it belongs in the install docs. |
| Closing: "began as a tool for one birder's own data ... works alongside eBird and the Macaulay Library ... nothing to sign up for, and nothing to buy" | Reduced to one sentence: free and open source, built by one birder for their own data. The "works alongside eBird and the Macaulay Library" framing survives in the footer attribution and README `## Attribution`, which the docs rule keeps untouched. |
| "Light or dark, your choice." (Statistics caption) | Retired; "Dark mode shown." stays |
| "The interface is responsive" (Platforms) | Retired, covered: HELP `### Tab Layout`, last paragraph; the sentence keeps "works in a phone or tablet browser" |
| Build from source; Attribution | Kept (README); Attribution unchanged in content, with one lowercase "weather lookup" for consistency with README's intro and the website's footer |

Nothing else on either surface was found that is not in one of the tables above. The two
surfaces now carry the same ten sections in the same words.

## Stylesheet delta

Pure deletion: eight lines of `website/styles.css` (265 to 272 today), the dead `.named*`
block and its false `/* Named Birds mock */` comment, used only by the two retired
hand-built figures. Nothing is added; `.ck-search` and `.ck-count` stay for the Checklists
mock. The emitted app CSS bundle is unaffected (this is the website's own stylesheet).

## The guard edits, in plain terms

Six test files under `frontend/src/lib/*PublishedClaims.test.ts` read `README.md` and
`website/index.html` and hold their claims to the code. The edit list was measured, not
predicted: the cut files were dropped into an isolated copy of the repo and the six suites
run unmodified. Result: 52 failing rows plus one whole suite failing to load (the Search
guard, which expected a README bullet that no longer exists), out of 162 rows.

The repair follows the two-tier rule: `docs/HELP.md` keeps every byte-exact row it had,
unweakened; the two decision surfaces are held at **claim level** and still compared
against each other; where a surface no longer makes a claim at all, by your decision, it
leaves that roster and the test says so in a comment at the row. No existence leg was
deleted and no length floor was lowered. The 200-character floors on the Planner passage,
the Statistics Weather passage and the card passage still bind and still pass on both
surfaces (the shortest is the Map Explorer-adjacent Species Detail passage at 240
characters; the Weather passage is 278 on the site and 271 in the README, Statistics 241
on both). The Named Birds floor of 80 passes at 219.

| Suite | What changed |
|---|---|
| `palettePublishedClaims` (Search) | README and the website leave the roster: neither has a Search passage. HELP keeps every row. **New negative legs:** neither surface may carry a Search or Offline section heading, or the word offline at all; guard-the-guard confirms the headings that shipped through 1.0.32 would trip them. **New row** for the HELP navigation sentence (space available, not a device check), held to `navDensity.ts` and `useIsPhone.ts` reading widths and never the user agent. |
| `namedBirdTimelinePublishedClaims` | README passage is the `### Named Birds` section, heading to heading. The rows for the span figure's two dates, the Measure-to switch, its endpoint wording, the arrow keys and the strip's purpose ("which birds you were following when") read HELP only. The two surfaces keep the timeline claim and are held to one formulation of the shared strip. ACCESSIBILITY.md's rows are untouched. |
| `projectsPublishedClaims` | The county-parity claim is made by HELP only, so HELP alone keeps the non-vacuity leg. README and the website keep a **conditional** leg: if a parity sentence ever returns, it must carry "Count all forms is off" and must not say "whatever the setting". Guard-the-guard now also proves the detector sees the bad sentence. |
| `icloudKeysPublishedClaims` | The row that required README and the website to name the `Sync API keys` switch now requires each to state the posture in one sentence: API keys, iCloud, the opt-in ("unless you turn on"), keys staying on the device by default, and "your own iCloud account and nowhere else". Both surfaces are held to the same formulation. The unqualified-keys sweep and the version-pill row are unchanged. |
| `weatherStatsPublishedClaims` | README passages are the `### Statistics` and `### Species Detail` sections. The two offline rows and both "never predicts" rows read HELP only; the decision surfaces keep the negative leg (no "best conditions", no "you should"). The card's two-wholes, same-derivation and ordinary-outcome rows read HELP only; both surfaces are held to naming no threshold and to never promising a coverage percentage. **"No picker" becomes a HELP row** (with a code check that the card renders no selector), red against today's HELP by design. The website is **brought into the both-apps attribution row**, which asserts only that SnowRaven and RainCrow are named in the card passage, spelled the way RainCrow spells itself. **New rows:** the website card paragraph sits under the Species Detail heading; all three surfaces say the section reads the blocks back out of checklist comments; the two decision surfaces make the same card claim. |
| `weatherTidePlanPublishedClaims` | README passage is the `### Weather` section. HELP keeps all eight byte-exact sentences in one row. HELP-only now: stops where the forecast stops, ranks and recommends nothing, the offline re-show, the moon phase, Days in view, the readout, the drawn sun height, and the entry's name Plan. One claim on both decision surfaces: the sentence naming the Planner carries sunrises, sunsets, tide and forecast weather. Both keep the negative legs (no "best morning", no `Predict`, no `Get forecast`). **New row:** the Planner's name occurs exactly once in the website file and after the Weather heading. |

Row counts, HEAD to proposed: palette 8 to 13, namedBirdTimeline 15 to 16, projects 18 to
19, icloudKeys 37 to 37, weatherStats 35 to 35, weatherTidePlan 49 to 41; 162 to 161.

**Against the live files (unchanged), 36 narrowed rows are red by design** across five suites
(projects is green either way). They are every row that expects a `###` tab heading in
README, the moved card paragraph on the website, the new HELP sentences, the two-surface
formulations, and the negative legs against the Search and Offline sections that still
exist today. Copy, guards and the two HELP sentences land in one commit, and that commit
is green: 161 of 161, measured in the isolated copy with all of them applied.

**Mutation matrix:** 52 mutations against the cut copy (25 on the README, 25 on the
website, 2 on the HELP additions), each deleting or altering one asserted claim, each
checked to touch its anchor exactly once, with the harness first confirmed green on the
unmutated copy. 51 went red. The one survivor is "change the version pill text alone",
which the version row cannot see because it is a whole-file `toContain` and the footer
line still carries the version: the weakness CLAUDE.md already records under Versioning
and the ROADMAP tracks. Not introduced here; left alone.

Lint and `tsc -b` are clean on the six files. Because Tailwind scans test files for class
candidates, the app was built with and without the six edits: the emitted CSS is
byte-identical, so no comment in the tests leaked a rule.

## What needs your yes

1. The copy itself, both files, as written.
2. The two HELP sentences in `proposed/HELP-additions.md`.
3. The one **Retired, decision** item (the `npm audit` note) and the whole-section
   retirements the design gate already settled.
4. The guard edits above, in particular the ones that narrow a named mechanism or a promise
   to the posture: the Sync API keys switch (icloudKeys), the county-parity claim (projects),
   the span figure, Measure-to switch, arrow keys and strip purpose (namedBirdTimeline), and
   the two "never predicts" promises (weatherStats, weatherTidePlan).
5. The version-bump question is unresolved and belongs to the deploy stage; nothing here
   bumps a version or touches `CHANGELOG.md`.

## Applied

The user approved the copy above ("Lets lock in this language") with one fix, and the
files are now applied to the working tree, uncommitted:

- **The fix:** "weather" is lowercase and unbolded where it is prose rather than the tab's
  name. Website: "A weather section reads back the weather blocks SnowRaven and RainCrow
  write into checklist comments: the conditions on the outings you wrote a block for." (as corrected at QA, below) and "A weather card shows the
  skies and temperatures you have found this bird in, drawn from the same SnowRaven and
  RainCrow weather blocks." README: the same two sentences. Unchanged: the `<h3>Weather</h3>`
  heading, "Weather/tide Planner", the footer attribution and the OpenWeather key bullet.
  The one guard change it needed is `weatherStatsPublishedClaims`'s website anchor, now
  `A weather section reads back`.
- **Applied:** `proposed/index.html` to `website/index.html`, `proposed/styles.css` to
  `website/styles.css`, `proposed/README.md` to `README.md`, each confirmed byte-identical
  by `cmp`; the two sentences from `proposed/HELP-additions.md` into `docs/HELP.md`, which
  now differs from HEAD by exactly those two sentences (`git diff --word-diff`).
- **Verified on the live tree:** the six guards 6 files green (161 rows, plus one per-run
  em-dash row on a machine holding a gitignored pipeline doc); the full frontend suite
  352 files passed, 2 skipped, 7,263 tests passed, 3 skipped; `npm run typecheck` and
  `npm run lint` clean; app CSS bundle byte-identical with and without the six test edits.
- **Source sweep** of `frontend/src/` and `.claude/rules/` for comments quoting a retired
  website or README sentence as still published: none found. Two near-hits left as they
  are: `storage.ts`'s "Offline support" section comments name the feature, not the
  article; `TabNav.tsx`'s header records a struck claim that once reached `README.md`,
  as history.
- **Not done, by design:** no version bump, no `CHANGELOG.md` entry, no commit. The
  version question belongs to the deploy stage.

### QA attempt 1: three sentences corrected, one consistency item, five citations

Applied to `website/index.html`, `README.md` and their copies under `proposed/`, kept in
step; no guard anchor moved, and no test file changed.

1. **Weather, first sentence.** "or look up the conditions for where you are or any place
   and time" claimed a time dimension the app does not have: Plan's date input starts at
   today and `/weather/at` is forecast-only, so historical conditions come only through the
   checklist lookup. Now: "or look up the conditions where you are now, or the forecast for
   any place and time ahead." The Planner sentence became "lays out the coming sunrises and
   sunsets" so "ahead" is not said twice; "Weather/tide Planner" stays the first occurrence
   after the heading.
2. **Statistics, second sentence.** "the conditions you bird in" is the framing HELP's
   Weather section disclaims (every figure is about the checklists with a readable block,
   never about "your birding"). Now: "the conditions on the outings you wrote a block for."
3. **Calendar.** The body said "shaded by how much you saw" while the verbatim alt text says
   "shaded by how many species were seen", and the app shades by one of three metrics with
   species the default. Now: "each day shaded by how many species you saw", on both
   surfaces; the alt text stays verbatim.
4. **README Attribution:** "The Weather lookup mirrors" is now "The weather lookup mirrors",
   the same referent as README's intro and the website's footer sentence; content unchanged.
5. **Citations in this review corrected:** `website/privacy.html` has no "Third-party
   services" section (its headings are "Connections to Bird and Weather Services", "Map
   Tiles" and "Embedded Bird Media and Link Icons"); "County lines & shading" and "County
   Completeness" are bold lead-ins under `### Hotspots`, not headings; the backlog heading
   is `### Weather backlog: checklists with no weather block`; and the README's
   `## Requirements` heading became `## What you'll need`, now recorded in the README table.

Re-verified on the live tree after the fixes: six guards 6 files green (162 rows on this
machine, 161 in CI); full frontend suite 352 files passed, 2 skipped, 7,263 tests passed,
3 skipped; typecheck and lint clean.
