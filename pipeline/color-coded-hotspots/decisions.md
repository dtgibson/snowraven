# Decisions — color-coded-hotspots

## Stage 4 — The Designer (design direction 1, 2026-08-24)

1. **`zero` and `quiet` share one fill token (`--sr-hotspot-zero`) — the
   Architect's flagged shared-token question is CONFIRMED, not split.**
   "Asked, and the answer is zero" is one visual idea (the hollow pin: a
   `--sr-hotspot-zero` rim around a pale `--sr-hotspot-pale` inner disc).
   The two states can never co-occur (zero is modes 1/2, quiet is mode 3)
   and their popup/legend wording differs ("Only spuh and slash entries so
   far." vs "No species reported in the last {window}"). Two identical-valued
   tokens would be a name waiting to drift.

2. **`--sr-hotspot-nodata` is a PALE fill (#EDE9E3) whose 3:1 boundary is
   supplied by the dark stroke ring — a deliberate deviation from the
   schema's uniform "every state fill ≥3:1 vs land" guard clause.**
   "Never birded by me" must read as absence; any guard-compliant dark gray
   inevitably reads as "something," which is precisely the FR-08 confusion
   the state exists to prevent. This is the pin-scale twin of the county
   overlay's "unrecorded = outline only" semantic, and ring-supplied
   visibility is the documented shipped teardrop practice (`teardropImageData`'s
   stroke comment, F066). The Engineer's `hotspotContrast.test.ts` should
   encode nodata's clause as: fill is LIGHT (≥3:1 against each of the other
   two state fills and against ramp step 1 — measured 3.30:1 vs step 1) and
   the ring (#3F3F46) ≥3:1 against both the land tints (8.56:1 vs TINT_GRASS)
   and the nodata fill itself (8.64:1). All other ramp/state fills keep the
   schema's ≥3:1-vs-land clause as written (measured: ramp 3.27 / 4.46 /
   6.21 / 8.95 / 11.95; unanswered 4.39; zero rim 5.94).

3. **Ramp values (cyan-blue, theme-identical, map-anchored):**
   `--sr-hotspot-1..5` = #2C89AA, #24709A, #1C5883, #153F63, #0E2A47.
   Luminance strictly monotonic; adjacent steps 1.36 / 1.39 / 1.44 / 1.34
   (floor 1.2). States: `--sr-hotspot-unanswered` #6A6A72 (+ dashed stroke
   ring on the sprite), `--sr-hotspot-zero` #565661 (hollow rim),
   `--sr-hotspot-nodata` #EDE9E3, plus a non-guarded companion
   `--sr-hotspot-pale` #F1EEE8 for the hollow inner disc. State pairwise
   separations: unanswered/zero 1.35, step1/unanswered 1.34, step1/zero 1.82.

4. **Colorblind path: luminance plus structure, no per-tier texture.**
   A county-style density crosshatch does not resolve on a 28px teardrop
   bulb. The color-independent reading is: strictly luminance-monotonic ramp
   (grayscale-ordered), structural off-ramp states (dashed ring = not
   checked, hollow = answered zero, pale = never birded), the kind glyph on
   every pin (FR-22), and the popup + "Hotspots in view" list carrying every
   value in words (FR-25/26). Grayscale strip demonstrated in design.html.

5. **Activating a color mode auto-reveals the legend** (the FR-24 call left
   to the Designer). A new scale with a closed legend is a riddle. While a
   mode is active the kind hide/show filters remain in the legend as glyph
   chips (check / dots / star), since color no longer encodes kind.

6. **Mode sprites keep the white kind glyph on ramp and unanswered fills;
   the glyph flips to dark slate on the two pale-centered states** (zero/quiet
   hollow disc, nodata pale fill) so the kind stays readable on every state.

7. **Design system: extended, not evolved.** Type, spacing, pill/label/
   button patterns, popup structure, and the accent's role are unchanged;
   the only new color is the hotspot token family, minted per the design
   system's own rule (a new map mark gets a token only where no audited hue
   is free, and the Map Explorer palette is spent — cyan-blue is the one
   family distinct from county green, atlas purple, personal amber, and the
   share-pin red-orange at pin scale).

## Stage 8 revision — The Engineer (429 pacing, 2026-08-24)

From the user's live pre-deploy review: a few eBird 429s on an ordinary
real-key pass, each landing its hotspot in the unanswered state. The fetch
policy now makes a 429 a brief slowdown, never a lost hotspot. The mechanics
live in `lib/rateLimit.ts` (pure) + `useHotspotActivity.ts`; the numbers below
are **deliberate tuning deviations from schema.md's pool-of-4 sketch**
(schema.md itself is approved and unedited).

1. **Request-start spacing 150 ms, global (`ACTIVITY_START_SPACING_MS`).**
   The shipped pass started 4 requests in the same millisecond and recycled
   slots as fast as eBird answered — at typical 200-300 ms latencies that
   sustains ~13-20 requests/s, which is what tripped the limiter. 150 ms
   bounds sustained starts at ~6.7/s and removes the same-instant burst
   entirely. The house precedent is the v0.5.86 Nominatim request-start
   queue, at eBird scale rather than Nominatim's mandated 1 s. Cost, stated:
   a worst-case 200-hotspot pass now has a ~30 s pacing floor (progress
   line moves the whole time; cache-exempt hits keep repeat passes instant).

2. **Pool of 4 KEPT; spacing is the governor.** With starts spaced, the pool
   is just a latency-absorbing ceiling (at 300 ms latency, steady state is
   ~2 in flight). Cutting it to 2 would not lower the start rate — spacing
   already bounds it — it would only slow good passes. So the schema's
   `ACTIVITY_FETCH_CONCURRENCY = 4` stands.

3. **429 handling: honor `Retry-After` (seconds form, capped at 60 s, no
   jitter — the server named its own wait); otherwise a bounded exponential
   2 s -> 4 s -> 8 s ... capped at 30 s, plus up to 25% jitter.** The wait is
   ONE shared key-global cooldown gating every request start (a 429 means
   the KEY is over the limit, not one slot), and it deliberately survives a
   pass restart — a new search during a cooldown paces too. A wave = a 429
   arriving outside any active cooldown, so a burst of simultaneous 429s
   counts once; a post-cooldown success resets the ladder.

4. **Bounded retries: 2 per hotspot per pass (3 requests total), then the
   existing unanswered state + Retry control.** A 429 is never cached
   (dedupedFetch's errors-never-cached path already guarantees it; a test
   pins it).

5. **Transport contract: both twins surface the 429 AS a 429** (FastAPI
   re-raises with the shared detail and a validated re-serialized
   `Retry-After`; the Tauri twin throws `{ status: 429, retryAfterSec? }`),
   fixture-locked by `hotspotActivity.fixture.json`'s new `rateLimit` rows on
   both suites. The upstream body/headers are never reflected raw.

6. **Copy: `ACTIVITY_SLOWDOWN_SENTENCE` ("eBird asked us to slow down, so
   this is taking a little longer.") appended to the running sentence while
   the cooldown is in effect** — the emission is forced on the flip (the
   v0.5.87 sentence-shape rule) so the pause is visible within the 400 ms
   throttle window and the pass never looks stalled.

## Stage 8 — Case 1 prose correction (Orchestrator)

The Auditor's revision re-check flagged the 0.5.92 CHANGELOG clause "resumes on
its own instead of dropping answers" as over-claiming: a hotspot 429'd on all
three paced attempts is still shed to the honest unanswered state (warn box +
Retry). The clause now states the bounded exception. Prose only, no code
change; HELP.md's twin sentence made no such claim and is untouched.
