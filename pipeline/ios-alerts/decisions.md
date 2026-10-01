
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
