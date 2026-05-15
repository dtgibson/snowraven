# Design Spec — Dark Mode
**Feature:** dark-mode
**Session:** 001
**Stage:** 4 — The Designer
**Date:** 2026-05-15
**Source:** prd.md, schema.md (approved)

---

## Visual Direction

Zinc-based dark palette. The dark theme follows the zinc scale from Tailwind — a near-neutral that reads as dark without being a flat black. The accent colour shifts from forest green (`#2D8653`) to emerald (`#34D399`) for better contrast on dark surfaces. The overall character: calm, legible, professional — the same app, just at night.

---

## Colour Palette

### Backgrounds

| Role | Light | Dark |
|------|-------|------|
| Page background | `#F9FAFB` (gray-50) | `#09090B` (zinc-950) |
| Card / surface | `#FFFFFF` | `#18181B` (zinc-900) |
| Subtle fill | `#F4F4F5` (zinc-100) | `#27272A` (zinc-800) |
| Faint fill | `#FAFAFA` | `#1C1C1F` |

### Text

| Role | Light | Dark |
|------|-------|------|
| Primary | `#0F1117` | `#F4F4F5` |
| Muted / secondary | `#71717A` | `#A1A1AA` |
| Disabled / placeholder | `#A1A1AA` | `#52525B` |
| Footer | `#B0B0B8` | `#52525B` |
| Tertiary / counts | `#9CA3AF` | `#6B7280` |

### Borders

| Role | Light | Dark |
|------|-------|------|
| Standard | `#E4E4E7` | `#27272A` |
| Subtle (row dividers) | `#F4F4F5` | `#1F1F23` |
| Medium (active pills) | `#C4C4CE` | `#3F3F46` |

### Accent (green)

| Role | Light | Dark |
|------|-------|------|
| Primary accent | `#2D8653` | `#34D399` |
| Accent bg | `#E8F5EE` | `#052E16` |
| Accent bg hover | `#F0FAF4` | `#064E3B` |
| Accent border | `rgba(45,134,83,0.25)` | `rgba(52,211,153,0.2)` |
| Accent border strong | `rgba(45,134,83,0.7)` | `rgba(52,211,153,0.5)` |
| Accent surface | `#fafffd` | `#021a0f` |

### State colours

**Error:**
| Role | Light | Dark |
|------|-------|------|
| Error text | `#DC2626` | `#F87171` |
| Error bg | `#FEF2F2` | `#1C0505` |
| Error border | `#FECACA` | `#7F1D1D` |
| Error muted | `#FCA5A5` | `#B91C1C` |
| Error overlay | `rgba(239,68,68,0.3)` | `rgba(248,113,113,0.2)` |

**Warning (update available):**
| Role | Light | Dark |
|------|-------|------|
| Warning text | `#92400E` | `#FDE68A` |
| Warning bg | `#FFFBEB` | `#1C1002` |
| Warning subtle | `#FDE68A` | `#78350F` |

### Breeding code tiers

| Tier | Light | Dark | Notes |
|------|-------|------|-------|
| 4 — Confirmed (darkest) | `#3B0764` | `#6B21A8` | Lightened — too close to zinc-900 surface otherwise |
| 3 — Confirmed | `#6B21A8` | `#7C3AED` | Slightly lightened |
| 2 — Probable | `#9333EA` | `#A855F7` | Slightly lightened |
| 1 — Possible | `#C084FC` | `#C084FC` | Unchanged — reads well in both |

### Misc / shadow

| Role | Light | Dark |
|------|-------|------|
| Card shadow | `0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)` | `0 1px 4px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.25)` |
| Gray-300 | `#D1D5DB` | `#3F3F46` |
| Gray-400 | `#D4D4D8` | `#52525B` |

---

## Settings Tab — Appearance Section

The Appearance section sits above the existing API Keys section. It uses the same row/card pattern as the rest of Settings.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Appearance                                           │
│                                                      │
│ Colour scheme                                        │
│ [  System  ] [  Light  ] [  Dark  ]                 │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ⓘ Your preference will be saved in this         │ │
│ │   browser's local storage — on this device only. │ │
│ │   Nothing is sent to the server.                 │ │
│ │                                                  │ │
│ │  [ Save preference ]  [ This session only ]      │ │
│ └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Toggle design

Three-button segmented control, full-width within its column.

- **Inactive button:** `--sr-surface-subtle` bg, `--sr-text-muted` label, no border
- **Active button:** `--sr-accent-bg` bg, `--sr-accent` label, `--sr-accent-border` ring
- Border radius matches the existing button style in the app (4px)
- Buttons are equal width, horizontally distributed

### Consent prompt

Appears inline below the toggle when user selects Light or Dark and no localStorage value exists. Dismisses (without animation) on "Save preference", "This session only", or if the user selects a different option.

- Container: `--sr-accent-surface` bg, `--sr-accent-border` border, 6px radius
- ⓘ icon: `--sr-accent` colour
- Body text: `--sr-text-muted`, 14px
- **Save preference** button: solid `--sr-accent-bg` with `--sr-accent` text and `--sr-accent-border` ring
- **This session only** button: no background, `--sr-text-muted` text, subtle border

---

## Theme Toggle Behaviour

| State | Action | Result |
|-------|--------|--------|
| System (default) | Load | Reads OS preference, sets data-theme, no localStorage |
| System selected | Click | Removes `sr-theme` from localStorage if present, applies OS preference |
| Light/Dark selected, no stored pref | Click | Applies theme immediately, shows consent prompt |
| Light/Dark selected, stored pref exists | Click | Applies theme, writes localStorage silently, no prompt |
| "Save preference" clicked | Click | Writes localStorage, dismisses prompt |
| "This session only" clicked | Click | Dismisses prompt, no localStorage write |
| Different option while prompt visible | Click | Dismisses prompt, runs that option's normal flow |

---

## Component Theming

All 10 components replace hardcoded hex values with `var(--sr-*)` tokens. No new components are introduced beyond `AppearanceRow` in Settings.

All colours in `globals.css` — `:root` holds light values; `[data-theme="dark"]` overrides them. No inline colour values remain in component files after implementation.

---

## Anti-Flash Script

Placed synchronously in `index.html` before the `<script type="module">` bundle:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem('sr-theme');
      if (stored === 'light' || stored === 'dark') {
        document.documentElement.setAttribute('data-theme', stored);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
</script>
```

`data-theme` is always set before first paint. The try/catch handles private browsing mode.

---

## Theme Utility

`src/lib/theme.ts` — shared helper, imported by `AppearanceRow`:

```typescript
export function applyTheme(pref: 'light' | 'dark' | 'system'): void {
  const effective =
    pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : pref
  document.documentElement.setAttribute('data-theme', effective)
}
```

---

## File Targets

| File | Change |
|------|--------|
| `frontend/index.html` | Add anti-flash inline script |
| `frontend/src/globals.css` | Add all `--sr-*` token definitions (`:root` + `[data-theme="dark"]`) |
| `frontend/src/lib/theme.ts` | New file — `applyTheme` utility |
| `frontend/src/Settings.tsx` | Add `AppearanceRow` component above API Keys section |
| `frontend/src/App.tsx` | Replace all hardcoded colours with `var(--sr-*)` |
| `frontend/src/BreedingCodeList.tsx` | Replace all hardcoded colours |
| `frontend/src/BreedingCodeTable.tsx` | Replace `TIER_COLORS` constants with `var(--sr-tier-N)` |
| `frontend/src/LifeList.tsx` | Replace all hardcoded colours |
| `frontend/src/LifeListTable.tsx` | Replace all hardcoded colours |
| `frontend/src/ListComparer.tsx` | Replace all hardcoded colours |
| `frontend/src/ResultsView.tsx` | Replace all hardcoded colours |
| `frontend/src/SpeciesPanel.tsx` | Replace all hardcoded colours |
| `frontend/src/DropZone.tsx` | Replace all hardcoded colours |
