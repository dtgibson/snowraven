# Design Spec — Launch Splash Screen

**Status:** design direction for review. The HTML companion is a visual prototype; its review controls are not part of SnowRaven.

## Visual Direction

The opening is a single, quiet SnowRaven impression: a small white raven on a full-window clover-green field. It follows the centered, wordless restraint of the MarkTodo reference, using SnowRaven's own mark and the user's saved founding green. The surface is deliberately opaque and flat so the iOS storyboard and the first webview frame can match exactly, with no background-image scaling, gradient interpolation, or theme-dependent seam. This is the named exception to the general design-doctrine preference for atmospheric backgrounds: continuity across the native-to-webview handoff and the user's minimal composition are the purpose of this frame.

**User-confirmed priority:** SnowRaven must open as quickly as possible. The splash fills only unavoidable startup time; showing the mark is never a reason to delay a usable screen or add startup work.

## Screens / Views

### First frame: native iOS launch and app-owned splash

- Fill the **entire view/window**, including unsafe areas, with the user's saved SnowRaven green, `#2D8653`. Use this same fixed field in light and dark settings. White text has about 4.52:1 contrast on this field.
- Center the committed bird silhouette from `frontend/src/assets/snowraven-bird-glyph.svg` within an **88 × 88 CSS-pixel / iOS-point** box. Use a white `#FFFFFF` fill, preserving the master path, viewBox and aspect ratio. Keep the box centered on the whole viewport, not a safe-area rectangle. No optical offset is applied: the original mark's asymmetric silhouette and pointed tail are part of its shape, and shifting the asset would create a more noticeable native/web alignment risk than it solves.
- The glyph remains 88 logical units at every window size and orientation, including 320px width. It is never enlarged with the viewport. No wordmark, slogan, progress indicator, spinner, card, shadow, texture, or decorative animation appears.
- The native launch frame and app-owned frame must share exact field, glyph artwork, apparent size and center. The native image is derived from the committed SVG; it is not a second hand-drawn path. Set the native view background to the field color, use a centered aspect-fit image view sized 88 points, and align to the full view's center guides.
- The app-owned surface stays fixed at `inset: 0` as a sibling to `#root` so it can paint before React. The prepaint document/background and iOS webview background also use the field color while the surface is visible. Avoid a transparent or white gap at the handoff.

### Slow opening, after 2 seconds

The glyph stays anchored at the exact first-frame center. A single centered status, “Opening SnowRaven…”, appears below it with a 12px gap from the 88px box's bottom. Use white text at 16px/1.35 and 600 weight, scaling with the app's text-size setting, with a maximum measure of 20rem and side padding of at least 24px. The status already exists in the accessibility tree from the first app-owned frame; revealing the same text visually does not announce it again.

### Long opening, after 15 seconds

Replace the status text in the same position with “SnowRaven is taking longer than expected”. Put one **Reload** button 12px below the text. The status can wrap without moving the glyph. The button uses a white fill, `#1A5C38` text, 10px vertical and 20px horizontal padding, 8px radius, a minimum 44px height, a visible white focus ring separated from the button, and a restrained 120ms color change on hover. The status and button remain within a standard 320px phone viewport at 200% text scale. Startup can still finish and hand off while this state is visible.

### Known failure

A known startup failure immediately yields to SnowRaven's existing actionable error screen when React can show it. If the bundle cannot render that screen, keep the same green field and centered glyph, replace the status with “SnowRaven couldn’t open”, and show **Reload**. Do not wait for either threshold. The glyph remains decorative and the status contains only the failure sentence; the action is a sibling so it is not announced as part of the status.

## Component Usage

This frame needs no shadcn component, app card, or new dependency. Use native HTML for the fallback Reload button and status; use the shared `RavenGlyph` only at existing React sites. The pre-React splash references the bundled master asset so Vite can resolve it offline; its existing green fill can be rendered white through `brightness(0) invert(1)` without maintaining a second SVG path. The standalone HTML preview embeds a path extracted exactly from that master solely to remain self-contained. Review controls in `design.html` are mockup-only.

## Design Tokens Applied

| Role | Exact value | Source / use |
| --- | --- | --- |
| Field | `#2D8653` | User's saved founding SnowRaven green, fixed across light/dark for launch continuity |
| Glyph and status | `#FFFFFF` | White, intentionally fixed across both themes for this launch field; 4.52:1 on field |
| Recovery button text | `#1A5C38` | Existing light `--sr-accent-strong` |
| Recovery button fill | `#FFFFFF` | Same fixed launch ink; dark mode's `--sr-on-accent` is a different value and does not apply here |
| Glyph box | `88 × 88px` / `88 × 88pt` | Fixed across form factors |
| Status type | `16px / 1.35 / 600` at 100% text scale | SnowRaven's neutral UI sans; no display headline is present |
| Recovery type | `16px / 1.25 / 600` | SnowRaven's neutral UI sans |

The first paint cannot depend on `globals.css`, so the Engineer should mirror these values in the small inline boot stylesheet and storyboard, with a parity guard. The launch field is deliberately distinct from the app's deeper `--sr-accent`; the app token remains unchanged.

## Interaction Notes

- The initial app-owned surface exposes one `role="status"` node containing “Opening SnowRaven…” to assistive technology while visually showing only the mark. The mark is `aria-hidden="true"`. Keep the status node mounted, then reveal its existing text at 2 seconds. At 15 seconds change that node's text and add the Reload button. There is no focus move.
- A ready welcome or correctly selected shell replaces the surface immediately on the next paint. If readiness wins before the first app-owned paint, the splash need not appear at all. The splash imposes no minimum display time, extra startup work, or wait for tab data, maps, providers, or a decorative transition. Normal in-app loading belongs to the destination screen.
- No splash returns during tab switches, file imports, background work, or warm widget navigation. A full page reload starts a new opening.
- A known failure is actionable immediately. Reload calls a normal page/app reload. The fallback works offline insofar as the installed or self-hosted app itself remains available.
- At 320px and 200% text scale, keep the glyph fixed; allow the status to wrap and the recovery stack to grow downward within the viewport. If the usable height is unusually short, prioritize keeping Reload visible with vertical scrolling of the status/action region, never moving the glyph off-center on standard phone windows.

## Motion Spec

- First frame: static, no entrance animation, no loop, CSS/native.
- Status at 2 seconds: instantaneous visibility change; unchanged accessible text, CSS.
- Status change at 15 seconds: instantaneous text replacement and button appearance, CSS.
- Ready or known failure handoff: remove the covering surface before the next paint, **0ms**, no fade or scale. Reduced motion is identical, CSS/React lifecycle. This follows the Architect's immediate-handoff design and avoids delaying interaction.
- Reload hover/focus: color/border response, `ease-out`, 120ms, no transform; reduced motion uses an instant change, CSS.

## Content Notes

The first frame is wordless. Status copy is factual and brief; it does not claim failure because time has elapsed. No marketing copy is added. The fallback's Reload label is the only action. Published website, README, and App Store copy are outside this design.

## Review and implementation checks

The HTML prototype opens on the first frame and offers mockup-only controls to inspect slow, long, and known-failure states. The Engineer should verify an actual iPhone and iPad cold-launch recording (including native/webview handoff), desktop/web first paint, light and dark appearance, rotation and resize, 320px at 200% text scale, the real accessibility tree, and immediate release on readiness. The design's flat field is intentional; if a recording exposes a color seam, match the actual rendered colors before changing the composition.
