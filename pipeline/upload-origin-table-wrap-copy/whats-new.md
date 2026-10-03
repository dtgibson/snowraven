# App Store What's New: 1.0.48 (upload-origin-table-wrap-copy)

**APPROVED at the production gate, 2026-10-02: text (a), both sentences, word
for word.** Route: **deferred behind 1.0.47** (shape 1 below). Record `0d823282`
(1.0.47, carrying 1.0.46) was still `WAITING_FOR_REVIEW` as submission
`503d3481`, and the user chose to leave its review undisturbed. 1.0.48 gets its
own record on build 1.0.48.1 (delivery `c0484168`, VALID, the user's own device
check passed) once `0d823282` is `READY_FOR_SALE`, with this What's New:

> On the Targets tab, long species names now wrap within their row instead of making the table scroll sideways. In Settings, Appearance now says correctly where your color scheme is saved.

No screenshot changes. Read every listing field back on the new record,
promotional text included (it has arrived empty three times). Not yet written to
App Store Connect; the deferral is recorded in CLAUDE.md's App Store list.

The drafting notes below are kept as they were written at pre-deploy
preparation.

## What the iPhone and iPad app gets in 1.0.48

Two of the build's four fixes reach the iOS app:

- The Targets tab: a long common or scientific name wraps within its row
  instead of making the table scroll sideways (phone width, large text).
- Settings' Appearance section: "Your preference will be saved in this app's
  settings on this device." replaces the old sentence about "this browser's
  local storage", which was never true in the app.

The cross-site write protection, the security headers and the bar-chart
"this server" sentence are web and Raspberry Pi only; the iPhone and iPad app
never uses the server, so the What's New does not mention them.

## The App Store situation this text is for

As of the 1.0.47 deployment record (`pipeline/targets-hotspot-link/decisions.md`,
not re-queried at this stage, which makes no App Store Connect calls): record
`0d823282-fa3d-4276-87c7-209a0cf6cea8` is 1.0.47 on build 1.0.47.1, submitted as
`503d3481-c2ec-4555-88cd-ab83bd19f222`, `WAITING_FOR_REVIEW`, and already carries
1.0.46 by rollup. So 1.0.48's App Store leg has three possible shapes, chosen at
the gate after a live query:

1. **Defer behind 1.0.47** (leave its review undisturbed): 1.0.48 gets its own
   record later, once 1.0.47 is `READY_FOR_SALE`, with text (a).
2. **Roll 1.0.47 into 1.0.48** (withdraw `0d823282` while still
   `WAITING_FOR_REVIEW`, retarget, repoint at build 1.0.48.1, resubmit): text (b).
3. **1.0.47 already `READY_FOR_SALE` by then:** a new record of its own, text (a).

Screenshots: no change needed under any shape. Neither set shows the Targets
tab or Settings (`appstore/screenshots/`, six each: Map Explorer, Statistics,
Weather & Tide, Calendar, Species Detail, Breeding Codes). Nothing in
`appstore/LISTING.md` or `appstore/REVIEW_NOTES.md` mentions where the color
scheme is saved.

## (a) 1.0.48 on its own record (186 characters)

> On the Targets tab, long species names now wrap within their row instead of making the table scroll sideways. In Settings, Appearance now says correctly where your color scheme is saved.

The second sentence is optional (as 1.0.46's Help sentence was). Without it,
the text is the first sentence alone, 109 characters.

## (b) 1.0.47 rolled up into 1.0.48 (460 characters)

1.0.47's approved What's New, byte for byte as written to record `0d823282`
(itself 1.0.46's approved paragraph plus one sentence for 1.0.47), followed by
the 1.0.48 sentences. One paragraph:

> Home-screen widgets that refresh at the same time now make one eBird request between them. In Settings, Remove synced files from iCloud now tells you when it could not finish. Help is brought up to date. On the Targets tab, a hotspot's name under Last report now opens its page on eBird. Long species names there now wrap within their row instead of making the table scroll sideways. In Settings, Appearance now says correctly where your color scheme is saved.

The 1.0.48 Targets sentence opens "Long species names there" rather than "On
the Targets tab" because it follows the 1.0.47 Targets sentence directly. The
last sentence is optional here too; without it, the text is 383 characters.

Source of the approved 1.0.47 text: `pipeline/targets-hotspot-link/decisions.md`,
"Deployment record, 1.0.47", which records it as written and read back byte for
byte.
