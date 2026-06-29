# Security & Privacy Review — county-overlay-precision (v0.5.49)

**Verdict: clean. No findings. No `PRIVACY_POLICY.md` change required.**

Scope reviewed: the full working diff (`HotspotLink.tsx`,
`CountyLayer.tsx`, `mapStyle.ts`, tests, version, docs).

- **No new network request / no new provider.** The accurate county
  lines are drawn from the **existing** `openmaptiles` vector source —
  the OpenFreeMap base tiles the app already fetches for the basemap,
  already disclosed in `PRIVACY_POLICY.md` → "Map Tiles." No new
  browser→provider request, no new host, no new data download. The
  county overlay still makes no network calls of its own. (Diff grep
  for `fetch(` / `http(s)://` in `frontend/src`: none introduced.)
- **No injection surface.** The new GL `line` layer's filter is a
  static expression over the trusted tile attribute `admin_level`; no
  user input flows into it. The county popup is unchanged and remains
  escaped JSX (no `dangerouslySetInnerHTML`). The `HotspotLink` change
  is a CSS `max-width` only.
- **No new storage / persistence.** No `localStorage`, no new settings,
  no new files.
- **Boundary_3 narrowing** is a static style-filter change (admin_level
  ≤ 4) — no security surface.

This is a no-security-surface change (proportional review): a CSS clamp
plus a styling/layer change over already-fetched, already-disclosed map
tiles. Privacy posture unchanged.
