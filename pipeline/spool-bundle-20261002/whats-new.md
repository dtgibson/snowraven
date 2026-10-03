# App Store What's New and disposition: 1.0.46 (Spool bundle 20261002)

## 2026-10-02: the App Store situation at this ship

1.0.45's record `73b6e8ac-8f86-4321-92c1-b1b3eea329bd` was already `READY_FOR_SALE` on build 1.0.45.1. Its submission `e79c0e48` is `COMPLETE`.

Nothing was in review, so neither a deferral behind 1.0.45 nor a withdraw-and-roll-up was possible. 1.0.46 takes a record of its own, which is the standing rhythm.

## 2026-10-02: the user's device check of TestFlight build 1.0.46.1

The user installed TestFlight build 1.0.46.1 (delivery `45148a5b-fc81-4053-9398-d450b0f04d1b`) on their own device. The orchestrator relayed their report: "looks good, and app launches correctly". That check gated the App Store leg. No agent touched a device.

## 2026-10-02: the approved What's New (203 characters)

The user approved the text below word for word, in the same reply as the device check. It is one paragraph of three sentences:

> Home-screen widgets that refresh at the same time now make one eBird request between them. In Settings, Remove synced files from iCloud now tells you when it could not finish. Help is brought up to date.

The first two sentences are the draft in `release-plan.md`, section (c). The third is that section's optional Help sentence, which the user included.

## 2026-10-02: the record created and submitted

**The record.** `POST /v1/appStoreVersions` (HTTP 201) created record `0d823282-fa3d-4276-87c7-209a0cf6cea8`:

- `versionString` 1.0.46, on build 1.0.46.1 (`45148a5b`, `VALID`).
- `releaseType` `AFTER_APPROVAL`.
- copyright "2026 Dave Gibson".
- State `PREPARE_FOR_SUBMISSION`.

**What the new record carried over, and the one restore.**

- The promotional text arrived EMPTY (`null`), as it did at 1.0.35 and 1.0.42. It was restored from `appstore/LISTING.md` (137 characters) in the same write as the What's New (HTTP 200).
- Every other field carried over.

**What's New.** Read back: 203 characters, byte-identical.

**Every listing field, read back against `appstore/LISTING.md` and matching:**

- Name (9) and subtitle (27), on both app-info records: the released `fd68e0c2` and the new editable `765824bb`.
- Promotional text (137), description (3,233) and keywords (97).
- Marketing, support and privacy policy URLs.
- Copyright.
- Categories Reference and Weather, on both app-info records.

**App Review information.**

- The notes carried over: 3,898 characters, byte-identical to `appstore/REVIEW_NOTES.md`'s "Notes for the reviewer" section. Nothing was written.
- Contact name, phone and email, and `demoAccountRequired` false, all match the 1.0.45 record.

**Age rating.** The new editable app-info record's declaration was compared with the released one: all 30 fields are identical, and the rating is `FOUR_PLUS`. Three fields are null on both: `kidsAgeBand`, `developerAgeRatingInfoUrl` and `gracRatingClassificationNumber`. None blocks a non-Kids app. Nothing was answered or written.

**Release type.** `AFTER_APPROVAL`, no phased release (none exists on the record).

**Screenshots.** Both sets were unchanged, six each, all `COMPLETE`. Each md5 matches `appstore/screenshots/` in order:

- `APP_IPHONE_67` matches `iphone-6.9/`.
- `APP_IPAD_PRO_3GEN_129` matches `ipad-13/`.

No screenshot shows a widget, Settings or Help, so nothing was recaptured.

**Submission.** Submitted through the reviewSubmissions flow:

- Submission `c3fbb8c7-5b7b-4cca-9043-f26c828ed1f8` was created with `POST /v1/reviewSubmissions`.
- The version was attached with `POST /v1/reviewSubmissionItems` (HTTP 201).
- `PATCH submitted: true` was sent at 22:47:36Z on 2026-10-02 (15:47 PDT).

No other submission was open beforehand.

**Read back after submitting:**

- The record reads `WAITING_FOR_REVIEW` on build 1.0.46.1.
- The submission reads `WAITING_FOR_REVIEW`.
- The What's New and promotional text are still byte-identical.

## Reconciliation over every TestFlight train from 1.0.13 to 1.0.46

**Version records** now exist for these 20 versions: 1.0.4, 1.0.13, 1.0.14, 1.0.17, 1.0.19, 1.0.21, 1.0.23, 1.0.24, 1.0.27, 1.0.28, 1.0.30, 1.0.31, 1.0.32, 1.0.34, 1.0.35, 1.0.36, 1.0.38, 1.0.40, 1.0.45 and 1.0.46. The 19 before 1.0.46 are `READY_FOR_SALE`, and 1.0.46 is `WAITING_FOR_REVIEW`.

**Trains with no record of their own:**

| Versions | Why |
|---|---|
| 1.0.15, 1.0.16, 1.0.18 | skips |
| 1.0.25 | deferral |
| 1.0.37 | TestFlight-only, by the user's direction |
| 1.0.20, 1.0.22, 1.0.26, 1.0.29, 1.0.33, 1.0.39, 1.0.41, 1.0.42, 1.0.43, 1.0.44 | rollups |

Each has its written reason in CLAUDE.md's version-record list. There is no unaccounted gap.

**Owed to CLAUDE.md at closeout:** that list still records 1.0.45 as `WAITING_FOR_REVIEW`. The 1.0.46 ship entry should say:

- 1.0.45 is RESOLVED: record `73b6e8ac`, `READY_FOR_SALE` on build 1.0.45.1, submission `e79c0e48` `COMPLETE`.
- 1.0.46 is on its own record `0d823282`, submitted on build 1.0.46.1 as `c3fbb8c7`.
