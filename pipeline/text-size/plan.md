# Responsive text size (px → rem) + in-app control — plan

Improve lane. Deferred from the Tier 3 batch (v0.5.12) as its own focused effort.

## Goal
1. An **in-app Text Size** setting that enlarges the whole interface's text.
2. Text that **respects the user's system / browser text size** automatically.

(2) is the reason this is px→rem and not a CSS-`zoom` shortcut: there is no JS API
that reads the OS text size — the platform delivers it through the **root font size**,
which only flows into text expressed in **relative units (rem)**. This is also the
foundation that lets the future **mobile** app honor iOS Dynamic Type / Android font
scale with the same codebase.

## Scope (measured)
- **476 inline `fontSize`** across 21 components — **469 are plain literals**
  (`fontSize: 13`), ~7 are computed (ternary/var/`inherit`).
- **9 `font-size`** in `globals.css` (incl. `body` base + the BirdName scale).
- **148 fixed `height: <px>`** elements — the overflow-audit surface (text-bearing
  ones can clip when scaled up).

## Approach
**Mechanism (root scaling, system-aware):**
- `html { font-size: calc(100% * var(--sr-text-scale, 1)); }`
  - `100%` ⇒ inherits the browser/OS default text size (the system-respect win).
  - `--sr-text-scale` ⇒ the in-app multiplier (default 1).
- 1rem = the (scaled) root size; all text in rem scales with both inputs together.

**Conversion:**
- A one-off codemod converts literal `fontSize: N` → rem (base 16). Decision pending:
  literal `'0.8125rem'` (zero-dep) vs a `rem(13)` helper (self-documenting). Lean helper.
- Hand-convert the ~7 computed inline values + the 9 CSS values.

**In-app control:**
- Settings → Appearance, beside Theme. Persisted via the storage seam (desktop-durable)
  with an anti-flash root-var application on load (mirrors the theme pattern).

**Overflow audit (the careful part):**
- Walk the 148 fixed-height text containers; where text would clip at max scale,
  switch `height` → `min-height` (or let content size it). Cap the max scale to bound risk.

## Phases
- **P1 — Infra + proof:** add the root scale var + Settings control + persistence;
  convert 1–2 components; verify scaling end-to-end AND that system/browser text-size
  changes flow through. ← verify with Dave before the mass edit.
- **P2 — Bulk convert:** codemod the 469 literals + manual (computed + CSS), tab by tab.
- **P3 — Audit + QA + docs:** fix overflow at max scale across all 8 tabs at each level;
  update ACCESSIBILITY.md (drop the "roadmap" caveat — it's real now). Ship.

## Decisions — LOCKED (2026-06-05)
1. **Scale levels** — 4 steps: **100% / 125% / 150% / 200%** (`--sr-text-scale` =
   1.0 / 1.25 / 1.5 / 2.0). Chosen to meet **WCAG 2.1 SC 1.4.4 Resize Text (AA)** — text
   usable to 200%. Overflow audit runs at 2×; data tables + maps may scroll (allowed by
   SC 1.4.10 Reflow's exemption for tables/maps/toolbars).
2. **Respect system/browser default** — YES. `html { font-size: calc(100% * var(--sr-text-scale, 1)) }`.
3. **Placement** — Settings → Appearance, beside Theme.
4. **Version at ship** — TBD (patch 0.5.13 vs minor 0.6.0).

## Relevant standards (informed the above)
- **SC 1.4.4 Resize Text (AA):** text resizable to 200% without loss of content/functionality. ← the benchmark.
- **SC 1.4.10 Reflow (AA):** reflow at high zoom; *exempts* data tables, maps, toolbars (may scroll).
- **SC 1.4.12 Text Spacing (AA):** no clipping when spacing grows ← our height→min-height audit.
- Technique: relative units + respect user default + flexible containers + never block zoom (= this plan).

## Risks
- Overflow/clipping at large scale in fixed-size containers (mitigated by the audit + max cap).
- Maps: rem affects only text; the MapLibre canvas is unaffected (this is why px→rem is
  safe for maps, unlike CSS zoom). Map *control* text in rem is fine.
- All-or-nothing: text must be ~fully converted before shipping, or scaling looks
  inconsistent (some text grows, some doesn't).
