# Design Refinement — website-readme-copy-pass (features section)

Improve-lane design pass, Stage 2. **Revised after the user's review of the first
mockup:** Search and Settings are dropped, as more functional than a unique birding
feature. The features section is **ten sections, the ten tabs, in `DEFAULT_TAB_ORDER`**.

The surface is the features section of `website/index.html`; the README's feature list
takes the same inventory (see *The README*). **The words are not the deliverable here** —
every paragraph in `design.html` is a stand-in. This document settles the shape the copy
is written into: which sections exist, what each is called, their order, their `reverse`
state, their figure, and the class names each uses.

Companion mockup: `pipeline/website-readme-copy-pass/design.html`.

---

## Visual Direction

Unchanged. The page's own token system, type scale, band treatment, card shadow, hero
and footer all stay exactly as shipped; no Tailwind, no shadcn, no Lucide runtime, no
new dependency, no new token, no new color. The refinement is entirely structural: a
reader meets one section per tab, in the order the app's own navigation presents them,
with the two-column alternation and the hairline rhythm sequencing cleanly for the first
time.

**The stylesheet delta is now pure deletion.** The first draft added a
`.feature-row.solo` modifier for a figure-less Settings row; with Settings gone that rule
has no user and is withdrawn. Nothing is added to `website/styles.css`. One dead block is
removed (below).

---

## Screens / Views

### The features section: final inventory and order

Ten sections, the ten tabs, **in `DEFAULT_TAB_ORDER`** from
`frontend/src/lib/tabLayout.ts`, named from `TAB_LABELS`.

| # | `<h3>` | `reverse` | Figure | Figure markup |
|---|---|---|---|---|
| 1 | `Weather` | no | `weather.webp` | `<figure class="feature-media shot-slot" data-shot="weather">` |
| 2 | `Statistics` | **yes** | `statistics-dark.webp` | `<figure class="feature-media shot-slot" data-shot="statistics-dark">` |
| 3 | `Map Explorer` | no | `map.webp` + `map-dark.webp` | `<figure class="feature-media shot-slot shot-swap" data-shot="map">` |
| 4 | `Species Detail` | **yes** | `species.webp` | `<figure class="feature-media shot-slot" data-shot="species">` |
| 5 | `Calendar` | no | `calendar.webp` | `<figure class="feature-media shot-slot" data-shot="calendar">` |
| 6 | `Multimedia` | **yes** | `multimedia.webp` | `<figure class="feature-media shot-slot" data-shot="multimedia">` |
| 7 | `Breeding Codes` | no | `breeding.webp` | `<figure class="feature-media shot-slot" data-shot="breeding">` |
| 8 | `Checklists` | **yes** | `.ck` mock | `<figure class="feature-media feature-mock" aria-hidden="true">` |
| 9 | `List Comparer` | no | `.cmp` mock | `<figure class="feature-media feature-mock" aria-hidden="true">` |
| 10 | `Named Birds` | **yes** | `named-birds.webp` | `<figure class="feature-media shot-slot" data-shot="named-birds">` |

Three articles are **deleted whole**, each with its figure: `Offline support`,
`Search anything by name`, and the Settings section that was proposed in the first
mockup and never shipped.

### Why this order

- It is **derived, not chosen.** `DEFAULT_TAB_ORDER` is `weather, birding-stats,
  map-explorer, species-detail, calendar, life-list, breeding-codes, checklists,
  comparer, named-birds`; `TAB_LABELS` names each one. A reader who installs the app
  meets the destinations in exactly the order the page introduced them. Nothing about
  the sequence has to be argued, and it cannot decay into an append log, because
  appending is no longer where a new section goes: a new tab takes its place in the
  code's order.
- It reads as a tour. The three heaviest surfaces open (the lookup tool, the analytics
  dashboard, the map); the narrower tools follow.
- **The order is editorial and carries no published claim about the app's navigation.**
  It owes no guard. If `DEFAULT_TAB_ORDER` changes again (it changed at v1.0.19),
  re-sequencing the page is a follow-up, not a correctness bug. Record where the order
  came from in the section's own HTML comment so the next person knows.
- Dropping Search and Settings makes the rule exact rather than nearly exact: the
  features section is now **the ten tabs and nothing else**, so what belongs there is
  decided by `TAB_LABELS` rather than by judgment.

### The section head

`.section-head` keeps all three of its elements: `.eyebrow` ("What's inside"), the
`<h2>`, and `.section-sub`. No structural change. Two constraints on its words:

- **No count.** The shipped `<h2>` says "Ten tools" over twelve articles (v1.0.16:
  publish the property, never the count). It would now be *accidentally* true over ten,
  which is the worst version of a count: correct today, stale on the next tab, and
  nothing goes red. State the property.
- **The section head must not contain the string `Weather/tide Planner`.**
  `weatherTidePlanPublishedClaims` locates the website's Planner passage by the **first**
  occurrence of that string in the whole file. It occurs exactly once today; keep it at
  one, in row 1's second paragraph.

### Alternation and dividers

Sequenced deliberately for the first time. **Odd rows carry no `reverse` (media right);
even rows carry `reverse` (media left).** Ten two-column rows, five each way.

Row 1 stays media-right, as it ships, so the first row does not visibly move and the
rule is a trivially checkable parity. The two shipped breaks (Calendar and Map Explorer
both `reverse`; List Comparer and Search both not) disappear as a consequence of the
parity rather than by being patched.

Dividers need no markup: `.feature-row + .feature-row { border-top: 1px solid
var(--border); }` gives nine hairlines across ten rows automatically. Nothing is added
and nothing is exempted. Every row is now two columns, so there is no exception to the
rhythm anywhere in the section.

The alternation is a **wide-tier rhythm only**: the existing `@media (max-width: 920px)`
block collapses every row to one column and resets `order`, so below 920px every row is
text-then-figure regardless of `reverse`.

### Figure inventory: what is freed, and what becomes unused

Ten figures for ten sections. **Every section has a figure. No section is figure-less,
and no figure is orphaned.** Eight screenshot slots and the two mocks that belong to the
two tabs with no screenshot.

Two figures are freed, and **neither is a file**:

- The `Offline support` no-signal mock — hand-built HTML in `index.html`. Retired
  outright, as recommended: under `DECISIONS.md` v1.0.20 a published mock is a
  behavioural claim, and that mock's content **is** the offline claim drawn as a picture.
- The Search results mock — hand-built HTML in `index.html`. Retired with its article.
  Worth noting what is being discarded: its rows are the **v1.0.20 re-derived** output of
  the real `buildPaletteRows`, the repair for a figure that had shown rows the shipped
  filter could not produce. It is correct, and it is going anyway because its section is.

**No screenshot is freed, and nothing in `website/assets/` becomes unused.** Verified
file by file: all eleven `.webp` in `website/assets/shots/` are still referenced by
`index.html` after the change — the eight feature shots, plus `statistics.webp` (hero
image and `og:image`) and `statistics-mobile.webp` (Platforms). There is nothing to
delete and nothing to keep back for later.

**One thing does become unused, and it is CSS.** `.named`, `.named-row`, `.named-tag`,
`.named-sp` and `.named-seen` (`styles.css:266-272`) were used by exactly two figures,
the Search mock and the offline mock. With both gone the block is dead. **Delete it.**
This also disposes of a stale label the first draft asked to correct: the block is
commented `/* Named Birds mock */`, which has been false since Named Birds got a
screenshot, and the comment goes with the block.

`.ck-search` and `.ck-count` are **not** dead: the Checklists mock (row 8) uses both, and
keeps them.

Kept verbatim, per figure: the `src`, `width`, `height`, `loading="lazy"`, the `alt`
text, and the `data-shot` value. The shots have not changed, so their descriptions have
not changed, and alt text is **not** part of the copy rewrite. `map-dark.webp` keeps
`alt=""` because the light image carries the description.

`.feature-media[data-shot="weather"] { max-width: 420px; margin-inline: auto; }` and its
360px counterpart at ≤920px stay; row 1 still holds the tall 1080x2021 shot.

`.shot-swap` stays on row 3 only. `.feature-tag` ("Light or dark, your choice. Dark mode
shown.") stays on row 2 and is the page's only `.feature-tag`: it is load-bearing there
because `statistics-dark.webp` is a fixed dark image on a page a light-theme reader may
be viewing, where row 3's `shot-swap` follows the theme and needs no caption.

Resulting rhythm, rows 1 to 10: `shot shot shot shot shot shot shot mock mock shot`. The
two adjacent mocks at 8 and 9 are the two tabs with no screenshot, they are adjacent in
the app's own order, they are a coherent pair, and they carry opposite `reverse` states
and structurally different internals. Accepted as-is; the section now ends on a
photograph rather than on four mocks in a row.

### Which section a paragraph belongs to

The organizing rule is **a paragraph lives in the section for the surface it describes.**
One shipped paragraph violates it, and moving it is the only content relocation inside
the features section:

- **The Species Detail Weather card paragraph moves from the Statistics article (row 2)
  to the Species Detail article (row 4).** It is `website/index.html:261-273`, anchored
  by the string `card on Species Detail shows the skies`. Today it sits under the
  Statistics `<h3>`, which is exactly the append-log shape this pass exists to fix.
  `weatherStatsPublishedClaims` extracts it by a file-wide `indexOf`, so the move is
  green — **but see the flag**: the guard's comment at ~line 396 justifies exempting the
  website from the both-apps attribution assertion on the grounds that "the website
  paragraph leans on the section paragraph directly above it for the attribution", and
  after the move nothing is directly above it. That exemption must be re-argued in the
  same change.

Two paragraphs are deliberately **not** moved, and the reason is recorded so it is not
re-litigated: row 3's "Three more maps also fill the window" and "Any birding map also
shares a spot" describe behaviour that belongs to maps rather than to one tab. Map
Explorer is the section where a reader meets maps, so they stay there, framed as
properties of any map in the app. The alternative — a cross-cutting eleventh section —
is refused twice over: it is not one of the ten tabs, and cross-cutting sections are what
the user has just removed.

### "What you'll need" does not move, and the iCloud paragraph does not come back

The `.requirements` aside stays in the Install section, inside `.install-grid`, sticky at
`top: 84px`. It answers "what do I need before I install", which a reader asks beside the
install steps. **It is also where Settings' practical content stays published:** the two
free API keys and where to get them, the eBird backup and the optional Macaulay export.
Dropping the Settings section costs the page nothing, because the page never had one.

The first draft moved the aside's iCloud Sync paragraph (`website/index.html:659-663`)
into a Settings section to kill the duplication the slop inventory logs as item 5. With
no Settings section, the decision is: **the paragraph is dropped as duplication, and the
privacy band gains the one property it does not already carry.**

- The band already states the posture, including iCloud: no account, no analytics, no
  telemetry, no server; the files and keys never leave the device unless you turn on the
  optional iCloud Sync, which copies the two files, "and your API keys only with its
  separate Sync API keys switch, into your own iCloud account and nowhere else."
- The aside's paragraph adds only **mechanism** on top of that ("so an export uploaded
  once is used everywhere", "so a key entered once is used on every device that turns it
  on"), which is exactly what must not come back in through this door.
- **One property in it is not in the band and must survive: both switches are off unless
  you turn them on.** The band says "optional" of the sync switch and says nothing about
  the keys switch, while it already calls the embedded-media setting "off-by-default".
  Add the same plain property to the band's existing sentence. That is a property, not a
  mechanism, and it is privacy-material.
- **"Settings and caches are never synced" is confirmed published elsewhere and may be
  cut here.** `website/privacy.html:170` carries it in full: "Your app settings, map
  preferences and cached lookups stay on each device and are never synced." Checked, per
  the brief's per-cut rule, rather than assumed.

Net result, and the boundary to hold: the **band** carries the posture and the link, the
**policy** carries the detail, and the **aside** carries only what you must obtain before
you install.

Everything else outside the features section — hero, Platforms, Install steps, closing
CTA, footer, the version pill and the footer version line — keeps its role and its
markup.

---

## The README

The README's feature list takes **the same inventory and the same order**: the ten tabs,
`DEFAULT_TAB_ORDER`, `TAB_LABELS` names, no Search section, no Settings section, no
Offline section. A reader moving between the two surfaces should meet the same ten things
in the same sequence. The README has no figures and no alternation, so nothing else in
this document applies to it; its markup is The Engineer's.

It currently carries **eighteen** top-level feature bullets (`README.md:11-28`). Under
the ten-tab inventory:

**Three fold into the tab that owns them**, mirroring the website exactly:

| Today | Folds into |
|---|---|
| `- **Weather on the bird's own page**` (line 13) | Species Detail |
| `- **Weather, read back**` (line 15) | Statistics |
| `- **Maps that get out of the box**` (line 21) | Map Explorer |

**Five are dropped**, each confirmed published elsewhere:

| Today | Confirmed at |
|---|---|
| `- **Search anything by name**` (24) | `docs/HELP.md:22` `## Search`, which is richer than the bullet: both key combinations, the visible control at all three nav densities, destinations then species, the arrow keys, Enter, Escape, focus return and its fallback, the three backup states, and the 640px full-screen behaviour |
| `- **Navigation that fits the window**` (25) | **partially** — see the flag |
| `- **Settings**` (26) | `docs/HELP.md:639` `## Settings` with `### iCloud Sync` and `### Appearance`; the two keys stay in the README's own keys list at lines 42-43 |
| `- **Offline**` (27) | `docs/HELP.md:721` `## Using SnowRaven offline` |
| `- **Desktop window**` (28) | `docs/HELP.md:18`, in more detail than the bullet (the off-screen recovery, the straddled-window case, the per-machine scope) |

`- **Weather & Tide Lookup**` (11) becomes `- **Weather**`, the `TAB_LABELS` name.

Two consequences The Engineer owns. The fold-in retires README guard anchors (below).
And **README bullets are single-line extractions** (slop inventory, trap 2:
`startsWith('- **…**')` returns one physical line), so folding three bullets into three
tab bullets makes three very long lines. Whether the README moves from a bullet-per-tab
to a heading-per-tab form is a markup decision with guard implications; it is named here,
not decided.

---

## Guard anchors this design retires

Recorded, not solved: the guard-edit set is re-derived by measurement at the build stage,
per the brief and the slop inventory's Pass 3 appendix. Each of these is a **deliberate
guard edit, user-approved at the gate, never a rider**.

| Anchor | Guard | Why it goes |
|---|---|---|
| `<h3>Search anything by name</h3>` | `palettePublishedClaims` | the website's Search section is dropped |
| `- **Search anything by name**` | `palettePublishedClaims` | the README's Search bullet is dropped |
| `- **Weather, read back**` | `weatherStatsPublishedClaims` | folds into the Statistics bullet |
| `- **Weather on the bird's own page**` | `weatherStatsPublishedClaims` | folds into the Species Detail bullet |
| `- **Weather & Tide Lookup**` | `weatherTidePlanPublishedClaims` | renamed to `- **Weather**` |
| the aside's `A second switch, also off by default…` sentence | `icloudKeysPublishedClaims:164` | the duplicated iCloud paragraph is dropped |

The repair is the two-tier retarget the brief already authorizes: `docs/HELP.md` keeps
its byte-exact tier unweakened, and the README and website rows retarget to HELP alone,
claim-level.

**One distinction to state precisely in the guard edit, so it is not later read as
loosening.** For Search, the website and README rows are not *weakened* — those two
surfaces no longer make the claim at all, by user decision, so they leave
`palettePublishedClaims`'s roster. That is different from deleting an existence leg while
the surface still carries a passage, which stays forbidden. HELP's existence leg and
byte-exact assertions are untouched.

Worth considering, and genuinely optional: `.claude/rules/docs-and-website.md` requires
every feature change to update `README.md` and `website/` in the same change, which is
the exact mechanism this pass exists to undo. A **negative** leg on those two files —
that neither carries a Search or Offline section heading — would stop the append-log
re-forming one build later. Offered, not specified.

---

## Nothing is lost that a reader could only learn here

Checked per cut, against the file rather than from memory:

- **Search**: every claim the two surfaces made is in `docs/HELP.md` `## Search`, in
  more detail. Nothing moves.
- **Settings**: the two API keys stay on both surfaces, in the website's "What you'll
  need" aside and the README's keys list, neither of which moves. Appearance, text size,
  sharing, tab layout and the iCloud switches are in HELP `## Settings`. The website
  never had a Settings section, so nothing published is lost by not adding one.
- **Offline**: HELP `## Using SnowRaven offline`, and `icloudKeysPublishedClaims` already
  asserts that section against HELP, which is why the offline fact survives the copy
  decision.
- **iCloud mechanism and "settings and caches are never synced"**: `website/privacy.html`
  under `iCloud Sync`, line 170.
- **Desktop window**: HELP line 18.
- **The nav densities**: the one genuine residual. See the flag.

---

## Component Usage

No component library. This page is hand-authored HTML and CSS and stays that way. Every
class used already exists in `website/styles.css`, and none is added:

- `.features` > `.container` > `.section-head` (`.eyebrow`, `<h2>`, `.section-sub`)
- `.feature-row` and `.feature-row.reverse`
- `.feature-text` > `.feature-icon` (inline SVG) + `<h3>` + `<p>`… + optional `.feature-tag`
- `.feature-media` with either `.shot-slot` (+ optional `.shot-swap`) or `.feature-mock`
- mock internals, unchanged: `.ck` / `.ck-search` / `.ck-row` / `.ck-date` / `.ck-text` /
  `.ck-count`; `.cmp` / `.cmp-head` / `.cmp-row` / `.cmp-name` / `.cmp-a` / `.cmp-b` /
  `.win` / `.only`

### Icons

Each retained section keeps its existing hand-drawn `.feature-icon` SVG verbatim
(24x24 viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, round cap
and join). The retired rows' glyphs (the offline wifi-off, the Search magnifier) go with
them. **No new glyph is needed** — the Settings cog the first draft introduced is
withdrawn with its section.

### Markup constraints that three guards depend on

- **Every body `<p>` in a feature row opens as a bare `<p>`, with no attributes.**
  `weatherTidePlanPublishedClaims`, and both extractions in
  `weatherStatsPublishedClaims`, locate a passage with `src.lastIndexOf('<p>', i)`. A
  `<p class="…">` would make the search skip back to an earlier bare `<p>` and silently
  widen the extracted passage. The only classed paragraph in the section is
  `.feature-tag`, and it stays last in its row.
  **`design.html` deliberately breaks this rule and must not be copied on it:** every
  stand-in there is `<p class="stand-in">` so it can be set in italics. Take the
  structure from the mockup and the paragraph markup from this line.
- **`<h3>Named Birds</h3>` stays byte-exact, with no attributes.**
  `namedBirdTimelinePublishedClaims` does `indexOf('<h3>Named Birds</h3>')`. It already
  matches `TAB_LABELS`; it costs nothing.
- **The two remaining mocks' internals are not touched.** Rows 8 and 9 are existing
  published figures with no mandate to re-derive; the en dashes in row 9's two
  placeholder cells are sanctioned by `.claude/rules/docs-and-website.md` and stay.
- **`<article class="feature-row">` per section, in document order.** No wrappers, no
  nesting: the `+` sibling selector draws the dividers and `app.js` observes each article
  for its entrance (`.feature-row, .privacy-points li, .install-card, .section-head`).

---

## Design Tokens Applied

Nothing new. The section reads from `website/styles.css`'s existing `:root` /
`[data-theme="dark"]` pairs only:

- `--border` — the `.feature-row + .feature-row` hairline and every `.feature-media` edge
- `--surface` — figure grounds; `--surface-subtle` — mock zebra rows and `.ck-search` fills
- `--text` — headings and mock names; `--text-muted` — body paragraphs and mock values
- `--accent-bg`, `--accent-strong`, `rgba(var(--accent-rgb), .2)` — the `.feature-icon`
  tile, `.feature-tag`, `.ck-date`, `.cmp .win`
- `--card-shadow` — `.feature-media`; `--radius` / `--radius-sm` — figure and row radii
- `--ring` — the global `:focus-visible` outline

No hex, no `rgb()` and no color literal is introduced anywhere in the section.

---

## Interaction Notes

The features section has no interactive controls, before or after this refinement. The
only behaviours to preserve:

- **Theme swap.** Row 3 keeps `.shot-swap` so the map image follows the site theme
  (`.for-light` / `.for-dark`). Row 2 does not swap and keeps `.feature-tag` to say so.
- **Scroll-reveal membership.** Every `<article>` keeps the `feature-row` class, so
  `app.js`'s observer picks it up. No JS change is required by this design, and none
  should be made.
- **Accessibility tree.** Each mock `<figure>` keeps `aria-hidden="true"`; the
  screenshots keep their descriptive `alt`. One `<h2>` with ten `<h3>` under it, all
  peers.
- **Responsive.** At ≤920px every row is one column, text first. Nothing in the section
  sets a positive `min-width`, so the page cannot scroll sideways at 320px.

---

## Motion Spec

**This page's motion is CSS-only and stays CSS-only.** No library, no keyframe, no
scroll-driven animation, and **no new transition** is added by this refinement. `app.js`'s
`IntersectionObserver` only toggles one class; every duration and easing lives in
`website/styles.css`. With the `.feature-row.solo` rule withdrawn there is now no new CSS
of any kind, so there is nothing here that could introduce motion even by accident.

| Element / interaction | Easing | Duration | Origin | Reduced motion | Implemented by |
|---|---|---|---|---|---|
| Feature row entrance (`.reveal` → `.reveal.in`) | `ease` | 600ms (opacity + transform) | from `translateY(16px)`, rising into place | `app.js` never adds `.reveal` at all under `prefers-reduced-motion: reduce`, **and** the CSS block forces `.reveal { opacity: 1; transform: none }` with all transitions at `.001ms` | existing CSS + existing `app.js` selector |
| In-page anchor jump to `#features` | n/a | n/a | n/a | `html { scroll-behavior: auto }` under reduce | existing CSS |
| Theme swap on row 3's figure | none (instant) | 0 | n/a | unaffected | `display` swap under `[data-theme="dark"]` |
| Link hover inside a paragraph | `ease` | 150ms color | n/a | color changes are exempt and stay | existing CSS |

Deleting three articles removes three reveal targets and changes nothing about the
motion itself. Re-timing the 600ms entrance toward the doctrine is available and out of
scope; see the flag.

---

## Content Notes

The copy is The Engineer's, at the next stage. What this design fixes about it:

- **Every section is named for the tab it is**, from `TAB_LABELS`. No section heading is
  a sentence, a benefit or a pitch. `Weather & Tide Lookup` becomes `Weather`.
- **One section per tab**, and each says what that part does and who it helps. No
  settings mechanism, no control-by-control detail.
- **No count in the `<h2>`**, and no offline claim in it.
- **`Weather/tide Planner` appears exactly once in the file**, in row 1's second
  paragraph. Row 1 is deliberately **two paragraphs** — the tab's own actions, then the
  Planner — a structural decision with a measured payoff: it isolates the entire
  byte-pinned block (five verbatim sentences plus "a second action in Plan") into one
  `<p>`, so `weatherTidePlanPublishedClaims` extracts exactly that paragraph and the rest
  of the Weather copy is free to be rewritten. Every pinned sentence must land in
  paragraph 2; none may land in paragraph 1.
- Indicative paragraph counts, rendered in the mockup so the row heights are about right:
  1 → **2** (pinned, above), 2 → **3** (the tab, the Geographic Stats map and Projects,
  the Weather section), 3 → **3** (the map, fullscreen, share a spot), 4 → **2** (the tab,
  and the relocated Weather card paragraph). Every other section is **1**. Counts other
  than row 1's are The Engineer's to set; the two guard-anchored paragraphs in rows 2 and
  4 each carry a **200-character floor** and each keeps its sentence anchor
  (`<strong>Weather</strong> section reads back`, and `card on Species Detail shows the
  skies`).
- Zero em dashes; no standalone `Predict`; no `Get forecast`.

---

## Deltas The Engineer applies, in one list

1. `website/index.html`: re-order the ten remaining articles to the table above, rename
   `<h3>Weather &amp; Tide Lookup</h3>` to `<h3>Weather</h3>`, set `reverse` on even rows
   only, delete the `Offline support` and `Search anything by name` articles whole with
   their figures, move the Species Detail Weather card paragraph into row 4, split row 1
   into two paragraphs, drop the `.requirements` iCloud paragraph, and add the
   off-by-default property to the privacy band's existing sentence.
2. `website/styles.css`: delete the dead `.named*` block (`styles.css:266-272`) with its
   now-false `/* Named Birds mock */` comment. **Nothing is added.**
3. `README.md`: the same ten-section inventory in the same order, with the three
   fold-ins and five drops in *The README* above.
4. No change to `website/app.js`, `website/privacy.html`, or any asset. No file in
   `website/assets/` becomes unused.
