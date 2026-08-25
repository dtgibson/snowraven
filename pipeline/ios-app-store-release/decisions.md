# Decisions — ios-app-store-release

## 2026-08-25 — The debut ships as 1.0.0 (user decision at the design review)

The user approved the design direction and directed one change: the first
App Store release bumps the version to **1.0.0**, then the regular
incremental rhythm resumes afterward.

- Supersedes the strategic brief's original "no artificial 1.0" key decision
  and the PRD's original FR-04 wording; both artifacts amended in place, along
  with the design spec and mockup (Case 1 cascade update).
- The single-version lockstep is unchanged: 1.0.0 lands on
  `frontend/package.json` and `tauri.conf.json` together and ships to every
  platform at once (desktop, web, TestFlight, App Store), build 1.
- "Back to regular incremental numbers" is implemented as the standing rhythm
  continuing **upward from 1.0.0** (1.0.1, 1.0.2, …; patch by default).
  Returning to 0.5.x is not possible: App Store Connect requires each
  submitted version to increase, and the desktop updater's latest.json
  comparison would strand 1.0.0 installs behind any lower-numbered release.

## 2026-08-25 — Stage 5 (Engineer) build decisions

### The iOS policy additions ship in Phase A (Designer's flag adopted)

The schema sequenced the PRIVACY_POLICY.md iOS additions in Phase B; the
design review flagged that Apple's reviewer reads the privacy page during
review and the additions describe behavior already true on TestFlight. The
flag is adopted: the Overview platform sentence, the iOS sandbox storage
clause, the iOS location-permission paragraph, the new "iOS App" section, and
the App Store update-path paragraph all ship now, in both PRIVACY_POLICY.md
and website/privacy.html, with the effective date advanced to August 25, 2026
(the policy's own Changes rule). None of these claim App Store availability;
they describe the app that exists. Phase B shrinks to availability prose only
(see phase-b-availability.md).

### privacyPageParity.test.ts is a test-only frontend addition (QA-19 exception)

`frontend/src/lib/privacyPageParity.test.ts` is the schema-recommended drift
guard between PRIVACY_POLICY.md and website/privacy.html (helpToc.test.ts
precedent: every hand-maintained mirror of a single-source document has
drifted before). It is test-only, never bundled, and is the ONLY file this
feature adds under `frontend/src/`. The standing Tailwind-source obligation
was discharged by measurement, not inspection: the shipped CSS bundle
(`frontend/dist/assets/index-DvAtzojH.css`) is byte-identical before and
after the change, sha256 `9ed4e573d0694b90c05eb7371c5d2939e64a91e339f82b1bd112713726758089`,
55,005 bytes, with a determinism control (two HEAD builds produced the
identical hash before the file existed, and the post-change build reproduced
it). No comment in the test mints a Tailwind rule.

### Zero unforced app-code change confirmed (NFR-04, QA-19)

The diff under `frontend/src/` is exactly the one test file above;
`src-tauri/` changes only `tauri.conf.json`'s version (the FR-04 lockstep
bump). `platformGates.test.ts` and `UpdateFooter.test.tsx` are green in the
full suite; both Info.plists keep `ITSAppUsesNonExemptEncryption` false
(verified by grep). The FR-21 sweep found one iOS-reachable prose surface
instructing desktop-only actions as the reader's own: none — HELP.md's
desktop/web update instructions describe other platforms, and the new iOS
sentence gives iOS readers their own path (FR-20's sanctioned shape). The
in-app "Check For Updates" control itself never renders on iOS
(showUpdaterFooter), re-verified against App.tsx's one call path.

### Screenshot content decisions (each a deliberate deviation or judgment)

1. **Shot 1 is the offline My Sightings view with the Jamaica Bay popup, not
   a live Hotspots search.** The design sketch drew hotspot teardrops; a live
   hotspot search would put real, non-demo-dataset hotspot names into the
   iPad frame (the sidebar's "Hotspots in view" and "Nearest unvisited" lists
   render names at 1032px), failing QA-05's every-visible-name-is-demo-data
   rule, and would depend on live eBird at capture time. The popup is opened
   through the keyboard-accessible "Sightings in view" list, the same popup a
   pin tap shows. Every visible place and species name in every shot is from
   the generated demo dataset, with one documented exception in shot 3 (next).
2. **Shot 3 (Weather & Tide) uses the documented public-checklist mechanism
   and, on this rig, the app's own replay path.** The capture rig's
   `backend/.env` deliberately carries a fake OpenWeather key
   (`demoonly...`), so a live weather call cannot succeed here. The committed
   shots were produced with `WEATHER_REPLAY=1`: the app renders its stored
   last-loaded result for the same public checklist (a genuine past success),
   through its real offline-replay code path; the framed output is identical
   to a live success, and the offline cue sits above the framed region (a
   framing choice, not a DOM edit). Re-capture fully live at any time by
   putting a real OpenWeather key in `backend/.env` and omitting the env
   flag. The checklist's location line ("Jamaica Bay Wildlife Refuge--East
   Pond, south end", a public eBird hotspot) is the one on-screen name not in
   the demo dataset: it is the same public-coastal-checklist mechanism the
   website's capture has always used (`CHECKLIST` env), contains no personal
   data, and is accepted as the QA-05 exception with this record as the log.
3. **The web-only "Check For Updates" footer affordance is removed before
   every shot.** The iOS build renders the footer without it (UpdateFooter
   returns null on iOS, platformGates FR-14), so the capture reproduces the
   exact footer the depicted product shows. Leaving it in would both
   misrepresent the iOS app and advertise a self-update affordance in App
   Store screenshots, the precise thing FR-19 exists to keep out of the iOS
   build. Nothing is added to any frame.
4. **The Statistics shot stubs the escapee-provenance checklist lookups at
   the Playwright layer.** The demo dataset's checklist IDs are synthetic;
   letting the pass run live would fire hundreds of junk requests at the real
   eBird API per capture run (observed before the stub: a pass planning 15
   cover checklists plus 100+ follow-ups), violating the repo's standing
   eBird-manners posture. The stub answers each lookup with that demo
   checklist's own species, exotic category empty, so the pass completes to
   the same end state a real user with this data would see ("Exotic status
   checked across 15 checklists. None of your species are eBird escapees.",
   true of the demo species set), with zero requests leaving the machine. The
   stub also keeps the pass's cache out of the demo store so reruns render
   identically.
5. **The Calendar shots use the previous complete year (2025) in the "Large"
   year-overview view**, which is the app's twelve-months-at-a-glance surface
   (the current year is part-empty in the demo data and photographs badly).
6. **Apple's accepted sizes were re-verified 2026-08-25** (schema
   instruction): the 6.9-inch iPhone class accepts 1320x2868 (also 1290x2796,
   1260x2736) and the 13-inch iPad class accepts 2064x2752 (also 2048x2732);
   one size per family is required and Apple scales smaller devices. The
   committed sets are 1320x2868 and 2064x2752, dimension-verified by the
   capture script itself.

### Category confirmed: Reference primary, Weather secondary

The PRD default stands, unchallenged at the design gate; the reasoning is
recorded in appstore/LISTING.md (the app is a reference companion over the
user's own records; the founding feature is the weather and tide lookup).

### FR-03 name availability is an App Store Connect action, pending

"SnowRaven" cannot be verified from the repository. The record and listing
assume the bare name; the account holder verifies availability in ASC as the
first metadata action and, only if forced, uses "SnowRaven Birding Tools" and
logs it here.
