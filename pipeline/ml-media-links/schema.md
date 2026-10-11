# Schema - Macaulay Library links beside media galleries

**Feature:** ml-media-links
**Date:** 2026-10-08 (revised the same day after The Designer, per `decisions.md` D1 and D2)
**Stage:** 3 - The Architect (run hands-off; the path is declared here rather than confirmed in chat)
**Source:** prd.md (being amended to D2 in parallel), strategic-brief.md, decisions.md, design.html (Named Birds part)

**What changed in this revision.** The user replaced the Named Birds species-level catalog row with a compact per-item list (D1, D2), and dropped Species Detail entirely (D2). Everything this schema previously specified for the contributor id, the taxon code, `catalogLinkRow`, the `MlCatalogLinks` component, the Named Birds prop threading and Species Detail is withdrawn. PRD QA rows are referred to below by what they verify, because their ids are being renumbered in the amended PRD.

## 1. Path

**Architect assessment - Frontend Only.** Prior `schema.md` files exist, so the project is incremental, but this feature touches none of its stored structures. Read against the approved direction: nothing is created, nothing is read from a new place, nothing is updated or deleted, no relationship is added and no derived value is stored. The list is derived at render time from the one array the Named Birds media section already holds, `assets`, plus the bird's name.

## 2. Confirmation: no data layer changes

- No new or changed document under `AppLocalData/data/`, no settings key, no `docChains` link, no `storage` seam route, no backend route, no migration.
- No new cache or store, so no `clearDerived.ts` row; no new epoch; no new React state anywhere.
- No iCloud Sync, widget, Alerts or native change.
- No network change of any kind (section 8.4).
- No change to `NamedBirds.tsx`, `NamedBirdsTable.tsx`, `NamedBirdRow.tsx`, `SpeciesDetail.tsx` or `lib/mlCatalog.ts`. The contributor id is not read by this build at all.

## 3. Existing data used by this feature

### 3.1 Inputs

| Input | Where it comes from today | Used for |
|---|---|---|
| `assets: NamedBirdAsset[]` | `computeNamedBirdMedia(mlRows)` in `NamedBirds.tsx`, threaded through `NamedBirdsTable` (`mediaByBird`) and `NamedBirdRow` (`media`) to `NamedBirdMedia` (`assets`), unchanged | every listed item, including those "Show more" has not revealed |
| `NamedBirdAsset.catalogId` | parser-guaranteed digits only (`lib/parseMLExport.ts`) | the href, through `mlAssetUrl`, after the same gate the tile applies |
| `NamedBirdAsset.format` | `'Photo' \| 'Audio' \| 'Video'`, parser-guaranteed | the row a link sits in |
| `NamedBirdAsset.date` | the raw export date string, `''` when absent | the accessible name and `title`, through `formatDate` at render, exactly as the tile's date label |
| `birdName` | `bird.name`, already a `NamedBirdMedia` prop | the visible lead and every accessible name |

### 3.2 Facts the design rests on (each checked in the code)

- `assets` is already in the gallery's newest-first order: `computeNamedBirdMedia` sorts each bucket by date descending with `catalogId` as the tie-break, and dedupes by `catalogId` per bird. The list keeps that order within each format, so it needs no sort of its own.
- `assets` is identity-stable for any bird with media (`mediaByBird` is memoized on the ML rows and `.get` returns the same array), so a memo keyed on it does not re-run when "Show more" re-renders the section.
- The tile's own link is `OutboundLink href={mlAssetUrl(asset.catalogId)}`, rendered only when `MEDIA_CATALOG_ID_RE.test(asset.catalogId)` (`NamedBirdMedia.tsx`, `NamedBirdMediaItem`). `MEDIA_CATALOG_ID_RE` is `/^\d+$/` (no `u` flag, so ASCII digits only) and `mlAssetUrl` wraps the id in `encodeURIComponent`. Calling both the same way gives the list the same gate, the same encoding and the same URL as the tile, by construction.
- `formatDate`'s parse is one start-anchored regex with bounded quantifiers and no end anchor, so it reads at most the first few characters of a date cell whatever its length: constant work per item.
- `NamedBirdMedia` renders nothing when `!hasML || !open` (line 76), renders "No media matched to this bird." when `assets` is empty, and its `total > 0` branch opens with `{!embedAllowed && (...)}` (line 126). The list goes first in that branch (section 6).
- Species Detail's Named Individuals reuse never mounts `NamedBirdMedia` (`NamedBirdRow`'s `showMap` gate), so it never shows the list.
- `NamedBirdsTable` on the Named Birds tab is single-open, so at most one list is in the DOM at a time.

## 4. New export

```ts
// frontend/src/lib/mediaEmbed.ts (addition; existing exports unchanged, no new import)

/** The fixed display order of the three ML formats. */
export const MEDIA_FORMAT_ORDER: readonly MediaType[] = ['Photo', 'Audio', 'Video']

export interface MediaItemLinkGroup {
  format: MediaType
  /** This format's linkable items, in input order (the gallery's newest-first). */
  items: { catalogId: string; date: string }[]
}

/** The named-bird per-item list (D2): one group per format present, in
 *  MEDIA_FORMAT_ORDER, holding only items whose catalogId passes
 *  MEDIA_CATALOG_ID_RE (the tile's own gate). An item that fails it gets no
 *  entry, so it neither takes a number nor counts toward a total. Empty groups
 *  are omitted; returns [] when no item is linkable. One pass over `items`. */
export function mediaItemLinkGroups(
  items: Iterable<{ catalogId: string; format: MediaType; date: string }>,
): MediaItemLinkGroup[]
```

An item's number is its index in `items` plus one, and the total is `items.length`, both read at render. Why `lib/mediaEmbed.ts`: it already owns `MEDIA_CATALOG_ID_RE` and `MEDIA_FORMAT_META` for exactly this section, it is entry-safe and already on the entry graph, `.claude/rules/media-embeds.md` already gates it, and a pure function there is testable in node, which a `.tsx` export cannot be (react-refresh/only-export-components).

## 5. Module plan and component shape

| File | Change |
|---|---|
| `frontend/src/lib/mediaEmbed.ts` | adds `MEDIA_FORMAT_ORDER`, `MediaItemLinkGroup`, `mediaItemLinkGroups` |
| `frontend/src/components/NamedBirdMedia.tsx` | adds a module-private `NamedBirdMediaLinks` component and renders it (section 6) |
| `frontend/src/globals.css` | the design's `.sr-ml-items` / `.sr-mli-*` rules (section 6.3) |
| `docs/HELP.md` | the Named Birds sentences only (the amended PRD's Help requirement) |

**No new source file.** With one call site, the list lives in `NamedBirdMedia.tsx` as a module-private function component beside `NamedBirdMediaItem`, the file's existing precedent. It reads only what the section already has (`assets` through the memo, and `birdName`), and keeping it in the file puts the list's `mlAssetUrl(catalogId)` call next to the tile's, so "the same URL as the tile" is visible at one glance. Not exporting it keeps the file component-only for react-refresh. Every link renders through `OutboundLink`.

## 6. The change in `NamedBirdMedia.tsx`

### 6.1 Derivation and placement

- `const linkGroups = useMemo(() => mediaItemLinkGroups(assets), [assets])` goes ABOVE the `if (!hasML || !open) return null` early return (line 76), with the other hooks.
- In the `total > 0` branch only, `<NamedBirdMediaLinks groups={linkGroups} birdName={birdName} />` is the FIRST child of the fragment, before `{!embedAllowed && (...)}`. That gives the order header row, list, disabled status (when shown), grid or list of tiles. It keeps the list out of the empty state and out of a collapsed card, and holds one fragment slot in every embed state, because `{cond && x}` leaves a placeholder: toggling `embedAllowed`, the bot-check gate or the online status neither shifts nor remounts it.
- `NamedBirdMediaLinks` returns `null` when `groups` is empty, so a gallery with no valid catalog number shows no list at all (no container, no lead).
- It reads nothing else: not `embedAllowed`, `useOnline`, `useMlEmbedGate`, `revealCount`, storage or transport.

### 6.2 Markup contract (from `design.html`, Named Birds part)

```tsx
<div className="sr-ml-items">                                   {/* the tests' stable hook */}
  <p className="sr-mli-lead"><b>{birdName}</b> on Macaulay Library, newest first:</p>
  <div className="sr-mli-grid">
    {groups.map((g, gi) => (
      <Fragment key={g.format}>
        <span className="sr-mli-fmt" id={`${baseId}-f${gi}`}>
          <Icon aria-hidden />{LABEL[g.format]}                {/* MEDIA_FORMAT_META[g.format].icon */}
        </span>
        <ul className="sr-mli-list" role="list" aria-labelledby={`${baseId}-f${gi}`}>
          {g.items.map((item, i) => {
            const dateLabel = formatDate(item.date)            // at render, as the tile does
            return (
              <li key={item.catalogId}>
                <OutboundLink
                  className="sr-mli-link"
                  href={mlAssetUrl(item.catalogId)}
                  title={dateLabel || undefined}
                  aria-label={`${g.format} ${i + 1} of ${g.items.length} of ${birdName}${dateLabel ? `, ${dateLabel},` : ''} on Macaulay Library`}
                >
                  {i + 1}
                </OutboundLink>
              </li>
            )
          })}
        </ul>
      </Fragment>
    ))}
  </div>
</div>
```

- `baseId` is `useId()` in `NamedBirdMediaLinks`, so every id is framework-generated plus a format index, never bird, species or file text (`ui.md`, v1.0.21). No other id or IDREF.
- `role="list"` is explicit because WebKit drops list semantics from a `<ul>` styled `list-style: none`, and the `aria-labelledby` needs a list role to label (house precedent: `BirdingStats.tsx`'s milestone list).
- `LABEL` is module-private: `Photo` -> "Photos", `Audio` -> "Audio", `Video` -> "Video".
- `OutboundLink` appends " (opens in a new tab)", giving "Photo 3 of 24 of Winky, Jan 18, 2026, on Macaulay Library (opens in a new tab)", and "Photo 3 of 24 of Winky on Macaulay Library (opens in a new tab)" for an item with no readable date. No `target`, `rel`, `onClick` or `tabIndex` at the call site: `OutboundLink` owns the new-tab attributes, the `Link` primitive's `tabIndex={0}`, and the link's own Tauri dispatch.
- The visible label is the number, and the name contains it as a whole word (WCAG 2.5.3). The number counts within its format, so the name says the format first ("Photo 3 of 24") rather than implying the third tile of the mixed gallery.
- No U+2014, American spelling, no count other than the item's own "n of total".

### 6.3 Styling

The design's rules move into `globals.css` as written, with every color through `var(--sr-*)`: 24px targets at rest on desktop (`min-width` and `height` `1.5rem`, the box visible only on hover and focus), and in the existing 640px-and-below tier the label above its numbers and 44px targets with no gap between them (`2.75rem`). The mockup's `.is-phone` selectors become that media tier, never inline breakpoint styles; the `prefers-reduced-motion` rule drops the hover transition. The lead carries `overflow-wrap: anywhere`, and no text containing the bird's name is `white-space: nowrap`.

## 7. Copy

Owned by The Designer and approved in D2: the lead "{name} on Macaulay Library, newest first:", the three row labels, and the accessible-name formula above. All strings sit in `NamedBirdMedia.tsx`; tests assert the rendered text and names.

## 8. Security

### 8.1 What reaches a URL

Only `catalogId`, gated by `MEDIA_CATALOG_ID_RE` (the tile's own predicate) inside `mediaItemLinkGroups`, then `encodeURIComponent`-wrapped by `mlAssetUrl`. Both protections are the existing tile builder's, reused rather than restated. The bird's name reaches only a text node, an `aria-label` and nothing else, all escaped by React; no species name, comment or other file text reaches any href.

### 8.2 DOM identifiers

`useId()` plus the format index, as above. React keys are the `MediaType` and the item's `catalogId` (unique within a bird by `computeNamedBirdMedia`'s dedupe); neither becomes a DOM attribute.

### 8.3 Declared work over user data

| Work | Input | Bound |
|---|---|---|
| `mediaItemLinkGroups(assets)` (new) | the open bird's matched assets, the same array the gallery holds | one pass, linear in that array; per item one test of an anchored single-class digit regex on a parser-guaranteed digit string; memoized on `assets`, so it runs once per ML load per opened card, not on reveal, focus, scroll or resize |
| `formatDate(item.date)` per listed item, at render | the item's date cell | constant per item (section 3.2); linear in the listed items per render of the section, the same call the tile already makes for each revealed item |
| Links in the DOM | the open bird's linkable items | one anchor per item, no iframe, no request; one list at a time (single-open accordion) |

No new pass over the ML export or the eBird backup, and no loop driven by a number read from the file beyond the item count the gallery already iterates. No clamp is declared, so none needs a cost.

### 8.4 Network and privacy, in the durable form

- **No third-party request, no new endpoint or host, and no request moved between components**, on all six shipped targets. The list performs no read of any kind: no `storage` seam call, no transport call.
- A link is navigation the user starts, to `macaulaylibrary.org/asset/<id>`, the exact URL the tile's own "Macaulay Library" link and the fallback's "View on Macaulay Library" link already open. In the Tauri apps it opens through the existing `opener:default` permission.
- A link is not a page load, so `app.security.csp` and `capabilities/default.json` do not change, and `lib/tauriCsp.test.ts` and `lib/tauriHttpScope.test.ts` pass untouched (neither reads anchor hrefs).
- `PRIVACY_POLICY.md` stays true unchanged ("direct Macaulay Library links remain available and contact the site only when you choose to open one").

## 9. Entry chunk

`NamedBirdMedia.tsx` is on the entry graph (`App.tsx` imports `NamedBirds` statically). The change adds no module and no external to that graph: `NamedBirdMedia.tsx` already imports `OutboundLink`, `mlAssetUrl`, `formatDate`, `MEDIA_FORMAT_META` (with its lucide icons) and `MEDIA_CATALOG_ID_RE`, and `lib/mediaEmbed.ts` gains a function with no new import. The cost on first paint is the added bytes in two existing modules. `entryChunk.test.ts` needs no new row and stays green.

## 10. Rule-file `paths`

No production file is added, so no `paths` list needs extending. Coverage already holds: `media-embeds.md` gates `frontend/src/components/NamedBirdMedia*.tsx` and `frontend/src/lib/mediaEmbed*.ts`, and its rules already govern this case (catalog id `^\d+$`-guarded, links through `mlAssetUrl`, local metadata and direct links kept in every embed state); `ui.md` covers `frontend/src/components/**`; `testing.md` covers every test file and `website/tools/verify/**`. The new test files are named so the same globs load the governing rules on them (`components/NamedBirdMedia*.test.tsx`, `lib/mediaEmbed*.test.ts`, `lib/namedBird*.test.ts`). Left alone: `security.md` does not gate `NamedBirdMedia*.tsx`, which already rendered asset hrefs before this build; the gate and encoding rules that apply here load through `media-embeds.md`.

## 11. Test plan, by what each row verifies

| File | New or extended | Harness | Verifies |
|---|---|---|---|
| `frontend/src/lib/mediaEmbed.test.ts` | new | node | groups appear in Photo, Audio, Video order whatever the input order; only formats present; within a format the input order is kept; an item failing `MEDIA_CATALOG_ID_RE` (empty, `ML123`, `12a`, a non-ASCII digit written as an escape) is absent and not counted; all invalid or empty input gives `[]`. Fixtures are built by running ML rows through `computeNamedBirdMedia`, so the order under test is production's (testing.md, v1.0.21) |
| `frontend/src/components/NamedBirdMediaLinks.test.tsx` | new | jsdom, `NamedBirdMedia` rendered directly; `IntersectionObserver` stubbed and `navigator.onLine` set as `NamedBirdMedia.test.tsx` does; `../lib/mlEmbedGate` mocked with a test-controlled `useSyncExternalStore` store so the gate can be set and flipped | **rows and numbers:** one row per format present, in order, numbered 1..n newest first within the format; **coverage beyond the reveal:** with more items than the initial batch, every item is listed before "Show more" is pressed; **same URL as the tile:** for each item, the list link's `href` equals that tile's "Macaulay Library" link `href` (after revealing all), and equals `mlAssetUrl(catalogId)`; **no number for an invalid id:** such an item is skipped and the totals exclude it, and a gallery whose ids are all invalid shows no list; **presence:** no list in the empty state, in a collapsed card (`open={false}`) or with `hasML={false}`; **embed independence:** a baseline (link count, order, hrefs, names, position) is identical with players working, the gate reporting gated, `embedAllowed={false}` and offline, and the same element references survive the gate flipping mid-session; **placement:** document order is header, list, disabled status, tiles in every state; **accessible names:** the exact formula with a date and without one, the visible number contained as a word, no U+2014 (written as the escape `'\u2014'`); **ids:** with a bird named `Old Blue`, no `id` or `aria-labelledby` contains whitespace or the name, and each list's `aria-labelledby` resolves to its format label; **web/Pi:** `target="_blank"`, `rel` containing `noreferrer`, and a click the app does not cancel; **Tauri runtime click:** with `installTauriOpener()`, one `own` call whose `url` is the anchor's resolved `href`, and the click is cancelled; **tab order:** the list's links resolve `tabIndex` 0 and precede the first tile control; **per-item links unchanged:** the tile links, fallback links and checklist links (queried outside `.sr-ml-items`) keep their presence, `href`, text and names in all four states; **derivation not re-run on reveal:** a partial `vi.mock` of `../lib/mediaEmbed` wrapping `mediaItemLinkGroups` records no new call when "Show more" is pressed; **no request:** a `fetch` spy records nothing during a render with `embedAllowed={false}`; **Named Individuals:** a `NamedBirdsTable` rendered in Species Detail's media-less mode contains no `.sr-ml-items` and no `macaulaylibrary.org/asset` href |
| `frontend/src/lib/namedBirdMediaLinksHelpClaims.test.ts` | new | node, reads `docs/HELP.md` (shape: `firstOfYearHelpClaims.test.ts`) | the "Media of a named bird" paragraph exists, mentions the numbered links, says they open each item on Macaulay Library and stay available whatever the players are doing, and contains no U+2014 |
| `website/tools/verify/verify-named-bird-media-links.mjs` | new, added to `run.mjs`'s `ORDER` with a declared budget if it needs more than the default | real engines against the built dist with a stubbed backend (shape: `verify-named-birds-header.mjs`, with `/settings/files` naming an ML file and `/settings/files/ml` serving it) | the 320px / 200% reflow row and the target-size row: a band of widths from 320px up, the four in-app text scales, Chromium and WebKit, a bird with well over a hundred items (three-digit numbers, many wrapped lines) and a long bird name in the lead; ink measured through a `Range` against the section's content box; every link's `getClientRects()` box at least 24px square above the phone tier and at least 44px square in it; asserts the count of configurations measured; an `--expect-broken` leg that forces each list onto one line, which at 320px overflows by far more than any font difference |
| Unchanged and must stay green | | | `NamedBirdMedia.test.tsx` unmodified (its queries were checked against the list: dates are matched as text and the list carries them only in `title` and `aria-label`; per-item link queries match `(ML77)`, `View Photo on` and `open checklist`, none of which a list name contains; its one `getByText('Audio')` is scoped `within` a tile), `RecentMediaEmbed.test.tsx`, `NamedBirdsTable.test.tsx`, `tabOrderCoverage.test.ts`, `newTabLinkDispatch.test.ts` (the list writes no raw anchor and no `target`), `tauriCsp.test.ts`, `tauriHttpScope.test.ts`, `entryChunk.test.ts`, every Species Detail suite |
| Diff checks by QA | | | no change to `SpeciesDetail.tsx`, `NamedBirds.tsx`, `NamedBirdsTable.tsx`, `NamedBirdRow.tsx`, `lib/mlCatalog.ts`, `tauri.conf.json`'s policy, `capabilities/default.json` or `PRIVACY_POLICY.md`; no `website/` change but the version stamp; the release set |

Test-discipline notes:

- An async row waits for the exact element its next assertion reads (a link with its expected `href` and name), never for the section (CLAUDE.md, v1.0.25).
- The "unresolved preference" embed state reaches the section as `embedAllowed === false`, the same input as a saved Disable embedded media; the mapping is owned by `lib/useEmbeddedMediaPreference.test.tsx`. One row at `embedAllowed={false}` is the coverage, said so in the test.
- Write U+2014, non-ASCII digits and any invisible character as escapes, and grep the written file for the literal afterwards: an agent's editing tools have converted escapes before (testing.md, v1.0.52).
- A guard that spells a CSS value in a string can emit a Tailwind utility from a test file (testing.md, v0.5.85); follow such a guard with a built-CSS check.

## 12. Settled questions and out of scope

- **OQ-01 (named-bird target):** settled as per-item links (D1, D2). No species-level link on Named Birds.
- **OQ-02 (Species Detail):** settled as out of scope (D2). The Recent Media card, the Media card and everything else on Species Detail are unchanged by this build.
- **OQ-03 (no contributor id):** moot (D2). Nothing in this build reads the contributor id.
- **OQ-04 (copy):** settled in D2 (section 7).
- Out of scope, carried from the PRD: Cornell CDN media, a replacement gallery, any embed-behavior change, Media Comments, Checklists, the Calendar's Media overlay, Map Explorer, widgets, Alerts, Multimedia, Statistics, and every published surface (`website/`, `README.md`, the App Store listing, `PRIVACY_POLICY.md`).

## 13. Recorded decisions

- **Every item is listed, with no reveal of its own.** A bird with many items puts one link per item in front of the gallery, so a keyboard user Tabs through them first. D2 approved this deliberately; the bound is the open bird's linkable items, one bird at a time.
- **Dates are formatted at render, not memoized**, so a change to the date-format preference reaches the list's names exactly as it reaches the tile's date label. The cost is constant per item.
- **Numbers count within their format**, matching the approved names; they do not match a tile's position in the mixed newest-first gallery, which is why each name leads with its format.
- **Withdrawn with the species-level design:** the contributor-id plumbing on Named Birds, its pairing residual, the stale-taxon-map note, the `MlCatalogLinks` component, `catalogLinkRow` and `formatsHeld`, and every Species Detail change, test and Help sentence.

## No data layer work required

The Engineer proceeds directly to the UI and its tests. No migration is written or run, and no stored document changes.
