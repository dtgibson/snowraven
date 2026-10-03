# Decisions — Targets hotspot link

## 2026-10-02 — Icon follows the last word of a wrapping hotspot name, in the shared link

**Found at:** the user's live look at the built app (tailnet preview), during The Engineer's stage.

**What:** on a hotspot name that wraps, `HotspotLink` drew the name and the open-on-eBird icon as two side-by-side flex boxes (`display: inline-flex`). A wrapping name's box stretches to the full width of its container, so the icon sat at the far right edge rather than after the last word. The approved mockup had the same structure.

**User's decision:** "It would look much better and flow more logically if the link button was right next to the link." Asked to choose between fixing only the Targets link and fixing the shared component, they chose **the shared link**.

**Scope change:** `HotspotLink.tsx` changes in its full-name branch only (not `truncate`, not `compact`). Every surface that shows a full hotspot name gets the icon after the last word when the name wraps. The Designer's caller sweep found four: the Targets cell, Birding Statistics (`BirdingStats.tsx:860`), Named Birds (`NamedBirdLocations.tsx:65`) and Species detail (`SpeciesDetail.tsx:1710`). Every other call site (Map Explorer and county popups, the Weather backlog, the rest of Species detail, Named Bird rows) uses `truncate` or icon-only `compact` and is unchanged. (The Guide's first estimate to the user, "eight other spots", counted call sites before checking which use `truncate`/`compact`; corrected here.) One-line names, truncated names (whose two-box layout keeps the icon visible after the ellipsis) and icon-only links are unchanged. The Tester verifies those other surfaces as well as Targets.

**Routing:** a design amendment (Case 2: a scoped Designer errand on `design-refinement.md` and `design.html`, then a scoped Engineer errand), not a full stage re-run. The direction (green link, wrap, personal places unchanged) stands.

## 2026-10-02 — The glyph hangs into the Targets cell's padding

**Found at:** The Tester's browser sweep (QA report). The Guide had told the user the glyph lands on a line by itself only at 320px with 200% text; that was wrong. At normal text size, in windows 680 to 1040px wide (iPad portrait included), 17 of 119 rows put the glyph alone under a last word that fills its line (e.g. "Lake Elizabeth"). At 200% text it happens at every desktop width.

**User's decision:** asked to choose between leaving it and letting the glyph hang into the cell's spare padding, they chose **hang it into the margin**.

**Scope:** the Targets Last report cell only (it has 12px of horizontal padding on each side, enough for the 3px gap plus 10px glyph). The shared `HotspotLink` structure from the first amendment stands; the hang is a Targets-cell style rule. Other tabs are unchanged.

**Also corrected (QA):** the phone tap area measures 24 to 25px at normal text, not "about 28px"; the comments at `HotspotLink.tsx` ("never drops onto a line by itself") and `globals.css` ("about 28px"), and the edge-case wording in `pr-description.md` and `how-to-see.md`, are to be made true.

## 2026-10-02 — Security review notes (Auditor, passed with notes)

**F1, the name split's cost (declared here, per `.claude/rules/security.md`):** `HotspotLink`'s full-name branch splits the visible name with one `lastIndexOf(' ')` and two `slice` calls per render: linear in the name, no loop; the delimiter-absent case is a single full scan. Measured by the Auditor under 1 ms at 800,000 characters in four shapes. On Targets the name is also capped at 512 code units by `DAY_OBS_MAX_STRING`.

**F2, the v1.0.28 row-owned dispatch rule, accepted for this build:** the Targets table can be re-sorted, and its new hotspot links open on desktop and iOS through the opener plugin's global click listener, as every other `HotspotLink` and `ChecklistLink` in the app does. The listener takes the clicked anchor from the event's own `composedPath()` and reads that anchor's rendered `href`, which comes from the row's own validated id, so whatever opens is a validated `ebird.org/hotspot/L<digits>` page; there is no security impact. Moving shared links to row-owned dispatch (`onClick` calling `openExternalLink`) is a shared-component change outside this build's scope, left as an idea, and the Chronicler clarifies the two CLAUDE.md instructions that pull in different directions here. Reversal condition: any observed case of a shared link in a sorted or paged list opening a different row's page.

**F3 and F4 (pre-existing, code this build did not touch):** saved as ideas: a hotspot lookup that runs out of 429 retries keeps that state out of the session's hotspot list until a restart or a key or file save; and the self-hosted backend sets no browser security headers (`tauri.conf.json` also sets `"csp": null`).

**Screenshots:** this run's renders stay on disk and out of git (`pipeline/.gitignore`), because one shows the user's own checklist comment and the repository is public.

## 2026-10-02 — Deployment record, 1.0.47 (The Deployer)

**Reconcile:** `weft-worktree reconcile` merged `origin/main` (476f11c, 1.0.46 and the help-docs-refresh Help rewrite) with no conflicts (`81b67ff`). The Targets clause sits in the rewritten Help's "Live" bullet. Merged tree: frontend suite 431 files passed, 5 skipped (9,218 tests passed, 7 skipped, 0 failed); typecheck, lint and build exit 0; no backend change came in. Widget extension Swift tests on an iOS 27.0 iPhone 17 simulator: 143 passed.

**Version:** 1.0.47, the four-file set plus the frontend lockfile's own version lines, as at 1.0.46 (`74985ee`, tag `v1.0.47`). Parity guards (`icloudKeysPublishedClaims.test.ts`, `iosSceneManifest.test.ts`) green.

**Desktop:** Windows CI run `37085725581` succeeded on the tag commit (`headSha` 74985ee). `release.sh` (headless, from this worktree, no knobs) built the universal app, verified bundle version 1.0.47 and the iCloud entitlements and profile, signed and notarized the DMG (submission `e73b96d6`, Accepted, stapled), signed the CI Windows installer, and published https://github.com/dtgibson/snowraven/releases/tag/v1.0.47. The downloaded DMG passes `codesign --verify`, `stapler validate` and `spctl` (accepted, Notarized Developer ID). `latest.json` reports 1.0.47 with `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64`, and all three URLs answer 200.

**iOS:** archive stamped 1.0.47 (CFBundleVersion 1.0.47.1) from a cold `src-tauri/target` with all three `/tmp/xcshim` shims; executable `platform IOS` (minos 16.0), all 9 swift-rs libraries `platform 2`. Tauri's own export refused with "No Account for Team" / "No profiles", as expected. The unsigned archived `snowraven_widgets.appex` was ad-hoc signed with its entitlements (App Group confirmed), then exported manually with `~/.tauri/snowraven-ios-export-options.plist`; `DistributionSummary.plist` lists the app on "SnowRaven iOS App Store iCloud AppGroup 20260924" with the App Group and iCloud keys, and the appex on "SnowRaven Widgets App Store" with the App Group only. `altool --validate-app`: VERIFY SUCCEEDED; `--upload-app`: UPLOAD SUCCEEDED, delivery `cef645a5-bf76-4598-adae-e3a3706b452b`; build 1.0.47.1 `VALID` in App Store Connect. Stamp committed as `bf961b9`; the incidental `project.pbxproj` requoting was restored, not committed.

**App Store:** no version record was created, edited, withdrawn or submitted (out of scope for this stage by instruction). At the ship, record `0d823282` (1.0.46, build 1.0.46.1) is `WAITING_FOR_REVIEW` as submission `c3fbb8c7`; 1.0.45 (`73b6e8ac`) and 1.0.40 (`203ea1fd`) are READY_FOR_SALE. 1.0.47's disposition (own record later, deferral, or rollup into 1.0.46's record) is the user's decision and must be written into CLAUDE.md's release list whichever way it goes. No App Store screenshot shows the Targets tab, and the Statistics and Species Detail shots show only one-line hotspot names, which this build leaves unchanged.

**Website:** Pages run `37085722004` succeeded; the live site shows v1.0.47 in the pill (text and `aria-label`) and the footer.

**CI:** the tag commit's Pipeline run (`37085722045`) was cancelled by the iOS stamp push, as expected; the run of record is `37086367863` on the stamp commit `bf961b9`. Its first attempt failed one row of the real-engine gate's `verify-plan-readout.mjs`: "webkit no tide @2x", a 1.00px movement at 320px, one cell of the 660-cell sweep, on the Weather tab's Plan readout, which this build does not touch (no `HotspotLink`, no shared CSS; this build's CSS is `.sr-tg-*` only). The same harness run locally against the published 1.0.47 `frontend/dist` passed in both engines at 0.00px worst movement, and a re-run of the failed job (attempt 2) passed, Frontend and Backend green. Recorded as a CI flake in a harness the 1.0.46 Spool bundle changed the same day (`8cbbb62`, planner-check-ci-race); if it recurs, it belongs to that harness, not to this build.
