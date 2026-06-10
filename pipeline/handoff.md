# Handoff — 0.5.26 SHIPPED & live; pipeline idle, nothing pending

## Where We Are

**Idle.** No active Weft session (`activeFeature: null`,
`lastCheckpointStatus: complete`). Released version **0.5.26** equals `main` —
nothing undeployed, nothing queued to ship.

## What Shipped (live) — 0.5.26 (Named Birds feature lane)

- **Per-individual map.** Expanding a named bird shows a small map of everywhere
  that individual has been seen, drawn like the Species Detail map. The map is now
  a single shared `SightingsMap` component used by **both** Named Birds and Species
  Detail (new `SightingsMap.tsx`, `lib/sightingMarkers.ts` + tests,
  `NamedBirdRow.tsx`).
- **Location per report.** Each sighting shows its location between the date and
  the checklist link.
- **Sorting.** Name (Individual) / Alphabetical / Taxonomic / Last Seen.
- **Readability polish.** Higher contrast, name + species on a shared baseline,
  each comment in its own quoted block, cards open one at a time.

Built, chronicled (PRODUCT_CONTEXT / DECISIONS / CHANGELOG) + product-brief
refresh, version-bumped, and tagged on the **VM**; released from the **Mac**:
`v0.5.26` tag → Windows CI green → `./release.sh`. macOS universal DMG notarized +
stapled (Apple: Accepted); Windows installer signed locally with the real minisign
key; `latest.json` carries all three platforms (`darwin-aarch64`, `darwin-x86_64`
→ the one universal bundle, `windows-x86_64` → `-setup.exe`), every updater URL
verified **HEAD 200**. 692 frontend + 102 backend tests green.

## Website

Current at **0.5.26** (version pill + footer bumped on the VM).

## Machine boundary (standing rule)

- **Ubuntu VM — all dev work** (coding, content/assets incl. website + demo
  screenshots, pushing the `vX.Y.Z` tag).
- **Mac — only signing and shipping** (`./release.sh` needs Xcode + Apple creds).

> The VM keeps pushing while a Mac session is open — re-pull before editing the
> pipeline files, and treat the VM's commits as authoritative on conflict. The VM
> typically does NOT update `handoff.md` / `session-state.json` narrative fields,
> so they need correcting Mac-side each release.

## Roadmap — Up Next (pick a lane, build on the VM)

- Mobile app
- Accessibility / clarity / simplification
- Windows code signing (remove the SmartScreen "unknown publisher" prompt)

No pending Chronicler or deploy step. Clean slate for the next lane.
