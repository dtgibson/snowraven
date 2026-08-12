## Breeding Name Column Overflow

### What this does
Keeps every Breeding Codes bird name and both external favicon links inside the phone name-column clamp. The fix fills the available name box and lets its name/favicon row wrap at the existing 640px phone tier, leaving the shared `BirdName`, link hit targets, column width, and wider layouts unchanged.

### How to test
1. Build and serve SnowRaven against the synthetic demo dataset.
2. Open Breeding Codes in a 320px viewport at 100%, 125%, 150%, and 200% Text Size.
3. Check Normal, Unbounded, and pinned views in light and dark themes.
4. Confirm common and scientific names remain readable, both favicon links stay inside every name cell, and each link keeps its 24px target.
5. Repeat above 640px and confirm the table geometry is unchanged.

### Notes for reviewer
The offending width came from the shared `BirdName` inline-flex box around its two favicon links, not from `NAME_COL_WIDTH` or pinning. The repair is therefore limited to the Breeding Codes name box and row inside `@media (max-width: 640px)`; a structural test rejects a global shared-component change or a widened media band.
