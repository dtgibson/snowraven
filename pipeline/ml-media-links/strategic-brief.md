# Strategic Brief: Macaulay Library links beside media galleries

Feature: `ml-media-links` (feature lane, Stage 1, written hands-off on 2026-10-08)

## What We're Building

Each media gallery in the app gets a short row of links: Photos, Audio, Video, one for each format the gallery actually holds. Each link opens Macaulay Library in the browser, filtered to the user's own media of that bird's species in that format. The row goes above the gallery in two places: each named bird's "Media of {name}" section on the Named Birds tab (the user's own example), and the Recent Media card on Species Detail.

## Why Now

Cornell's bot check (Anubis) is up in front of `macaulaylibrary.org`. No embedded player can pass it, so every gallery tile shows a placeholder that links to one item at a time. The other option, loading the user's media straight from Cornell's CDN, is on hold until the user learns whether that is allowed. It also runs against the standing v0.5.76 decision that this project works alongside Cornell's protection, not around it. Plain outbound links work today on every platform and need nobody's permission. They stay useful after the bot check lifts, because a gallery shows at most a handful of players and the full set lives on Macaulay Library.

## The User Problem

A birder opens the card for a bird they named, say `[name:Winky]`, an Anna's Hummingbird. They see a stack of placeholders, each with its own "Macaulay Library" link. To see Winky's photos together they have to open them one by one, or leave SnowRaven and rebuild the search by hand on Macaulay Library: species, format, their own contributor filter. The data to build that search is already in the app. One click should do it.

**What a link can and cannot reach.** Macaulay Library's catalog URL can filter by contributor (`userId`), species or form (`taxonCode`) and format (`mediaType`). The shipped links already use all three on Multimedia, Statistics and Species Detail's Media card. The catalog has no URL filter for the `[name:…]` comment tag that SnowRaven uses to pick out an individual. So the closest honest target for a named bird is **all of the user's own photos (or audio, or video) of that bird's species**. That set always contains every item in the bird's gallery, and usually more. The ML export identifies the user only through its filename (`ML__…_<userId>.csv`, read by `extractUserId` in `lib/mlCatalog.ts`), not through a column. The help center says the catalog's "More Filters" can search by eBird checklist or ML catalog number, but I could not confirm the URL parameter names. Cornell's bot check answers even plain requests to the catalog page, so it could not be read. Those filters also look like single-value fields that cannot hold a whole set.

## Success Criteria

- On Named Birds, open a bird whose gallery has photos and audio but no video. Above its gallery sit a Photos link and an Audio link, and no Video link. Each opens Macaulay Library filtered to the user's own media of that bird's species in that format, and every item in the bird's gallery appears among the results.
- On Species Detail, the Recent Media card has the same row for the formats it shows. Each link is byte-identical to the Media card's count link for that format, so it follows the Show subspecies toggle the same way and the two can never disagree.
- The links look and work the same in every embed state: players working, blocked by the bot check, turned off with Disable embedded media, or the device offline. When the bot check lifts they are still there.
- The link text and the accessible name say what the destination holds: the user's own photos (audio, video) of the species, on Macaulay Library, opening in a new tab. A named-bird link never reads as if it shows only that individual.
- A click opens the system browser in the Mac, Windows, iPhone and iPad apps and a new tab on web/Pi. Every link can be reached with Tab under WebKit's default tab mode.
- No link appears where it could not be filtered honestly. That means no contributor id in the export's filename, no taxon code that passes the shape gate, or an empty gallery. The per-item links on each tile stay exactly as they are.
- The feature adds no network activity: no third-party request, no new endpoint or host, and no request moved between components. A link is navigation the user starts, to `media.ebird.org`, which the app already links to.

## Scope

- **Named Birds tab:** a link row in each bird's media section (`components/NamedBirdMedia.tsx`), above the gallery and below the "Media of {name}" label. It is rendered only when the section is (row open, ML export loaded, at least one matched item).
- **Species Detail:** a link row at the top of the Recent Media card, above its grid.
- One link per format present in that gallery's own items: the named bird's matched assets, or the formats Recent Media is showing.
- **Named Birds plumbing:** the tab does not read the ML contributor id today, so it needs one. Read it with the existing `extractUserId`, not a new parser. The tab already resolves species taxon codes (`fetchTaxonCodes` / `codeFor`, exact name then normalized), so those are reused.
- **URL construction:** reuse the existing builder `mlCatalogLink` in `lib/mlCatalog.ts`, built on `ML_CATALOG_BASE`. Render through `OutboundLink`.
- **`docs/HELP.md`:** one or two sentences each in the Named Birds media paragraph and the Species Detail Recent Media bullet. Written without a stop, per the standing rule.
- **Tests:**
  - URL construction for each format.
  - Conditional rendering: formats present or absent, contributor id missing, taxon code missing or failing the shape gate, empty gallery, and every embed state.
  - Species Detail's link equals the Media card's link with the toggle on and off.
  - A runtime row that clicks a link through `frontend/src/test/tauriOpener.ts`, because the `newTabLinkDispatch` guard proves the dispatch is written, not that it fires.

## Out of Scope

- Loading, downloading or displaying media from Cornell's CDN (`cdn.download.ams.birds.cornell.edu`). That is the separate on-hold idea, and v0.5.76 rejected it on the record.
- Any replacement gallery: thumbnails, previews, a custom player.
- Any change to how embeds behave: the bot-check probe (`mlEmbedGate`), `MediaFrame` and its fallbacks, or the Disable embedded media setting.
- Filtering to just the named individual. Macaulay Library has no such URL filter.
- Narrowing a named-bird link by date window or region. `endYear` and `endMonth` are unverified, and the ML export carries a county name, not a region code (see flags).
- Multimedia, Statistics and Species Detail's Media card. Each already links its counts to the same filtered catalog view, so nothing changes there.
- Surfaces that list media items but are not galleries (Media Comments, Checklists' media filters, the Calendar's Media overlay) and Species Detail's media-less Named Individuals section.
- Counts on the new links. A named-bird count would promise a set the destination cannot deliver, and Species Detail's counts already sit on the Media card.
- Tidying the three existing contributor-id parsers (`extractUserId`, `parseMLUserId` in `LifeList.tsx`, the inline regex in `BirdingStats.tsx`) or the duplicate catalog URL builders. That is a separate cleanup. This build adds neither a fourth parser nor a fourth builder.
- `website/`, `README.md`, the App Store listing and `PRIVACY_POLICY.md`. No copy is proposed for any of them: links are operating detail, which the website and README register leaves out. The privacy policy already says "direct Macaulay Library links remain available and contact the site only when you choose to open one", which stays true.

## Key Decisions

1. **Destination.** `media.ebird.org/catalog?mediaType=<photo|audio|video>&taxonCode=<code>&userId=<id>`, built by `mlCatalogLink` on `ML_CATALOG_BASE`. This shape already ships in three places and was checked against the live catalog when those shipped. Do not add parameters that have not been checked, and never emit `?taxaName=` or the legacy `search.macaulaylibrary.org` host (`bird-names.md`).
2. **Named-bird links name the species, never the individual.** The Designer writes copy that is accurate about the superset, for example "your photos of Anna's Hummingbird on Macaulay Library", perhaps with one short line saying it includes all of the user's media of that species. No counts. No em dashes. American spelling.
3. **One link per format the gallery holds.** A link to a format the gallery does not hold would land entirely on media that is not "these".
4. **Independent of embed state.** The row does not read `embedAllowed`, the bot-check gate or the online status. It renders wherever the gallery section renders, and stays after the bot check lifts.
5. **Omit rather than mislead.** No contributor id means no row. The link must not fall back to everyone's media the way Multimedia's links do, because a gallery link promises "these", and everyone's media is not these. No taxon code that passes the shape gate also means no row, so there is never a bare link for a species (`bird-names.md`). An empty gallery means no row. The per-item links on each tile are untouched in every case.
6. **Species Detail reuses the Media card's exact link** (`mlCatalogLink(type, mediaLinkTaxonCode, userId)`), so it follows Show subspecies through the shared `resolveMediaLinkTaxonCode` and cannot drift from the counts above it.
7. **Named Birds uses the species code.** The tab has no subspecies toggle. Resolve the code from the bird's species with the tab's existing `codeFor` (exact name, then normalized), the same way Statistics links.
8. **Link plumbing.**
   - Render every link through `OutboundLink`, which owns the new-tab dispatch (`openNewTabLink`), the `Link` primitive and its `tabIndex={0}` default. No raw anchors and no `window.open`.
   - Shape-gate and `encodeURIComponent` every id in the URL: the contributor id by `extractUserId`'s pattern, the taxon code by the existing gate (`security.md`).
   - Key any DOM id on an index, never on bird or species text (`ui.md`).
9. **No network change, stated in the durable form.** No third-party request, no new endpoint or host, no request moved between components. The links are opener navigation, not page loads or fetches, so the Tauri content security policy and the HTTP permit do not change, and `tauriCsp.test.ts` and `tauriHttpScope.test.ts` should stay green without being touched.
10. **Copy approval boundaries.** In-app text and `docs/HELP.md` are written without a stop. No `website/`, `README.md`, App Store listing or privacy policy change is proposed. The App Store "What's New" line at ship is held for the user's express yes, as always.
11. **Ships to every platform** (Mac, Windows, iPhone and iPad, web/Pi) as a patch release with the usual four-file version set. The surface is visible, so the user gets a live look at the built app before the deploy gate.
12. **Rule-file gating.** If the build adds a file for the link row (for example a shared component), extend the `paths` of `.claude/rules/bird-names.md`, which owns the ML catalog-link rule, and `.claude/rules/media-embeds.md` in the same change, so the rules keep loading on the code they govern.
