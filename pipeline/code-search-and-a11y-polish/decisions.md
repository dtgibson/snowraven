# Decisions: code-search-and-a11y-polish

## Stage 2, The Designer (draft, round 1, 2026-10-17)

Design system status: `pipeline/design-system.md` exists and this design is within it. No new pattern, no new type size, one new token in both themes (`--sr-milestone-3-link`, the brief's item 3). The container-query form below is the v1.0.23 pattern already in `.claude/rules/ui.md` and in the Calendar and Weather surfaces, not a deviation from the system. The deviations are from the BRIEF's assumed mechanism, and they are logged here.

### D1. The sighting row stacks by a container query on its own width in em, not only by the 640px viewport tier

The brief placed the phone rules inside the 640px block. Measured in the built app, the row's trouble is not a phone-width problem alone: at 641px and 200% text the place box is 77 to 95px, three or four characters, with the link fitting. A 22em threshold on the row's own width (`@container sr-nbs (max-width: 22em)`) stacks the row at 320px/200% (13.75em), 390px/100% (18.1em) and 641px/200% (13.2em) and leaves 641px/100% (30em) and 1024px/100% (44em) untouched, so "desktop at 100% is unchanged" holds. The threshold is derived from the row's fixed content (date about 5em, two separators 2.5em, link about 5.7em) plus 9em for the place. The phone tier still carries two rules of its own: baseline alignment and the 2.75rem link height. **Reversal:** if the user prefers the viewport-only form, drop the `@container` block, move its four declarations into the 640px tier, and accept the 641px/200% truncation.

Containment is argued both ways (ui.md, v1.0.23): the container is the padded row, nothing in its subtree is positioned or carries a z-index (the quote block, `HotspotLink`, `ChecklistLink`, an `.sr-only` cue at most), and it is never an ancestor of the card map, which carries the fullscreen panel. Same for `.sr-nb-media`: the media frames are `position: relative` with their own absolute children, so the section becoming a containing block changes nothing they resolve against.

### D2. Above 640px the stacked row keeps the truncating HotspotLink; on a phone it renders the full name

The full-name branch is a render branch (`truncate` is a prop that changes the markup), so it follows `useIsPhone()`, the sanctioned breakpoint render branch, and not the container query. The consequence: at 641px and 200% the place shows on the first line with an ellipsis and its `title`, and the full name is in Top locations below. Making the full name universal was rejected because a CSS imitation of today's truncation on the full-name markup truncates differently ("…Shoreline" kept) and would change desktop at 100% for long names. **Reversal:** if the user wants the full name there too, the row needs a ResizeObserver-driven state or a second `useIsPhone`-style hook at a wider query; a decision for the Engineer only on the user's say.

### D3. The gallery's column count follows the media section's width in em, through a NAMED container, so Species Detail's Recent Media is untouched by default

`.sr-media-grid` is shared with Species Detail. The query is `@container sr-nb-media (...)`, so it fires only under a section that declares that name; Species Detail keeps three columns above 640px exactly as today. Species Detail's Recent Media has the same `nowrap` "Macaulay Library" link in the same three-up grid, so it almost certainly overflows the same way at 641px/200%; the Engineer measures it, and opting it in is one class on its section (plus the same meta-row treatment of `RecentMediaEmbed.tsx`), a separate decision because that card may sit in a narrower column at 100% where 31em would give two columns on a desktop. Visible changes at non-100% text above 640px are accepted: 641px/125% and 150% go from three to two columns, 1024px/200% from three to two.

### D4. A fourth clip in the same card, found by measurement: the collapsed header's date-range line

Not in the brief. At 320px and 200% the "Mar 2, 2025 – Feb 10, 2026" line (nowrap, end-aligned) runs 28px past the card's LEFT edge in both engines, clipping the first date; fine at 320px/150% and 390px/200%. The brief's "What done looks like" (no text outside the card at 320px/200%) would fail on it, so the design includes the smallest fix: the line keeps `nowrap` on desktop through a class and the phone tier lets it break at a space, right-aligned. The NamedBirdRow comment that keeps the nowrap ("the two dates never break") stays true above 640px. **Reversal:** drop the phone-tier rule and record the clip as a known residual.

### D5. Tile meta separators ride with the item BEFORE them

Pairing a separator with the item after it (the sync line's shape) would move the middle dot from the end of line 1 to the start of line 2 at 1024px/100%, a visible desktop change. Trailing pairs reproduce today's desktop wrap byte for byte and never leave a separator alone on a line.

### D6. Checklist link height in the stacked state: 2.75rem on a phone, 2rem above

The item-list boxes in the same card are 2.75rem on a phone (ml-media-links, D3), so the row's one control takes the same posture rather than a third number. Above 640px a pointer user gets 2rem. A padding-plus-negative-margin hit box was rejected because it would overlap the place link's line box on the line above.

## Stage 3, The Engineer (2026-10-18)

### E1. The gallery's two-column threshold is 30em, not the mockup's 31em

Re-measured against the real container in the built app (CLAUDE.md, v1.0.50): at 641px and 100% text the media section is 31.44em with overlay scrollbars, which is what the mockup and the headless browsers see, and **30.5em with a 15px classic scrollbar** (Windows and WebView2, or a Mac set to always show scroll bars). At 31em that window dropped to two columns, which breaks "desktop at 100% is unchanged". At 30em it keeps three, and every outcome the design names still holds: 641px at 125%, 150% and 200%, 1024px at 200%, phones. The one other configuration that moves is a section between 30em and 31em, which keeps three columns instead of two; a three-column tile at the 30em edge is still wider than "Macaulay Library" at every text scale, and the meta row now wraps anyway. **Reversal:** set the query back to 31em in `globals.css` (section C) and the harness's printed label; nothing else depends on the value.

### E2. Item 1 lives in a new component, so MapExplorer.tsx still wires no code search

`components/map/TargetSpeciesList.tsx` holds the search box and its list and makes the same `rankSpeciesMatches(rows, q, alphaCodeHits(...), matchesSpeciesQuery)` call as `SpeciesCombobox`, with `loadAlphaCodes()` on focus. MapExplorer hands it `speciesOptions`, the array the My Sightings picker gets, so the per-array code index is shared. `lib/alphaCodeWiring.test.ts` keeps its MapExplorer call-site row unchanged, drops MapExplorer from OUT_OF_SCOPE, and adds the new file as a third consumer to every consumer row. Two deliberate behavior changes come with the shared matcher and are what the brief asked for: the query is trimmed (as in every picker) and a scientific name matches.

### E3. A comment-only edit outside the brief's unchanged list

`lib/alphaCodesAsset.ts` said "Exactly two lines do" start the code load; with the Media Targets box there are three, so the sentence was false. Its comment now names all three, the twin of the `useAlphaCodes.ts` comment the brief listed. No code line in `lib/alphaCodes*.ts` changed. `lib/speciesMatch.ts` is untouched: its "both consumers call both" counts Search and the picker, which is incomplete now but not false.

### E4. The tile meta row's checklist pair renders only when the asset has a checklist id

The old row always rendered `ChecklistLink`, which renders an empty span for an empty id; the pair version renders the checklist pair only for a non-empty id. The dots appear under exactly the old conditions (after the date when a Macaulay Library link or a checklist follows, after Macaulay Library when a checklist follows). The only DOM difference is that an asset with no checklist id loses an empty trailing span.

### E5. The fix reaches Species Detail's Named Individuals cards too, measured

They render the same `NamedBirdRow` (no map, no media). Measured with a scratch probe in both engines across 320 to 1280px and four text scales: before, the card's checklist link ran up to 147.5px past the card at 320px / 200% with every place squeezed to 0px; after, nothing is outside the card and every place shows at least 72.3px of ink. Species Detail's Recent Media was measured as D3 asked and left opted out: "Macaulay Library" runs 52.2px past its tile at 641px / 200% and 25.9px at 720px / 200%, identical in both builds. Opting it in is one class on its section plus the same meta-row treatment in `RecentMediaEmbed.tsx`, the separate decision D3 describes.

## Q1. Record corrections from the Tester (2026-10-18)
The Tester re-counted the pre-fix harness run at 425 failing checks, not 426 (the 426th `FAIL` line is the harness's summary), and measured the section at 1024px / 150% with a classic scrollbar at 25.29em, so it is not an example of the 30em to 31em band. Both records are corrected; E1's conclusion is unchanged.

## Stage 6, The Deployer: preparation and deployment plan (2026-10-18)

### P1. Reconciliation at preparation (read only)
- `origin/main` is `6e8570a1`; nothing has landed since. Local `main` is three commits ahead (`ff895d17`, `393f6830`, `296a65e9`), all this build's own (`296a65e9` also carries this run's `pipeline/` records). No other worktree exists (`git worktree list` shows only the main checkout), and no other branch is on `origin`.
- Tags and releases: newest tag `v1.0.55`; newest GitHub release `v1.0.55` (Latest, 2026-10-11). No `v1.0.56` tag or release exists.
- CI: `Pipeline` and `Deploy website to GitHub Pages` are green on `6e8570a1` (2026-10-18). Nothing is running.
- App Store Connect (metadata key, GET only): every version record is `READY_FOR_SALE`, newest first 1.0.55 `e4affc7f` (build 1.0.55.1), 1.0.53 `ecbac251`, 1.0.51 `c98d6dc5`, 1.0.50 `99e3f9ff`, 1.0.47 `0d823282`, 1.0.45 `73b6e8ac`, 1.0.40 `203ea1fd`, 1.0.38 `63dc73df`. Nothing is in review. TestFlight's newest build is 1.0.55.1 (`e5187c8d`, VALID), and no 1.0.56 pre-release train exists, so no other session has a 1.0.56 in flight.
- F-Droid (public reads): f-droid.org publishes 1.0.55 (10000551, 10000552, 10000554) and 1.0.53; fdroiddata `master` names 1.0.55 at `1cad7995`. This build changes no `toolchain.env` pin and no recipe build step, so nothing goes to fdroiddata; the bot picks up `v1.0.56` on its own.

### P2. Version bump prepared, uncommitted
`frontend/package.json`, `frontend/package-lock.json` (its two version fields, as at 1.0.55), `src-tauri/tauri.conf.json` (`version` 1.0.56, `bundle.android.versionCode` 1000056), `CHANGELOG.md` (the 1.0.56 entry), `website/index.html` (the version pill's text and `aria-label`, and the footer line; nothing else), and the in-repo recipe `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` (`CurrentVersion` 1.0.56, `CurrentVersionCode` 10000564, the three `Builds` entries at 1.0.56 with codes 10000561, 10000562 and 10000564). Each entry's `commit:` still names the 1.0.55 tag's full hash as the placeholder, as at 1.0.54 and 1.0.55: a commit cannot carry its own hash, so a follow-up `fix(fdroid): the recipe names v1.0.56's commit` writes `git rev-parse v1.0.56^{commit}` after the tag is pushed.

`npm run typecheck` exit 0. Full vitest: 469 files passed, 1 failed, 5 skipped; 10,215 tests passed, 2 failed, 6 skipped. The only red is `fastlaneMetadata.test.ts` (two tests, both reporting `changelogs/10000561.txt`, `10000562.txt` and `10000564.txt` missing), which is the held F-Droid copy, as expected. The version-pill guard, `fdroidRecipe.test.ts` and `androidVersionSource.test.ts` are green. `npm run build` was not run, because a live preview serves `frontend/dist`.

### P3. Held published copy
`whats-new.md` in this folder: (a) the 1.0.56 What's New for its own record, (b) the rollup text, which is unusable because 1.0.55 is released, and (c) the three F-Droid changelog files' text, 456 characters. Nothing is written to App Store Connect or `fastlane/` until the user's yes. No screenshot in `appstore/screenshots/` or `website/assets/shots/` shows a changed surface (details in `whats-new.md`).

### P4. Deployment plan (runs only after the production sign-off)
Leg order is the release skill's. Each step is run by the Deployer or the Orchestrator, never handed to the user, except the device checks, which are the user's.
1. **Copy and commit.** On a yes to (c), write the three changelog files (text plus one newline). Re-run the full vitest suite (all green expected), `npm run typecheck` and `eslint .`. Commit the bump as `chore(release): 1.0.56, ...` with the changelog files, then commit any remaining run records so the tree is clean for `release.sh`.
2. **Push `main`** (`git -c credential.helper='!gh auth git-credential' push origin main`). The Pages workflow redeploys the website with the new pill.
3. **Push the tag** `v1.0.56` at the bump commit. This starts Windows CI and Android CI, and it is the commit F-Droid builds.
4. **Recipe hash.** Commit `fix(fdroid): the recipe names v1.0.56's commit` with the tag's full hash in all three `Builds` entries, and push `main`.
5. **CI wait.** Wait for `windows-build.yml` and `android-build.yml` to go green on the tag's commit, queried pinned (`gh run list --workflow <wf> --commit <tag sha>`). If the iOS archive is built during this wait, its stamp push cancels the tag commit's `Pipeline` run; the stamp commit's run is then the run of record.
6. **macOS and Windows:** `CI=true zsh -lc ./release.sh` with the keychain unlocked (it reads `no-timeout` today). It builds into `frontend/dist`, so the preview backends on 1641 and 1642 will start serving the 1.0.56 build, which is the same code plus the version string. It also touches `src-tauri/src/main.rs`, so any `desktop:dev` watcher relaunches. After the release is published, download the DMG and check `codesign --verify`, `xcrun stapler validate` and `spctl -a -t open --context context:primary-signature`, and confirm `latest.json` names 1.0.56 for `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64`.
7. **Android APK:** run `scripts/android/preflight.sh`, then `sign.sh` with `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`. Install the exact signed bytes fresh on the local API 36 emulator (`-gpu host`, `adb -s emulator-5554`) and open them to the Welcome screen, with a screenshot. With synthetic demo data, also check one changed surface (`yrwa` in Media Targets' Target Species list with no ML export loaded, or a Named Birds card at phone width). Read the WebView version. Then run `attach.sh` with the device check the user chooses (`partial` if they keep the emulator-only basis of 1.0.53 to 1.0.55) and `ANDROID_CHECKED_SHA256` set to the file's SHA-256.
8. **iOS TestFlight:** move the stale `snowraven_iOS.xcarchive` aside first (it holds 1.0.54.1 today), then recreate the three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`), map the Tauri env names, and run outside the sandbox. Run the widget Swift tests, then `tauri ios build --export-method app-store-connect --build-number 1`; Tauri's own export is expected to fail. Confirm the fresh archive's `CFBundleVersion` is 1.0.56.1 and the `platform IOS` checks. Sign the archived widget extension with its entitlements, export with `~/.tauri/snowraven-ios-export-options.plist`, and check `DistributionSummary.plist` for both bundle IDs and their entitlements. Run `altool --validate-app`, then `--upload-app`, and commit the iOS stamp.
9. **The user's device check** of TestFlight build 1.0.56.1 on their own iPhone. They perform it and report the result, which is recorded with a time before the submission. Agents touch no device.
10. **App Store:** re-query the records first. Then create a new 1.0.56 record on build 1.0.56.1, set the copyright from `appstore/LISTING.md`, write What's New (a) byte for byte, and restore the promotional text if it arrives empty. Read every listing field back against `LISTING.md` and the review notes against `REVIEW_NOTES.md`. Verify that both screenshot sets carried over (all twelve checksums in order) and that the age-rating declaration is answered. Submit through `reviewSubmissions` with `AFTER_APPROVAL` and no phased release, then read everything back again after submitting.
11. **Records:** add the 1.0.56 App Store entry and the Android entry (APK SHA-256, the signer digest, the device-check basis, the F-Droid state read from fdroiddata `master` and the f-droid.org API, the WebView version) to CLAUDE.md's per-version lists in the same ship. Then The Chronicler runs, and only after every leg is done.

## S1. Production sign-off (2026-10-18)
At the production gate, after the live preview of the built app over the tailnet (ports 8757 with the ML export, 8758 without), the user picked **"Confirm: ship 1.0.56"** to "Ship 1.0.56 to every platform, with the release note as written?". That approves the held What's New text (a) and the F-Droid changelog text (c) in `whats-new.md` word for word, and authorizes every release leg: push `main`, push the `v1.0.56` tag, `./release.sh`, the Windows build from CI, the Android APK, and the iOS TestFlight build. The App Store record is created on its own (1.0.55 is `READY_FOR_SALE`, so there is no rollup or deferral) and submitted only after the user's own check of TestFlight build 1.0.56.1 on their iPhone. To "How should the Android build be checked this time?" the user picked **"Emulator only, as before"**: the exact attached APK is opened on the local emulator and the device check is recorded as Partial, as at 1.0.53 to 1.0.55.
