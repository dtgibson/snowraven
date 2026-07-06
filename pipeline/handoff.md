## What We Accomplished

Shipped **Named Birds Media (v0.5.66)**. On the Named Birds tab, each named
individual now shows its own Macaulay Library media — photos, audio, and video —
in a tidy grid below its sightings map. Each item carries its capture date and a
link to the checklist it came from.

The key design choice (yours): media is matched to a named bird by the `[name:…]`
tag in each **media asset's own** caption/media-notes — not the checklist or
species comment, since those name the bird but don't point at a specific asset.
It's fully local matching; only the embed player itself needs a connection.
Embeds load on demand (newest 6, then "Show more"), and offline or on a failed
load they degrade to a placeholder that still shows the date, the checklist link,
and a "View on Macaulay Library" link-out — never a broken frame. The privacy
policy now discloses the Named Birds tab as an inline-media surface.

## What Has Been Saved

- **Shipped to production.** Desktop (universal macOS + Windows) is **live** at
  the v0.5.66 GitHub release with the signed DMG, Windows installer, updater
  bundle, and `latest.json` — in-app updates will detect it. iOS/iPadOS **build 2**
  is uploaded to **TestFlight** (App Store Connect processing).
- This release also carried the previously-committed **sex-terminology** fix
  (v0.5.65).
- Commits on `main`: `01cc4ea` (feature), `0dc52c4` (records), and the final
  state+handoff closeout. Tag `v0.5.66`.
- Verified before ship: build ✓, lint ✓, **1503 tests** ✓, maplibre off the
  entry chunk. A 6-lens adversarial review (security/correctness/offline/a11y/
  privacy/conventions) found 5 issues — all fixed and re-verified clean.
- Records updated: DECISIONS, PRODUCT_CONTEXT, ROADMAP, CLAUDE.md (two
  conventions promoted: media-asset-comment matching + the non-destructive
  embed-timeout/offline-overlay pattern).

## Where We Are

Feature complete and shipped. Pipeline is idle.

**Notable follow-up on the roadmap (On the Horizon):** the existing Species
Detail media embed has no offline/failed-load fallback — this feature built one
worth backporting there.

## Resume Prompt

Run `/weft` to start the next feature.
