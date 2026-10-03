# Change Brief: Targets focus scroll room

## What is changing

Where the Targets table scrolls sideways inside its own box, a keyboard user who Tabs to a control in the table sees the whole control: its end, the hotspot link's open-on-eBird icon, and the focus ring. Today the box scrolls only far enough to show the control's start.
The expected repair is `scroll-padding-inline-end` on the Targets table's scroll wrapper, which is a real sideways scrollport (the Breeding Codes `scrollPaddingLeft` case). The measured alternative is `scroll-margin-inline-end` on the links and buttons inside it, reached by a descendant combinator and never placed on a cell.
The rule lives in the Targets subtree (a selector inside `.sr-tg-list-card`, or a Targets class added to the wrapper) in the base tier. It never goes on the shared `.sr-scroll-x` rule, and never on `:root` or `html`.
Its size is derived from the declarations it covers (`--sr-tg-glyph-hang`, plus the global ring's 3px outline at a 3px offset), never a restated 19px. If the hang variable has to move to a common ancestor, the F4 guard that pins it moves with it, unweakened.
The v1.0.47 link padding and margin pair and the last-word box are not touched. The start edge is in scope only if Shift+Tab measures a clipped control there, and it is then fixed by the same means.
Choose the mechanism by measuring both engines first. An engine may count a partly visible control as visible on the sideways axis and not scroll at all. If no CSS form moves WebKit (the Mac, iPhone and iPad engine), stop and report. Do not ship a Chromium-only fix or add a focus handler on your own.

## Why now

This is the user's saved idea. It comes from the targets-hotspot-link Tester's sweep (v1.0.47), whose figures are in ROADMAP.md's Targets residuals entry, items 1 and 2. The QA report itself is a per-run file and is no longer on disk.
At the default text size the table scrolls sideways inside its wrapper at 680 to 1000px. With 200% in-app text it does so at desktop widths (641px and up). The page itself never scrolls sideways. 1.0.48 removed the 320 to 420px phone case; the wider cases were not re-measured.
Where it scrolls, keyboard focus moves the wrapper only far enough to show a link's start. At least 73% of the link always showed, so its end, icon and ring could sit past the edge. The record suggested about 19px of end room: the 13px hang plus the ring.
The sweep covered 320 to 1280px in 40px steps at 100% and 200%, in WebKit and Chromium. The record does not say which engine gave the worst case, so the starting state is measured again before the fix.
Part of the control always shows, so this is not a failure of WCAG 2.2 SC 2.4.11 (minimum) today. Showing the whole control meets the 2.4.12 standard and is what ACCESSIBILITY.md's "Wherever keyboard focus lands, you can see it" implies.

## User-facing impact

Keyboard users on the Mac, iPad, Windows and web apps see the whole focused control as they Tab across the Targets table, at the widths where it scrolls sideways.
Nothing changes at rest. Scroll room adds no visible space, moves no column, and leaves mouse, trackpad and touch scrolling as they are.
The phone card layout (640px and narrower) is unaffected. No copy changes, and ACCESSIBILITY.md stays true and is not edited.
The other `.sr-scroll-x` tables (Birding Statistics twice, Species detail, the list comparer) are not changed and not measured.

## Design pass

Not needed: no visible change at rest. Only the resting point of the table's sideways scroll changes, when keyboard focus moves. If measurement shows that only real padding at the table's end would cure it, that is visible space and goes back for a design decision before it is built.

## Decisions touched

- `.claude/rules/ui.md`, v0.5.81 bullet (`scroll-padding` on the scrollport, `scroll-margin` on the focus target, keep the rule in the feature's own subtree): applied, not reversed. That bullet calls Breeding Codes the one genuine horizontal `scroll-padding` case. If the wrapper form ships, Targets becomes a second, and the Chronicler updates the sentence.
- DECISIONS.md, v1.0.47 (targets-hotspot-link): the glyph hang and the room-on-the-link rule stand unchanged.
- DECISIONS.md, v0.5.81 post-mortem (a `scroll-margin` on a cell is inert): any `scroll-margin` form is read off the element that receives focus.
- CLAUDE.md, "a null result is per-scrollport and per-engine": each engine is measured, never inferred from the other.
- ROADMAP.md, Targets residuals entry: this closes item (2). Item (1), the contained sideways scroll, stays, because SC 1.4.10 exempts tables.

## What done looks like

1. A real-engine run of the built app in Chromium and WebKit (Playwright from `website/tools`). It uses fixtures, never the user's data or a real eBird key, and renders a full table with hotspot links under Last report.
   - Widths: 641px, then 680 to 1280px in 40px steps, at 100% and 200% in-app text (`--sr-text-scale`).
   - Tab and Shift+Tab through every control inside the wrapper: sort buttons, species name buttons, reference-site marks and hotspot links.
   - Pass: each focused control's box, icon and ring (outline width plus offset) lies inside the wrapper's visible box. The starting state is measured first to show the defect, and the fix must show zero clipped.
   - 320 to 640px at 200% is a no-regression row.
   - The probe is committed in this folder (the `breeding-code-pinned-labels/focus-obscured-probe.mjs` precedent). It joins `website/tools/verify/` only if it runs from fixtures with no network.
2. A stylesheet guard in the house style (a `lib/*Css.test.ts` over `globals.css`, next to F4 in `targetsSortSelectCss.test.ts`). It checks that the declaration is on the Targets selector, in the base tier, and derived from the hang and ring declarations.
   - Mutation rows go red when the declaration is removed, moved to `.sr-scroll-x`, `:root` or a cell, or restated as a literal. A never-vacuous row is included.
3. Suite, typecheck, lint and build are green, and `changelog-line.md` is written. No version bump, CHANGELOG, website, README, App Store or privacy edits.
