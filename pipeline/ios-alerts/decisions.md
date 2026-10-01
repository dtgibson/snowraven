
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
