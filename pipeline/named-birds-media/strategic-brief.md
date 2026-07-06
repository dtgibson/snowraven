# Strategic Brief — Named Birds Media

## What We're Building
On the Named Birds tab, below each individual bird's sightings map, show that
individual's own Macaulay Library media — its photos, audio, and video — with
each item labeled with the date it was captured and a link to the checklist it
came from. A named bird's media is identified by reading each media asset's OWN
comment (the caption / media notes the user wrote for that specific asset) and
matching the individual named there. Media is presented as Macaulay Library
inline embeds, loaded on demand only when a named bird is expanded.

## Why Now
The Named Birds tab already tells the story of a recognizable individual over
time — first seen, last seen, where it's turned up — but stops short of showing
the actual photos and recordings of that bird. Those live in the Macaulay
Library export the app already loads, and, crucially, the user identifies which
asset shows which individual in the asset's own comment. The app already has the
exact tool to read that: the `[name:…]` name-tag parser it uses to detect named
individuals from comments. So the missing piece — the individual's media,
gathered in one place — is within reach on data the app already holds, and it
deepens a tab the user already values.

## The User Problem
A birder who tracks a named individual can see its sightings and map here, but to
look at the media they captured of it they must leave the app and hunt through
the Macaulay Library by hand. Their photos, audio, and video of that one bird are
scattered across separate checklists and never gathered in one view. Critically,
neither the checklist comment nor the species comment tells you WHICH asset shows
the named bird — those may mention the individual, but they don't point at a
specific photo or recording. Only the media asset's own comment does. This
feature reads that per-asset comment to gather an individual's media right under
its map, each piece anchored to when and on which checklist it was captured.

## Success Criteria
- When a named bird is expanded on the Named Birds tab, its Macaulay Library
  media appears below the map — showing exactly the assets whose OWN comment
  names that individual (assets whose comment names no bird are correctly not
  shown).
- Each media item is clearly labeled with the date it was captured and a working
  link to the checklist it came from.
- Photos, audio, and video are all supported through the same inline-embed
  mechanism.
- Offline (or when an embed can't load), the tab degrades gracefully — a
  placeholder plus the existing Macaulay Library link-out, with the date and
  checklist still shown — never a broken/blank frame. (The matching itself, and
  the date/checklist labels, are computed offline from local data.)
- The page stays responsive even when an individual has many media assets: embeds
  load on demand and the tab does not stack many live players at once.
- The privacy disclosure is kept true — PRIVACY_POLICY.md names this new inline
  media surface on the Named Birds tab.

## Scope
- Named Birds tab only: media shown below each individual's existing sightings
  map, within the expanded row.
- Match media to a named bird by parsing the individual's name/tag out of each
  media asset's OWN comment in the ML export (its caption / media notes), reusing
  the existing named-bird name-parsing vocabulary; a named bird's media = the ML
  assets whose own comment references that individual.
- Photo, audio, and video, using the Macaulay Library inline-embed iframe
  (identical mechanism per type; the asset id and player size vary).
- Each item labeled with its capture date and a checklist link (both already on
  the matched ML export row — local/offline).
- Graceful offline / can't-load degradation (placeholder + ML link-out, metadata
  retained).
- On-demand / lazy loading so many assets don't stack many heavy live players.
- Update PRIVACY_POLICY.md (the embedded-media disclosure) to include the Named
  Birds tab.

## Out of Scope
- A new media-browsing tab or a redesign of the existing Multimedia tab — this
  lives inside Named Birds only.
- Downloading, hosting, caching, or re-serving media — SnowRaven only embeds what
  Macaulay Library serves; no media is stored on the user's device by this
  feature.
- Matching media by the checklist the asset came from, the checklist comment, or
  the species comment — explicitly rejected: those name the bird but do not
  identify a specific asset. Matching is by the media asset's own comment only.
- Any change to the named-individual detection vocabulary itself (the existing
  `[name:…]` parser is reused as-is against the media comments).
- Touching other tabs' media surfaces (Species Detail embeds, Multimedia,
  Statistics media links) — those are unchanged.
- A media viewer, lightbox, or editing UI, or filtering/sorting the media beyond
  showing items with their date + checklist (the Designer may propose a minimal
  browse affordance to satisfy the performance constraint; a full
  media-management UI is out of scope for v1).
- Any new provider or backend service — this reuses the existing Macaulay Library
  embed and locally-held ML export data only.

## Key Decisions
- **Match by the media asset's OWN comment — not the checklist or species
  comment.** A named bird's media is the set of ML assets whose own comment
  (the per-asset caption / media notes) names that individual. A checklist comment
  or a species comment may mention the bird, but it does not point at a specific
  media asset — only the asset's own comment does. Reuse the existing named-bird
  name-tag parser (`parseNameTags` / the `[name:…]` vocabulary in
  `lib/namedBirds.ts`) against those per-asset comment fields, and group matched
  assets by the individual named. Assets whose comment names no bird simply don't
  match — expected and fine.
- **Which comment fields.** The ML export carries per-asset free-text fields
  (`caption`, `mediaNotes`) that are the asset's own comment — use these. Do NOT
  use `observationDetails`: the ML export copies the eBird observation comment
  onto every media row from that observation, so it is not asset-specific (this is
  the same field the Multimedia tab already excludes for the same reason). The
  Architect should confirm the field selection against a real export.
- **Inline embeds, on demand.** Use the Macaulay Library inline-embed iframe
  (`macaulaylibrary.org/asset/<ASSET_ID>/embed`) — identical for
  photo/audio/video — and load embeds only when a named bird is expanded, so the
  tab's default state and its offline behavior stay light.
- **Fully offline matching.** The matching (parsing the local ML export's
  comments) and the date + checklist labels are computed entirely from
  already-loaded local data — no new network. The only network is the embed
  iframe itself when a media item is actually rendered.
- **Privacy trade-off, made consciously and disclosed.** This is the first inline
  third-party media fetch on the Named Birds tab (today the app only links out
  from here). It extends the already-disclosed Species Detail embed pattern to a
  second tab, it's user-requested, and it's opt-in-feeling (media loads only when
  you view a specific named bird). It stays within the founding privacy stance —
  device-to-provider, no SnowRaven server, no tracking — and MUST be reflected in
  PRIVACY_POLICY.md's embedded-media section this run.
- **Offline is a first-class state.** Only the embed player needs network; the
  matched items, their dates, and their checklist links are local. Offline must
  show the metadata + a link-out, not a broken frame.
- **Performance is a constraint, not an afterthought.** A named bird can have many
  matching assets and each embed is a heavy player; the design must lazy-load and
  must not mount many live players simultaneously. The Designer owns the browse
  UX that satisfies this.
- **Build risk for the Architect:** Tauri desktop (WKWebView/WebView2) must be
  permitted to load the external macaulaylibrary.org iframe; verify the app's
  CSP/capability config allows it (Species Detail's existing embed is the
  precedent to confirm against).
