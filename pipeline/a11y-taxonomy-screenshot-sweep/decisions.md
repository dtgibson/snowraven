# Decisions — a11y-taxonomy-screenshot-sweep

## Design-lint deviation: the mockup uses Inter / system-ui

`weft-design-lint` reports `banned-font` on `design.html:33` (generic/overused
face; it wants a distinctive OFL display face).

**Deliberate, not drift.** This is an Improve-lane refinement of shipped
surfaces, where the rule is extend `pipeline/design-system.md`, never reinvent
it — and that file specifies the type as "Inter / system-ui" with three working
roles. The doctrine itself resolves the conflict the same way: the design system
wins on specifics (this product's colors, type, radius), the doctrine wins on
craft. A mockup rendered in a face the app does not ship would misrepresent the
exact geometry under review, and geometry is the whole subject here — the
before/after frames are measurements, not a look.

No change to the app's type is proposed or implied by this build.

## Scope correction found during the design pass

The change brief inherited the roadmap's framing of three leaks as one
"320px/200%" family. Measurement against the built app disagrees in two ways,
both recorded in `design-refinement.md`:

- **Checklists leaks at every text size, not only 200%**, and its cause is not
  layout at all — a phone-tier universal-child selector gives an absolutely
  positioned `.sr-only` live region a 320px box. It needs no design decision.
- **Calendar has two contributors, not one.** The Year group (+29.4px) and the
  day cells (+18.4px) must both land; fixing only the Year group leaves an
  18.4px leak, so "the Calendar fix" is two changes sharing one cause family.

Neither changes the lane or the approved scope; both change what the Engineer
has to build, so they are recorded here rather than discovered at build time.
