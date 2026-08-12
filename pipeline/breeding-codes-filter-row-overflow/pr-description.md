## Breeding Codes Filter Row Overflow

### What this does
Keeps the Breeding Codes full-label filter pills inside the phone panel at 200% text size. Dedicated row, pill, and label hooks release both nested flex minimums and allow emergency word wrapping only on this surface; every label remains complete, and the shared `.sr-ctl-row` behavior is unchanged.

### How to test
1. Run SnowRaven against the synthetic demo eBird backup.
2. Open Breeding Codes at a 320px viewport and set Text Size to 200%.
3. Confirm every filter pill stays within the panel, full labels wrap rather than truncate, and the page does not scroll sideways.
4. Switch between Normal and Unbounded and confirm the filter row is identical; repeat at wider widths and lower text scales.

### Notes for reviewer
The code pills retain their shipped fixed 30px height above 640px. In the phone tier only, `height: auto !important` plus `min-height: 30px` permits wrapped labels. Exact-selector guards lock the dedicated scope, both flex-floor releases, the 16px shared font-size rule, and the absence of clipping/truncation.
