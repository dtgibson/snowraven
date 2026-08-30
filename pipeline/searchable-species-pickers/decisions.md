## Stage 2 (The Designer) — design direction approved as presented

- The Map Explorer Species filter becomes the shared `SpeciesCombobox` with a
  new additive `size="panel"` (34px, matching the panel's SELECT_STYLE
  register); `sm`/`md` code paths stay byte-identical so Species Detail and
  the Calendar are regression-free by construction.
- Listbox clipping: the filter panel's grid-collapse wrapper releases
  `overflow: hidden` to `visible` once fully open (transitionend-gated,
  re-hidden instantly on collapse). Portal and dynamic-max-height rejected
  (reasons in design-refinement.md).
- The 140ms ease-out listbox entrance motion lives in the shared component,
  so Species Detail and the Calendar gain the same subtle open motion. The
  Designer flagged this deliberate shared-surface deviation and recommended
  shared; the user approved the direction as presented. Reduced-motion
  fallback included.
