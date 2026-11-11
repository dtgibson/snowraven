# Held: the F-Droid changelog for the Hotspot Reports release

**Status: HELD for the user's yes.** The F-Droid listing, each release's three per-processor changelog files included, is published copy (CLAUDE.md, "Published copy needs the user's approval first").

## The text

````proposal fastlane
A new Hotspot Reports tab, between Breeding Codes and Checklists, reports on any one place in your eBird backup, an eBird hotspot or one of your personal locations: your life list there, dated to your first record of each species at that place, a map, your checklists there by protocol and by month and year, and the weather from the weather blocks in your checklist comments.
````

- The same text as the App Store What's New (`appstore.md`, section 2), as at 1.0.63.
- 376 characters plus the closing newline, within the 500-character limit `fastlaneMetadata.test.ts` holds (`CHANGELOG_MAX`); ASCII; one sentence; no count; no U+2014; American spelling.
- Register read against the recent files (`10000631.txt` for the Life Lists tab, `10000701.txt` for its Region control): one plain sentence that names what changed and what a birder gets, with no operating detail beyond naming the tab's place.

## The files

Three identical files, each the text above and one newline, one per processor-type build, under `fastlane/metadata/android/en-US/changelogs/`:

- `10000711.txt`, `10000712.txt`, `10000714.txt`

Those names assume the release is 1.0.71 (`bundle.android.versionCode` 1000071, the file names `10 * versionCode + 1, 2, 4`). The version is read off `main` at ship time, so the Deployer confirms it and renames the three files if another release lands first. They must exist at the tag, because F-Droid reads the folder there (CLAUDE.md, Versioning), and none goes under the unsplit code.
