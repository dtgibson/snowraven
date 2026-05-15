# Schema — Dark Mode

## Path
Frontend Only — No data layer changes required

## Confirmation
Assessed against all 16 functional requirements and 5 non-functional requirements. No new tables, columns, relationships, migrations, or server-side storage of any kind. The only persistent storage introduced is a single `localStorage` key in the browser, requiring explicit user consent before it is written (FR-08 through FR-12).

---

## Browser Storage Contract

| Key | Values | Written when | Cleared when |
|-----|--------|-------------|--------------|
| `sr-theme` | `"light"` \| `"dark"` | User clicks "Save preference" in consent prompt | User selects System in Settings |

`localStorage` is never written without explicit user consent. System mode reads `prefers-color-scheme` only — no writes.

---

## TypeScript Types

```typescript
// Theme preference stored in localStorage / applied at runtime
type ThemePreference = 'light' | 'dark' | 'system'

// Effective theme applied to the UI (never 'system' — always resolved)
type AppliedTheme = 'light' | 'dark'

// Consent prompt state (local to the AppearanceRow component)
type ConsentState = 'idle' | 'pending'
// 'pending' = prompt is visible, waiting for user response
```

---

## `data-theme` Attribute Contract

The attribute is set on `document.documentElement` (`<html>`). CSS selectors respond to it:

```css
:root { /* light theme tokens */ }
[data-theme="dark"] { /* dark theme token overrides */ }
```

**Possible values:** `"light"` | `"dark"` (never absent — always set on load via FR-03 inline script)

---

## Inline Script (index.html) — Anti-Flash Pattern

Must be placed synchronously before the `<script type="module">` bundle in `index.html`:

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

The `try/catch` handles browsers with `localStorage` disabled (private browsing, restrictive settings).

---

## CSS Token System

All tokens defined in `globals.css`. `:root` holds light values; `[data-theme="dark"]` overrides them.

### Structural

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--sr-bg` | `#F9FAFB` | `#09090B` | Page background |
| `--sr-surface` | `#FFFFFF` | `#18181B` | Cards, panels, dropzones |
| `--sr-surface-subtle` | `#F4F4F5` | `#27272A` | Disabled buttons, code blocks, subtle fills |
| `--sr-surface-faint` | `#FAFAFA` | `#1C1C1F` | Table alternate rows, very subtle bg |

### Text

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--sr-text` | `#0F1117` | `#F4F4F5` | Primary text, labels, headings |
| `--sr-text-muted` | `#71717A` | `#A1A1AA` | Secondary text, tab labels, descriptions |
| `--sr-text-disabled` | `#A1A1AA` | `#52525B` | Placeholder text, disabled states |
| `--sr-text-footer` | `#B0B0B8` | `#52525B` | Footer text |
| `--sr-text-gray` | `#9CA3AF` | `#6B7280` | Tertiary text, counts in muted contexts |

### Border

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--sr-border` | `#E4E4E7` | `#27272A` | Card borders, input borders, dividers |
| `--sr-border-subtle` | `#F4F4F5` | `#1F1F23` | Row separators within a card |
| `--sr-border-medium` | `#C4C4CE` | `#3F3F46` | Stronger borders, active filter pill outlines |

### Accent (green)

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--sr-accent` | `#2D8653` | `#34D399` | Active tabs, icon fills, button text on white, links |
| `--sr-accent-bg` | `#E8F5EE` | `#052E16` | Green tint icon bg (set state), copy button bg |
| `--sr-accent-bg-hover` | `#F0FAF4` | `#064E3B` | Hover tint, very light green bg |
| `--sr-accent-border` | `rgba(45,134,83,0.25)` | `rgba(52,211,153,0.2)` | Green-bordered buttons |
| `--sr-accent-border-strong` | `rgba(45,134,83,0.7)` | `rgba(52,211,153,0.5)` | Active pill outlines |
| `--sr-accent-surface` | `#fafffd` | `#021a0f` | Very light green surface |

### Error (red)

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--sr-error` | `#DC2626` | `#F87171` | Error text, error icons |
| `--sr-error-bg` | `#FEF2F2` | `#1C0505` | Error message background |
| `--sr-error-border` | `#FECACA` | `#7F1D1D` | Error-state input borders, Clear button border |
| `--sr-error-muted` | `#FCA5A5` | `#B91C1C` | Softer error accents |
| `--sr-error-overlay` | `rgba(239,68,68,0.3)` | `rgba(248,113,113,0.2)` | Error overlay/tint |

### Warning (amber — version update state)

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--sr-warning` | `#92400E` | `#FDE68A` | "Update available" text |
| `--sr-warning-bg` | `#FFFBEB` | `#1C1002` | "Update available" background |
| `--sr-warning-subtle` | `#FDE68A` | `#78350F` | Warning accent |

### Breeding Code Tier Colours

The tier circles use a purple palette. In dark mode the darkest tiers need lightening to remain distinguishable from dark card backgrounds (white text on circle must contrast with both circle and card).

| Token | Light | Dark | Tier |
|-------|-------|------|------|
| `--sr-tier-4` | `#3B0764` | `#6B21A8` | Confirmed (darkest) |
| `--sr-tier-3` | `#6B21A8` | `#7C3AED` | Confirmed |
| `--sr-tier-2` | `#9333EA` | `#A855F7` | Probable |
| `--sr-tier-1` | `#C084FC` | `#C084FC` | Possible (unchanged) |

`TIER_COLORS` in `breedingCodes.ts` will be replaced with `var(--sr-tier-N)` references in `BreedingCodeTable.tsx`.

### Grays (misc)

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--sr-gray-300` | `#D1D5DB` | `#3F3F46` | Subtle separators, placeholder fills |
| `--sr-gray-400` | `#D4D4D8` | `#52525B` | Light borders in expanded states |

### Shadow

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--sr-card-shadow` | `0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)` | `0 1px 4px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.25)` | Weather card, dropzone shadows |

---

## Component → Token Mapping

| Component | Tokens used |
|-----------|-------------|
| `App.tsx` | `--sr-bg`, `--sr-surface`, `--sr-surface-subtle`, `--sr-text`, `--sr-text-muted`, `--sr-text-footer`, `--sr-border`, `--sr-border-subtle`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border`, `--sr-error`, `--sr-error-bg`, `--sr-warning`, `--sr-card-shadow` |
| `Settings.tsx` | `--sr-surface`, `--sr-surface-subtle`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled`, `--sr-border`, `--sr-border-subtle`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border`, `--sr-error`, `--sr-error-bg`, `--sr-error-border` |
| `BreedingCodeList.tsx` | `--sr-surface`, `--sr-surface-subtle`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled`, `--sr-border`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-bg-hover`, `--sr-accent-border`, `--sr-accent-border-strong` |
| `BreedingCodeTable.tsx` | `--sr-surface`, `--sr-surface-faint`, `--sr-text`, `--sr-text-muted`, `--sr-border`, `--sr-border-subtle`, `--sr-accent`, `--sr-tier-1` … `--sr-tier-4` |
| `LifeList.tsx` | `--sr-surface`, `--sr-surface-subtle`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled`, `--sr-border`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border`, `--sr-error`, `--sr-error-bg`, `--sr-error-border`, `--sr-warning`, `--sr-warning-bg` |
| `LifeListTable.tsx` | `--sr-surface`, `--sr-surface-faint`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled`, `--sr-border`, `--sr-border-subtle`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border`, `--sr-error-muted` |
| `ListComparer.tsx` | `--sr-surface`, `--sr-text`, `--sr-text-muted`, `--sr-border`, `--sr-accent`, `--sr-accent-bg`, `--sr-error`, `--sr-error-bg` |
| `ResultsView.tsx` | `--sr-surface`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled`, `--sr-border`, `--sr-surface-subtle`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-bg-hover`, `--sr-accent-border` |
| `SpeciesPanel.tsx` | `--sr-surface`, `--sr-text`, `--sr-text-muted`, `--sr-border`, `--sr-border-subtle`, `--sr-accent` |
| `DropZone.tsx` | `--sr-surface`, `--sr-surface-subtle`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled`, `--sr-border`, `--sr-border-medium`, `--sr-accent`, `--sr-accent-bg`, `--sr-accent-surface`, `--sr-error`, `--sr-error-bg`, `--sr-error-overlay` |

---

## New Component — AppearanceRow (in Settings.tsx)

A new sub-component added to the Settings tab, above the existing KeyRow and FileRow sections.

**Props:** none (reads/writes localStorage directly, applies theme to `document.documentElement`)

**Internal state:**
```typescript
const [preference, setPreference] = useState<ThemePreference>(() => {
  const stored = localStorage.getItem('sr-theme')
  return (stored === 'light' || stored === 'dark') ? stored : 'system'
})
const [consentState, setConsentState] = useState<ConsentState>('idle')
const [pendingPreference, setPendingPreference] = useState<ThemePreference | null>(null)
```

**Theme application helper** (shared utility, can live in `src/lib/theme.ts`):
```typescript
export function applyTheme(pref: ThemePreference): void {
  const effective: AppliedTheme =
    pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : pref
  document.documentElement.setAttribute('data-theme', effective)
}
```

---

## No Data Layer Work Required

The Engineer can proceed directly to implementation. No migrations, no new API endpoints, no backend files to touch.
