# PRD — Named Birds Media

**Feature:** named-birds-media
**Date:** 2026-07-06
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

On the Named Birds tab, each named individual's expanded row shows that
individual's own Macaulay Library media — photos, audio, and video — as inline
embeds directly below its existing sightings map. A named bird's media is the set
of ML-export assets whose OWN per-asset comment (caption / media notes) names that
individual, read with the same `[name:…]` parser the tab already uses; each item
is labeled with its capture date and a link to the checklist it came from. Embeds
load on demand and degrade gracefully to a placeholder plus the existing Macaulay
Library link-out when offline or when an embed can't load.

---

## User Stories

> **US-01** — As a birder who tracks a named individual, I want to see my photos,
> audio, and video of that specific bird gathered in one place under its map, so
> that I can look at it without leaving the app to hunt through the Macaulay
> Library by hand.

> **US-02** — As a user viewing a named bird's media, I want each item labeled
> with the date I captured it and a link to the checklist it came from, so that
> each piece is anchored to when and where I recorded it.

> **US-03** — As a user whose photos of an individual are spread across many
> checklists, I want the app to gather exactly the assets whose own comment names
> that bird (and none that name no bird), so that the grouping is precise and
> matches how I labeled my own media.

> **US-04** — As a user who documents birds with sound and video, I want audio and
> video items shown the same way as photos, so that all my media of an individual
> appears together regardless of type.

> **US-05** — As a user with a spotty or no connection, I want each media item to
> still show its date and checklist link with a link out to the Macaulay Library,
> so that the tab never shows a broken frame and I always keep the local
> information about the item.

> **US-06** — As a user with a named bird that has many media assets, I want the
> tab to stay responsive and not freeze or load dozens of heavy players at once,
> so that opening a well-documented individual is smooth.

> **US-07** — As a user viewing a named bird with no matching media, I want a clear
> "no media" indication rather than an empty gap, so that I know the app looked and
> found none rather than failing.

---

## Functional Requirements

### Matching — which assets belong to a named bird

> **FR-01** — The app shall determine a named individual's media by parsing name
> tags out of each ML-export asset's own per-asset comment fields using the
> existing `parseNameTags` parser (the `[name:…]` vocabulary in
> `frontend/src/lib/namedBirds.ts`), and shall consider an asset to belong to a
> named bird when a name tag parsed from that asset's own comment matches the
> individual's name.

> **FR-02** — The app shall read name tags ONLY from an ML row's `caption` and
> `mediaNotes` fields, and shall NOT read `observationDetails`, because the ML
> export copies the eBird observation/checklist comment onto every media row from
> that observation (not asset-specific) — the same exclusion the Multimedia tab
> already applies for the same reason.

> **FR-03** — The app shall match a named bird's media using the same identity
> rules the tab already uses for named birds: name comparison is
> case-insensitive, and the match is scoped so an asset's media is attributed to
> the individual of the correct species (matching the existing name-plus-species
> keying of `computeNamedBirds`, so the same name on two species does not
> cross-attribute media).

> **FR-04** — An ML asset whose `caption` and `mediaNotes` contain no name tag
> shall not be attributed to any named bird (correctly showing no media for it),
> and this is expected behavior, not an error.

> **FR-05** — The matching in FR-01 through FR-04 shall be computed entirely from
> already-loaded local data (the parsed ML export), with no new network request.

### Presentation — where and what is shown

> **FR-06** — On the Named Birds tab, within each named individual's expanded row,
> the app shall render that individual's matched media below the individual's
> existing sightings map (i.e. after the "Where {name} has been seen" map block in
> `NamedBirdRow`). When the individual has no coordinates and therefore no map, the
> media shall still render in the same position within the expanded row.

> **FR-07** — The app shall render photo, audio, and video assets through the
> single Macaulay Library inline-embed iframe mechanism
> (`https://macaulaylibrary.org/asset/<catalogId>/embed`), identical across media
> types (only the asset id and player size vary), matching the existing Species
> Detail embed precedent (`sr-media-iframe`).

> **FR-08** — Each media item shall be labeled with its capture date (from the
> matched ML row's `date` field, formatted through the app's date-format
> preference) and a link to the checklist it came from (from the matched ML row's
> `checklistId`).

> **FR-09** — The checklist link in FR-08 shall render through the shared
> `ChecklistLink` component (which carries the `^S\d+$` id guard and the
> label-aware accessible name); when the matched row's `checklistId` is absent or
> fails the id guard, the app shall omit the link (render no styled link) rather
> than emit a broken/404 link, and shall still show the date.

> **FR-10** — The media section shall present only assets that match the named bird
> per FR-01 through FR-04; it shall not show a species-wide media selection.

### Loading behavior — on-demand, bounded

> **FR-11** — The app shall not load any embed for a named individual until that
> individual's row is expanded (media embeds are deferred to expansion, consistent
> with the tab's single-open accordion in which at most one individual is expanded
> at a time).

> **FR-12** — The app shall not mount many live embed players simultaneously for a
> single expanded individual; when an individual has more matched assets than a
> bounded on-screen limit, the app shall load embeds on demand (e.g. capped and/or
> paged / load-more), keeping the number of concurrently live players bounded. (The
> exact browse affordance is the Designer's; this requirement fixes the bound.)

> **FR-13** — The media feature shall compose with the tab's existing single-open
> accordion (`singleOpen` on `NamedBirdsTable`) and the existing lazy per-row map,
> so that collapsing an individual releases its media embeds and the map WebGL
> context, and opening another individual does not accumulate players from
> previously viewed ones.

### Degradation and empty states

> **FR-14** — When the app is offline, or when an embed cannot load, the app shall
> degrade each affected item to a non-embed placeholder plus a link out to that
> asset on the Macaulay Library (`https://macaulaylibrary.org/asset/<catalogId>`,
> the canonical single-asset URL, `encodeURIComponent`-wrapped, guarded by the
> `^\d+$` catalog-id shape check), while still showing the item's date and
> checklist link. It shall never leave a broken or blank frame.

> **FR-15** — The date + checklist labels and the link-out in FR-14 shall be
> available regardless of connectivity, because they are computed from local ML
> data.

> **FR-16** — When a named individual has no matched media (no asset's own comment
> names it), the app shall show a clear, muted empty state (e.g. "No media matched
> to this bird") in place of the media section, not an empty gap and not an error.

> **FR-17** — When the ML export is not loaded at all, the app shall show no media
> section (and no error) for any individual; the named-bird sightings, map, and all
> existing tab behavior shall be unchanged.

### Conventions and documentation deliverables

> **FR-18** — User-facing bird names introduced by this feature (if any header names
> the species) shall render through `<BirdName>`; any non-checklist external link
> shall render through `<OutboundLink>` (the Macaulay link-out) or the
> catalog-link helpers; catalog and submission ids shall be shape-guarded
> (`^\d+$` / `^S\d+$`) before use in a URL and `encodeURIComponent`-wrapped in
> query strings; any asset comment text displayed shall render through
> `<CommentText>` (escaped). No raw `dangerouslySetInnerHTML` on
> user/asset-derived text.

> **FR-19** — `PRIVACY_POLICY.md`'s "Embedded Bird Media and Link Icons" section
> shall be updated so its Macaulay Library embeds bullet names the Named Birds tab
> as a surface that embeds media from `macaulaylibrary.org` (today it names only
> the Species Detail tab). This is a required deliverable of this feature, in the
> same change.

> **FR-20** — `docs/HELP.md`, `README.md`, and the `website/` showcase shall be
> updated to describe this new user-facing capability, in the same change, per the
> project's docs-sync convention.

---

## Non-Functional Requirements

> **NFR-01 — Performance:** With a named individual that matches many media assets
> (dozens), expanding the row shall keep the tab responsive and shall not freeze
> the UI or exhaust browser/WebView media resources by mounting all embeds at once;
> concurrent live embed players shall be bounded (per FR-11–FR-13). The matching
> computation shall not perform a linear-per-asset network call — it is pure local
> parsing.

> **NFR-02 — Entry-chunk / maps-lazy:** No new component added by this feature and
> reachable from `App.tsx`'s static import graph shall statically import
> `SightingsMap`, `SnowMap`, or `react-map-gl/maplibre`, nor otherwise drag the
> maplibre vendor bundle onto first paint; `frontend/src/lib/entryChunk.test.ts`
> shall remain green (extend it if a new off-entry-chunk asset is introduced). A
> fresh `npm run build` shall show `vendor-maplibre` absent from
> `dist/index.html`'s modulepreload.

> **NFR-03 — Privacy:** This feature introduces the first inline third-party media
> fetch on the Named Birds tab. It shall stay within the founding privacy stance —
> device-to-provider only, no SnowRaven server, no tracking, no key/account for the
> embed — and shall add no analytics or telemetry. The only new network traffic is
> the Macaulay Library embed iframe when a media item is actually rendered. The
> privacy disclosure (FR-19) shall be kept true in the same change.

> **NFR-04 — Offline:** The matching, dates, and checklist links shall function
> fully offline (local ML data); only the embed player requires network. Offline
> degradation (FR-14) is a first-class state, not an error path.

> **NFR-05 — Accessibility (WCAG 2.1 AA):** Each embed iframe shall carry a
> descriptive `title`; any control introduced for on-demand loading (e.g. a
> load-more / expand affordance) shall be a real, keyboard-operable, correctly
> labeled control with a ~44px touch target on phones (`.sr-touch-target`);
> placeholder/empty-state text shall use `--sr-text-muted` and meet AA contrast in
> both themes; focus handling shall follow the app's conventions. All colors shall
> use `var(--sr-*)` tokens (no hardcoded hex/rgb).

> **NFR-06 — Responsive:** The media section shall be usable and non-overflowing
> from ~320px phones up, holding at 200% in-app text scale, reusing the app's
> responsive layout vocabulary (e.g. the `sr-media-grid` collapse-to-single-column
> pattern the Species Detail embeds already use) rather than inline breakpoint
> styles. No form control shall ship a sub-16px font on phone.

> **NFR-07 — Purity:** No impure `Date.now()` / `new Date()` shall be called in a
> render body or a `useMemo`/`useCallback` (react-hooks/purity is build-blocking);
> a "now" reference, if needed, uses a module-level session constant or an event
> handler.

> **NFR-08 — Conventions adherence:** The feature shall route platform-sensitive
> operations through the existing seams (transport/storage/platform), add no new
> backend route or provider, and keep the desktop/web/mobile builds behaving
> identically for the local matching. It reuses the already-loaded ML export
> (`mlExportCache`) — no new file fetch for matching.

> **NFR-09 — No regression:** All existing Named Birds tab behavior (sightings
> list, per-individual map, sort, single-open accordion, Species Detail's Named
> Individuals section which stays map-less and media-less) shall be unchanged.

---

## Out of Scope

- A new media-browsing tab or a redesign of the existing Multimedia tab — this
  lives inside the Named Birds tab only.
- Downloading, hosting, caching, or re-serving media. SnowRaven only embeds what
  Macaulay Library serves; no media is stored on the user's device by this feature.
- Matching media by the checklist the asset came from, the checklist-level comment,
  or the species comment — explicitly rejected. Those may name the bird but do not
  identify a specific asset; matching is by the media asset's OWN comment
  (`caption` / `mediaNotes`) only.
- Any change to the named-individual detection vocabulary (`[name:…]` /
  `parseNameTags`) — it is reused as-is against the media comment fields.
- The Named Individuals section on Species Detail (map-less, multi-open) — it does
  not gain media in this feature.
- Other tabs' media surfaces (Species Detail embeds, Multimedia, Statistics media
  links) — unchanged.
- A media viewer / lightbox / editing UI, or filtering/sorting the matched media
  beyond showing each item with its date + checklist link. (The Designer may
  propose a minimal browse affordance — e.g. paging / load-more — solely to satisfy
  the performance bound in FR-12; a full media-management UI is out of scope for
  v1.)
- Any new provider, backend route, or SnowRaven server — this reuses the existing
  Macaulay Library embed and locally-held ML export data only.

---

## Open Questions

> **OQ-01 — Desktop/mobile webview CSP allowance for the iframe.**
> Question: Does the Tauri desktop (WKWebView / WebView2) and the iOS/iPadOS build
> permit loading the external `macaulaylibrary.org` embed iframe on the Named Birds
> tab? Precedent: Species Detail already embeds ML media, and `tauri.conf.json`
> currently sets `"csp": null` (no config-level frame block), which strongly
> suggests it is already allowed.
> Default assumption if unanswered before Stage 5: the existing Species Detail
> embed precedent proves the webview allows the iframe; no CSP/capability change is
> needed. The Architect must confirm this against the actual desktop and mobile
> builds (including any mobile-specific webview policy) and flag it if a change is
> in fact required.

> **OQ-02 — How many embeds to render at once, and whether paging is needed.**
> Question: What is the on-screen concurrent-embed bound and the browse affordance
> for an individual with many matched assets (a fixed cap, a "load more", paging, or
> lazy-on-scroll)? Species Detail's precedent shows at most one embed per media type
> (three total) and so never faced this; this feature can face many.
> Default assumption if unanswered before Stage 5: this is a Designer decision
> (Stage 4) constrained by FR-11–FR-13 and NFR-01 (bounded concurrent players,
> on-demand loading). If the Designer does not specify, the Engineer shall default
> to a small initial batch (e.g. the newest ~6 assets) with an explicit,
> keyboard-accessible "show more" control that loads further batches on demand.

> **OQ-03 — Item ordering.**
> Question: In what order are a named bird's matched media items presented?
> Default assumption if unanswered before Stage 5: newest capture date first (to
> mirror the tab's newest-first sightings ordering), with catalog id as a stable
> tie-break.

> **OQ-04 — Field selection confirmed against a real export.**
> Question: Are `caption` and `mediaNotes` the correct and only per-asset comment
> fields to parse (and `observationDetails` correctly excluded) against a current
> real ML export?
> Default assumption if unanswered before Stage 5: yes, per the strategic brief and
> the existing Multimedia-tab exclusion of `observationDetails`. The Architect
> should confirm the field selection against a real export during design.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Media appears under the map when a named bird is expanded (FR-06) | Expanding a named individual that has ≥1 matched asset shows a media section rendered below the "Where {name} has been seen" map block within the expanded row. |
| QA-02 | Matching is by the asset's own comment via `parseNameTags` over caption + mediaNotes (FR-01, FR-02) | Given an ML export where an asset's `caption` or `mediaNotes` contains `[name:X]`, that asset appears under individual X; an asset whose name tag appears only in `observationDetails` does NOT appear. |
| QA-03 | Assets with no name tag are not shown (FR-04) | An ML asset whose `caption` and `mediaNotes` contain no `[name:…]` tag appears under no named bird. |
| QA-04 | Species scoping / no cross-attribution (FR-03) | An asset tagged `[name:Pete]` on species A does not appear under a `[name:Pete]` individual of species B. |
| QA-05 | Photo, audio, and video all render via the embed iframe (FR-07) | A matched Photo, a matched Audio, and a matched Video each render as an inline embed with src `https://macaulaylibrary.org/asset/<catalogId>/embed`. |
| QA-06 | Each item labeled with capture date (FR-08) | Each media item shows the matched row's date, formatted per the Settings date-format preference. |
| QA-07 | Each item links to its checklist (FR-08, FR-09) | Each media item with a valid `^S\d+$` checklistId renders a `ChecklistLink` to that checklist; an item with an absent/invalid checklistId shows no link and no 404, and still shows its date. |
| QA-08 | On-demand loading — nothing loads before expansion (FR-11) | With rows collapsed, no `macaulaylibrary.org/.../embed` request is made; embeds request only after an individual is expanded. |
| QA-09 | Concurrent players are bounded (FR-12, NFR-01) | For a named bird matching more assets than the on-screen bound, expanding the row mounts no more than the bounded number of live embed players; further assets require an explicit on-demand action to load. |
| QA-10 | Collapsing releases media (FR-13) | Collapsing an expanded individual (or opening another, per single-open) removes its embed players; players do not accumulate across successive expansions. |
| QA-11 | Offline / failed-embed degradation (FR-14, FR-15, NFR-04) | With no network (or a forced embed failure), each item shows a placeholder plus a working link to `https://macaulaylibrary.org/asset/<catalogId>`, and still shows its date and checklist link — no broken/blank frame. |
| QA-12 | Empty state when no media matches (FR-16) | Expanding a named individual with zero matched assets shows a clear muted "no media" message, not an empty gap and not an error. |
| QA-13 | No ML export loaded (FR-17, NFR-09) | With no ML export loaded, no media section (and no error) appears for any individual, and the sightings list, map, sort, and accordion behave exactly as before. |
| QA-14 | Matching is fully local (FR-05, NFR-08) | The matching, dates, and checklist links are produced with no new network request beyond the embed iframe itself. |
| QA-15 | Entry chunk / maps stay lazy (NFR-02) | `entryChunk.test.ts` passes and a fresh `npm run build` shows `vendor-maplibre` absent from `dist/index.html`'s modulepreload; the new media component is not statically reachable from `App.tsx`. |
| QA-16 | Accessibility (NFR-05) | Every embed iframe has a descriptive `title`; any load-more/browse control is keyboard-operable with an accessible name and a ~44px phone touch target; placeholder/empty text meets AA contrast in light and dark; no hardcoded colors. |
| QA-17 | Responsive (NFR-06) | The media section is usable and non-overflowing at 320px and at 200% text scale, collapsing to a single column on phones; no horizontal page scroll is introduced. |
| QA-18 | Privacy policy updated (FR-19, NFR-03) | `PRIVACY_POLICY.md`'s Macaulay Library embeds bullet names the Named Birds tab; no analytics/telemetry/server is added; the embed is the only new network call. |
| QA-19 | Docs & site updated (FR-20) | `docs/HELP.md`, `README.md`, and `website/` describe the new Named Birds media capability. |
| QA-20 | Safe rendering of ids and comment text (FR-18) | Catalog ids are `^\d+$`-guarded and `encodeURIComponent`-wrapped before use in a URL; submission ids go through `ChecklistLink`'s guard; any displayed comment text is escaped (no raw `dangerouslySetInnerHTML` on asset-derived text). |
