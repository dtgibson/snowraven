# Handoff — 0.5.25 SHIPPED & live; pipeline idle, nothing pending

## Where We Are

**Idle.** No active Weft session (`activeFeature: null`,
`lastCheckpointStatus: complete`). Released version **0.5.25** equals `main` —
nothing undeployed, nothing queued to ship.

## What Shipped (live)

**0.5.25** — Statistics → Media card "At a glance" rework (a follow-up that
refines 0.5.24's same area):
- All three facts — **Busiest day**, **Longest streak**, **Archive span** — are
  back as proper, equal-height stat tiles instead of one cramped caption line.
  Every tile reserves its sub-line slot, so the row can't misalign at any window
  width (the bug 0.5.24 was chasing can't recur).
- **Busiest day** date now links to that day's eBird checklist (the one holding
  the most of the day's media when there are several).
- **Longest streak** shows the actual dates the streak ran; new **Archive span**
  tile shows collection length over the first→latest date range.

Built, chronicled (PRODUCT_CONTEXT / DECISIONS / CHANGELOG), version-bumped, and
tagged on the **VM**; released from the **Mac**: `v0.5.25` tag → Windows CI green
→ `./release.sh`. macOS universal DMG notarized + stapled (Apple: Accepted);
Windows installer signed locally with the real minisign key; `latest.json` carries
all three platforms (`darwin-aarch64`, `darwin-x86_64` → the one universal bundle,
`windows-x86_64` → `-setup.exe`), every updater URL verified **HEAD 200**.
673 frontend tests + 102 backend tests green.

Everything through **0.5.25** is now live (the earlier 0.5.21–0.5.24 backlog all
shipped in prior Mac releases).

## Website

Current at **0.5.25** (version pill + footer bumped, demo gen updated on the VM).

## Machine boundary (standing rule)

- **Ubuntu VM — all dev work** (coding, content/asset work including website edits
  + screenshot regeneration, pushing the `vX.Y.Z` tag).
- **Mac — only signing and shipping** (`./release.sh` needs Xcode + Apple
  notarization/signing creds). On the Mac, it's to ship — nothing else.

> Note: 0.5.25 landed on `main` from the VM while a Mac shipping session was open,
> and the VM's commits left `handoff.md` + `session-state.json` narrative fields
> still describing 0.5.24. Corrected here as part of the 0.5.25 release. When the
> VM and Mac are both touching `main`, re-pull before editing pipeline files.

## Roadmap — Up Next (pick a lane, build on the VM)

- Mobile app
- Accessibility / clarity / simplification
- Windows code signing (remove the SmartScreen "unknown publisher" prompt)

No pending Chronicler or deploy step. Clean slate for the next lane.
