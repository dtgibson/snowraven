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

## Stage 6, The Deployer (2026-09-22)

### S1. The ship shape: one release commit, one dev-only harness fix ahead of it
The production gate was confirmed by the user, with every pre-gate recommendation accepted. `6589d0b` fixed a latent crash in `website/tools/verify/verify-plan-readout.mjs` (a `const` reassigned whenever any movement above zero was measured, which turned Pipeline `35766577535` on `b9dd66d` red on a reading its own 0.5px tolerance passes; present since `2b80fd8`). It is test tooling, so it took no version bump, and it landed as its own commit before the bump so the release's own runs could not go red on it. `d439aa3` carries the change, its guards, the durable run docs and the four-file version set; `v1.0.34` points at it. `55f5399` is the iOS stamp, so the stamp commit's Pipeline run is the run of record (the tag commit's run was cancelled by that push, as expected).

### S2. The 1.0.33 changelog debt is discharged in this ship
The two `docs/HELP.md` sentences added at `11130b6` first reached users in 1.0.33 and that release's changelog owed them an entry (ROADMAP, "Two ship-record debts from the v1.0.33 ship", item 1). The user approved the wording and it was appended to the `[1.0.33]` section's `### Changed` list in `d439aa3`, so it is recorded against the release that shipped the sentences rather than against 1.0.34.

### S3. The user's own report screenshot is never committed
`user-report-iphone.png` shows the user's real Macaulay Library export (species rows, per-species photo counts, totals) and the repository is public. User decision: it stays out of every commit. It was left unstaged, and held outside the tree while `release.sh` ran so the clean-tree preflight stayed intact rather than being bypassed with `ALLOW_DIRTY`. `change-brief.md` names it only as the source of the report.

### S4. App Store: 1.0.33 rolls up into 1.0.34 (user decision)
1.0.33 (record `f380012a`, submission `44f7cb18`) was still `WAITING_FOR_REVIEW` at the gate. The user chose the roll-up: once TestFlight build 1.0.34.1 has been installed and opened on a real iPhone (the v1.0.31 precondition), withdraw 1.0.33, retarget the same record to 1.0.34, repoint it at 1.0.34.1, replace the whole iPhone 6.9 screenshot set in order with a recaptured `05-species-detail.png`, set the approved roll-up What's New, and resubmit. The cost is 1.0.33's place in the queue. What it buys: one review, one update for iPhone users, no stale screenshot of a defect the app no longer has, and no App Store leg left deferred. If 1.0.33 has moved to `IN_REVIEW` or later by then, the fallback is a deferral, and that needs the user's approval of different What's New text first.

### S5. The App Store capture rig no longer photographs the eBird mark, and the recapture works around it without changing the rig
Recapturing `05-species-detail.png` with `website/tools/capture-appstore.mjs` as committed drew the Species Detail eBird link as its fallback globe glyph where the committed shot shows the eBird "e". The cause was measured, not assumed. `https://ebird.org/favicon.ico` loads at `naturalWidth` 48 in headless Chromium with a normal Chrome user agent and at 0 with the default `HeadlessChrome` one, while the Birds of the World favicon loads under both. So eBird now refuses the favicon to the headless user agent. The real app on an iPhone sends a normal WebKit user agent and shows the mark. The shot proposed for the store was taken from a one-off copy of the rig whose only difference is the user agent with `HeadlessChrome` replaced by `Chrome`. The committed rig is unchanged, because a tooling change is not this build's scope and every shot the rig takes is now affected (the plain rerun drew globes on 05 and 06 too). ROADMAP carries the fix: `makePage` in `capture-lib.mjs` sets that user agent, and a capture-time check fails the run when a favicon in frame has `naturalWidth` 0. Two things that capture showed are worth keeping. The plain rerun's other iPhone shots differed from the committed ones only by that glyph and by rig timing (and the Statistics shot timed out), and none of them photographs the changed controls, so the committed bytes stay and only 05 is replaced. And the rig draws Chromium's empty-date `mm/dd/yyyy` placeholder and picker icon beside the word "From". The iPhone app does not draw those. The old shot had the same gap, so this change did not introduce it.

### S6. The stamp commit's verification gate went red on a harness race that predates this change, and was re-run rather than chased
Pipeline `35811799962` (stamp commit `55f5399`) failed one harness: `verify-plan-daylabels.mjs`, in the WebKit wide sweep, timed out waiting for the Welcome dialog to detach after `openPlan` pressed Escape. Every earlier sweep in that run passed (all of Chromium, and WebKit phone and band). Run `35057486338` on the 1.0.31 stamp commit `71fe2e7` failed identically: same harness, same sweep, same line. So this is a recurring identity in the harness, not this change, which touches neither the Welcome dialog nor the Weather tab. The mechanism, read from the code: `WelcomeScreen` attaches its Escape listener in a passive `useEffect`, and the harness presses Escape the moment the dialog is visible. Between the paint and the effect, the key is lost. That is the v1.0.25 async rule's shape, a wait for an observable other than the one the next action consumes. The failed job was re-run, and that publishes nothing. The durable fix is in the harness and goes to ROADMAP: wait for focus to land on the dialog's first button (set by the same effect that attaches the listener) before pressing Escape, and prove it by delaying the effect. Per `.claude/rules/testing.md`, it is not filed on the flake roster, because a race that can be made deterministic is a defect.

### S7. The device-install precondition (v1.0.31), as recorded at stop point A
The user reported, 2026-09-22 ~20:20 PDT: "The ios app launches in testflight and looks great" (user-verified launch on iPhone). ASC shows TestFlight build 1.0.34.1 (`94b29998-2c06-4bae-b4d6-821cd1db8ad0`) as the newest build, VALID since about 19:50 PDT, which is before the report. So 1.0.34.1 was the build on offer. ASC's install metric for it had not registered an install yet: it lags, and the same metric shows this morning's 1.0.33.1 installs. So the build identity is confirmed by a visible check on the phone (the joined From / To filter pair, which 1.0.33.1 does not draw) before 1.0.33 is withdrawn.

### S8. Device check discharged; the recaptured screenshot approved
The user confirmed on the iPhone (their words: "yes to both, the phone shows the joined pair") that the TestFlight build shows the county picker across the top with the joined From / To pair beneath it. 1.0.33.1 draws the stacked tower, so the build that launched is 1.0.34.1 (`94b29998-2c06-4bae-b4d6-821cd1db8ad0`), user-verified on a real iPhone on 2026-09-22 before anything was submitted. That discharges the v1.0.31 precondition. The user approved the recaptured `05-species-detail.png` after viewing it side by side with the current store shot. It replaces `appstore/screenshots/iphone-6.9/05-species-detail.png` (md5 `2482614b9ac6f05c5f77c4f40a2188d3`), and the other five iPhone images and all six iPad images keep their committed bytes.

### S9. The App Store leg: 1.0.33 rolled up into 1.0.34 (record `f380012a`, withdrawn submission `44f7cb18`, new submission `4fe5686a`)
The state was re-read immediately before the withdrawal: `WAITING_FOR_REVIEW`. `DELETE /v1/appStoreVersionSubmissions/f380012a-3c80-435c-9fd9-5a745982354c` returned 204. Submission `44f7cb18-3e0a-49ff-a20c-6a4d3cf801f0` went `CANCELING` then `COMPLETE`, and the record went to `DEVELOPER_REJECTED`. The same record was then:
1. PATCHed to `versionString` 1.0.34 and repointed at build 1.0.34.1 (`94b29998-2c06-4bae-b4d6-821cd1db8ad0`), which moved it to `PREPARE_FOR_SUBMISSION`.
2. Given a whole new iPhone 6.9 set: all six images deleted, then all six uploaded in 01 to 06 order from the committed files, each committed with its md5 and all `COMPLETE`. The iPad set was untouched.
3. Given the user-approved roll-up What's New, verbatim (exact-match read back).

The age rating on the editable app-info record `7eeee773` was already answered (`socialMedia` false, `socialMediaAgeRestricted` false). The review notes on the record match `appstore/REVIEW_NOTES.md`. It was resubmitted through the current flow: review submission **`4fe5686a-7a58-44ca-8ec3-ba1d58b8ceb5`**, item added, `submitted: true`, now **`WAITING_FOR_REVIEW`** (2026-09-23T03:34:18Z), `releaseType` AFTER_APPROVAL. 1.0.33 now has a VALID TestFlight build (1.0.33.1) and no version record of its own. That is the evidence a skip leaves, so this roll-up belongs in CLAUDE.md's App Store list, named with both versions and these ids, in the Chronicler's closeout.
