# Design Refinement — Toggle Box and iOS Ship

## Visual Direction
Quiet utility, unchanged. Remove redundant chrome so the Settings Appearance
card reads calmer: the switch itself is the control, the green accent stays the
only color, and nothing else on the card moves.

## Screens / Views

### Settings → Appearance → "Disable embedded media" row
- Row layout unchanged: grid `minmax(0,1fr) auto`, 16px gap, `14px 16px`
  padding, `--sr-border` top rule, title + muted description block.
- The trailing control loses the bordered-button chrome entirely — no 1.5px
  `--sr-border` frame, no `--sr-surface` fill, no 30px box, no 6px radius.
- Bare switch replaces it: track 36×20px (radius 999px); knob 16px at top 2 /
  left 2, sliding to left 18 when on. (Slightly larger than the boxed pill's
  28×16 / 12px so it holds its own beside the row text without a frame —
  approved in the mockup.)
- Loading placeholder (`value === null` spinner) and error/saving text
  unchanged.

## Component Usage
- Extend the shared `ToggleSwitch` (`frontend/src/components/ui/ToggleSwitch.tsx`)
  with an opt-in chromeless variant (a `chrome`/`bare`-style prop). Only
  Settings' `EmbeddedMediaRow` opts in.
- Every other call site (Calendar, the six MapExplorer toggles, Checklists,
  SpeciesDetail, LifeList, OfflineMapsSection, WeatherBacklog widen-toggle)
  renders byte-identically to today — the default path must not change.
- Keep the full a11y contract: real `<button>` with `tabIndex={0}`,
  `role="switch"`, `aria-checked`, `aria-busy` while saving, `sr-only` label
  when `labelVisible` is false.

## Design Tokens Applied
`--sr-gray-400` (off track), `--sr-accent` (on track), `--sr-switch-thumb`
(knob fill), `--sr-switch-thumb-shadow` (knob shadow). No new tokens; both
themes already carry these. The switch-thumb tokenization convention is
untouched.

## Interaction Notes
- Focus: the global `button:focus-visible` ring (3px accent outline, offset 3,
  soft halo) draws around the bare control; give the button
  `border-radius: 999px` so the ring hugs the pill shape.
- Touch: keep invisible padding (~7px) around the track so the hit area stays
  ≥30px on desktop, and add `.sr-touch-target` so the ≤640 tier reaches the
  ~44px posture.
- Click behavior, busy handling, and the storage-seam save flow are untouched.

## Motion Spec
- Knob slide: `left` 180ms ease-out — existing app-wide switch motion, kept.
- Track color: `background` 180ms ease-out — existing, kept.
- Matches every other switch in the app (no new motion introduced).

## Content Notes
Copy unchanged: "Disable embedded media" title and the existing description.
No em dashes (app copy rule).
