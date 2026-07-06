# Seeing the SnowRaven iOS app in the Simulator

Every command below was run and verified on Hephaestus (2026-07-04), except
where marked. Screenshots from these exact steps are in
`pipeline/mobile-app/sim-verify/`.

## One important quirk on this machine

Xcode 26.6 is installed at `/Applications/Xcode.app`, but the command-line
tools selection still points at the standalone CommandLineTools. Every
Xcode-touching command therefore needs this in front:

```
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

**The permanent fix** (one-time, needs your admin password — recommended
before TestFlight work):

```
sudo xcode-select -s /Applications/Xcode.app
```

Note: `npx tauri ios build` does NOT pass `DEVELOPER_DIR` through to the
`xcodebuild` it spawns (the CLI scrubs the child environment), so until you
run the `sudo xcode-select -s` fix, the build needs the wrapper trick shown
in step 1's fallback. After the fix, no wrapper and no `DEVELOPER_DIR` are
needed anywhere.

## 1. Build the simulator app (verified)

From the repo root:

```
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
npx tauri ios build --debug --target aarch64-sim --no-sign
```

*Fallback only if you have NOT run the `sudo xcode-select -s` fix:* create a
tiny wrapper so the CLI's spawned xcodebuild finds Xcode (this is what was
used for the verified build):

```
mkdir -p /tmp/xcshim
printf '#!/bin/sh\nexport DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer\nexec /usr/bin/xcodebuild "$@"\n' > /tmp/xcshim/xcodebuild
printf '#!/bin/sh\nexport DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer\nexec /usr/bin/xcrun "$@"\n' > /tmp/xcshim/xcrun
chmod +x /tmp/xcshim/xcodebuild /tmp/xcshim/xcrun
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export LANG=en_US.UTF-8
PATH=/tmp/xcshim:$PATH npx tauri ios build --debug --target aarch64-sim --no-sign
```

All THREE pieces are required (proven by the 2026-07-05 rebuild): the
`xcodebuild` shim (the CLI scrubs `DEVELOPER_DIR` from spawned xcodebuild),
the `xcrun` shim (the CLI also calls `xcrun simctl` directly — exits 72
without it), AND the parent-shell `export DEVELOPER_DIR` (the archive step
reads Xcode's `SDKSettings.plist` via the process environment — fails with
"failed to parse Xcode SDKSettings.plist" without it).

Either way the app comes out at:

```
src-tauri/gen/apple/build/arm64-sim/SnowRaven.app
```

## 2. Run it as an iPhone (verified)

```
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun simctl boot "iPhone 17 Pro"        # skip if already booted
open -a Simulator                        # shows the simulator window
xcrun simctl install "iPhone 17 Pro" src-tauri/gen/apple/build/arm64-sim/SnowRaven.app
xcrun simctl launch "iPhone 17 Pro" com.snowraven
```

(If a device name is ambiguous, list them with
`xcrun simctl list devices available` and use the UDID instead of the name.)

What to check:
- The app launches to the Welcome screen (phone layout, single column) —
  see `sim-verify/iphone-launch.png` for what it looked like.
- Tap **Go to Settings** → the file rows read **"Import file…"** (not
  "Upload file"), and there is **no "Offline maps" section**.
- Tap "Import file…" → the iOS Files picker should appear. To give the
  simulator a CSV first, drag your eBird CSV onto the simulator window
  (it lands in the Files app under Downloads).
- The footer shows the version with **no "Check For Updates"** link.
- Map Explorer → fullscreen: the map fills the screen and a green
  **Filters** button appears bottom-right.

## 3. Run it as an iPad (verified)

```
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun simctl boot "iPad Air 11-inch (M4)"    # or "iPad Pro 13-inch (M5)"
open -a Simulator
xcrun simctl install "iPad Air 11-inch (M4)" src-tauri/gen/apple/build/arm64-sim/SnowRaven.app
xcrun simctl launch "iPad Air 11-inch (M4)" com.snowraven
```

What to check (see `sim-verify/ipad-launch.png` for the verified launch):
- The app runs on the full iPad canvas — no letterboxing, no scaled-up
  phone UI.
- Statistics shows multi-column layouts; Map Explorer shows the filter
  sidebar **beside** the map.
- Rotate (Cmd-Left/Right arrow): the layout reflows live.
- Calendar shows the Compact/Large view toggle (iPhone hides it — that's
  by design).
- Map fullscreen: sidebar hides and the Filters button appears — same as
  iPhone, by design.

## 4. Day-to-day development loop (standard Tauri path, not yet exercised)

```
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
npx tauri ios dev "iPhone 17 Pro"
```

This starts the Vite dev server and runs the app against it with hot
reload. It spawns xcodebuild the same way `ios build` does, so it needs the
`sudo xcode-select -s` fix (or the wrapper) too.

## If something doesn't work

- `xcodebuild ... requires Xcode` error → the `DEVELOPER_DIR` export is
  missing from that shell (or run the one-time `sudo xcode-select -s` fix).
- `npm error Missing script: "tauri"` → you're on a checkout older than
  this feature; the root `package.json` needs the `"tauri": "tauri"`
  script (already committed with this feature).
- A stale app on the simulator → `xcrun simctl uninstall <device> com.snowraven`
  and install again.
