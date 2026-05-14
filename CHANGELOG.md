# Changelog

All notable changes to SnowRaven are documented here.

## [0.0.16] - 2026-05-13

### Changed
- Photo, Audio, and Video counts in the Media Life List are now clickable links — clicking a count opens the Macaulay Library catalog filtered by that species and media type in a new tab
- Column headers (Entries, Photo, Audio, Video) are now clickable sort controls; clicking a header sorts by that column, clicking again reverses direction
- Removed the "Media" (always-✓) column — redundant since every entry in the list has media
- Removed the standalone A–Z sort button — replaced by column-header sorting

## [0.0.15] - 2026-05-13

### Changed
- Photo, Audio, and Video columns in the Media Life List now show a count of individual media items per species instead of a checkmark (dash for zero)
- "Seen" column header renamed to "Media" — accurate for audio-only entries
- "Species" column header renamed to "Entries" — accurate for non-species items such as soundscapes
- Soundscape entries from Macaulay Library exports are no longer excluded — they appear in the list like any other entry

## [0.0.14] - 2026-05-12

### Added
- Media Life List now accepts a Macaulay Library export CSV as a preferred offline input — instant results, no CDN lookups (sign in to Macaulay Library → My Media → Save Spreadsheet)
- eBird backup CSV remains available as a secondary input; file type is auto-detected from the CSV header
- Three new positive filter pills: Has photo, Has audio, Has video — alongside the existing No photo / No audio / No video filters
- Soundscape entries from Macaulay Library exports are automatically excluded

## [0.0.13] - 2026-05-12

### Fixed
- Media Life List batch lookup no longer stalls or shows "Couldn't reach the Macaulay Library" mid-batch — reduced batch size (25 → 10 IDs), added a 500 ms inter-batch delay to stay under the Cornell CDN rate limit, and changed individual batch errors to be non-fatal so partial results are always shown

## [0.0.12] - 2026-05-12

### Added
- Taxonomic / A–Z sort control on the Life List Comparer tab, matching the sort control already present on the Media Life List tab

## [0.0.11] - 2026-05-12

### Fixed
- In "Show all" mode, the SnowRaven header and tab bar now scroll away naturally instead of remaining pinned at the top of the screen — improves mobile viewing and print output for the Media Life List and Life List Comparer tabs

## [0.0.10] - 2026-05-12

### Changed
- Tab order is now Weather, Media Life List, Life List Comparer
- "Life List" tab renamed to "Media Life List"
- "List Comparer" tab renamed to "Life List Comparer"

## [0.0.9] - 2026-05-12

### Fixed
- Life List species count now matches the List Comparer — subspecies parentheticals (e.g. "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)") are merged into a single species entry, consistent with how the List Comparer has always worked

## [0.0.8] - 2026-05-12

### Fixed
- Life List media lookup now works correctly — the original implementation queried the Macaulay Library search API by catalog ID, which does not support that lookup. The backend now probes the Cornell CDN directly via HEAD requests to determine each asset's media type (Photo / Audio / Video), which is reliable and fast.

## [0.0.7] - 2026-05-12

### Added
- Life List tab: upload your eBird backup CSV to generate a full life list with per-species media coverage (Photo, Audio, Video)
- Filter buttons to show only species missing a photo, audio recording, or video recording
- Taxonomic order and A–Z sort options
- "Show all / Collapse" toggle for full-page expansion (useful for printing)
- Backend proxy at `POST /ml/media-types` querying the Macaulay Library search API to determine media types for submitted catalog IDs, with batch progress indicator during lookup

## [0.0.6] - 2026-05-08

### Added
- "Edit on eBird" link appears in the results area after a successful weather lookup, linking directly to the eBird edit page for that checklist (`https://ebird.org/edit/effort?subID=…`)

## [0.0.5] - 2026-05-08

### Added
- `update.sh` script: one command to pull, rebuild, and restart the app (`./update.sh` from the repo root)
- "Check For Updates" link in the app footer: checks GitHub for a newer release on demand, showing version status inline (no passive network requests)
- `/version/check` backend endpoint: server-side GitHub API check that keeps the client IP off GitHub

## [0.0.4] - 2026-05-08

### Added
- Checklist confirmation line displayed after a successful weather lookup, showing the resolved checklist ID, location name, and observation time (e.g. `S334315671 / Berkeley Community Garden / 2026-05-07 17:26`)

## [0.0.3] - 2026-05-07

### Added
- List Comparer tab: drag-and-drop two eBird backup CSV files to see which species appear in both lists and which are unique to each
- "Show all / Collapse" toggle on comparison results to expand all three species panels to full length (useful for printing)

## [0.0.2] - 2026-05-07

### Added
- Weather output is now automatically copied to the clipboard on a successful lookup (with legacy fallback for non-HTTPS contexts)
- Footer "SnowRaven" text links to the GitHub repository
- This changelog

## [0.0.1] - 2026-05-07

### Added
- Initial release: paste an eBird checklist ID or URL to retrieve formatted weather conditions for that checklist
- Manual copy-to-clipboard button on the weather output panel
