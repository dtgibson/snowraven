# Comprehensive app audit — findings & proposals

Improve lane · understand stage. Five parallel read-only reviews (UX, IA/consistency,
accessibility, performance, code-health), synthesized + deduped. No code changed.

## Overall verdict
The codebase is **fundamentally healthy** — the platform seams (transport/storage/
platform/clipboard) are clean, typing is strict (zero `any`/`@ts-ignore`), the
`tabIndex={0}` convention is 100% applied, `<BirdName>` is used consistently, and the
`lib/` layer is well-tested. So this is **refinement, not rescue.** The real
opportunities cluster in: a few **dark-mode/contrast bugs**, **onboarding & naming**,
a big **lightweight/perf** win (lazy-loading), and **consistency/duplication** cleanup.

Tags: [A11y] [UX] [IA] [Perf] [Code]. Effort: S / M / L.

---

## Tier 1 — Quick wins (high value, low effort)

1. **Dark-mode contrast bugs** [A11y][Code] S — Dark primary buttons are white on
   `#34D399` = **1.92:1** (fails AA badly) across ~11 CTAs; **map popups don't adapt
   to dark mode** (hardcoded light grays `#71717A`/`#0F1117`/… + un-themed MapLibre
   popup chrome) — a real visual bug; muted/footer/sci-name tokens (`--sr-text-gray`
   2.5:1, `--sr-text-footer` 2.1:1) fail AA. Fix the tokens + theme `.maplibregl-popup`.
2. **Cheap a11y wins** [A11y] S — favicon links (`SpeciesLinks`) have **no accessible
   name** (screen readers hear the raw URL twice after every bird name app-wide) → add
   `aria-label`; make **sortable table headers keyboard-operable** (bare `<th onClick>`);
   add a global **`prefers-reduced-motion`** rule.
3. **Make ACCESSIBILITY.md honest** [A11y] S — published claims overstate reality
   (keyboard-operable "everything" vs pointer-only map markers + un-sortable-by-keyboard
   headers; "4.5:1 contrast" vs #1; "larger text settings" — fonts are all px, and the
   desktop webview has no zoom UI). Tighten the wording (a stale published a11y statement
   is a liability).
4. **Onboarding quick wins** [UX] S — add a persistent **Help** affordance (today the
   docs are reachable from exactly one button inside Settings); add **inline key-entry
   guidance** (eBird keygen link + the OpenWeather "One Call by Call" gotcha — currently
   invisible at point of need); give the **Statistics error state a recovery action**
   (it's the one data tab with no "Go to Settings"); remove the hardcoded perma-**"NEW"**
   badge.
5. **Naming + Stats nav** [IA][UX] S — settle the **"life list" confusion** (the tab
   labeled "Media List" *is* the life list; component is `LifeList`, empty state says
   "Media Life List"; separate "Life List Comparer" + "Life List Totals" exist → pick one
   name, use everywhere); settle the **Nemesis triple-name** ("Nemesis Birds" / "Top Local
   Target Species" / "Top Local Targets" on one screen); **Stats jump-nav omits 2 of 11
   sections**; Settings "Default Files" sublabels are wrong ("Used by Breeding Codes" — it
   powers 5 tabs).

## Tier 2 — Big bets (high value, medium effort)

6. **Lazy-load the heavy tabs** [Perf] M — **the lightweight win.** All 8 tab panels mount
   eagerly, so maplibre-gl (270 KB gz) + recharts (112 KB gz) load on first paint even for
   users who never open a map/chart — **~382 KB gz (73% of JS)**. `React.lazy` + conditional
   mount the 3 heavy tabs → first-paint JS ~525 KB → **~170 KB gz**, and it kills the **3×
   redundant 20k-row CSV parse on startup**. Back it with a **shared parsed-observations
   cache** (6 components currently re-read+re-parse the CSV independently). Also drop the
   dead `leaflet` rule in `vite.config.ts`.
7. **Centralize the setup flow & copy** [UX] M — 5 tabs hand-roll their own setup steps that
   disagree (one mentions a ZIP that doesn't exist; the Media List omits the critical ML
   "set filter to All" step); first-run lands on **Weather** (the only 2-key, paid-plan tab)
   with no welcome. Centralize the eBird/ML setup copy, deep-link "Go to Settings," and add a
   first-run welcome / better default tab.
8. **Extract shared UI primitives** [IA][Code] M — the same controls are copy-pasted across
   tabs (county+date filters, sort toggle, wide-mode toggle, segmented controls, `ToggleSwitch`,
   `SectionCard`, the `Stat*` family, the `HeatmapLayer` wrapper) with visual + behavioral
   drift; `fmtDate` is reimplemented **5×** with divergent formats/edge-cases; the `ui/` folder
   is empty. Extract into `components/ui/` + `lib/` → consistency + less drift + testability.

## Tier 3 — Larger / ongoing investments

9. **Split the oversized components** [Code] M–L — BirdingStats (2,556), SpeciesDetail (1,951),
   MapExplorer (1,895). BirdingStats splits cleanly: ~650 lines of `useMemo` derivations →
   a `useBirdingStats` hook / `lib/birdingStats.ts` (also makes them unit-testable, currently
   untested), and each `<SectionCard>` → its own file. Reduce inline-style sprawl (328 inline
   styles in BirdingStats) via the Tier-2 primitives.
10. **Map Explorer UX depth** [UX][IA] M — densest tab; add per-mode intro/help, make the
    fetch model consistent (auto-fetch vs the manual "Find" button is ambiguous), label the
    **California-only** atlas overlay as such, and unify **"Media Targets" (map) ↔ "Is Target"
    (Media List)** with shared vocabulary + cross-links (same job, two tabs, no link today).
11. **Deeper perf + a11y + tests** [Perf][A11y][Code] mixed — move CSV parsing to a **Web
    Worker** (UI stays responsive on big files / Pi); `React.memo` `BirdName` + stabilize the
    per-row `codeFor`/`hasEntryFor` lookups; charts need a **text alternative** (no `role="img"`/
    summary today); map markers keyboard-operability (or accept the sidebar-list fallback);
    px→rem or an in-app **text-size setting**; grow **component test coverage** (1 test for 19
    components).

## Recommended sequencing
**Tier 1 ships as one small patch** (mostly S, high user impact — fixes real dark-mode bugs +
honest a11y + onboarding friction + naming). **Tier 2 #6 (lazy-load)** is the single
highest-leverage change for the "lightweight" goal and is self-contained. Tier 2 #8 (shared
primitives) is the foundation that makes Tier 3 #9 (splits) and future consistency cheap. Tier 3
is ongoing polish to pick at over time.
