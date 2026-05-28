# Bug Brief — Dark Mode Overscroll White

## What is broken
In dark mode on mobile, scrolling past the page boundary (iOS rubber-band) or using the Unbounded toggle in Breeding Codes / Media List reveals bright white areas above/below the content. The `body` and `html` elements have no `background-color`, so the browser's default white shows through wherever content doesn't cover.

## Steps to reproduce
1. Open SnowRaven on an iOS device (Safari) in dark mode
2. Navigate to Breeding Codes or Media List
3. Scroll up hard enough to trigger the iOS overscroll bounce, or toggle Unbounded
4. White flash/area appears above or below the table content

## Expected behavior
The overscroll area should match the app's dark background (`var(--sr-bg)`, `#09090B` in dark mode, `#F9FAFB` in light mode). No white flash.

## Blast radius
Only `globals.css` changes. No component logic touched. Light mode is not broken — this adds the explicit background that was implicitly assumed.

## What done looks like
- Dark mode: overscroll and unbounded areas show dark background, not white
- Light mode: overscroll areas show the light grey background, unchanged visually
