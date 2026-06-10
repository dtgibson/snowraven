# Handoff — 0.5.27 SHIPPED & live; pipeline idle, nothing pending

## Where We Are

**Idle.** No active Weft session (`activeFeature: null`,
`lastCheckpointStatus: complete`). Released version **0.5.27** equals `main`
(HEAD `083fdc7`) — nothing undeployed, nothing queued to ship.

## What Shipped (live) — 0.5.27 (Checklists tab feature lane)

- **New Checklists tab** with three sections: **Checklist Comments** (search
  every checklist-level comment you've written), **Species Comments** (the same
  search across observation notes of all species at once, each entry leading with
  a clickable species name), and **All Checklists** (every outing with date,
  location, protocol, effort, species/individual counts, at-a-glance indicators,
  and the checklist comment).
- **Composable filters.** One pill per category cycles **any → has → doesn't
  have** for checklist comment, species comments, media, breeding codes, weather
  block, and tide block — plus Complete/Incomplete, photo/audio/video, protocol,
  county, and a date range.
- **Hide pasted weather & tide blocks.** Tab-wide toggle (off by default) strips
  SnowRaven weather/tide blocks from every comment shown *and from search*; a
  comment that is only a block counts as having no comment while hidden.
- **Plumbing/docs.** The safe comment renderer (`CommentText.tsx`) is now shared
  by the List Comparer and the new tab; new `Checklists.tsx` (+test) and
  `lib/checklistsTab.ts` (+test); Help TOC now lists Named Birds + Checklists;
  `PRIVACY_POLICY.md` completed the Cornell Lab provider disclosure (embedded
  Macaulay media + eBird/BoW link icons) — disclosure only, no behavior change.

Built, chronicled, version-bumped, and tagged on the **VM**; released from the
**Mac**: `v0.5.27` tag (`083fdc7`) → Windows CI green → `./release.sh`. macOS
universal DMG notarized **Accepted** + stapled; Windows installer signed locally
with the real minisign key; `latest.json` carries all three platforms
(`darwin-aarch64`, `darwin-x86_64` → the one universal bundle, `windows-x86_64`
→ `-setup.exe`). Post-release health check: every updater/DMG URL **HEAD 200**,
and both signatures in `latest.json` are **byte-identical** to the uploaded
`.sig` assets.

## Website

Current at **0.5.27** (version pill + footer bumped on the VM).

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
