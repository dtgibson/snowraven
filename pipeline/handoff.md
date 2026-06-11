# Handoff — missing-hotspot-pins (fix) — PAUSED after the GitHub push, handed off to the Mac for the release

## What We Accomplished

Built and pushed-to-GitHub the v0.5.30 fix release, the full 6-stage fix flow on
this Linux box — two map fixes after a user-approved Stage 3 scope expansion:

1. **Hotspot pins (the reported bug).** Teardrop sprites could silently never
   register: the `isStyleLoaded()/once('load')` gate waited on MapLibre's
   once-per-map-lifetime `load` event whenever a search landed during tile churn
   (base-layer switch, pan, slow network) — latent since 0.5.16, intermittent
   because a theme flip or remount self-healed it. Fixed in HotspotMarkers.tsx and
   AtlasLayer.tsx (same pattern, hatch sprites) with unconditional registration plus
   per-component `styleimagemissing` safety nets (owned hardcoded ids only,
   hasImage-guarded, removed on unmount). A deterministic Playwright repro proved
   the bug and the fix.
2. **Pins→Heatmap crash (found by QA's regression walk, in shipped 0.5.29).** The
   mode toggle mutated a react-map-gl `<Source>` id in place, which MapLibre
   forbids — the whole app crashed to the error boundary. Fixed by keying the two
   branch Sources in map/SightingMarkers.tsx; the new regression test was proven to
   fail against pre-fix code.

QA FINAL PASSED (repro twice, 31/31 live walk, heatmap-under-atlas contract intact,
Species Detail untouched); security clean pass, zero findings; 774 frontend + 110
backend tests green. Two standing map conventions promoted to CLAUDE.md. The
release itself has NOT run — that happens on the Mac.

## What Has Been Saved

- The release commit on `main` (both fixes + three new test files, version files at
  0.5.30, CHANGELOG with two Fixed lines, website pill/footer, DECISIONS /
  ROADMAP / CLAUDE records, this handoff + session-state). The `v0.5.30` tag points
  at it and triggers Windows CI, the test Pipeline, and the Pages redeploy.
- Pipeline artifacts (bug-brief, qa-report, security-report) under
  `pipeline/missing-hotspot-pins/`, intentionally untracked per the established
  pattern.

## Where We Are

Stage 6 of 6 (The Chronicler) — records done and pushed (chronicle-before-push).
The ONLY thing left before closeout is the Mac release: wait for Windows CI green,
run `./release.sh`, verify the in-app updater sees 0.5.30, author the
`chore(pipeline): mark 0.5.30 released` closeout commit. Paused here, handed off.
(See the `release-sequence` and `dev-machines` memories.)

## Resume Prompt

To resume: run `/weft` in this project AFTER the Mac has shipped 0.5.30 and Dave
confirms it's live and the updater sees it — at which point this Linux box `git
pull`s the Mac's closeout commit and the fix is done.

---

Project snowraven, fix `missing-hotspot-pins` (sessionType "fix"). Stages 1-5
approved; the GitHub push is done — the release commit and tag `v0.5.30` are on
`main`. Paused awaiting the Mac release (`release.sh`), not run from this box. The
Mac authors the mark-released closeout commit; on resume after Dave confirms it's
live, `git pull` to sync it down — the fix is then shipped. Load
`pipeline/session-state.json` first.
