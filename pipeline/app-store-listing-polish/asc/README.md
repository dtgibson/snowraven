# App Store screenshot upload tooling (app-store-listing-polish)

These scripts put the three composed screenshot sets onto an App Store version record through the App Store Connect API and check them afterwards. They were written on 2026-10-30, when 1.0.60 was already approved, so the sets ride the next record, 1.0.61 (`RELEASE_LEDGER.md`, "App Store screenshot sets (app-store-listing-polish), 2026-10-30").

## Files

| File | What it does |
|---|---|
| `asc-lib.mjs` | Mints the API token and makes the requests. Every other script imports it. |
| `asc-read.mjs` | Read-only. Lists the version records, then for one version (`--version 1.0.61`, default the newest) its build, the recent review submissions, the en-US localization id and the screenshot sets with md5s. |
| `asc-library-read.mjs` | Read-only. Prints the App Asset Library's placement groups and image specs for our three sizes and the app's library id. With `--loc <id>` it also lists that localization's screenshot placements in order. |
| `asc-screens.mjs` | `plan` (a dry run that prints every request `replace` would send), `replace` (writes only with `--execute`, and only to an editable version) and `readback` (read-only). |
| `composed-frames-checksums.txt`, `.json` | md5, sha256 and byte size of the eighteen composed frames, in upload order per family, as committed. |
| `readback-1.0.61.txt` | The `readback` log from the 1.0.61 upload on 2026-11-03: ALL MATCH, eighteen of eighteen. |

## The token

`asc-lib.mjs` signs an ES256 JWT with the metadata-capable key `QJA25M7XHM`, read from `~/.appstoreconnect/private_keys/AuthKey_QJA25M7XHM.p8`. The issuer id comes from `APPLE_API_ISSUER_ID` in the environment. Each token lasts 15 minutes and lives only in the running process. Nothing prints it or writes it to a file, and no key, token or issuer value is in this folder. The upload-only key `BVVLBRRVL6` gets a 403 on every metadata write, so do not substitute it.

## Two routes, and why

App Store Connect API 4.5.1 deprecated `appScreenshotSets` and `appScreenshots` in favor of the App Asset Library (images, placements and ordering requests). The iPhone Duo slot exists only in the library: display class `IPHONE_DUO`, placement group `IPHONE_DUO_PROFILE`, image spec `i2007x2853a0`. The legacy `ScreenshotDisplayType` has no Duo value.

- `iphone-6.9` (`APP_IPHONE_67`) and `ipad-13` (`APP_IPAD_PRO_3GEN_129`) use the legacy route by default. It still works, and it keeps the md5 `sourceFileChecksum` read-back. If Apple has turned off legacy writes, `--via library` sends them to `IPHONE_DYNAMIC_ISLAND_LARGE_PROFILE` and `IPAD_13_PROFILE`.
- `iphone-duo` always uses the library. The library route carries no checksum, so `readback` fetches Apple's processed PNG and compares its decoded pixels with the committed file. On 1.0.60's iPhone 01 the match was exact (0 of 11,357,280 values differ). `readback` makes this pixel comparison for every frame, plus the md5 check wherever a legacy set exists.

Each set is replaced whole and in order (a re-upload appends). Three behaviors come from the 1.0.61 upload: the per-frame wait for Apple's processing is fifteen minutes (that evening took three to six minutes a frame); on the library route the wait ends only once Apple has filled in the matched image spec, which arrives a little after the state leaves processing; and a re-run of the library route reuses an image an earlier run already put in the library under the same reference name (matched spec, same byte size, past processing), because reference names are unique per library and the images outlive their placements. The upload order is `FRAMES` in `website/tools/compose-appstore.mjs`: 01 Map Explorer, 02 Statistics, 04 Calendar, 05 Species Detail, 03 Weather, 06 Breeding Codes.

## The 1.0.61 sequence

Run this after the 1.0.61 record exists and before it is submitted. Use one command per step, from this folder, with `APPLE_API_ISSUER_ID` in the environment. `readback` loads `sharp` from `website/tools/node_modules`, so run `npm ci` in `website/tools` first if that folder is missing.

1. `node asc-read.mjs --version 1.0.61`: confirm the record is `PREPARE_FOR_SUBMISSION` and note its en-US localization id. The two sets carried over from 1.0.60 are the old bare captures.
2. `node asc-screens.mjs plan --loc <en-US id>`: a dry run. Read the deletes and uploads it lists.
3. `node asc-screens.mjs replace --loc <en-US id> --family iphone-6.9 --execute`
4. `node asc-screens.mjs replace --loc <en-US id> --family ipad-13 --execute`
5. `node asc-screens.mjs replace --loc <en-US id> --family iphone-duo --execute`
6. `node asc-screens.mjs readback --loc <en-US id>`: all eighteen frames must read `OK` and the run must end `ALL MATCH`. Anything else stops the submission.
7. `node asc-library-read.mjs --loc <en-US id>`: a second view of the three groups in order.

Then the release continues as the `snowraven-release` skill describes, and its `RELEASE_LEDGER.md` entry names this upload.

The sequence ran on 2026-11-03 against record `1ff37081` (localization `4ea321c5`): `readback-1.0.61.txt`.
