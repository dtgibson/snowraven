## Tab and Map Default Order

### What this does
Updates SnowRaven's default navigation and comparison ordering to match the requested day-to-day flow. New/reset tab layouts now order Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, and Named Birds; Settings remains pinned by the app shell. The List Comparer opens on Checklists first, and Map Explorer shows Nearby Lifers before Media Targets.

### How to test
1. Reset or clear the saved tab layout and confirm the tab order starts Weather, Statistics, Species Detail, Map Explorer, Checklists.
2. Open List Comparer and confirm Checklists is selected by default and appears left of Life Lists.
3. Open Map Explorer and confirm Nearby Lifers appears before Media Targets.
4. Run the focused tests, full frontend tests, lint, and production build.

### Notes for reviewer
Existing saved custom tab layouts are preserved. Missing tabs are still appended during layout normalization, now using the revised default order. Version metadata was bumped to 0.5.41 and Help/Changelog/website version labels were updated.
