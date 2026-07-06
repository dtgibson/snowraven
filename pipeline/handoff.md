## What We Accomplished

Shipped **Weather Backlog (v0.5.67)**. The Weather tab now has a "List checklists
with no weather blocks" section at the bottom: it lists your 100 most-recent
complete, non-incidental checklists that still have no SnowRaven (or RainCrow)
weather block, newest first, built entirely from your loaded eBird backup. Each
row shows the date, location, species count, protocol, effort and completeness,
with three actions — open the checklist on eBird, open its comment/edit page, and
**Copy weather & go** (copies that checklist's weather and opens the eBird edit
page so you can paste). The list pages in 100s (Show next 100 / Show all), and a
toggle widens it to include incomplete and incidental checklists.

The live preview against your real data earned its keep: it caught two Tauri-only
bugs the automated tests couldn't see — `window.open` is silently dropped in the
desktop WebView (fixed with a new `openExternalUrl` seam that opens external URLs
the way the rest of the app already does), and a setState-in-render in the expand
toggle. Both were fixed and re-verified before ship.

## What Has Been Saved

- **Shipped to production.** Desktop (universal macOS + Windows) is **live** at the
  v0.5.67 GitHub release with the notarized DMG, signed Windows installer, updater
  bundle, and `latest.json` — the in-app updater will offer it to every user.
- Commits on `main`: `aa46b85` (feature), `568b99a` (pipeline artifacts),
  `a3c8ca0` (records), plus this state+handoff closeout. Tag `v0.5.67`; Windows CI
  run `28816707897` green.
- Verified before ship: build ✓, lint ✓, **1548 frontend + 178 backend tests** ✓,
  maplibre off the entry chunk, a clean security review, and a live desktop
  preview against your real data.
- Records updated: PRODUCT_CONTEXT, DECISIONS, ROADMAP (→ Shipped), and CLAUDE.md
  (one new convention: never `window.open` in Tauri — use the `openExternalUrl`
  seam or OutboundLink/ChecklistLink).

## Where We Are

Feature complete and shipped. Pipeline is idle.

A concurrent task (started separately) is tokenizing the WeatherBacklog switch
thumb; it lands on its own branch and doesn't affect this release.

## Resume Prompt

Run `/weft` to start the next feature.
