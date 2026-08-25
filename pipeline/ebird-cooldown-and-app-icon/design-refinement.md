# Design Refinement — eBird cooldown extension + new app icon

## Visual Direction
The new SnowRaven mark: a white serif "SR" with the raven's head worked into
the lower bowl of the S, on the brand clover green #2D8653. It replaces the old
bold-sans "SR" tile everywhere an icon shows, and unifies the web favicon and
website mark (both previously a different line-drawn bird glyph) with the app
icon for the first time. Approved from design.html on 2026-08-24, with both
recommendations ratified by the user.

## Surfaces / Decisions

### macOS (.icns) — RATIFIED: Apple icon grid
Rebuild `src-tauri/icons/icon.icns` from `Rounded_Transparent_2048` drawn at
82% of the canvas (tile ~840px on a 1024 canvas, transparent margin), so the
Dock icon sits at native-app size. The provided .icns (full-canvas) is NOT
shipped as-is. All icns sizes (16 through 512@2x) from the same inset render.

### iOS — full-bleed, opaque
All 36 committed PNGs (`src-tauri/icons/ios/` + `src-tauri/gen/apple/
Assets.xcassets/AppIcon.appiconset/`) rebuilt from `FullBleed_2048`/`_1024`
(square, #2D8653 background). Every generated size saved with NO alpha channel
(the altool 90717 rule); source PNGs verified alpha-free, each output verified
after generation. iOS applies its own corner mask; ship the square.

### Windows — as provided
`src-tauri/icons/icon.ico` replaced with `SnowRaven_SR_AppIcon.ico` (7 sizes,
16–256, RGBA). `Square*Logo.png` + `StoreLogo.png` rebuilt from FullBleed
(square corners are the platform look). NSIS installer and taskbar read the
.ico.

### Desktop PNG set — rounded tile
`32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`, `icon.png` (512)
rebuilt from `Rounded_Transparent_2048` at full canvas (these feed Linux and
in-app contexts where the tile IS the shape; no Apple margin here).

### Web app favicon — vector
`frontend/src/../public/favicon.svg` rebuilt from the traced master
(`SnowRaven_SR_AppIcon_FullBleed.svg`, viewBox 1254): the white SR paths on a
rounded-rect #2D8653 tile (radius proportional to the current favicon's
7/32). Keeps the SVG format the app ships today.

### Website — RATIFIED: comes along
`website/favicon.svg` and `website/assets/logo.svg` rebuilt from the same
traced master (identical content, the site's two copies). No version bump of
its own; rides the Pages deploy. The site header renders it at 28px on a
light surface — verified legible in the mockup's header mock.

## Component Usage / Tokens
No app components or tokens change. The brand green is already
`--sr-accent` #2D8653; the icon uses the literal value inside asset files,
which is the norm for icon artwork (not a token violation).

## Interaction Notes
None. Static assets only; no DOM, no motion. The cooldown half of this run
has no design surface (confirmed in the change brief).

## Motion Spec
None — no animated surface changes.

## Content Notes
No copy changes from this design pass. `aria-label="SnowRaven logo"` on both
website SVGs is retained in the rebuilt files.

## Source of truth
User-supplied artwork: `~/Downloads/SnowRaven_SR_AppIcon_Formats/`
(FullBleed PNGs verified alpha-free; Rounded_Transparent carries alpha by
design; .ico carries 7 sizes; the SVG is an auto-trace of the approved
raster). Copy the source set into `pipeline/ebird-cooldown-and-app-icon/
icon-source/` during the build so the repo does not depend on a Downloads
folder.
