# Change Brief — settings-location-and-distance-defaults

Lane: Improve. Branch: `improve/performance` (stacks with the unreleased
0.5.16 perf work; both ship together from the Mac).

## What's prompting it

Two friction points on the Settings → Default Location selector and the map's
default search radius:

1. Setting a home location means typing latitude/longitude by hand, even though
   the Map Explorer can already detect the user's location.
2. The map tools (Hotspots, Media Targets) default to a 25-mile radius, which is
   wider than wanted; the default should be 5 miles until the user picks their own.

## Scope

### 1. "Use my location" in the Settings default-location selector

- Add a **Use my location** button to the Default Location card
  (`Settings.tsx`, the block at ~1093) that calls `getCurrentLocation()` from
  `lib/location.ts` (the same helper `MapExplorer.handleUseMyLocation` uses),
  fills the Latitude/Longitude inputs with the detected coords (`toFixed(5)`),
  shows a "Locating…" state while in flight, and surfaces errors.
- **Reuse improvement:** extract the `LocationError` → user-message mapping that
  is currently inline in `MapExplorer.tsx` (~1196-1213) into a shared
  `describeLocationError(err: LocationError): string` in `lib/location.ts`, and
  use it in **both** Settings and MapExplorer. Removes the duplication instead
  of copy-pasting the 20-line switch.
- Reuses the existing `isWindows()` / platform branches in the messages.

### 2. Default distance = 5 miles until the user specifies

- `MapExplorer.tsx`: change the initial radius `useState(25)` → `useState(5)`
  (line ~736). 5 is already one of the RadiusControl options, so it highlights
  correctly. A saved `map-defaults.dist` still overrides on load (that's the
  user's specified preference) — unchanged.
- `Settings.tsx`: default the **Radius (mi)** input to `5` when nothing is saved
  (the load effect still fills it from a saved default when present), and make
  **Clear** reset it to `5` rather than empty — so saving a home location never
  forces the user to type a radius, and the persisted default matches the map's.

## Feature-lane boundary note

Adding the detect button is a new interactive control, which brushes New-Feature
territory. It reuses existing geolocation in an existing selector and adds no new
capability the app lacks, so it stays on the Improve lane. Flagged for the record.

## Out of scope

- No change to how geolocation works (native CLLocationManager / Windows
  Geolocation / `navigator.geolocation`) — only a new caller.
- No change to nemesis/region distance (driven by saved `map-defaults.dist`).

## Verification

- Extract `describeLocationError` with a small node-env unit test
  (`lib/location.test.ts`) covering each `LocationError.code` + the tauri/web/
  Windows message branches — matches the lib-test idiom.
- Manual: Settings detect button fills coords + error states; new maps default
  to a 5-mile radius; a saved default radius still wins.
- Full vitest + build + lint green; backend untouched.

## Version / docs

- Fold into the still-unreleased **0.5.16** or bump — decide at the Chronicler
  stage. Update `CHANGELOG.md`; review `docs/HELP.md` (Settings default location,
  Map radius wording) and `README.md` if the feature set line changes.
