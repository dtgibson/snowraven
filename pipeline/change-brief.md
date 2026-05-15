# Change Brief — Mobile Tab Bar Fix

**Track:** Maintain
**Scope:** Layout fixes to make the app usable on iPhone without rotating the screen

---

## Problem

On iPhone (375px viewport), the five tab buttons overflow to the right of the screen. `whiteSpace: nowrap` keeps each tab label on one line, but the tab bar wrapper has no `overflow` set and no way to scroll — so the last 2–3 tabs are off-screen and unclickable.

Additionally, the 48px header top padding and 40px panel top padding waste vertical space on a phone screen where every pixel counts.

---

## Changes

**`frontend/src/App.tsx`**
- Tab bar wrapper: add `overflowX: 'auto'` and `WebkitOverflowScrolling: 'touch'` — allows horizontal scroll to reach all tabs on narrow screens
- Header wrapper: add className `sr-header`
- Tab panel wrappers: add className `sr-panel`
- Weather card div: add className `sr-card`

**`frontend/src/globals.css`**
- Add a `@media (max-width: 640px)` block with:
  - `.sr-header` — reduces top padding from 48px to 24px
  - `.sr-panel` — reduces top/bottom padding from 40px/24px to 20px/16px
  - `.sr-card` — reduces card inner padding from 32px to 20px

---

## What Does Not Change

- No new tabs, routes, or UI surfaces
- No component logic changes
- All existing behaviour on desktop is unchanged (tabs don't overflow on desktop, no scrollbar appears)
- All five tabs remain always-mounted; display toggle pattern is untouched
