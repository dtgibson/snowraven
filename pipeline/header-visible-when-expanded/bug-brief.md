# Bug Brief — Header Visible When Expanded

## What is broken
When "Show all" is activated on the Media Life List or Life List Comparer tabs,
the SnowRaven logo and tab bar remain pinned to the top of the viewport. The outer
app container uses `height: 100vh; overflow: hidden` with the header as `flexShrink: 0`,
so the header never scrolls away regardless of how far down the content extends.
This wastes space on mobile and breaks printing (the header occupies the top of the
print but doesn't repeat on subsequent pages like a real table header would).

## Steps to reproduce
1. Open SnowRaven on a mobile device (or a narrow browser window)
2. Go to Media Life List or Life List Comparer
3. Load data (drop an eBird CSV)
4. Click "Show all"
5. Observe: the SnowRaven header and tabs are pinned at the top, consuming viewport space

## Expected behavior
In "Show all" mode, the header scrolls away naturally as the user scrolls down — just
like any normal document. When "Collapse" is clicked, the sticky layout is restored.

## Blast radius
Isolated to `App.tsx` layout and the two components that expose an expand toggle
(`LifeList.tsx`, `ListComparer.tsx` + `ResultsView.tsx`). No backend changes needed.
Normal (non-expanded) behavior is entirely unaffected.

## What done looks like
- "Show all" clicked → page switches to scrollable layout; scrolling down hides the header
- "Collapse" clicked → layout returns to pinned header / scrollable-panel mode
- Printing the expanded view produces a clean page without the header occupying fixed space
