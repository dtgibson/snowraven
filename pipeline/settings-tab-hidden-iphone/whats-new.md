# App Store What's New and disposition: 1.0.45 (settings-tab-hidden-iphone)

## 2026-10-01: the App Store choice at the production gate

The user confirmed the production deploy and chose to withdraw 1.0.43 from
review and send 1.0.45 instead. Record `73b6e8ac-8f86-4321-92c1-b1b3eea329bd`
(1.0.43, carrying 1.0.42) was still `WAITING_FOR_REVIEW` as submission
`dc1ce5dd`. It was withdrawn at 16:34 PDT (`DELETE
/v1/appStoreVersionSubmissions/{versionId}`, HTTP 204) and read
`DEVELOPER_REJECTED`. 1.0.44, deferred behind that record and never given one
of its own, rides in the same record. The user approved the 1.0.45 line at the
same gate: "On iPhone, Settings now always shows at the bottom of the More
sheet, at every text size."

## 2026-10-01: the user's device check of TestFlight build 1.0.45.1

The user installed TestFlight build 1.0.45.1 (delivery `b17f8828`) on their
iPhone and reported, relayed by the orchestrator at about 16:55 PDT: "The
testflight build looks good, settings is clearly visible again." That check
gated the App Store leg.

## 2026-10-01: the approved What's New (686 characters)

The user's own edit of the 912-character combined draft (the record's 664
characters, then the 1.0.44 line, then the 1.0.45 line), approved word for word:

1. The 1.0.43 paragraph ("The Alerts inbox on iPhone and iPad has a Mark read
   button beside Clear. It clears the New marks and the count without removing
   any alerts.") is removed: Mark read reaches the store together with Alerts.
2. In the Alerts paragraph, ", and each check is the same eBird request with
   your own key that Nearby Lifers makes" is removed, leaving "Alerts are off
   until you turn them on."

The text, four paragraphs with one blank line between, as written to the record:

> Alerts, on iPhone and iPad. Turn them on in Settings and SnowRaven tells you when eBird reports a species you have never recorded near a place you choose, checking about hourly or about daily, with quiet hours and an inbox of past alerts. Alerts are off until you turn them on.
>
> Species Detail now shows, for any species eBird has split or lumped, what it was, what it became, and how many of your reports eBird reassigned in each update.
>
> Home-screen widgets can now measure from your Default Location instead of where you are: touch and hold a widget, choose Edit Widget, and set Measure from.
>
> On iPhone, Settings now always shows at the bottom of the More sheet, at every text size.

The 1.0.44 line is the one approved at the 1.0.44 gate
(`pipeline/widget-measure-from-choice/held-copy.md`, section 5), unchanged.

## 2026-10-01: the record retargeted and submitted

- `versionString` 1.0.43 to 1.0.45 (HTTP 200), build repointed to 1.0.45.1
  (`b17f8828-948a-4d7e-9ab7-711a56c20e9c`, `VALID`; HTTP 204). State
  `PREPARE_FOR_SUBMISSION`.
- What's New written (HTTP 200) and read back: 686 characters, byte-identical.
- App Review notes: byte-identical to `appstore/REVIEW_NOTES.md`'s "Notes for the
  reviewer" section, 3,898 characters, so nothing was written. The 1.0.44 gate had
  checked them and found no change needed.
- Every other listing field read back against `appstore/LISTING.md` and matching:
  name, subtitle, promotional text (137), description (3,233), keywords (97),
  marketing, support and privacy policy URLs, copyright, categories Reference and
  Weather on both app-info records. `releaseType` `AFTER_APPROVAL`, no phased
  release.
- Screenshots unchanged: both sets, six each, `COMPLETE`, every md5 matching
  `appstore/screenshots/` in order. None shows a widget (1.0.44) or the More
  sheet (1.0.45).
- Submitted through the reviewSubmissions flow as
  `e79c0e48-c0b7-42d0-93a6-74275f7e5dad` at 00:11:22Z on 2026-10-02 (17:11 PDT);
  the record reads `WAITING_FOR_REVIEW` on build 1.0.45.1.
- Reconciliation over every TestFlight train from 1.0.13 to 1.0.45: the trains
  with no record of their own are 1.0.15, 1.0.16, 1.0.18 (skips), 1.0.25
  (deferral), 1.0.37 (TestFlight-only), and 1.0.20, 1.0.22, 1.0.26, 1.0.29,
  1.0.33, 1.0.39, 1.0.41, 1.0.42, 1.0.43, 1.0.44 (rollups). No unaccounted gap.
  CLAUDE.md's version-record list gains the 1.0.45 ship entry.
