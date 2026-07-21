## What We Accomplished

Shipped **v0.5.71**: backported the Named Birds non-destructive inline-embed
resilience to Species Detail's Recent Media, and added a Macaulay Library
info + attribution row beneath each player. A slow, broken, or offline
recent-media embed now shows a loading shimmer then a non-destructive
placeholder with a link to the recording (recovering on reconnect) instead of a
dead frame, and each of the three players (photo/audio/video) shows its capture
date, a link that opens that asset on the Macaulay Library (the required credit
plus a way to view/play it), and its eBird checklist.

The resilient frame/fallback/shimmer primitives were extracted to a shared
module (`components/MediaEmbed.tsx` + `lib/mediaEmbed.ts`); Named Birds now
shares them (behavior byte-identical, its suite green). Species Detail's Recent
Media is a new, testable `components/RecentMediaEmbed.tsx`. The three players use
one uniform full height (`.sr-media-iframe--recent`) so they match and the audio
controls fit -- a live-review finding (the compact 116px audio clipped the
Macaulay player's controls). Named Birds kept its shipped compact grid.

Also acted on a docs review: its High/Med findings were false alarms (they
rested on a `master` branch that does not exist; `main`'s docs are current
through 0.5.70). The real items shipped: HELP's two "eBird backup powers these
tabs" lists now include Calendar/Named Birds/Checklists, an OpenWeather "needs a
payment card" note (HELP + README), and the repo's About -> website field was set.

## What Has Been Saved

- **Shipped and live.** Desktop **v0.5.71** -- GitHub release with the notarized
  universal macOS DMG, the signed Windows installer, the updater bundle, and
  `latest.json` (version 0.5.71; darwin-aarch64 + darwin-x86_64 + windows-x86_64).
  iOS **0.5.71 build 1** uploaded to TestFlight (altool: UPLOAD SUCCEEDED).
- Feature commit `8c9c988` (code + version bump 0.5.70->0.5.71 + CHANGELOG +
  HELP/README/website) on `main` and tagged `v0.5.71`. This closeout adds the
  records commit (DECISIONS, ROADMAP, CLAUDE.md, the change-brief, pipeline
  state) plus the iOS 0.5.71 Info.plist version stamp.
- New reusable module: `components/MediaEmbed.tsx` + `lib/mediaEmbed.ts` (the
  shared inline-embed resilience) and `components/RecentMediaEmbed.tsx`. Locked
  by `MediaEmbed.test.tsx` + `RecentMediaEmbed.test.tsx` (the attribution row).

## Where We Are

Improvement complete and shipped. Pipeline is idle. PRODUCT_CONTEXT was left
unchanged (a refinement of an existing surface, not a new capability). One
follow-on was recorded: Named Birds' compact audio embeds have the same
control-clipping the Species Detail work fixed (its per-format grid is
unchanged) -- a targeted future tweak. The earlier deferred items (iOS offline
maps; confirm native pinch on the Breeding Codes matrix on a real iPhone) remain
on the roadmap.

## Resume Prompt

Run `/weft` to start the next thing.
