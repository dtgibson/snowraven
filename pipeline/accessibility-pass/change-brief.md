# Change Brief — accessibility-pass

**Lane:** Improve · **Stage 1 (The Evaluator)** · **Date:** 2026-06-12

## What this is

A comprehensive accessibility audit of the SnowRaven frontend (~23k lines, 47 components)
against WCAG 2.1 AA, with WCAG 2.2 deltas flagged as forward-looking polish. The user asked
for a full review with suggestions — and for credit where the app already passes.

## How it was done

Multi-agent audit in four phases, ~160 agents total:

1. **Inventory** — two scouts mapped every view/widget and the existing a11y infrastructure.
2. **Audit** — 12 parallel dimensions: keyboard, focus management, ARIA semantics,
   *computed* color contrast (WCAG luminance math over every `--sr-*` token pair actually
   used together, both themes), screen-reader content, forms, all map surfaces, motion,
   text resize/reflow, a line-by-line fact-check of the published `ACCESSIBILITY.md`,
   an **axe-core runtime scan** of the live app (all reachable tabs, light theme), and
   document structure.
3. **Adversarial verification** — every finding re-checked by an independent verifier
   instructed to refute it (contrast verifiers re-ran the math themselves). 7 findings
   were struck; nothing reached this brief unverified.
4. **Completeness** — a critic hunted for what the audit missed and dispatched 6 gap
   auditors (hover content, context-change/consistency criteria, timing, the desktop
   Tauri shell, runtime states, pointer gestures), whose findings were verified the same way.

## Headline

**The app does NOT currently pass WCAG 2.1 AA — but its accessibility foundation is real,
and most failures are shallow.** 107 confirmed findings: **1 critical, 17 serious,
48 moderate, 41 minor** — against **288 explicitly verified passes**. The deliberate
work (tab bar, species combobox, chart summaries, switch roles, text-size mechanism,
reduced motion, the Checklists tab) largely holds up; the failures cluster in surfaces
built before those patterns existed, plus a token-level contrast debt that one file fixes.

**The most important result is not a bug — it's the published statement.**
`ACCESSIBILITY.md` makes several claims the code contradicts (details below). A published
accessibility statement that's wrong is a liability in exactly the way a stale privacy
policy is. Whatever scope is chosen, the statement must end this lane true.

## What already passes (credit where due)

- **Main tab bar:** correct tablist/tab/tabpanel + roving tabindex + arrow keys (desktop mode).
- **Species combobox:** type-to-filter, ArrowUp/Down with scroll-into-view, Enter, expanded state — as claimed.
- **Charts:** every recharts chart carries `role="img"` with a concise text summary; decorative internals hidden.
- **ToggleSwitch:** proper `role="switch"` + `aria-checked`, Space and Enter both work.
- **Map Explorer sidebar keyboard alternative** for GL markers: real, labelled, viewport-scoped buttons (Sightings/Hotspots modes) — as claimed.
- **Checklists tab:** the in-house exemplar — labelled controls (`aria-label` on selects/dates), `role=group` + `aria-pressed` sort control, correct patterns throughout. Zero axe violations of the select/label class.
- **Text Size:** rem-based, reaches 200%, persisted through the storage seam.
- **Reduced motion:** honored across CSS animations and jump scrolls (one minor stray: four inline spinners).
- **Focus indicator:** designed green ring is well-implemented *where not suppressed* (see F-series for the suppressions).
- 288 itemized passes across all dimensions: `passes.json`, `structure-passes.json`, `gap-passes.json`.

## The published-statement problem (must fix regardless of scope)

Five `ACCESSIBILITY.md` claims are contradicted by the code today:

1. **"Escape closes [the filter panel] and returns focus to the button that opened it"** — the focus-restore is dead code (the ref's button isn't mounted while the panel is open); every mobile close path strands focus on `<body>` (F011).
2. **"Filter pills announce whether they are pressed"** — the shared `SegControl` (≈10 primary controls) exposes no pressed state at all (F008).
3. **"Nearest Targets list … scoped to the current map view, updates as you pan"** — it isn't and doesn't (F-moderate, claims).
4. **Keyboard reach: "nearly all … every button"** — Settings tab reorder is drag-only with a self-documented sr-only disclaimer (F013); Species Detail/Named Birds map pins have no keyboard path at all (F014).
5. **Contrast: "body text and primary interface colors meet AA"** — computed: real content text uses `--sr-text-disabled` at 2.3–2.6:1; breeding-code badges (cited in the statement as exemplary) reach 1.71:1; ~4 token-level causes produce 139 axe instances in light theme alone (F003–F005, F012, F017).

Each gets fixed in code where feasible; anything consciously deferred gets honestly disclosed in the statement instead.

## Remediation themes

| Theme | Findings | Shape of the work |
|---|---|---|
| **A. Unnamed controls** (the critical + worst serious cluster) | ~12 | Mechanical: copy the existing Checklists.tsx `aria-label` pattern to 6 selects + 6 date inputs across 4 tabs, kill placeholder-only labels. Low risk, high impact. |
| **B. Contrast token debt** | 18 | ~4 token-level causes in `globals.css` (both themes) + a handful of hardcoded colors (milestone chips, tier text, map chip text). Computed ratios provided per finding; fix at the token, verify with the same math. |
| **C. State & announcements (ARIA)** | ~20 | `aria-pressed` on SegControl, `aria-sort`→real button headers, silent error/status messages → `role=status`/`alert`, live-region fixes (one over-chatty, several missing), radio-group arrow keys. |
| **D. Focus management** | ~14 | Rebuild the mobile filter trap (re-query per keydown — HelpDocs already does it right), focus restore on every overlay close path, Escape on fullscreen map, stop stranding focus on unmount/blur, remove inline `outline:'none'` (~20 controls). |
| **E. Maps keyboard & SR access** | ~8 | Make DOM markers real buttons (verifier confirmed react-map-gl wiring makes this nearly free), popup Escape/close, atlas popup keyboard route, disable multipoint-only rotate/pitch or restore the compass. |
| **F. Resize & reflow** | ~8 | Help TOC collapse below ~700px, fixed-px text geometry in Statistics, comparer reflow at 320px, desktop zoom note. |
| **G. Structure & landmarks** | ~6 | `<nav>`/`<header>` landmarks (tablist currently eats the nav role), heading outline per view, skip link, per-view `document.title` (+ Tauri `setTitle`). |
| **H. WCAG 2.2 forward-looking + polish** | ~20 | Target sizes (favicons, map chrome), chart tooltip hoverability, consistent identification of the eBird-link affordance, hue-only chart series, misc minors. |

Full detail: `findings-appendix.md` (every confirmed finding with file:line, WCAG criterion,
evidence, fix, verifier notes, stable F-IDs; refuted findings listed for transparency).
Raw data: `verified-findings.json`, `structure-findings.json`, `gap-findings.json`.

## Proposed scope for this lane

**Recommended: fix all 107.** Most are small and pattern-based; the audit data gives the
Engineer file:line + a verified fix for each. Within that, sequence by severity:

1. **Package 1 — must:** the critical, all 17 serious, and every published-claim mismatch
   (themes A, most of B/C/D's serious entries, F013/F014). `ACCESSIBILITY.md` updated last,
   against what actually shipped.
2. **Package 2 — should:** the 48 moderates (rest of B–G).
3. **Package 3 — polish:** the 41 minors, including all WCAG 2.2 forward-looking items.

**Defer candidates** (chunky, lower value — drop only if the session needs trimming, and
then disclose in `ACCESSIBILITY.md` where user-visible): per-view heading restructure
beyond the main landmarks (part of G), chart tooltip hoverability (H, needs recharts
wrapper work), date-input unification on Map Explorer (H/consistency), keyboard
drag-reorder in Settings (the move up/down buttons are the cheap 80%).

## Lane fit (the feature check)

This stays an improvement: every fix makes an *existing* function operable, perceivable,
or honest — no new user-facing capability. The closest calls (skip link, Settings
move-up/down buttons, popup close buttons) are standard accessibility affordances of
existing functions, not features. `ACCESSIBILITY.md` and (if map providers/text change)
`docs/HELP.md`/`README.md` updates ride along per repo convention.

## Coverage caveats (honest limits)

- The axe runtime scan ran light-theme only and only states reachable without mutating
  stored data; dark theme was covered by *computed* contrast, not runtime axe.
- Several criteria were verified by code reading, not assistive-tech testing; a real
  VoiceOver/NVDA pass on the shipped app would still be worthwhile after remediation.
- Coverage notes per auditor: `coverage-notes.json`.
