## What We Accomplished

Shipped **two improvements as v0.5.68**. First, the Calendar tab's Compact/Large
view modes now work on a phone: previously a phone force-pinned one view, hid the
toggle, and crammed both the count and the date into it, so the two modes looked
identical. Now the toggle governs at every width — Compact shows per-day counts
with no date; Large shows dated, shaded mini-months with no count (tap a day for
the popup). Desktop is unchanged (it already behaved this way). Second, em dashes
were removed from the app's user-facing copy and the in-app Help (~163 spots),
replaced with cleaner punctuation. This release also carried the switch-thumb
tokenization to production.

## What Has Been Saved

- **Shipped to production.** Desktop (universal macOS + Windows) is **live** at the
  v0.5.68 GitHub release with the notarized DMG, signed Windows installer, updater
  bundle, and `latest.json` — the in-app updater will offer it to every user.
- Commits on `main`: `33ca92a` (the improvement + docs + version), `dd7203d`
  (pipeline artifacts), `5f5a837` (records), plus this state+handoff closeout. Tag
  `v0.5.68`; Windows CI run `28827731950` green.
- Verified before ship: build ✓, lint ✓, **1549 frontend + 178 backend tests** ✓,
  a clean security review, and the desktop live preview you confirmed.
- Two prior Calendar decisions were **reversed** (the phone view-force and the
  phone-only date corner) — both logged in DECISIONS.md — and the stale CLAUDE.md
  note describing the old behavior was corrected. A new convention (no em dashes in
  user-facing copy) was recorded.

## Where We Are

Improvement complete and shipped. Pipeline is idle.

One open item: the Calendar mobile *layout* is test-verified but wasn't checked on
a real phone (the desktop app window wouldn't narrow far enough on your machine).
Worth an eyeball on an actual phone when convenient.

## Resume Prompt

Run `/weft` to start the next thing.
