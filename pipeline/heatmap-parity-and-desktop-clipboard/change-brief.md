# Change Brief — Heatmap Parity + Desktop Clipboard Auto-Copy

**Lane:** Improve
**Date:** 2026-06-02

Two parity improvements bundled in one pass. Both bring existing,
shipped behavior to a place it currently isn't — neither is net-new
product capability, so this stays in the Improve lane (see Feature
Check below).

---

## Improvement 1 — Heatmap intensity controls on the Species Detail map

**Current state.** v0.5.1 added a "Heatmap Intensity" slider (1–10)
to the **My Sightings** map in `MapExplorer.tsx`. It scales three
things together via `heatRadius/heatBlur/heatMax(intensity)` plus a
per-point weight divisor (`Math.max(2, 20 - (intensity-1)*2)`), so
higher intensity spreads coverage and makes sparse, low-count areas
burn hot. Default intensity is **5**.

The **Species Detail** tab (`SpeciesDetail.tsx`) has its own
Pins/Heatmap toggle and a `HeatmapLayer`, but it is **hardcoded**
`{ radius: 25, blur: 15, maxZoom: 17 }` with raw observation-count
weights and **no intensity control**.

**Change.** Give the Species Detail heatmap the same intensity
slider and the same scaling model as My Sightings, so the two
heatmaps behave identically.

**Approach (for the Engineer to confirm).**
- Extract the shared heat math into `frontend/src/lib/heat.ts`:
  `heatRadius`, `heatBlur`, `heatMax`, `HEAT_INTENSITY_DEFAULT`,
  and a `heatWeightDivisor(intensity)` (or a `weightFor(count, intensity)`)
  helper — single source of truth.
- Point `MapExplorer.tsx` at the shared module (no behavior change).
- In `SpeciesDetail.tsx`: add `heatIntensity` state (default 5,
  reset on species change like `mapMode`), feed `heatRadius/Blur/Max`
  into the `heatLayer` options, scale `heatPoints` weight by the same
  divisor, and render the same slider (label, value, Tighter/Broader
  ends) in the map section header — shown only in Heatmap mode.

**Acceptance.**
- Species Detail heatmap shows a 1–10 intensity slider in Heatmap mode only.
- Moving it changes spread/intensity identically to My Sightings.
- Default is 5; resets to 5 on species change.
- My Sightings heatmap behavior is unchanged (shared-module refactor only).

---

## Improvement 2 — Auto-copy weather to the clipboard in the desktop apps

**Current state.** On a successful lookup, `App.tsx handleLookup`
auto-copies the formatted weather via `navigator.clipboard.writeText`,
with a legacy `execCommand('copy')` fallback. This works on the web/Pi
client. On the macOS and Windows desktop apps it does **not** reliably
fire: the auto-copy runs *after* an `await transport.get(...)`, which
breaks the user-activation chain WKWebView/WebView2 require for the
async Clipboard API, so the write throws `NotAllowedError` and is
silently swallowed by the existing `catch`. The manual **Copy** button
works because it runs inside a click handler (a user gesture).

**Change.** Make the on-lookup auto-copy work on desktop, matching the
web behavior.

**Approach (for the Engineer to confirm).**
- Add a **clipboard seam**: `frontend/src/lib/clipboard.ts` exporting
  `copyText(text): Promise<boolean>`. In Tauri mode (`isTauri()`) it
  calls the Tauri clipboard plugin's `writeText` (native, no
  user-gesture requirement); on web it uses `navigator.clipboard`
  with the existing `execCommand` fallback. Mirrors the
  transport/storage seam pattern (a CLAUDE.md convention).
- Add the dependency: `@tauri-apps/plugin-clipboard-manager` (JS) +
  `tauri-plugin-clipboard-manager` (Rust, in `[dependencies]` so it
  builds cross-platform), register it in `src-tauri/src/lib.rs`, and
  grant `clipboard-manager:allow-write-text` in the capability file.
- Route both `handleLookup` (auto-copy) and `handleCopy` (button)
  through `copyText`.

**On the "permission button."** The Tauri clipboard-manager plugin
grants clipboard **write** at build time via the capability — there is
**no OS runtime permission prompt** for writing the clipboard on macOS
or Windows. So with this approach auto-copy "just works" and **no
permission button is needed**. The brief recommends *not* adding the
button (it would be a control with nothing to do). If the Engineer
finds a platform where a runtime grant is genuinely required, the
fallback is the button the user described ("Give permission to enable
automatic copying to clipboard upon lookup") shown below the lookup
box only in that case. **Open question flagged for the Stage 1 gate.**

**Acceptance.**
- After a successful lookup in the macOS and Windows apps, the
  formatted weather is on the clipboard with no extra click, and the
  "Copied!" state shows — same as web.
- Web/Pi behavior unchanged.
- New Rust dependency is in `[dependencies]` (not the macOS-only
  target table) so the Windows build stays green.

---

## Decisions touched
- Desktop seams convention (transport/storage/platform) — extends it
  with a clipboard seam, consistent with the existing pattern.
- No privacy-policy impact: clipboard write is local, user-initiated,
  nothing transmitted.

## Feature Check
Both items bring **existing** behavior to a new location (heatmap
controls already ship on the My Sightings map; auto-copy already ships
on web). No genuinely new product capability or surface. The only
possible new surface — the conditional permission button — is a
fallback we expect not to build. **Stays in the Improve lane.**

## Out of scope
- Re-tuning the heatmap formulas (reuse v0.5.1's as-is).
- Any clipboard *read* capability.
- Porting intensity to the Statistics-tab maps (those are marker maps,
  not heatmaps).
