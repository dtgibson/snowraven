# Decisions: county-date-filter-mobile

## Stage 2, The Designer (2026-09-22)

### D1. The date fields stack on phones at every width; they never sit side by side
The Evaluator measured the iOS date input painting about 151px at 16px text
regardless of its box (UA `min-width: 102px`, `display: flex`). Two such fields
plus a visible From / To word cannot fit in a 320px or a 402px content box, so a
side-by-side layout would be one layout on big phones and another at 320px and
at 200% text. Stacking is the only arrangement that behaves the same from 320 to
430px and at every text scale. County goes full width above them so the three
rows form one block. Reversal: an iOS release whose date input shrinks to its
box; then side-by-side at >=390px becomes a legitimate option.

### D2. Joined pair, not two separate fields (user decision)
Both were shown in the mockup on the same markup. The user chose the joined
pair: "Joined pair, yes to both, this looks much better." The set or focused
half wins the shared edge via `z-index`.

### D3. Map Explorer sidebar goes beyond "labelling only" (user decision)
The brief scoped the sidebar to labelling. The user approved two additions:
its date fields join into the same pair, and they tint green when set, like
the other four surfaces. The county select there is unchanged. This is a
deliberate deviation from the Evaluator's scope line, approved at the design
gate.

### D4. Checklists' two mid-row separators hide on phones too (user decision)
The brief left the pill row's other separators to the Designer, and the
Designer proposed hiding Multimedia's whole row on phones. The user extended
it to Checklists' two mid-row separators for consistency. Both are named as
whole-row changes. Breeding Codes' single separator sits before the group and
is hidden with it. Mechanism: the inline separator objects are lifted to one
`.sr-pill-sep` class (desktop byte-identical) and hidden in the phone tier.

### D5. Phone-tier heights unified at the pill register (Designer)
The Evaluator's open question. Yes: on phones the block's controls take the
pill's 30px min-height and radius 6, so the whole filter strip reads at one
weight; `min-height` rather than `height`, so 200% text grows the rows. This
resolves the v0.5.81 26px / 28px tightness on Breeding Codes and Checklists in
passing. Desktop keeps its five per-surface values. The Map sidebar keeps its
34px panel register.

### D6. The visible word replaces the Calendar glyph on phones (Designer)
On iOS an empty date input paints nothing, so the word "From" / "To" inside the
field is the visible mark, in the slot the glyph occupied. It is a real
`<label for>` on a `useId()`-keyed id; `aria-label="From date"` / `"To date"`
stay the accessible names, so every existing query by name holds. The arrow is
`aria-hidden` everywhere and hidden on phones; the words do its job.

### D7. No new tokens, no new component library, no new dependency
Every colour is an existing `--sr-*` token in both themes; motion is the pill's
own 120ms ease-out CSS transition. The design system's Filters clause (native
`<select>`, paired native date inputs) is extended, not reinvented.

## Stage 3, The Engineer (2026-09-22)

### E1. One shared pair, five named desktop registers under `:where()`
`components/ui/DateRangeFields.tsx` replaces the five hand-drawn date pairs. The
three pill-row pairs were not one register: Multimedia is `min-height: 1.75rem`
with a stretching From field (and the only From wrapper with `min-width: 0`),
Species Detail `min-height: 1.625rem` with a stretching From field, Breeding
Codes a fixed `height: 26px`. So the prop is `register: 'multimedia' |
'species-detail' | 'breeding-codes' | 'checklists' | 'map-sidebar'`, and each
register's values are the old inline styles verbatim, in `globals.css`, every
selector wrapped in `:where()` (zero specificity). That is the mechanism: the
<=640 tier overrides all five with plain class rules and no `!important`,
whatever the specificity of the desktop selector. The design allowed either
this or keeping inline styles plus `!important` phone rules; the latter would
have fought the global input focus rule (its border colour is `!important`).
The new wrappers are layout-transparent on desktop (`display: contents`) wherever
there was no box before, so the desktop box tree is the old one.

### E2. On a phone the FIELD is the visible control and it wraps (deviation from the spec's CSS)
The spec placed the From / To word absolutely inside a fixed `3.75em` input
padding. Built exactly that way, the real render showed the date value CLIPPED
at 320px / 200% text on the two narrowest boxes: Checklists (its card leaves the
field 234px) in WebKit and Chromium, and the Map sidebar (249px) in Chromium.
The word measured 2.33em, so 24px of the 90px slot was empty at 200%, and the
value's own width depends on the engine (Chromium reserves about 200px at 24px
for `mm/dd/yyyy` plus its picker; WebKit about 140px) and on the locale's date
format. That is the incompressible pair `ui.md` (v1.0.22) says no slot width or
breakpoint can solve. Shipped instead: the field draws the box (border, fill,
radius, 30px minimum, tint, join), the word is an in-flow item with a fixed
`2.6em` basis, the input is borderless and fills the rest, and the field
`flex-wrap`s, so the value drops beneath the word only where it cannot fit, as
decided by the layout engine from the real content. The fixed word basis makes
both fields of a pair wrap under the same condition. Measured over 120
configurations: WebKit keeps one line everywhere except Checklists at
320px / 200%; Chromium wraps at 320px / 200% on all five and in the Map sidebar
at 200%. The approved look (word left, value beside it, joined pair, tint) is
unchanged wherever it fits, which is every iOS configuration measured.

### E3. The pair is a block, not a flex column
With the pair as a column flex item deep inside the wrapping pill row, WebKit
measured each field's height at an intrinsic width where word and value sat on
two lines and kept it (55px at 100% text instead of 31px, Multimedia, Breeding
Codes and Species Detail only); Chromium did the same while the field was
size-contained. A block lays each field out at its real width. Two earlier
measured fixes (`align-items: stretch` on the column, and `contain: inline-size`
on the field against Chromium's non-compressible date input min-content) were
superseded by this shape; neither ships, and the page measured clean without
containment in both engines.

### E4. The input takes the field's background (`inherit`), never `transparent`
WebKit paints an EMPTY date input's segments as a grey placeholder only over an
opaque background; over a transparent one it paints today's date in full text
colour, which reads as a set filter on a narrow macOS window. Measured with an
isolated five-input comparison in desktop WebKit.

### E5. The focus ring moves to the field
The global input ring would outline the borderless input inside the box. On a
phone the field draws it instead (`:focus-within`: the same 2px accent outline
at offset 0 and accent border), and the input's own ring is suppressed only
there. `:focus-within` rather than `:has()`, so the ring can never be lost where
`:has()` is unsupported. The global ring's soft 4px halo is not repeated: it is a
literal rgba with no token, and the design names only the outline.

### E6. Breeding Codes has TWO pill-row separators, not one
D4 says Breeding Codes' "single separator sits before the group". The code has
two: one between the code pills and the sort toggle, one before the county. Both
are lifted to `.sr-pill-sep` and both hide on phones, which matches the approved
mockup (its Breeding Codes phone frame shows no separator at all). Counted
roster: Multimedia 6 (the spec said 5), Breeding Codes 2, Checklists 2.

### E7. The word is a tappable `<label for>`, `aria-hidden`
In flow, a tap on the word focuses the input (`pointer-events: none` from the
spec no longer applies). `aria-hidden` because the input already speaks it:
the names stay `From date` / `To date` via `aria-label`, which contains the word
(label in name), so VoiceOver does not read "From" twice.

### E8. Map sidebar pair keeps `.sr-field-row` and is not wrapped in `.sr-whenwhere`
The sidebar's county select is a separate section the design leaves unchanged,
so a block wrapper would hold only the pair and add a margin the mockup cancels.
The pair keeps `.sr-field-row` for its desktop side-by-side layout; on a phone
the pair's own block rule governs.

### E9. A guard analyzer bug fixed, not worked around
`lib/mapFabCascade.test.ts`'s `specificity()` split compounds with a lookahead
that is blind to `[` inside a functional pseudo, so `:where(.a .b[x] > .c)`
scored (0,2,0) and read as a competitor outranking the map FABs. It now uses the
same depth-aware walk as its `rightmostCompound`. Over all 4,946 selectors in
HEAD and new source and built sheets plus maplibre-gl.css, the only selector
whose split changes is the new rule. `sr-whenwhere` joined its named
`NEVER_A_FAB_ANCESTOR` resolutions for the block's universal-child rule.

### E10. Checklists county: a transparent wrapper, one reporting difference
Checklists' county select had no wrapper; it gets `.sr-whenwhere-county
sr-whenwhere-county--bare`, `display: contents` on desktop. Desktop WebKit then
reports the select's computed `display` as `inline-block` where HEAD reports
`block` (resting state, 100% text), with identical geometry and zero pixel
difference. Recorded, not changed: the rendered result is the same.

### E11. Counted rosters moved deliberately
`.sr-ctl-label` 22 -> 24 (+2, `components/ui/DateRangeFields.tsx`, the From and
To words; no per-surface count moved). Map Explorer's native `sr-input-16`
controls 8 -> 6, with the two dates now counted on the shared pair (both its
inputs carry the class; the pair mounts once at `register="map-sidebar"`); the
nine-control total is unchanged. `<SidebarLabel ctlRem=` stays at 5.

### E12. Not changed
`docs/HELP.md` (its three filter sentences stay true: the filters still appear
in the toolbar). `.sr-field-row` and its six consumers, the `.sr-pill` /
`.sr-segbar` registers, the Breeding Codes containment hooks, filter logic,
state and results. No version bump, changelog, website, README or App Store copy.

### E13. The block removes the native select control on phones (QA attempt 1 fix)
QA found Checklists' county select under D5's 30px minimum in WebKit: 23px on
desktop WebKit (24px dark) and 29px on iOS, where Chromium and the other three
surfaces measured 30px. WebKit ignores `min-height` on a natively drawn select,
and Checklists' `selectStyle` is the only county select in the block without an
inline `appearance: none`. The fix sits on the SHARED phone-tier rule
(`.sr-whenwhere-county > select` gains `appearance: none`, both spellings, and
the 22px caret gutter the other three already reserve inline), so any select
that later joins the block is covered; the other three do not change. Removing
the native control removes its caret, so Checklists' county now draws the same
`▾` caret as the other three (same size, inset and tint-when-set, via a
`data-set` on its wrapper), shown on phones only; on desktop the span is hidden
under `:where()` and the native control is untouched. Chosen over a text-scaled
explicit `height` because it gives one look across the four county rows and
keeps the approved 30px-minimum mechanism rather than adding a formula.
Measured after the fix: Checklists' county 30px at 100% text and 39px (WebKit) /
38px (Chromium) at 200%, identical to Multimedia's, at 320/390/402px in both
themes, rest and set; restoring the native control in the same probe reads 24px
in WebKit, so the probe discriminates. Desktop Checklists at 1280/800/641px in
both engines is pixel-identical to HEAD. The guard that was missing: jsdom
honours `min-height`, so the resolved height stayed green; `dateRangeFieldsCss`
now pins `appearance: none` on the Checklists-shaped select, asserts
structurally that every <=640 rule giving a select in the block a `min-height`
also removes the native control, pins the caret (phone only, tinted when set),
and checks every county wrapper draws a caret beside its select.
