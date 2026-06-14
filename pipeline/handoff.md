# Handoff — Nearby Lifers RELEASED; v0.5.35 live on both platforms (build-blocker fixed on the Mac)

## What We Accomplished

Released v0.5.35. **Nearby Lifers** was built and Chronicled on the VM
(commit `9fa2376`, tag `v0.5.35`) and pushed. This Mac session pulled and
found the VM's 0.5.35 build was **broken** — both Windows CI runs for the
tag failed on a TypeScript error. We fixed it, re-tagged, waited for a
green CI run, then ran `./release.sh` and verified the release live.

Nearby Lifers moved off the Statistics tab into a new (4th) Map Explorer
section: recency-colored, location-grouped labeled pins of recently
reported species you've never recorded, a mirroring in-view list, the
standard location chooser, and a new shared **Time Range** filter (last
day / week / 30 days) also added to Media Targets. Built on the eBird
data the app already uses; privacy posture unchanged.

## The build blocker (fixed this session)

The VM reported "build clean," but its checks missed a real failure:
`buildNearbyLifers` carried an unused `nowMs` parameter guarded only by
`// eslint-disable-next-line @typescript-eslint/no-unused-vars`. That
silences ESLint but **not** the TypeScript compiler — `tsc`'s
`noUnusedParameters` rejects a trailing unused parameter (TS6133). vitest
(esbuild, no type-check) and ESLint passed, but the real production build
(`npm run build` = `tsc -b && vite build`) failed:

```
src/lib/nearbyLifers.ts(41,3): error TS6133: 'nowMs' is declared but its value is never read.
```

Both Windows CI runs for the tag (`9fa2376`, and the pre-rebase
`375c784`) failed this way; it would also have failed the macOS
`release.sh` build. **Fix** (commit `7af29d5`): removed the dead
parameter, its `MapExplorer` call site (which dropped a needless
`Date.now()`), and the test's now-unused `NOW` const. Verified on the
Mac: `npm run build`, `npm run lint`, and **911/911 vitest** all green.
Added a CLAUDE.md note so the production build — not just vitest/lint — is
the pre-push gate.

## How We Released

1. Committed the fix (`7af29d5`), pushed `main`, force-moved the
   `v0.5.35` tag to `7af29d5`.
2. New Windows CI run `27512712253` went green; verified its `headSha ==
   7af29d5 ==` the tag commit `==` `release.sh`'s most-recent-success
   selection (the tag-re-push guard) **before** releasing.
3. Ran `./release.sh` from the Mac.

## Where We Are

Released and verified live. `main` / `origin/main` / tag `v0.5.35` all at
`7af29d5`. GitHub release `v0.5.35` is published, marked Latest (not
draft/prerelease), target `main`, published 2026-06-14T21:50:27Z. All 6
assets return HTTP 200. macOS notarization Accepted (Apple submission
`1fefdeba`) + stapled. `latest.json`: version 0.5.35, `darwin-aarch64` +
`darwin-x86_64` → the one universal updater bundle (same sig),
`windows-x86_64` → `SnowRaven_0.5.35_x64-setup.exe`. Pipeline idle.

## Open / Optional

- Optional: confirm the in-app updater picks up 0.5.35 by opening the app
  (latest.json is correct, so detection is ready).
- ROADMAP Up Next: mobile app; Windows code signing.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
