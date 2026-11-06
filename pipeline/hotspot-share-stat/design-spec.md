# Design Spec - Hotspot Share Stat

**Feature:** hotspot-share-stat
**Date:** 2026-11-06
**Stage:** 4 - The Designer (first direction approved at the first review; revised 2026-11-06 for `decisions.md` section 1: the hotspot answer is persisted per region after its first lookup, so the unresolved states belong to a region's first-ever lookup only)
**Source:** prd.md (amended FR-04, FR-06 to FR-08, FR-10 to FR-13, FR-22 to FR-30), schema.md (the view-state discriminator and copy module in sections 5.4 and 6 are binding; the two-phase build in section 10 is what the Interaction Notes describe), strategic-brief.md, pipeline/design-system.md
**Mockup:** `pipeline/hotspot-share-stat/design.html`

## Visual Direction

Quiet utility, designed within the established system: no new tokens, no new register. The block is one more sub-section inside the Geographic Stats card, drawn with the primitives the card already uses (`SubLabel`, `Divider`), the Statistics tab's own share-bar pair (the Complete-checklists fill and track), the Projects section's status-row register for the unresolved states, and the Projects no-key idiom with its inline `sr-proj-link` button. The settled state is the only place the block raises its voice: two percentage figures at 1rem/700 over the bar, the answer to the question the brief asked, readable at a glance and placed directly above the linked and plain location names it explains.

With persistence the settled state is also the one the user lives with: a region's answer is stored after its first lookup, so every later launch, online or offline, renders the share at once from the stored answer with no request. The status-row states are the first-ever lookup of a region (a fresh install, a cleared store, a region the export newly introduces, or an entry dropped by validation or eviction) and nothing else. Nothing in the layout, the colours or the caption changed at this revision; what changed is which state is the common one, and the copy that frames the rare ones.

## Screens / Views

### Statistics tab, Geographic Stats card: the "Checklists at hotspots" block

**Placement (FR-01).** Inside the Geographic Stats `SectionCard`, after the map block (the map, its rank-pin legend row and the county shading panel, which carry their own `marginBottom: 20`) and immediately before the `{geo.topLocations.length > 0 && ...}` fragment. Structure, top to bottom: `<SubLabel>Checklists at hotspots</SubLabel>`, the state's rendering, `<Divider />`. The divider is the section's standard one (1px `--sr-border-subtle`, `16px 0`). With `view.kind === 'hidden'` (zero checklists, FR-02) nothing renders: no sub-label, no divider, no empty-state box.

**Settled (FR-13 to FR-15, FR-19, FR-20).** Three stacked pieces, in reading order:

1. **Figures row** (`.sr-hs-figs`): a wrapping flex row, `justify-content: space-between`, `align-items: baseline`, `gap: 2px 16px`, `margin-bottom: 8px`. Two figures:
   - hotspot: `37%` then the label `at hotspots`, at the row's start;
   - personal: `63%` then `at personal locations`, at the row's end (`margin-left: auto`, `justify-content: flex-end`, `text-align: right`).
   Each figure is itself a wrapping inline flex (`gap: 0 6px`): the percentage at `1rem / 700 / letter-spacing -0.01em / line-height 1.1 / tabular-nums / --sr-text`, the label at `0.6875rem / --sr-text-muted`. The percentages sit over the segment they describe: hotspot over the leading edge of the bar, personal over the trailing edge. At 320px and 200% text the end figure drops to its own line and keeps its right edge; a label that cannot sit beside its figure drops under it with the same alignment (measured in Chromium and WebKit at 320px / 200%: nothing leaves the card's content box, `document.scrollWidth` unchanged).
2. **Bar** (`.sr-hs-bar`): `height: 20px`, `border-radius: 4px`, `overflow: hidden`, `display: flex`, `aria-hidden="true"`, **no text inside it**. Two segments: the hotspot segment in `var(--sr-chart-blue-dark)` with `width` = the unrounded `h / m * 100` percent and `min-width: 3px` when `h > 0` (so a share that rounds to "<1%" is still visible; `0` when `h === 0`), then the personal segment `flex: 1` in `var(--sr-surface-subtle)`. The bar's own background is `var(--sr-surface-subtle)`, so the none-at-hotspots case is a full track with no fill and the all-hotspot case a full fill, each a real rendering.
3. **Caption** (`.sr-hs-caption`): the counts sentence at `0.71875rem / --sr-text-muted / line-height 1.5 / margin-top 8px`: "1,234 of 3,300 checklists at hotspots, 2,066 at personal locations."

Accessible text of the block, in order: the sub-label, "37%", "at hotspots", "63%", "at personal locations", the counts sentence. That carries both percentages, both counts and the denominator (QA-28) with no text inside the `aria-hidden` bar (QA-29).

Key decisions:
- Percentages above the bar, not beside it, so each sits over its own segment and the row has somewhere to wrap at 320px / 200%; never inside a fill (the F032 pattern).
- The pair reuses the Complete-checklists fill and track (`--sr-chart-blue-dark` over `--sr-surface-subtle`) rather than minting a second colour for "personal": on this tab that pairing already reads as "the measured share against the rest", and the partition's meaning is carried by the two figures and the sentence, never by colour alone.
- 20px bar height: taller than the 8px `BarRow` rails (it is a single partition, not a row in a list) and shorter than the 32px Complete-checklists bar, which needs its height for the in-bar labels this block does not carry.
- The figures are the one focal point of the block; everything else stays in the caption and label registers.

**Pending, offline, unanswered, no-region (FR-10 to FR-12): the first-lookup states.** The Projects status-row register (`.sr-proj-status` shape): a flex row, `gap: 0.5rem`, `align-items: flex-start`, `overflow-wrap: break-word`; a 14px lucide glyph (`strokeWidth 2.2`, `aria-hidden`, `color: --sr-text-muted`, `margin-top: 0.1875rem`, `flex-shrink: 0`) beside a text column. First line: the state sentence at `0.8125rem / line-height 1.5 / --sr-text`. Second line, only when `h + p > 0`: the counts-so-far sentence at `0.75rem / --sr-text-muted / margin-top 2px`. No bar, no percentage, no live region (PRD open question 2, default kept). Glyphs follow the Projects vocabulary:

| kind | glyph |
|---|---|
| `pending` | `Loader2` with the app's `.spin` class |
| `offline` | `WifiOff` |
| `unanswered` | `AlertCircle` (muted tone, not `--sr-error`: a region that did not answer is a fact about eBird, not a failure of the user's) |
| `no-region` | `Circle` with `strokeDasharray="3 3"` (the Projects "not asked" mark) |

Each of the three network states is reachable only while some region has never answered (FR-04, FR-07): a region with a stored entry, fresh or past the TTL, is answered from the build's first read of the document, and a refresh that is in flight, fails or is rate-limited never leaves that state. The mockup's state toolbar names them for what they now are: **First lookup**, **First lookup, partial**, **Offline, no answer yet**, **Offline, after an answer**, **First lookup failed**, plus **Later launch, offline** (the settled rendering, from the document, zero requests). The offline state has two renderings, distinguished by what the document holds, not by connectivity (FR-11):

- **Offline before any answer** (a fresh install or a cleared store with no signal): every checklist with an askable region is unclassified, so the row is the `WifiOff` glyph and the one sentence, with no counts-so-far line.
- **Offline after an answer**: every region with a stored entry is classified and only a never-answered region's checklists are unclassified; the counts-so-far line renders beneath. When every region holds an entry there is no offline state at all: the settled stack renders in full, with no offline sentence and no staleness marker (QA-37).

The same shape applies to `unanswered`: `k` counts only regions that have never answered; a region whose stored answer merely failed to refresh is answered and is not named.

**No key (FR-09, FR-21).** The same status row with the `KeyRound` glyph, the sentence "Checklists at hotspots cannot be counted without an eBird API key." followed by a space and the native `Button` with `className="sr-proj-link"` reading "Add a key in Settings", `onClick={onGoToSettings}`. The `sr-proj-link` register is reused exactly (inline, underlined, `--sr-accent`, 2px focus outline); schema section 10's alternative (the section's quiet button register) is not taken, because the Projects idiom is the one the PRD names and it sits a few hundred pixels below on the same tab.

**Hidden (FR-02).** Nothing renders.

## Component Usage

- `SubLabel`, `Divider` from `components/statsPrimitives.tsx`: as-is.
- `Button` from `components/ui/Button.tsx` for the no-key control (the only interactive element the block adds; one Tab stop, inherited `tabIndex={0}`).
- Lucide icons: `Loader2`, `WifiOff`, `AlertCircle`, `Circle`, `KeyRound` at 14px, the Projects section's sizes and stroke.
- CSS: new `.sr-hs-*` rules in `globals.css` (the figures row, the figure, the bar and its two segments, the caption, the status row and its lines). Layout lives in classes, never inline; the only inline styles are the hotspot segment's `width` and `minWidth`, both always present and varying by value only (the v1.0.35 rule).
- No new DOM id, no ARIA IDREF (NFR-07).

## Design Tokens Applied

All already defined in both themes; no new tokens (NFR-05):

- Text: `--sr-text` (percentages, state sentence), `--sr-text-muted` (sub-label, figure labels, caption, counts-so-far line, glyphs).
- Bar: `--sr-chart-blue-dark` (hotspot segment), `--sr-surface-subtle` (personal segment and the track).
- Divider: `--sr-border-subtle`.
- No-key control: `--sr-accent` text and focus outline (the `sr-proj-link` register).

Contrast on the card surface (`--sr-surface`), both themes: `--sr-text` and `--sr-text-muted` are the tab's own AA pairs (muted 4.80:1 light on surface-subtle, higher on surface). The bar carries no text, so it owes no on-fill pair.

## Interaction Notes

- The block is static apart from the no-key button (navigates to Settings through the tab's existing `onGoToSettings`).
- State transitions happen without user action, through the hotspot-set lifecycle (FR-07, FR-08, schema section 10). Two lives, by whether the region has answered before:
  - **A region's first lookup** (fresh install, cleared store, a region the export newly introduces, a dropped or evicted entry): first render in `pending`, then `settled` (or `offline` / `unanswered` / `no-region`) when the first ask settles, and again after each re-ask round that answers a region. The height changes between the status row and the settled stack; that is expected and is what the entrance motion explains.
  - **Every later launch, online or offline:** first render in `pending` for the duration of the local document read only (no request), then `settled` from the stored answer. The block is in its settled state before any network activity, and a TTL refresh that lands later re-renders it in place with the new counts (FR-25, QA-43) while a refresh that fails or is rate-limited changes nothing the user sees.
- **What renders during the local read (PRD open question 9, schema section 13):** the FR-10 pending sentence, the default. The block does not hold its previous content across an invalidation (a key save, a file save, an iCloud arrival): on a warm rebuild the read is a mirror hit a few microtasks away, so the pending row is at most one frame, and the settled stack's 160ms entrance is the explanation of the change. Holding stale content through a rebuild would also show a bar for one export over another's region list for that frame. The Engineer adds no hold.
- A clear (Settings' delete, both iCloud clear paths) purges the stored document (FR-26); the next backup starts every region at its first lookup again and renders the first-lookup states as above. Replacing the backup, saving a key and an iCloud arrival do not purge, so they re-enter `settled` from the document for every region already answered and run the first lookup only for a region the new backup introduces (FR-24, QA-38).
- No age, "last checked" or staleness marker anywhere in the block, in the settled state included, and no refresh control (PRD open questions 4 and 7, Out of Scope); the links beside the bar carry the same lag and have never shown one.
- "Count all forms" never changes the block (FR-03); the memo inputs exclude it (schema 5.5).
- Hover: none on the block itself; the no-key link shows the pointer and its underline is always present.
- Focus: the no-key button takes the `sr-proj-link` 2px `--sr-accent` outline at 2px offset (the register's own override of the global ring).

## Motion Spec

- Settled stack and status row, on every state change: opacity 0 to 1 and `translateY(0.1875rem)` to 0, `cubic-bezier(0.16, 1, 0.3, 1)`, 160ms, origin in place (the Projects `sr-proj-msg-in` entrance), reduced-motion: none, CSS keyframes.
- Hotspot segment, when a settled state lands: `transform: scaleX(0)` to `scaleX(1)`, `transform-origin: left center`, `cubic-bezier(0.2, 0, 0, 1)`, 240ms (the share-breakdown mount animation; replays only when the settled content remounts, i.e. when the data changed; on a later launch it plays once, as the stored answer lands after the local read; a TTL refresh that changes the counts remounts the stack and replays it, and a refresh that returns the identical list announces nothing and moves nothing), reduced-motion: none, CSS keyframes.
- Pending glyph: the app's existing `.spin` (0.7s linear, continuous), reduced-motion: none (the global block), CSS.
- No-key link hover / focus: no transition (the register has none); the outline appears instantly.
- Nothing animates on a plain re-render with unchanged state; a static block never moves.

## Content Notes

Every string lives in `lib/hotspotShareCopy.ts` and is generated from `HotspotShareView` (schema section 6) so the plural-agreement and em-dash sweeps cover the whole reachable corpus. Counts through `fmt`; no em dash; American spelling. The wording below is the PRD default with one refinement:

- Sub-label: `Checklists at hotspots`
- No key: `Checklists at hotspots cannot be counted without an eBird API key.` + control `Add a key in Settings`
- Pending: `Checking which locations are public hotspots. {u} of {m} checklists not yet classified.`
- Offline: `Offline, so {u} of {m} checklists could not be classified yet.`
- Unanswered: `eBird did not answer for {k} of your {r} regions, so {u} of {m} checklists could not be classified.`
- No region: `{u} of {m} checklists carry no region code and could not be classified.` (`carries` when `u === 1`)
- Counts so far (second line of the four states above, only when `h + p > 0`): `So far {h} at hotspots and {p} at personal locations.` Offline before any answer (FR-11's first case) therefore renders the offline sentence alone, with `u = m` less any no-region-code rows.
- Settled figures: `{pct.hotspot}` + `at hotspots`; `{pct.personal}` + `at personal locations` (percentages from `sharePctPair`, schema 5.3)
- Settled caption: `{h} of {m} checklists at hotspots, {p} at personal locations.`

**Unchanged by the persistence revision, on purpose.** The four status sentences do not say "first lookup", "stored" or "cached": the user sees a pending sentence only on a region's first lookup now, and a sentence that explained the mechanism would be longer and no clearer in the one moment it shows. The word "yet" in the pending and offline sentences carries the promise that the state resolves. The first-lookup framing lives in the mockup's toolbar labels and captions (the reviewer's vocabulary, not the user's) and in this spec. No string names an age or a staleness (PRD open question 7), and the settled caption is identical whether the answer came from the network this session or from the stored document.

**The one refinement (PRD open question 3):** the settled caption names its noun, "1,234 of 3,300 **checklists** at hotspots", where FR-13's default read "1,234 of 3,300 at hotspots". Beneath a figures row that already says "37% at hotspots", the bare form left "of 3,300" without a subject; with the noun the sentence stands on its own for a screen reader. Plural agreement: `{m} checklist` when `m === 1` ("1 of 1 checklist at hotspots, 0 at personal locations."). QA-20 to QA-22's expected strings and the copy-corpus rows move with it; the Help sentence (FR-18) is unchanged.

**Copy module shape for `settled`:** the component needs the two figure pairs as separate strings (they are separate DOM nodes above the bar) plus the caption, so `hotspotShareSentences('settled')` returns, in reading order, `['37% at hotspots', '63% at personal locations', '1,234 of 3,300 checklists at hotspots, 2,066 at personal locations.']`, and the component splits each figure string at its first space for the percentage span. That keeps every rendered string inside the sweep's corpus (QA-25, QA-26) and QA-28's accessible-text assertion reads the block, not one sentence.

Help (`docs/HELP.md`, Geographic Stats paragraph, FR-18 default, unchanged): "A share bar above the top-location lists shows how many of your checklists were submitted at public eBird hotspots versus personal locations; it needs your eBird API key, because the export itself does not say which locations are hotspots."

## Verification the mockup already carries

Rendered in Chromium and WebKit from `design.html` at 900px, 640px, 390px and 320px, at 100%, 150% and 200% in-app text scale, in both themes, for every state the PRD named at the first review: the block's widest descendant never passes the card's content box and the document scroll width equals the viewport in every case. The two states added at the persistence revision (offline before any answer; later launch, offline) reuse those exact renderings with no new geometry: the first is the status row with one line and no second, the second is the settled stack. The built app is still re-measured at the live look (CLAUDE.md), because a mockup's container is not the real container (v1.0.50).
