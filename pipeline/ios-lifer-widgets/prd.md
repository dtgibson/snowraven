# PRD - iOS Lifer Widgets
**Feature:** ios-lifer-widgets
**Date:** 2026-09-23
**Stage:** 2 - The Planner
**Source:** strategic-brief.md (approved; Key Decision 5 as corrected in decisions.md; Media setting per the Stage 4 entries in decisions.md, 2026-09-24, as revised the same day: Photo / Audio / Video / Any)

## Feature Overview

Two iPhone and iPad home-screen widgets, **Nearby Lifers** and **Media Targets**, each a nearest-first list of recent eBird reports of species the user still needs within 25 miles of where they are, configurable to the last day, week or 30 days (Media Targets also to photo, audio, video or any), and each tapping through to the matching Map Explorer view with that window, that media choice and the user's current location already applied. The widget extension targets iOS 17; the app's minimum stays iOS 16.

## User Stories

> **US-01** - As a birder with my eBird backup and key loaded, I want the nearest lifer reported recently to be on my home screen with its distance, so that I notice a reachable bird without opening the app.

> **US-02** - As a birder who also keeps a Macaulay Library export, I want the same glance for species I still lack a photo, audio or video of, so that a free hour turns into a media target rather than a guess.

> **US-03** - As a widget user, I want to choose the last day, week or 30 days for each placed widget, so that a Day widget on my morning screen and a 30 days widget elsewhere each answer a different question.

> **US-04** - As a widget user, I want one tap to open SnowRaven on the matching Map Explorer view with the same window and my current location already searched, so that the bird I saw on the widget is on the map with no further taps.

> **US-05** - As a user whose key, files, location or network is missing, I want the widget to say in one sentence which one is missing, and never show a blank tile or an old list dressed as current, so that I trust what it shows.

> **US-06** - As a privacy-conscious user, I want the widget to talk only to eBird with my own key, to send nothing to the developer, and to be stoppable by removing the widget or denying location, with the published policy and help saying exactly that, so that the app's founding posture still holds with a widget on my screen.

> **US-07** - As a VoiceOver or large-text user, I want every widget row and message read out in full and the layout to hold at larger text sizes, so that the widget is as usable for me as the rest of the app.

> **US-08** - As a birder who hunts photos on some days, recordings on others and video now and then, I want a Media Targets widget set to Photo, Audio, Video or Any, and under Any a glyph on each row saying which types are missing, so that I know at a glance what to bring.

Eight stories; no scope flag.

## Functional Requirements

### A. Widget kinds and families

> **FR-01** - The iOS app shall offer exactly two widget kinds in the widget gallery, named **Nearby Lifers** and **Media Targets**, matching the Map Explorer view labels in `lib/mapViewModes.ts`. Each kind shall be placeable independently and more than once.

> **FR-02** - Each kind shall support the `systemSmall`, `systemMedium` and `systemLarge` families on iPhone and iPad, from one extension. No accessory (lock screen, StandBy), watch or Live Activity family is offered.

> **FR-03** - The row count per family shall be: small 1, medium 3, large 8. A family shall show the first N rows of the ordered list (FR-09), never a later subset. If the rendered text size (NFR-05) leaves no room for the Nth row, that row is dropped whole; a row is never clipped mid-row.

> **FR-04** - Every family shall carry the widget's title (the kind's name) and the selected time range in a form a reader can see, so no tile is ever a bare list or a blank surface. In every state (section G) the title remains.

### B. Row content and ordering

> **FR-05** - A row shall represent one species. Its fields are: the species common name exactly as eBird returns it in `comName` (plain text, no link or icon); the distance from the reference point (FR-17) to the report's location; how long ago the report was made; and the report's location name (`locName`); and, for a Media Targets widget set to Any, the missing-media glyphs (FR-51). Medium and large rows shall show all four fields. The small family shall show at least name, distance and recency; the location name may be omitted visually in small but shall remain in its accessibility label (NFR-05).

> **FR-06** - Distance shall be the great-circle distance in statute miles between the reference point and the report's coordinates, computed by the same rule as `distanceMiles` in `lib/mapExplorerFormat.ts` (Earth radius 3958.8 mi, haversine), shown to one decimal place with the unit "mi" (for example "3.2 mi"), matching the in-app nearest lists. No further rounding or unit switching. Distances below 0.05 mi display as "0.0 mi".

> **FR-07** - Recency shall be day-granular, derived from the date part of the report's `obsDt` against the device's local calendar day at refresh time, with the same floor-to-local-midnight arithmetic as `isWithinWindow` in `lib/nearbyLifers.ts`: 0 days reads "Today", 1 day reads "Yesterday", N days reads "N days ago". The time-of-day part of `obsDt` is not shown. A report whose date cannot be parsed is excluded from the list (FR-13).

> **FR-08** - Each species shall appear at most once. A species reported at several locations within the window is shown at its nearest qualifying location; ties on distance resolve to the most recent report, then to the lexically smaller `locId`.

> **FR-09** - Rows shall be ordered by distance ascending. Ties resolve by most recent report first, then by common name A to Z, case-insensitive. This order is fixed and identical across the three families.

### C. Time range configuration

> **FR-10** - Every placed widget shall have the configuration parameter **Time range**, offering three values with these labels and this mapping to the in-app filter: **Day** = `'day'` = 1 day, **Week** = `'week'` = 7 days, **30 days** = `'all'` = 30 days. The default for a newly placed widget is **Week**. A Nearby Lifers widget has no other parameter. A Media Targets widget has exactly one more, the Media parameter (FR-50). Radius and center are not configurable in v1 (see Out of Scope).

> **FR-11** - The window shall be applied exactly as Map Explorer applies it: the underlying eBird fetch always covers 30 days (`back=30`); **30 days** applies no further filter (every report the fetch returned qualifies, precisely the in-app `'all'` behavior); **Day** and **Week** keep a report only when `isWithinWindow(recentDate, 1 or 7, now)` is true, that is, both the report's date and "now" floored to local midnight, inclusive on both edges, so a report from exactly 7 days ago is in a Week list and a same-day report is always in a Day list.

> **FR-12** - Changing a placed widget's Time range, or a Media Targets widget's Media value, shall change its list without a new eBird request when a fresh cached result exists (FR-24), because the fetch is independent of both settings; both are applied locally.

### D. Species inclusion (parity with Map Explorer)

> **FR-13** - Both kinds shall start from the same records Map Explorer's `/map/recent-obs` path produces: the eBird `data/obs/geo/recent` records for the reference point, a 40 km radius (25 mi rounded as the app rounds it, `Math.round(25 * 1.60934)`), and 30 days back, reduced to one record per (`speciesCode`, `locId`) carrying that pair's most recent `obsDt` and its `subId`. Records missing numeric coordinates, missing `speciesCode`, or with an unparseable date are skipped, as the app skips them. No distance filter is applied beyond eBird's radius.

> **FR-14** - **Nearby Lifers** shall list a record's species when its normalized common name is **not** in the recorded set. Normalization is the app's `normalizeSpeciesName` (trim, then strip one trailing parenthetical group) followed by case-insensitive comparison, as `buildNearbyLifers` does. The recorded set is the normalized common name of **every** observation row in the stored eBird backup, with no countability filter, no escapee exclusion and no subspecies distinction, because the in-app Nearby Lifers view applies none of these today (`recordedNames` in `MapExplorer.tsx`, `buildNearbyLifers` in `lib/nearbyLifers.ts`). The widget matches the app; if the app's rule ever changes, the shared fixture (FR-16) changes with it.

> **FR-15** - **Media Targets** shall list a record's species when its normalized common name is in the target set **and** the species' missing media matches the widget's Media value (FR-50). The target set is derived in the app from the same inputs the in-app Media Targets view uses for `targetSpecies` and `missingTypes`: for every distinct raw common name in the eBird backup, the stored Macaulay Library export is checked for Photo, for Audio and for Video for that raw name; a species lacking at least one of the three is in the set, carrying exactly which types it lacks (the in-app `missingTypes`); the name is then normalized as in FR-14. This is the in-app Media Targets definition of a target species, unchanged. The listing rule per Media value: **Photo** lists species lacking Photo; **Audio** lists species lacking Audio; **Video** lists species lacking Video; **Any** lists every species in the set (missing any of the three). When no Macaulay Library export is stored, the target set is absent and the widget shows state S4 (section G); the in-app manual target list is session-only component state that is never stored, so the widget cannot honor it and does not try to (see Open Questions, OQ-01).

> **FR-16** - The subtraction, window and distance rules shall be pinned by one tracked parity fixture (a recent-obs payload, a recorded set, a target set, a reference point, a "now", and the expected ordered rows per kind and window) consumed by both the TypeScript tests and the Swift tests, so the widget's list for a given window, location and radius equals the species set and distances Map Explorer would show for the same inputs. The fixture shall include: a name with a trailing parenthetical form, a mixed-case name, a same-day report, a report exactly 7 days old, a report 8 days old, a record with no coordinates, a species reported at two locations, and two species at equal distance; and, for Media Targets, one species for each single missing type (Photo only, Audio only, Video only), one for each pair (Photo and Audio, Photo and Video, Audio and Video), one missing all three, and one with all three media present, with the expected rows and glyphs under each of the four Media values.

### E. Location

> **FR-17** - At each refresh the widget shall request the device's current location, riding the app's existing When In Use authorization; it shall never request Always authorization and shall read location only during a WidgetKit refresh. The reference point for FR-06, FR-08 and FR-09 is this location. Reduced-accuracy (approximate) location, where the user granted it, is used as given.

> **FR-18** - If current location is denied, restricted, or not obtained within a bounded wait (default 10 seconds), and a Default Location is stored (the app's `map-defaults` setting), the widget shall use the Default Location's coordinates as the reference point, with a visible caption stating that the list is from the user's default location. The Default Location's saved radius is not used; the widget radius stays 25 mi.

> **FR-19** - If current location is unavailable and no Default Location is stored, the widget shall show state S6 (open SnowRaven and allow location, or set a Default Location) and make no eBird request.

> **FR-20** - The system location permission prompt remains the app's, raised the first time the user taps "Use my location" in the app; the widget shall never raise its own prompt. The app's usage string (`NSLocationWhenInUseUsageDescription`) shall be updated to say the location also positions the widgets, and every copy of that string in the repo (`src-tauri/Info.ios.plist` and the generated `Info.plist`) shall be identical.

### F. Fetch, refresh, cache and etiquette

> **FR-21** - The widget shall make outbound requests only to eBird's `data/obs/geo/recent` endpoint over HTTPS, authenticated with the user's own eBird key from the hand-over (section H). No other host is contacted; no request is made without a key.

> **FR-22** - The widget shall plan its timeline at a target cadence of one refresh every 30 minutes, subject to WidgetKit's budget (the system may deliver fewer). A refresh shall make at most one eBird request, and zero when the cache is fresh.

> **FR-23** - The app shall ask WidgetKit to reload all widget timelines whenever it rewrites the hand-over (FR-30), so a new file, key or Default Location reaches the widget without waiting for the next scheduled refresh.

> **FR-24** - Fetched results shall be cached on disk in the shared container for 15 minutes, keyed by the reference point rounded so that nearby refreshes coalesce (default: two decimal places of latitude and longitude, about 0.7 mi) plus the fixed radius. The cache is shared by both kinds and all three windows: two placed widgets, of either kind and any window, produce at most one eBird request per 15 minutes per device. The cache holds the decoded records and the fetch time; distances are always recomputed from the current refresh's reference point, never taken from the cache.

> **FR-25** - A change to the eBird key (save, replace or clear) shall discard the cache, mirroring the app's key-change invalidation. Clearing the eBird backup shall not by itself discard the cache (the payload is public data), but the list is recomputed against the new hand-over on the next reload.

> **FR-26** - On an HTTP 429 the widget shall keep the last good list, mark it (FR-28), make no further request in that refresh, and attempt again no sooner than the next scheduled refresh; a `Retry-After` header shall be honored if it is later than that (parsed as seconds, bounded as `lib/rateLimit.ts` bounds it). A 429 response is never stored as a result.

> **FR-27** - On any other failed request (no network, timeout, 5xx, malformed body) the widget shall keep the last good list, mark it (FR-28), and try again at the next scheduled refresh. An eBird 401 or 403 shall show state S11 (key not accepted) rather than a stale list.

> **FR-28** - **Stale rule.** Every family shall show the fetch time of the data it displays when the most recent refresh attempt failed, in a form that names it as an update time (for example "Updated 9:41 AM"). Medium and large shall show the fetch time on every successful refresh as well. Recency labels (FR-07) and window membership (FR-11) are always recomputed against the current refresh time, never frozen at fetch time. A last good result older than 24 hours shall not be shown as a list: the widget shows state S8 with the time of the last successful fetch.

### G. Empty and error states

> **FR-29** - The widget shall present exactly these states, each as one plain sentence naming what is missing or what happened, in the register of the Map Explorer overlays (The Designer writes final copy; the state set and meaning are fixed here). Both kinds share S1 to S3 and S6 to S12; S4 and S5 belong to Media Targets only.
>
> | State | Condition | Meaning of the message |
> |---|---|---|
> | S1 | No hand-over document exists or it fails validation | Open SnowRaven once to set up widgets |
> | S2 | Hand-over present, no eBird key | Add your eBird API key in SnowRaven's Settings |
> | S3 | Hand-over present, no eBird backup | Load your eBird backup in SnowRaven's Settings |
> | S4 | Media Targets, backup present, no Macaulay Library export | Load your Macaulay Library export in SnowRaven's Settings |
> | S5 | Media Targets, export present, no species matches the Media value (under Any, no species lacks any type; under a single type, none lacks that type) | You already have media (or the named type) for every species in your backup (mirrors the in-app sentence, naming the Media value when it is a single type) |
> | S6 | Location unavailable and no Default Location | Open SnowRaven and allow location, or set a Default Location in Settings |
> | S7 | Location unavailable, Default Location used | The list, with a caption: from your default location (FR-18) |
> | S8 | Fetch failed and no last good result within 24 hours | Could not reach eBird; shows the last successful fetch time if any |
> | S9 | Fetch failed, last good result within 24 hours | The last good list with its fetch time and a short reason (offline, or eBird busy) |
> | S10 | Fetch succeeded, zero rows in the window | No lifers (or media targets) reported within 25 miles in the selected window; names the window and, for Media Targets under a single type, that type |
> | S11 | eBird rejected the key (401 or 403) | eBird did not accept your key; check it in SnowRaven's Settings |
> | S12 | Gallery preview and placeholder | Sample rows with placeholder text; no request and no location read |
>
> State precedence when several apply: S1, then S2, then S3, then S4, then S5, then S6, then the fetch outcome (S11, S8, S9), then S10. S7's caption composes with the list, S9 and S10.

### H. Data hand-over from the app

> **FR-30** - On iPhone and iPad the app shall write one hand-over document into the App Group container containing only: a schema version; the recorded set (FR-14) as sorted normalized names; the target set (FR-15) as sorted normalized names, each with exactly which of Photo, Audio and Video it lacks, or an explicit marker that no Macaulay export is stored; the eBird key, or an explicit cleared marker; the Default Location's latitude and longitude, or absent; and the time written. Nothing else: no observation rows, no checklist ids, no ML asset ids, no OpenWeather key.

> **FR-31** - The document shall be regenerated as a whole (never patched) on app launch once the stored files have loaded, and on every `filesChanged` epoch, every `keysChanged` epoch, and every Default Location save or clear. Because the Settings clear paths and the iCloud synced clears all fire those epochs, clearing the eBird backup regenerates a document with no recorded set (the widget shows S3), clearing the Macaulay export regenerates one with the no-export marker (S4), and clearing the eBird key regenerates one with the cleared key marker (S2). Each regeneration is followed by FR-23.

> **FR-32** - The hand-over is device-local: it is never part of iCloud Sync, and it is removed when the app is deleted. On macOS, Windows, web and Pi no hand-over is written and no code for it runs; the writer is entry-chunk safe and platform-gated through `isTauri()` and the existing iOS check.

> **FR-33** - The widget shall validate the document's shape on every read and treat a malformed or missing document as absent (state S1); it shall never read the app's own `AppLocalData/data/` documents.

### I. Deep link tap-through

> **FR-34** - Tapping a widget shall open the app through a custom URL scheme carrying exactly one of two forms: `snowraven://map/lifers?window=<day|week|all>` for Nearby Lifers, or `snowraven://map/targets?window=<day|week|all>&media=<photo|audio|video|any>` for Media Targets, with the widget's configured window and, for Media Targets, its configured Media value. The scheme shall be declared in `src-tauri/Info.ios.plist` and in every generated copy, pinned identical by a guard.

> **FR-35** - The app shall parse an incoming URL against an allowlist: exactly those two paths, exactly those three window values, for `map/targets` exactly those four media values (required), for `map/lifers` no media parameter, no other query parameters, and a bounded length. Any URL that does not match in full shall be ignored entirely (the app opens or foregrounds normally, nothing is shown, nothing is logged), never partially applied.

> **FR-36** - A matching link shall, in order: activate the Map Explorer tab; set the view to Nearby Lifers (`'lifers'`) or Media Targets (`'targets'`); set that view's Time Range to the link's window; for Media Targets, set the in-app type chips from the link's media value as FR-52 states; set the session radius to 25 mi (not saved); then run "Use my location" and that view's search from the detected position, so the map is centered on the user and the widget's bird is on it. This runs whether or not a search center was already set.

> **FR-37** - If the app is already running on another tab (Settings included), the link switches tabs and applies FR-36. If Map Explorer is already showing, FR-36 applies in place and the search re-runs. On a cold start the link is applied once the stored files have loaded and Map Explorer is mounted. If several links arrive before the first is applied, the last one wins.

> **FR-38** - If location fails after the link, the view and window remain applied, the map shows the existing location failure message, and no search runs. If the eBird backup is not loaded, the view shows its existing setup message and no search runs. If the eBird key is missing, the view shows its existing key notice.

> **FR-39** - The deep-link seam shall be entry-chunk safe and shall not import Map Explorer statically. On macOS, Windows, web and Pi the scheme is not registered and the seam has no reachable effect.

### J. Platform and version

> **FR-40** - The widget extension shall declare an iOS 17.0 deployment target; the app's deployment target shall remain 16.0. On iOS 16 the app runs unchanged and offers no widgets; `docs/HELP.md` shall say widgets need iOS 17 or later, so an empty gallery on an older device is explained. A guard shall pin both targets.

> **FR-41** - The feature shall add no surface to the Mac, Windows, web or Pi builds; those bundles change only by the version bump.

### K. Published statements, help and App Store

> **FR-42** - The build shall leave no published statement untrue. Specifically it shall rewrite: `PRIVACY_POLICY.md` "Your Location" ("requests location only while you're using the app, never in the background" is no longer true: a placed widget reads location on WidgetKit's schedule and sends it to eBird with the user's key, and the user stops it by removing the widget or denying location); the eBird bullet in "Connections to Bird and Weather Services" (the widget's request is the same nearby-sightings request, made on the widget's refresh schedule); and "iOS App" (the shared container, included in device backups under iOS defaults, removed with the app, never synced). `product-brief.md` shall rewrite its two "on demand" sentences to name the widget's scheduled refresh. `ACCESSIBILITY.md` shall gain one sentence on the widget's VoiceOver labels. All in the existing plain register, American spelling, no em dashes.

> **FR-43** - `docs/HELP.md` shall gain a **Widgets** subsection under Map Explorer covering: the two kinds, the three families, the Time range setting, the fixed 25 mile radius, what a row shows, the Default Location fallback and its caption, each state's meaning in a sentence, the refresh cadence and update time, tap-through behavior, the iOS 17 requirement, and how to stop (remove the widget or deny location). The eBird key paragraph in Settings help shall mention the widgets.

> **FR-44** - `appstore/REVIEW_NOTES.md` shall describe the widget and its location use for the reviewer. The App Store privacy label is expected to remain "Data Not Collected" and shall be re-confirmed by the account holder in App Store Connect at the ship. Any change to `appstore/LISTING.md` description copy is at most one proposed sentence, shown before and after and approved by the user before it is written.

> **FR-45** - `README.md` and `website/` shall receive at most one proposed sentence each, in each file's fixed register, shown before and after as tailnet pages and approved by the user before anything is written; the existing "iOS 16 or later" statements remain true and unchanged.

### L. Release and verification

> **FR-46** - The widgets ship with the next version on all platforms per the release rhythm (patch bump by default per CLAUDE.md; four-file version set; changelog entry). The desktop binaries carry the bump unchanged.

> **FR-47** - The release shall add: the extension target in the committed XcodeGen `project.yml`; the App Group entitlement on both the app and the extension (the app's alongside its three iCloud keys); the extension's bundle id and its own App Store provisioning profile; export options signing both; and `--validate-app` before upload. The `snowraven-release` skill shall carry the recipe, including the debug-install failure on a device below iOS 17.

> **FR-48** - Before the App Store submission, the exact uploaded build shall be installed on a real iPhone, opened, a widget of each kind added, observed to refresh with real rows and distances, and tapped through into Map Explorer with the correct view, window and location applied. This precedes submission; it does not follow it.

> **FR-49** - Guards shall pin: the URL scheme across every plist that carries it; the App Group identifier across `project.yml` and both entitlement files; the extension target name and its 17.0 deployment target with the app's 16.0; and the location usage string across its copies. Swift unit tests (parity fixture, deep-link URL construction, hand-over decoding, state precedence) run on the release machine, since `ubuntu-latest` CI cannot compile Swift; that limit is stated in the tests' own header and in the release skill.

### M. Media Targets media setting (added 2026-09-24, decisions.md Stage 4)

> **FR-50** - A Media Targets widget shall have a second configuration parameter (working name **Media**; The Designer names the label) with exactly four values, **Photo**, **Audio**, **Video** and **Any**, a single choice, default **Any** for a newly placed widget. It selects the listing rule in FR-15. Under a single type the widget's header names that type (for example the title with "photo"); under Any it does not. Nearby Lifers has no such parameter. The value is applied locally to the shared fetched result, exactly as the window is; it never changes the request or the cache key.

> **FR-51** - Under **Any** only, every row in every family, the small family included, shall show one glyph per missing type next to the species name (a photo glyph, an audio glyph, a video glyph, in that fixed order), reflecting that species' missing set from the hand-over (FR-30). The row's VoiceOver label shall append "needs photo", "needs audio", "needs video", or the combination in the same order ("needs photo and video", "needs audio and video", "needs photo, audio and video", and so on). Under **Photo**, **Audio** or **Video** no per-row glyph is shown and nothing is appended, since every row is missing the selected type and the header names it (FR-50). The glyphs never carry meaning by color alone.

> **FR-52** - Tap-through shall carry the Media value (FR-34) and apply it to the in-app Media Targets type chips: **Photo** selects the Photo chip alone; **Audio** the Audio chip alone; **Video** the Video chip alone; **Any** clears the in-app chips to All (the in-app chip keeps its own label). The "matches Map Explorer" criterion is equality in every setting: the widget's species set equals Map Explorer's for the same window, location, radius and chip state, for each of the four values. No in-app filter is changed in this build.

## Non-Functional Requirements

> **NFR-01 - Performance:** A widget refresh, including location, one fetch, decode, subtraction and layout, completes within WidgetKit's per-refresh time allowance on an iPhone that runs iOS 17; a refresh served from cache completes without any network wait.

> **NFR-02 - Memory:** The extension decodes the eBird payload once, holds at most one payload in memory, and stays within WidgetKit's extension memory limit on a dense-region fixture (a 40 km, 30 day payload of at least 5,000 records); the Architect measures rather than assumes. If a bound on records must be requested from eBird, the bound and its effect on completeness are stated at the definition site.

> **NFR-03 - Network etiquette:** At most one eBird request per 15 minutes per device regardless of how many widgets are placed; never more than one request per refresh; 429 honored as in FR-26; a 429 or error never cached as a result.

> **NFR-04 - Security:** The deep-link parser is allowlist-driven, bounded in length, and reflects nothing from the URL into the UI; the hand-over document is shape-validated on every read; the eBird key is stored in the shared container the same way it is stored in the app's sandbox today and is never logged or shown; the widget's only outbound host is `api.ebird.org` over HTTPS. `.claude/rules/security.md` applies to the parser and to every scan over the eBird payload.

> **NFR-05 - Accessibility:** Each widget exposes a VoiceOver label reading the title and window, then each row as one element with the full species name, distance with the unit spoken in full ("miles"), recency, location name and, under Any, the appended "needs photo" / "needs audio" / "needs video" or their combination (FR-51), then the update time and any caption or state sentence. Text uses system text styles so it scales with Dynamic Type across the sizes WidgetKit honors; at larger sizes rows drop rather than clip (FR-03) and a long species name truncates with an ellipsis visually while its label stays complete. The widget is legible in light and dark appearance and in the tinted (iOS 18) and clear (iOS 26) home-screen rendering modes, with no meaning carried by color alone, and light and dark meet WCAG 2.1 AA contrast. Nothing animates.

> **NFR-06 - Compatibility:** Widgets on iOS and iPadOS 17 and later, iPhone and iPad; app on 16 and later; no macOS, Windows, web or Pi surface; no change to what iCloud Sync carries.

> **NFR-07 - Privacy:** No new provider, no telemetry, nothing reaches the developer; the widget's outbound data is the same request Nearby Lifers makes today (coordinates, radius, window, the user's key) and nothing more.

> **NFR-08 - Entry chunk:** The deep-link seam and the hand-over writer add nothing to the App.tsx entry chunk beyond an entry-safe module; `entryChunk.test.ts` stays green; MapExplorer is never statically imported by either.

> **NFR-09 - Testability:** The TypeScript halves (hand-over content, URL parsing, navigation seam, window predicate) are tested in vitest on CI; the Swift halves consume the same fixture and run on the release machine; the split is stated honestly in the QA table.

> **NFR-10 - Copy:** Widget strings and all prose changed by this feature use American spelling and contain no em dashes (U+2014); user-facing surfaces are named from `TAB_LABELS` and `MAP_VIEW_MODE_ORDER`, never from component names.

## Out of Scope

- Any map, image or snapshot inside the widget (the tap-through is the map).
- Lock-screen and StandBy accessory families, Apple Watch complications, Live Activities, interactive widget buttons.
- Hotspots and My Sightings widgets; a nearest-unvisited-hotspot widget is a possible follow-up.
- A configurable radius or a per-widget custom center.
- Any change to the in-app Media Targets type chips (FR-52).
- The in-app manual target list as a widget source (session-only, never stored; OQ-01).
- macOS desktop widgets, Windows, web and Pi.
- Background location, Always authorization, geofencing, notifications.
- Any change to what iCloud Sync carries; the hand-over is device-local.
- Any new outbound service; only eBird, with the user's key.
- Applying countability (`isNonCountableForm`) or escapee exclusion to the lifer subtraction; neither is applied in-app today, and adding either would be a change to Map Explorer first (FR-14).
- App Store screenshots of the widgets (OQ-05).
- Universal Links (no developer-operated domain).

## Open Questions

Each carries the default that stands if no answer arrives before Stage 5.

- **OQ-01 - Media Targets with no Macaulay export.** The brief said the widget uses "the manual target list when no export is loaded", but that list is session-only component state and is never stored, so no widget can read it. Default: the widget shows S4 (load your Macaulay Library export); persisting the manual list is a separate Map Explorer change, not part of this feature.
- **OQ-02 - Hand-over carries names, not codes.** In-app Media Targets filters by eBird species codes resolved through the taxonomy; the widget matches by normalized common name (FR-15), which needs no taxonomy in the extension and is equivalent in every case the fixture covers (forms roll up to the parent name on both sides). Default: names only; codes are not written.
- **OQ-03 - Map Explorer hidden in Tab Layout.** Default: a deep link still activates Map Explorer for the visit (a widget tap is an explicit request); the saved layout is not changed.
- **OQ-04 - Cache key rounding.** Default: two decimal places (about 0.7 mi); the Architect may tighten to three if measurement shows two coalesces refreshes a walking user would expect to differ.
- **OQ-05 - Store screenshot of a widget.** Default: none; existing screenshots stay valid because no existing screen changes. The account holder may add one at the ship.
- **OQ-06 - Version bump size.** A new extension is a larger feature, but CLAUDE.md says patch by default unless told otherwise. Default: patch.
- **OQ-07 - Location wait bound.** Default: 10 seconds before falling back to the Default Location (FR-18); the Architect measures a cold fix on device.

## Success Metrics

Venue key: **[vitest]** runs on CI; **[pytest]** runs on CI; **[Swift]** XCTest on the release machine only (CI cannot compile Swift); **[sim]** iOS simulator; **[device]** real iPhone or iPad; **[review]** a reading check of files or App Store Connect.

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01 two kinds in the gallery | [device] Widget gallery lists "Nearby Lifers" and "Media Targets" as separate kinds; both can be placed, and a second copy of either can be placed |
| QA-02 | FR-02 three families | [sim] Each kind renders in small, medium and large on iPhone and iPad; no accessory family is offered |
| QA-03 | FR-03 row counts | [Swift] For a fixture with 12 qualifying species, the small entry has 1 row, medium 3, large 8, and they are the first N of the ordered list; [sim] at the largest WidgetKit text size the large family shows fewer whole rows and no clipped row |
| QA-04 | FR-04 title and window always present | [sim] In every state S1 to S12 and every family the tile shows the kind's name and, on a list, the selected window |
| QA-05 | FR-05 row fields | [sim] A medium row shows name, distance, recency and location name; a small row shows at least name, distance and recency; [Swift] the small row's accessibility label includes the location name |
| QA-06 | FR-06 distance rule and format | [Swift] For fixture coordinates the Swift distance equals the vitest `distanceMiles` value to within 0.01 mi and formats as one decimal plus " mi"; 0.04 mi renders "0.0 mi" |
| QA-07 | FR-07 recency labels | [Swift] With "now" fixed, reports dated today, yesterday and 5 days back render "Today", "Yesterday", "5 days ago"; a report at 23:59 local yesterday still reads "Yesterday"; an unparseable date is excluded |
| QA-08 | FR-08 one row per species | [Swift] A species at two locations appears once, at the nearer; at equal distance, at the more recent; at equal both, at the smaller `locId` |
| QA-09 | FR-09 ordering | [Swift] Fixture output is distance ascending; two species at equal distance order most-recent first; equal on both order A to Z case-insensitive; order identical across families |
| QA-10 | FR-10 configuration | [device] A Nearby Lifers widget's edit sheet offers exactly Time range with Day, Week, 30 days and nothing else; a Media Targets widget's edit sheet offers exactly Time range and the Media parameter; a newly placed widget of either kind shows Week |
| QA-11 | FR-11 window parity | [Swift]+[vitest] Both runtimes, from the same fixture, produce the same species set for Day, Week and 30 days; a report exactly 7 days old is in Week; 8 days old is not; 30 days applies no filter (a 29-day-old report from the fetch is present) |
| QA-12 | FR-12 window change without a request | [Swift] Changing the window with a fresh cache produces a new entry with zero network calls recorded by the test transport |
| QA-13 | FR-13 record reduction | [Swift]+[vitest] Fixture records reduce to one per (speciesCode, locId) with the most recent `obsDt` and its `subId`; records with missing coordinates or code are dropped; the request URL carries `dist=40` and `back=30` |
| QA-14 | FR-14 lifer subtraction parity | [Swift]+[vitest] Same fixture, same recorded set: identical lifer species sets; a recorded "Mallard (Domestic type)" subtracts a reported "Mallard"; "NORTHERN SHRIKE" subtracts "Northern Shrike"; a non-countable form and an escapee in the fixture are NOT subtracted unless recorded, on both sides |
| QA-15 | FR-15 target derivation parity | [vitest] For the same backup and ML rows the hand-over's target set equals the in-app `targetSpecies` names normalized, and each entry's missing set equals the in-app `missingTypes`; a species with all three media is absent; [Swift] under Photo the listed species are exactly those lacking Photo, under Audio those lacking Audio, under Video those lacking Video, under Any every species in the set; with the no-export marker the widget shows S4 |
| QA-16 | FR-16 fixture completeness | [review] The tracked fixture contains every named case (parenthetical form, mixed case, same-day, exactly 7 days, 8 days, no coordinates, two-location species, equal-distance pair, and the eight media cases: Photo only, Audio only, Video only, each of the three pairs, all three, and none missing) with expected rows and glyphs under each of the four Media values, and both test suites import it by path |
| QA-17 | FR-17 location at refresh | [device] With When In Use granted, a refresh lists rows whose distances are from the device's position; the app's usage string is shown once, in the app, never a second prompt from the widget; Settings shows no Always request |
| QA-18 | FR-18 Default Location fallback | [device] With location denied and a Default Location saved, the widget lists rows measured from the Default Location with the caption; distances use 25 mi, not the saved radius; [Swift] with a stubbed location failure and a hand-over Default Location, the entry carries the caption |
| QA-19 | FR-19 no location, no default | [Swift] Stubbed location failure and no Default Location produce S6 and zero network calls |
| QA-20 | FR-20 usage string | [vitest] Every plist copy carries the identical `NSLocationWhenInUseUsageDescription` and it mentions widgets |
| QA-21 | FR-21 single host | [Swift] Every request the test transport records targets `https://api.ebird.org/v2/data/obs/geo/recent` with the fixture key header; with no key the transport records zero requests |
| QA-22 | FR-22 cadence and request bound | [Swift] The timeline policy asks for a refresh about 30 minutes ahead; one refresh records at most one request; with a fresh cache it records zero |
| QA-23 | FR-23 app-side reload | [vitest] Each hand-over write calls the reload seam exactly once; [device] after uploading a new backup in Settings, a placed widget updates within a minute without waiting for the cadence |
| QA-24 | FR-24 shared cache | [Swift] Two refreshes 5 minutes apart at points 0.2 mi apart record one request; one refresh 16 minutes later records a second; a Nearby Lifers and a Media Targets refresh at the same point record one request between them; distances in the second entry are recomputed from the second reference point |
| QA-25 | FR-25 key change discards cache | [Swift] After a hand-over with a different key is read, the next refresh records a request even with a fresh cache; after a backup-only change with a fresh cache, zero requests |
| QA-26 | FR-26 429 behavior | [Swift] A stubbed 429 keeps the previous rows, marks the entry with the previous fetch time, records exactly one request in that refresh, stores no result, and schedules the next attempt no earlier than the cadence or a larger `Retry-After` |
| QA-27 | FR-27 other failures and 401/403 | [Swift] A stubbed network error keeps the last list marked; a stubbed 401 and a stubbed 403 each produce S11 with no rows |
| QA-28 | FR-28 stale rule | [Swift] After a failed refresh every family's entry exposes the fetch time; a successful medium and large entry exposes it too; a last good result 25 hours old with a failed refresh produces S8 with that time; recency labels in a marked list are computed against the current "now" |
| QA-29 | FR-29 states and precedence | [Swift] A table-driven test produces each of S1 to S12 from its condition and verifies precedence (missing key beats missing backup; missing backup beats no export; S6 beats a fetch error; S7 caption composes with S9 and S10); [sim] each state renders with the title and one sentence |
| QA-30 | FR-30 hand-over content | [vitest] The written document contains exactly the listed fields; a JSON key scan finds no observation, checklist id, ML asset id or OpenWeather key; the recorded and target sets are sorted normalized names and each target entry's missing set is a non-empty subset of {Photo, Audio, Video} |
| QA-31 | FR-31 regeneration triggers | [vitest] The writer runs on load, on `notifyFilesChanged`, on `notifyKeysChanged`, and on Default Location save and clear; clearing the eBird backup yields a document with no recorded set; clearing the ML export yields the no-export marker; clearing the key yields the cleared marker; each write is a whole-document replace |
| QA-32 | FR-32 device-local and platform gated | [vitest] With `isTauri()` false, or true and not iOS, the writer performs no write and imports no native module; [review] the iCloud Sync file scope is unchanged; [device] deleting the app and reinstalling shows S1 until the app is opened |
| QA-33 | FR-33 validation on read | [Swift] A truncated, wrong-version, or wrong-typed document yields S1; the widget code has no reference to the app's `data/` documents |
| QA-34 | FR-34 link form and scheme declaration | [Swift] Each Nearby Lifers window builds exactly the specified URL with no media parameter; each Media Targets window and media pair (twelve) builds exactly the specified URL; [vitest] the scheme is declared in `Info.ios.plist` and every generated copy and the copies are identical |
| QA-35 | FR-35 allowlist | [vitest] Table-driven: the three valid lifers URLs and twelve valid targets URLs parse; an unknown path, an unknown window, a missing window, an unknown media value, a targets URL with no media, a lifers URL with a media parameter, an extra query parameter, a fragment, an over-length URL and a `javascript:` payload are all rejected whole, with no partial state change and no rendered output |
| QA-36 | FR-36 navigation effect | [vitest] A parsed `map/targets?window=day&media=photo` results in the Map Explorer tab active, view `'targets'`, the targets window `'day'`, the type chips {Photo}, radius 25, and one "use my location" search call; `map/lifers?window=all` sets the lifers window `'all'`; [device] tapping a Day, Photo Media Targets widget lands on Map Explorer, Media Targets, Day, Photo chip, centered on the user with the widget's bird on the map |
| QA-37 | FR-37 already running and cold start | [device] From Settings, a tap switches to Map Explorer and searches; from Map Explorer with a center set, a tap re-runs from the current location; from a cold start the search runs after the files load; [vitest] two links before mount apply only the last |
| QA-38 | FR-38 degraded link outcomes | [vitest] With a stubbed location failure the view and window are applied, the location message is set, and no search runs; with `setup-required` the view shows its setup message and no search runs |
| QA-39 | FR-39 entry safety and desktop no-op | [vitest] `entryChunk.test.ts` passes; the seam module has no static import of MapExplorer; on a desktop build the scheme is absent from the macOS bundle configuration |
| QA-40 | FR-40 iOS targets | [vitest] The guard reads the extension's deployment target as 17.0 and the app's as 16.0; [review] `docs/HELP.md` states widgets need iOS 17 or later |
| QA-41 | FR-41 no desktop surface | [review] The diff touches no desktop or web runtime path other than the version set; [vitest] the full suite is green |
| QA-42 | FR-42 published statements true | [review] `PRIVACY_POLICY.md` no longer says "never in the background" and describes the widget's scheduled location read, the eBird request and the shared container; `product-brief.md` has no unqualified "on demand"; `ACCESSIBILITY.md` carries the VoiceOver sentence; [vitest] no U+2014 in any changed prose file |
| QA-43 | FR-43 help | [review] The Widgets subsection covers every item listed in FR-43 and the Settings eBird key paragraph mentions widgets; [vitest] the in-app help renders the new section |
| QA-44 | FR-44 App Store record | [review] `REVIEW_NOTES.md` describes the widget and its location use; the privacy label is confirmed "Data Not Collected" in App Store Connect at the ship, in writing in the ship record; any listing sentence was approved before writing |
| QA-45 | FR-45 README and website gate | [review] The ship record shows before and after for each proposed sentence and the user's approval preceding the write, or shows no change; the "iOS 16 or later" sentences are unchanged |
| QA-46 | FR-46 release set | [vitest] The four-file version guard passes; [review] `CHANGELOG.md` carries the entry; the release goes to every platform |
| QA-47 | FR-47 signing and validation | [review] `xcodebuild -exportArchive` signs both bundle ids; `altool --validate-app` passes before upload; the release skill carries the recipe |
| QA-48 | FR-48 device pass before submission | [device] The ship record shows, before the submission time, the uploaded build installed on a real iPhone, both kinds added, a refresh with real rows, and a tap-through landing on the right view, window and location |
| QA-49 | FR-49 guards and Swift tests | [vitest] The scheme, App Group id, target names, deployment targets and usage string guards pass and each goes red on a one-character mutation of its source; [Swift] the parity, URL, decoding and state tests pass on the release machine and their header states the CI limit |
| QA-50 | NFR-01, NFR-02 limits | [device] A refresh in a dense region completes and renders; [Swift] the dense fixture decodes once within the memory limit measured with the allocation counter, and the code holds one payload at a time |
| QA-51 | NFR-03 etiquette | [Swift] Over a simulated hour with two widgets of each kind placed, the transport records at most four requests |
| QA-52 | NFR-04 security | [review] The security review confirms the allowlist, the bounded length, no URL reflection, the document validation, no key in logs and the single host; [vitest] the URL parser's hostile corpus (control characters, encoded slashes, long inputs) is rejected in linear time |
| QA-53 | NFR-05 accessibility | [device] VoiceOver reads the title and window, each row in full with "miles" spoken and, on an Any widget, "needs photo" / "needs audio" / "needs video" or their combination, the update time and any caption; at the largest WidgetKit text size rows drop, nothing clips; light, dark, tinted and clear modes are each legible; [Swift] the accessibility label of a fixture entry equals the expected string |
| QA-54 | NFR-08 entry chunk | [vitest] `entryChunk.test.ts` passes with the new modules on the graph only where declared entry-safe |
| QA-55 | NFR-10 copy | [vitest] A scan of the widget's string table, the changed prose files and the changelog entry finds no U+2014 and no British spellings from the house list |
| QA-56 | FR-50 Media parameter | [device] A Media Targets widget's edit sheet offers the Media parameter as a single choice with exactly Photo, Audio, Video, Any; a newly placed one shows Any; a Nearby Lifers widget has no Media parameter; under Photo, Audio or Video the header names the type and under Any it does not; [Swift] changing Media with a fresh cache produces a new entry and records zero requests, and the cache key is identical across the four values |
| QA-57 | FR-51 glyphs and labels | [Swift] From the fixture under Any: each single-type species carries exactly its one glyph and "needs photo" / "needs audio" / "needs video"; each pair carries its two glyphs in photo, audio, video order and the matching phrase ("needs photo and video" for that pair); the species missing all three carries three glyphs and "needs photo, audio and video"; the same in small, medium and large; under Photo, Audio and Video no row carries a glyph or an appended phrase; [sim] the small family shows the glyphs beside the name; [device] VoiceOver speaks the appended phrase |
| QA-58 | FR-52 tap-through chip mapping | [vitest] A parsed media `photo` sets the chips to {Photo}, `audio` to {Audio}, `video` to {Video}, `any` to the empty set (the in-app All chip); [device] tapping an Any widget lands on Media Targets with the in-app All chip selected; tapping a Video widget lands with the Video chip alone |
| QA-59 | FR-52 parity criterion | [Swift]+[vitest] From the fixture, for each of the four Media values the widget's species set equals Map Explorer's set with the matching chip state exactly: under Any the seven species missing anything are present and the all-media species is absent; under Photo exactly the four species lacking Photo; under Audio exactly the four lacking Audio; under Video exactly the four lacking Video |
