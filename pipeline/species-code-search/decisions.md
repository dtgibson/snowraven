# Decisions - Species Code Search

## Stage 8 - The Deployer, preparation (2026-10-10)

Preparation only, while the user is away. Nothing was pushed, tagged, released, uploaded, or written to App Store Connect, the F-Droid merge request or `fastlane/`. Every step from entry 20 on waits for the production sign-off.

15. **Reconciliation.** This build's work is committed as `a4edb9bc` (`feat(search): four-letter codes in Search and the species pickers`), and `origin/main` at `c664a29d` (1.0.54, ml-media-links, closed out) is merged in as `deff680c`, with no conflicts. Two files auto-merged and were read. `.claude/rules/security.md` keeps both builds' `paths` entries: ml-media-links' `NamedBirdMedia*.tsx` and `lib/mediaEmbed*.ts`, and this build's `speciesMatch.ts`, `paletteRows.ts` and `lib/alphaCodes*.ts`. `docs/HELP.md` took only ml-media-links' Named Birds paragraph, and this build's Search and picker passages are unchanged. The merge moved no backend file, so the backend suite was not owed (2,061 passed at Stage 6 on the same backend). The branch is 2 commits ahead of `origin/main` and 0 behind.

16. **Re-verification on the combined tree**, before the bump. Load average was 10 to 17 at the start and 373 by the end of the suite, from other sessions.

    | Check | Result |
    |---|---|
    | `npm run typecheck` | exit 0 |
    | `npm run lint` | exit 0 |
    | `npm run build` | exit 0 (the standing large-chunk warning). `ebird-alpha-codes-*.js` is its own chunk, 588.92 kB raw, 143.28 kB gzip; `useAlphaCodes-*.js` 1.81 kB |
    | `npx vitest run` (full) | 468 files passed, 5 skipped (473); 10,178 tests passed, 7 skipped (10,185); exit 0; 101 s |
    | `entryChunk.test.ts` on that build, verbose | 106 of 106, including the post-build "emits the alpha-code asset as its own lazy chunk" row and both off-the-entry-graph rows |
    | Release guards: `entryChunk`, `alphaCodesAsset`, `fastlaneMetadata`, `fdroidRecipe`, `androidVersionSource`, `icloudKeysPublishedClaims`, `palettePublishedClaims` | 262 of 262 |

    After the bump (entry 18): `androidVersionSource`, `fdroidRecipe`, `icloudKeysPublishedClaims` and `iosSceneManifest` pass. `fastlaneMetadata` fails its two changelog rows, which name exactly `10000551.txt`, `10000552.txt` and `10000554.txt` as missing: those files are the held text (entry 19). `npm run build` is green with the bump.

17. **Parallel ships and store state** (read only, 2026-10-10).
    - Tags end at `v1.0.54`. The latest GitHub release is `v1.0.54` (2026-10-09), with the DMG, the Windows installer, both signatures, `latest.json`, the updater bundle and the signed Android APK. Nothing names 1.0.55 anywhere.
    - GitHub Actions: nothing running. The newest runs are the Pipeline on `c664a29d` and `313e9790` (success), and the v1.0.54 Windows and Android builds on `50984f65` (success).
    - Worktrees: the main folder is at `c664a29d` (equal to `origin/main`). `.claude/worktrees/android-release` (locked) is at `b682bc4c`, with nothing beyond `origin/main`, but its Claude session (pid 5334, started 2026-10-06) is still running. Neither was touched.
    - **App Store Connect** (metadata key, GET requests only): 24 version records. 1.0.54's record `e4affc7f` is `WAITING_FOR_REVIEW` on build 1.0.54.1 (submission `5f4aabb3`, submitted 2026-10-10 04:33 UTC, `AFTER_APPROVAL`). 1.0.53, 1.0.51, 1.0.50, 1.0.47, 1.0.45, 1.0.40 and 1.0.38 are `READY_FOR_SALE`. Builds through 1.0.54.1 are VALID, and there is no 1.0.55 build. 1.0.54's What's New reads back byte-identical to `pipeline/ml-media-links/whats-new.md`, text (a). Read against CLAUDE.md's list, there is no unaccounted gap between 1.0.13 and 1.0.54.
    - **F-Droid:** MR 51451 is open, labeled `New App` and `review-requested`, head pipeline success, last updated 2026-10-09 14:32 UTC. The fork branch's recipe still names **1.0.53** (`c4c15a96...`): at 1.0.54's sign-off the request was left to the android-release session, and 1.0.54 never reached it. `f-droid.org/packages/com.dtgibson.snowraven/` is 404. The GitLab token at `~/.tauri/gitlab-fdroid.token` expires about 2026-10-13.
    - The login keychain is unlocked (`no-timeout`), and `gh` is authenticated.

18. **Version 1.0.55: the six-file bump is applied and UNCOMMITTED.** Android `versionCode` 1000055; F-Droid codes 10000551 (armeabi-v7a), 10000552 (arm64-v8a) and 10000554 (x86_64, the `CurrentVersionCode`). Applied in the working tree:
    - `frontend/package.json`, and both version fields in `frontend/package-lock.json`.
    - `src-tauri/tauri.conf.json`: `version`, and `bundle.android.versionCode` (on one line).
    - The `CHANGELOG.md` 1.0.55 entry, dated 2026-10-10 (move the date to the commit date if the commit lands later).
    - `website/index.html`: only the version pill text, its `aria-label`, and the footer line.
    - The F-Droid recipe: the three `versionName`/`versionCode` entries, `CurrentVersion` and `CurrentVersionCode`. Its three `commit:` lines keep v1.0.54's `50984f65...` until the tag exists, as at 1.0.54.

    **Not written:** the three Fastlane changelog files. They are published listing copy and wait for the user's yes. A copy of the applied diff is in the session scratchpad (`bump-1.0.55.patch`).

19. **The held published copy is in `whats-new.md`.** It holds (a) the App Store What's New for 1.0.55 alone, (b) the rollup text if 1.0.54 is withdrawn and rolled in (1.0.54's approved paragraph word for word, then (a)), and (c) the F-Droid changelog, which is (a) word for word. No website, README, privacy policy, listing description, review notes or screenshot change is proposed.

20. **Release sequence after the sign-off.** One action per beat, all from this worktree (`/Users/developer/devwork/snowraven-species-code-search`).
    0. **Re-check.** `git fetch origin`. The branch must still be 0 behind `origin/main` (if it moved, merge again and re-run the full suite). No `v1.0.55` tag, release, TestFlight build or ASC record from another session. Keychain unlocked; `gh auth status` green. `git log origin/main..HEAD` shows only this build's commit, the merge, and this release's own commits.
    1. **Records commit:** `docs(species-code-search): deployment plan, approved release copy and the production sign-off`, covering this section with the user's answers added and `whats-new.md` with its status set to APPROVED.
    2. **Release commit.** Write the approved (c) to `fastlane/metadata/android/en-US/changelogs/10000551.txt`, `10000552.txt` and `10000554.txt` (the text plus one newline each). Run `npm run build`, the full `npx vitest run`, and `fastlaneMetadata`, `fdroidRecipe`, `androidVersionSource` and `icloudKeysPublishedClaims` verbosely. Then commit the six-file set as `chore(release): 1.0.55, four-letter codes in Search and the species pickers`.
    3. **Push to `main`:** `git push origin weft/species-code-search:main`, a fast-forward. Use `git -c credential.helper='!gh auth git-credential' push ...` if the keychain helper fails. The Pages workflow redeploys the website for the version pill.
    4. **Tag `v1.0.55`** on the release commit and push the tag. This starts Windows CI and Android CI, and it is the commit F-Droid builds. Then set the recipe's three `commit:` lines to the full `git rev-parse v1.0.55^{commit}`, commit `fix(fdroid): the recipe names v1.0.55's commit`, and push.
    5. **Wait for both tag runs green, pinned to the tag:** `gh run list --workflow windows-build.yml --commit <tag sha>` and `gh run list --workflow android-build.yml --commit <tag sha>`, with headSha equal to the tag's commit. If the iOS stamp push cancels the tag commit's Pipeline run, verify the successor run and say so.
    6. **Desktop:** `CI=true zsh -lc ./release.sh`, backgrounded and monitored. Run one desktop release at a time, since `~/.snowraven-build` is shared. Then download the DMG from the release and check `codesign --verify`, `stapler validate` and `spctl -a -t open --context context:primary-signature` (accepted, Notarized Developer ID). Confirm that `latest.json` carries `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64` at 1.0.55.
    7. **Android**, in the release skill's build shell.
       - Preflight: `scripts/android/preflight.sh`, which downloads the tag-pinned artifact and prints `UNSIGNED_APK=`.
       - Sign: `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a scripts/android/sign.sh <unsigned>`. The printed digest must match.
       - Emulator evidence, as at 1.0.53 and 1.0.54: install those exact signed bytes fresh on the local API 36 emulator (`adb -s emulator-5554`, `-gpu host`). Screenshot the first usable screen, and, with synthetic demo data, a code query in Search with its bird leading. Save both under `pipeline/species-code-search/evidence/`. Read the image's WebView major version; 133 was the last measured, so re-measure if it is newer.
       - Attach: `ANDROID_DEVICE_CHECK=partial` (the user's decision, entry 21) `ANDROID_CHECKED_SHA256=<sha of those bytes> SNOWRAVEN_ANDROID_SIGNER_SHA256=<digest> scripts/android/attach.sh <signed.apk>`.
    8. **iOS TestFlight build 1.0.55.1**, run outside the Bash sandbox.
       - Move any existing `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` aside.
       - Recreate the three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`) and put `/tmp/xcshim` first on `PATH`. Export `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`, and map Tauri's three `APPLE_API_*` names from the login shell.
       - Run the widget Swift tests on an iOS 17+ simulator.
       - `npm run tauri -- ios build --export-method app-store-connect --build-number 1`. This worktree's iOS target is cold, so the swift shim is what makes it build. Tauri's own export refusing on cloud signing is expected.
       - Check the fresh archive's stamped versions, that `vtool` reports `platform IOS`, and that every swift-rs `lib*.a` reports `platform 2`.
       - Ad-hoc sign the archived `snowraven_widgets.appex` with its entitlements, then run `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`, and check `DistributionSummary.plist`.
       - `xcrun altool --validate-app`, then `--upload-app`, with `DEVELOPER_DIR` exported. Poll until the build is VALID.
       - Commit `chore(ios): stamp iOS 1.0.55 build 1` and push.
    9. **The user's own iPhone check** of TestFlight build 1.0.55.1: they install and open it, then type a code such as `yrwa` in Search. Anything they find ships as build 1.0.55.2.
    10. **The App Store record**, after that check.
        - Re-query the records. Take the route set out in `whats-new.md` (own record, defer, or roll 1.0.54 in); if 1.0.54 is still in review, the user chooses.
        - Write the What's New by script and read it back byte for byte.
        - Check the copyright and the promotional text against `appstore/LISTING.md` (the promotional text has arrived EMPTY on seven new records), and read back every listing field.
        - Confirm the review notes are byte-identical to `appstore/REVIEW_NOTES.md`, and both screenshot sets' twelve checksums match in order. Answer the age-rating declaration if the editable app info asks.
        - Submit `AFTER_APPROVAL`, with no phased release.
        - Write the 1.0.55 entry, and 1.0.54's disposition, into CLAUDE.md's reconciliation list in the same ship.
    11. **F-Droid MR 51451**, by the user's answer (entry 21), one of two ways:
        - This ship updates it, before the token lapses about 2026-10-13: replace the fork branch's three `Builds` entries with 1.0.55's (codes `10000551/2/4` and the tag's full hash), move `CurrentVersion` and `CurrentVersionCode`, make the branch file byte-identical to the repository's recipe, and reply asking a maintainer to trigger the pipeline.
        - It is left to the android-release session, and the Android record says so.
    12. **Records:** the gitignored deployment record with each leg's evidence, and the Android record line (the APK asset and signer digest, the F-Droid state in one of the five words, and the WebView major). Then The Chronicler, but only once every leg is finished.

21. **Questions for the production gate** (prepared here, not asked):
    1. Approve (a), (b) and (c) word for word, or edit them.
    2. The Android APK attaches on emulator evidence only (Partial), as at 1.0.53 and 1.0.54.
    3. Whether this ship updates MR 51451 to 1.0.55, or leaves it to the android-release session again. The request still carries 1.0.53, that session's process is still running, and the token expires about 2026-10-13.
    4. The App Store route. This one is asked only after the user's iPhone check (entry 20, step 10).

22. **Production sign-off (2026-10-11 06:21 UTC; 2026-10-10 23:21 local).** The Weft Destructive Action gate `deploy-signoff` (stage 8, opened with `--final`) asked: "This releases 1.0.55 to Mac, Windows and Android and uploads it to TestFlight, with the text above. It can't be undone. The App Store step waits for your iPhone check. Ship it?" The user answered **"Confirm — ship 1.0.55"**. That answer authorizes the push, the tag and the recipe-commit push, `release.sh`, the Android sign and attach, and the iOS build and TestFlight upload (entry 20, steps 3 to 8).
    - **Copy:** the user read and approved `whats-new.md` text (a) word for word above the question. Text (c), the F-Droid changelog, is the same sentence and is approved with it. The rollup text (b) is **not** approved: it belongs to the App Store step after the iPhone check and stays held.
    - **Defaults the user read and did not object to:** (1) the Android APK attaches on emulator evidence, recorded as Partial as at 1.0.53 and 1.0.54, because the user owns no Android device; (2) F-Droid merge request 51451 is left to the android-release session, as at 1.0.54, and this ship does not update it (entry 20, step 11, second branch). The Android record says so.
    - **Stops after TestFlight:** no App Store record is created, retargeted, withdrawn or submitted in this pass. That step waits for the user's own iPhone check of build 1.0.55.1, and the choice between deferring and rolling up is theirs.

## Stage 5 - The Engineer (2026-10-10)

7. **Kept codes are sorted by code point within each group, not kept in eBird's published order.** Engineer decision, a deviation from schema.md 4.2 and 5.2 ("in published order"). Banding codes still come first, then the codes formed from the shown name; only the order inside each group changed. Reason, measured: two fetches of eBird's taxonomy about an hour apart listed the same `comNameCodes` in a different order on 1,164 entries with identical content, so published order would rewrite the asset on every regeneration with nothing changed. Sorted, three fetches (two public, one keyed, each ordered differently) derive a byte-identical asset. The app reads codes as a set, so no match and no ranking moves. One spot check follows it: Common Wood-Pigeon reads `CWPI COWO COWP` (schema.md 15 wrote `CWPI COWP COWO`). Reversal: drop the two `.sort(byCodePoint)` calls in `entryAlphaCodes`; the "sorts each group" row in `alphaCodesGenerator.test.ts` then goes red, as it should.

8. **The linearity row's CPU-time bound is 2.5x per doubling on average (8k over 1k at most 15.6) and 3.2 for any single doubling, not 2.2 per doubling.** Engineer decision, a deviation from schema.md 10 / PRD QA-46 ("about 2.2x"). Measured on the dev Mac: the average ran 2.0 to 2.1 on a quiet machine and 2.23 under a load average of 229 from other sessions (one single doubling read 2.59), because the timed call allocates a Map of Sets whose collection cost the CPU clock still counts (`test/cpuTiming.ts` names that residual). 2.2 sat inside the measured spread, so the bound now sits between linear (8) and the defect: the quadratic-join mutation read 3.73 to 3.98 per doubling (57.6 over 1k to 8k). The work-done leg (one lookup per row, exactly 2x per doubling) is unchanged and is the machine-independent half.

9. **HELP's "Search makes no network request at all" is rewritten in the durable form.** Engineer decision, a HELP sentence outside the ones FR-28 names, in the same Search section. On web and Raspberry Pi installs the code data is a static chunk fetched from the user's own server on the first Search open (as the backup read already was), so the bare claim was false on two targets. It now reads that Search asks eBird and other outside services for nothing and stores nothing, and that everything it offers, the codes included, is already on the device or on the user's SnowRaven server. In-app help is written without a stop (CLAUDE.md); no published surface changed.

10. **Verify items (schema.md 17).**
    - **V-1:** every quoted string in the seven NFR-15 suites, the identity suite and `palettePublishedClaims.test.ts`, checked mechanically against the committed asset: the code-shaped strings are `crow`, `span` (SpeciesCombobox), `sora` (speciesIndex), `list` (CommandPalette) and `snow` (WeatherStatsSection); the only bird in the same file carrying one is Sora in `speciesIndex.test.ts`, which does no matching. No conflict; all seven suites and the identity suite pass unmodified.
    - **V-2:** `speciesComboboxOptionsIdentity.test.tsx` passes unmodified.
    - **V-3 (engine half):** first load and one join, timed in Playwright's WebKit and Chromium against the committed asset and the built chunk, median of 15: WebKit `JSON.parse` 2.0 ms, chunk evaluation 3.0 ms, join of 2,000 names 1.0 ms (WebKit's timer is 1 ms coarse); Chromium 2.1, 2.3 and 0.6 ms; Node 24 3.5, 3.7 and 0.56 ms. **The real-backup half is deferred to the live preview** (the Guide brings up the dev desktop app; this stage launched no app and read no backup).
    - **V-4:** Vite 8 emits one `ebird-alpha-codes-*.js` chunk of 588.92 kB raw, 143.28 kB gzip, as top-level scalars plus `JSON.parse` of a template literal (no escaped quotes, so no size penalty over the JSON). It is in no modulepreload; the only reference to it is the loader's dynamic `import()` with an empty dependency list. The matcher and the three code modules share one 1.8 kB chunk (`useAlphaCodes-*.js`) reached only from lazy chunks. The entry chunk's code is unchanged: against a HEAD build its only difference is the hashed names of lazy chunks in Vite's preload table (+1 byte), and the CSS bundle is byte-identical (same hash).
    - **V-6:** the generator run reproduces schema.md 2.2 and 2.7 exactly: 15,471 of 17,891 entries with a code, every one of the 11,167 species included; 8,951 distinct codes (OU, four three-letter, 8,946 four-letter); RECR the most shared at 30; 13 accented codes; 13,625 kept codes formed by the strict rule; 2,433 species codes dropped, 366 on species with banding codes; 82 of 1,035 slashes and 19 of 792 hybrids keep a code. Raw 588,825 bytes; gzip 142,393 at zlib's default level, 70% of the budget.
    - **Asset generation:** `codes-only` mode on 2026-10-10 (eBird's live taxonomy still equals snapshot 2027); only `frontend/src/assets/ebird-alpha-codes.json` was written, and both snapshot twins, `ebird-countability.json` and `ebird-taxonomy-history.json` are byte-identical (git shows them unmodified).

## Stage 7 - The Auditor, and the Orchestrator's follow-ups (2026-10-10)

11. **The generator regex's combining-mark range is written as escapes.** Auditor fix, Low, resolved: `scripts/lib/ebirdTaxonomyDerive.mjs` line 140 carried the U+0300 to U+036F range as literal invisible characters; it now reads `/[\u0300-\u036f]/g`, the same 112 code points, with identical output over all 17,891 published names (security-report.md).

12. **The Calendar species filter's network sentence in HELP is written in the durable form.** Orchestrator, from the Auditor's informational finding. "The selection lasts for the session and makes no network calls" became "...and asks eBird and other outside services for nothing", because on web and Raspberry Pi installs opening the picker can now fetch the code chunk from the user's own SnowRaven server (decision 9 made the same change for Search). In-app help is written without a stop.

13. **How the eBird key reached the generator.** The key was read from the desktop app's own store (`~/Library/Application Support/com.snowraven/data/api-keys.json`, slot `ebird`) into the generator process's environment only, at the Orchestrator's direction. It was never printed, never written to `backend/.env` or any other file, and no other checkout's `.env` was read. The asset holds names and codes only.

14. **V-3, real-backup half, measured on the built app against the user's real backup.** Orchestrator, at the live preview (2026-10-10). The dev desktop app was not launched, because the user reviews over SSH and a native window is invisible to them, so the measurement ran the production build served by the backend (a scratch copy of the self-host data, "MyEBirdData 2026-07-11.csv") in headless WebKit, the shipped apps' engine, and in Chromium, three fresh browsers each, at load averages of 79 to 158 from other sessions. Keystroke to the code bird leading Search's species rows, first open of the session (so the chunk fetch, `JSON.parse` and the join over the real backup are all inside it): WebKit `yrwa` 9, 14 and 16 ms; Chromium 7, 16 and one 213 ms outlier under load. Later queries in the same session: 4 to 21 ms. The code chunk (589,221 bytes over loopback) fetched in 4 to 10 ms. `yrwa` listed Yellow-rumped Warbler then Yellow-rumped Warbler (Audubon's); `amro` American Robin; `gbhe` Great Blue Heron alone. With the Engineer's engine figures (decision 10), V-3 is closed.

## Stage 4 - The Designer (2026-10-10)

1. **OQ-02 resolved: rule A stands.** Made by the user at the Designer stage. Exact code matches come first, then name matches, each in the surface's usual order (Search alphabetical, a picker in the order it was handed); no mitigation for a four-letter name prefix that is also a code. Reason: one ranking rule on every surface is worth the rare case where a typed name prefix is another bird's code. The rule lives in one function, `rankSpeciesMatches` in `lib/speciesMatch.ts` (schema.md 8.1).

2. **A row's codes are its American name's codes ("just use American spellings and variants").** Made by the user at the Designer stage. A row matches its own eBird `bandingCodes` plus only the `comNameCodes` formed from its own displayed eBird common name under the standard four-letter rule (schema.md 5.2). Codes eBird adds from a bird's other names (British, international or former names: GOOS for Common Merganser, COST for European Starling, RODO for Rock Pigeon, GBHE on Green Heron, MYWA on the Yellow-rumped Warbler species) are dropped at generation time. Reason: the user types the codes of the names SnowRaven shows, and codes from names it never shows only put unexpected birds first. This supersedes Key Decision 1 of the strategic brief (the union of `bandingCodes` and `comNameCodes`) and narrows PRD FR-01.

3. **A hyphen convention is a variant of the shown name, so its code is kept.** Orchestrator default, given with the errand that applied decision 2. Where eBird forms a code from the displayed name under a different treatment of its hyphens (Common Wood-Pigeon: CWPI split, COWP initials, COWO joined; Spotted Whistling-Duck: SPWD), the code is kept. Reason: the user's word was "variants", and these codes are spelled from the name SnowRaven shows; a code from a different name is not.

4. **A code formed from the shown name with its accents removed is a variant, so both are kept.** Orchestrator default, not a user decision. Rüppell's Bustard keeps RUBU beside RÜBU (13 entries, 11 species and 2 forms, gain the plain-letter twin). Reason: it matches the user's "spellings and variants", and an American keyboard types `rubu`. eBird publishes both spellings, so nothing is folded in the app (OQ-01 stands).

## Stage 3 - The Architect, Designer-stage amendment (2026-10-10)

5. **A form's parenthesised qualifier never forms a code.** The code is formed from the name with every parenthetical removed, so a form keeps its banding codes (MYWA, AUWA, ORJU) and the code of its species' name (YRWA, DEJU). Reason: forming codes from qualifiers was measured and adds 168 codes, many of them other names (Green-winged Teal (Eurasian): EUTE) and one a collision with a familiar code (Sharp-shinned Hawk (Rufous-thighed): RTHA, Red-tailed Hawk's banding code).

6. **Slashes and hybrids are not expanded into their component names.** The literal rule forms one code from the whole displayed name, as the approved design-spec table states, so `cago` no longer lists Cackling/Canada Goose and `Cape May x Yellow-rumped Warbler (hybrid)` carries no code. Measured: 82 of 1,035 slashes and 19 of 792 hybrids keep a code, against 1,031 and 792 under the union. Reversal: forming a code from each named component (and keeping the components' banding codes) restores 1,031 slashes and 789 hybrids for about 6 KB gzip (148,335 against 142,625 bytes); it is a change to one generator function, `nameFormedCodes` plus its composite step, and is offered to the user rather than taken here (hand-back flag).
