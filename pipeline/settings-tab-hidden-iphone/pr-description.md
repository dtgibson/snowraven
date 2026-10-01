## Settings tab hidden on iPhone (settings-tab-hidden-iphone)

### What this does

On a phone, the More sheet now keeps Settings, with its hairline above it, at the bottom of the sheet every time it opens, at every width and every in-app text size. When they do not all fit, the other destinations scroll above it. Since Targets joined the roster (1.0.39) the sheet's list ran past its `min(70dvh, 460px)` cap, and on every notched iPhone Settings sat entirely under the home indicator with no scroll cue.

After the live preview, the user chose the taller sheet: the cap is now `min(70dvh, 528px)`. 528px is the whole sheet's height at the default text size on a notched iPhone, so at 1x every destination shows without scrolling on every notched width.

The sheet is now a flex column in two parts:

- a **body** (`.sr-nav-sheet-body`) that scrolls and can shrink to nothing. It holds the handle, Search, the "More" heading and the overflow destinations.
- a **foot** (`.sr-nav-sheet-foot`) that never shrinks, sitting outside the body's scrollport. It holds the hairline and Settings.

The sheet keeps its 70dvh viewport term and its iOS home-indicator padding. Its pixel cap rose from 460px to 528px, and its top and side padding moved into the two parts. This is the same shape as the Alerts inbox sheet (`.sr-inbox-body` / `.sr-inbox-foot`).

Files:

- `frontend/src/components/TabNav.tsx`: `NavMoreSheet` moves a trailing Settings item into the foot and leaves the rest in the body. Only a trailing Settings moves, so DOM order matches `items` order as before: Tab order, the focus trap's list and the focus-on-open mapping are unchanged.
- `frontend/src/globals.css`: `.sr-nav-sheet` becomes a flex column with padding `0 0 14px` and a `min(70dvh, 528px)` cap, plus the new `.sr-nav-sheet-body` and `.sr-nav-sheet-foot` rules.
- `frontend/src/components/TabNav.test.tsx`: the guard (below).
- `frontend/src/lib/navCss.test.ts`: the two new selectors join the "every nav rule is top-level" roster.
- `docs/HELP.md` (Tab Layout): one clause, "where Settings always stays in view at the bottom of the sheet".

### How to test

1. `cd frontend && npm run dev`, then open the printed address (usually http://localhost:5173).
2. Switch the browser to a phone size (any width of 640px or less; 393 x 852 is a 6.1" iPhone).
3. Tap **More**. All seven destinations (Calendar to Named Birds) show, then a thin line, then Settings, with no scrolling. Tap Settings; the sheet closes and Settings opens.
4. In Settings, set Text size to the largest and open More again. Settings is still fully visible at the bottom, and the list above it now scrolls while Settings stays where it is. Repeat in the dark theme.
5. Set a small phone size (375 x 667 or 320 x 568) and open More. The sheet is shorter there, the list scrolls, and Settings is still in view.
6. Keyboard: Tab goes Search, each destination, Settings, then wraps to Search. Shift+Tab from Search goes to Settings. Escape closes the sheet and returns focus to More.
7. Automated: `cd frontend && npx vitest run src/components/TabNav.test.tsx src/lib/navCss.test.ts`.

### Notes for reviewer

**Measured in real engines against the built app.** The probe is the Evaluator's, extended: `pipeline/settings-tab-hidden-iphone/evidence/probe-after.mjs`. It uses Playwright 1.62.1, headless WebKit and Chromium, the `.sr-ios-app` class, and a 34px home-indicator inset substituted into the two gated rules. A text scale is proven to apply by reading the root font size back (16 / 20 / 24 / 32px). Devices: 320x568 (with a 34px inset as the worst case, and with 0 as on the real SE), 375x667 (SE, 0 inset), 375x812, 393x852, 402x874, 420x912, 430x932 and 440x956.

Results with the final 528px cap, 9 devices x 4 scales (1x, 1.25x, 1.5x, 2x) per run, 144 configurations in all:

| | HEAD (460px, no foot) | this change |
|---|---|---|
| WebKit, iOS inset | 18 of 18 fail at 1x/2x: Settings 0px clear on every notched width, 24/44 on the SE at 1x | **36 of 36 pass**, Settings fully visible (44/44 at 1x and 1.25x, 48/48 at 1.5x, 59/59 at 2x) |
| Chromium, iOS inset | 18 of 18 fail at 1x/2x | **36 of 36 pass**, same figures |
| Web/Pi (no iOS class), WebKit and Chromium | not measured | **36 of 36 pass in each engine** |
| All seven other rows fit with no scrolling at 1x | Settings hidden instead | **yes on every notched width** (375x812, 393x852, 402x874, 420x912, 430x932, 440x956): body 418/418 in both engines, iOS and web. The SE sizes are capped by 70dvh (397.6px at 568 tall, 466.9px at 667) and scroll, as intended |
| Other rows reachable, each fully visible above the foot | rows scrolled into view landed under the indicator (up to 4 rows at 2x) | every row reachable in all 144 configurations |
| A row focused by Tab is visible (not obscured) | Settings obscured at every notched width at 1x; two rows at 2x | 0 obscured in all 144 configurations |
| Tab order, and the trap wrapping both ways | Search > 7 rows > Settings > Search | identical, one distinct order in every run |

**The 528px fit has no slack, and it does not need any.** At 1x on every notched width the body's content measured 418.000px in a 418.000px body, to the sub-pixel, in both engines. The sheet is 1px of border + 418px of body + 61px of foot + 48px of padding (14px plus the 34px inset). Every term is a declared length: the 8px body padding, the 16px handle, Search at its 44px floor plus 10px, the heading at 24px from `body { line-height: 1.5 }` plus 8px, seven rows at their 44px floor, and the foot's 1px hairline, 16px of margins and 44px row. None depends on font metrics, so the fit should hold on the device. A real inset other than 34px would change it: a larger one would make the list scroll by the difference at 1x, and Settings would stay pinned either way.

"Fully visible" means the row lies inside the sheet above the inset strip, and five hit-test points across it all land on Settings. Also measured:

- Other row counts (WebKit, iOS inset): one tab hidden (7 rows) at 320 and 393 at 1x/2x, Settings alone (one visible tab), and one row plus Settings. All pass.
- Short narrow windows (both engines): 600x360 and 600x300 at 1x, and 600x300, 600x200 and 500x160 at 2x. Settings stays visible, and focus lands on it when Settings is the active tab. The sheet itself never overflows; at 500x160 and 2x the body shrinks to 21px.

Screenshots are the `after-*.png` files beside the Evaluator's before shots in `evidence/`, in light and dark, at 1x and 2x, scrolled and unscrolled.

**Why a pinned foot rather than `position: sticky` inside the scroller.** The brief suggested sticky as one option. I did not use it, for three reasons:

- A row focused by Tab is scrolled to the scrollport's bottom edge, which would sit behind a sticky row. That is WCAG 2.4.11 (Focus Not Obscured). The foot here is outside the scrollport, so engines scroll a focused row into view above it, and the probe measured 0 obscured rows.
- On iOS the sheet's bottom padding (14px plus the inset) is inside the scrollport, so rows would show through the strip under a sticky row unless it painted an extension downward.
- A `scroll-padding` fix would need the foot's height, which changes with text scale.

Nothing scrolls under the foot, so it needs no background of its own. It shows the sheet's `--sr-surface` in both themes.

**Scroll cue.** Where the list scrolls (larger text, and the SE sizes), the body's lower edge usually cuts a row in half, which reads as "this list scrolls". In 2 of the 30 scrolling iOS configurations in each engine (320x568 at 1x with the modeled inset, and 375x667 at 2x) the edge falls within 4px of a row boundary, so no partial row shows. Adding a cue would be new UI, so it is flagged rather than done.

**The guard** is a new block in `TabNav.test.tsx`, "the More sheet keeps Settings in view at any row count and any text scale":

- The markup is swept over every row count the sheet can hold (1 to 11 visible tabs). The foot holds Settings and the hairline, the body holds every other row, the foot is the sheet's last child, and the trap's focusable list is Search, the rows in saved order, then Settings.
- The focus-on-open mapping is checked for an active row in the list and for Settings in the foot.
- The CSS is checked as resolved cascade values over every rule in the real `globals.css` that can match the rendered element, by importance, specificity and source order. The sheet is a flex column whose cap is `min(70dvh, <px>)`, with the px term at least 528, the sheet's measured height at 1x on a notched iPhone. The body scrolls, may shrink, and has a zero or automatic minimum. The foot holds its whole height, is not clipped, capped or lifted out of flow, and is matched by a rule that names it exactly. On iOS the inset pads the sheet or foot, never the body.
- Non-vacuity rows prove the model finds real rules and settles a specificity contest the engine settles.

The geometry itself is the browser measurement above; the file header says so.

**Mutation check.** `evidence/mutation-harness.mjs` snapshots the two source files once, restores them from the snapshot and verifies by hash. All **28 of 28** mutations behaved as expected.

- **Red (21):** CSS reverted, TSX reverted, the sheet not a column, the column turned to a row, the body's overflow removed, a body `min-height: 12rem`, the body unable to shrink, the foot able to shrink (two ways), the foot made absolute, the foot selector renamed, a later phone-tier override, a later equal-specificity override, the iOS inset moved onto the body, the cap removed, the cap reverted to 460px, the cap one pixel short at 527px, the foot rendered inside the body, Settings not pinned, the hairline dropped, and Settings both listed and pinned.
- **Green, each for a stated reason (7):** foot `flex: 1 1 auto` alone (a non-scroller's automatic minimum holds it whole), `flex: 0 0 auto`, body `overflow-y: scroll`, body `min-height` removed (a scroll container's automatic minimum is 0), a losing-specificity `div` override, foot `position: sticky`, and the cap raised to 600px (a taller cap is harmless).

A separate run also turned a changed viewport term (`80dvh`) red.

**Tailwind source scan.** A first draft of the test leaked `.flow-root` and `.flex-grow` into the shipped CSS through two string literals. Both are gone. The final built CSS differs from HEAD's by exactly the three nav-sheet rules, with the utilities layer identical, compared rule by rule.

**Results.** After the 528px change: the touched suites (`TabNav`, `navCss`, `tabOrderCoverage`, `paletteCss`, `AlertsInboxEntry`), 5 files and 137 tests, exit 0; `npm run typecheck`, `npm run lint` and `npm run build` each exit 0. On the 460px version, before the cap change: the full frontend suite (430 files passed and 5 skipped, 9,127 tests passed and 7 skipped, exit 0) and every suite that reads `docs/HELP.md` (19 files, 377 tests, exit 0), with `weft-design-lint` clean on both changed files. The cap change touches only that one declaration, its comments and the guard.

**Out of scope:** the iPhone landscape rail and sidebar (Settings below the fold since 1.0.17) is untouched, and so is the bottom bar. There is no version bump, changelog entry or website, README, App Store or privacy change; release prep belongs to the Deployer. A physical-device check, if wanted, is the user's to perform on the TestFlight build.
