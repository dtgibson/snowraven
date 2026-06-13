# Bug Brief — missing-hotspot-pins

**Lane:** Fix · **Approved:** 2026-06-11 (Stage 1 gate)
**Symptom (user report):** hotspot teardrop pins missing on the Map Explorer.

## Root cause (proven, deterministic repro)

`frontend/src/components/map/HotspotMarkers.tsx:64-65`:

```ts
if (map.isStyleLoaded()) addAll()
else map.once('load', addAll)
```

- `map.isStyleLoaded()` is `false` whenever ANY source/tile is mid-load — after a
  Satellite/Topo base switch, a pan/fitBounds, atlas updates, or on a slow network —
  not just before the map's first load. At HotspotMarkers mount it is reliably false:
  the same React commit render-adds the `sr-hotspot` GeoJSON source (async worker
  parse) and the component's first effect fitBounds-jumps the camera (tile churn).
- MapLibre's `load` event fires **once per map lifetime**. The Map Explorer's map
  stays alive from first tab mount (tabs hide via `display:none`), so a listener
  armed later never fires.
- Result: `map.addImage` never runs for `sr-pin-visited|unvisited|personal`
  (`HOTSPOT_IMAGE_ID`, `lib/mapPins.ts:100-104`); the `sr-hotspot` symbol layer
  silently renders nothing (and `queryRenderedFeatures` returns nothing → pins
  unclickable). Only console evidence: MapLibre's `Image "sr-pin-visited" could not
  be loaded` warnings — there is NO `styleimagemissing` handler anywhere.
- Self-heals only via a `data-theme` flip (the MutationObserver re-runs `addAll`
  unconditionally, HotspotMarkers.tsx:66-67) or a remount with a different
  `hotspotPins.length` — which is why it presents as intermittent.

**Latent since 0.5.16** — code byte-identical through the 0.5.18 extraction; zero
map-path commits since (recent-diffs sweep). NOT a recent regression; NOT
data/key/backend (live check: `/map/hotspots` → 200, 332 hotspots).

**Same verbatim pattern in `frontend/src/components/AtlasLayer.tsx:138-139`** for the
atlas hatch `fill-pattern` sprites (unreproduced live, identical mechanism). Fix both.

**Deterministic repro (Playwright, from the triage):** let the map fully load → delay
`server.arcgisonline.com` responses → switch base to Satellite → run a hotspot
search → legend/sidebar populate, ZERO teardrops, three `Image "sr-pin-*" could not
be loaded` warnings, no recovery after tiles arrive. Healthy control: same flow
without the delay renders all three pin kinds. Evidence: /tmp/hotspot-race-during.png,
/tmp/hotspot-race-after.png, /tmp/hotspot-repro.png.

## The fix

In BOTH `HotspotMarkers.tsx` and `AtlasLayer.tsx`:

1. **Register unconditionally at effect time.** Replace the
   `isStyleLoaded()/once('load')` gate with a direct `addAll()` call — `map.addImage`
   does not require the style to be "loaded", only present; keep the existing
   `hasImage → updateImage : addImage` idempotency and the `data-theme`
   MutationObserver re-bake exactly as they are.
2. **Add a `styleimagemissing` safety net.** A map-level listener that, when asked
   for one of OUR image ids (the `HOTSPOT_IMAGE_ID` values / atlas hatch ids), bakes
   and adds that image on demand. This is MapLibre's canonical mechanism and covers
   every future ordering (style swaps, race shapes we haven't met). Listener must be
   added once per component instance and cleaned up on unmount; ignore ids that
   aren't ours (other layers may legitimately miss images).
3. **No behavioral changes otherwise** — same sprites, same layer definitions, same
   ordering (`beforeId` contracts in CLAUDE.md), same click handling, same theme
   re-bake. The `key={hotspotPins.length}` remount stays.

## Verification required

- Re-run the triage's deterministic Playwright repro against the fix: delayed
  satellite tiles + hotspot search must now render all teardrops (and zero
  `Image ... could not be loaded` warnings). Also re-run the healthy-path control.
- Atlas: toggle breeding shading on during delayed tile load; hatches must appear.
- Full vitest + pytest suites green; tsc clean.
- No diff outside HotspotMarkers.tsx / AtlasLayer.tsx (+ tests, version files,
  CHANGELOG, docs if user-visible behavior is described there — it isn't, this is a
  bug fix; HELP.md unchanged).

## Scope expansion — approved 2026-06-11 (user, at Stage 3)

**Also fix in this lane:** the Map Explorer Pins → Heatmap toggle crashes the entire
app ("source id changed" → error boundary), dev AND shipped 0.5.29 production build.
Pre-existing since 0.5.18, found by the Stage 3 regression walk; root cause
diagnosed in `qa-report.md` — the pins/heatmap component swaps a `<Source id>`
in place, unkeyed, which MapLibre forbids; fix = key the Source by mode (or
conditionally mount) so React remounts it when the id changes. Species Detail's
heatmap is unaffected and must stay so. CHANGELOG's [0.5.30] gains a second Fixed
line. Verification: Playwright toggle walk (pins → heatmap → pins, no crash,
heatmap renders, intensity slider live, atlas-on `beforeId="sr-atlas-fill"`
reordering contract intact per CLAUDE.md).

## Out of scope (noted, untouched)

- The unrelated MapLibre console warning `Expected value to be of type number, but
  found null` (appears in healthy runs too; not the cause).
- The eBird `back=30` / 5-mile-default-radius empty-result UX (legitimate empty
  results show no message) — a possible future improvement, not this bug.
- Release chores per CLAUDE.md: patch bump 0.5.29 → 0.5.30 in both version files +
  CHANGELOG entry (these ARE in scope for the change, listed here for completeness).
