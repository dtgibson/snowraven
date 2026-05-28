# Design Spec — Responsive Tab Bar

## Visual Direction
Adapts the existing navigation to viewport width without introducing a new visual language. Desktop is unchanged. The narrow-screen dropdown reads as the same app — same Inter type, 8px radius, accent green, and `--sr-*` tokens in both light and dark. The collapsed control behaves like a familiar select; the open list feels like a lightweight menu, calm and uncluttered.

## Screens / Views

### Desktop bar (≥ breakpoint) — unchanged
The current horizontal `tablist`: icon + label per tab, muted text, accent color and a 2px accent underline on the active tab. Centered, with horizontal scroll only as a last-resort fallback. No visual change from today.

Key decisions:
- Behaves and looks exactly as the current implementation. This stage adds the alternate layout; it does not restyle the bar.

### Narrow screen (< breakpoint) — dropdown
A single full-width trigger replaces the bar.

- **Collapsed trigger:** select-style button (`--sr-surface` fill, `--sr-border-medium` border, 8px radius). Shows the active tab's icon in accent green, its label in semibold, and a chevron on the right that rotates 180° when open. Hover lifts the border to accent.
- **Open menu:** floating panel anchored under the trigger (`--sr-surface`, 1px `--sr-border`, soft shadow, 6px inner padding) overlaying page content. Each row is icon + label. Rows hover to `--sr-surface-subtle`.
- **Active row:** `--sr-accent-bg` background, accent text and icon, semibold, with a trailing accent checkmark. (Both highlight and check retained — confirmed in review.)
- **Settings:** pinned at the bottom, separated from the content tabs by a 1px divider. (Confirmed in review as a deliberate, liked touch — Settings is set apart rather than treated as just another row.)
- **Ordering / visibility:** content tabs appear in the user's saved order; hidden tabs are omitted (demonstrated in the mockup by omitting Comparer). Settings always present below the divider.

## Component Usage
No new component library additions. The dropdown is a custom accessible control (disclosure button + listbox-style menu), chosen over a native `<select>` so it can show the active tab's icon and match the app's tokens and ARIA tab semantics. Icons are the existing Lucide-style stroke set already used by the tabs.

## Design Tokens Applied
- Surface / border: `--sr-surface`, `--sr-border`, `--sr-border-medium`
- Active state: `--sr-accent`, `--sr-accent-bg`
- Text: `--sr-text`, `--sr-text-muted`
- Radius: 8px (`--radius`); Font: Inter (`--font-sans`)
- Light and dark both derive entirely from the token sets — no hardcoded colors.

## Interaction Notes
- Collapsed trigger toggles the menu; chevron rotates on open.
- Menu closes on item select, Escape, outside click, or focus leaving the control.
- Selecting an item sets the active tab and closes the menu.
- Layout switches live at the breakpoint with no reload; active tab is preserved across the switch.
- Keyboard: trigger is focusable and activatable; menu items are arrow-navigable with correct `aria-expanded` / `aria-selected` state. The desktop bar keeps its existing roving-tabindex arrow navigation.
- WKWebView: any new focusable control sets `tabIndex={0}` (native `<button>` is skipped by Tab there).

## Content Notes
Labels are the existing tab names (Weather, Species Detail, Statistics, Map Explorer, Media List, Breeding Codes, Life List Comparer, Settings). No new copy introduced.
