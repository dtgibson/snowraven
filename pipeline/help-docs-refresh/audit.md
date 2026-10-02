# Audit: Help Docs Refresh (help-docs-refresh)

Worklist for The Engineer. Audited 2026-10-02 against `main` at `a98efa9` (1.0.45):
`docs/HELP.md` read whole and checked against CHANGELOG 1.0.0 to 1.0.45, `TAB_LABELS` /
`DEFAULT_TAB_ORDER` (`frontend/src/lib/tabLayout.ts`), the Settings sequence pinned in
`frontend/src/components/settingsSectionOrder.test.tsx`, and the UI strings in `frontend/src`.
Every bold label in HELP.md was matched against shipped source, and every `label="..."` in
`frontend/src/components` was matched back against HELP.md.

Line numbers are HELP.md at `a98efa9`. "Verified" means checked in code during this audit;
"verify" means the Engineer confirms against the cited code before writing.

Each fix is written to the house register (`.claude/rules/docs-and-website.md`): state the
property, never a count; examples given as examples; no em dashes; American spelling; surfaces
named from `TAB_LABELS`; every repaired sentence swept at paragraph scope.

## A. iPhone and iPad are missing from platform statements

The iOS app has been on the App Store since 1.0.0, but several general statements still name
only the desktop and web/Pi builds.

- **A1. Intro (line 3)** names "a standalone desktop app on Mac or Windows, or ... a self-hosted
  server". Add iPhone and iPad. README line 3 has the approved form: "a native Mac, Windows,
  iPhone or iPad app, or self-hosted on a Raspberry Pi (or any computer on your network)".
- **A2. Getting Started (lines 9-16).** (a) It never mentions the first-run Welcome screen
  ("Welcome, let's get you set up", with **Go to Settings**; `WelcomeScreen.tsx`) or where Help
  opens: the footer's **Help** link, and Settings, Help & Documentation, **Open documentation**
  (`App.tsx:1685`, `Settings.tsx:2302-2338`). (b) Step 1 says the eBird key is required for "the
  Weather tab and the Map Explorer". It is also needed for Targets (a county's species list the
  first time, and live counts), List Comparer's Checklists mode, Statistics' escapee check and
  Projects, and on iPhone and iPad the widgets and Alerts. Rewrite it as the property (anything
  that asks eBird a question) and give these as examples. (c) Step 3's tab list leaves out
  Targets. (d) Step 4's ML list leaves out Named Birds, the Calendar's Media overlay, Targets'
  Media kind, Map Explorer's Media Targets view, and the Media Targets widget.
- **A3. eBird backup "used by" (line 96)** leaves out Targets. **ML export "used by" (line
  110)** leaves out the Calendar (the Media overlay splits by format), Targets (the Media kind),
  Map Explorer's Media Targets view, and the Media Targets widget. Both read as complete lists.
  Either make them complete or restate them as the property with examples. Use the same choice
  as A2.
- **A4. Where files are stored (lines 86, 738).** Both name only "the desktop app" and "web/Pi
  mode". Add that the iPhone and iPad apps keep files on the device. On iPhone and iPad the row
  buttons read **Import file…** and **Import new…** and open the Files picker
  (`lib/fileRowCopy.ts:12`); line 738 names only **Upload new**. Optional: one sentence on
  saving the eBird download to Files on a phone.
- **A5. Weather auto-copy (line 122).** The parenthetical lists the web, the Pi, macOS and
  Windows. Say "on every platform", or add iPhone and iPad (verify that the iOS lookup path
  auto-copies through `copyText`).
- **A6. Map Explorer location (line 457).** Gives the macOS, Windows and browser fixes only. The
  iPhone and iPad fix is Settings → Privacy & Security → Location Services
  (`lib/location.ts:20-26`, verified).
- **A7. Settings, Troubleshooting (lines 828-830).** The heading says "(desktop app)" and the text
  says "Mac and Windows desktop apps ... does not appear in the web/Pi version". It also appears
  on iPhone and iPad (`Settings.tsx:2500`, gated on `isTauri()`; the iPhone row of
  `settingsSectionOrder.test.tsx` includes it). There the button reads **Rebuild caches** and
  then asks you to close and reopen SnowRaven (`Settings.tsx:1506-1570`, verified). No internal
  link targets the heading's anchor, so it can be renamed.

## B. Wrong labels, wrong behavior, missing controls

- **B1. Updating (line 862).** "click **Install update** ... then prompts you to relaunch". The
  button reads **Install update and restart**, and the app restarts by itself ("Update installed.
  Restarting…") (`UpdateFooter.tsx:84,116`, verified).
- **B2. Hotspots (line 529).** "click Fetch hotspots". The button is **Find Hotspots**
  (`MapExplorer.tsx:2460`). The other two views use **Find Nearby Lifers** and **Find Recent
  Sightings** (`:2977`, `:2784`). Lines 473 and 479 say a bare "**Find**". Name the view's
  button, or say "the view's Find button".
- **B3. Multimedia toolbar (line 606).** "Merge subspecies: on by default" is wrong. The control
  is **Show subspecies**, off by default (`LifeList.tsx:748`), and line 599 of HELP already uses
  that name. **Show non-bird** (`LifeList.tsx:759`, shown only when the eBird backup is loaded)
  is not documented anywhere. It is off by default and includes Macaulay Library items whose
  name is not a bird in your eBird backup, such as soundscapes, insects and habitats. Verify the
  wording against `LifeList.tsx:330-378` and `LifeListTable.tsx:152`.
- **B4. Media Targets (line 569).** Three things are missing. (a) With no ML export, a **Target
  Species** picker lets you choose species by hand ("Upload an ML export in Settings to
  auto-derive targets, or select species manually."). (b) The **Find Recent Sightings** button.
  (c) The **Filter by Type** chips (All, Photo, Audio, Video), which appear once results load
  (`MapExplorer.tsx:2735-2830`). The Widgets "Tapping a widget" paragraph (line 587) already
  refers to "the Filter by Type chip", which this section never introduces.
- **B5. Search, Destinations (line 30).** On iPhone and iPad, while Alerts is on or the inbox
  holds alerts, an **Alerts inbox** destination with its count heads the list
  (`lib/paletteRows.ts:96-100`, `lib/alerts/alertsInboxEntry.ts:26`, verified). Add one
  sentence. `palettePublishedClaims.test.ts` guards this passage, so keep "Every tab you have
  visible" and the hidden-tab sentence as they are.
- **B6. Using SnowRaven offline (lines 849-856).** (a) "the Checklist Comparer" is not a surface
  name. Use List Comparer's Checklists mode. (b) "live nearby-bird overlays" is vague. Name Map
  Explorer's Hotspots, Nearby Lifers and Media Targets searches. (c) The section never mentions
  the other lookups that need a connection: Statistics' escapee check and Projects, the widgets
  (which keep their last list marked Offline), and Alerts checks (status line "offline"). (d) The
  replay bullet (line 846) covers checklist readings only. A loaded plan also re-shows offline
  (line 143). Sweep the whole section.
- **B7. Targets default sort (line 435).** Help says the tab "opens on this month's frequency
  when the county has a bar-chart file, and on the live count otherwise". The code
  (`lib/targets/targetsSort.ts:90-98`, verified) does this: this month's frequency when the file
  covers the current month, otherwise the live count when any live data exists, otherwise
  Taxonomic. Check `targetsPublishedClaims.test.ts` before editing.
- **B8. Bar-chart file on web and Pi (lines 427, 826).** Line 427 says "Everywhere else the file
  stays on this device", and the Settings section says "saved on this device". On web and Pi
  installs the file is stored on the server, like the other files
  (`backend/routers/barcharts.py`; verify with `storage.barcharts.web.test.ts`). The
  `icloudBarChartPublishedClaims.test.ts` guard covers this passage.
- **B9. Targets, Live counts (line 431).** "Answers are kept on this device." It does not say
  that with iCloud Sync on, a county's days checked on one device are shared with your other
  devices. Settings, iCloud Sync (line 744) and Offline (line 853) both say so. Add one clause
  with a cross-reference.
- **B10. Settings is missing its Help & Documentation section.** The app shows it after Default
  Files / iCloud Sync and before Appearance ("SnowRaven Documentation", "Available offline.",
  **Open documentation**; `Settings.tsx:2302-2338`, verified). Add a short `### Help &
  Documentation` in that position, so Help's Settings walkthrough matches the app's section order
  (`settingsSectionOrder.test.tsx:137`).
- **B11. Default Location (line 788).** "Set a home location used by the Map Explorer." It is
  also where Targets measures distances from by default (line 437), and the default for Alerts'
  Fixed place (line 800). Name both alongside the widgets.
- **B12. Targets (line 439).** "The type toggles, chips, sort, window, distance and the point
  distances are measured from last for the session" does not parse. Rewrite it with the same
  facts: they last for the session, are not saved, and only the county is remembered.
- **B13. Weather, Plan (line 139).** Help says "Plan lets you choose a place". When nothing is
  picked yet, opening Plan also asks the device for your location and pre-fills "Your location"
  (`WeatherForecastPanel.tsx:312-322`, verified). If that fails, the place stays empty for you
  to search or tap. Say so. H-P2 below covers the same fact on the privacy side.

## C. Text that reads like a release note

These sentences describe a change rather than how the app behaves.

- C1 line 88 "no longer stores it and leaves the Multimedia tab to report it later"
- C2 line 243 "(Records like your biggest day and longest streak now live in Highlights & Records, below.)"
- C3 line 277 "(Record counts and rarity lists moved to Highlights & Records.)"
- C4 line 283 "since its first release, and until now nothing read one back. This section does."
  Keep a "reads ... back" verb and "checklist comment" in the passage, because
  `weatherStatsPublishedClaims.test.ts:232-243` asserts both.
- C5 line 523 "**Normal** is the default and looks exactly as before."
- C6 line 565 "This view replaces the old flat Nearby Lifers list that lived on the Statistics tab."
- C7 line 784, the "Copy coordinates only" migration note from 0.5.x
- C8 line 157 "plain text in this version". The fact is true (App.tsx:1372 passes no hotspot
  resolver), so keep it and drop "in this version".
- C9 line 375 "with both off the Calendar looks exactly as it always has". Say instead that the
  overlays add nothing while off.

## D. British spellings (user direction: American spelling)

line 453 "centre", line 471 "greyed", line 483 "greys", line 557 "grey", line 780 "metre".
No guard pins any of these words.

## E. Structure

- **E1. The tab sections are out of the app's order.** HELP runs Weather, Species Detail,
  Statistics, Calendar, Targets, Map Explorer, Multimedia, Breeding Codes, Named Birds,
  Checklists, List Comparer. `DEFAULT_TAB_ORDER` runs Weather, Statistics, Map Explorer, Species
  Detail, Calendar, Targets, Multimedia, Breeding Codes, Checklists, List Comparer, Named Birds,
  and README and the website follow that order. Fix:
  1. Move the `##` tab sections into `DEFAULT_TAB_ORDER`. Getting Started, Search, API Keys and
     Default Files stay first. Settings, Offline and Updating stay last.
  2. Reorder the `TOC` in `HelpDocs.tsx` to match.
  3. Add a `helpToc.test.ts` row that asserts the tab sections appear in `DEFAULT_TAB_ORDER`,
     named through `TAB_LABELS`.
  4. After the move, grep for "above", "below", "earlier" and "later" used as cross-references.
  Move text verbatim, apart from this worklist's own edits.
- **E2. Optional: TOC sub-entries for Widgets (under Map Explorer) and Alerts (under
  Settings).** Readers look for these two iPhone and iPad features by name, the same reason
  Projects and Bar-chart files have entries. If added, give each a `helpToc.test.ts` row shaped
  like the Bar-chart files row.
- **E3. Stale count in source.** `HelpDocs.tsx:12` says "all 16", but there are 18. Rewrite the
  comment so it states no count.

## F. Paragraphs this run must not edit (keeps the bundle merge clean)

- **F1. Settings, iCloud Sync: the "Clearing a file with sync on", "Turning it off" and "One
  device, more than one Apple ID" paragraphs (lines 752-756), and the blank lines between them.**
  `icloud-remove-synced-failure` (`8a92987`, on `weft-spool/20261002-160902`, not yet on `main`)
  rewrites "Turning it off". A change within git's three lines of context would conflict.
- **F2. Map Explorer, Widgets, "Keeping it current" (line 583).** Do not change its "at most one
  eBird request" claim. `widget-refresh-take-turns` (`516bd49`, same bundle) is the fix that makes
  that claim true for overlapping refreshes. Moving the paragraph during E1 is fine.
- The other two bundle commits (`b5da343`, `e18e74d`) touch no published file.

## G. Out of scope here (reported to the Orchestrator for the idea inbox)

- **G1. In-app copy.** The Appearance save prompt says "Your preference will be saved in this
  browser's local storage, on this device only. Nothing is sent to the server." on every
  platform. On the Mac, Windows, iPhone and iPad apps the choice is saved through the app's own
  storage, not browser local storage (`Settings.tsx:180` and the hydrate comment at `:77`).
- **G2. Possible bug.** `recencyTier` (`lib/mapExplorerFormat.ts:57-65`) counts days as
  milliseconds divided by 86,400,000. On the day after clocks spring forward, an 8-day-old report
  would get the "past 7 days" color. This is the same bug class 1.0.39 fixed for the Day and Week
  windows. Not measured.
- **G3. Stale source comment.** The Acknowledgments comment (`Settings.tsx:2521-2523`) says it
  follows "Tab Layout on web/Pi and iOS". Bar-chart files now sits between them, and iOS shows
  Troubleshooting.
- **G4. Unverifiable here.** HELP line 163 says SnowRaven Mini "is not yet on the extension
  stores". This repo cannot check that, and CLAUDE.md keeps other projects' status out of this
  repo's records. Leave it unless the user says otherwise.

## H. Published statements (ACCESSIBILITY.md, PRIVACY_POLICY.md): held patch only

**Neither file is written in this run.** Each fix below goes into
`pipeline/help-docs-refresh/held-patch.md` as exact before and after text. The Orchestrator shows
it to the user rendered, and it is applied only on an explicit yes. A privacy edit has to be
mirrored word for word in `website/privacy.html`, so that page is part of the same held patch
(`privacyPageParity.test.ts`). A changed or added sentence in either file also needs a guard of
the `*PublishedClaims` shape in the same change, so the patch should include one.

Sync status today: by hand, `PRIVACY_POLICY.md` and `website/privacy.html` match (same 13
sections and anchors, same October 1, 2026 date, and the body text differs only in whitespace).
Neither file has an em dash.

**PRIVACY_POLICY.md: definitely stale**
- **H-P1. Line 38** "Anything the app saves from an answer stays on your device". Since 1.0.40,
  with iCloud Sync on, the Targets day answers from eBird go to the user's iCloud account, one copy
  per device, which line 69 already says. The two lines contradict each other.
- **H-P2. Line 42.** The list of location controls leaves out the Weather tab's **Plan**, which
  reads the device's location by itself and pre-fills "Your location" (verified,
  `WeatherForecastPanel.tsx:312-322`). Either Plan action then sends those coordinates to
  OpenWeather and NOAA.
- **H-P3. Missing: Copy iCloud details.** iPhone and iPad have had it since 1.0.40, the Mac since
  1.0.41. The policy never mentions it (0 matches). It is the one route by which device names,
  county codes, file sizes, dates and Apple's error messages can reach the developer, and only if
  the user pastes it. It holds no file contents, file names the user chose, or API keys.

**PRIVACY_POLICY.md: judgment calls (the user decides)**
- Line 16 and line 63 disagree a little about whether clearing the backup removes the Alerts
  position.
- Line 34: OpenWeather "for a location and time you choose" does not cover the Planner's whole
  forecast window. The NOAA bullet on line 36 was updated for that case; this one was not.
- Line 31: "when you open the Targets tab". The 30-day check also runs when you switch counties.
- Lines 16 and 72 do not say that, with sync on, removing a bar-chart file removes it from iCloud
  and from the other devices.
- Line 33: "73 on a 21,000-observation export" is a count in published prose.

**ACCESSIBILITY.md: definitely stale**
- **H-A1. Line 3** "It runs in the browser and as a desktop app". It leaves out iPhone and iPad,
  which lines 11 and 33 rely on.
- **H-A2. Line 19.** The Calendar day example "Mar 14, 2025: 3. Open day details" is out of date.
  Since 1.0.38 the name says what the number counts ("3 countable species"), and with overlays on
  it adds media and breeding facts (`Calendar.tsx:341-342`, `lib/calendarOverlays.ts:337-356`).
  The same line has "coloured".
- **H-A3. Lines 29 and 99** say "all eight tabs that read your data (...)" and "the eight tabs".
  Targets now uses the same alert region (`components/targets/Targets.tsx:6-10,87,105`). That makes
  the roster wrong, and it is a count. Restate it as the property, with examples given as
  examples. `tabOrderCoverage.test.ts` and `Calendar.test.tsx` read ACCESSIBILITY.md, so check
  them first.
- **H-A4. Line 29** "A chart drawn as a GRAPHIC ... carries an image role and a concise text
  summary". The Planner chart (`role="slider"`, `PlanChart.tsx:611-627`) and the Splits and Lumps
  chart (live name buttons, text equivalent after it, `speciesDetail/SplitsLumps.tsx:13-21`) do not
  follow that rule. Add the rule for charts that contain controls rather than a list of charts.
- **H-A5. Line 57** "colour", and line 19 "coloured". Use American spelling.

**ACCESSIBILITY.md: judgment calls**
- Focus Management (line 77) could name, as examples, the Alerts inbox sheet (focus trap, Close
  first, Escape, focus returned; `AlertsInboxSheet.tsx:13-40`) and the Targets "measure from"
  chooser (`TargetsAnchorChooser.tsx:9-12`).
- Line 31 names only the arrow keys for the Planner timeline. Page Up and Page Down, Home and End,
  and Escape also work.
