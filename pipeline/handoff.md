## What We Accomplished

Made the **Breeding Codes matrix comfortable to read on a phone** (v0.5.69,
frontend-only). The species-by-breeding-code matrix's dense code columns now
narrow to ~30px dot-width columns at the phone tier (with 0.625rem headers),
thin vertical rules separate the columns, the species-name column stays fixed
on the left while the codes scroll sideways, and magnification is native
viewport pinch (no in-app zoom control).

The approach was settled over **4 live-verified revisions** at the Engineer
gate. Notably, a frozen title row over a capped-height, internally-scrolling
data-grid was built and live-tested, then **reverted at your request** in favor
of a natural full-height table that scrolls with the page (with the tier legend
in normal flow after the last row). The reason is now recorded: pure CSS can't
combine a page-frozen header + an unbounded-height table + contained horizontal
scroll on a phone — `overflow-x:auto` forces the vertical axis closed, which
binds a sticky header to the wrapper instead of the page — so a frozen header
requires the capped box, and you chose the natural table. Native pinch (not a
CSS zoom) mirrors the earlier v0.5.64 ZoomableWideSurface reversal: CSS zoom is
unreliable in the desktop/iOS WebView.

## What Has Been Saved

- **Shipped and live.** Desktop **v0.5.69** — GitHub release with the notarized
  universal macOS DMG, the signed Windows installer, the updater bundle, and
  `latest.json` (the in-app updater sees it). iOS **0.5.69 build 1** uploaded to
  TestFlight (altool accepted; processing in App Store Connect).
- Feature commit `6da3645` (code + version bump 0.5.68→0.5.69 + CHANGELOG +
  HELP/README/website) already on `main` and tagged. This closeout adds the
  records commit (CLAUDE.md, PRODUCT_CONTEXT.md, DECISIONS.md, ROADMAP.md,
  design-system.md, the feature's pipeline artifacts) plus the iOS 0.5.69 build-1
  Info.plist version stamp.
- **Two durable conventions recorded in CLAUDE.md:** (1) the Breeding Codes
  matrix is a natural full-height page-scrolling table with dot-width phone
  columns single-sourced in `.sr-bc-code-col` and native-pinch magnify — not a
  frozen-header capped data-grid (with the empirical CSS reason in DECISIONS);
  (2) a real gap in the iOS build recipe — `tauri ios build --export-method
  app-store-connect` needs the App Store Connect API key under Tauri's own env
  names (`APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_PATH`), distinct
  from the `altool` upload creds (hit + fixed on this iOS build). The reusable
  "Phone wide-table" pattern is folded into `pipeline/design-system.md`.

## Where We Are

Feature complete and shipped. Pipeline is idle.

One open thread: **QA-11 — confirm native pinch-to-zoom on the matrix on a real
iPhone.** The narrowing itself is the core win and works regardless of pinch, but
the pinch-to-magnify behavior is worth an on-device eyeball; iOS 0.5.69 build 1
is on TestFlight for exactly this. If pinch disappoints, the Designer reserved a
`−/Fit/+` fallback control (iOS-only, a one-line flip) as the escape hatch. This
and the earlier deferred items (iOS offline maps; the Species Detail embed
offline-fallback backport; the v0.5.68 Calendar mobile layout still worth an
eyeball on a real phone) are on the roadmap.

## Resume Prompt

Run `/weft` to start the next thing.
