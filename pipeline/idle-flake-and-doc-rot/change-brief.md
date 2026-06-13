# Change Brief — idle-flake-and-doc-rot

**Lane:** Improve · **Approved:** 2026-06-11 (Stage 1 gate)
**Release scoping (user-ratified):** NO version bump, NO tag, NO Mac release —
tests and records only, nothing ships in the app bundle. Push to main at Stage 6;
Pipeline CI runs; no Pages (website untouched), no Windows CI. CHANGELOG gains an
`[Unreleased]` section that folds into the next real release.

## A. Test-suite determinism (two failure classes, both in scope)

### A1. The commit/effect race (the "idle-callback flake" — true mechanism)

Under suite load, `renderAndLoad()`'s `waitFor(getByText('Statistics'))` in
`frontend/src/components/BirdingStats.test.tsx:134` can resolve on the phase-ready
commit's DOM mutation BEFORE the component's passive double-rAF effect
(`BirdingStats.tsx:218-231`) queues rAF1 into the stubbed `rafQueue`. Flush #1 then
drains an empty queue, the ladder never completes, `computed` never flips, and the
first post-flush heading assertion fails — in whichever of tests 2/3 catches the
interleaving (reproduced 2/30 under `--maxWorkers=1 --sequence.shuffle.files` + CPU
stress; failure DOM frozen in shell state exactly as derived).

**Fix (one file):** in `renderAndLoad()` after the existing waitFor, add
`await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))` with the
investigator's comment explaining the commit-vs-effect race (observable stub-queue
precondition, no wall-clock). Optional non-load-bearing diagnostic in the
idle-callback test before `flushIdle()`:
`expect(idleQueue.length).toBeGreaterThan(0)`. Do NOT add `vi.resetModules()` or
rIC shims to test-setup.ts — both evaluated and rejected (documented in the scoping
output; they don't touch the mechanism).

### A2. The inter-environment timer leak (run-28 class)

recharts/toolkit's 100 ms autoBatch fallback timers armed in the two
chart-mounting JSDOM test files (`BirdingStats.test.tsx`,
`MediaStatsSections.test.tsx`) can fire AFTER the file's jsdom environment is torn
down — where neither jsdom's `cancelAnimationFrame` nor the node-env shim exists
(the 0.5.29 `test-setup.ts` guard never installs in jsdom files). Result: unhandled
ReferenceErrors pinned to the next file, failing a run with all tests green
(reproduced 1/30 stressed).

**Fix (two files):** in both test files, add
`afterAll(() => new Promise((r) => setTimeout(r, 120)))` with a comment: waits out
toolkit's 100 ms fallback timers before environment teardown so they fire where
`cancelAnimationFrame` still exists. (~120 ms × 2 suite cost.)

**Acceptance for A:** the stress recipe that reproduced both classes —
`npx vitest run src/components --maxWorkers=1 --sequence.shuffle.files=true` under
3 concurrent CPU busy-loops — goes 30/30 green with zero unhandled errors; plus 3
normal full-suite runs green; tsc + lint clean.

## B. Record-wording narrowing (the 0.5.29 overclaim, three files)

1. `DECISIONS.md:62` header → "## Suite's cancelAnimationFrame flake fixed with
   setupFiles baseline shims; SnowRaven Mini mentioned in exactly three places —
   2026-06-10 (v0.5.29)".
2. `DECISIONS.md:64` "Killed the pre-existing ~11% full-suite vitest flake" →
   "Killed the `cancelAnimationFrame` arm of the pre-existing ~11% full-suite
   vitest flake"; append after the What paragraph: "A separate, rarer
   idle-callback-adjacent flake in the same suite was a different mechanism
   (commit-vs-effect race) and survived this fix; fixed separately after 0.5.30."
3. `CHANGELOG.md:17` lead-in → "**Flaky frontend test suite — the dominant
   `cancelAnimationFrame` failure mode (~11% of full runs).**"; append: "A
   separate, rarer timing flake was a different mechanism and remained after this
   fix (addressed separately after 0.5.30)." Body unchanged.
4. `ROADMAP.md:13` → "the main cause of the full frontend test suite's
   intermittent failures (~11% of runs) is gone:" (+ "(a separate, rarer timing
   flake remained and was fixed separately)").

## C. PRODUCT_CONTEXT.md doc-rot (per the file's own conventions)

Ground truth for all rewrites: CLAUDE.md "Overlays and stacking".
1. **Rewrite in place** (canonical current-behavior passages): :551, :561, :578,
   :591, :642, :651, :767, :786, :801, :819-820 (re-verify the "always rendered"
   claim against current JSX), :824, :1221 — per the inventory's per-line
   replacements (Leaflet/MapContainer/divIcon/leaflet.heat/CircleMarker →
   SnowMap/react-map-gl/GL layers/lib/heat.ts/SightingsMap/MapEffects reality).
2. **Append supersession notes** ("*Superseded by the v0.5.9 MapLibre
   migration — …*") to the dated entries: v0.5.0 atlas (:850-866), v0.5.2 textures
   (:868-891), v0.5.3 heat (:893-913), v0.5.7 basemaps (:942-973), v0.5.4 backdrop
   (:985-992). Do not rewrite their historical bodies.
3. **Key Decisions :1418-1422:** mark both "(Historical — superseded by the v0.5.9
   MapLibre migration)" — they are now-false standing guidance (popups are JSX in
   the React tree and MUST use `var(--sr-*)` tokens).
4. **Add** a short anchor entry: "Maps — MapLibre Vector Migration (complete —
   June 2026, v0.5.9)" so the supersession notes point somewhere.

`README.md` / `docs/HELP.md`: verified clean — no changes.

## D. Boundaries (binding)

- **NO SnowRaven Mini content anywhere** — the inventory's proposed "resolution
  note" for DECISIONS.md:101-103 is REJECTED per the user's standing rule (Mini is
  a separate project/repo/Weft session; this repo tracks SnowRaven only).
  Historical Mini mentions stay byte-identical.
- No production code changes of any kind. No version-file changes. No website
  changes. No HELP/README changes.
- The Chronicler (Stage 6) additionally records: the outside-project boundary rule
  in CLAUDE.md's pipeline conventions, and this lane's records updates.

## Acceptance (whole change)

- A's stress + normal acceptance; full pytest for the record.
- `git diff` confined to: the two test files (+ optionally test-setup.ts ONLY if a
  comment clarifies scope — no behavior change), DECISIONS.md, CHANGELOG.md,
  ROADMAP.md, PRODUCT_CONTEXT.md (+ Stage 6 chronicle files).
- Zero occurrences of "snowraven-mini"/"Mini" in the diff.
- PRODUCT_CONTEXT contains zero remaining current-tense Leaflet-era claims
  (verify: grep -in "leaflet" shows only historical/superseded-annotated entries).
