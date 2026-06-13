# Design Spec — Checklists Tab

## Visual Direction
Quiet utility, strictly within the established SnowRaven system (brand.md + the `--sr-*` token palette): white section cards on the app background, Irish-clover accent used only for actions/links/active states, Inter at the house type scale. The tab reads as three calm stacked cards — two comment boxes and the list — with one tab-wide switch above them. Both themes supported via the existing tokens (including `--sr-quote-bg` from 0.5.26).

## Screens / Views

### Tab header + weather/tide switch
- House tab-header pattern (cf. NamedBirds): 30px accent-bg icon tile (clipboard-style icon), `h2` "Checklists" (1.125rem/700), one-line muted description.
- Right-aligned below the header: the house `ToggleSwitch`, label **"Show weather & tide blocks"**, default **off** (blocks hidden). It is the only tab-level control; it governs all three sections (FR-04–08).

### Section 1 — Checklist Comments (SectionCard)
- SectionHead: MessageSquare-style icon + "Checklist Comments" + muted sub "what you wrote about whole outings".
- Controls strip on `--sr-surface-faint` (matches Species Detail comments): Search-icon input ("Filter checklist comments…"), Newest/Oldest segmented toggle (accent-bordered, default Newest), right-aligned `aria-live` count "N comments".
- Rows (10 first, then "Show all N comments" expander): line 1 = date as accent eBird link (external-link glyph, `SUBMISSION_ID_RE`-gated) `·` truncating muted location; body = comment text 0.84375rem/1.55, `white-space: pre-line` behavior (line breaks preserved), safe linkified URLs.
- Block-only comments disappear entirely while the switch is off (FR-07).
- Empty states: "No checklist comments found." / "No checklist comments match this filter."

### Section 2 — Species Comments (SectionCard)
- Same anatomy as Section 1 ("Filter species comments…", sub "notes you wrote on individual sightings — all species").
- Each row's line 1 leads with the species via **BirdName conventions**: common name 0.84375rem/600 (hover accent+underline → opens Species Detail), italic scientific name 0.71875rem `--sr-text-gray`, 13px favicons; then date link `·` location.

### Section 3 — All Checklists (SectionCard)
- SectionHead: "All Checklists" + sub "every outing, filterable".
- **Filters strip** on `--sr-surface-faint`, three labeled rows (labels 0.71875rem/600 muted, 64px column):
  - **Contains:** `All` pill + divider + cycling pills for Checklist comment, Species comments, Media, Breeding codes, Weather block, Tide block.
  - **Media type / Effort:** cycling pills Photo, Audio, Video (with Camera/Mic/Video icons; hidden entirely when no ML export) + divider + Complete cycling pill + protocol `<select>` ("All protocols", display names from data).
  - **Where & when:** county `<select>`, from→to native date inputs, right-aligned `aria-live` count "N checklists" / "M of N checklists".
- **Cycling tri-state pill** (deliberate evolution of the Multimedia paired-pill idiom — logged in decisions.md): one pill per category, click cycles off → has → doesn't have → off. Off = neutral border/muted text; *has* = accent bg/border/text + check glyph, label "Has X"; *doesn't have* = the app's existing negative-pill tint + × glyph, label "No X". 30px tall, 15px radius, `aria-pressed` semantics per state; `All` pill active iff every cycling pill is off, click resets them (not county/date).
- House accent filter-strip banner with "Clear filter" appears when county/date active (same as Multimedia/Breeding Codes).
- **Rows** (10 first, "Show all N checklists" expander):
  - Line 1: date eBird-link `·` truncating location, then 20px accent-bg **badge tiles** (species-comments, photo, audio, video, breeding codes — `title`-attributed, only when present); right-aligned baseline cluster: "61 species" (accent/700) + "418 birds" (muted).
  - Line 2 (0.71875rem `--sr-text-gray`, `·`-separated, segments omitted when absent): time · protocol name · duration · distance · observers ("Solo" when 1) · county, state · Complete/Incomplete.
  - Checklist comment (when present and non-empty post-strip) in the house quote block: `--sr-quote-bg`, 1px `--sr-quote-border`, 3px accent-border left edge, radius 7, padding 8px 11px.
- Empty state when filters exclude everything: count shows "0 of N checklists" (house behavior).

## Component Usage
- `SectionCard`/`SectionHead` primitives (speciesDetail/ui) for all three cards.
- `ToggleSwitch` (components/ui) for the weather/tide switch.
- `BirdName` for every species name (Section 2), with batched taxon-code resolution.
- `MediaCommentsSection`-style box structure for both comment boxes (clone + pure lib helpers).
- Native `<select>` + paired `type="date"` inputs, exactly as Multimedia/Breeding Codes.
- Lucide icons: ClipboardList (tab/section), MessageSquare(s) (comments), Search, ChevronDown (expanders), ExternalLink (date links), Camera/Mic/Video (media), Egg (breeding), Check/X (pill states).

## Design Tokens Applied
All from `globals.css`, both themes: `--sr-bg/surface/surface-subtle/surface-faint`, `--sr-text/text-muted/text-disabled/text-gray`, `--sr-border/border-subtle/border-medium`, `--sr-accent/accent-strong/accent-bg/accent-border/on-accent`, `--sr-card-shadow`, `--sr-quote-bg/quote-border`. Negative pill state uses the same tokens/values as the Multimedia tab's "No photo" pills — no new tokens expected; if the negative tint isn't yet tokenized, tokenize it in both themes rather than hardcoding.

## Interaction Notes
- The switch re-derives everything live: strip via `stripWeatherTideBlocks()`, then search/filters/counts all operate on the post-strip text (FR-05–07). Search must match only visible text.
- Search: case-insensitive substring, per-keystroke (no debounce — house style), count + empty state update live.
- Expanders are one-way per house pattern; typing in a box's filter may reset its expansion (follow MediaCommentsSection).
- Sort toggles are per-section, independent.
- Date links `target="_blank" rel="noreferrer"`; invalid IDs render the date as plain text.
- Keyboard: every button `tabIndex={0}` (WKWebView), switch Space/Enter-operable, focus rings visible.
- Mobile (~≤640px): pill-row labels become full-width lines; row count clusters wrap below line 1; controls already wrap.

## Content Notes
- Sub-labels are lowercase, quiet, descriptive ("what you wrote about whole outings").
- Empty states are plain sentences, matching existing tabs' phrasing.
- Counts use real plurals ("1 comment" / "2 comments"; "1,284 checklists" with locale separators).
- No new copy registers: everything reads like the existing tabs.
