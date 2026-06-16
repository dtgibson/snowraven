# Decisions

Project-level decisions, bug post-mortems, and meaningful reversals recorded here.

---

## Statistics media-card behavior links + a countable-life-list coverage fix — 2026-06-16 (v0.5.38)

**What:** On the Statistics → Media card, each behavior count now links to the Macaulay Library catalog filtered to that behavior for the user, each breeding behavior is listed and linked on its own, the tab's catalog links were consolidated onto one host, and the media documentation-coverage denominator was corrected to stop counting non-countable forms. Frontend-only; no new providers; privacy unchanged.

**Decisions worth keeping:**

- **ML behavior catalog links use `media.ebird.org/catalog?userId=<id>&tag=<slug>`, and the slug is a FIXED, live-verified lookup — not derivable from the label.** `Flying`→`flying_flight`, `Mechanical Sound`→`non_vocal`, `Preening, Scratching, or Bathing`→`preening`, `Courtship, Display, or Copulation`→`courtship_display_or_copulation` show the slug is not a transform of the display label, so `BEHAVIOR_TAG_SLUG` (`lib/mediaStats.ts`) is hardcoded and verified against the live catalog UI (each tag rendered its expected removable-filter label). Behavior and sound-type tags share the one `tag=` param. An unmapped behavior renders as plain text, never a broken link.
- **Statistics catalog links consolidated onto `media.ebird.org/catalog`, finishing (Statistics-side) the consolidation the v0.5.33 decision deferred.** `lib/statsFormat.ts` `mlCatalogUrl` moved off the legacy `search.macaulaylibrary.org/catalog`; the Multimedia tab already used the new host. SpeciesDetail's `lib/mlCatalog.ts` still uses the legacy host (out of scope here) — a remaining consolidation candidate. Both hosts resolve, so this is consistency, not a fix.
- **Each breeding behavior is linked individually and de-duplicated from the top list.** The three breeding tier tiles (species counts) stay as a summary; below them each breeding behavior the user has is its own link. When that breeding list shows (userId present), breeding behaviors are removed from the top "Behaviors documented" list so each appears once; with no userId there is no breeding list, so they remain in the documented list (unlinked).
- **A "life-list COUNT" must exclude spuh/slash/hybrid — new shared `isNonCountableSpecies` (`lib/speciesUtils.ts`).** The media documentation-coverage denominator ("X of N life-list species documented with media") was counting every distinct observed name, including `sp.`/slash/hybrid forms, so N overstated the life list (the user caught it: "more than my life list"). Fixed inside `computeMediaStats` (pure/testable) by filtering the passed name-set through `isNonCountableSpecies` for both the denominator AND the numerator. `backboneNames` (which also drives Species-Detail linking and correctly contains every recorded name) is left untouched — the fix is isolated to the coverage computation. `isSpuhOrSlash` deliberately omits hybrids (it is the display-filter primitive), so `isNonCountableSpecies` (= `isSpuhOrSlash || " x "`) is the canonical countable-life-list predicate. A parallel audit of `birdingStats.ts`/`speciesStats.ts` confirmed no other stat had the same overcount — every other species count already runs on filtered observations.

**Scope note:** the coverage-denominator fix was a user-approved scope expansion folded into this Improve lane (the work was already on the Statistics page); recorded so the two-part diff doesn't read as scope creep. The breeding-links shape (per-behavior, not the tier tiles) and the dedup were also user follow-ups on review.

**Implications:** New ML catalog links use `media.ebird.org/catalog` + the `BEHAVIOR_TAG_SLUG` map (don't guess slugs — verify against the live catalog). Any "life list" COUNT uses `isNonCountableSpecies`, not bare `isSpuhOrSlash`. The accessible name of a count-link leads with the visible count (the `ChecklistLink`/WCAG-2.5.3 convention), set via `BarRow`'s `linkLabel`. Promoted to CLAUDE.md.

---

## Mobile-responsive sweep: generalized the CSS-class responsive system; two hidden-element page-scroll lessons — 2026-06-16 (v0.5.37)

**What:** An exhaustive responsive pass so every screen flows from ~320px phones to large desktops with no overlap and no sideways page scroll, in preparation for the mobile app. The app was inline-styled with a single `@media (max-width: 640px)` block reaching five class names; this generalized it into a small shared class vocabulary + breakpoint tiers, then migrated ~35 components to it. Also deleted the dead Vite-template `index.css` and `App.css` (never imported — only `globals.css` is).

**Decisions:**
- **Do responsive layout by LIFTING to a class, never inline.** React inline styles are specificity 1,0,0 and beat class rules, and inline grids/flex can't be media-queried (the long-standing reason `.sr-two-col` etc. exist). New `globals.css` hooks: `.sr-action-row` (wrapping label+action row), `.sr-grid-2/-3/-4` (collapse 3/4→2 at ≤1024, all→1 at ≤640), self-collapsing `.sr-grid-auto`, `.sr-grid-chart-aside`, `.sr-field-row` (stacks native date inputs ≤480), `.sr-scroll-x` (contained wide-table scroll; carries `min-width:0` + `position:relative`), leaf helpers `.sr-min0/.sr-truncate/.sr-wrap-anywhere`, `.sr-pad-x-trim`, `.sr-map-explorer-panel`. Tiers: ~480 (small phone), 640 (existing boundary, unchanged), ~1024 (tablet), plus a `.sr-panel` max-width cap (1280px, centered) for large desktops.
- **A `position:absolute` element wider than the viewport leaks PAGE horizontal scroll on phones even when invisible.** Two real (pre-existing) phone overflows were fixed: (1) TabNav's overflow-measurement PROBE (`visibility:hidden`, the full bar at natural width) scrolled every page sideways — now wrapped in a zero-height `overflow:hidden` box (the inner probe still reports `scrollWidth` for the collapse decision); (2) absolutely-positioned `.sr-only` spans inside a horizontally-scrolled table (the breeding-code matrix) escaped the scroll wrapper until it was made `position:relative`. **Standing check:** any wide/`max-content` element or off-screen measurement node must sit under an `overflow:hidden`/`position:relative` ancestor so it can't extend `document.scrollWidth` on a phone.

**Touched, not reversed:** the responsive-nav dropdown (kept its ResizeObserver overflow-collapse — no JS window checks added), the Map Explorer mobile-overlay rules (class-toggled `display` + z-index 1200 preserved), the table `wideMode`/`max-content` pattern (reused, not refactored), and the in-app text-scale (sizing stays rem-based — no rem→px). Extended, not changed.

**Known limitation:** at 200% in-app text size the Statistics tab still scrolls ~34px sideways at 360px (dense filter-pill rows don't re-wrap at doubled text); every screen is clean at normal text size. Accepted by the user rather than reworking those rows. See `pipeline/mobile-responsive-sweep/qa-report.md`.

**Implications:** Future responsive work uses these class hooks + tiers — do not re-introduce inline responsive layout. Wrap any new wide table in `.sr-scroll-x`. The full per-screen audit + fix list is in `pipeline/mobile-responsive-sweep/responsive-audit.md`.

---

## Frivolous Lists: lexicographically-greedy max-matching for the rainbow, whole-word color matching, and favicons-on-unseen via the existing taxonomy batch — 2026-06-15 (v0.5.36)

**What:** A playful "Frivolous Lists" section at the bottom of Statistics — Avian American (22), California Dreamer (7), and Rainbow Warrior (7 colors) — computed entirely from the loaded eBird backup. Frontend-only; no new providers; privacy unchanged.

**Decisions worth keeping:**

- **Rainbow Warrior assigns birds to colors by a lexicographically-greedy MAXIMUM bipartite matching, not a per-color earliest pick.** The user's rule is "show the first bird of each color, but avoid using one bird for two colors when an alternative exists." A naive per-color earliest pick doubles a shared bird (e.g. Violet-green Swallow for both violet and green) even when a distinct bird is available. The algorithm maximizes DISTINCT birds first (minimize doubles); among max-distinct assignments the higher-priority (spectrum-order) color keeps its earliest bird; a bird fills two colors only when a color has no other candidate, and then it shows that color's EARLIEST bird (not a later "distinct" pick that merely relocates the double). Determinism comes from a total-order candidate sort (date, submissionId, commonName).
- **Color matching is whole-word, case-insensitive (`/\bCOLOR\b/i`), non-global.** "Red-tailed Hawk" fills red; "Reddish Egret", "Black Redstart", "American Redstart", "Common Yellowthroat" do not. One bird may fill multiple colors (Violet-green Swallow → violet + green). Non-global so `.test()` is stateless (no shared `lastIndex`, per the 0.5.27 regex-hygiene rule).
- **Verified by a brute-force oracle, which caught three bugs example-based tests missed.** An adversarial verification (an independent oracle enumerating the lexicographically-minimal max-distinct assignment over thousands of random inputs) found non-determinism on date+submissionId ties, a higher-priority color bumped onto a later bird, and a forced-double showing a later bird than its earliest — all fixed and regression-tested. Worth repeating for any non-trivial pure combinatorial/assignment logic.
- **Favicons on not-yet-seen birds via the existing `/taxonomy/codes` batch.** The 29 hardcoded names are added to the batch `BirdingStats` already sends; the endpoint resolves by common name in both the web (FastAPI) and Tauri (TS) transports and reads the live taxonomy, so unseen rows show the eBird/BoW favicons (still no Species Detail link) and recent splits resolve. No new request.
- **The lists reflect the ALL-TIME life list,** independent of the Statistics tab's "include spuh" toggle — "have you ever seen this?" is an all-time question. Hardcoded lists use current canonical eBird names only; a pre-split export won't tick until re-downloaded (no legacy alias map in v1).
- **Seven new `--sr-rainbow-*` swatch tokens** (both themes) for the color dots — a deliberate, logged design-system extension (folded into design-system.md); decorative (the color NAME is the accessible text), so not held to text contrast.

---

## Nearby Lifers Map: lifers as a Map Explorer section keyed on location, the recent-obs route reused with optional codes, and a shared Time Range filter — 2026-06-14 (v0.5.35)

**What:** A new Map Explorer section that maps WHERE species the user has never recorded were reported recently near a chosen point — labeled, recency-colored pins, not a flat list. The old "Nearby Lifers" list was removed from the Statistics tab and rebuilt here. Built entirely on eBird data the app already uses; no new providers, no privacy change.

**Decisions worth keeping:**

- **Nearby Lifers moved from Statistics to its own Map Explorer section, with location as the unit.** The old flat list answered "which lifers are near me"; the map answers "where were they reported." Each spot is one labeled pin showing the species name, or "{n} species" where several lifers were reported at one place; clicking a pin (or a row in the panel list) shows the lifers with dates and eBird checklist links. It opens on the saved default location and carries the same controls as the other map sections — use my location, place-name search, radius — plus the new Time Range filter. Lifer names render plain + favicons (NOT a Species Detail link) because they are not in the user's recorded data.
- **Reused `/map/recent-obs` by making its `codes` param optional, rather than a new route.** With `codes` empty the route returns all species in the radius (eBird `data/obs/geo/recent`); the life list is subtracted CLIENT-SIDE to leave only lifers. The now-dead `/stats/nemesis` route — which stripped coordinates the map needs — was retired in favor of this.
- **Each lifer appears at its single most-recent location — accepted, not a defect.** eBird's `data/obs/geo/recent` returns one record per species (the most recent sighting in range), so a lifer reported in several spots shows only its newest. This is the endpoint's contract, kept deliberately rather than fanned out into per-species lookups.
- **One shared "Time Range" filter (last day / last week / last 30 days) on BOTH Nearby Lifers and Media Targets.** Adding the control to Nearby Lifers, the same filter was given to the existing Media Targets section so the two panels behave identically.
- **Restored lat/lng/dist bounds on `/map/recent-obs`.** These had been lost when `/stats/nemesis` was deleted; the recent-obs route now re-enforces them.

---

## Weather & Tide — Current & Predict: one base forecast call, tiered slice reusing the existing formatter, and an honest weather/tide horizon gap — 2026-06-13 (v0.5.34)

**What:** Two new lookups at the bottom of the Weather tab — Current (live weather + tide for the device location) and Predict (forecast weather + predicted tide for a chosen place/date/time) — that bypass the eBird checklist. Backend + frontend; no new providers.

**Decisions worth keeping:**

- **One base OpenWeather One Call 3.0 request serves current + the whole forecast.** The "One Call by Call" subscription already in use for the historical `timemachine` ALSO returns `current` + `hourly` (48h) + `daily` (8d) from the base `onecall` endpoint — confirmed live, not just from docs. A pure tier helper (`pick_forecast_slice`) picks current/hourly/daily/out-of-range, and an adapter maps the chosen slice into the timemachine `{data:[hour]}` shape so the EXISTING `format_weather`/`formatWeather` builds the copy block (byte-consistent, no second formatter). Daily passes two synthetic temp points (min,max) → the block reads as a low–high range. The tier helper + adapter are duplicated TS↔Python with parity tests over identical fixtures, the same posture as the moon-phase port.
- **The weather/tide horizon gap is shown honestly (Dave's call: tide runs ahead).** Weather is capped at the provider's real ~8-day horizon (hourly ≤48h, a clearly-labeled DAILY summary 48h–8d); beyond that, weather is omitted with a "no forecast reaches this far" note while the tide — astronomical, predictable far ahead — still shows. Never an extrapolated forecast.
- **New geo+time routes, declared before the checklist routes.** `GET /weather/at` and `GET /tide/at` take lat/lng/time directly and MUST be declared before the `{checklist_id}` routes (FastAPI matches in order) and matched before the `/weather/`/`/tide/` prefixes (TS transport), or "at" is captured as a checklist id. Tide reuses the whole existing pipeline unchanged; future NOAA predictions already work (labeled "Predicted").
- **Current resolves "now" in the LOCATION's timezone, not the device's.** A verification bug (this UTC dev box showed UTC) led to making `/tide/at`'s `dt` optional (server defaults to location-tz now) and formatting the Current label from the tz the weather response returns — so Current is correct regardless of the device/browser timezone.

**Bug post-mortem (found in verification):** the vite dev proxy was missing `/tide`, so in vite-dev `/tide/at` — and, latently, the EXISTING checklist tide — hit the SPA fallback instead of the backend. Invisible until now because the tide path is normally exercised via the desktop app or the FastAPI-served build, not vite-dev. Added `/tide` to the proxy. **Standing lesson:** a new backend route's path prefix must be added to `frontend/vite.config.ts`'s proxy.

**Known minor (kept deliberately):** the copy-ready block reuses the shared tide formatter, so a tide that turns inside the 1-hour Current/Predict window reads "(turned during your checklist)" even though there's no checklist; kept for byte-parity with the checklist block (the on-screen summary uses "(turning)"). Dave reviewed and chose to keep it.

**Out of scope (v1):** multi-hour/multi-day forecast windows or comparison (single moment only), saved/favorite locations, alerts/notifications, "best time to go" ranking.

---

## Multimedia sex & age filters: one substitution point, exact-combo that the ML link also honors — 2026-06-13 (v0.5.33)

**What:** Sex (Male/Female) and Age (Juvenile/Immature/Adult) dropdown filters on the Multimedia tab (`LifeList.tsx`), built on the per-asset Age/Sex already parsed for the media stats. Frontend-only.

**Decisions worth keeping:**

- **One substitution point.** The facet is applied by projecting each species' `catalogIds` to the facet-matching subset (and dropping zero-match species); every existing count/filter/sort over `catalogIds` then becomes facet-aware with no further change, and the no-facet path is byte-identical to before (regression-safe). `assetMatchesFacet` + `buildCatalogAgeSex` live in `lib/mediaStats.ts` beside the parser.
- **Exact-combo matching (Dave's call), and the ML link agrees.** A single facet is broad (Female = any female of any age); both set requires one individual that is both (Juvenile + Female = a juvenile female). The Macaulay catalog applies `&age` + `&sex` the SAME way — it filters to media depicting an individual that is both (confirmed against the live catalog via user-provided links) — so the in-app count and the link agree. (An earlier assumption that ML treats the facets independently was wrong and was corrected.)
- **The Multimedia ML catalog links use `media.ebird.org/catalog` with lowercase `&age` / `&sex`.** That is the base where the age/sex params are confirmed; it is the same Cornell Lab/eBird media search already in the privacy disclosure. `BirdingStats` still uses the older `search.macaulaylibrary.org` base — consolidating the two link builders is a future candidate, not done here.

**Out of scope:** no new data / export / parser changes; untagged media is excluded from a facet (no "Unknown" option); no in-app gallery (the tab stays counts + links).

---

## Accessibility follow-ups: the ChecklistLink rollout finished, an OutboundLink wrapper, and the records caught up to what already shipped — 2026-06-13 (v0.5.32)

**What:** Closed the three cross-cutting accessibility items 0.5.31 had left as Known Exceptions, and corrected the records that misdescribed them. No user-facing feature change.

**Decisions worth keeping:**

- **`ChecklistLink` is the single affordance for every "open checklist on eBird" link, app-wide.** The 14 remaining hand-rolled links across 7 files (Species Detail header stats + comments, Named Birds rows, the Statistics tab, the media stats, the map popups) were folded in. It gained a `compact` (icon-only) mode for dense spots (species pills, location cards, a fixed-width stats column, the map target popup) and a **label-aware accessible name**: with a visible date/count it leads `{label} — open checklist on eBird (opens in a new tab)` (WCAG 2.5.3 Label in Name, so Voice Control can activate it by what's on screen); with no label it names the id directly; the functional suffix is identical everywhere (WCAG 3.2.4). This also fixed a latent 2.5.3 regression — the Checklists-tab date link, moved onto `ChecklistLink` in 0.5.31, had stopped leading its name with the visible date.
- **`components/OutboundLink.tsx` is the standard wrapper for every NON-checklist external link.** It guarantees `target="_blank"` + `rel="noreferrer"` and an "(opens in a new tab)" cue (a clean spaced `aria-label` from string children / explicit label, else an `.sr-only` cue node for JSX children). Named `OutboundLink`, NOT `ExternalLink`, deliberately — `ExternalLink` is lucide-react's icon, imported widely, and the names would collide. New-tab wording was standardized to "(opens in a new tab)" app-wide (the codebase had mixed "a new tab" / "new tab").
- **Informative tooltips are kept, not sacrificed for consistency.** Standardizing the media "busiest day" link onto `ChecklistLink` briefly dropped its "largest checklist of N that day" hint; it was restored via a new optional `title` pass-through on `ChecklistLink` (sighted-hover only — the screen-reader name stays canonical). Standing preference: don't drop a useful tooltip to make a component uniform.

**Correction / reversal:** F082/F106 (the Southern-Hemisphere moon-phase emoji) was wrongly recorded in 0.5.31 as a deferred follow-up "scoped out rather than half-done." It was never deferred — the latitude-correct mirroring already shipped in **0.5.28** (`lat < 0 → MOON_SOUTH`, latitude threaded to both formatters, both hemispheres locked by the byte-golden tests). The deferred note below is corrected accordingly. F064 and F078 are now fully shipped, not partial.

---

## Accessibility pass: a contrast-token system, single-close-path focus restore, and the verification loop that caught two false published claims — 2026-06-12 (v0.5.31)

**What:** A comprehensive WCAG 2.1 AA accessibility pass across the whole
frontend. A four-phase, ~160-agent audit (inventory → 12-dimension parallel
audit including *computed* contrast over every `--sr-*` token pair actually used
together, both themes, plus an axe-core runtime scan → adversarial verification →
completeness sweep) found **107 confirmed findings (1 critical, 17 serious, 48
moderate, 41 minor) against 288 verified passes**, then fixed them. The headline
result was not a bug but the published statement: `ACCESSIBILITY.md` made five
claims the code contradicted — the same liability as a stale privacy policy — and
the lane's hard requirement was to end with the statement true.

**Decisions worth keeping:**

- **Contrast is fixed at the token, with a typed naming system — not per
  component.** `globals.css` gained a vocabulary that distinguishes three
  text-on-X cases, every token minted in BOTH themes (parity machine-checked):
  `--sr-tier-N-fg` = tier-colored text ON an 8–15% tier tint; `--sr-tier-N-text`
  = text ON the solid tier fill; plus `--sr-map-target-*-text`,
  `--sr-border-input` (form-control boundaries, ≥3:1 non-text), `--sr-milestone-*`,
  `--sr-rank-pin-*`, and `--sr-on-chart-blue-dark`. Retunes (`--sr-accent`,
  `--sr-text-muted`, `--sr-error`, `--sr-graph-audio`, `--sr-gray-400`) fixed
  whole classes of sites with zero component change. The fill palette
  (`--sr-tier-N` / `-rgb`) was deliberately left untouched so the atlas/hatch
  parity stays safe — text colors are a separate concern from fill colors.
- **`--sr-text-disabled` is for genuinely disabled CONTROLS only** (WCAG-exempt);
  informative and empty-state text must use `--sr-text-muted`. The empty
  date-input format text using `text-disabled` was an actual failure, fixed in the
  Tester round. The token now carries an inline comment saying so.
- **`--sr-on-chart-blue-dark` is theme-aware because a light-vs-dark fill needs
  OPPOSITE text colors** (post-fleet catch + Tester corroboration). The
  "complete checklists" meter — the one in-bar percentage label left in the app —
  printed text on a blue fill that is light in light theme (`#1D4ED8`) and a
  lighter blue in dark (`#3B82F6`); white passes on the former (6.70) but only
  3.68 on the latter, while near-black passes on the latter (5.38) and fails the
  former. No single value could pass both, so the token is `#FFFFFF` light /
  `#0A0A0A` dark. A false `ACCESSIBILITY.md` sentence claiming bars "no longer
  print percentage figures inside their saturated fills" was reworded to describe
  the actual behavior (the figures read from an adjacent label everywhere except
  this one meter, whose color is now AA in both themes).
- **One close path that restores focus — for every overlay close affordance.**
  The Map Explorer mobile filter panel's published claim ("Escape … returns
  focus to the button that opened it") was true only for Escape; the Close
  button and the backdrop stranded focus on `<body>`. The Tester caught a
  regression of exactly this after the fleet's first pass. Fix: all three close
  affordances route through one `closeSidebar`, and because the Filters button
  unmounts while the panel is open, the restore runs in an effect AFTER the close
  render commits (a `restoreFiltersFocusRef` flag), not at close() time when the
  ref is still null. Escape on fullscreen returns focus to the fullscreen toggle
  the same way. Standing contract for any new overlay.
- **`inert` on a decorative recharts wrapper — recharts ignores
  `accessibilityLayer={false}` on `PieChart`.** The donut's root `<svg>` stays
  focusable regardless, leaving an axe aria-hidden-focus ghost; wrapping the
  decorative chart in `inert` kills it for good. (The same `inert` mechanism
  clamps collapsed filter panels so their hidden controls aren't stray tab stops.)
- **The atlas keyboard route lives IN `AtlasLayer`, as a self-contained "Atlas
  blocks in view" disclosure panel — not a MapExplorer sidebar list.** The atlas
  block popups were pointer-only; the route was deliberately built inside the
  overlay component so it works on EVERY map that mounts the atlas, not just the
  Map Explorer. The data layer (`blockListRows` in `lib/atlasBlocks.ts`,
  viewport-scoped + capped) is unit-tested; the panel rows open the block's
  breeding summary + eBird atlas link and pan to it. This closed the
  pointer-only exception that `ACCESSIBILITY.md` had carried.
- **The "open this checklist on eBird" affordance was unified into one shared
  `ChecklistLink` component** (WCAG 3.2.4 Consistent Identification) — previously
  rendered four different ways and named three. One visual signature (the lucide
  `ExternalLink` icon) and one accessible-name formula
  (`Open checklist {id} on eBird (opens in a new tab)`), and it keeps the standing
  `SUBMISSION_ID_RE` shape-validation (junk id → plain text, never a styled 404
  link).

**The verification loop earned its keep.** Two false published claims reached
the statement and were caught only by re-checking it against the code: (a) the
complete-checklists meter above, and (b) the mobile filter focus-restore. The
lesson mirrors the privacy-policy stance — a published accessibility statement is
a record that must be re-verified against the shipped code, not against the
intent. Dark theme was covered analytically (computed contrast both themes), not
re-axed, because the theme is persisted, not toggled at runtime.

**Deferred items (as of 0.5.31) — all since resolved; see the 0.5.32 entry above.**
F064 (the shared checklist-link component) shipped in this 0.5.31 pass and was
adopted app-wide in 0.5.32. F078 (an explicit "opens in a new tab" suffix on every
external link via a shared component) shipped in 0.5.32 as `OutboundLink`. F082/F106
(the Southern-Hemisphere moon-phase emoji) was **not** actually deferred — it
already shipped in 0.5.28 (`lat < 0 → MOON_SOUTH`, latitude threaded to both
formatters, locked by the byte-golden tests); the original "scoped out rather than
half-done" framing was inaccurate and is corrected here.

**Lane note:** no release of its own is recorded here separately — 0.5.31 is the
version bump, ships in the app bundle, and the records below (CLAUDE.md,
PRODUCT_CONTEXT.md, ROADMAP.md) were updated alongside. The on-main-unreleased
test-determinism work folds into this same 0.5.31 release.

**Implications:** New contrast work goes at the token using the `-fg` / `-text` /
on-fill naming, in both themes; `text-disabled` is controls-only. Overlays route
every close path through one focus-restoring function. Decorative recharts
wrappers get `inert`. New external-id links shape-validate before becoming a
link. These are promoted to CLAUDE.md.

---

## Remaining test-suite flake fixed (two mechanisms, test-only); 0.5.29 records narrowed; PRODUCT_CONTEXT MapLibre doc-rot cleared — 2026-06-11 (no release; rides main until the next release)

**What:** Improve lane that killed both remaining failure classes of the
frontend suite's rare timing flake with test-only changes.
**(A1) The commit-vs-effect race:** under suite load, `renderAndLoad()`'s
`waitFor` on rendered DOM (`BirdingStats.test.tsx`) could resolve on the
phase-ready React commit BEFORE the component's passive double-rAF effect
queued anything into the stubbed `rafQueue` — flush #1 then drained an empty
queue, the rAF ladder never completed, and the next heading assertion failed
against a frozen shell. Fixed with an observable stub-queue precondition after
the DOM wait: `await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))`
— no wall clock. **(A2) The inter-environment timer leak:** toolkit's 100 ms
autoBatch fallback timers armed in the two chart-mounting jsdom files could
fire AFTER the file's jsdom environment was torn down, where neither jsdom's
`cancelAnimationFrame` nor the node-env shims exist (the 0.5.29 `test-setup.ts`
guards never install in jsdom files) — failing a later file with all tests
green. Fixed with `afterAll(() => new Promise((r) => setTimeout(r, 120)))`
wait-outs in `BirdingStats.test.tsx` and `MediaStatsSections.test.tsx`.
Proof: 45/45 post-fix stressed runs green (Engineer 30 + QA 15; single worker,
shuffled file order, concurrent CPU load) against a 3/30 pre-fix failure rate;
a pre-fix negative control in a throwaway worktree failed at run 12 with the
exact A2 class — all 82 tests passing, the run failed on the unhandled error.

Also in this lane: the 0.5.29 "flake fixed" overclaim was narrowed in
DECISIONS.md, CHANGELOG.md, and ROADMAP.md to the `cancelAnimationFrame` arm
it actually fixed, and PRODUCT_CONTEXT.md's pre-MapLibre doc rot was cleared
(12 current-behavior passages rewritten against the current map stack, 5
historical entries annotated as superseded, 2 Key Decisions marked historical,
and a v0.5.9 MapLibre-migration anchor entry added for the notes to point at).

**Decisions:**
- **No release — the change rides main until the next real release.** Nothing
  here ships in the app bundle (tests and records only), so the user scoped
  the lane to no version bump, no tag, no Mac release; CHANGELOG carries an
  `[Unreleased]` section that folds into the next release. Running the full
  release rhythm (tag, Windows CI, notarization, updater) for a change
  invisible to users buys nothing.
- **Async UI tests must wait on OBSERVABLE stubbed-queue preconditions —
  never assume effect timing relative to `waitFor`.** A DOM `waitFor` proves
  the commit happened, not that passive effects have run; when a test stubs a
  scheduling queue and then flushes it, the flush is only meaningful once the
  stub queue observably holds work. The generalized pattern: after the DOM
  wait, `waitFor` on the stub queue's length, then flush. Rejected
  alternatives (`vi.resetModules()`, rIC shims in `test-setup.ts`) were
  evaluated and dropped — they don't touch the mechanism.
- **Chart-library fallback timers need teardown wait-outs in jsdom files.**
  The 0.5.29 shims protect node-env files only; a jsdom file's own teardown
  is still a cliff for any third-party timer armed during it. Any test file
  that mounts recharts charts ends with the 120 ms `afterAll` wait so the
  timers fire where `cancelAnimationFrame` still exists.
- **The outside-project boundary held and is now a standing rule.** The
  scoping inventory's proposed "resolution note" about snowraven-mini was
  rejected: this repo's pipeline and records track SnowRaven only. Promoted
  to CLAUDE.md's pipeline conventions so no future lane re-litigates it.

**Implications:** Both test patterns are promoted to CLAUDE.md (Running
tests): new chart-mounting jsdom files copy the 120 ms wait-out, and
component tests that stub scheduling queues flush only after an observable
precondition. The stress recipe — `npx vitest run src/components
--maxWorkers=1 --sequence.shuffle.files=true` under concurrent CPU
busy-loops, 30 runs — is the proven reproducer for suite-order flakes;
reuse it (plus a pre-fix negative control) before claiming any flake fixed.

## Map fixes: sprite registration never gated on `isStyleLoaded()`, branch `<Source>`s keyed — 2026-06-11 (v0.5.30)

**What:** Fix lane for the missing hotspot teardrops, expanded mid-lane (user
approval at Stage 3) to also fix an app-wide crash the regression walk surfaced.
Two root causes, both proven with deterministic Playwright repros before fixing.

**Bug 1 — hotspot teardrops (and atlas hatches) silently never registered.**
`HotspotMarkers.tsx`/`AtlasLayer.tsx` gated sprite registration on
`if (map.isStyleLoaded()) addAll(); else map.once('load', addAll)`.
`isStyleLoaded()` reads false during ANY tile/source churn (base switch,
fitBounds, slow network) — and MapLibre's `load` event fires once per map
lifetime, while the Map Explorer's map stays alive from first tab mount — so a
listener armed later never fired, `addImage` never ran, and the `sr-hotspot`
symbol layer rendered nothing (and was unclickable: `queryRenderedFeatures`
finds nothing). Latent since 0.5.16; presented as intermittent because the
theme-flip MutationObserver re-bake self-healed it. **Fix:** register
unconditionally at effect time (`addImage` needs the style present, not
"loaded"; the `hasImage → updateImage : addImage` idempotency stays) plus a
per-component `styleimagemissing` safety net that bakes only the component's
OWN hardcoded image ids (exact-match lookup, `hasImage`-guarded, removed on
unmount). QA fired the net live (`removeImage` + repaint → re-baked).

**Bug 2 — Map Explorer Pins → Heatmap toggle crashed the whole app**
("source id changed" → error boundary; pre-existing since 0.5.18, present in
the shipped 0.5.29). `map/SightingMarkers.tsx` returned `<Source id="sr-heat">`
or `<Source id="sr-sight">` at the same tree position with no `key`, so React
reused the instance and react-map-gl asserts on the in-place id change —
MapLibre forbids mutating a source's id. **Fix:** `key` per branch so the
Source unmounts/remounts on mode change. Species Detail's heatmap
(conditionally mounted — the safe pattern) was unaffected and untouched.

**Decisions:**
- **Scope expansion, approved explicitly.** The heatmap crash was outside the
  bug brief, but it was a one-click app-killer live in the shipped build; the
  user folded it into this lane at Stage 3 rather than ship 0.5.30 around a
  known crash. Recorded so the two-fix diff doesn't read as scope creep.
- **Deterministic-repro-first verification paid for itself.** The triage's
  Playwright repro (delayed satellite tiles + mid-churn hotspot search) both
  proved bug 1's root cause and proves the fix; the post-fix regression walk
  across the whole map surface is what caught bug 2 at all. And the new
  `SightingMarkers.test.tsx` was proven to FAIL against pre-fix code in a
  throwaway worktree before being counted as coverage. Keep this posture in
  fix lanes: repro before fix, walk the surface after, verify the test bites.
- **Both root causes promoted to standing CLAUDE.md conventions** (Overlays
  and stacking): never gate sprite/image registration on
  `isStyleLoaded()/once('load')`; key (or conditionally mount) any `<Source>`
  whose id differs between render branches.

**Implications:** Future sprite-registering map components follow the
`HotspotMarkers`/`AtlasLayer` contract — unconditional registration + an
owned-ids-only `styleimagemissing` net. Any map-level event handler fed
external ids acts only on its own hardcoded id set, never using the incoming
id as an object key or regex input (the 0.5.30 handlers are the reference
implementation).

## Suite's cancelAnimationFrame flake fixed with setupFiles baseline shims; SnowRaven Mini mentioned in exactly three places — 2026-06-10 (v0.5.29)

**What:** Killed the `cancelAnimationFrame` arm of the pre-existing ~11% full-suite vitest flake with
test-infrastructure-only changes (new `frontend/src/test-setup.ts` + a
`test.setupFiles` entry in `vite.config.ts`; zero production code), and added
three informational mentions of **SnowRaven Mini** (the author's separate
Chrome/Firefox extension running the same weather+tide lookup on the eBird
page): a Weather-tab footer line (`App.tsx`), a closing paragraph in README's
"What it does", and an H3 under HELP.md's Weather section. Copy approved
verbatim; GitHub repo link only (Mini is not on the extension stores — no
store or landing-site links).

A separate, rarer idle-callback-adjacent flake in the same suite was a
different mechanism (commit-vs-effect race) and survived this fix; fixed
separately after 0.5.30.

**Decisions:**
- **Library fallback timers that outlive a test file need BASELINE shims in
  shared setup — per-test stubs structurally cannot cover cross-file timing.**
  Root cause: recharts bundles `@reduxjs/toolkit`, whose autoBatch fallback
  timer (100 ms) calls bare `cancelAnimationFrame`. `BirdingStats.test.tsx`
  stubs rAF/cAF per-test and restores them in `afterEach`; the stray timer
  fires AFTER that file finishes — in a later DOM-less node-env file in the
  same worker, where `cancelAnimationFrame` doesn't exist — and vitest fails
  whatever test happens to be running. Fix: idempotent,
  `typeof === 'undefined'`-guarded rAF/cAF shims run for EVERY file via vitest
  `setupFiles` (jsdom files keep their natives; BirdingStats' own stubs still
  win during its tests). QA proved it both ways: 8/8 shim-enabled full-suite
  runs clean; a shim-disabled negative control reproduced the exact
  ReferenceError at the pinned ~11% rate (2/18). Never remove the shims or
  convert them back to per-test stubs.
- **The website stays SILENT about Mini.** CLAUDE.md's website-sync rule
  exists so the site reflects the app's feature set; a companion-project
  mention is not an app feature, and the user specified exactly three places.
  Purpose reading over letter — recorded so a future docs-sync sweep doesn't
  "fix" the omission by adding Mini to the site.
- **The HELP mention is an H3 under Weather, deliberately OUT of the HelpDocs
  TOC** (the Tides precedent). Companion-project info is findable in context,
  not promoted to navigation — matching the informational, no-promotion
  register of all three mentions.

**Implications:** Any future flake traced to a third-party timer that
outlives a test file gets the same treatment (extend `test-setup.ts`, don't
per-test stub). Out of scope but flagged: snowraven-mini's own formatter
lacks the v0.5.28 moon-phase emoji — drift in the OTHER repo, not addressed
here.

## Weather-block raincrow parity: moon phase via the header emoji, pure-UTC port — 2026-06-10 (v0.5.28)

**What:** SnowRaven's generated weather blocks now append a moon-phase emoji to
the condition emoji on night checklists (`☁️🌗`), reaching parity with raincrow.
The other suspected gap — dew point — was verified ALREADY at parity during the
investigation (both formatters emit it unconditionally; 306 of the user's
checklists carry it), so **no dew-point change was made**: remaining differences
vs raincrow are cosmetic (toggleability, °C, half-up vs banker's rounding) and
deliberately left alone.

**Decisions:**
- **Header emoji, not a labeled `Moon:` line — and UNSPACED.** The phase emoji
  is appended directly to the condition emoji as one contiguous emoji run
  (`☁️🌗`, never `☁️ 🌗`). This is load-bearing: `stripWeatherTideBlocks`
  anchors a block on its LAST emoji run before the first labeled line, so the
  unspaced header needed **zero changes to `commentBlocks.ts`** (its diff is
  empty, verified), while a spaced header would leak `☁️ ` on strip. A labeled
  `Moon:` line was the worst option — it required `STRONG_MARKER_RE` vocabulary
  changes plus fixes for two known leak shapes the investigation found. (A
  raincrow-identical bare-moon header on clear nights was also rejected: that's
  raincrow's unmapped-night-icon limitation, not a design to copy.)
- **Pure-UTC Julian Day — a deliberate deviation from `lunarphase-js`.** The
  algorithm is a hand-ported `lunarphase-js@2.0.3` (pinned from the npm dist,
  NOT added as a dependency), but v2.0.3 bakes the *runtime's* local timezone
  offset into its Julian Day, so faithful ports would disagree depending on
  where the code runs. The port uses `JD = unix_ms/86400000 + 2440587.5` (pure
  UTC) in BOTH runtimes, duplicated byte-identically in `weatherFormatter.ts`
  and `backend/formatters/weather.py` and locked by the golden-oracle chain;
  the deviation only matters within ~±2% of a phase boundary.
- **Night = any sampled hour with `dt` outside its sunrise–sunset window** —
  not raincrow's OpenWeather d/n icon-suffix check. All three fields are
  already in every timemachine hour, so this avoids plumbing the `icon` field
  through both runtimes' types and mocks; the phase is computed from the
  checklist's FIRST sampled hour (matching raincrow's start-time behavior).
  Southern Hemisphere (`lat < 0`) mirrors the emoji set; the formatters gained
  a `lat` param both callers already held.

**Implications:** Any future weather-block header change must keep the header
emoji one contiguous run (the strip anchor depends on it) and keep the moon
emoji OUT of the strip marker vocabulary (it needs none — `EMOJI_RUN_RE`
already covers it). The moon logic lives inside the byte-golden lockstep chain
— change `weatherFormatter.ts`, `weather.py`, and `weatherFormatter.golden.py`
together. And the lane lesson: investigate before building — half the suspected
parity gap didn't exist.

## Checklists tab: span-based block stripping, regex hygiene as policy, cycling tri-state pills — 2026-06-10 (v0.5.27)

**What:** New Checklists tab (checklist-comment search, all-species species-comment
search, filterable all-checklists list, weather/tide hide toggle). Four decisions
worth keeping, two of them born from real-data bug reports and the security review.

**Decisions:**
- **Hiding a pasted weather/tide block means removing a SPAN — emoji header →
  end of attribution link — never whole lines.** eBird's CSV export collapses a
  pasted block's newlines into spaces, so user prose routinely shares one long
  line with the block and can continue AFTER the attribution. The first
  (line-based) implementation silently ate user comments; the user defined the
  correct rule. `stripWeatherTideBlocks()` (lib/commentBlocks.ts) is the single
  source of truth, with fallbacks for real export shapes: moon-emoji night
  blocks (RainCrow), bare-name attributions, attribution-less blocks (end after
  the last labeled value), emoji-less condition segments (absorbed only when
  short and not a finished sentence). **Post-mortem lesson: when a feature
  processes round-tripped/pasted text, verify against the REAL export early** —
  unit fixtures from the formatters all passed while three real-data shapes
  failed. The real-formatter-fixture + full-backup-sweep combination caught
  everything (308 block-bearing comments, 0 residue).
- **"Search matches what you see."** While blocks are hidden, search runs on the
  stripped text, and an empty-after-strip comment counts as NO comment in both
  the boxes and the has-comment filters; the has-weather/has-tide filter pills
  read the raw comment regardless of the toggle.
- **Regex hygiene is now policy** (from the security review, all three findings
  fixed in-stage): (1) module-level `/g` regexes carry shared mutable
  `lastIndex` and `String.prototype.matchAll` CLONES it — a stale offset made
  the strip silently skip markers order-dependently; always reset, or scan once
  up front. (2) Regexes scanning untrusted comment text must be linear by
  construction — precompute match positions, bound lazy quantifiers (the
  `NAME_TAG_RE` posture): the unbounded version was O(n²), 4.1s @400KB on the
  main thread, ~5ms after. (3) Decode entities exactly once along a render
  path — the shared `CommentText` takes `raw` (encoded; comparer/API) or
  `decoded` (Checklists; strip output) and double-decoding broke
  display==search.
- **Cycling tri-state pill for many-category filters.** One pill per category
  cycling any → has → doesn't-have (label restates its state: "Media" → "Has
  media" → "No media") instead of the Multimedia tab's paired Has/No pills —
  nine categories would have meant ~18 pills. This tab only; no retrofit.

**Also:** the comparer's `CommentText` was lifted to shared
`components/CommentText.tsx` rather than copied a third time;
`PRIVACY_POLICY.md` gained the "Embedded Bird Media and Link Icons" section
disclosing the pre-existing Cornell Lab asset loads (Macaulay embeds on Species
Detail + eBird/Birds-of-the-World favicons app-wide), with README/website/brief
now deferring to the policy as the full provider list.

## Named Birds tab: shared `SightingsMap` + single-open accordion as the concurrency bound — 2026-06-10 (v0.5.26)

**What:** Upgraded the Named Birds tab (four-option sort, per-report location, comment quote-blocks, lifted contrast) and gave each individual a per-individual sightings map. Two architectural decisions drove it.

**Decisions:**
- **Extract one shared `SightingsMap`; don't inline-duplicate the Species Detail map.** The pins path (DOM `<Marker>` pins + single state-driven `<Popup>` + `MapBoundsFitter`, owning the static `SP_PIN_HTML` sprite and its own `selectedCoord` state) is now `components/SightingsMap.tsx`. Both the new Named Birds card map and Species Detail consume it; Species Detail migrated with a **pixel-identical** pins contract and keeps its heatmap, intensity slider, and map-mode toggle local (the heatmap is deliberately *outside* the extraction boundary). Inlining a second copy would have forced the sprite, popup state machine, link guard, and per-coordinate aggregation to stay hand-synced. The aggregation is a separate pure, unit-tested helper, `lib/sightingMarkers.ts` (`buildSightingMarkers` — skip null coords, group by `lat,lng`, dates newest-first), so the "skip-null / empty→no-map / same-coord aggregation" behavior lives in one tested function used by both surfaces.
- **Bound concurrent WebGL maps *structurally*, with a single-open accordion — not an instance counter/queue.** The one real engineering risk was several expanded cards each mounting a MapLibre/WebGL context. The Named Birds tab now opens at most one card at a time (`singleOpen` prop; opening a card empties `expanded` to the new key), so at most one map is ever live — the stacked-context failure mode is designed out, not merely "probably fine." Render-only-while-expanded still tears the map down on collapse. Species Detail's map-less `NamedBirdsTable` stays multi-open (the cap is gated on `singleOpen`, so it's no gratuitous UX change there). This subsumed the PRD's open question on a concurrency cap.

**Also:** `location`/`latitude`/`longitude` were threaded onto `NamedSighting` from the already-parsed `ObservationEntry` (no parser change, no new CSV column); the per-row checklist link is now gated with `SUBMISSION_ID_RE` (`/^S\d+$/`) before becoming an anchor (rendering a malformed id as plain text), matching the map popup and the 0.5.25 convention.

**Implications:** When a second surface needs an existing map's pins/popup/bounds-fit, extract the pins path into the shared `SightingsMap` and migrate the original with a pixel-identical contract — don't re-inline the Species Detail map. Prefer a single-open accordion over a counter/queue wherever a list can mount per-row maps. Any external-id href built from CSV data is shape-validated (`SUBMISSION_ID_RE`) before it becomes a link.

## Media card: At a glance back to uniform tiles + busiest-day checklist link — 2026-06-10 (v0.5.25)

**What:** Reworked **Statistics → Media → At a glance** again — busiest day, longest streak, and a new archive-span fact are uniform grid tiles once more (not the v0.5.24 caption), and the busiest-day date links to that day's eBird checklist. **This supersedes the v0.5.24 decision below** that moved those facts out of the grid into a caption.

**Decisions:**
- **Mixed-height `StatCell`s in one `auto-fit` grid are fine *if every tile reserves the sub-line slot*.** v0.5.24 banned mixing sub-bearing and plain tiles because the taller ones stretched the row. The cleaner fix is a `reserveSub` prop on `StatCell` that always renders the sub-line slot (`sub || nbsp`), so every tile is the same height whether or not it carries a sub. All eight At-a-glance tiles set `reserveSub`, so busiest day / longest streak (with the dates it ran) / archive span are tiles again and stay aligned at any width. The v0.5.24 "facts that need a sub-line belong in a caption" guidance is **reversed** — they belong in tiles, with `reserveSub`.
- **The busiest-day date links to that day's *dominant* eBird checklist, and ids are shape-validated before they become a link.** When a day spans several checklists, the link targets the one with the most media (tooltip explains). Ids are validated against `/^S\d+$/` at tally time, so junk column values never become a styled 404 link; the href is `encodeURIComponent`-wrapped and rendered as escaped JSX — same standing rule as the map popups/links.
- **Out-of-range export dates are excluded from the date stats, not rolled over.** `dayNumber` previously accepted "2024-13-05" / "2024-02-00" via `Date.UTC` rollover while `formatDate` rejects them, so a tile could lose its sub-line (breaking the uniform height) or render an empty link. `dayNumber` now range-checks month/day like `parseParts`; such rows are treated as undated.
- **The checklist link's `aria-label` leads with the visible date.** An earlier label replaced the visible date, violating WCAG 2.5.3 (Voice Control users couldn't activate it by its visible text). The accessible name now begins with the date the user sees. (v0.5.32: this rule is baked into the shared `ChecklistLink` — `checklistLinkAriaLabel(id, label)` leads with the label when one is shown — after the 0.5.31 extraction had briefly regressed it on the Checklists tab.)

**Implications:** Prefer `reserveSub` over a separate caption when a Media-card fact needs a sub-line — keep facts in the uniform tile grid. Any new external link built from export-column data must shape-validate the id before constructing the href.

## Media card: At a glance alignment + age-coverage rework — 2026-06-09 (v0.5.24)

**What:** Fixed the misaligned "longest streak" dates in **Statistics → Media → At a glance**, and reworked **Age coverage by species** to be filtered, capped, and sortable.

**Decisions:**
- **Do not mix `StatCell`s with and without a `sub` line in the same `auto-fit` grid.** `StatCell` renders an extra line only when `sub` is set, so a sub-bearing tile is taller; the grid (`repeat(auto-fit, minmax(150px,1fr))`, default `align-items: stretch`) then stretches the whole row to the tallest tile, and because tiles re-wrap per width, *which* tiles share a row with the tall one changes — producing alignment that looks broken at some widths and fine at others. Fix: the At-a-glance grid now holds only the five uniform count tiles; the busiest-day / longest-streak / span facts moved into a centered caption (`atAGlanceFacts.join('  ·  ')`). Keep nugget facts that don't fit the tile shape out of the StatCell grid.
- **The "documented only as adults so far" note gates on `youngSpecies.length > 0 || onlyAdults.length > 0`.** `speciesWithYoung` (immature||juvenile) and `onlyAdults` (adult-only, ≥3 aged assets) are disjoint sets, so gating the whole Age-coverage block on young-species alone hid the note for exactly the all-adults user it's most informative for. Render the sortable list only when `youngSpecies.length > 0`, but let the note render independently. (Regression caught in adversarial review; covered by an all-adults component test.)
- **Age-coverage taxonomic sort reuses `/taxonomy/codes`.** The endpoint already returns `orders` alongside `codes`; `BirdingStats` threads it through `orderFor` (same raw-key→normalized→`Infinity` fallback as `codeFor`) into `sortSpeciesAgeCoverage` (unknown order sorts last, name as tiebreak). No new endpoint.

**Implications:** Any new Media-card "fact" that needs a sub-line belongs in a caption, not the StatCell grid. Notes that summarize a superset of a filtered list must not be nested inside the filtered list's render gate.

## In-app text size via px→rem (v0.5.13) — 2026-06-05

**What:** App-wide Text Size control (Settings → Appearance, 100/125/150/200%) +
automatic respect for the browser/OS default text size. Plan: `pipeline/text-size/plan.md`.

**Mechanism:** `html { font-size: calc(100% * var(--sr-text-scale, 1)) }` — `100%`
inherits the platform default (system-respect), the var is the in-app multiplier; ALL
font sizes converted px→rem so they scale with both. Persisted via localStorage (web
anti-flash, in index.html) + the storage seam (desktop-durable); applied app-wide on
load in `App` (`lib/textScale.ts`).

**Why px→rem, not CSS `zoom`:** there is no JS API to read the OS text size — the
platform delivers it only through the root font size, which requires relative units.
So px→rem is the only path that (a) honors system text size and (b) sets up the future
**mobile** app to honor iOS Dynamic Type / Android font scale. CSS `zoom` was rejected:
manual-only (ignores system size) and it offsets MapLibre pointer coordinates. rem is
text-only, so maps are unaffected.

**Scope/standard:** levels reach **200%** to meet **WCAG 2.1 SC 1.4.4 (Resize Text)**.
Conversion: a reviewed codemod did 469 literal inline `fontSize` values; 5 computed +
9 CSS values by hand. Overflow audit (SC 1.4.12) at 200% found only the Statistics
number grids crowding — fixed by switching those grid track minimums from px to rem
(`minmax(120px…)` → `minmax(7.5rem…)`, etc.). Wide tables + maps may scroll at 200%,
permitted by SC 1.4.10's exemption.

**Still deferred:** keyboard-operable map markers (MapLibre markers aren't natively
focusable; sidebar lists are the fallback).

---

## Tier 3 foundation pass (v0.5.12) — 2026-06-05

**What:** First pass at the Tier 3 backlog (`pipeline/comprehensive-review/audit.md`),
prioritized for long-term maintainability (Dave: "maintain SnowRaven for a long time").

**Done:**
- **Extracted + tested the stats logic.** `lib/birdingStats.ts` (13 pure fns, 14 tests)
  and `lib/speciesStats.ts` (7 pure fns, 9 tests) — the Statistics + Species Detail
  derivations are now pure, unit-tested modules; the components render over them.
  BirdingStats 2574→1952, SpeciesDetail 1951→1813 lines. This is where the past
  calc bugs lived (area, streaks, state names) — now regression-guarded.
- **Chart accessibility.** All charts get `role="img"` + a concise summary; decorative
  pie SVGs `aria-hidden`.
- **Perf:** `BirdName` wrapped in `React.memo`; eBird CSV parse moved to a Web Worker
  (`lib/observationsWorker.ts`) via `observationsCache`, with a synchronous fallback.
- **Map Explorer:** atlas toggle relabeled "California atlas blocks." (Tried per-mode
  intro text — REVERTED: it pushed controls down + duplicated the legend. Lesson:
  no explanatory chrome above the controls.)

**Deliberately did NOT do (and why):**
- **Shared-primitive dedups** (heatmap layer, filter bar): on inspection the heatmap
  uses had genuinely diverged (atlas shading) and the filter predicate was trivial —
  forcing a shared abstraction would be the *wrong* abstraction. Skipped.
- **Component render-splitting** (sections → files): the high-value part was the logic
  extraction (done); splitting JSX into files is pure org with churn — deferred until
  a tab is being actively changed.

**Deferred to dedicated future efforts:**
- **In-app text size → px→rem conversion.** The app is sized in fixed px, which is
  exactly what blocks honoring the OS/browser text size. The mobile-correct path
  (relative units → iOS Dynamic Type / Android font scale, no JS API reads a number)
  is a large, careful refactor — its own effort, also the foundation for the future
  mobile app. A CSS-`zoom` shortcut was rejected (manual-only, ignores system size,
  and CSS zoom can offset MapLibre pointer coords).
- **Keyboard-operable map markers** (MapLibre markers aren't natively focusable;
  sidebar lists are the current fallback).

---

## Comprehensive review → Tier 1 + 2 improvements (v0.5.11) — 2026-06-05

**What:** Ran a full-app audit (5 parallel read-only reviews: UX, IA/consistency,
a11y, performance, code-health → `pipeline/comprehensive-review/audit.md`), then
built the agreed Tier 1 (quick wins) + Tier 2 (bigger bets) and shipped them as a
**single 0.5.11 release** (Dave's call — avoids double notarization/CI).

**Key decisions:**
- **`--sr-on-accent` token** is the readable foreground on the accent fill (white in
  light, dark green `#052E16` in dark). Dark primary buttons were white-on-`#34D399`
  = 1.92:1; this fixes ~11 CTAs. Use it for any new accent-background control.
- **Map popups are themed via `.maplibregl-popup*` CSS** (content + tip per anchor)
  plus tokenizing the inline popup colors — they were hardcoded light grays.
- **Sortable `<th>` keyboard support** = `tabIndex={0}` + `onKeyDown` (Enter/Space),
  *keeping* the `columnheader` role + `aria-sort`. Do NOT add `role="button"` — it
  voids `aria-sort`.
- **Lazy-load** the 3 heavy tabs (Map Explorer, Species Detail, Statistics) via
  `React.lazy` + Suspense + a deferred-mount set (`mountedTabs`, stay-mounted after
  first open). First-paint JS ~525 KB → ~110 KB gz; maplibre/recharts now split.
- **`lib/observationsCache.ts`** — content-keyed memo of the eBird parse, shared by
  all tabs (was re-parsed per tab).
- **`components/setupCopy.tsx`** — single source for eBird/ML setup steps (fixes the
  missing ML "filter = All" step + the inconsistent eBird ZIP wording).
- **First-run welcome** (`WelcomeScreen.tsx`) shows only on cold start (no keys AND
  no files AND not previously dismissed; dismissal persists via the storage seam's
  `welcomeSeen`).
- **Renames:** "Media List" → **Multimedia** (tab id stays `life-list` so saved
  layouts don't break); "Nemesis Birds" → **Nearby Lifers** (internal `nemesis*`
  vars + `/stats/nemesis` endpoint kept).

**Deliberately deferred to Tier 3** (don't redo as "missing"): splitting the
oversized components (BirdingStats/SpeciesDetail/MapExplorer) and, *with* those
splits, extracting the remaining shared primitives (the filter bars, `Stat*`/
`SectionCard`, `SegControl`, the heatmap wrapper) — pulling them out now would add
churn/regression risk for no user-visible gain. Also deferred: unifying the two
day-first date formats (Map Explorer "5 Jan" vs Species Detail "5 January" — minor
drift), map-marker keyboard operability, Worker-based CSV parse, chart alt-text.

---

## Offline maps — explored, shelved (roadmap) — 2026-06-05

**Decision:** Explored an optional offline-maps feature (download regions so the
maps render without a connection). **Shelved** — kept as a *distant roadmap* item,
not feasible now given SnowRaven's self-hosted / no-server, local-first nature.

**Why not now:** the blocker is tile **hosting**, not rendering. Rendering offline
is a solved problem (MapLibre + PMTiles + OPFS). But *serving the tile bytes* isn't
free: Protomaps discourages hotlinking their planet builds (URLs rotate daily,
"copy the tileset to your own storage"), and OpenMapTiles-schema extracts would
need generating with Planetiler. Either path requires **us to host tile data** — a
~100 GB planet copy or pre-generated regional extracts, with egress per download —
a real infrastructure + cost commitment the otherwise serverless/free app avoids.
Not worth taking on right now.

**Revisit when:** there's appetite to run tile hosting (e.g. Cloudflare R2), OR a
sanctioned free per-region tile source appears, OR the mobile apps make
field-offline a priority (offline is the strongest use case on phones; ~90% of the
build would reuse on Tauri mobile, and the PMTiles approach/data port to native).

**Record:** full research in `pipeline/offline-maps/` (strategic-brief, prd,
architecture). If revived: PMTiles **vector base only** (satellite/topo too big to
download), region picker + size estimate, OPFS storage, desktop-first.

---

## Statistics tab: top species, richer effort/outings, regroup — 2026-06-05 (v0.5.10)

**Decision:** Expanded and reorganized the Statistics tab (`BirdingStats.tsx`):
added **Top Species** (most individuals + most checklists), a much richer
**Effort & Outings** section, a new **Highlights & Records** section, a logical
**regroup** of previously-scattered stats, and a section **jump-nav**. Shipped
batched with the SnowMap offline-retry fix as **0.5.10**.

**Key points / learnings:**
- **Area Covered**: added parsing (`area` on ObservationEntry/ChecklistEntry;
  the "area covered (ha)" column). Dave's data has **0 area rows** — his protocols
  are Traveling/Stationary/Casual, and only the eBird "Area" protocol records
  area. So area stats are **hidden when absent** rather than shown blank; parsing
  is verified, the empty display was correct, not a bug.
- **Checklist-level fields dedupe by submissionId** — duration/distance/area/
  observers repeat per species row, so summing raw rows would multiply by species
  count. All outing superlatives + totals use the deduped `checklists`.
- **Regroup without risky cut-paste**: moved the records grid out of Firsts &
  Milestones, then split Data Quality by inserting a section boundary *before* the
  biggest-counts block — so the flocks / single-checklist / one-and-done blocks
  became the new "Highlights & Records" section's content in place. (Placement:
  Highlights & Records lands after Data Quality as a result.)
- **State codes → names**: new `lib/regionNames.ts` (US + Canada, fallback to the
  code); display the name, keep the code in the eBird region URL + hover title.
- **Streak counts any report/date** (`rawObs`, unfiltered) per Dave's ask;
  single-checklist now excludes one-and-done (a strict subset).
- **Total time spelled out** via `formatDuration` (yr/mo/day/hr/min, non-zero
  units only; eBird durations are minute-granular so no seconds).
- **Versioning**: 0.5.10 was already bumped (for the map fix) in BOTH
  `package.json` and `tauri.conf.json` — did not re-bump; appended the Statistics
  items to the existing 0.5.10 CHANGELOG entry. (Reinforces the v0.5.9 lesson:
  bump both version files.)
- Tests: `lib/regionNames.test.ts` + Area-Covered parsing in
  `parseEbirdObservations.test.ts`. 306 frontend tests pass.

---

## Vector basemap: Leaflet → MapLibre GL + OpenFreeMap — 2026-06-04 (v0.5.9)

**Decision:** Replaced the Leaflet + raster-tile map stack with **MapLibre GL**
(`react-map-gl` / `maplibre-gl`) drawing **OpenFreeMap** vector tiles, across all
three maps (Map Explorer, Species Detail, Statistics). Motivation: custom label
sizing/styling, brand tinting, and a path to offline tiles — none possible with
raster tiles. All maps go through one `<SnowMap>` wrapper; styles/providers live
in `lib/mapStyle.ts`. Leaflet (`leaflet`, `react-leaflet`, `leaflet.heat`) was
removed entirely.

**Key architecture:**
- **Single persistent style + `visibility` toggling**, never `setStyle`-swapping
  (swapping dropped the `openmaptiles` source and reset pan/zoom). Satellite
  (Esri) / Topo-US (USGS) / Trails (Waymarked) are raster layers inside the one
  style, shown/hidden by `visibility`. Switcher kept on all maps (Dave's call).
- **`useMap().current`** gives children the `MapRef` for imperative effects
  (pan/fit, atlas click + `addImage`). Markers are `<Marker>`s; each map has ONE
  state-driven `<Popup>` (MapLibre has no per-marker `bindPopup`).
- **`lib/heat.ts`** is the single heat model for both heatmaps (native `heatmap`
  layer); default intensity tuned calm (`heatIntensityFactor(5) = 0.30`).
  Atlas-shading visibility priority: heatmap re-ordered under the atlas fill via
  `beforeId` + dimmed, sighting pins faded, so tier colors read on top.
- **Atlas** (`AtlasLayer.tsx`): full block GeoJSON (no viewport cap; `minzoom 6`),
  data-driven `fill-color`/`fill-pattern` by tier, line grid, and an escaped-JSX
  click popup. **Hatch textures** are canvas sprites (`lib/atlasTextures.ts`) via
  `map.addImage` + `fill-pattern`, regenerated on `data-theme` change; the legend
  preview is an inline-SVG `TierHatchSwatch`.

**Gotchas / post-mortems (carry forward):**
- **`Map` import collision** — `react-map-gl`'s `Map` shadows the JS `Map`
  constructor; `new Map()` then crashed (blank screen). Always import as `MapGL`.
- **Two-file version bump** — bumping only `frontend/package.json` (not
  `src-tauri/tauri.conf.json`) for v0.5.9 built the desktop bundle as 0.5.8; the
  first Windows CI run produced a 0.5.8 installer. Caught at the release
  health-check; fixed by bumping `tauri.conf.json`, moving the `v0.5.9` tag to the
  corrected commit, and re-running CI. CLAUDE.md versioning rule now says bump
  BOTH files (the tag must point at a commit where both are bumped, since CI
  builds Windows from `tauri.conf.json` at the tag).
- **No water-mask for trails** — an earlier attempt to mask trails to land hid
  bridges; reverted (trails-over-water beats missing bridges).
- **MapLibre paint can't read CSS vars** — colors in `fill`/`line`/`heatmap` paint
  and in canvas sprites are hardcoded (or read via `getComputedStyle` at
  generation). Justified exception to the "all colors via `var(--sr-*)`" rule,
  which applies to DOM/CSS only.

**Shipped in the same patch (v0.5.9):** also fixed Breeding Codes species-name
alignment (row `<th>` defaults to center) and made the Life List Total media count
a link to all media (unfiltered Macaulay search). Deferred-then-restored before
release for parity: atlas block popup + hatch textures (Dave held the release
until the maps matched the old feature set). Bundle: +maplibre-gl (~273 KB gz) −
leaflet (~50 KB) — accepted tradeoff for vector tiles.

---

## One shared `<BirdName>` for every bird name; click → Species Detail — 2026-06-04 (v0.5.8)

**Decision:** Every user-facing bird name renders through a single shared
component `frontend/src/components/BirdName.tsx` (common name + eBird/BoW
favicons + optional scientific name), replacing ad-hoc renderings. The common
name links to the species' **Species Detail** entry via a single-use cross-tab
navigation (`App.requestedSpecies` → `SpeciesDetail` consume effect), mirroring
the existing `requestedFilter` pattern.

**Key rules (resolved with Dave):**
- **Link only when an entry exists.** A name links to Species Detail only if the
  species is in the user's backbone (loaded eBird backup). Birds you haven't
  recorded (nemesis, map targets when unseen, a comparer's other-list-only
  column) show plain name + favicons — never a dead link.
- **Move the link to the number.** Where a name previously carried a link
  (Stats "Most Photographed" → ML; single-checklist/one-and-done → checklist),
  the name now goes to Species Detail and the count/element (or a ↗ / locate
  icon) carries the original link.
- **Headings stay** (Species Detail's own entry header) and **form controls are
  excluded** (Map filter dropdown, manual target checkboxes).
- **Quiet affordance:** the name reads as text at rest, revealing accent +
  underline on hover/focus, so already-compliant tabs look unchanged.

**Notes / implications:**
- `hasEntry` is sourced per tab from a normalized backbone set; tabs whose lists
  are entirely from the backup pass `true`.
- Favicons need a taxon code → Stats now resolves codes for ALL observed species
  (not just ML species) so favicons are consistent (one batched, cached
  `/taxonomy/codes` call). Raster label-size caveat N/A here.
- Component-test infra: added `jsdom` as a **dev** dependency and used a per-file
  `// @vitest-environment jsdom` docblock for `BirdName.test.tsx`, leaving the
  rest of the suite in the node env. First DOM/component test in the project.
- Convention recorded in CLAUDE.md: render bird names via `<BirdName>`, never
  ad-hoc; favicons are siblings of the name button (no nested interactive els).

---

## Keyless raster basemaps (CARTO Positron) + layer switcher; vector deferred — 2026-06-04 (v0.5.7)

**Decision:** Replace the default OpenStreetMap tiles (`tile.openstreetmap.org`)
with **CARTO Positron** as the default base, and add a keyless layer switcher
(Esri satellite, USGS topo, Waymarked trails) on the interactive maps. All
providers are **keyless** — no accounts, no API keys, no billing. Stay on
Leaflet (raster); the vector path (MapLibre + OpenFreeMap) is deferred.

**Rationale:**
- The OSMF tile policy forbids app/self-hosted use of `tile.openstreetmap.org`
  and can withdraw access — a real fragility for an app many people self-deploy.
- Positron is a clean, minimal light base that reads well under data pins, and
  is the closest keyless off-the-shelf match to the brand palette.
- Keyless keeps the free/no-accounts/privacy stance intact (commercial SDKs
  like MapTiler/Google/Mapbox were excluded purely on the key requirement).
- The map's custom layer stack (leaflet.heat, atlas polygons, SVG textures,
  markers, popups, fullscreen) is now rich; migrating to MapLibre/vector would
  mean rewriting all of it — not worth it just for a basemap.

**Label-size finding (raster constraint):** raster basemap label size is
effectively **binary** — native, or 2× via the `tileSize:512 + zoomOffset:-1`
trick. There is no fractional in-between on a single style (you can't resize a
raster's baked-in labels). Tried 2× (too big) and CARTO Voyager (medium labels,
more color); Dave preferred Positron's minimal look at native size. A precisely
tunable label size would require vector tiles (the deferred path).

**Implications:**
- Tile providers live in one place: `frontend/src/lib/basemaps.ts`; the shared
  `<MapBaseLayers switcher?>` renders them (+ a portal-based Leaflet control).
- **Adding/changing a tile provider must be reflected in PRIVACY_POLICY.md** —
  it now has a "Map Tiles" section (this also closed a pre-existing gap that
  never disclosed even the OSM tiles).
- Honest limitations: "keyless ≠ contractually unlimited" (CARTO/Esri prefer an
  account at high volume); USGS Topo is US-only. Self-hosting tiles
  (OpenFreeMap/Protomaps) is the only way to remove the keyless-fragility caveat.

---

## macOS ships a universal binary, not separate Intel/Apple-Silicon DMGs — 2026-06-02 (v0.5.5)

**Decision:** The macOS app is built as a single **universal** binary
(`--target universal-apple-darwin`) producing one `SnowRaven_<ver>_universal.dmg`
that runs natively on both Apple Silicon and Intel. `release.sh` was
reworked to build/notarize the universal artifact, and `latest.json` maps
**both** `darwin-aarch64` and `darwin-x86_64` to the one universal updater
bundle (same URL + signature).

**Rationale:** Previously macOS shipped Apple-Silicon-only, so Intel Mac
users couldn't run the app or get updates. A universal binary is the
simplest fix for users (one download, no architecture choice) at the cost
of a larger DMG — preferred over maintaining two separate DMGs.

**Implications (full specifics in CLAUDE.md):** the build needs BOTH Rust
targets installed (`aarch64-apple-darwin`, `x86_64-apple-darwin`);
`release.sh` preflights this. With an explicit `--target`, Tauri nests the
bundle under the target triple. The Intel `latest.json` key MUST be exactly
`darwin-x86_64` (Tauri's `updater_arch()` returns `"x86_64"` on Intel) or
Intel users never see updates. Verified live: v0.5.6 `latest.json` carries
all three platform keys.

## In-app Help is bundled — doc fixes reach desktop users only on a release — 2026-06-02 (v0.5.6)

**Decision:** Treat corrections to `docs/HELP.md` as shippable changes:
because `HelpDocs.tsx` `?raw`-imports HELP.md at build time, the in-app Help
is frozen into each binary. A doc-accuracy patch (v0.5.6) was released so
the corrected Help reaches Mac/Windows desktop users, rather than leaving
them with stale in-app Help until the next feature release.

**Implications:** README/CHANGELOG/privacy edits land on GitHub immediately
on commit, but **in-app Help only updates via a release**. Factor this in
when deciding whether a doc fix needs its own patch or can ride with the
next release.

## Map Explorer mobile fullscreen via a CSS overlay, not the Fullscreen API — 2026-06-02 (v0.5.4)

**Decision:** On small screens (≤640px) the Map Explorer can go fullscreen
via a toggle next to Filters. "Fullscreen" is a CSS overlay — the map
panel becomes `position: fixed; inset: 0; height: 100dvh; z-index: 1200`
(state `mapFullscreen` in `App.tsx`) — not the browser Fullscreen API
(`requestFullscreen`).

**Rationale:** The browser Fullscreen API is unreliable on iOS Safari /
WKWebView (limited support, gesture constraints, and it fights the mobile
toolbar). A CSS overlay is deterministic, themeable, and `100dvh` handles
the dynamic browser toolbar. Mobile-only (gated behind the existing 640px
breakpoint) because desktop has ample room and no need.

**Implications:** The two in-map navigations that change tabs ("Go to
Settings", "target species") clear `mapFullscreen` so no other tab
inherits the overlay; background scroll is locked while fullscreen. The
backdrop grey was fixed by tinting `.leaflet-container` to a new
`--sr-map-void` ocean token — and that override needs **raised
specificity** (doubled class) because Leaflet's own `.leaflet-container`
rule is bundled after `globals.css` and ties on specificity (recorded in
CLAUDE.md).

**Maintenance note:** GitHub will redirect the `windows-latest` CI runner
to `windows-2025-vs2026` by **2026-06-15**. `windows-build.yml` should pin
the runner image before then to avoid a surprise breakage. (A background
task was spun off for this.)

## Desktop clipboard auto-copy: a clipboard seam, not navigator.clipboard — 2026-06-02 (v0.5.3)

**Decision:** Weather auto-copy on the desktop apps goes through a new
**clipboard seam** (`frontend/src/lib/clipboard.ts copyText()`) that uses
the native Tauri clipboard-manager plugin in Tauri mode and
`navigator.clipboard` (+ legacy `execCommand`) on web. Components never
call `navigator.clipboard` or the plugin directly.

**Rationale:** The on-lookup auto-copy runs *after* the weather `fetch`
await, which loses the user-activation that WKWebView/WebView2 require
for the async Clipboard API — so `navigator.clipboard.writeText` threw
`NotAllowedError` and was silently swallowed on desktop (the manual Copy
button worked because it runs inside a click). The native plugin writes
via the OS with no gesture requirement, fixing it cleanly. A seam keeps
the platform branch in one place, matching the existing
transport/storage/platform seams.

**Implications:** New first-party dep `tauri-plugin-clipboard-manager`,
in Cargo `[dependencies]` (cross-platform, NOT the macOS-only target
table — the v0.4.0 `tzf-rs` lesson) so the Windows build stays green.
Capability grants `clipboard-manager:allow-write-text` only — write, not
read; no runtime OS prompt, so no permission button was needed. Future
clipboard use must go through `copyText` (recorded in CLAUDE.md).

## Heatmap intensity model shared across maps — 2026-06-02 (v0.5.3)

**Decision:** The v0.5.1 heatmap intensity math (`heatRadius/heatBlur/
heatMax` + per-point `heatWeight` divisor, `HEAT_INTENSITY_DEFAULT`)
now lives in one module, `frontend/src/lib/heat.ts`, used by both the
Map Explorer (My Sightings) and Species Detail heatmaps.

**Rationale:** The Species Detail heatmap was hardcoded and had no
intensity control; porting the slider by duplicating the formulas would
have created two sources of truth that could drift. Extracting to a
shared module gives identical behavior and one place to tune.

**Implications:** Any future heatmap (e.g. if a Statistics map ever
becomes a heatmap) should consume `lib/heat.ts` rather than re-deriving
radius/blur/max.

---

## Atlas block shading: by the user's own codes, with textures as an opt-in — 2026-06-01 (v0.5.2)

**Decision:** The "Shade by My Highest Breeding Code" overlay tints each atlas block by the strongest breeding code the *user* has personally entered there — never a community/anyone aggregate. The shading is a pure client-side spatial join (`buildBreedingByBlock` over `pointToBlockCode`) against the already-loaded eBird backup. Colorblind accessibility is provided by a *separate* "Use Textures" toggle that overlays a per-tier hatch pattern, and that toggle is **off by default**.

**Rationale:** Personal-only data keeps the feature honest (it reflects your own atlasing progress, not crowd data the app doesn't have) and stays within the local-first/zero-collection stance — no new network calls or backend. Textures were made a distinct, default-off toggle because the hatch patterns, however tuned, reduce base-map legibility; users who don't need color-independent encoding get the cleanest map, and those who do can opt in. Spacing/alpha were tuned over several live iterations so labels under the lightest/densest tiers stay readable.

**Implications:** Requires the eBird backup to be loaded (toggle is disabled with a Settings hint otherwise). The overlay (blocks + shading + textures) was generalized into one shared control rendered in all three map views (My Sightings, Hotspots, Media Targets). The block popup gained breeding fields — still trusted/static data, so the standing CLAUDE.md injection-guard check was re-confirmed, not changed. The atlas draw cap was raised 400 → 5000 to make blocks visible from higher zoom; revisit if it ever costs perceptible render time on large viewports.

---

## Atlas blocks: generate geometry from a gazetteer, don't bundle polygons — 2026-06-01 (v0.5.0)

**Decision:** The California atlas block overlay bundles a compact per-quad gazetteer (~2,878 records, 160 KB) and generates the 16,527 block rectangles + names at runtime, rather than bundling the official polygons (~1–2 MB).

**Rationale:** The blocks are a perfectly regular grid (USGS 7.5' quad / 6, all clean axis-aligned rectangles — verified across all 16,527). The only irreducible data is the quad name, id, SW corner, and (for edge quads) which positions exist; geometry is derivable. Regenerating from the gazetteer was verified an exact 1:1 match with the official block set, so generation is faithful, not approximate. Keeps the overlay small, lazy-loaded, and offline-capable (no runtime Google Drive / third-party fetch), consistent with the local-first stance.

**Implications:** The bundled asset is produced by `scripts/convert-atlas-blocks.mjs` from the official KML; re-run only if the atlas data changes. The approach generalizes to other state atlases (same quad-grid scheme) if ever added. Two standing conventions came out of this and live in CLAUDE.md: outline-only Leaflet polygons need a transparent fill for interior clicks; and the block popup's HTML-string construction must be re-checked if block data ever becomes non-static (injection guard).

---

## Privacy stance: local-first, zero data collection — 2026-05-29

**Decision:** SnowRaven collects no user data — no analytics, telemetry, crash reporting, accounts, or developer-operated server. The user's data (eBird backup, ML export, settings, API keys) stays on their own device or self-hosted machine and is theirs to control. This is now stated publicly in `PRIVACY_POLICY.md`. The app's only outbound traffic is the user-initiated, user-key-authenticated calls to eBird, OpenWeather, and Nominatim, made directly to those providers with no intermediary.

**Rationale:** Matches the founding self-hosted ethos and is a genuine differentiator. Formalizing it publicly makes it a commitment, not just an implementation detail.

**Implications:** Adding any data collection, analytics, telemetry, or new third-party dependency is now a decision that must be revisited here AND reflected in `PRIVACY_POLICY.md` in the same change (see CLAUDE.md → Documentation). Do not add such things silently.

---

## Windows geolocation — deferred item resolved — 2026-05-28 (v0.4.1)

**Decision:** Implemented native Windows "Use my location" using the official `windows` crate's `Geolocation.Geolocator`, gated `#[cfg(target_os = "windows")]`, mirroring the macOS module's `Coords`/`get_location` contract. This resolves the geolocation deferral recorded in the v0.4.0 post-mortem.

**Rationale:** Chose the native `windows` crate over `tauri-plugin-geolocation` (unreliable desktop support); it mirrors the macOS CoreLocation approach and keeps the frontend uniform (one `invoke` path). The Windows CI compile validated the build first try.

**Implications:** Windows is now at full parity. Remaining Windows follow-up: Authenticode signing (roadmap). Unpackaged `.exe` has no per-app location prompt — denial = the global Windows location setting is off, hence the Settings-pointing message.

---

## Windows desktop app — build/release approach + post-mortem — 2026-05-28 (v0.4.0)

**Decision:** Ship a native Windows client built in GitHub Actions, signed locally. CI (`windows-build.yml`) builds the installer with a throwaway key; `release.sh` re-signs with the real key and assembles one release with a multi-platform `latest.json`. This keeps the signing key off GitHub (consistent with the Apple-credentials stance) and makes `release.sh` the single source of the manifest, avoiding macOS/Windows entries clobbering each other.

**Rationale:** Dave can't readily build Windows on his Mac, and macOS can't cross-build Tauri Windows bundles, so CI is required. Keeping the key local was preferred over fully-automated CI signing.

**Deferred (now roadmap items):** native Windows geolocation ("Use my location" shows a coming-later note) and Windows Authenticode signing (unsigned → SmartScreen prompt). The in-app updater works unsigned (minisign).

**Build post-mortem — three issues only a real Windows build surfaced** (the local macOS build and Ubuntu CI never compiled the Tauri lib for Windows):
1. `tzf-rs` was declared under the macOS-only target table but used by the cross-platform `get_timezone` command → "unresolved import" on Windows. Cross-platform Rust deps must be in `[dependencies]`.
2. The Windows updater target is the NSIS installer (`*-setup.exe` + `.sig`), not a `.nsis.zip` — the original CI/release design assumed an archive that Tauri v2 doesn't produce on Windows.
3. `tauri signer sign` rejects `--private-key-path` when `TAURI_SIGNING_PRIVATE_KEY` is already in the env; the Windows-install signing step must rely on the env key (no `-f`).

**Implications:** See CLAUDE.md → Versioning → "Windows desktop release" for the standing rules. Pending real-hardware confirmation (QA-07): install + in-app update on Windows 11.

---

## Abandoned — Recent Arrivals (Map Explorer) — 2026-05-28

**Stage reached:** Stage 1 (The Strategist) — strategy only, no artifacts written, no code.
**Idea:** A "Recent Arrivals" section in the Map Explorer showing birds reported within X miles of the user's point that had not been reported in the area for a slider-selected 3+/6+/9+ months, using the eBird API.
**Reason:** The eBird API can't support the core requirement. Nearby (geo) observation lookups are capped at 30 days back, and there is no eBird endpoint that returns observations within a lat/lng radius over a multi-month window. Detecting a 3–9 month *absence* by radius would require either county-level historic sampling (coarser than the radius, many calls, rate-limit pressure) or accumulating area history over time (no retroactive data). None delivered the user's actual definition well enough to be worth building.
**Decision:** Abandoned. If revisited, the blocker is the eBird API's lack of radius-scoped historical observation data — not effort. eBird's `obs/geo/recent/notable` flag is the nearest feasible primitive but does not match the 3/6/9-month rule.

---

## Bug post-mortem: desktop tab layout reset on every relaunch — 2026-05-28

**What broke (through v0.3.29):** In the Tauri desktop app, reordering or hiding tabs did not survive a relaunch — the layout reset to defaults. Web/Pi was unaffected.

**Root cause:** `tabLayout.ts` persisted to `localStorage`, which is ephemeral in Tauri's WKWebView (cleared on every relaunch). It was the only persisted setting bypassing the `storage` seam that API keys, map center, and default location already use.

**Fix (v0.3.30):** Route tab-layout persistence through the `storage` seam on desktop (file-backed, hydrated on mount), keeping the synchronous `localStorage` read on web/Pi for a flash-free first paint. Validation/serialization factored into `parseLayout`/`serializeLayout`. Also corrected four docs (README ×3, HELP.md) that wrongly claimed desktop API keys live in the Keychain.

**Implications:** Persisted UI settings must go through the `storage` seam, never `localStorage` directly — see CLAUDE.md. A minor first-paint frame at the default layout can occur on desktop launch before the seam hydrates (file read); acceptable.

---

## Responsive navigation: dropdown over bottom bar, overflow-driven collapse — 2026-05-27

**Decision:** On narrow screens the tab navigation collapses to a dropdown (not a bottom tab bar), and it collapses based on measured overflow rather than a fixed pixel breakpoint.

**Rationale:** A bottom bar tops out at ~5 destinations and the app has 8; a dropdown scales to any count and reuses the existing tab order/visibility model for free. Overflow-driven collapse avoids a "dead zone" where a fixed breakpoint leaves the bar overflowing but not yet collapsed — it holds at any tab count, label length, or zoom level.

**Implications:** The planned native mobile app should inherit this dropdown pattern rather than inventing a separate navigation. Future floating overlays on map-hosting views must clear Leaflet's z-index (see CLAUDE.md).

---

## Desktop app bug post-mortem: updater installed v0.3.7 on every update — 2026-05-27

**What broke:** Every in-app update installed the original v0.3.7 binary regardless of what version `latest.json` advertised. After updating, the About screen showed 0.3.7 and the updater immediately offered the same update again.

**Root cause — two compounding issues:**

1. **`createUpdaterArtifacts` not set:** `@tauri-apps/cli` v2.11.2+ changed the default for `createUpdaterArtifacts` from `true` to `false`. Without this setting explicitly enabled in `tauri.conf.json`, `tauri build` creates the `.app` and `.dmg` but skips the `.app.tar.gz` updater bundle. The original v0.3.7 build used an older CLI version where the default was `true`, so that one bundle was created. All subsequent builds silently skipped it.

2. **Stale artifact went undetected:** `release.sh` had no version verification step. It found the old v0.3.7 `.app.tar.gz` (timestamped 11:01 AM from the first ever build), signed it with the current key, and uploaded it with the new version in `latest.json`. The signature matched the bundle, so Tauri's verification passed — and users received v0.3.7.

**Fix (v0.3.21):**
- Added `"createUpdaterArtifacts": true` to `bundle` in `tauri.conf.json` — Tauri now generates `.app.tar.gz` and `.sig` on every build
- `release.sh` now deletes stale bundle artifacts before building and touches `src-tauri/src/main.rs` to force Cargo to relink
- `release.sh` now reads `CFBundleShortVersionString` from the built bundle's `Info.plist` and aborts if it doesn't match the expected version

**Implications:** Never remove `createUpdaterArtifacts: true` from `tauri.conf.json`. The version guard in `release.sh` is a safety net — if it ever fires, the build did not produce a usable updater bundle and the release must not proceed.

---

## Desktop app bug post-mortem: updater called exit(0) instead of relaunch() — 2026-05-26

**What broke (v0.3.13–v0.3.17):** After downloading an in-app update, the app exited but never relaunched automatically. Users had to manually click the Dock icon. If they were slow to relaunch, the experience was seamless (new binary had already replaced the old one on disk); if they missed it, the app just felt broken.

**Wrong fix (v0.3.17):** The changelog entry for v0.3.17 claimed "Tauri's updater spawns a background shell script that sleeps 1s, replaces the bundle, then calls `open -a` to relaunch." This was factually incorrect. Based on that wrong model, the code was changed from `relaunch()` to `exit(0)`, with a comment explaining that `relaunch()` would "pre-empt the shell script." No shell script exists.

**Actual mechanism (from Tauri v2.10.1 source):** `downloadAndInstall` on macOS calls `install_inner`, which synchronously: extracts the new bundle to a temp dir → renames the current `.app` to a backup temp dir → renames the new bundle to the original path → returns `Ok(())`. The Rust temp dirs are dropped on function return. By the time the JS `await` resolves, the new binary is already on disk at `current_exe`. There is no shell script.

**Actual fix (v0.3.19):** Changed back to `relaunch()`. `relaunch()` calls `Command::new(current_exe).spawn()` — since `current_exe` now points to the new binary (synchronous replacement already completed), this launches the correct updated version, then exits.

**Second bug fixed (v0.3.19):** `release.sh` mapped `x86_64 → x64` when building `latest.json`, writing `darwin-x64` as the platform key. Tauri's `updater_arch()` returns `"x86_64"` on Intel Macs, so the platform key `darwin-x86_64` was never present in `latest.json`. Intel Mac users never saw any update offered. Fixed by mapping `x86_64 → x86_64`.

**Implications:** Never `exit(0)` after `downloadAndInstall`. Always `relaunch()`. The synchronous replacement is complete before the Promise resolves. See CLAUDE.md Versioning section for the standing rule.

---

## Desktop app bug post-mortem: tauri-plugin-fs settings storage silently failed — 2026-05-26

**Decision:** `TauriStorage.getApiKey` / `setApiKey` / `deleteApiKey` and `getSetting` / `setSetting` / `deleteSetting` now use `localStorage` instead of `tauri-plugin-fs`. Large file data (CSV uploads, metadata) continues to use `tauri-plugin-fs` with `BaseDirectory.AppLocalData`.

**What broke:** Phase 4 shipped `tauri-plugin-fs`-based JSON settings in `AppLocalData/settings/`. In production, `setSetting` appeared to succeed (no JS exception, UI updated immediately) but nothing was written to disk. `getSetting` then returned null on the next read or app launch. API keys were lost on every relaunch; live key saves weren't reflected in other tabs. The root cause was never surfaced because the `getSetting` catch block swallowed all errors and returned null.

**What fixed it:** Replaced all three settings methods with synchronous `localStorage` calls (`sr-api-key-*`, `sr-setting-*` key prefixes). localStorage is reliable in Tauri's WebKit WebView, requires no permissions or plugin registration, and persists correctly across app launches and bundle replacements (the WebKit data store is not cleared by the Tauri updater).

**Implications:** `TauriStorage.getSetting` / `setSetting` / `deleteSetting` use localStorage. Do not revert to tauri-plugin-fs for JSON settings — the silent failure is difficult to diagnose and was reproduced across multiple versions. `tauri-plugin-fs` remains in use for actual file content (CSV data, metadata.json) where localStorage is inappropriate. The `SETTINGS_DIR` constant was removed from `storage.ts`; `DATA_DIR` and `META_PATH` remain.

**REVERSED (v0.3.16):** This fix proved incomplete. `localStorage` in Tauri's WKWebView was not reliably persistent for API keys — keys were lost on relaunch in subsequent testing. The actual root cause was `mkdir` not being called before `writeTextFile` in `tauri-plugin-fs`. All `TauriStorage` methods now use `tauri-plugin-fs` + `AppLocalData` exclusively. See: "Desktop app bug post-mortem: tauri-plugin-fs mkdir omission caused silent write failure — 2026-05-26." Do not use localStorage for API keys or settings in Tauri.

---

## Desktop app: two-seam architecture and phased migration — 2026-05-25 (completed 2026-05-25)

**Decision:** The desktop app is built around two permanent seams — transport (outbound HTTP via `TransportAdapter`) and storage (keys/settings/files via `StorageAdapter`). Phase 0 ships both seams with delegation-to-Web implementations; the backend is still required. Phases 1–6 migrate each capability to native Tauri implementations over future sessions.

**Rationale:** Migrating all backend dependencies at once creates a high-risk, large-change release. The seam + phased approach lets each capability be proven against the Python backend as a reference oracle, then flipped when the TypeScript output matches. Phase 0 goes to production with zero user-visible change.

**Migration complete (v0.4.0):** All six phases are done. The desktop app no longer requires the Python backend at all. Audit confirms no direct `fetch()` calls, no `/settings/*` calls, and no transport paths that fall through to `WebTransport` in Tauri mode. Phase summary:
- Phase 0 (v0.2.0): Transport + storage seams established, Tauri project scaffolded
- Phase 1 (v0.3.0): TypeScript weather formatter ported from Python (golden test suite)
- Phase 2 (v0.3.1): OS keychain via `keyring` Rust crate for API keys — **reversed in v0.3.16**; keychain requires `com.apple.security.keychain-access-groups` macOS entitlement (not configured) and fails silently; API keys now use `tauri-plugin-fs` + `AppLocalData` alongside file data
- Phase 3 (v0.3.2): Direct external API calls via `tauri-plugin-http`; 6 TypeScript services; tz via `tzf-rs`
- Phase 4 (v0.3.3): App data directory via `tauri-plugin-fs` for files + settings
- Phase 5 (v0.3.4): In-app updater via `tauri-plugin-updater`; minisign keypair; local `release.sh` script
- Phase 6 (v0.3.7): Verification + documentation; standalone confirmed; first notarized macOS release

**Implications:**
- The `transport` singleton (`frontend/src/lib/transport.ts`) and `storage` singleton (`frontend/src/lib/storage.ts`) are the permanent seam layer. New Tauri-specific code must route through them — do not add `isTauri()` branches outside these two files.
- The Vite proxy (`/weather`, `/taxonomy`, `/settings`, `/nominatim`, `/stats`, `/map`, `/version`) is still needed for web/Pi development mode. The Python backend remains the web/Pi runtime.
- The minisign private key is at `~/.tauri/snowraven-signing.key`. The corresponding public key is in `tauri.conf.json`. Run `./release.sh` (local Mac script) to build, notarize, sign the updater bundle, and publish to GitHub — credentials stay local. The script requires `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_PATH`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER_ID` to be set in the shell before running.

---

## Desktop app: Tauri v2 chosen as desktop wrapper — 2026-05-25

**Decision:** The desktop app uses Tauri v2 (system webview + Rust core), not Electron or a similar Chromium-embedding framework.

**Rationale:** Tauri bundles the OS system webview (WebKit on macOS, WebView2 on Windows) instead of Chromium, giving a binary roughly 4 MB vs 100 MB+ for Electron, lower memory overhead, and native OS appearance for dialogs and menus. The Rust core is a natural security boundary and the Tauri plugin system (stronghold, http, fs, updater) covers every Phase 2–5 capability.

**Implications:** Minor rendering differences across platforms are expected and acceptable — platforms use native OS conventions, not pixel-identical layouts. Building the desktop app requires the Rust toolchain and `@tauri-apps/cli`. The app identifier is `com.snowraven`; the Tauri project lives in `src-tauri/` at the repo root.

---

## Help documentation bundled at build time via Vite ?raw import — 2026-05-25

**Decision:** `docs/HELP.md` is imported in `HelpDocs.tsx` as `import helpText from '../../../docs/HELP.md?raw'`. Vite resolves this at build time and inlines the file content as a string literal in the bundle. No runtime fetch is made; the documentation is always available offline.

**Rationale:** The only valid input for the help panel is a developer-controlled static file -- not user data and not a remote URL. Build-time bundling eliminates an entire class of failure (network error, server unavailability) with no trade-off for this use case. It also means the app works offline on a Pi with no internet access.

**Implications:** `docs/HELP.md` must be updated whenever user-facing behavior changes -- it is the source of truth for both the in-app panel and the GitHub-rendered URL. `vite.config.ts` sets `server.fs.allow: ['..']` to allow the dev server to resolve the import outside `frontend/`; this is dev-only (production resolves at compile time). Any future static documentation added to the app should follow the same `?raw` pattern rather than a fetch-on-open approach.

---

## Tab layout stored in localStorage, not server-side — 2026-05-24

**Decision:** Tab order and visibility preferences are stored per-browser in `localStorage` (`sr-tab-layout` key), not in the server's `data/` directory or user account.

**Rationale:** SnowRaven is a single-user self-hosted tool, but multiple people sometimes use the same server installation. Server-side storage would give all users one shared layout. `localStorage` gives each browser an independent preference without requiring user accounts.

**Implications:** Tab layout preferences are not portable across browsers or devices. Clearing browser data will reset the layout. This is acceptable given the audience — power birders who set up their own server. Do not add server-side tab layout storage without a user identity model.

---

## Tab order uses lazy useState initializer to prevent first-paint flash — 2026-05-24

**Decision:** Both `tabLayout` and `activeTab` are initialized with lazy `useState` initializers (`useState(loadTabLayout)` and `useState(() => { const l = loadTabLayout(); return ... })`), which run synchronously before React's first paint.

**Rationale:** A `useEffect`-based load would initialize with the default order, render the tab bar once, then re-render with the stored order — causing a visible flash where tabs snap to their custom positions. The lazy initializer runs before the first render so the correct order is displayed immediately.

**Implications:** This requires two calls to `loadTabLayout()` (one for each piece of state). The cost is two synchronous localStorage reads at mount — negligible. Do not replace these with module-level singletons: module-level state persists across HMR hot reloads in development and can cause stale data after file edits. The two-call pattern is correct.

---

## Stats: Top Locations Leaflet map added to Geographic Stats — 2026-05-24

**Addition:** A Leaflet `MapContainer` now renders at the top of the Geographic Stats card, above the two location text lists. The prior "map removed" decision (FR-37, see below) referred to a personal-sightings history map — this is a different map showing ranked top locations as numbered pins.

**Two marker sets:**
- Green filled circle SVG markers (via `L.divIcon`) for top-by-checklists locations, numbered 1–10
- Blue filled square SVG markers for top-by-species locations, numbered 1–10
- A location in both lists gets one of each marker at the same coordinates

**Layout and sizing:** `TopLocationsBoundsFitter` is a null-rendering child inside `MapContainer` that calls `map.invalidateSize()` then `fitBounds` (or `setView` at zoom 12 for single-marker cases) inside a `useEffect`. `invalidateSize()` must be called first — without it, Leaflet doesn't know the container's true dimensions at mount time (the classic "grey corner" bug). Markers hidden when no locations have lat/lng data.

**Implications:** The divIcon SVG uses hardcoded hex colors (`#2D8653`, `#3B82F6`) — acceptable per the established Leaflet popup convention (CSS vars are not reliably inherited inside Leaflet's detached DOM). If you add more Leaflet maps to the Stats tab, use the same `invalidateSize()` pattern at the start of the bounds-fitting `useEffect`.

---

## Birding Stats: protocol breakdown removed from Temporal Stats — 2026-05-24

**FR-15 of the stats-tab-enhancements PRD specified a protocol pie chart in the Temporal Stats section.** It was intentionally not implemented there.

**User direction:** "Remove protocol breakdown from the temporal stats since it already shows up in effort and methodology."

**Current state:** The full protocol section (segmented bar + legend) lives exclusively in Effort & Methodology. It does not appear in Temporal Stats.

**Implications:** Do not re-add a protocol chart to Temporal Stats. If protocol data is needed there in a future session, confirm the user wants duplication before implementing.

---

## Birding Stats: accumulation default changed from 'yearly' to 'total' — 2026-05-24

**Previous behavior (v0.1.6):** The granularity toggle defaulted to `'yearly'`. The `'total'` mode did not exist.

**New behavior (v0.1.9):** A fourth mode `'total'` was added (Total / Yearly / Monthly / Weekly order). `useState<Granularity>('total')` makes Total the default. Total mode renders a step-line chart with one point per new life species.

**Implication:** The prior decision ("accumulation granularity toggle added beyond PRD — 2026-05-23") described the default as `'yearly'`. That is now stale. The correct default is `'total'`. Do not reset it to `'yearly'`.

---

## Birding Stats: map, Big Year, and average-observers removed at user direction — 2026-05-23

**PRD FR-37 (sighting map), FR-58 (Big Year dropdown), and FR-43 (average observers) were intentionally not implemented.**

- **Map (FR-37):** The Stats tab shares the same observation data as the Species Detail tab's sighting map and the Map Explorer tab. User directed removal: "Remove the map since it is redundant."
- **Big Year (FR-58):** Removed per user direction: "Remove the redundant big year dropdown."
- **Average observers (FR-43):** Replaced with an observer distribution chart (bar chart of checklists by number of observers: 1, 2, 3, etc.) per user direction: "Instead of average observers, list the total number of lists with 1, 2, 3, etc. for as many observers as there are in the file."

**Implications:** If a future session re-adds any of these, the original PRD acceptance criteria (FR-37, FR-43, FR-58) are in `pipeline/birding-stats-tab/prd.md`. The observer distribution chart is a direct replacement for the average — do not add both.

## Birding Stats: accumulation granularity toggle added beyond PRD — 2026-05-23

**User-requested addition:** The PRD specified a simple accumulation line chart. The user added a Weekly / Monthly / Yearly granularity toggle.

**Implementation:** `getPeriodKey(date, granularity)` and `formatPeriodLabel(key, granularity)` are module-level helpers in `BirdingStats.tsx`. Weekly uses ISO-style `YYYY-WNN` keys; monthly uses `YYYY-MM`; yearly uses `YYYY`. The `accGranularity` state drives both.

**Implications:** The granularity toggle is a user-facing control on the accumulation chart card. Default is `'yearly'`. X-axis `tickFormatter` receives the period key and formats it for display.

## Birding Stats: SESSION_NOW_MS avoids react-hooks/purity lint violation — 2026-05-23

**Problem:** `Date.now()` called inside `useMemo(() => Date.now(), [])` was still flagged by `react-hooks/purity` (eslint-plugin-react-hooks v7) because the `useMemo` callback runs during render.

**Fix:** `const SESSION_NOW_MS = Date.now()` declared at module level (computed once at import time, not during render). All components in `BirdingStats.tsx` that need "now" for recency coloring reference this constant.

**Implications:** Module-level constants are safe from `react-hooks/purity` because they are not evaluated during React's render cycle. This is the correct pattern for any "stable snapshot of now" needed across a component's lifetime. Do not revert to `useMemo(() => Date.now(), [])` — it will restore the lint error.

## buildGraphData takes explicit interval; auto-detection removed — 2026-05-23

**Change:** `buildGraphData(obs, mlRows, interval)` now requires an explicit `interval: 'yearly' | 'monthly'` parameter. The previous auto-detection logic (`const useMonthly = years.size <= 1`) is gone.

**Rationale:** Auto-detection silently chose an interval based on data span, making it impossible for users to override it. The Graph Options card requires explicit user control. The old heuristic (single-year data → monthly) was also confusing — a species seen only in one year could suddenly show monthly granularity after filtering by date range.

**Implications:** `graphInterval` state lives in the `SpeciesDetail` parent (not inside `SightingsGraph`). All call sites must pass an explicit interval. `SightingsGraph` is now a controlled component — it receives `data`, `useMonthly`, `viewMode`, and `hasML` as props. Do not re-add auto-detection; the Graph Options card is the source of truth for interval.

## Co-occurrence uses Set<string> submissionId lookup for O(1) performance — 2026-05-23

**Decision:** The `coOccurrence` useMemo builds `targetIds: Set<string>` from filtered `speciesObs` submissionIds, then iterates `phase.observations` once — checking `targetIds.has(o.submissionId)` for each row. Per-species shared-checklist counts are accumulated in a `Map<string, Set<string>>` (name → Set of shared submissionIds).

**Rationale:** `phase.observations` can be 10,000+ rows across all species. A naive O(n²) comparison between target and all observations would be unusable. The `Set.has()` approach makes the inner loop O(1) per row — total cost is O(n) where n is `phase.observations.length`. `SUBMISSION_ID_RE` (`/^S\d+$/`) gates all submissionId use, consistent with the existing pattern in the codebase.

**Implications:** The minimum threshold (≥2 shared checklists) is applied after the full pass — do not short-circuit the Set population. `normalizeSpeciesName()` is applied inside the loop when `mergeSubspecies` is true so co-occurring subspecies variants aggregate to the parent name. Target species (the one currently selected) is excluded before inserting into the per-species map.

## Targeting model: "Is Target" means missing ≥1 media type, not zero-ML-only — 2026-05-23

**Change:** `targetSpecies` useMemo and `fetchTargetCodes` in `MapExplorer.tsx`, and the "Is Target" pill filter in `LifeList.tsx`, all use `!hasAll` where `hasAll = types?.has('Photo') && types?.has('Audio') && types?.has('Video')`. The previous definition was "species not in `mlRows` at all."

**Rationale:** A birder who has photos of a species but no audio recording still has a meaningful gap. Zero-ML-only targeting was too coarse.

**Implications:** The `mediaTypes` map (built from `phase.mlRows`) is the source of truth for what each species HAS. `missingTypes` is derived as `ALL_TYPES.filter(t => !mediaTypes.get(comName)?.has(t))`. For a species entirely absent from `mlRows`, `mediaTypes.get(name)` returns `undefined` and all three types are "missing" — correct. Do not change this back to absence-based targeting without updating all three locations in sync.

## fetchTargetCodes must use identical logic to targetSpecies — 2026-05-23

**Bug:** After expanding the targeting model to `!hasAll`, the Map Explorer showed only zero-ML species on the map even though `targetSpecies` correctly computed partial-coverage species. Partial-coverage species had no entry in `speciesCodeMap`, were silently dropped by `.filter(Boolean)` in `handleFindSightings`, and since at least one zero-ML code remained, the fallback on-demand fetch was never triggered.

**Cause:** `fetchTargetCodes` still used the old zero-ML logic when pre-fetching taxonomy codes. `targetSpecies` and `fetchTargetCodes` had diverged.

**Fix:** `fetchTargetCodes` now builds its own `mediaTypesMap` from `mlRows` (same as the `mediaTypes` useMemo) and uses the same `!hasAll` condition. Both compute the same set of species.

**Implications:** `targetSpecies` (for display/count) and `fetchTargetCodes` (for taxonomy code pre-fetch) must always use the same target condition. If the definition of "Is Target" ever changes again, update both in the same commit. The `.filter(Boolean)` in `handleFindSightings` silently drops species with no code — this is intentional for graceful degradation, but it means a divergence between these two functions will manifest as silent missing data, not an error.

## TargetMarkers groups pins by locId to prevent overlapping labels — 2026-05-23

**Bug:** Multiple target species seen at the same eBird location each got their own Leaflet marker at identical coordinates, stacking invisibly on top of each other. Labels overlapped and were illegible.

**Fix:** `TargetMarkers` groups `DisplayTargetPin[]` by `locId` using a `useMemo`. Single-species groups render the species name + missing-type icons. Multi-species groups render "N species" as the label with a popup listing all species, their missing types, a recency tier badge, date, and checklist link.

**Implications:** The representative pin for a group uses the pin with the most recent `recentDate` (for recency tier color). The popup shows all species in the group — the user can see each species and its individual missing types. Do not render one marker per species when species share a `locId`; the map becomes unreadable.

## Cross-tab navigation uses requestedFilter prop + useEffect consumption pattern — 2026-05-23

**Decision:** `App.tsx` holds `mediaListFilter: 'is-target' | undefined`. The Map Explorer's "N target species" button calls `navigateToMediaList`, which sets both `activeTab` and `mediaListFilter` simultaneously. `LifeList` receives `requestedFilter` and `onRequestedFilterConsumed` props. A `useEffect` watching `requestedFilter` activates the "Is Target" pill, then immediately calls `onRequestedFilterConsumed()` to reset App's `mediaListFilter` to `undefined`.

**Rationale:** LifeList uses display toggling (never unmounts), so its `useEffect` fires immediately when the prop changes — no timing issue. Resetting to `undefined` after delivery means subsequent normal navigations to the Media List tab do not re-activate the filter. Repeat clicks on the target count work because App goes `undefined → 'is-target'` each time, which is a change that triggers the effect.

**Implications:** This pattern is correct for any cross-tab "navigate + pre-apply filter" use case. The key requirements: (1) the receiving component must always be mounted (display toggle, not conditional render); (2) the filter state must be reset to `undefined`/`null` immediately after delivery so it isn't sticky; (3) the sending callback must set both the tab AND the filter in the same React update (batch).

---

## eBird API `dist` parameter is km, not miles — 2026-05-23

**Bug:** Both `/map/hotspots` and `/map/recent-obs` eBird API calls received `dist=${radius}` where `radius` is stored in miles (UI options: 5 / 10 / 25 / 50 mi). The eBird API expects `dist` in km. Public hotspots were clipped to ~60% of the intended area. Personal pins used `distanceMiles() <= radius` (miles vs miles, already correct), so they appeared farther out than public hotspots for the same radius.

**Fix:** Both fetch calls now compute `const distKm = Math.round(radius * 1.60934)` and pass `dist=${distKm}`. The personal pin haversine comparison is unchanged.

**Implications:** Any future call to an eBird geo endpoint (`/ref/hotspot/geo`, `/data/obs/geo/recent`, etc.) must convert miles → km before passing `dist`. The `radius` state in `MapExplorer.tsx` is always in miles (matching the UI labels). Never pass it raw to an eBird URL.

## `const run = async () => {...}; run()` is the established pattern for useEffect + async — 2026-05-23

**Problem:** `eslint-plugin-react-hooks` v7 introduced the `react-hooks/set-state-in-effect` rule, which flags any call to a setState setter (or a useCallback that internally calls setState) in the synchronous body of a `useEffect`. Three instances had been failing CI since v0.1.6: `fetchKeyStatus()` in `App.tsx`, `setFilterIsTarget(true)` in `LifeList.tsx`, and `fetchTargetCodes(...)` in `MapExplorer.tsx`.

**Fix:** Wrap the call in a local async function and invoke immediately:
```typescript
useEffect(() => {
  const run = async () => { await myAsyncAction() }
  run()
}, [myAsyncAction])
```
For sync-only state updates, the same wrapper works: `const run = async () => { setState(value) }; run()`.

**Implications:** This is the project-wide pattern for any `useEffect` that triggers async work or setState. Do not call setState (or useCallback setters) directly in the synchronous effect body — wrap them. The `SESSION_NOW_MS` pattern (module-level constant, not useMemo) remains the correct fix for `react-hooks/purity` violations; this pattern addresses the separate `react-hooks/set-state-in-effect` rule.

## Leaflet divIcon inner content must use `display: inline-block` — 2026-05-23

**Bug:** Media target label pills rendered with a tiny colored oval (≈12px wide) that didn't span the species name. The pill background was correct, but the text overflowed it visibly.

**Cause:** Leaflet's `DivIcon` defaults to `iconSize: [12, 12]`, which applies `width: 12px; height: 12px` inline to the outer icon element. Any inner `<div>` (which is `display: block` by default) inherits that 12px width and constrains its own background to 12px — while the text overflows with `white-space: nowrap`, appearing uncontained. The outer element has `overflow: visible`, so text is visible, but the colored background is not.

**Fix:** Added `display: inline-block` to the inner content div. An `inline-block` element sizes to its content regardless of parent width, so the background spans the full species name.

**Implications:** Any Leaflet `divIcon` that renders a pill or label with a colored background must use `display: inline-block` on the innermost content div — not `display: block`. Do not use `iconSize: [12, 12]` (the default) as a sizing mechanism for text labels; it constrains the background but not the text, producing an invisible mismatch.

## Per-tab file upload removed; Settings is the sole file source — 2026-05-22

**Decision:** `BreedingCodeList`, `LifeList`, and `SpeciesDetail` no longer have drop zones, file input refs, `processFile`, `handleDrop`, `handleFileInput`, or "Load different file" buttons. Data comes exclusively from files stored in Settings.

**Rationale:** Per-tab upload created two parallel mental models — one where you upload per session, one where you store a default. With stored defaults working reliably, the per-tab path adds complexity without value. A single authoritative source (Settings) is simpler to explain and simpler to maintain.

**Implications:** Any future tab that works with stored files must follow the same pattern: Settings-only source, `setup-required` phase when absent, `error` phase for fetch/parse failures. Do not re-add per-tab upload UI — if a user needs to use a different file, that is a Settings update, not a session-level override.

## `setup-required` phase is distinct from `error` — 2026-05-22

**Decision:** The three stored-file tabs use `setup-required` when no file is configured in Settings, and `error` only when a file is stored but the fetch or parse failed. The old `idle` tag is gone.

**Rationale:** `idle` was ambiguous — it served as both "waiting for first upload" and "after reset". With per-tab upload removed there is no user-facing waiting-for-upload state. The `setup-required` phase specifically means "go configure this in Settings first"; `error` means "something went wrong technically". These require different UI: `setup-required` shows the SetupRequired guidance component; `error` shows a terse error message with a retry/settings option.

**Implications:** When adding a new stored-file tab, initialize to `loading-saved`, transition to `setup-required` on null-file responses, and reserve `error` for genuine technical failures. The `SetupRequired` component accepts `title`, `body`, `steps[]`, and `onGoToSettings` — reuse it rather than writing per-tab guidance UI.

## ListComparer My List mode fetches stored file fresh on each Compare click — 2026-05-22

**Decision:** When `listAMode === 'my-list'`, `handleCompare` fetches `GET /settings/files/ebird` at the moment the Compare button is clicked, not when the mode is toggled. The stored file is never pre-fetched on mount just because My List mode is active.

**Rationale:** Pre-fetching on mode toggle would mean the stored file is parsed into memory before the user clicks Compare — wasted work if they switch modes again. Fetching fresh on Compare also avoids stale data if the user updates their Settings file during a session.

**Implications:** There is a short async pause when Compare is clicked in My List mode (the fetch + parse). This is covered by a `comparing` state that disables the button and shows "Loading…". Keep this pattern for any future comparer feature that reads stored files — do not pre-fetch on mode toggle.

## tsc --noEmit and tsc -b are not equivalent type checkers — 2026-05-22

**Bug:** A type cast (`as React.SVGProps<SVGTextElement>`) introduced in v0.0.39 passed `tsc --noEmit` (used by `npm run typecheck`) but failed `tsc -b` (used by `npm run build` and `update.sh`) with 4 errors. The Pi update broke because the build step failed.

**Cause:** `tsc --noEmit` and `tsc -b` use different resolution paths. In project-references mode (`-b`), TypeScript applies stricter composite-project constraints and resolves types differently in some edge cases — particularly around spread props onto JSX components, where inferred types from spread objects may be checked more strictly than explicit prop types.

**Fix:** Removed the type cast and inlined the axis props directly on each `XAxis` and `YAxis` call. TypeScript infers the correct prop types from usage context without a cast.

**Implications:** Always verify changes with `npm run build` (not just `npm run typecheck`) before deploying. The `typecheck` script is useful for fast feedback but is not a substitute for a full build check. Do not use `as SomeType` to silence prop-spread type errors on third-party JSX components — inline the props instead so TypeScript can check them in context.

**Second instance — v0.0.45 (2026-05-22):** Adding optional parameters to `handleFindHotspots` and `handleFindSightings` so the address search could pass coordinates directly made them incompatible with React's `MouseEventHandler` type when used directly as `onClick={fn}`. `tsc --noEmit` passed; `tsc -b` failed. Fix: wrap in arrow functions (`onClick={() => fn()}`) so the MouseEvent is absorbed. Always wrap event handlers that take non-event arguments — never pass them directly as `onClick`.

## package-lock.json must be committed to the repository — 2026-05-22

**Bug:** `frontend/package-lock.json` existed locally but was never committed. `npm ci` on the Pi fell back to a stale lockfile from a previous manual install, installing mismatched package versions. `npm audit` failed with ENOLOCK because it requires a lockfile to assess dependencies.

**Fix:** Committed `package-lock.json` and patched the `brace-expansion` DoS vulnerability it surfaced. The lockfile is now a tracked file.

**Implications:** `package-lock.json` must be kept committed and up to date. Any time dependencies change (`npm install`, `npm audit fix`, adding or removing packages), the updated lockfile must be included in the same commit. `npm ci` (used by `update.sh`) requires the lockfile — it is the mechanism that guarantees the Pi installs exactly the same versions as the development machine.

## update.sh uses subshells for directory-sensitive steps — 2026-05-22

**Bug:** `update.sh` used `cd dir && ... && cd ..` chains. When a step failed mid-chain, `cd ..` was not reached, stranding the shell in the subdirectory. The subsequent `cd backend` then resolved relative to `frontend/` and failed with "No such file or directory", triggering the error trap and masking the original build failure.

**Fix:** Replaced both chains with subshell syntax: `(cd dir && ...)`. Directory changes inside a subshell are scoped to that subshell — the parent shell's working directory is unaffected regardless of success or failure.

**Implications:** Any future step in `update.sh` that requires changing directory must use the subshell pattern. Do not use `cd && ... && cd ..` chains — a failure will leave the shell in the wrong directory for all subsequent steps.

## leaflet.heat loaded via dynamic import after window.L assignment — 2026-05-21

**Decision:** `import 'leaflet.heat'` as a static side-effect import is replaced with a dynamic `import('leaflet.heat')` inside `HeatmapLayer`'s `useEffect`, called only after `(window as any).L = L` is set. A module-level `heatLoaded` ref prevents re-importing.

**Rationale:** `leaflet.heat` is a legacy IIFE that reads the global `L` at load time. Vite's ESM bundling does not expose the module-imported `L` as `window.L`, so a static import fails at runtime with "Can't find variable: L". Setting `window.L = L` before a dynamic import ensures the IIFE finds it. Static imports are hoisted before any module code executes, so ordering cannot be controlled via static imports alone.

**Side effect:** Vite automatically code-splits `leaflet.heat` into its own chunk (4.84 kB) because of the dynamic import, reducing the initial bundle.

**Implications:** Do not convert this back to a static import. Any other legacy Leaflet plugin that reads `window.L` at module load time must follow the same pattern: set `window.L = L` then dynamically import the plugin.

## Species Detail graph: buildGraphData extracted to a library module — 2026-05-21

**Decision:** `buildGraphData` and `GraphPoint` were extracted from `SpeciesDetail.tsx` to `frontend/src/lib/sightingsGraph.ts` to make the pure function testable without React component dependencies.

**Rationale:** Unit testing a function embedded in a React component file requires rendering the component, which adds Leaflet, Recharts, and react-leaflet to the test environment. Extracting to a standalone module reduces the test setup to zero (no DOM, no mocks) and keeps the component file focused on rendering.

**Implications:** `buildGraphData` is the canonical source for graph data; do not implement equivalent logic inline in `SightingsGraph`. If future graph features need new derived fields (e.g. rolling average), add them to `sightingsGraph.ts` and add corresponding tests.

## Expand/collapse removed from all tabs; eBird backup path removed from Media List — 2026-05-21

**Changes:**
- All four data tabs (Life List, Breeding Codes, Media List, Species Detail) had their "Show all / Collapse" toggle and `onExpandedChange` callback removed. `App.tsx` always uses `minHeight: 100vh`. Tabs render in natural page flow at all times.
- `backend/routers/ml.py` (Cornell CDN HEAD-request proxy) and its tests deleted. `POST /ml/media-types` endpoint is gone. The eBird backup CSV path in `LifeList.tsx` is fully removed — ML export is now the only accepted input.
- **Unbounded / Normal toggle** added to Life List and Breeding Codes tabs: sets the table wrapper to `width: max-content` in unbounded mode so the page itself scrolls horizontally on mobile. In Normal mode the wrapper uses `overflowX: auto`. In Breeding Codes unbounded mode, the sticky species column (`position: sticky; left: 0`) is suppressed so the full table pans as one unit.

**Why `width: max-content` rather than just removing `overflowX`:** Removing `overflowX: auto` from the wrapper without setting `width: max-content` leaves the wrapper at its parent's width. The wrapper's `border` then appears as a grey vertical line mid-table where the right edge falls. `max-content` makes the wrapper shrink-wrap the table, so the border correctly surrounds the full table width.

**Implications:** Do not re-add the `onExpandedChange` / `isExpanded` pattern. Any table that needs mobile horizontal exploration should use the `wideMode` / `width: max-content` approach. The `POST /ml/media-types` backend endpoint is permanently removed — do not re-add it. If a future feature needs Cornell CDN media-type lookup, rebuild it from the prior implementation in git history.

## Header pinned in expanded view — 2026-05-12

**Bug:** When "Show all" was activated on the Media Life List or Life List Comparer tabs, the SnowRaven header and tab bar remained pinned at the top of the viewport. This wasted space on mobile and produced cluttered print output.

**Cause:** The outer app container used `height: 100vh; overflow: hidden` with the header as `flexShrink: 0`. The tab panels scrolled internally (`overflowY: auto`), so the header never left the screen regardless of scroll position.

**Fix:** `App.tsx` tracks an `isExpanded` boolean. When true, the outer container switches to `minHeight: 100vh` (no overflow clip) and the active tab panel drops its `flex: 1 / overflowY: auto` constraints, letting the whole page scroll normally and the header scroll away. `LifeList` and `ListComparer` notify the parent via `onExpandedChange` callbacks; the parent resets `isExpanded` on tab switch.

**Implications:** Any future tab that adds a "Show all" / expand toggle should follow the same `onExpandedChange` callback pattern.

## ML lookup timeouts — 2026-05-12

**Bug:** Media Life List batch lookups would progress quickly for the first few batches then slow to a crawl or fail entirely with "Couldn't reach the Macaulay Library." The symptom was CDN rate limiting triggered by burst concurrency.

**Cause:** The original implementation fired up to 75 concurrent HEAD requests per 25-ID batch (3 URLs × 25 IDs via `asyncio.gather`). Over many batches the cumulative load tripped the Cornell CDN's rate limiter.

**Fix:** Three changes in combination: (1) `asyncio.Semaphore(8)` at module level caps concurrent CDN connections; (2) CDN probing within each `_detect_type` call is now sequential and Photo-first — most assets resolve in 1 request instead of 3; (3) frontend batch size reduced 25→10 with a 500ms inter-batch delay. Individual batch errors changed from `break` to `continue` so a single failed batch no longer aborts the entire lookup.

**Implications:** The Cornell CDN has undocumented rate limits. Keep outbound concurrency low (semaphore ≤ 8) and batch sizes small (≤ 10) for any future feature that probes it at scale.

## Breeding code CSV parser rewritten to handle multiline fields — 2026-05-14

**Bug:** Breeding Codes tab showed "no breeding codes found" for some eBird backup files, even when breeding codes had been entered.

**Cause:** The original parser split the CSV content by newlines (`content.split(/\r?\n/)`) before parsing fields. This broke any row where a quoted field contained an embedded newline — for example, a location name like `"River\nTrail"` entered before the breeding code column. The row would be split across two "lines," the breeding code would land at the wrong column index, and the `BREEDING_CODE_MAP.has()` check would silently fail.

**Fix:** Replaced the line-split approach with a single-pass character iterator (`parseCSV`) that tracks quote state across newlines. Quoted newlines are consumed as part of the field; unquoted newlines end the row. Also strips UTF-8 BOM on first character.

**Implications:** Any future CSV parser in this project should use a full character-level parser, not `content.split(/\r?\n/)`. The line-split approach is incorrect for RFC 4180 CSV files with embedded newlines in quoted fields.

## eBird Breeding Code column stores code + label, not just the code — 2026-05-14

**Bug:** Breeding Codes tab showed "No species with breeding codes found in this file" for every eBird backup file, even when breeding codes had been entered.

**Cause:** eBird stores the full label text alongside the code abbreviation in the Breeding Code column — e.g. `CN Carrying Nesting Material`, not just `CN`. The parser did an exact `BREEDING_CODE_MAP.has()` lookup against the raw cell value, which never matched any of the 23 expected abbreviations.

**Fix:** Split the raw cell value on whitespace and take the first token before the map lookup (`rawCode.split(/\s+/)[0]`). Single-token bare codes are unaffected; full-label values yield the correct abbreviation.

**Implications:** Never assume eBird CSV column values contain only the code abbreviation — inspect actual export data before writing a lookup. The test suite now includes a case using the real eBird format.

## Taxonomic sort restored and extended to ML export — 2026-05-15

**Prior state:** The A–Z / Taxonomic sort button was removed in an earlier session and replaced with column-header sort only. `SortOrder` was replaced by `SortState { column, dir }`. The `PRODUCT_CONTEXT.md` entry said "taxonomic sort is gone."

**Change:** A–Z / Taxonomic toggle re-added to the Media List and Breeding Codes tabs (the Life List Comparer already had it). `SortState` extended with `nameSortMode: 'az' | 'taxonomic'`. Column-header sorts preserved — the toggle acts as a tiebreaker for count columns.

**Extension beyond prior behavior:** Taxonomic sort now works for ML export, not just eBird CSV. ML export entries have `taxonomicOrder: Infinity`; `getOrder()` falls back to `taxonOrders[commonName] ?? taxonOrders[normalizeSpeciesName(commonName)] ?? Infinity` from the `POST /taxonomy/codes` fetch. The normalizeSpeciesName fallback handles subspecies/domestic entries with parenthetical names (e.g. "Mallard (Domestic type)") — they resolve to the parent name, which is in the map. The endpoint was extended to return `orders` alongside `codes` — no new endpoint.

**Implications:** When changing sort column via a header click, always use `{ ...sort, column, dir }` to preserve `nameSortMode`. A wholesale `sort` replacement will drop the user's A–Z vs Taxonomic preference.

## API key settings: KEY_MAP allowlist + in-process env update — 2026-05-15

**Decision:** The `apikeys.py` router validates `key_name` against a closed `KEY_MAP` dict before performing any `.env` write. Unknown key names return 404. Saving a key calls both `set_key(ENV_FILE, var, value)` (writes `.env`) and `os.environ[var] = value` (in-process).

**Rationale:** The allowlist eliminates any risk of writing arbitrary environment variables from user input. The dual write — file + process env — means the key works immediately without restarting uvicorn, which is the UX behaviour the feature is designed to deliver.

**Implications:** `KEY_MAP` is the single source of truth for which keys the UI can manage. Adding a new key (e.g. a future third API) requires one entry in `KEY_MAP` and a new `KeyRow` in `Settings.tsx`. The GET endpoint returns actual key values (not masked) — this is by design since the frontend handles masking; rely on CORS + local-only deployment rather than server-side redaction.

## eBird backup "species comments" column is named "Observation Details" — 2026-05-15

**Discovery:** The per-species notes field in the eBird backup CSV (`MyEBirdData.csv`) is named `Observation Details`, not `Species Comments`. The initial `parseEbirdObservations` parser looked for `species comments` and found nothing, so every species showed zero comments.

**Fix:** `speciesCommentsIdx` now matches both `h === 'species comments' || h === 'observation details'`. Tests cover both column names.

**Implications:** Always inspect actual eBird export data before writing column-name lookups. Do not assume the UI label matches the CSV header — the field is labelled "Species Comments" in the eBird UI but exported as "Observation Details". The dual-match pattern is the correct approach for any column that eBird may rename between export versions.

## Category filters pre-filter entries before passing to BreedingCodeTable — 2026-05-15

**Decision:** Category filter logic runs in `BreedingCodeList` before passing `categoryFilteredEntries` to `BreedingCodeTable`. `BreedingCodeTable` continues to apply the individual code `filter` on top of whatever entries it receives.

**Rationale:** `BreedingCodeTable` already has internal filter logic for individual codes. Rather than adding a `categoryFilter` prop and duplicating predicate logic inside the table, pre-filtering entries in the parent achieves the correct AND composition for free — `BreedingCodeTable` is unmodified and remains unaware of categories.

**Implications:** Any future filter layer added above `BreedingCodeTable` should follow the same pattern: apply the new filter in `BreedingCodeList` and pass the reduced entry set down. Do not add filter props to `BreedingCodeTable` unless the filter genuinely belongs inside the table component.

## Dark mode: CSS custom property token system is the theming architecture — 2026-05-15

**Decision:** All color values in every component are expressed as `var(--sr-*)` CSS custom properties. Hardcoded hex or RGB values are not permitted in component files. The light and dark palettes are defined entirely in `globals.css` (`:root` for light, `[data-theme="dark"]` for dark). The `data-theme` attribute on `<html>` is the single switch.

**Rationale:** Centralising all color decisions in one file means adding a third theme, changing a palette value, or adjusting contrast requires editing one file rather than hunting through every component. It also makes theming auditable — the full palette is visible at a glance.

**Implications:** Every future feature must use `var(--sr-*)` tokens for all colors — never hardcoded hex. When a new color is needed, add a token to `globals.css` for both `:root` and `[data-theme="dark"]` before using it. If inline styles need rgba() with a dynamic alpha, use the `--sr-*-rgb` triplet pattern: `rgba(var(--sr-tier-4-rgb), 0.08)`.

## Dark mode: consent-gated localStorage for UI preferences — 2026-05-15

**Decision:** The theme preference (`sr-theme` key in localStorage) is never written without explicit user consent. Selecting Light or Dark applies the theme immediately in the DOM but shows an inline prompt first — "Save preference" writes to localStorage; "This session only" dismisses without writing. Once consent has been given for a browser, future changes write silently (the check is whether `sr-theme` is already present). Selecting System removes the key.

**Rationale:** SnowRaven is a self-hosted tool, but some users run it on shared or institutional browsers where they may not expect local storage writes. The consent step makes the storage explicit and reversible. The "apply immediately, ask second" order preserves a snappy UX while keeping the consent meaningful.

**Implications:** Any future feature that writes a user preference to localStorage should follow the same pattern: apply the effect immediately, then prompt before committing to storage. Do not write to localStorage in a `useEffect` on first render — that bypasses the consent step. All localStorage access must be wrapped in try/catch for private browsing compatibility.

## Multi-dimensional filter state uses an object, not a string union — 2026-05-14

**Decision:** The Media List filter state moved from a single `MediaFilter` string union (`'all' | 'no-photo' | ...`) to a `MediaFilterState` object with one key per dimension (`{ photo: 'has'|'no'|null, audio: ..., video: ... }`). The Breeding Codes filter state moved from a single `string` to `Set<string>`.

**Rationale:** A string union encodes only one active selection at a time, which made AND logic across dimensions impossible without a fundamentally different type. The object form makes per-dimension independence structurally enforced and AND logic trivial. `Set<string>` gives O(1) membership testing and naturally prevents duplicates; JSON-incompatibility is not a concern since filter state is never serialised.

**Implications:** Any future filter surface with multiple independent dimensions should use an object (one key per dimension) rather than a string union. Any filter surface that allows selecting from an open-ended set of values should use `Set<string>`.

## Settings Tab: fixed-filename storage and loading-saved phase — 2026-05-15

**Decision:** Server-side files use fixed on-disk names (`ebird-backup.csv`, `ml-export.csv`); the client-supplied filename is stored in `metadata.json` for display only and never used to construct a path.
**Rationale:** Eliminates path traversal risk entirely — the upload destination is a constant, not derived from user input.
**Implications:** Any new stored file type follows the same pattern: fixed name in `data/`, original name in `metadata.json`. The metadata sidecar always lives at `data/metadata.json`; add new keys to it rather than creating separate sidecar files.

**Decision:** `BreedingCodeList` and `LifeList` initialize to `{ tag: 'loading-saved' }`, not `{ tag: 'idle' }`.
**Rationale:** Without this, the upload zone briefly flashes before the auto-load fetch completes, which is jarring when a stored default exists.
**Implications:** Any future tab that checks for a stored default on mount must start in `loading-saved`.

## ML export as preferred input for Media Life List — 2026-05-12

**Decision:** Offer the Macaulay Library "My Media" CSV export as the primary input method for the Media Life List, with the eBird backup CSV as a secondary fallback. Input type is auto-detected from the CSV header — no user selection required.

**Rationale:** The ML export contains `Format` (Photo/Audio/Video) directly in each row, eliminating the backend CDN lookup entirely. This avoids rate limiting, latency, and network dependency. It also requires no Macaulay Library API keys. The two-zone upload UI makes the preferred path prominent without removing the eBird path.

**Implications:** The ML export path is entirely client-side. The eBird path still requires the `POST /ml/media-types` backend endpoint and batch CDN probing. Both paths share the same `LifeListEntry` type and downstream table/filter components.

## React hooks must be declared before any early return — 2026-05-20

**Bug:** SnowRaven showed a blank white page after loading in v0.0.34. All users with a stored eBird file were affected immediately on auto-load; others were affected the first time they loaded a file into the Breeding Codes tab.

**Cause:** `BreedingCodeList.tsx` declared three `useMemo` hooks after conditional early returns (`loading-saved`, `idle/error`). On the initial render, the component returned early and those hooks were not called. When `phase` transitioned to `'ready'`, the early returns did not fire and React tried to call three additional hooks — a count mismatch from the previous render. React threw "Rendered more hooks than during the previous render" and unmounted the entire component tree.

**Fix:** The three memos (`counties`, `filteredRows`, `displayData`) were moved before all early returns, with a `phaseData = phase.tag === 'ready' ? phase.data : null` extraction and null-safety guards. Also wrapped `phaseEntries` in `LifeList.tsx` in its own `useMemo` to fix a related `react-hooks/exhaustive-deps` warning that had been failing ESLint in CI.

**Implications:** Any component with a phase/state union that uses early returns must declare all hooks before the first early return. A conditional variable like `phase.tag === 'ready' ? phase.entries : []` that appears to be safe is not — the `[]` literal creates a new array reference every render, making any useMemo that depends on it re-compute continuously. Wrap it in `useMemo` instead.

## Tab Filters: raw row types enable post-parse filtering — 2026-05-20

**Decision:** `parseBreedingCodes` and `parseMLExport` now return a `rows` field alongside the aggregated `entries`. `BreedingCodeRow[]` and `MLExportRow[]` hold per-observation data (date, county, code/format); filtering runs on these raw rows and re-aggregates via `aggregateBreedingRows()` / `aggregateMLRows()` on every filter change.

**Rationale:** The aggregated `entries` (species-level) have no date or county information — those are discarded during aggregation. The only way to filter by county or date and then re-aggregate correctly is to retain the raw per-observation rows and re-run aggregation downstream. Storing both (raw rows for filtering, aggregated entries for display) is the correct data model.

**Implications:** Any future filter dimension on Breeding Codes or Media List must filter against `BreedingCodeRow[]` / `MLExportRow[]`, not against `entries`. `aggregateBreedingRows()` and `aggregateMLRows()` are the canonical re-aggregation functions — do not derive filtered species counts by mutating existing `entries`.

## Tab Filters: Nominatim rate limiting via in-process asyncio.Lock — 2026-05-20

**Decision:** `POST /nominatim/counties` uses a module-level `asyncio.Lock()` and `await asyncio.sleep(1.0)` inside the lock after each outbound OSM request, enforcing ≤1 request/second. An in-process `_cache: dict[tuple[float, float], Optional[str]]` stores county lookups for the session.

**Rationale:** OpenStreetMap's Nominatim usage policy requires ≤1 req/sec and a meaningful `User-Agent`. The lock + sleep pattern is the simplest correct serialization for a single-process FastAPI app — no external queue or Redis needed. The in-process cache avoids redundant lookups within a session (a common case when many observations share coordinates).

**Implications:** The lock serializes all Nominatim calls globally. If a future feature adds another Nominatim use, it should reuse the same `_rate_lock` and `_cache` in `nominatim.py` rather than creating a second lock. For multi-process or multi-instance deployments, the rate limit guarantee is only per-process — a Redis-backed queue would be needed if SnowRaven ever runs with multiple workers.

## Tab Filters: eBird Media List path switched from parseLifeList to parseEbirdObservations — 2026-05-20

**Decision:** `LifeList.tsx` switched the eBird CSV processing path from `parseLifeList` (species-level aggregation, no county/date) to `parseEbirdObservations` (row-level with all fields). A local `obsToLifeListEntries` helper re-aggregates `ObservationEntry[]` → `LifeListEntry[]` for downstream CDN lookup compatibility.

**Rationale:** `parseLifeList` discards date and county during aggregation. County and date filtering requires row-level data. Rather than retrofitting `parseLifeList` with optional raw-row output (which would duplicate the `parseEbirdObservations` pattern), the path simply switches to the parser that already has what's needed.

**Implications:** `parseLifeList` is now unused by `LifeList.tsx`. It remains in the codebase because `ListComparer` still uses it. Do not delete it. `obsToLifeListEntries` is an internal helper in `LifeList.tsx` — it is not a general utility and should not be extracted to a shared module.

## Map Explorer tab height uses calc(100vh - 178px), not flex: 1 — 2026-05-22

**Decision:** The Map Explorer tab panel in `App.tsx` uses `height: 'calc(100vh - 178px)'` and `overflow: 'hidden'` rather than `flex: 1`.

**Rationale:** The outer app div uses `minHeight: 100vh` (not `height: 100vh`). In a `minHeight` context, flex children cannot compute a bounded height from `flex: 1` because the container has no fixed height to distribute. Without a bounded height, the Leaflet `MapContainer` (which requires an explicit height) collapses to zero. The 178px accounts for the header (~132px) + tab bar (~44px). This is consistent with the Leaflet requirement that the map container have a defined height.

**Implications:** Any future map tab must use an explicit `calc(100vh - N)` height rather than relying on flex fill. If the header or tab bar height changes, update the 178px offset. Do not switch the outer app container to `height: 100vh` — doing so would break the natural page-flow behavior of all other tabs that rely on `minHeight`.

## Map Explorer: DivIcon CSS vars use the style attribute, not SVG presentation attributes — 2026-05-22

**Decision:** Teardrop DivIcon colors are set via `style="fill:var(--sr-map-*)"` on the SVG element, not via `fill="..."` SVG presentation attributes.

**Rationale:** SVG presentation attributes (e.g. `fill="#2D8653"`) do not support CSS custom properties. The `style` attribute inside an HTML string (as used by `L.divIcon`) does support them — the browser evaluates the style in the normal cascade. This allows the map pins to correctly change color in dark mode without hardcoding separate icon instances for each theme.

**Implications:** Always use the `style` attribute (not SVG presentation attributes) when setting colors via CSS custom properties inside DivIcon HTML strings. `CircleMarker.pathOptions.fillColor` is an exception — it sets a presentation attribute internally and cannot use CSS vars; use the hardcoded hex for the light-mode color there.

## Map Explorer: escHtml() required for external API strings in DivIcon HTML — 2026-05-22

**Decision:** `escHtml()` (HTML entity encoding) is applied to any external API string interpolated into an `L.divIcon` HTML string. Currently used on `pin.comName` in the Media Targets label pill.

**Rationale:** `L.divIcon` sets `innerHTML` directly. An unescaped string from an external API (e.g. eBird species names) could inject HTML. eBird species names are benign in practice, but the XSS surface was hardened during the Stage 7 security review to establish the correct pattern for the future.

**Implications:** Any future feature that interpolates external data (API responses, user-entered text) into a DivIcon HTML string must pass the value through `escHtml()`. Static SVG strings used for our own icons are not API data and do not require escaping.

## Map Explorer: SightingMarkers fitBounds defers via Leaflet resize event when container is hidden — 2026-05-22 (revised 2026-05-22)

**Decision:** `SightingMarkers` calls a `tryFit` function that checks `map.getSize()` before calling `fitBounds`. If the container reports 0×0 (tab is hidden), it registers a Leaflet `resize` listener and waits. When `AutoSizeMap`'s `ResizeObserver` fires `invalidateSize()` (which emits a `resize` event), `tryFit` is called again with the correct container size and fitBounds succeeds. A `hasFitted` ref prevents re-fitting on filter changes.

**Rationale:** `MapContainer` renders when data loads (phase → ready), which may happen while the user is on a different tab and the Map Explorer panel is `display: none`. In that case, Leaflet sees a 0×0 container and `fitBounds` calculates wrong bounds — or the subsequent `invalidateSize()` pans the map away from the fitted location. The original `useEffect(fn, [])` approach failed for this reason. The `resize` event is the correct signal that the container is now correctly sized.

**Implications:** Any future Leaflet sub-component that needs to call `fitBounds` or `setView` on mount must guard against a 0×0 container. Check `map.getSize()` first; if zero, defer via `map.on('resize', fn)`. `HotspotMarkers` and `TargetMarkers` use `key={pins.length}` for data-driven remounts — they only render after an explicit user action (Find Hotspots button), so the tab is always visible and the 0×0 case does not apply to them.

## Map Explorer: forward geocoding reuses the existing Nominatim rate lock — 2026-05-22

**Decision:** `GET /nominatim/search` acquires the same module-level `_rate_lock` as `POST /nominatim/counties` before calling OSM and sleeps 1 second inside the lock after each request.

**Rationale:** One rate lock per module (not one per endpoint) ensures the ≤1 req/sec policy is enforced across all OSM traffic regardless of which endpoint triggers it. Adding a second lock would allow two concurrent OSM calls from the same process, violating the OSM usage policy.

**Implications:** Any future Nominatim endpoint in `nominatim.py` must acquire `_rate_lock` before calling OSM. Do not create a second lock or bypass the existing one.

## Map Explorer: address geocode triggers fetch via override parameters, not state read — 2026-05-22

**Decision:** `handleFindHotspots` and `handleFindSightings` accept `(overrideLat?: number, overrideLng?: number)`. When the `AddressSearch` callback fires, it calls `setLat(...)` / `setLng(...)` and then calls the handler with the resolved values as explicit arguments rather than relying on the state to have updated.

**Rationale:** React state updates are batched and asynchronous. Calling the handler immediately after `setLat`/`setLng` would read stale state values for `lat`/`lng`. Passing the coordinates explicitly as override parameters bypasses the asynchrony entirely without needing `useRef` or a `useEffect` dependency on lat/lng.

**Implications:** Any future callback that must trigger a fetch with just-set state values should use the same override-parameter pattern. Do not use `useEffect([lat, lng], fn)` to fire fetches after geocoding — that approach triggers unintended fetches whenever the user manually edits the coordinate fields.

## Map Explorer: sidebar-to-map pan uses panTarget state + MapPanner child — 2026-05-22

**Decision:** Sidebar items that should pan the map (nearest-10 list rows) set a `panTarget: {lat, lng} | null` state in the parent. `MapPanner` is a null-rendering child component inside `MapContainer` that calls `map.panTo()` when `panTarget` changes, then notifies the parent via `onDone` to clear it.

**Rationale:** `useMap()` must be called inside `MapContainer`'s context. Sidebar components are outside `MapContainer` and cannot call `useMap()` directly. The `panTarget` state bridge connects the two trees without requiring refs or imperative handles.

**Implications:** Any future feature that needs to programmatically control the map from outside `MapContainer` (pan, zoom, fitBounds) should use this same state-bridge pattern: set a piece of state in the parent; consume it in a null-rendering child inside `MapContainer`.

## Map Explorer: subId captured from most-recent observation per group — 2026-05-22

**Decision:** In `GET /map/recent-obs`, the group dict initialises with `"subId": obs.get("subId", "")`. When a newer observation (`obsDt`) is found for the same group, both `recentDate` and `subId` are updated together: `entry["subId"] = obs.get("subId", "")`.

**Rationale:** The eBird API already returns `subId` on every observation. The only change needed was to capture it and keep it in sync with the most-recent-observation tracking that was already in place for `recentDate`. This ensures the popup checklist link points to the checklist that actually contains the most recent sighting, not an older one.

**Implications:** `subId` in the response reflects the checklist of the most recent sighting for each `(speciesCode, locId)` group. The frontend validates subId against `/^S\d+$/` before rendering — empty strings and unexpected formats are silently suppressed. Do not render an href with an unvalidated subId.

## Map Explorer: recency tier pins use green CSS tokens, not purple — 2026-05-22

**Decision:** Media Target pins use three green-family tokens (`--sr-map-target-fresh`, `--sr-map-target-mid`, `--sr-map-target-old`) rather than purple variants of `--sr-map-target`.

**Rationale:** Purple is reserved for breeding code tier indicators throughout the app. Using purple for recency tiers on the map would create a visual collision with breeding code semantics. Green is the SnowRaven brand accent and is already used for visited hotspot pins and the primary accent — the recency scale reads naturally as a green intensity gradient.

**Implications:** The legacy `--sr-map-target` token remains unchanged (single-color purple, used for the legend color swatch). The three new tokens carry the recency tier semantics. Do not add purple variants for recency — if a new tier or threshold is added, use the existing green gradient family.

## Map Explorer: mobile sidebar is a CSS-only overlay, not a JS-driven layout — 2026-05-22

**Decision:** The mobile sidebar overlay is controlled entirely by CSS `@media (max-width: 640px)` classes (`sr-map-sidebar-overlay`, `sr-map-sidebar-hidden`, `sr-map-filters-btn`, `sr-map-sidebar-close`, `sr-map-backdrop`). React state (`sidebarOpen`) drives conditional rendering of the backdrop and Filters button, and adds/removes the `sr-map-sidebar-hidden` class. No JS `window.innerWidth` checks or resize listeners.

**Rationale:** Consistent with the existing `.sr-two-col` and other responsive patterns in globals.css. CSS breakpoints are more reliable than JS window-size polling and avoid layout-shift during React hydration. The `sr-map-content` parent has `position: relative` so the absolute-positioned overlay and backdrop are scoped to the map panel, avoiding z-index conflicts with the app header and tab bar.

**Implications:** The floating Filters button is `display: none` on desktop via CSS and is also conditionally rendered only when `!sidebarOpen` — double-gated so it can never appear on desktop. Any future responsive feature in MapExplorer should use the same CSS-class pattern rather than JS window checks. Do not add `window.addEventListener('resize', ...)` to MapExplorer.

**Correction (v0.1.1):** The initial implementation put `display: flex`, `flex-direction: column`, and `overflow: hidden` on the sidebar div as inline styles. This silently broke the mobile overlay: React inline styles have CSS specificity 1,0,0, which overrides any class-based rule (0,2,0 for two classes) — so `display: none` from `.sr-map-sidebar-hidden` was always ignored and the sidebar was permanently visible. These properties were moved to the `.sr-map-sidebar-overlay` base CSS class. z-indices were also raised from 30/40/50 to 1050/1100/1200 — the original values were below Leaflet's internal layers (tile pane: 200, controls: 1000). Rule: **never put `display` on an element whose CSS class needs to toggle it.** Rule: **always check Leaflet's z-index range (up to 1000) when placing elements that must appear above the map.**

## Map Explorer: default location stored as data/map-defaults.json, not in Settings .env — 2026-05-22

**Decision:** The saved map default location (`lat`, `lng`, `dist`) is stored as `data/map-defaults.json` (a fixed-filename JSON file), not in the `.env` file alongside API keys, and not in browser localStorage.

**Rationale:** `.env` is for secrets (API keys). Map coordinates are not sensitive and shouldn't be mixed with credential storage. `localStorage` would be per-browser and would not survive clearing browser data or using a different browser. The `data/` fixed-filename pattern (established by `ebird-backup.csv`, `ml-export.csv`, `metadata.json`) keeps all persistent user data server-side in one place, consistent and backup-friendly.

**Implications:** `GET /settings/map-defaults` returns 404 when no defaults are saved (file absent), not `null` in a 200 body — consistent with the existing file endpoint pattern. The 404 is the canonical signal for "no defaults stored." Do not change this to a 200 with null. MapExplorer and Settings both handle 404 as a no-op (leave inputs blank).

**Desktop correction (v0.3.12):** In the Tauri desktop app, map defaults are stored in `localStorage` under `sr-setting-map-defaults` via `storage.setSetting()` / `storage.getSetting()` in `TauriStorage`. The file-based rationale above applies to the web/Pi runtime only. `tauri-plugin-fs` proved unreliable for JSON settings (writes failed silently), so all `TauriStorage.getSetting` / `setSetting` calls now use localStorage instead.

**Reversed (v0.3.16):** The localStorage approach for settings (including map defaults) was found to be unreliable and has been reversed. All `TauriStorage.getSetting` / `setSetting` calls now use `tauri-plugin-fs` + `AppLocalData/data/settings.json` via a `writeJson` helper that always calls `mkdir` before writing. Do not use localStorage for settings in Tauri.

## Tab Filters: 3-tier county resolution for ML export — 2026-05-20

**Decision:** ML export county resolution runs in three passes: (1) read the `County` column from the ML CSV if present; (2) cross-reference against the eBird backup by location name (using `rawRows` from `parseEbirdObservations`); (3) call `POST /nominatim/counties` with unresolved lat/lng pairs. Passes run in sequence; each row stops after the first pass that resolves it.

**Rationale:** The ML export often has a `County` column that covers most rows immediately. eBird backup cross-reference resolves most of the remainder without any network call. Nominatim is only invoked for rows that couldn't be resolved locally, minimizing outbound requests and respecting OSM rate limits.

**Implications:** County resolution is async and runs after the ML parse completes. `countyResolution: 'idle' | 'resolving' | 'done'` drives the loading indicator in the county dropdown. Filters are available before resolution completes — `countyFilter` just won't have all counties until `'done'`. Any future feature that needs county data from ML exports should reuse this same `resolveMLCounties` pattern and the shared `nominatim.py` rate limiter.

---

## Desktop app bug post-mortem: tauri-plugin-fs mkdir omission caused silent write failure — 2026-05-26

**Reversal of prior entry:** The entry dated 2026-05-26 ("tauri-plugin-fs settings storage silently failed") concluded that `localStorage` was the correct fix for API key and settings persistence. That fix proved incomplete and has been reversed. All `TauriStorage` methods now use `tauri-plugin-fs` + `AppLocalData` exclusively.

**What the prior fix missed:** `localStorage` is unreliable for persistent storage in Tauri's WKWebView — API keys written in one session were lost on relaunch. The real root cause of the original silent failure was that `mkdir` was not called before `writeTextFile`. When the `AppLocalData/data/` directory does not yet exist (fresh install, first write after deletion), `writeTextFile` returns without error but writes nothing to disk.

**Actual fix (v0.3.16):** All writes go through a `writeJson(path, data)` private helper that always calls `await mkdir(DATA_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })` before `writeTextFile`. All reads go through `readJson<T>(path)` which checks `exists()` before `readTextFile`. Storage paths:
- `data/api-keys.json` — eBird and OpenWeather API keys (`getApiKey` / `setApiKey` / `deleteApiKey`)
- `data/settings.json` — app settings via `getSetting` / `setSetting` / `deleteSetting`
- `data/metadata.json` — stored file metadata (original filename, upload date)
- `data/ebird-backup.csv`, `data/ml-export.csv` — large file data (unchanged)

**Implications:**
- Do not use `localStorage` for API keys or settings in Tauri — unreliable in WKWebView across app launches.
- Do not use the system Keychain (`keyring` crate) — requires macOS `com.apple.security.keychain-access-groups` entitlement that is not configured; fails silently at runtime.
- The `mkdir-before-write` pattern is mandatory. Omitting it produces silent failures: `writeTextFile` does not throw when the parent directory is absent, but nothing is written.
- All `TauriStorage` methods use `tauri-plugin-fs`. Do not split storage between localStorage and tauri-plugin-fs — maintain one source of truth per data type.

---

## Desktop app: tauri-plugin-http v2.5.x requires explicit URL scope in capabilities — 2026-05-26

**Bug (v0.3.18):** All `tauriFetch` calls to external HTTPS endpoints (eBird API, OpenWeather, Nominatim) were blocked after plugin updates. Taxonomy lookups failed silently, Map Explorer returned no results, and the symptom resembled lost API keys (it wasn't — the fetch calls were throwing permission errors that were swallowed upstream).

**Cause:** `tauri-plugin-http` v2.5.x separates plugin command enablement from URL access. `"http:default"` in capabilities registers the plugin's IPC command set (the JS `fetch` shim is wired up) but grants access to no URLs. A separate `"http:allow-fetch"` permission with an explicit `allow` URL pattern is required for any network request to succeed.

**Fix:** Added to `src-tauri/capabilities/default.json`:
```json
{ "identifier": "http:allow-fetch", "allow": [{ "url": "https://**" }] }
```

**Implications:** Any Tauri v2 project using `tauri-plugin-http` v2.5.x or later must include `http:allow-fetch` with a URL scope alongside `http:default`. `http:default` alone is not sufficient. The `https://**` pattern allows all HTTPS origins — scope it more narrowly if needed. When `http:allow-fetch` is missing, `tauriFetch` throws a permission error at runtime; if the caller has a silent catch, this manifests as mysteriously empty results rather than a visible error.

---

## Desktop app: silent catch blocks masked root cause of taxonomy lookup failure — 2026-05-26

**Bug:** Map Explorer "Find Target Sightings" always showed "Could not look up species codes from eBird. Try rebuilding caches in Settings." The error persisted after rebuilding caches and with a valid eBird API key configured.

**Root cause:** Two independent silent catch blocks formed a nested error-swallowing chain:
1. `getTaxonomyCodes` in `taxonomyService.ts` had `catch { return [] }` — converted every error (network failure, HTTP error, permission error) into an empty array, making a failed fetch indistinguishable from a successful empty response.
2. `MapExplorer.tsx`'s on-demand taxonomy fetch had `catch { /* ignore */ }` — silently swallowed the empty result, leaving `speciesCodeMap` empty so `.filter(Boolean)` dropped all species codes.

Both failures were active simultaneously with the missing `http:allow-fetch` scope, so fixing either one in isolation still produced an error (just from a different point in the chain). The compounded silent failures made the root cause appear to be a cache or key issue rather than a capability misconfiguration.

**Fix:**
- `getTaxonomyCodes`: errors now propagate with descriptive messages (`'Could not reach eBird...'` for network errors, `'eBird returned HTTP N. Check your API key in Settings.'` for HTTP errors, response validation errors); network errors wrapped with `{ cause: err }` to satisfy the `preserve-caught-error` ESLint rule.
- `MapExplorer.tsx` on-demand fetch: `catch` now calls `setTargetsError(err instanceof Error ? err.message : '...')` and returns early.

**Implications:** Never use bare `catch { return [] }` or `catch { /* ignore */ }` in async code paths that produce UI results. Silent catches convert any error into ambiguous empty state, making bugs undiagnosable and allowing independent failures to compound invisibly. Any catch block that does not re-throw must at minimum set a visible error state. The `preserve-caught-error` ESLint rule (which requires `{ cause: err }` on `new Error()` wrapping a caught error) is a load-bearing lint rule — do not disable it.

---

## Desktop app: location requires a native CLLocationManager command, not navigator.geolocation — 2026-05-26 (revised 2026-05-26)

**Context:** When implementing "Use my location" in the Map Explorer, two approaches were attempted and failed before reaching the correct solution.

**Attempt 1 (wrong):** Use `tauri-plugin-geolocation`. Discovery: the macOS desktop implementation (`desktop.rs`) is a complete no-op stub — `get_current_position` returns all-zero coordinates. Plugin is iOS/Android only.

**Attempt 2 (wrong):** Use `navigator.geolocation` in production Tauri builds (served from `snowraven://` custom protocol, which WKWebView treats as a secure context). Discovery: wry's `WryWebViewUIDelegate` implements `WKUIDelegate` for file panels and media capture, but does NOT implement `webView:requestGeolocationPermissionFor:initiatedByFrame:decisionHandler:` — the delegate method macOS 12+ requires to show the system location permission dialog. Without it, every `getCurrentPosition()` call is silently denied with `PERMISSION_DENIED` before the OS is consulted. No SnowRaven entry ever appears in System Settings → Location Services.

**Fix (v0.3.23):** Native Rust Tauri command `get_location` in `src-tauri/src/location.rs` using `CLLocationManager` directly via `objc2-core-location`. Bypasses WKWebView's geolocation mechanism entirely. Also required: `com.apple.security.personal-information.location` entitlement in `src-tauri/entitlements.plist` — without it, hardened runtime silently blocks CoreLocation.

**Implications:**
- Do not use `tauri-plugin-geolocation` for macOS desktop — no-op stub.
- Do not use `navigator.geolocation` for Tauri desktop location — wry's UIDelegate doesn't implement the macOS 12+ geolocation permission method; all requests are silently denied.
- The correct path is `invoke('get_location')` → Rust CLLocationManager command.
- `tauri-plugin-geolocation` remains registered for future iOS/Android; TypeScript never invokes it on desktop.
- Entitlement `com.apple.security.personal-information.location` is required in `entitlements.plist` for CLLocationManager to work under hardened runtime.
- Testing location always requires a production build with signing and the entitlement embedded. Dev mode shows `'dev-mode'` error immediately.
- Web over HTTP shows `'insecure-context'` error — browsers silently deny geolocation on non-secure origins without any dialog.

---

## Performance: defer-mount + explicitly-invalidated shared caches + parse-once derivation — 2026-06-07 (v0.5.16)

**Context:** An 8-way perf audit found redundant work at startup and per tab: every tab mounted at first paint (firing CSV parses, a synchronous breeding-code parse, and `/taxonomy/codes` posts even when landing on Weather), the ~20k-row backup and the ML export were each parsed independently by multiple tabs, and desktop fetches had no timeout.

**Decisions:**
- **Defer-mount everything but Weather.** Tabs mount on first open and stay mounted (`DEFERRED_TABS` + `mountedTabs` gate in `App.tsx`), moving startup data work off the first-paint critical path.
- **Shared caches use EXPLICIT invalidation, not content-keying.** `observationsCache`/`mlExportCache` return the cached parse with no re-read or content compare; they're invalidated from Settings on the file's save/clear (generation guard against mid-flight invalidation). Settings is the only writer, so coverage is complete. (Earlier content-keying re-read the 6 MB file on every cache hit.)
- **Parse once, derive the rest.** Breeding Codes derives from the shared observations parse (`deriveBreedingData`) instead of a second full CSV walk; an equivalence test locks it to `parseBreedingCodes`. Taxonomy downloads coalesce via an in-flight promise.
- **All desktop fetches go through `lib/tauri/http.ts`** (a `tauriFetch` wrapper with an AbortController timeout) so a stalled network surfaces a typed error instead of hanging the spinner forever.

**Implications:** New tabs are added to `DEFERRED_TABS` and gated. Any code path that writes a stored file MUST call the matching `clear*Cache()` (the cache no longer self-detects content changes). New desktop service calls import `tauriFetch` from `./http`, never the plugin directly.

---

## Tides: keyless NOAA, observed-else-predicted with hi/lo interpolation, bundled station list — 2026-06-07 (v0.5.17)

**Context:** Add historical tide alongside the weather lookup. NOAA Tides & Currents (CO-OPS) is free and keyless, but its data model is uneven: reference stations have continuous predictions, subordinate stations only publish daily high/low events, and observed gauge data exists only for some stations/times.

**Decisions:**
- **Keyless, dual-runtime, independent of weather.** Backend `routers/tide` + `services/{noaa,tide,tide_stations}`; desktop `tideService` via the `/tide/` transport dispatch. The tide box loads concurrently with and independently of weather (one can succeed if the other fails).
- **Observed else Predicted, with interpolation.** Prefer the observed gauge range over the checklist duration; otherwise predicted — continuous for reference stations, else **interpolate** between the surrounding high/low for subordinate stations (the common coastal case).
- **Bundled station list, generated at build time** (`scripts/build-tide-stations.mjs` → JSON in both `frontend/src/assets` and `backend/staticdata`), so nearest-station selection needs no live catalog call.
- **US-only with override.** Coarse US bounding boxes flag outside-US; >25 mi flags a far station; both are notices with a one-tap override, never hard blocks. PRIVACY_POLICY updated for the NOAA call.

**Implications:** Regenerate the bundled station list (re-run the script) when refreshing NOAA stations. The tide formatter is split from the weather formatter's attribution so "Copy Weather and Tide Together" emits one SnowRaven credit with NOAA credited inline.

---

## Quality/accessibility sweep: in-place splits, canonical date formatter, keyboard markers, weather-block detectors — 2026-06-08 (v0.5.18)

**Context:** A maintain-lane sweep addressing date formatting, large components, keyboard access to the map, and a Data Quality stat — plus two user-facing additions (Comparer weather/tide, Media Comments). Two audit items ("accessibility & simplification", "grow component test coverage") were found **already shipped in v0.5.11** and verified — dropped, not redone.

**Decisions:**
- **Canonical date formatting via `lib/formatDate.ts`** with a Settings picker (month-first default / day-first / ISO). One formatter app-wide. The eBird Y-M-D *display* dates must never TZ-shift; only true instants (e.g. upload time) convert to local — `formatDate` is the single intended conversion point.
- **Keyboard-operable map markers via focusable in-view sidebar lists**, not focusable MapLibre markers (which aren't natively focusable — the standing constraint). The in-view Sightings/Hotspots lists are keyboard targets wired to the same popup, so the map is operable without a mouse.
- **Component splits are behavior-preserving and in-place** (BirdingStats 2036→1893, SpeciesDetail 1793→1461, MapExplorer 2249→1515, extracted into `lib/`, `statsPrimitives/`, `speciesDetail/`, `map/`). No behavior change — verified by the existing suite (596 tests).
- **Weather/tide-block detection in Statistics → Data Quality** via `hasSnowravenWeatherBlock` / `hasRaincrowWeatherBlock` / SnowRaven-tide detectors (Raincrow keyed on `raincrow.app`). Counts + % of checklists carrying each block type.

**Implications:** Use `formatDate` for any user-facing date; never hand-format or call `toLocaleDateString` ad hoc. New map "things on the map" need a corresponding focusable sidebar entry for keyboard access. The block detectors are heuristic (string-keyed) — keep them in sync if the weather/tide block formats change.

---

## Media-stats parser is additive/guarded; batched-branch merges need a build (tsc -b), not just vitest — 2026-06-09 (v0.5.20, batched with 0.5.19)

**Context:** Two efforts parked independently off 0.5.18 — `date-unify-media-comments-hint` (0.5.19) and `media-statistics-expansion` (0.5.20) — were batched into one 0.5.20 release on the Mac.

**Decisions:**
- **ML export parsing stays a thin reader; aggregation lives in `lib/mediaStats.ts`.** `parseMLExport` was extended to read Age/Sex, Behaviors, Time, Year/Month, and community-rating columns **additively and guarded** (`'' / null / 0` when absent), so older/column-light exports keep parsing unchanged. Age/sex counts are **per individual** with Unknown shown honestly. Each Media-card section renders only to the extent the export carries that annotation.
- **Date formatting is fully unified** on the canonical `formatObsDate`/`formatDate` path (the Weather-tab checklist line was the last stray); programmatic jump-scrolls go through one reduced-motion-aware helper (`lib/scroll.ts`).

**Implications (batched merges):** When batching two branches that both extend a shared type, **run the release build (`tsc -b`), not just `vitest`** — vitest uses esbuild and strips types, so it won't catch a test fixture that's gone stale against an extended interface. Here the date-unify branch's `MLExportRow` test fixture was missing the fields media-stats added; `tsc -b` caught it, vitest didn't. Keep test fixtures in sync when widening a type. The first-merged branch fast-forwards; the second conflicts on the version files + CHANGELOG top (both bump from the same base) — resolve version to the higher, keep both CHANGELOG sections.

---

## Media Comments are per-asset only — the eBird Observation Details is excluded — 2026-06-09 (v0.5.21)

**What:** The Multimedia tab's Media Comments section now lists, counts, and searches only the comment on the media itself — the asset **Caption** and **Media notes**. The eBird **Observation Details** field is no longer treated as a media comment.

**Why:** Observation Details is the observation-level comment, and the Macaulay Library export copies it onto *every* media asset from the same observation. Surfacing it made the same comment repeat across many list entries (on the real 2073-asset export: 876 → 308 entries once excluded; ~568 were duplicated observation comments). Only the per-asset Caption / Media notes are genuinely about a specific photo, recording, or video.

**Mechanism:** `lib/mediaComments.ts` only — `MediaCommentField` narrowed to `mediaNotes | caption`; `FIELD_ORDER`, `MEDIA_COMMENT_LABEL`, `hasMediaComment`, and `filterAndSortMediaComments` dropped `observationDetails`. The field stays parsed on `MLExportRow` (still available data), just not surfaced. Consumers (`MediaCommentsSection`, `LifeList`) call the helpers unchanged.

**Implications:** "Media comment" in this app means a per-asset comment. If a future feature needs the observation-level comment, read `MLExportRow.observationDetails` directly rather than re-adding it here.

---

## Statistics → Media card trimmed: dropped Format coverage + Community ratings, renamed Age & sex → "Photos Tagged With Age or Gender" — 2026-06-09 (v0.5.22)

**What:** Cleanup of the 0.5.20 Media card after first real use. Removed the **Format coverage** section, removed the **Community ratings** section, renamed **Age & sex of your subjects** → **Photos Tagged With Age or Gender** (donuts "Age"/"Gender", center label "tagged"), and added a `<Divider>` above the Top-N rankings in `BirdingStats` so the last section can't run into "Most photographed".

**Why:** Format coverage (the per-species format-combination breakdown) was redundant with — and less clear than — the Documentation coverage section directly above it. Community ratings was removed at the user's request ("for now"). The rename uses the user's preferred "gender" wording. The rankings overlap was a real layout bug: the rankings block had no separator above it.

**Mechanism:** `components/MediaStatsSections.tsx` (removed two section blocks; renamed one) + `BirdingStats.tsx` (gated divider before rankings). **`computeMediaStats` still computes `ratings` and `completenessMix`** — only the rendering was removed, so re-adding either section is UI-only (no parser/aggregation work). Internal types/data (`Sex`, `s.sexMix`, `SEX_COLOR`) kept their names; the "gender" change is display-only.

**Implications:** To bring back ratings or format coverage, just re-add the JSX in `MediaStatsSections` (the data is already on `MediaStats`). Any new "things below the media chart" must sit above the rankings divider or carry their own separator.

---

## Named Birds: track individuals via [name:…] tags in species comments — 2026-06-09 (v0.5.23)

**What:** A feature to track individual birds the user names in eBird species comments (`[name:Winky]`, `[name:one-leg-pete]`). New `lib/namedBirds.ts` parses the tags and groups sightings; a shared `components/NamedBirdsTable.tsx` renders a sortable list with per-bird checklist drill-down; surfaced both as a new **Named Birds** tab (`components/NamedBirds.tsx`) and a **Named Individuals** section on Species Detail.

**Decisions:**
- **Identity = name + species.** Grouping key is `name.toLowerCase()::normalizeSpeciesName(species).toLowerCase()` — the same name on two species is two individuals; name match is case-insensitive; subspecies fold to the parent.
- **One sighting per checklist.** Sightings dedupe by `submissionId` per bird (a parent + subspecies row of the same checklist, both tagged, count once) — matching the codebase's checklist-counting convention (`Set<submissionId>`).
- **The `[name:…]` regex is length-bounded** (`[^\]]{0,120}`), NOT an unbounded lazy/greedy capture. `speciesComments` is uncapped user CSV text parsed synchronously on the main thread for every observation; an unbounded capture backtracks catastrophically (ReDoS) on an unclosed `[name:` + long run and freezes the UI. The bound keeps it linear; the value is trimmed in JS.
- **New tab via `tabLayout.ts`** — adding `'named-birds'` to `ConfigurableTab`/`DEFAULT_TAB_ORDER`/`TAB_LABELS` is backward-compatible: `parseLayout` appends any default tab missing from a saved layout, so existing users gain the tab without losing their order.

**Implications:** Any future parser over uncapped user text must bound its quantifiers (ReDoS). New cross-checklist per-bird aggregations should dedupe by submission id. Adding a tab is a `tabLayout.ts` + `App.tsx` (icon, DEFERRED_TABS, tabpanel) change; `parseLayout` handles migration.
