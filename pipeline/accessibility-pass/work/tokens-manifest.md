# Tokens manifest — accessibility-pass wave 1

File changed: `frontend/src/globals.css` (only). All ratios below are WCAG 2.x
relative-luminance contrast, computed by script against the **edited** file
(`/tmp/verify-globals.mjs`, 128 checks, all passing). Targets: 4.5:1 normal
text, 3:1 large text / non-text UI. Every token exists in BOTH `:root` and
`[data-theme="dark"]` (parity machine-checked).

Tint compositing: `rgba(R,G,B, a)` blended over the named surface before
measuring.

---

## 1. Retuned token values

### `--sr-accent` (F017a, F059)
| Theme | Old | New |
|---|---|---|
| light | `#2D8653` | **`#277448`** |
| dark | `#34D399` | unchanged |

Light ratios (text): on surface `#FFFFFF` 5.71, bg `#F9FAFB` 5.46,
surface-subtle `#F4F4F5` 5.19, surface-faint `#FAFAFA` 5.47, accent-bg
`#E8F5EE` 5.09, accent-bg-hover `#F0FAF4` 5.35, quote-bg 5.04. White
(`--sr-on-accent`) on it: 5.71. Old value failed everywhere but pure white
(4.03–4.33). Every `color: var(--sr-accent)` site (active tab labels, selected
segmented/sort buttons, links, ghost buttons, count badges) now passes with no
component change. `--sr-accent-border` / `--sr-accent-border-strong` triplets
updated `45,134,83` → `39,116,72` to stay the same hue (borders only — the
ListComparer "Loaded from Settings" *text* use of accent-border-strong still
fails ~2.9:1 composited and needs its component swap, F017).

### `--sr-text-muted` (F017b, F043)
| Theme | Old | New |
|---|---|---|
| light | `#71717A` | **`#6B6B74`** |
| dark | `#A1A1AA` | unchanged (5.27–7.76 everywhere) |

Light ratios: surface 5.28, bg 5.05, surface-subtle 4.80 (was 4.40), quote-bg
4.66 (was 4.27), accent-bg 4.70 (was 4.31), surface-faint 5.05.
**Note for F012/F005 owners:** muted now passes on `--sr-surface-subtle`, so
the Settings "No file saved"/"No key saved" chips can use plain
`var(--sr-text-muted)` — no new "faint text" token needed.

### `--sr-error` (F077)
| Theme | Old | New |
|---|---|---|
| light | `#DC2626` | **`#D31F1F`** |
| dark | `#F87171` | unchanged (7.07 on error-bg) |

Light: 4.82 on `--sr-error-bg` (was 4.41), 5.27 on surface, 5.04 on bg.
**`--sr-error-text` was NOT minted** — the single retune fixes every
error-on-error-bg site listed in F077; use `var(--sr-error)` as before.

### `--sr-graph-audio` (F072, F032d, F017d)
| Theme | Old | New |
|---|---|---|
| light | `#F59E0B` | **`#B45309`** (matches light `--sr-age-immature`) |
| dark | `#FCD34D` | unchanged (12.29 line vs surface) |

Light: line vs surface 5.02 (was 2.15); a white in-bar label on it is now 5.02
(was 2.15). Dark in-bar labels on audio/photo/slate/blue fills still need the
F032 component fix (adaptive label color or label-outside) — I did NOT retune
`--sr-graph-photo`/`--sr-graph-video`/`--sr-chart-*` (line hues, not blessed by
the verifier; see F072 fixNote's blast-radius warning).

### `--sr-gray-400` (F063 — resolves it fully; sole consumer is ToggleSwitch.tsx:27)
| Theme | Old | New |
|---|---|---|
| light | `#D4D4D8` | **`#8E8E96`** |
| dark | `#52525B` | **`#6E6E78`** |

Light: vs surface 3.25, vs the white knob 3.25 (was 1.48 both). Dark: vs
surface 3.51, vs knob 5.04 (was 2.29). **`--sr-toggle-off-track` was NOT
minted** — no component change is required; ToggleSwitch's off track now
passes as-is. Don't reuse gray-400 for anything expecting a pale gray.

---

## 2. New tokens

### Form controls — `--sr-border-input` (F104; maps-shared primary)
light **`#8A8A91`** (vs surface 3.43, bg 3.28, surface-subtle 3.12);
dark **`#707078`** (3.61 / 4.05 / 3.03). Use for text inputs, selects, date
inputs, unselected pills where the border is the only boundary cue
(replaces `var(--sr-border)` on form controls only — table/card borders stay).

### Tier text ON solid fills (F004) — pair with the same-theme `--sr-tier-N`
| Token | Light | ratio | Dark | ratio |
|---|---|---|---|---|
| `--sr-tier-1-text` (existing) | `#3B0764` | 5.68 | `#1A0030` | 7.31 |
| `--sr-tier-2-text` (new) | `#FFFFFF` | 5.38 | **`#1A0030`** | 4.88 (white was 3.96) |
| `--sr-tier-3-text` (new) | `#FFFFFF` | 8.72 | `#FFFFFF` | 5.70 |
| `--sr-tier-4-text` (new) | `#FFFFFF` | 15.00 | `#FFFFFF` | 8.72 |

For the `TIER_TEXT_COLORS` map (lib/breedingCodes.ts), ChecklistComparer
BreedingBadge, BreedingCodeTable.tsx:219 badge circle, SpeciesDetail tier pill.

### Tier-colored text ON the 8–15% tier tints (F003) — `--sr-tier-N-fg`
For active pills styled `background: rgba(var(--sr-tier-N-rgb), 0.08–0.15)`
over a card surface; verified at 0.15 (worst case) over the theme surface, and
in dark also at 0.08 and on the cross-case tier-1 tint (the F003 dark
tier-2-on-tier-1 failure):

| Token | Light | on own tint / plain surface | Dark | on own tint / cross tier-1 tint / plain |
|---|---|---|---|---|
| `--sr-tier-1-fg` | **`#7C3AED`** | 4.99 / 5.70 | **`#C084FC`** (= tier-1) | 5.28 / 5.28 / 6.70 |
| `--sr-tier-2-fg` | **`#8429D8`** | 5.10 / 6.38 | **`#BD80FA`** | 5.46 / 5.07 / 6.44 |
| `--sr-tier-3-fg` | **`#6B21A8`** (= tier-3) | 6.71 / 8.72 | **`#A78BFA`** | 5.82 / 5.13 / 6.51 |
| `--sr-tier-4-fg` | **`#3B0764`** (= tier-4) | 10.99 / 15.00 | **`#C795F5`** | 7.17 / 6.01 / 7.63 |

Swap pill `color: var(--sr-tier-N)` → `var(--sr-tier-N-fg)` in
BreedingCodeList code/category pills, SpeciesDetail.tsx:786-788,
BirdingStats.tsx:1637-1638 filter pills, and the BirdingStats:1613 tier-1
"Possible" stat (light `#7C3AED` on white = 5.70). Keep `--sr-tier-N` for
fills/swatches/atlas — the fill palette is untouched (atlas/hatch parity safe).
Assumption: pills sit on the card surface; if one ever sits on
surface-subtle, re-verify (light tier-2-fg is 4.67 over a subtle-based tint —
still passes).

### Map target chip text (F018) — pair with same-theme `--sr-map-target-*` fill
| Token | Light | ratio | Dark | ratio |
|---|---|---|---|---|
| `--sr-map-target-fresh-text` (new) | `#FFFFFF` | 4.52 on `#2D8653` | **`#052E16`** | 7.75 on `#34D399` |
| `--sr-map-target-mid-text` (new) | **`#052E16`** | 4.82 on `#5EA07C` (white was 3.09) | **`#052E16`** | 9.78 on `#6EE7B7` |
| `--sr-map-target-old-text` (existing) | `#1A5C38` | 4.86 | `#0D3321` | 10.83 |

`tierColors()` in lib/mapExplorerFormat.ts should return
`var(--sr-map-target-<tier>-text)` instead of the literal `'white'`
(mirroring the existing old-tier pattern).

### Basemap-anchored GL pin tokens (F066) — SAME values in both themes
The Positron basemap stays light in dark mode (land ≈ `#F2F0EB`), so these are
deliberately theme-invariant. For GL circle layers and baked sprites ONLY;
keep `--sr-map-*` for sidebar legend/list dots on app surfaces.

| Token | Value (both themes) | vs land | white glyph on it |
|---|---|---|---|
| `--sr-map-pin-visited` | `#2D8653` | 3.97 | 4.52 |
| `--sr-map-pin-unvisited` | `#5B7FA6` | 3.66 | 4.17 |
| `--sr-map-pin-personal` | **`#B0701B`** (darkened from `#C9842A` = 2.70) | 3.56 | 4.05 |
| `--sr-map-pin-target` | `#7C3AED` | 5.00 | 5.70 |
| `--sr-map-pin-stroke` | `#3F3F46` | 9.17 | — (replaces the hardcoded white stroke at SightingMarkers.tsx:160 / mapPins.ts:133) |

Wiring (maps-shared, F066): read these via the existing `useCssToken` /
runtime-token pattern in SightingMarkers.tsx, lib/mapPins.ts, HotspotMarkers
sprites; values are theme-invariant so the data-theme MutationObserver refresh
keeps working unchanged.

### Milestone chip palette (F031) — SAME values in both themes (light tinted chips by design)
`--sr-milestone-N-{bg,border,num,date,check}` for N = 1–4. `-bg` tokens hold
the full `linear-gradient(160deg, …)` string; ratios measured on the darker
gradient stop (worst case):

| N | bg stops | border | num (ratio) | date (ratio) | check (white ✓ on it) |
|---|---|---|---|---|---|
| 1 | `#F2FAF5`,`#E8F5EE` | `rgba(45,134,83,0.28)` | `#2D8653` (4.03 — 20px bold, large-text ≥3 OK) | **`#43755C`** darkened from `#5EA07C`=2.76 → 4.76 | `#2D8653` (4.52) |
| 2 | `#E5F3EC`,`#D8EDE4` | `rgba(28,100,60,0.32)` | `#1C6443` (5.81) | **`#386E4E`** darkened from `#3E7A56`=4.16 → 4.89 | `#2D8653` (4.52) |
| 3 | `#D6EAE0`,`#C6E2D5` | `rgba(18,74,44,0.38)` | `#14502E` (6.88) | `#2D6644` (4.92) | `#2D8653` (4.52) |
| 4 | `#FEFAEC`,`#FEF3C7` | `rgba(146,64,14,0.32)` | `#92400E` (6.37) | `#B45309` (4.51) | `#B45309` (5.02) |

Stats agent: replace the hardcoded `ts` object at BirdingStats.tsx:671-677 with
`var(--sr-milestone-${tier}-*)`. Only the two failing dates changed; all other
values are the originals, tokenized.

### Statistics rank pins (F100 + F031's RankIcon) — SAME values in both themes
- `--sr-rank-pin-circle: #277448` — white 10px/700 numeral 5.71; 5.01 vs land
  tiles (replaces hardcoded `#2D8653`, which passed at 4.52 but with no margin).
- `--sr-rank-pin-square: #1D4ED8` — white numeral 6.70 (replaces hardcoded
  `#3B82F6` = 3.68 FAIL); 5.88 vs land.

For statsPrimitives.tsx RankIcon fills AND the legend swatches at
BirdingStats.tsx:888/892. This is the one token pair serving both F031's
"`--sr-rank-square`" suggestion and F100 — do not mint a second name.

---

## 3. CSS rules added/changed in globals.css (non-token, for wave-2 wiring)

- **F103 (fixed here, complete):** removed `outline: none` from
  `.sr-birdname-link:hover, .sr-birdname-link:focus-visible` — the global 3px
  `button:focus-visible` ring now shows on keyboard focus for every bird-name
  link. No component change needed.
- **F069 (skip link):** `.sr-skip-link` rule added — fixed top-left,
  `z-index: 1300` (above the 1200 overlays), `var(--sr-accent)` bg +
  `var(--sr-on-accent)` text (5.71 light / 7.75 dark), hidden at `top: -100px`
  until `:focus`. App-shell agent: add
  `<a href="#sr-main" className="sr-skip-link">Skip to main content</a>` as the
  first child and give `<main>` `id="sr-main"` + `tabIndex={-1}`.
- **F006 (help reflow):** in the existing `@media (max-width: 640px)` block:
  `.sr-help-row { flex-direction: column !important; gap: 0 !important; }` and
  `.sr-help-toc { width: 100% !important; position: static !important;
  max-height: none !important; }`. Settings-help agent: put
  `className="sr-help-row"` on the HelpDocs body row and `"sr-help-toc"` on the
  TOC nav (the !importants are needed to beat the inline styles).
- **F028 (map text scaling):** `.maplibregl-popup-content` now sets
  `font-size: 0.8125rem; font-family: var(--font-sans)`;
  `.maplibregl-popup-close-button` gets `font-size: 1rem; padding: 2px 8px`
  (also the 2.5.8 target-size nudge — keep the AtlasLayer close button, per the
  verifier do NOT pass `closeButton={false}`); new
  `.maplibregl-ctrl-attrib { font-size: 0.6875rem; }`. Remaining component
  part: explicit rem fontSize on the AtlasLayer block-name divs.
- **F052 (comparer reflow):** `.sr-compare-panels` — `display: grid;
  grid-template-columns: repeat(3, 1fr); gap: 12px` (matches the current inline
  gap), collapsing to `1fr` under 640px. Checklists-comparers agent: replace
  ResultsView.tsx:127-131's inline grid with `className="sr-compare-panels"`;
  the ChecklistComparer 1fr-1fr grid can reuse `.sr-two-col`.

## 4. Deliberate non-changes (don't re-litigate)

- `--sr-text-disabled` unchanged in both themes — it is now documented (inline
  comment) as for disabled CONTROLS only (WCAG-exempt). All informative-text
  uses must swap to `--sr-text-muted` (component-side: F012/F005/F017c).
- `--sr-tier-N` fills and `--sr-tier-N-rgb` untouched (atlas overlay, hatch
  sprites, legend parity — F072 fixNote blast-radius warning).
- `--sr-chart-blue-light`, `--sr-graph-photo`, `--sr-graph-video`,
  `--sr-chart-slate` untouched — in-bar label fixes are component-side (F032).
- `--sr-map-*` (visited/unvisited/personal/target + target tier fills)
  untouched — sidebar dots on app surfaces still want theme-adaptive values;
  the map itself uses the new `--sr-map-pin-*`.
- `--sr-error-muted` untouched — DropZone swaps to `--sr-error` (F037).
- F094 (attribution overlap) left to maps-shared — the AttributionControl
  bottom-left route needs no globals.css change.
- Focus-ring/glow rgba literals (12% alpha shadows) left at the old accent RGB
  — decorative, sub-threshold by design.

## 5. Verification

- `node /tmp/verify-globals.mjs` — parses the edited globals.css, 128
  pair checks across both themes + token parity: ALL PASS.
- `cd frontend && npx vitest run src/lib` — 43 files / 692 tests pass.
- `cd frontend && npx vitest run src/components` — 12 files / 82 tests pass.
