# Change Brief — Targets hotspot link

## What is changing
On the Targets tab, each row's **Last report** cell shows the date and, under it, the place eBird gave for that report (`cell.place`, rendered as `.sr-tg-place` in `TargetsList.tsx`). When that place is a public eBird hotspot, the name becomes a link to its eBird hotspot page; a personal location stays plain text, exactly as today. It follows the app's existing hotspot-link convention (DECISIONS.md v0.5.40; `.claude/rules/ui.md`, the `HotspotLink` bullet): `components/HotspotLink.tsx` decides with `isHotspot`, which comes from one `useHotspotSet()` call in the parent. It links to `https://ebird.org/hotspot/{locId}` through `OutboundLink` and the `Link` primitive, with the shared name "Open {name} on eBird (opens in a new tab)". The data is already there: each stored day record carries `locId` (shape-checked by `DAY_LOC_ID_RE`) on both runtimes, in the cache and in the iCloud day snapshot. Only the in-memory `LiveCell` leaves it out today.

## Scope
**Changes:**
- `lib/targets/targetsLive.ts`: `LiveCell` gains `locId: string | null`, taken in `deriveLive` from the same newest record as `place`, so the name and the link always match.
- `components/targets/Targets.tsx`: calls `useHotspotSet()` once and passes `isHotspot` down.
- `components/targets/TargetsList.tsx`: renders the place through `HotspotLink` and leaves the "Places in this list" chooser alone.
- `globals.css` (`.sr-tg-place`, and the phone-tier rules near line 6459) as the Designer decides.
- `docs/HELP.md` (Targets, the "Live" bullet): one clause saying a hotspot's name opens its eBird page.
- Version bump (four-file set) and `CHANGELOG.md`.

**Tests:**
- `targetsLive.test.ts`: `locId` comes from the newest record, and is null when the record has none.
- `targetsAnchor.test.ts` and `targetsSort.test.ts`: add `locId` to the `LiveCell` helpers.
- `Targets.test.tsx`:
  - a hotspot place renders as a link with the right href and name;
  - a personal place, a null `locId`, or a Set that has not loaded yet stays plain;
  - `liveTransport` answers `/map/hotspot-region`. Today it throws on any path it does not know, and the hotspot code silently turns that into an empty Set;
  - the `hotspotSet` module cache is reset between tests;
  - any assertion over the whole `tGet` call list is re-checked.

**Deliberately unchanged:**
- The day-obs pipeline: `countyDayObsReduce.ts`, `countyDayObsCache.ts`, `backend/services/county_day_obs.py`, the routers, the `lib/tauri` services, the shared fixture, and the Rust iCloud code.
- `hotspotSet.ts`, `useHotspotSet.ts`.

**Scope added after the live look (user decision, 2026-10-02):**
- `HotspotLink.tsx`: in its full-name link (not `truncate`, not `compact`), the open-on-eBird icon follows the last word of a wrapping name instead of sitting at the far edge of the box. Every tab that shows a full hotspot name gets this. One-line names, `truncate` names and icon-only (`compact`) links look exactly as before. See `decisions.md`.
- The Calendar, `PRIVACY_POLICY.md`, `website/`, `README.md` and the App Store listing.

**Why no new field is needed:**
- Targets only offers counties from the user's backup, so the hotspot Set (built per backup state) covers every Targets county.
- Hotspot vs personal is decided the way every other tab decides it, so eBird's `locationPrivate` flag is not needed and the stored document's shape does not change.
- Accepted, existing behaviour: with no key, before the Set loads, or if the Set was built while offline, names stay plain.

## Why now
The user asked for it: "make that location a tappable link if it is an ebird hotspot." The Targets tab (v1.0.39) shipped with the place as plain text, unlike every other surface that names a location. The Calendar is the one tab waived from this convention.

## User-facing impact
In the Last report cell, a hotspot's name becomes a link that opens its eBird hotspot page in the browser, on desktop, iPhone, iPad and web. Personal locations look the same as today. There are no new requests beyond the per-state hotspot lookup other tabs already make: no new endpoint, host or data sent, and none at all if another tab built the Set earlier in the session.

## Design pass
**Needed, light.** It covers the Last report cell on the desktop table and on the phone-tier cards. Today the place is a muted 0.75rem block line that wraps. `HotspotLink` forces the accent colour, adds a trailing icon and renders inline-flex. Its plain branch defaults to `var(--sr-text)`, which would change how personal locations look unless the caller keeps them muted.

The Designer should settle:
- whether the place wraps or truncates;
- that the link keeps its own line under the date;
- that personal places stay visually unchanged;
- that the link is easy to tap on iPhone;
- that a long table of per-row links still reads calmly.

## Decisions touched
- **v0.5.40, Public-hotspot links (Set membership):** extended to a new surface, not modified.
- **v1.0.39, Targets tab:** the live "last report's date, place and distance" place gains a link. Not reversed. The anchor chooser's "Places in this list (no request)" is unchanged.
- **v1.0.40, iCloud day snapshots:** not touched, since the shape is unchanged.
- **v0.5.63, Calendar offline waiver:** considered and does not apply, because Targets already makes eBird requests.
- PRODUCT_CONTEXT's older note "Top Locations renders all location names as plain text" was superseded by v0.5.40 and needs no action.

## What done looks like
- A hotspot place in Last report opens `ebird.org/hotspot/{locId}` in the system browser on desktop and iOS, and a personal place stays plain text.
- The link's name is "Open {name} on eBird (opens in a new tab)", and `tabOrderCoverage`, `entryChunk` and the full frontend suite, typecheck and build are all green.
- No change to the stored day-obs document, the backend, or either transport.
