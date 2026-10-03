// The FR-55 switch (android-release schema 4.6 and 5.3). 'B' (every location
// control absent on Android) until the emulator measurement recorded in
// pipeline/android-release/decisions.md under "FR-55 measurement" lifts it to
// 'A' (the Android System WebView's own navigator.geolocation). Read by
// platformGates.showLocationControls(), by location.ts, and by
// androidProjectPins.test.ts, which pins the manifest's permission set to it, so
// the frontend and the manifest cannot disagree.
export const ANDROID_LOCATION_BRANCH: 'A' | 'B' = 'B'
