# Bug Brief — Breeding Codes Filter Row Overflow

## What is broken
At 320px / 200% text scale, Breeding Codes' `.sr-ctl-row` becomes 327.11px wide inside a 272px parent, leaking 55.11px past it and 31.11px past the viewport. Its flex items wrap, but long code pills retain their min-content width; `C Courtship/Display/Copul.` has no usable break point. This independently sets `document.scrollWidth` to 351px in both Normal and Unbounded views.

## Steps to reproduce
1. Run v0.5.85 with the synthetic demo eBird backup and open **Breeding Codes**.
2. Set the viewport to 320px and in-app **Text Size** to 200%.
3. Inspect `.sr-ctl-row`: its right edge is 351.11px versus its parent's 296px content edge.
4. Switch between **Normal** and **Unbounded**; the row geometry remains identical and the page scrolls sideways.

## Expected behavior
The filter row and every pill should reflow within the panel's 272px content width at 200% text scale, without clipping or horizontal page scroll. Normal and Unbounded table behavior should otherwise remain unchanged.

## Blast radius
Primary scope is `BreedingCodeList.tsx` plus a narrowly scoped responsive rule/test in `globals.css`; the table and tier legend are separate. `.sr-ctl-row` is shared by five surfaces, so a global change could alter Life List, Checklists, Species Detail, and Calendar. All 23 code labels and lower text scales/desktop widths need regression coverage.

## What done looks like
At 320px / 200%, the row, pill boxes, and text ink stay inside the parent in both views and `document.scrollWidth === 320`. A real-render width/text-scale grid stays clean, with no change to the table, tier legend, other `.sr-ctl-row` consumers, or wider layouts.
