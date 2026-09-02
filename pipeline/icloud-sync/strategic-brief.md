# Strategic Brief: iCloud Sync

## What We're Building

An opt-in, off-by-default iCloud sync of the user's two data files (the eBird backup and the Macaulay Library export) and their upload metadata, across the user's own Mac, iPhone and iPad. One toggle in Settings, on the macOS and iOS apps only. Upload a fresh export on any one device and every other device uses it.

## Why Now

SnowRaven 1.0.0 put the app on iPhone and iPad alongside the Mac. One birder now runs three Apple copies of the same app, and every fresh eBird export has to be uploaded three separate times. That is the daily friction this removes.

The groundwork is in place. Settings has been the sole source of the data files since the Settings-first file model (May 2026), so there is one place a sync path plugs in. The v1.0.9 per-document write chain means a second writer to `metadata.json` (sync) can be made safe rather than clobbering saves.

This is not the first item on the roadmap. Windows code signing is, and it stays there untouched. This jumps ahead because it is a felt, recurring cost for the primary user, and nothing in it depends on the Windows item.

## The User Problem

A birder downloads a fresh eBird export every week or two. Getting it into SnowRaven on the Mac is a drag-and-drop; getting it onto the phone and the iPad means moving the file to each device and uploading again in Settings. The same again for the Macaulay export. In practice the phone and iPad drift: one shows a life list a month stale, and the user cannot tell at a glance which device holds the latest file. The product promise is "your own data, on your own device", and today that promise costs three uploads per export.

## Success Criteria

- On a fresh install of every platform, sync is off. Nothing leaves the device until the user turns it on.
- The Windows app and the web/Pi build show no iCloud toggle and no dead controls.
- The user turns sync on on the Mac and uploads a new eBird export. They open the iPhone: the app uses that export with no upload step, and Settings shows the file came from the Mac, with the upload time.
- The reverse works the same way (upload on the iPad, the Mac picks it up).
- When two devices have uploaded different exports, every device converges on the most recently uploaded one, whole. Nothing is partially applied and nothing is merged.
- With sync on and no network, each device keeps working on its local copy. Nothing hangs, nothing empties.
- When a file exists in iCloud but has not yet downloaded to this device, Settings says so plainly and offers to fetch it. The app never silently shows an empty state or passes off stale data as current.
- When iCloud is unavailable (not signed in, iCloud Drive off), Settings says so and the toggle explains what is needed.
- Turning sync off leaves the local files intact and working. A clear action removes the synced copies from iCloud.
- API keys and app settings never appear in iCloud.
- A synced file arriving invalidates the parsed-file caches exactly as a manual upload does; the Breeding Codes, Species Detail and Statistics tabs reflect the new file without a relaunch.
- PRIVACY_POLICY.md, docs/HELP.md, README.md and website/ describe the new path in the same change, and the policy page parity test still passes.

## Scope

- One toggle in Settings on macOS and iOS, off by default, with a plain-language note before enabling: what goes to iCloud, whose account, how to turn it off.
- Sync of `data/ebird-backup.csv`, `data/ml-export.csv` and the upload metadata (filename, upload time, row counts), plus an origin marker: which device and when.
- Provenance shown in Settings on each device: where the current file came from and when.
- Latest-upload-wins, whole-file replacement. Each export is a complete snapshot; there is nothing to merge.
- Honest sync states: up to date, syncing, in iCloud but not downloaded here, iCloud unavailable, sync off.
- Turn off sync, and a separate clear action to remove the synced copies from iCloud.
- The local copy remains what the app reads. iCloud is transport between the user's devices, not the app's working store.
- Cache invalidation on sync arrival, through the same storage seam a manual upload uses.
- Native Rust/objc2 code on macOS and iOS as needed, behind the existing storage seam.
- Documentation and the published privacy statements, updated in the same change.

## Out of Scope

- Windows, web/Pi, and Android: no toggle, no UI, no behavior change.
- API keys. They are secrets, and they stay device-local. Possible follow-on, decided separately.
- Settings (`settings.json`). It holds device-specific state such as map center and tab layout.
- Derived caches: county completeness, hotspot activity, project answers, escapee provenance. Follow-on worth noting: syncing paid-for eBird answers across devices would save API calls.
- Merging two exports or any conflict resolution beyond latest-wins.
- Sharing between different people or different Apple IDs, including Family Sharing.
- Any SnowRaven server, relay, or third-party sync service. Any cloud other than the user's own iCloud.
- Fetching exports from eBird automatically. The user still uploads the file, once.

## Key Decisions

- Opt-in and off by default. One toggle, macOS and iOS only. Turning it on is an explicit act; nothing leaves the device before it.
- "Under the user's control" means: the files go only into the user's own iCloud account (Apple's infrastructure, tied to their Apple ID), never to a SnowRaven server or any third party; sync can be turned off at any time; the local copies on each device stay theirs and keep working offline; and there is a clear way to remove the synced copies from iCloud.
- The mental model is one shared pair of files. The most recently uploaded version of each file, from any device, becomes the version every device uses. Each device shows where its current file came from and when.
- Sync the two data files and their upload metadata only. Not keys, not settings, not caches, in v1.
- This is sync between the user's devices, which is different from the iOS device backup the privacy policy already mentions. The policy must describe the new path on its own terms: what is stored in iCloud, that it is the user's own account, and that the developer never sees it. The founding "collects nothing, no server" stance holds; the App Store privacy label reasoning in `appstore/LISTING.md` should be re-read against it.
- iOS already covers iPad: the Xcode project targets device families 1 and 2, so no new build target is needed.
- Open for The Architect: which iCloud mechanism fits. An iCloud Drive ubiquity container is file-shaped and matches two CSVs plus a small JSON; CloudKit is the alternative. Decide, do not assume.
- Open for The Architect, and a potential blocker: the macOS app is Developer ID signed and notarized, distributed via GitHub releases, not the Mac App Store. Whether iCloud entitlements and an iCloud container are available and provisionable on that distribution path must be verified before design. Today the macOS entitlements hold only location, the iOS entitlements file is empty, and no container exists. If iCloud is not available for the Developer ID build, surface it as a blocker; do not design around it silently.
- Open for The Architect: iCloud Drive documents can be evicted or not yet downloaded on a device. The design must handle "present in iCloud but not on this device" honestly, and must not block app launch on it.
- Open for The Architect: Tauri has no first-party iCloud plugin. Expect native Rust/objc2 on both macOS and iOS, exposed to the frontend through the storage seam, with sync as a serialized writer on the `metadata.json` document chain (v1.0.9).
- Open for The Architect: how a newly arrived file reaches the running app (file coordination or change notification) so the caches invalidate without the user relaunching.
