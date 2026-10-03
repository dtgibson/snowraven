# Proposed CHANGELOG entry (targets-hotspot-link)

Written by The Engineer; NOT yet in `CHANGELOG.md`. The Deployer bumps the
version after merging `main` (another build may take the next number first),
then pastes the entry below under the new version heading with that day's date.
American spelling, no em dashes.

```markdown
### Changed
- **Hotspot links on the Targets tab.** In the Last report column, the place under the date is now a link to its eBird hotspot page when it is a public eBird hotspot, the same as hotspot names on Checklists, Statistics and Named Birds. A personal location stays plain text and looks as it did. Long hotspot names wrap rather than being cut short, since the end of the name is often what tells two hotspots apart. Which places are hotspots comes from the same lookup the other tabs already make, so until it loads, with no eBird key, or offline, every place reads as plain text. Help describes it.
- Wherever the app shows a hotspot's full name as a link (the Targets tab, the first and most recent observation on Statistics, the one-place sentence on Named Birds, and the species comments on Species Detail), the small open-on-eBird mark now sits right after the last word when the name wraps onto a second line, instead of at the far edge of the column. Names on one line, shortened names and icon-only links look as before.

### Internal
- The Targets tab's live cell carries the location id of the same report its place name comes from, so a link always opens the place it names. The stored day-by-day eBird answers, the backend, both transports and the iCloud day snapshots are unchanged.
```
