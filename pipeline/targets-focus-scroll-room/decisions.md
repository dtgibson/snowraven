# Decisions: targets-focus-scroll-room

## Outcome: blocked, nothing shipped

No CSS form can meet the brief's pass criterion ("each focused control's box, icon and ring lies inside the wrapper's visible box ... the fix must show zero clipped") in either engine. Nothing was changed in `frontend/`, so there is no CSS rule, guard row, changelog line or version change. The recommendation is to **decline** this item and correct ROADMAP item (2), whose mechanism and size were wrong (below).

The orchestrator's stop condition reads "no CSS property moves WebKit's focus scroll at all". Taken literally, that is not quite what was measured. `scroll-padding` and `scroll-margin` do move WebKit's focus scroll, but only in a narrow band of cases. They move Chromium's only for a control that shows less than the padding, which Chromium then treats as hidden. In every padding form tried, the same change clipped controls that had been whole before. Shipping one would mean shipping a change that fails its own acceptance criterion and makes some stops worse. The brief rules that out ("Do not ship a Chromium-only fix or add a focus handler on your own"), so this stops here.

## Why: both engines leave a partly visible control where it is

Neither engine scrolls the wrapper when keyboard focus lands on a control that is already partly visible. It is not that they scroll "only far enough to show the start", as the record said.

- **Chromium** does not scroll if any part of the control is inside the scroller's snapport (its visible box less `scroll-padding`). Only a fully hidden control is scrolled, and it goes to the center.
- **WebKit** does not scroll if 32px or more of the control is inside the snapport. With less than 32px showing, it scrolls the control's end flush with the edge, which still leaves the 6px ring outside.
- **`scroll-padding`** only moves where the snapport ends. It reaches a control whose visible part is narrower than the padding (Chromium), or narrower than 32px plus the padding (WebKit). Any wider visible part stays exactly where it was.
- **`scroll-margin`** does nothing for a partly visible control in Chromium. In WebKit it only affects the under-32px case.

`reveal-threshold-repro.mjs` shows this without the app: a 400px scroller, a 100px button, a real Tab press.

| Button showing | CSS | Chromium scrolled / ring past edge | WebKit scrolled / ring past edge |
|---|---|---|---|
| 0px (hidden) | none | 250 / -144 (centered) | 250 / -144 (centered) |
| 10px | none | 0 / **96** | 90 / **6** |
| 10px | scroll-margin-inline-end: 19px | 0 / **96** | 109 / -13 |
| 20px | scroll-padding-inline-end: 19px | 0 / **86** | 99 / -13 |
| 33px | none | 0 / **73** | 0 / **73** |
| 33px | scroll-padding-inline-end: 19px | 0 / **73** | 86 / -13 |
| 40px | scroll-padding-inline-end: 19px | 0 / **66** | 79 / -13 |
| 70px | scroll-padding-inline-end: 60px | 0 / **36** | 90 / -54 |

For a padding to guarantee a whole control, it would have to be at least as wide as the widest control plus its ring (Chromium), or that less 32px (WebKit). On this table that is about 166px at 100% text, where the widest control, a species-name button, is 160px wide. At 200% it is about 305px, where the species-name buttons are up to 299px wide. That is wider than the snapport at the narrow end of the band, and every focus scroll would park a control that far from the edge.

## Starting state, measured in both engines

The built app (the HEAD build, `index-kngkoBkd.css`) was served by a real backend copy with no `.env`. Its data was a scratch copy of `website/tools/demo-data`, with Kings County, US-NY-047, as the remembered county. Only the eBird-backed answers, the key lookup, the text scale and the bar-chart file were answered in the browser, all built from the demo data by `focus-scroll-probe.mjs`. The table had 26 rows, every column, and 22 hotspot links under Last report. The probe placed focus just before the wrapper, pressed Tab until focus left it, then Shift+Tab until it left at the start. That is 200 stops per configuration. At every stop it read the control's box, its glyph, and the ring from its own computed outline (3px at a 3px offset), and compared them with the wrapper's client box.

The non-vacuity checks all held. The root font size was 16px at 100% and 32px at 200% in every leg. Every stop matched `:focus-visible` with a ring (0 without one). Across all 890 measured configurations in five runs, the wrapper was entered in both directions every time, the table had 26 rows and 22 hotspot links, no page error was raised, and the page itself never scrolled sideways. The variants below changed the counts, so the instrument discriminates.

"Clipped" means the ringed box sits more than 0.5px past an edge. Totals are over 641px and 680 to 1280px in 40px steps (17 widths, 200 stops each, 3,400 stops per engine and scale):

| Engine | Scale | Clipped | Past the end | Past the start | Worst past end | Worst past start | Mechanism of the clipped stops |
|---|---|---|---|---|---|---|---|
| Chromium | 100% | 170 | 137 | 33 | 110.6px | 159.0px | 167 not scrolled (counted as visible), 3 first stop of a pass |
| Chromium | 200% | 76 | 23 | 53 | 240.8px | 232.5px | 76 not scrolled |
| WebKit | 100% | 240 | 151 | 89 | 110.6px | 54.0px | 197 not scrolled, 40 scrolled flush (ring cut), 3 first stop |
| WebKit | 200% | 76 | 23 | 53 | 200.7px | 192.6px | 70 not scrolled, 6 scrolled flush |

Which controls clip, by scale. At 100%: hotspot links (132 Chromium, 146 WebKit), reference-site marks (22 / 24), sort buttons (14 / 14) and species-name buttons (2 / 56). At 200%: only sort buttons (45) and species-name buttons (31), 125 to 299px wide. The start edge clips in both engines on Shift+Tab, so it would have been in scope.

Per configuration (sideways room is the wrapper's `scrollWidth - clientWidth`):

| Engine | Scale | Width | Sideways room | Clipped at end | Clipped at start | Worst past end | Worst past start | Clipped controls |
|---|---|---|---|---|---|---|---|---|
| Chromium | 100% | 641 | 364 | 1 | 2 | 110.6 | 17.0 | sort 3 |
| Chromium | 100% | 680 | 325 | 1 | 1 | 71.6 | 94.0 | sort 2 |
| Chromium | 100% | 720 | 285 | 1 | 1 | 31.6 | 54.0 | sort 2 |
| Chromium | 100% | 760 | 245 | 0 | 1 | 0 | 14.0 | sort 1 |
| Chromium | 100% | 800 | 205 | 0 | 3 | 0 | 19.0 | refmark 3 |
| Chromium | 100% | 840 | 165 | 0 | 18 | 0 | 159.0 | name 2, refmark 16 |
| Chromium | 100% | 880 | 125 | 44 | 1 | 36.4 | 60.7 | sort 1, hotspot 44 |
| Chromium | 100% | 920 | 241 | 0 | 1 | 0 | 10.0 | sort 1 |
| Chromium | 100% | 960 | 201 | 0 | 3 | 0 | 15.0 | refmark 3 |
| Chromium | 100% | 1000 | 161 | 44 | 0 | 72.4 | 0 | hotspot 44 |
| Chromium | 100% | 1040 | 121 | 44 | 1 | 32.4 | 56.7 | sort 1, hotspot 44 |
| Chromium | 100% | 1080 | 81 | 0 | 1 | 0 | 16.7 | sort 1 |
| Chromium | 100% | 1120 | 41 | 2 | 0 | 34.9 | 0 | sort 2 |
| Chromium | 100% | 1160 to 1280 | 1 or 0 | 0 | 0 | 0 | 0 | none |
| Chromium | 200% | 641 | 1121 | 2 | 11 | 168.7 | 103.0 | sort 3, name 10 |
| Chromium | 200% | 680 | 1082 | 2 | 9 | 129.7 | 232.5 | sort 4, name 7 |
| Chromium | 200% | 720 | 1042 | 2 | 7 | 91.8 | 192.5 | sort 4, name 5 |
| Chromium | 200% | 760 | 1002 | 2 | 4 | 71.8 | 152.5 | sort 3, name 3 |
| Chromium | 200% | 800 | 962 | 2 | 3 | 51.8 | 112.5 | sort 3, name 2 |
| Chromium | 200% | 840 | 922 | 1 | 3 | 166.5 | 72.5 | sort 2, name 2 |
| Chromium | 200% | 880 | 882 | 1 | 1 | 126.5 | 32.5 | sort 2 |
| Chromium | 200% | 920 | 842 | 1 | 0 | 86.5 | 0 | sort 1 |
| Chromium | 200% | 960 | 802 | 1 | 2 | 46.5 | 150.3 | sort 3 |
| Chromium | 200% | 1000 | 762 | 1 | 2 | 6.5 | 110.3 | sort 3 |
| Chromium | 200% | 1040 | 722 | 1 | 2 | 240.8 | 70.3 | sort 3 |
| Chromium | 200% | 1080 | 682 | 1 | 2 | 200.8 | 30.3 | sort 3 |
| Chromium | 200% | 1120 | 954 | 2 | 3 | 47.8 | 104.5 | sort 3, name 2 |
| Chromium | 200% | 1160 | 914 | 1 | 1 | 158.5 | 64.5 | sort 2 |
| Chromium | 200% | 1200 | 874 | 1 | 1 | 118.5 | 24.5 | sort 2 |
| Chromium | 200% | 1240 | 834 | 1 | 0 | 78.5 | 0 | sort 1 |
| Chromium | 200% | 1280 | 794 | 1 | 2 | 38.5 | 142.3 | sort 3 |
| WebKit | 100% | 641 | 364 | 1 | 2 | 110.6 | 17.0 | sort 3 |
| WebKit | 100% | 680 | 325 | 1 | 1 | 71.6 | 6.0 | sort 2 |
| WebKit | 100% | 720 | 285 | 1 | 1 | 31.6 | 54.0 | sort 2 |
| WebKit | 100% | 760 | 245 | 0 | 1 | 0 | 14.0 | sort 1 |
| WebKit | 100% | 800 | 205 | 0 | 8 | 0 | 6.2 | refmark 8 |
| WebKit | 100% | 840 | 165 | 14 | 25 | 27.1 | 51.0 | name 17, refmark 8, hotspot 14 |
| WebKit | 100% | 880 | 125 | 44 | 1 | 36.4 | 5.7 | sort 1, hotspot 44 |
| WebKit | 100% | 920 | 241 | 0 | 1 | 0 | 10.0 | sort 1 |
| WebKit | 100% | 960 | 201 | 0 | 8 | 0 | 6.2 | refmark 8 |
| WebKit | 100% | 1000 | 161 | 44 | 39 | 39.4 | 30.0 | name 39, hotspot 44 |
| WebKit | 100% | 1040 | 121 | 44 | 1 | 32.4 | 5.7 | sort 1, hotspot 44 |
| WebKit | 100% | 1080 | 81 | 0 | 1 | 0 | 16.7 | sort 1 |
| WebKit | 100% | 1120 | 41 | 2 | 0 | 34.8 | 0 | sort 2 |
| WebKit | 100% | 1160 to 1280 | 1 or 0 | 0 | 0 | 0 | 0 | none |
| WebKit | 200% | 641 | 1121 | 2 | 11 | 130.7 | 103.0 | sort 3, name 10 |
| WebKit | 200% | 680 | 1082 | 2 | 9 | 129.6 | 83.0 | sort 4, name 7 |
| WebKit | 200% | 720 | 1042 | 2 | 7 | 91.7 | 192.6 | sort 4, name 5 |
| WebKit | 200% | 760 | 1002 | 2 | 4 | 71.7 | 152.6 | sort 3, name 3 |
| WebKit | 200% | 800 | 962 | 2 | 3 | 51.7 | 112.5 | sort 3, name 2 |
| WebKit | 200% | 840 | 922 | 1 | 3 | 6.5 | 72.5 | sort 2, name 2 |
| WebKit | 200% | 880 | 882 | 1 | 1 | 126.5 | 32.5 | sort 2 |
| WebKit | 200% | 920 | 842 | 1 | 0 | 86.5 | 0 | sort 1 |
| WebKit | 200% | 960 | 802 | 1 | 2 | 46.5 | 60.7 | sort 3 |
| WebKit | 200% | 1000 | 762 | 1 | 2 | 6.5 | 110.4 | sort 3 |
| WebKit | 200% | 1040 | 722 | 1 | 2 | 5.7 | 70.4 | sort 3 |
| WebKit | 200% | 1080 | 682 | 1 | 2 | 200.7 | 30.4 | sort 3 |
| WebKit | 200% | 1120 | 954 | 2 | 3 | 47.7 | 104.5 | sort 3, name 2 |
| WebKit | 200% | 1160 | 914 | 1 | 1 | 6.5 | 64.5 | sort 2 |
| WebKit | 200% | 1200 | 874 | 1 | 1 | 118.5 | 24.6 | sort 2 |
| WebKit | 200% | 1240 | 834 | 1 | 0 | 78.5 | 0 | sort 1 |
| WebKit | 200% | 1280 | 794 | 1 | 2 | 38.5 | 142.4 | sort 3 |

## Every CSS form tried, on the same build, same stops

Each form was added to the HEAD build as an injected stylesheet. Nothing else matches the property on that element, so the injection is like for like with a shipped rule. Every form was scoped to `.sr-tg-list-card .sr-scroll-x`, never `.sr-scroll-x` or `:root`. "Newly clipped" counts stops that were whole in the starting state and clipped with the form. "Repaired" counts the reverse. Stops are compared one by one, in Tab order.

| CSS tried | Engine | Scale | Clipped (of 3,400) | Newly clipped | Repaired |
|---|---|---|---|---|---|
| none (starting state) | Chromium | 100% | 170 | - | - |
| none | Chromium | 200% | 76 | - | - |
| none | WebKit | 100% | 240 | - | - |
| none | WebKit | 200% | 76 | - | - |
| `scroll-padding-inline-end: 19px` (the brief's derived value) | Chromium | 100% | 147 | 21 | 44 |
| same | Chromium | 200% | 80 | 8 | 4 |
| same | WebKit | 100% | 262 | 151 | 129 |
| same | WebKit | 200% | 78 | 8 | 6 |
| `scroll-padding-inline: 6px 19px` (start edge added, ring only) | Chromium | 100% | 137 | 16 | 49 |
| same | Chromium | 200% | 79 | 7 | 4 |
| same | WebKit | 100% | 155 | 72 | 157 |
| same | WebKit | 200% | 74 | 7 | 9 |
| `scroll-margin-inline: 6px 19px` on the links and buttons inside | Chromium | 100% | 170 | 0 | 0 |
| same | Chromium | 200% | 81 | 5 | 0 |
| same | WebKit | 100% | 218 | 8 | 30 |
| same | WebKit | 200% | 77 | 5 | 4 |
| both 6px 19px forms together | Chromium | 100% | 137 | 16 | 49 |
| same | Chromium | 200% | 81 | 9 | 4 |
| same | WebKit | 100% | 116 | 100 | 224 |
| same | WebKit | 200% | 81 | 10 | 5 |
| `scroll-padding-inline: 40px` (not derived; probing the limit) | Chromium | 100% | 53 | 2 | 119 |
| same | Chromium | 200% | 69 | 4 | 11 |
| same | WebKit | 100% | 28 | 23 | 235 |
| same | WebKit | 200% | 63 | 4 | 17 |
| `scroll-padding-inline: 80px` (not derived; probing the limit) | Chromium | 100% | 4 | 0 | 166 |
| same | Chromium | 200% | 64 | 8 | 20 |
| same | WebKit | 100% | 7 | 6 | 239 |
| same | WebKit | 200% | 56 | 7 | 27 |

What this shows:

- **No form reaches zero in either engine.** At 200% every form leaves 56 to 81 clipped stops, all of them sort buttons and species-name buttons that are wider than any padding.
- **The brief's derived value makes WebKit worse at 100%** (240 to 262 clipped, 151 newly clipped). End clips fall from 151 to 74, but start clips rise from 89 to 188.
- **`scroll-margin` repairs nothing in Chromium** (0 repaired at either scale: identical counts at 100%, 5 newly clipped at 200%) and only nudges WebKit.
- **Every form tried clips some stops that were whole before**, in at least one engine and scale, because each focus scroll sets up the next control's "already visible" decision along the Tab sequence. So no form is a strict improvement either.
- **The large paddings are no answer.** 80px gets 100% close in both engines, but it is not derived from anything and still leaves 56 to 64 clipped at 200%. It also parks every focus-scrolled control 80px from the edge. And it still creates new clips.

## Corrections for the record

ROADMAP's Targets residuals entry, item (2), says focus scrolls the wrapper "only far enough to show the link's start", that "at least 73% of the link always shows", and that about 19px of `scroll-padding-inline-end` "would likely fix it". All three are wrong:

- The engines do not scroll at all once part of a control shows. In Chromium that is any part, and in WebKit it is 32px or more.
- It is not only hotspot links. Sort buttons, species-name buttons and the eBird / Birds of the World marks clip too, at both edges. At 200%, only sort and name buttons clip.
- The overhang reaches 110.6px at 100% and 240.8px at 200%, not about 19px.
- 19px of end padding makes WebKit worse at the default text size.

The defect is real and keyboard-only. Part of the control always shows, so SC 2.4.11 (minimum) holds and ACCESSIBILITY.md stays true. The sideways scroll that causes it, item (1), stays as is (SC 1.4.10 exempts tables).

## What would meet the criterion, for the user's decision only

Only script controls the resting point. A `focusin` handler on the wrapper would do it: for keyboard focus only, it sets `scrollLeft` so the ringed box (control, glyph, and outline width plus offset) sits inside the client box. It must leave pointer focus and the engines' own vertical scroll alone. The brief reserves that ("Do not ... add a focus handler on your own"). It would be the only place the app overrides an engine's focus scroll, it would need its own real-engine gate, and the other four `.sr-scroll-x` tables have the same engine behavior. A design change that keeps the table from scrolling sideways at these widths would also remove it, but that is item (1) and outside this brief.

## Method notes

- **Isolation.** The backend copy had no `.env`, and `GET /settings/keys` answered `ebird: null` on its own. The key the app saw was a placeholder answered in the browser, and every eBird-backed route was stubbed, so no request left the machine. The data was a scratch copy of the gitignored demo dataset. The user's data, `backend/.env` and `backend/data/` were never read or written. The backend was stopped and its port confirmed free afterwards. Playwright processes from other sessions, nearly three days old, were left alone.
- **Run variance.** Three runs of the starting state agreed to within one stop per engine and scale (WebKit 200%: 77, 76, 76; every other engine and scale identical). The run that read 77 also read one 652.98px overhang where the other two read 200.72px at most.
- **Engines.** These are the browsers of Playwright 1.62.1, pinned in `website/tools` (Chromium 1234, WebKit 2336). The 32px rule is WebKit's shared reveal logic, so Safari and WKWebView are expected to match. That is inferred from the shared engine, not measured on a device. No device was touched.
- **Files.** `focus-scroll-probe.mjs` (the full real-app sweep, `--inject` for trials, `--keep-stops` for per-stop records) and `reveal-threshold-repro.mjs` (the mechanism, no app). Both resolve Playwright through `website/tools/verify/playwright.mjs`. The probe stays in this folder rather than joining `website/tools/verify/`, because it needs a backend and the gitignored demo dataset.
- **No source change.** `git status` shows only this folder. The built CSS is the HEAD build's (`index-kngkoBkd.css`), and no test, guard or stylesheet was edited.
