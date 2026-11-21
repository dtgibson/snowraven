# Release copy held for 1.0.75 (security-bloat-deps-and-tests-cleanup)

HELD. Nothing below is written into `CHANGELOG.md`, `fastlane/`, App Store Connect, `website/` or `README.md`. The published sentence waits for the user's explicit yes (CLAUDE.md, "Published copy needs the user's approval first"); the Deployer applies it in the single `chore(release)` commit (D-10).

## The one published sentence

For the App Store "What's New" and the three F-Droid changelogs (`fastlane/metadata/android/en-US/changelogs/10000751.txt`, `10000752.txt`, `10000754.txt`, identical; 1.0.75's `versionCode` is 1000075):

> Security and reliability fixes, including safer handling of unusual eBird data and hand-edited backups.

Register check: one sentence, the gist only, no figures or section list, American spelling, no em dash, no mid-sentence capitals. It names no library and no platform.

## Proposed CHANGELOG.md entry

```markdown
## [1.0.75] - YYYY-MM-DD

### Fixed
- A State/Province value such as "US-__proto__" in a hand-edited eBird backup no longer takes down the Statistics tab's geographic section; a value that is not a State/Province code shows as plain text instead of a link.
- The List Comparer no longer fails when eBird answers with a checklist whose location name is not text.
- A location id from eBird's checklist answer is checked before it is used in a follow-up eBird request, in the apps and on the self-hosted server.
- Reading a large eBird bar-chart file holds far less memory, because each species name is now built in one piece.

### Security
- The apps' secure-connection libraries are updated: rustls 0.23.46, rustls-webpki 0.103.17 and webpki-roots 1.0.12 (distrusted intermediates and roots), and h2 0.4.20. plist 1.10.4 brings quick-xml 0.42.0; anyhow, rustix, tokio and clipboard-win move to fixed releases.
- Three unused system-keychain commands and the `keyring` crate are removed. Nothing had called them since v0.3.16, but a script in the app's page could.

### Internal
- `androidReachableCalls.test.ts` now holds the native command registry complete both ways: every `#[tauri::command]` is registered, and every registered command has a caller in shipped frontend code.
- GitHub's `Pipeline` check is green again: speed-ratio rows that cannot read steadily on shared runners run in the local full suite behind `SR_SKIP_LOCAL_ONLY_TIMING`, the production build runs before the suite so the bundle rows run, CI follows `.nvmrc` (Node 24), every workflow action is pinned by commit SHA, and a macOS job runs all of the native Rust tests.
- Dev-tool advisories are fixed (frontend lockfile, `sharp` 0.35.5 in `website/tools`), and flaky or ineffective test rows found in this run are repaired; the removal ledger is `pipeline/security-bloat-deps-and-tests-cleanup/removal-ledger.md`.
- Five unused declarations are removed (`BACKEND_DOWN_MESSAGE_SHORT`, `DATE_FORMAT_PREFS`, `WeatherSectionIcon`, `BreedingFilterSet`, the backend's `COMBINED_ATTRIBUTION`).
- The `zip` advisories under tauri-plugin-updater are held: closing them needs a Tauri upgrade that would drop the vendored `tao` patch (D-08).
- The F-Droid changelog for this release is three identical files, one per processor-type build (`10000751.txt`, `10000752.txt`, `10000754.txt`), and the in-repo F-Droid recipe names 1.0.75.
```

Notes for the Deployer: the date is the ship date. The third `### Fixed` bullet describes `3eb8682b`. The `### Security` heading is new to this file; the 1.0.7x entries use Added, Changed, Fixed and Internal, so fold its two bullets into Fixed if one heading set is wanted.
