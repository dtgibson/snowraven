# Design Spec — Settings-First File Model
**Feature:** settings-primary-files
**Session:** 001
**Date:** 2026-05-22
**Source:** design.html (approved)

---

## Visual Direction

Consistent with the established SnowRaven brand — clean, purposeful, no clutter. The new guidance states (SetupRequired cards, API key notices) use the same card aesthetic and muted tone as the rest of the app; the primary green accent is reserved for the "Go to Settings" call-to-action. The ML filename warning uses amber/orange to signal guidance rather than failure — these are orientation states, not errors.

---

## Screens / Views

### SetupRequired Card (shared component)

Used by Breeding Codes, Media Life List, and Species Detail when no stored file is found.

**Layout:** Centered column, generous vertical padding (52px top, 48px bottom). Icon ring → title → body text → instruction box → CTA button.

**Components:**
- 64px circular icon ring with muted background and border; `upload-cloud` Lucide icon inside (muted-fg color)
- Display title: 17px / 600 weight / `var(--sr-text-primary)` — e.g. "eBird Backup Required"
- Body paragraph: 14px / `var(--sr-text-secondary)` / max-width 420px — one sentence explaining that the tab auto-loads once the file is stored
- Instruction box: muted background card, 14px `INSTRUCTIONS` label (uppercase, muted), numbered steps with 18px circle badges; monospace inline code for filenames; bold for app names and menu paths
- "Go to Settings" button: primary (green), with `settings` Lucide icon, 16px horizontal padding

**Tab-specific instruction content:**

*Breeding Codes / Species Detail (eBird backup):*
1. Go to ebird.org → My eBird → Download My Data
2. Download — file is named `MyEBirdData.csv`
3. Upload in Settings → Default Files → eBird Backup
4. Tab loads automatically on every visit

*Species Detail (condensed — 3 steps, no step 4 label):*
1. Get `MyEBirdData.csv` from ebird.org → My eBird → Download My Data
2. Upload in Settings → Default Files → eBird Backup
3. Tab loads automatically on every visit

*Media Life List (ML export):*
1. Go to macaulaylibrary.org → My Media
2. Click Save Spreadsheet — do not rename the downloaded file
3. Upload in Settings → Default Files → ML Export
4. Tab loads automatically on every visit

**NFR-01 consistency requirement:** Icon ring, instruction box, step numbering, and button style must be identical across all three tabs. Only the title, body text, and step content differ.

---

### Breeding Codes — Ready State

No "Load new file" or "Load different file" button in any state. The stored filename chip (green, with `check-circle-2` icon) remains in the toolbar. All sort controls, filter pills, and table content unchanged.

---

### Media Life List — ML Filename Warning Banner

Shown in the ready state when the ML export is loaded but the filename doesn't match the expected pattern.

**Layout:** Full-width banner between toolbar and table body. Amber warning notice card (`warning-bg` / `warning-border`): `alert-triangle` icon (orange), bold title "Personal media links unavailable", explanatory sentence, inline instruction to re-download without renaming.

No "Go to Settings" button on this notice — the fix is external (re-download from Macaulay Library), not a Settings action.

---

### Life List Comparer — Updated Layout

**List slot labels:** "My List" and "Other List" replace all prior label text. Labels are 14px / 600 weight, with an 11px uppercase "list" prefix above (muted).

**Mode selector (List A, when stored file is available):**
Two equal-width buttons side by side: "Use my list" (with `check-circle-2` icon) and "Upload a file" (with `upload` icon). Active mode: `var(--sr-secondary)` background, primary border and text color. Inactive: muted border and text. "Use my list" is selected by default when a stored file is available.

**"Use my list" content area:**
Dashed border box (muted background) showing a centered icon (40px `accent` circle with `file-check-2` icon), stored filename, and approximate species count. Reinforces which file will be used without requiring user action.

**No mode selector (no stored file):**
List A shows the DropZone only — no mode selector, no "Use my list" option. Still labelled "My List".

**List B:** Always shows DropZone. Always labelled "Other List". No mode selector in any state.

**Results view labels:**
- Panel headers: "In Both", "My List Only", "Other List Only"
- Summary bar: "My List" and "Other List" (not "List A" / "List B")
- No other layout changes

---

### Weather Tab — API Key Notices

**Placement:** Above the checklist ID input. One notice per missing key; both can appear simultaneously.

**Notice card style:** Amber warning (`warning-bg` / `warning-border`): `alert-triangle` icon (orange/amber), bold title, explanatory sentence (14px, muted), monospace Settings path label, then two actions side by side: "Go to Settings" primary button + plain external link to obtain the key.

*eBird notice:* "Settings → API Keys → eBird API Key" / link to ebird.org
*OpenWeather notice:* "Settings → API Keys → OpenWeather API Key" / link to openweathermap.org / note that "One Call by Call" subscription is required

**Checklist input:** Always visible below any notices. Label, input + button row, helper text — unchanged from current implementation.

---

## Component Usage

| Component | Used By |
|---|---|
| `SetupRequired` (new) | BreedingCodeList, LifeList, SpeciesDetail |
| `DropZone` (existing, unchanged) | ListComparer List A (upload mode), ListComparer List B |
| Lucide `upload-cloud` | SetupRequired icon ring |
| Lucide `check-circle-2` | Stored filename chip, "Use my list" mode button |
| Lucide `file-check-2` | "Use my list" preview card icon |
| Lucide `alert-triangle` | ML filename warning, Weather key notices |
| Lucide `settings` | "Go to Settings" buttons |
| Lucide `external-link` | External key links in Weather tab |

---

## Design Tokens Applied

| Token | Applied To |
|---|---|
| `var(--sr-bg-muted)` | SetupRequired card background, instruction box, dropzone, mode button inactive |
| `var(--sr-border)` | All card borders, instruction box, step number badges |
| `var(--sr-text-secondary)` | Body text in all guidance states, step text |
| `var(--sr-text-disabled)` | Section labels, instruction titles |
| `var(--sr-accent-bg)` | "Use my list" preview icon ring, "Use my list" active mode button background |
| `var(--sr-primary)` | "Go to Settings" button, "Use my list" active mode border/text, filename chip |
| Warning amber (`#FFF7ED` bg, `#FED7AA` border, `#EA580C` icon) | ML filename warning, Weather key notices |

---

## Interaction Notes

- **"Go to Settings" button:** Calls `onGoToSettings` prop → switches App.tsx `activeTab` to `'settings'`
- **Mode selector (ListComparer):** Toggling "Upload a file" replaces the preview card with the DropZone. Toggling back to "Use my list" restores the preview card and re-fetches the stored file on comparison activation (not on mode toggle — Q-01 default: re-fetch on comparison)
- **Weather notices:** Disappear when `keyStatus` updates to reflect a configured key; no page reload required — App.tsx should re-fetch `/settings/keys` after a successful key save in the Settings tab (or accept a `onKeyStatusChange` callback from Settings)
- **Comparison button:** Disabled until both List A and List B have data ready (List A in "Use my list" mode is ready immediately; "Upload a file" mode requires a file drop)

---

## Content Notes

- All instruction text names the exact file (`MyEBirdData.csv`) and the exact Settings path ("Settings → Default Files → eBird Backup")
- The ML filename warning says "do not rename" — imperative, direct, no hedging
- Weather notices name the specific key and include the external link for obtaining it — no dead ends
- "Go to Settings" is the CTA label on every guidance button — consistent across all surfaces
