# Design Spec: Macaulay Library media links

**Feature:** ml-media-links
**Stage:** 4, The Designer (approved by the user, round 2, 2026-10-08)
**Mockup:** `pipeline/ml-media-links/design.html`
**Decisions:** D1 to D3 in `pipeline/ml-media-links/decisions.md`

## Scope in one paragraph

Named Birds only. Each named bird's "Media of {name}" section gains a compact list of links: one numbered link per media item of that bird, grouped by format, each opening that item's Macaulay Library page. **Species Detail is out of scope and unchanged.** Its Media card already links each format's count to the same catalog view a Recent Media row would have opened, so the user dropped that row as redundant (D2). **The list does not depend on the contributor id.** Each link is built from the item's own catalog number, so the export's filename does not matter. Where the PRD (Groups A to C, FR-01 to FR-19) and the schema (sections 4 to 7) describe a species-level catalog-link row, a contributor id or Species Detail work, this spec supersedes them. The orchestrator amends those files (D2).

## Visual Direction

This is quiet utility in the app's established register. A muted lead line names the bird, then one short row per format holds a small uppercase format label and a run of green numbers. At rest it reads as an index of the gallery below, not as a second set of controls. The green stays reserved for the actionable numbers. The box behind a number appears only on hover or keyboard focus, so a bird with dozens of items still looks compact. No new tokens, colors or type sizes: every value already exists in the section around it.

## Screens / Views

### Named Birds, expanded card, "Media of {name}" section

**Placement.** The list lives in `NamedBirdMedia`'s `total > 0` branch, as the first child of the fragment. It sits directly below the existing header row ("Media of {name}" and the "Showing N of M" count) and above the "Embedded media is disabled in Settings." status (when shown) and the gallery grid or list. It holds that slot in every embed state.

**Layout (wide tier, above 640px).**

```
▷ MEDIA OF WINKY                                          Showing 6 of 27
Winky on Macaulay Library, newest first:
[img] PHOTOS  1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
[mic] AUDIO   1 2 3
[ gallery tiles … ]
```

- The **lead** is a `<p>`: the bird's name (`birdName`, the individual's name as the card shows it) in `--sr-text` at weight 600, then " on Macaulay Library, newest first:" in `--sr-text-muted`. It ends in a colon, with no count.
- A **two-column grid**: column 1 is `max-content` (the format labels, so they line up), column 2 is `minmax(0, 1fr)` (the numbers, which wrap). There is one grid row per format the bird holds, in the fixed order Photo, Audio, Video. A format with no linkable items gets no row.
- The **format label** uses the app's existing format-marker voice, matching the tiles' "PHOTO / AUDIO / VIDEO" markers: the format's lucide icon from `MEDIA_FORMAT_META` (12px, stroke 2.2, `aria-hidden`), then the plural word ("Photos", "Audio", "Video"), uppercase through CSS. It is 1.5rem tall, so it centers on the first row of numbers.
- The **numbers** form a `<ul>` with one `<li>` per item, each holding one link whose visible text is its ordinal (1, 2, 3, …). They wrap under one another, never under the label, so the label column keeps a clean edge.

**Layout (phone tier, 640px and below).** The grid becomes one column, so each format label sits on its own line above its numbers (6px top margin, natural height). The number boxes grow to 2.75rem square with no gap between them. The 44px tap areas abut and the numbers keep an even rhythm. At 320px and 100% text, Winky's 24 photos take five rows of five. There is no negative margin. The round 2 measurement found that a rem-based pull-left grew past the section's fixed 14px padding at 150% and 200% text (D3).

**What the list contains.**
- **Every item of the bird**: all of `assets` (the join's full result), not `visible`. Items behind "Show more" are listed from the start, and pressing "Show more" does not change the list.
- **The gallery's own order**: `assets` is already sorted newest first (date, then catalog id). Within each format, number 1 is the newest item, which is what the lead's "newest first" says.
- **Only items with a valid catalog number**: an item is listed only when `MEDIA_CATALOG_ID_RE.test(asset.catalogId)`, the same gate the tile's per-item link uses. An item that fails it gets no number. The format's count ("of N") and the numbering both run over the linked items only, so the numbers are always contiguous.
- **Each link's `href` is exactly `mlAssetUrl(asset.catalogId)`**: the same builder, and so the same URL, as that tile's existing "Macaulay Library" link. No new URL shape, no `media.ebird.org/catalog` link, no contributor id, no taxon code.

**When it renders.** The list renders wherever the gallery renders and at least one of the bird's items has a valid catalog number. It renders nothing (no element, no empty container, no text) when none does. It is absent wherever the section or its gallery is absent: a collapsed card, no ML export loaded, or the "No media matched to this bird." empty state. Species Detail's Named Individuals reuse never mounts `NamedBirdMedia`, so it never shows the list.

**What it does not read.** Not `embedAllowed`, not the bot-check gate (`useMlEmbedGate`), not `useOnline`, not storage, transport, the contributor id or the taxon codes. It is identical in every embed state (players working, bot check up, embeds turned off, offline), and a state change during the session never adds to, removes or alters it.

## Component Usage

- **`OutboundLink`** for every number. It supplies `target="_blank"`, `rel="noreferrer"`, the `Link` primitive's `tabIndex={0}` default (WebKit tab mode), its own Tauri dispatch through `openNewTabLink`, and the " (opens in a new tab)" suffix appended to the explicit `aria-label`. Pass `className`, `href`, `aria-label` and `title` only: no `onClick`, `target`, `rel` or `tabIndex` at the call site.
- **lucide format icons** through `MEDIA_FORMAT_META[format].icon` (Image, Mic, Video), the same icons as the tile markers.
- **`formatDate(asset.date)`** for the date in each accessible name and tooltip, so it follows the user's date-format setting.
- **`useId()`** for the label-and-list association (below). No other ids.
- **Where it lives:** a small component is suggested, `components/NamedBirdMediaLinks.tsx`, taking `birdName` and `assets` and rendered by `NamedBirdMedia`. The name is deliberate: `.claude/rules/media-embeds.md` already loads on `components/NamedBirdMedia*.tsx`, so it covers the new file with no edit. The same change adds `frontend/src/components/NamedBirdMedia*.tsx` to `.claude/rules/security.md`'s `paths`, because the file renders hrefs. Rendering it inline in `NamedBirdMedia.tsx` is equally acceptable; that file is already inside media-embeds.md's gate and needs the same security.md line. Compute the per-format groups in a `useMemo` keyed on `assets`, placed above `NamedBirdMedia`'s early return with the other hooks, so "Show more" re-renders without recomputing.

**Markup shape** (class names are the mockup's and may be kept):

```tsx
<div className="sr-ml-items">
  <p className="sr-mli-lead"><span className="sr-mli-name">{birdName}</span> on Macaulay Library, newest first:</p>
  <div className="sr-mli-grid">
    {groups.map((g, gi) => (
      <Fragment key={g.format}>
        <span className="sr-mli-fmt" id={`${uid}-f${gi}`}><g.Icon size={12} strokeWidth={2.2} aria-hidden />{LABEL[g.format]}</span>
        <ul className="sr-mli-list" aria-labelledby={`${uid}-f${gi}`}>
          {g.items.map((a, n) => (
            <li key={a.catalogId}>
              <OutboundLink className="sr-mli-link" href={mlAssetUrl(a.catalogId)} aria-label={nameFor(g.format, n + 1, g.items.length, birdName, formatDate(a.date))} title={formatDate(a.date) || undefined}>
                {n + 1}
              </OutboundLink>
            </li>
          ))}
        </ul>
      </Fragment>
    ))}
  </div>
</div>
```

## Design Tokens Applied

All colors through `var(--sr-*)`, both themes, with no new tokens.

| Element | Token / value |
|---|---|
| Lead text | `--sr-text-muted`, 0.75rem, line-height 1.45, `overflow-wrap: anywhere` |
| Bird name in the lead | `--sr-text`, weight 600 |
| Format label | `--sr-text-muted`, 0.6875rem, weight 700, letter-spacing 0.04em, uppercase; icon 12px, stroke 2.2; height 1.5rem (wide) |
| Number | `--sr-accent`, 0.75rem, weight 600, `font-variant-numeric: tabular-nums`, no underline at rest |
| Number box | `min-width: 1.5rem; height: 1.5rem; padding: 0 4px; border-radius: 6px`; transparent at rest; `--sr-accent-bg` on hover and on `:focus-visible` |
| Hover underline | `text-decoration: underline; text-underline-offset: 2px` |
| Focus ring | the house ring (3px `--sr-accent` outline) with `outline-offset: 1px` and `box-shadow: none` for this dense run (D3) |
| Spacing, wide | list `margin: 0 0 12px`; lead `margin-bottom: 2px`; grid `column-gap: 8px; row-gap: 2px`; numbers `gap: 2px` |
| Spacing, phone | list `margin-bottom: 8px`; grid one column, `row-gap: 0`; label `height: auto; margin-top: 6px`; numbers `gap: 0`; box `min-width: 2.75rem; height: 2.75rem` |

Contrast is unchanged from the section's existing text: accent on the expanded card's faint surface clears AA in both themes (light `#277448` on `#FAFAFA`, dark `#34D399` on `#1C1C1F`), and so does accent on `--sr-accent-bg` (5.09:1 light). The phone-tier declarations go inside the existing ≤640 block in `globals.css`, not a new block (`.claude/rules/ui.md`). Layout is in classes only, with no inline layout styles. No text containing the bird's name is `white-space: nowrap`.

## Interaction Notes

- **Click or tap:** opens that item's Macaulay Library page through `OutboundLink`. The Mac, Windows, iPhone and iPad apps open the system browser exactly once with the rendered URL; web and Pi open a new tab. Modifier-key and middle clicks behave as on every other `OutboundLink`.
- **Hover:** the number's box fills with `--sr-accent-bg` and the number underlines. The native tooltip (`title`) shows the item's date when it has one.
- **Keyboard:** each number is one Tab stop, in reading order: Photos 1 to n, then Audio, then Video, then the gallery's controls. Focus shows the ring 1px off the box plus the box fill. For a bird with many items this adds one Tab stop per item, an accepted trade-off (D3). Each list is named by its format label, so screen-reader users can move past a whole list at once.
- **Accessible name:** `"{Format} {n} of {count} of {birdName}, {date}, on Macaulay Library"`, and `OutboundLink` appends " (opens in a new tab)". Example: "Photo 3 of 24 of Winky, Jan 18, 2026, on Macaulay Library (opens in a new tab)". `{Format}` is the item's singular format ("Photo", "Audio", "Video"); `{date}` is `formatDate(asset.date)`. When the date label is empty, drop the date and its two commas: "Audio 2 of 3 of Winky on Macaulay Library (opens in a new tab)". The name contains the visible number (WCAG 2.5.3). It leads with the format word so each link is self-explanatory in a links list (D3).
- **Screen-reader structure:** each `<ul>` takes `aria-labelledby` pointing at its format label, so it announces as "Photos, list, 24 items".
- **DOM ids:** only the format labels carry an id, `${useId()}-f${formatIndex}`, referenced by the list's `aria-labelledby`. The id is built from index numbers only, never from the bird's name or any other file text (`.claude/rules/ui.md`). React keys are the catalog ids, matching the gallery's own keys.
- **States:** there are no loading, error or empty states of its own. It needs no async input, so it appears with the section in the same render, and it is absent when no item has a valid catalog number. Embed state, the bot check, offline and "Show more" never change it.
- **Width and text size:** it wraps rather than overflows at every width from 320px up, at 100%, 150% and 200% in-app text, in Chromium and WebKit. That was measured on the mockup: 48 list configurations per engine (4 widths, 3 text sizes, 4 birds with media) with no text ink outside the section's content box, no link box outside the section, and no page scroll. A control with wrapping disabled overflowed by 1,827px, so the measurement is not vacuous. The smallest targets were 24px on desktop and 44px on phone at 100% text, growing with text size. A long bird name wraps in the lead. A bird with very many items (100 or more photos) simply wraps over more rows; there is no cap and no "show all" control (the user asked for every item).

## Motion Spec

- Number box, hover and keyboard focus: `background-color` transition, ease-out, 120ms, no transform (so no origin), reduced motion instant (`transition: none` under `prefers-reduced-motion: reduce`), CSS.
- Number underline on hover: instant, no transition, CSS.
- The list itself, on mount, on "Show more" and on any embed-state change: no motion. It is static content that appears with the section and never changes in place, CSS (nothing to implement).

## Content Notes

- Copy is literal and short. The lead is "{birdName} on Macaulay Library, newest first:". The format labels are "Photos", "Audio" and "Video". The links show bare ordinals.
- No visible counts beyond the ordinals; the "of {count}" lives in the accessible name only.
- No em dashes (U+2014) in any string, American spelling. The bird's name is user-file text, rendered as text (React escapes it) and never interpolated into a URL.
- **`docs/HELP.md`:** the Named Birds "Media of a named bird" paragraph gains one or two sentences, written without a stop per the standing rule. Suggested: "Above the gallery, a compact list links each of the bird's photos, recordings and videos to its own page on Macaulay Library, grouped by type and numbered newest first, including the ones behind Show more. It is there whatever the embedded players are doing." No Species Detail sentence, since Species Detail is unchanged.
- No `website/`, `README.md`, App Store listing or `PRIVACY_POLICY.md` copy is proposed. The privacy policy's "direct Macaulay Library links remain available and contact the site only when you choose to open one" stays true. The links go to `macaulaylibrary.org/asset/…`, the host the tiles already link to, so there is no new host, no CSP change and no HTTP-permit change.
