# PRD - Macaulay Library links in a named bird's media section
**Feature:** ml-media-links
**Date:** 2026-10-08 (revised after The Designer, decisions.md D1 and D2)
**Stage:** 2 - The Planner
**Source:** strategic-brief.md (approved, hands-off), amended by decisions.md D1 and D2

## Feature Overview

Each named bird's media section on the Named Birds tab gets a compact list of numbered links, one per media item of that bird, grouped by format (Photos, Audio, Video) and numbered newest first. Each number opens that item's own Macaulay Library page, the same page as the gallery tile's existing link. The list covers every item, including the ones behind "Show more", and works the same whether or not the embedded players can load. Species Detail is unchanged by this build (D2).

## Revision note

The first draft specified a species-level catalog row (Photos, Audio, Video linking to `media.ebird.org/catalog` filtered by contributor and species) on Named Birds and on Species Detail's Recent Media card. At The Designer the user replaced the Named Birds row with per-item links, because Macaulay Library has no filter for a named individual (D1). The user then dropped the Species Detail row, because it would have repeated the Media card's count links URL for URL (D2). The requirements below are re-derived from those decisions, and every ID is renumbered.

## Terms used below

- **Item list**: the new compact list of numbered links this PRD specifies.
- **Gallery items**: every asset the existing media join (`computeNamedBirdMedia`) matched to the bird, in the order it returns them: newest first by date, catalog id descending as the tie-break. That means all of them, not only the batch currently revealed by "Show more".
- **Valid catalog number**: a gallery item's `catalogId` that matches `MEDIA_CATALOG_ID_RE` (`/^\d+$/`, `lib/mediaEmbed.ts`), the gate the tile already applies before it draws its own Macaulay Library link.
- **Listed items**: the gallery items with a valid catalog number. An item without one is not listed.
- **Format group**: the listed items of one format (`Photo`, `Audio` or `Video`), in gallery order. Its size is **N**.
- **Asset URL**: `mlAssetUrl(catalogId)` (`lib/mlCatalog.ts`), i.e. `https://macaulaylibrary.org/asset/<catalogId>`, the URL each tile's existing "Macaulay Library" link and fallback "View on Macaulay Library" link already use.
- **Item date**: the item's `date` as formatted by the app's `formatDate` (the user's chosen month-first, day-first or ISO format). It is empty when `formatDate` returns an empty string.
- **Embed states**: the four states a gallery can be in:
  1. **Players working**: `embedAllowed` true, the bot-check gate (`mlEmbedGate`) reports not gated, online.
  2. **Bot check up**: the gate reports gated.
  3. **Embeds disabled**: `embedAllowed` false, which includes the unresolved startup preference as well as a saved Disable embedded media.
  4. **Offline**: `useOnline` reports offline.
- **Phone tier**: the app's 640px-and-below responsive tier.

## User Stories

> **US-01** - As a birder who has named an individual (for example `[name:Winky]`) and opened its card on Named Birds, I want every one of its photos, recordings and videos listed as a link, so that I can open any of them on Macaulay Library without paging through tiles or pressing "Show more".

> **US-02** - As a birder whose players are blocked by Cornell's bot check, turned off in Settings, or unavailable offline, I want that list to be there and work the same, so that I am never limited to the handful of tiles shown.

> **US-03** - As a birder scanning a well-documented bird, I want the items grouped by format and numbered newest first, so that I can tell at a glance how many of each I have and reach the most recent one first.

> **US-04** - As a screen reader user, I want each link to say which item it is (format, its number out of how many, the bird, its date) and that it opens Macaulay Library in a new tab, so that a list of bare numbers is never ambiguous.

> **US-05** - As a keyboard or touch user in the Mac, iPhone or iPad app, I want every number reachable with Tab and large enough to tap, so that the compact list does not cost me reach.

> **US-06** - As a user of the desktop or Apple apps, I want a click to open my system browser exactly once, and on web or a Pi a new tab, so that the list behaves like every other outbound link in SnowRaven.

## Functional Requirements

### A. Presence and placement

> **FR-01** - The app shall render the item list in an expanded named bird's media section whenever that bird has at least one listed item. When it has none (no gallery items, or no item with a valid catalog number), the app shall render no item list at all: no element, no lead line, no placeholder and no explanatory text.

> **FR-02** - The item list shall render directly below the "Media of {name}" header row, above the "Embedded media is disabled in Settings." status (when shown) and above the gallery grid or list. It shall not render in a collapsed card, in the "No media matched to this bird." empty state, or when no ML export is loaded (the media section itself is absent then).

### B. Content

> **FR-03** - The item list shall link every listed item, including items "Show more" has not yet revealed, and revealing more shall not change it. An item without a valid catalog number gets no link and no number, and it does not count toward its format group's N. Its tile renders exactly as today.

> **FR-04** - The item list shall show one format group per format that has at least one listed item, in the order Photo, Audio, Video, and no group for a format with none. Within a group, items appear in gallery order and are numbered 1 to N, so number 1 is the newest. Numbering restarts at 1 in each group.

> **FR-05** - Each number's `href` shall be exactly the asset URL of its item, the same string that item's tile "Macaulay Library" link carries, built by the same builder. No link in the list carries a `media.ebird.org/catalog` URL, a contributor id or a taxon code.

> **FR-06** - Visible copy shall be:
> - A lead line reading "{name} on Macaulay Library, newest first:", with the bird's name emphasized as the design draws it (`bird.name`, as the section header shows it).
> - Each format group labelled by its format icon (decorative) and the word "Photos", "Audio" or "Video".
> - Each link's visible text is its number only.
>
> The copy contains no em dash (U+2014) and uses American spelling. A pointer hover over a number should show the item date, as the design does.

> **FR-07** - Each link's accessible name shall be exactly "{Format} {n} of {N} of {name}, {date}, on Macaulay Library (opens in a new tab)", where:
> - {Format} is the singular "Photo", "Audio" or "Video";
> - {n} is the link's number and {N} is its group's size;
> - {name} is `bird.name`;
> - {date} is the item date.
>
> When the item date is empty, the date and the commas around it drop out: "{Format} {n} of {N} of {name} on Macaulay Library (opens in a new tab)". The "(opens in a new tab)" cue appears exactly once. Each format group is a list whose accessible name is its visible format label, so a screen reader announces the group and its item count. Example: "Photo 3 of 24 of Winky, Jan 18, 2026, on Macaulay Library (opens in a new tab)".

### C. Behavior

> **FR-08** - The item list shall be identical in every embed state: the same groups and links, in the same order, with the same `href`s and accessible names, in the same position. It shall not read `embedAllowed`, the bot-check gate, the online status, the contributor id (the ML export's filename) or the taxonomy lookup, and a change in any of them during the session (for example, the bot check lifting, or the taxonomy lookup failing) shall neither add, remove nor alter it.

> **FR-09** - Activating a number shall open its `href` in a new browsing context:
> - In the Mac, Windows, iPhone and iPad apps the system browser opens exactly once, with the URL the link renders, sent by the link's own dispatch rather than the opener plugin's window listener.
> - On web and Pi a new tab opens, with `rel` including `noreferrer`.
> - Modifier-key and middle clicks behave exactly as they do on the app's other outbound links.
>
> This holds for items "Show more" has not revealed too.

> **FR-10** - Everything the media section does today shall be unchanged:
> - each tile's "Macaulay Library" asset link, the fallback's "View on Macaulay Library" link and each `ChecklistLink` (presence, `href`, text and accessible name);
> - the gallery, its lazy mounting and its initial batch of six;
> - the "Showing N of M" line;
> - the "Show more" control's label and reveal size;
> - its focus handoff: when a reveal exhausts the list, focus moves to the first newly revealed tile, never to a link in the item list.

> **FR-11** - The item list shall always reflect the stored ML export the gallery came from. After the stored export is replaced (the files epoch changes), it lists the new export's items for that bird; after the export is removed, the media section and its list are absent. No relaunch is needed, and the list never mixes items from two exports.

> **FR-12** - Species Detail's Named Individuals section, which reuses the named-birds table without media, shall stay without a media section and without an item list.

### D. Help

> **FR-13** - In `docs/HELP.md`, the Named Birds "Media of a named bird" paragraph shall gain one or two sentences saying:
> - the section starts with a list of the bird's items, grouped into photos, audio and video and numbered newest first;
> - each number opens that item on Macaulay Library;
> - the list covers every item, including those behind **Show more**;
> - it stays available whatever the players are doing.
>
> The sentences contain no em dash. No other Help paragraph is edited, the Species Detail Recent Media bullet included. Help is written without a stop, per the standing rule.

## Non-Functional Requirements

> **NFR-01 - Accessibility:**
> - WCAG 2.1 AA holds at 320px width and at 200% in-app text scale.
> - The numbers wrap within the card, and the lead line wraps even for a 120-character bird name with no spaces (the longest a `[name:…]` tag admits).
> - Nothing produces horizontal page or card scroll, and no text is clipped.
> - Each link's target is at least 24 by 24 CSS pixels outside the phone tier (it grows with text scale).
> - In the phone tier, each target is at least 44 by 44, adjacent targets abut with no gap, and each format label sits above its numbers.
> - Link text meets AA contrast in both themes. Every link shows a visible focus indicator, and the design's hover box appears on focus too.
> - Each accessible name contains the link's visible number (Label in Name).

> **NFR-02 - Keyboard and WebKit:**
> - Every link renders through `OutboundLink`, so it gets the `Link` primitive and its literal `tabIndex={0}` default. That keeps every link reachable by Tab under WebKit's default tab mode in the Mac, iPhone and iPad apps.
> - Tab order: the section header, then the Photo group's links in number order, then Audio, then Video, then the first gallery control.
> - The number of tab stops grows with the bird's item count. The design accepts that.
> - `lib/tabOrderCoverage.test.ts` stays green.

> **NFR-03 - Theming and layout:** All colors come from `var(--sr-*)` tokens and work in both themes, with no hardcoded hex or RGB. The phone-tier layout is expressed in CSS classes, never in inline breakpoint styles (`.claude/rules/ui.md`).

> **NFR-04 - Network and privacy (durable form):**
> - The feature adds no third-party request, no new endpoint or host, and no request moved between components, on any of the six shipped targets.
> - That includes no additional `storage` seam or transport call on web or Pi: the list reads only gallery items the tab already holds.
> - A link is navigation the user starts, to `macaulaylibrary.org/asset/…`, which each tile already links to.
> - `src-tauri/tauri.conf.json` (`app.security.csp`) and `src-tauri/capabilities/default.json` do not change.
> - `lib/tauriCsp.test.ts` and `lib/tauriHttpScope.test.ts` pass untouched.
> - `PRIVACY_POLICY.md` is unchanged and stays true ("direct Macaulay Library links remain available and contact the site only when you choose to open one").

> **NFR-05 - Security:**
> - The only value from outside the code that reaches a URL is the catalog id. It must pass `MEDIA_CATALOG_ID_RE` and goes through `mlAssetUrl`, which `encodeURIComponent`-wraps it.
> - No bird name, date or other user-file text is interpolated into a URL.
> - Every DOM identifier in the list (each format label's `id` and the `aria-labelledby` that points at it) is generated by the framework (`useId`) combined with an index, never from the bird's name or other user-file text.
> - Declared scan: building the list is one pass over the bird's gallery items already in memory, linear in that list, with one anchored digits-only test per item. The feature adds no new pass over the ML export or the eBird backup.

> **NFR-06 - Reuse and rule coverage:**
> - Hrefs are built only by `mlAssetUrl`, validity is only `MEDIA_CATALOG_ID_RE`, dates are only `formatDate`, and links are only `OutboundLink`.
> - The build adds no URL builder, no contributor-id read and no catalog link.
> - A new file the build adds either matches an existing glob (`frontend/src/components/NamedBirdMedia*.tsx` in `media-embeds.md`, `frontend/src/lib/namedBird*.ts` in `bird-names.md`) or extends that rule's `paths` in the same change. It should also join `.claude/rules/security.md`'s `paths`, since it renders hrefs.

> **NFR-07 - Compatibility:**
> - The feature ships to Mac, Windows, iPhone, iPad and web/Pi.
> - In the Tauri apps a link opens through the existing opener permission (`opener:default`), so no capability changes.
> - `entryChunk.test.ts` stays green.
> - `npm run build` passes before push.

> **NFR-08 - Performance:**
> - The list mounts no iframe, requests nothing, and does not count against the live-player cap or the "Show more" batch.
> - Its derivation re-runs only when the bird's gallery items change, not on scroll, on reveal or on an embed-state change.

> **NFR-09 - Test discipline:**
> - Async tests wait for the exact observable the next assertion consumes, which is the list link with its expected `href`, never the media section alone. Never use a sleep or a longer timeout instead.
> - The click acceptance criterion gets a runtime row through `frontend/src/test/tauriOpener.ts`, since `newTabLinkDispatch.test.ts` proves the dispatch is written, not that it fires.
> - Existing per-item assertions in `NamedBirdMedia.test.tsx` keep passing. Where an existing query becomes ambiguous because list links also name Macaulay Library, the query is scoped to its tile; the assertion is never weakened.

> **NFR-10 - Copy approval:**
> - No change to `website/` (other than the version stamp), `README.md`, `appstore/LISTING.md` or App Store Connect copy, or `PRIVACY_POLICY.md`, and none is proposed.
> - In-app text and `docs/HELP.md` are written without a stop.
> - The App Store "What's New" line at ship is held for the user's express yes.

> **NFR-11 - Release:**
> - Patch version bump across the four-file set (`frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, `website/index.html` version pill and footer).
> - The user gets a live look at the built app before the deploy gate, since the surface is visible.

## Out of Scope

- **A species-level catalog row on Named Birds** (Photos / Audio / Video to `media.ebird.org/catalog` filtered by contributor and species). Macaulay Library has no URL filter for a named individual, so such a link could only open all of the user's media of the species, and the user chose per-item links instead (D1).
- **Species Detail, including a row on the Recent Media card.** It would have repeated the Media card's count links URL for URL, so the user removed it as redundant (D2). Species Detail is unchanged by this build: the Media card, Recent Media, and Named Individuals alike.
- Reading the ML contributor id anywhere, and any change to how the existing contributor-id parsers or catalog URL builders work.
- Loading, downloading or displaying media from Cornell's CDN (`cdn.download.ams.birds.cornell.edu`), the separate on-hold idea rejected on the record at v0.5.76.
- Any replacement gallery: thumbnails, previews or a custom player.
- Any change to embed behavior: `mlEmbedGate`, `MediaFrame` and its fallbacks, `EmbeddedMediaDisabled`, the Disable embedded media setting, the reveal cap or lazy mounting.
- Narrowing by date window, region, behavior tag or checklist.
- A cap, pagination or "Show more" on the item list itself. It lists every item.
- An explanatory note when the list is absent.
- Multimedia, Statistics, Media Comments, the Checklists tab's media filters, the Calendar's Media overlay, the Map Explorer's Media Targets view, and the iPhone and iPad widgets and Alerts.
- `website/`, `README.md`, the App Store listing and `PRIVACY_POLICY.md` copy.

## Open Questions

All four questions the first draft carried were settled by the user at The Designer (decisions.md D1 and D2):

- **OQ-01, the named-bird link target:** per-item links, one per media item, grouped by format and numbered newest first. No species-level catalog link (D1, D2).
- **OQ-02, Species Detail:** out of scope. The Recent Media row would duplicate the Media card's count links (D2).
- **OQ-03, no contributor id:** moot. Nothing in this build reads the contributor id, so the list shows whatever the export's filename says (D2).
- **OQ-04, wording:** the round 2 mockup's copy, specified in FR-06 and FR-07 (D2).

The first draft's assumption that a species-code catalog search includes the species' forms no longer applies, because no link in this build searches the catalog.

None - all decisions are resolved in this document.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01 presence | Opening Winky (24 photos and 3 audio, all with valid catalog numbers) renders the item list with its lead line. |
| QA-02 | FR-01 absence | A bird with no matched media shows "No media matched to this bird." and no item list. A bird whose only items all fail `MEDIA_CATALOG_ID_RE` renders no item list and no lead line, while its tiles render as before. |
| QA-03 | FR-02 placement | In document order, the "Media of {name}" header comes before the item list, which comes before the disabled status when shown, which comes before the gallery grid or list, in every embed state. |
| QA-04 | FR-02 collapsed and no ML | A collapsed card contains no item list. With no ML export loaded there is no media section and no item list. |
| QA-05 | FR-03 items behind "Show more" | With the initial batch of 6 revealed, Winky's list has 24 Photo links and 3 Audio links. After "Show more" is pressed until exhausted, the list is identical (same hrefs, accessible names and order). |
| QA-06 | FR-03 item without a valid catalog number | A bird with photos [valid A, invalid, valid B] in gallery order shows a Photo group of exactly 2 links, numbered 1 (A) and 2 (B), with names saying "of 2". The invalid item's tile renders as today. |
| QA-07 | FR-04 grouping and order | A bird with all three formats shows groups Photos, Audio, Video in that order. A video-only bird shows only a Video group. In each group, link n's href is the asset URL of the nth item of that format in gallery order, and link 1 is the newest. |
| QA-08 | FR-04 tie-break | Two photos with the same date list in catalog id descending order, matching the gallery's order. |
| QA-09 | FR-05 hrefs | Every list href equals `https://macaulaylibrary.org/asset/<catalogId>` for its item, and for each revealed tile it is byte-equal to that tile's "Macaulay Library" link href. No list href contains `media.ebird.org`, `userId` or `taxonCode`. |
| QA-10 | FR-06 visible copy | The lead line reads "Winky on Macaulay Library, newest first:". The group labels read "Photos", "Audio" and "Video". Each link's text is digits only. No U+2014 appears in the list. |
| QA-11 | FR-07 accessible name with a date | With the month-first date format, Winky's third photo (dated 2026-01-18, in a group of 24) has the accessible name exactly "Photo 3 of 24 of Winky, Jan 18, 2026, on Macaulay Library (opens in a new tab)", with "(opens in a new tab)" occurring once. |
| QA-12 | FR-07 accessible name without a date | An item whose date is empty, the only photo of a bird named Notch, has the accessible name exactly "Photo 1 of 1 of Notch on Macaulay Library (opens in a new tab)". |
| QA-13 | FR-07 list structure | Each format group is a list (`role="list"`, items `listitem`) whose accessible name is its format label ("Photos", "Audio", "Video"), with exactly N items. |
| QA-14 | FR-08 embed state: players working | Baseline: record the list's groups, link count, order, hrefs, accessible names and DOM position. |
| QA-15 | FR-08 embed state: bot check up | With `mlEmbedGate` reporting gated, the list equals the QA-14 baseline exactly. |
| QA-16 | FR-08 embed state: embeds disabled | With `embedAllowed` false, and separately with the unresolved preference, the list equals the QA-14 baseline and sits above the "Embedded media is disabled in Settings." status. |
| QA-17 | FR-08 embed state: offline | With `useOnline` offline, the list equals the QA-14 baseline. |
| QA-18 | FR-08 other independence | The list equals the QA-14 baseline in each case: when the gate flips from gated to not gated while the card is open; with an ML export filename carrying no contributor id (`my-media.csv`); and with the taxonomy lookup rejecting. |
| QA-19 | FR-09 Tauri runtime click | With `installTauriOpener()`, clicking Winky's Photo 3 link yields `calls()` of length 1, `via: 'own'`, `url` equal to the anchor's resolved `href`. The same holds for a link whose item "Show more" has not revealed. |
| QA-20 | FR-09 web/Pi | With no Tauri internals, each link has `target="_blank"`, a `rel` including `noreferrer`, and a click that the app does not cancel. |
| QA-21 | FR-10 existing behavior unchanged | Rendered with and without the list (a bird whose items all fail the gate switches it off), every tile asset link, fallback link and checklist link has identical presence, href, text and accessible name. The "Showing N of M" line and the "Show more" label are unchanged. After a reveal that exhausts the list, `document.activeElement` is the first newly revealed tile and not a list link. |
| QA-22 | FR-11 export replaced or removed | With the tab mounted on export A, replacing it with export B (different items for the bird) makes the list show only B's items. Removing the export removes the section and list. This happens without a relaunch or tab remount. |
| QA-23 | FR-12 Named Individuals | Species Detail's Named Individuals section contains no item list and no `macaulaylibrary.org/asset` hrefs from one. |
| QA-24 | FR-13 Help | `docs/HELP.md`'s "Media of a named bird" paragraph describes the numbered list and says each number opens that item on Macaulay Library, including items behind Show more. No U+2014 appears in the changed lines, and no other Help paragraph changes. |
| QA-25 | NFR-01 320px / 200% | Measured in a real browser engine at 320px and 200% in-app text scale: Winky's 24 photo numbers wrap within the card, and a 120-character spaceless bird name in the lead line wraps. The card's `scrollWidth` is at most its `clientWidth`, and the page has no horizontal scroll. If the user defers it, this row is Partial, not passed. |
| QA-26 | NFR-01 target sizes | Measured in a real browser engine: at desktop width and 100% text, every list link's box is at least 24 by 24 CSS pixels. In the phone tier, every box is at least 44 by 44, horizontally adjacent boxes in a group have zero gap, and each format label sits above its numbers. If the user defers it, this row is Partial. |
| QA-27 | NFR-02 Tab reachability | `tabOrderCoverage.test.ts` passes and every list link resolves to `tabIndex` 0. In DOM tab order the links follow the section header, run Photo 1..N, then Audio, then Video, and precede the first gallery control. |
| QA-28 | NFR-04 no network change | `tauriCsp.test.ts` and `tauriHttpScope.test.ts` pass with no diff to them, to `tauri.conf.json`'s `csp` or to `capabilities/default.json`. In component tests, transport, storage and fetch spies record the same calls with the list as without it. `PRIVACY_POLICY.md` has no diff. |
| QA-29 | NFR-05 DOM ids and URL inputs | For birds named `Old Blue` and `x" y`, no `id` or `aria-labelledby` in the list contains whitespace or the bird's name, and no href contains the name or the date. A catalog id failing `MEDIA_CATALOG_ID_RE` never appears in a list href. |
| QA-30 | NFR-06 reuse and rules | A grep of the feature diff finds no new `macaulaylibrary.org/asset` literal outside `lib/mlCatalog.ts`, no new `extractUserId` call and no `media.ebird.org/catalog` string. Every new file matches a `paths` glob in `media-embeds.md` (and in `bird-names.md` for a `lib/` file). |
| QA-31 | NFR-08 performance | With players working, the number of mounted iframes in Winky's section is the same with the list present as with it absent (the initial batch only). The list's derivation is not re-run by a reveal or an embed-state change. |
| QA-32 | NFR-07 / NFR-09 build and suite | `npm run build`, the full frontend suite and `entryChunk.test.ts` pass, and `NamedBirdMedia.test.tsx`'s per-item assertions are kept, scoped rather than weakened where needed. |
| QA-33 | NFR-10 copy boundaries | The feature diff touches no file under `website/` other than the version stamp, and no `README.md`, `appstore/LISTING.md` or `PRIVACY_POLICY.md`. |
| QA-34 | NFR-11 release set | `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md` and the `website/index.html` version pill (text and `aria-label`) and footer all carry the same new patch version. |
