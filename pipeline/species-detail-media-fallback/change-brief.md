# Change Brief — Species Detail Media Fallback

## What is changing
The Species Detail tab's "Recent Media" section (up to three Macaulay Library
embeds: the most recent photo, audio, and video) currently renders bare
`<iframe>`s with no resilience. A slow, broken, or offline embed shows a dead or
blank frame, never recovers, and offers no link-out. This backports the
non-destructive fallback already shipped on the Named Birds tab (v0.5.66): a
loading shimmer, a 20s give-up overlay that keeps the iframe mounted (so a late
load still wins), an offline placeholder keyed to reconnection, and a "View on
Macaulay Library" link-out. The resilient-frame primitives (`MediaFrame` /
`MediaFallback` / `MediaShimmer`) are extracted from `NamedBirdMedia.tsx` into a
shared module so both surfaces share ONE implementation, not a second copy. The
Species Detail iframe also gains the `^\d+$` id guard + `encodeURIComponent`
wrap the security contract requires (the Named Birds embed already has it).

Two doc-accuracy fixes ride along (from a July 2026 docs review): HELP.md's two
"the eBird backup powers these tabs" summary lists are corrected to include
Calendar, Named Birds, and Checklists (they omit them today; the README list is
correct), and a one-line note is added where OpenWeather setup is described,
that activating "One Call by Call" requires a payment card on file even under
the free tier.

## Why now
The Species Detail backport was explicitly deferred out of v0.5.66 (Species
Detail was out of scope then) and recorded as a noted candidate on the roadmap
and in DECISIONS.md. Now that the reusable pattern exists, it is a low-risk
follow-on. The doc fixes come from a docs review (findings #5 and #7); its
higher-priority findings were false alarms (a non-existent `master` branch) and
are out of scope.

## User-facing impact
On Species Detail, a slow/broken/offline recent-media embed now shows a shimmer
then a graceful placeholder with a link to the asset on Macaulay Library,
instead of a dead frame, and recovers in place when the connection returns. A
working embed is unchanged, and which media appears is unchanged. Docs: HELP's
backup-powered-tabs lists and the OpenWeather setup note become accurate.

## Design pass
Not needed. This reuses the already-shipped Named Birds fallback design
(shimmer, placeholder, link-out) with no new visual design, only applying an
existing one plus resilience logic. The doc changes are copy accuracy.

## Decisions touched
- v0.5.66 "Named Birds Media" (DECISIONS.md, 2026-07-05) — this FULFILLS that
  entry's explicitly-noted Species Detail backport candidate (`MediaFrame` +
  `useOnline`). No reversal; the extraction promotes the shared primitives to
  one module. The Chronicler marks the backport done.
- No other decision is reversed. PRIVACY_POLICY already lists Species Detail as
  an embed surface (pre-existing), so no privacy change.

## What done looks like
- Species Detail recent-media embeds show shimmer, then a non-destructive
  fallback overlay (with ML link-out) on give-up/error, plus an offline
  placeholder that recovers on reconnect; a late-loading embed still swaps in.
- Id guard + `encodeURIComponent` applied; `NamedBirdMedia.test.tsx` stays green
  after the extraction; new Species Detail media tests cover the
  fallback/offline/late-load paths.
- HELP.md backup lists include Calendar/Named Birds/Checklists; OpenWeather card
  note present in README + HELP; no em dashes in new copy. Version bumped,
  CHANGELOG + website synced.
