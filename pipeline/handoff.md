## What We Accomplished

Fixed the **iOS app icon**. The iOS app was shipping Tauri's default placeholder
icon; the correct green SnowRaven icons already existed in the repo but had never
been copied into the iOS asset catalog when the iOS project was generated. Copied
them in — and when App Store Connect rejected the first upload because the large
icon carried an alpha channel, flattened all 18 icons to opaque RGB and rebuilt.
The corrected build (0.5.68 build 2) is uploaded to TestFlight.

The second reported issue — offline maps not being available on iOS — turned out
NOT to be a bug: offline map downloads are deliberately desktop-only in v1. It's a
real feature (on-device region storage, the tile protocol under iOS's WebView, App
Store review), and you chose to put it on hold; it's captured for later and noted
on the roadmap.

## What Has Been Saved

- **Shipped to TestFlight.** iOS **0.5.68 build 2** uploaded to App Store Connect
  (accepted, no errors) with the green SR icon. Desktop 0.5.68 is unaffected — this
  was an iOS-asset-only fix, no version bump and no desktop re-release.
- Commits on `main`: `e070d73` (icon swap), `21fd5b2` (flatten to opaque),
  `92c3a6a` (records), the iOS Info.plist build stamp, and this closeout.
- Two durable iOS conventions recorded in CLAUDE.md: iOS icons must be opaque (no
  alpha channel — App Store error 90717), and the iOS build + TestFlight upload
  recipe (Claude runs it: `DEVELOPER_DIR` + the xcshim wrapper, `app-store-connect`
  export, `altool` upload).

## Where We Are

Fix complete and shipped. Pipeline is idle.

Open threads: iOS offline maps is a deferred feature (on the roadmap horizon), and
the v0.5.68 Calendar mobile layout is still worth an eyeball on a real phone.

## Resume Prompt

Run `/weft` to start the next thing.
