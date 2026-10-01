
## 2026-09-30 · Orchestrator, Case 1 updates

- strategic-brief.md: two British spellings corrected ("behaviour" to "behavior", "honours" to "honors"), flagged by The Tester.
- held-copy/d-listing-privacy.md and held-copy/h-review-notes.md: My location's source now names a placed widget's own device reading beside the app's reading, using The Auditor's L8 remediation wording verbatim (security-report.md, L8). Wording only; both remain HELD for the user's express yes.

## 2026-09-30 · Re-entry to Stage 4 (The Designer) after the live look

At the live look over the tailnet the user approved the build overall but found the inbox hard to find inside Settings -> Alerts. Direction: the inbox becomes its own page or pop-up, with an easier way in. This changes the approved design, so the run re-enters Stage 4 (the v1.0.29 rule: what the live look finds goes back to The Designer, not a post-ship fix). Everything else already approved is not re-litigated: the Alerts settings, the six status sentences, the notification tap opening Nearby Lifers, the privacy behavior. The Engineer, Tester and Auditor then run again over the revised spec, scoped to the change. The held drafts are re-shown for an express yes after the redesign, since the inbox's location may appear in their wording.

## 2026-10-01 · The user's yes on the published-copy drafts

After the second live look (the inbox sheet with its bell, Settings row and palette entry) the user approved the build and the drafts in pipeline/ios-alerts/held-copy/, in their words: "This all looks good. I agree no changes to website or readme, but the rest is good."
- APPROVED, exact text as held: (a) PRIVACY_POLICY.md and its mirror website/privacy.html (PRIVACY_POLICY.proposed.md / privacy.proposed.html; effective date filled at ship), (b) product-brief.md network sentence, (c) App Store What's New, (d) appstore/LISTING.md compliance bullet, (g) ACCESSIBILITY.md clause, (h) appstore/REVIEW_NOTES.md block (pasted into App Store Connect at ship).
- NOT APPLIED: (e) no README or website sentence (the user agreed). (f) the location permission text stays unchanged: it was offered as optional with the recommendation to leave it, and "the rest is good" was read as agreeing with the recommendations; the Guide said so to the user so it can be corrected.
- Case 1: 1.0.41 shipped from main while this build ran (taxonomic-splits-lumps), so the drafts' version label moved from 1.0.41 to 1.0.42 (What's New heading, compliance bullet "Alerts (v1.0.42)", the effective-date placeholder). Text otherwise unchanged.
- The privacy policy, product brief, accessibility statement, listing and review notes are unchanged on origin/main since this build's base (eefebd1), so the proposed whole files apply cleanly after the pre-deploy merge.

## 2026-10-01 · The Deployer, pre-deploy preparation (nothing pushed)

- The build was committed on `worktree-ios-alerts` (`9bcb1f8`). The simulator and preview PNGs in `evidence/` (8.8 MB) are gitignored as reference only, kept on disk, by the precedent of `ios-lifer-widgets/screens/`; `evidence/README.md` and the preview scripts are committed.
- origin/main (13 commits, 1.0.41 and 1.0.40 build 6) was merged in, not rebased (`58399b0`). The two conflicts were additive `paths` lists in `.claude/rules/bird-names.md` and `testing.md`; both sides kept. No behavior from the two builds overlaps.
- Two guards needed reconciling after the merge, each a test-only change with a mutation check:
  - `iosAlertsManifest.test.ts` hashed the widget extension's whole `Info.plist`, whose `CFBundleVersion` every `tauri ios build` stamps, so main's `stamp iOS 1.0.41 build 1` turned it red and 1.0.42.1 would have again. It now masks that one value and pins every other byte (`cc7730a`).
  - `targetsPublishedClaims.test.ts` row E pinned the privacy sentence that approved substitution 7b rewords ("can be saved locally as your default location or as the place Alerts checks around"). It now pins the approved wording (`67b2b28`).
- Applied as approved (`88451c8`): (a) the privacy policy and `website/privacy.html`, effective October 1, 2026, after re-checking that both proposed files equal the merged live files plus exactly the listed substitutions; (b) product brief; (d) listing bullet; (g) accessibility clause.
- HELD, not applied: (h) the App Review notes block. With it, the pasted notes measure 4,792 characters as committed (4,749 unwrapped) against App Store Connect's 4,000; they were 3,953 before it. No wording of the new block fits without trimming text the user already approved, so the trim is the user's decision, due before the App Store submission (the notes are pasted only then). The approved block stays in `held-copy/h-review-notes.md`.
- Version 1.0.42 across the four-file set and the lockfile, with its CHANGELOG entry (`8ccaea3`). The iOS plist is stamped at the TestFlight build.

## 2026-10-01 · Deployment record: 1.0.42 shipped (desktop, web, TestFlight)

Run on the Orchestrator's routed production gate decision ("Confirm, release 1.0.42 now"), one leg at a time, each verified before the next.

| Leg | Result | Ids |
|---|---|---|
| Push `main` | fast-forward `faed221..9f7adf1` (origin/main re-checked unmoved first) | |
| Tag | `v1.0.42` (annotated) at `9f7adf1` | |
| Windows CI | success, run on the tag commit; `release.sh`'s pinned selection resolved to it | `36904871606` |
| Website | Pages deploy success; live pill and footer read v1.0.42; live `privacy.html` byte-identical to the committed file (effective October 1, 2026) | `36904856940` |
| `./release.sh` | exit 0; release published 2026-10-01T18:28:51Z with the universal DMG, `SnowRaven-updater.app.tar.gz` + `.sig`, `SnowRaven_1.0.42_x64-setup.exe` + `.sig`, `latest.json` | https://github.com/dtgibson/snowraven/releases/tag/v1.0.42 |
| DMG, downloaded independently | `codesign --verify` valid, `stapler validate` worked, `spctl` accepted, `source=Notarized Developer ID` | |
| Updater | `releases/latest/download/latest.json` serves version 1.0.42 with `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64` | |
| iOS archive | `tauri ios build --build-number 1`: archive succeeded, stamped 1.0.42 / 1.0.42.1, executable `platform IOS` (minos 16.0), all 9 swift-rs libs `platform 2`; Tauri's own export refused as the runbook expects (this time worded "No Account for Team" / "No profiles found") | |
| iOS export | widget extension ad-hoc signed with its App Group before export; manual export with `~/.tauri/snowraven-ios-export-options.plist` succeeded; DistributionSummary lists both bundle ids, the appex with the App Group only, the app with the group and its three iCloud keys, no push entitlement | |
| Validate, upload | `altool --validate-app`: VERIFY SUCCEEDED with no errors; `--upload-app`: UPLOAD SUCCEEDED | delivery `f03c6cc2-8986-40f5-819d-fd168b38615a` |
| TestFlight | build 1.0.42.1 `VALID` (ASC API, read only) | `f03c6cc2-8986-40f5-819d-fd168b38615a` |
| iOS stamp | `0cbb40a chore(ios): stamp iOS 1.0.42 build 1` pushed (`9f7adf1..0cbb40a`); pbxproj's cosmetic re-quote restored, as in every earlier stamp | |
| Pipeline (run of record) | success, frontend and backend, on the stamp commit; the tag commit's run `36904856711` was cancelled by the stamp push, as the runbook expects | `36907400108` |

Not done, by design: no App Store version record and no submission for 1.0.42 (the user's device check of build 1.0.42.1 comes first, and the review-notes trim is still the user's decision). App Store state at this ship (read only): 1.0.40 `READY_FOR_SALE` on record `203ea1fd` (build 1.0.40.6, submission `62834004` COMPLETE), so 1.0.40 is RESOLVED; 1.0.41 still DEFERRED with VALID build 1.0.41.1 and no record, its stated condition (1.0.40 for sale) now met; 1.0.42 on TestFlight as 1.0.42.1 with no record yet. No rollback was needed.

## 2026-10-01 · The user's device check of 1.0.42.1 and yes on the review-notes trim

- Review-notes trim (held-copy/i-review-notes-trim.md, 3,898 characters with the Alerts block word for word): APPROVED by the user ("trim is good"). Applied to appstore/REVIEW_NOTES.md at the App Store submission.
- Device check, TestFlight build 1.0.42.1 on the user's iPhone: installed and launched; turning Alerts on posted a notification; no new nearby lifer was reported in the following hour, so no scheduled-check notification was observed yet. The user reports Alerts "appear to be working". Per the 2026-09-26 direction (automated tests are the usual path; a criterion the user does not cover stays Partial and deferred, without repeated asks), QA-35 and QA-53..55 (real cadence, locked-phone delivery, quiet-hour delivery, notification tap) are recorded as Partial, observed only in part on hardware, not passed.

## 2026-10-01 · App Store plan: one submission (1.0.41 rolled up into 1.0.42)

The user chose one submission: a 1.0.42 App Store record on build 1.0.42.1 that also carries 1.0.41 (Splits and lumps). 1.0.41 therefore ends with VALID build 1.0.41.1 and no version record of its own BY ROLLUP, not by skip; the 1.0.42 record carries it and its What's New names it. This is to be added to CLAUDE.md's version-record list in the same ship. The combined What's New text still needs the user's express yes before it is entered.

## 2026-10-01 · The Deployer, submission preparation for option A (no App Store Connect writes)

- Applied the approved review-notes trim (`dd1d17e`): the pasted part of `appstore/REVIEW_NOTES.md` is exactly the AFTER text of `held-copy/i-review-notes-trim.md`, 3,898 characters as committed.
- Combined What's New drafted as held proposal (j): both approved texts word for word, Alerts first, 523 characters. Awaiting the user's yes.
- Screenshots, checked against App Store Connect (read only): Alerts makes nothing stale. No store or website shot shows Settings; the bell, the iPad sidebar item and the Search row render no markup while Alerts is off and the inbox is empty, which is the state every shot shows; the one unconditional style change (`.sr-header { position: relative; }`) has no positioned descendant to move while the bell is absent. But `05-species-detail.png` in BOTH store sets differs from the live record (1.0.41's approved Splits and lumps recapture, never uploaded because 1.0.41 had no record); 01 to 04 and 06 match byte for byte. The 1.0.42 record therefore replaces both sets whole and in order.
- App Store Connect facts (read only): 1.0.40 `READY_FOR_SALE` (record `203ea1fd`); no 1.0.41 or 1.0.42 record; builds 1.0.41.1 (`ec258e92`) and 1.0.42.1 (`f03c6cc2`) `VALID`, `usesNonExemptEncryption` false, expiring 2026-12-29 and 2026-12-30; age rating 4+, its only unset fields `developerAgeRatingInfoUrl`, `gracRatingClassificationNumber` and `kidsAgeBand` (non-blocking on a non-Kids app); the 1.0.40 record is `AFTER_APPROVAL` with no phased release, and its review detail has `demoAccountRequired` false.
