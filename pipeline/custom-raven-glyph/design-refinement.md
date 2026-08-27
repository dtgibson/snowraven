# Design Refinement — Custom Raven Glyph

## Visual Direction
The generic lucide `Bird` outline is replaced by the solid SnowRaven raven
silhouette (the clean vector trace of the app icon's raven) at both of its
render sites. Approved at **100% of the existing slot sizes** — no optical
trim (the 90% variant was shown and declined; the raven's diagonal posture
leaves natural breathing room, and a solid mark beside the 700-weight
wordmark mirrors the app-icon pairing). Same accent color, both themes.

## Screens / Views

### App header (`frontend/src/App.tsx`, ~line 718)
- Raven at `size={compactChrome() ? 20 : 30}` — the exact current numbers.
- `color: var(--sr-accent)` (resolves #277448 light / #34D399 dark),
  `aria-hidden="true"`, unchanged flex row (gap 7/10) beside the wordmark.
- No other header change: wordmark, tagline, spacing all untouched.

### Welcome screen (`frontend/src/components/WelcomeScreen.tsx`, ~line 64)
- Raven at `size={34}`, `color: var(--sr-accent)`.
- ADD `aria-hidden="true"` — the current lucide bird lacks it here (App.tsx
  has it); the mark is decorative at both sites, the wordmark carries the name.

## Component Usage
- New `RavenGlyph` React component in `frontend/src/components/` (or an
  equivalent inline-SVG module): single `<path>`, `viewBox="0 0 512 512"`,
  `fill="currentColor"`, `width`/`height` from a `size` prop, `aria-hidden`.
- Source of truth: `snowraven-bird-glyph-currentcolor.svg` from the approved
  glyph folder — commit the master SVG in-repo per the v0.5.93 asset
  convention (regeneration must never depend on a Downloads folder). Strip
  the baked `color="#2D8653"` attribute and the `<title>`/`<desc>` (the
  component is decorative); no hardcoded hex anywhere (`.claude/rules/ui.md`).
- Dependency-free by construction — it rides the App.tsx entry chunk.
- Remove the `Bird` import from both files; every other lucide icon stays.

## Design Tokens Applied
- `--sr-accent` only, via the existing inline `style={{ color: 'var(--sr-accent)' }}`.
  No new tokens; no theme-specific values in the component.

## Interaction Notes
- None. The mark is static and decorative; no hover, focus, or click behavior
  exists today and none is added. `strokeWidth` has no meaning on a filled
  silhouette — drop it rather than porting it.

## Motion Spec
- Deliberately none. A brand mark in fixed chrome animating on mount is
  motion-anti-slop; the swap ships static, byte-equal layout either side.

## Content Notes
- No copy changes anywhere. The wordmark ("Snow" + accent "Raven"), tagline,
  and welcome copy are untouched.
