# skip-link-safe-area

### What this does

Gives the "Skip to main content" link the iOS safe-area inset the rest of the
app already has. `.sr-skip-link` is `position: fixed`, so it is viewport-relative
and escapes the `.sr-ios-app body { padding-top: env(safe-area-inset-top) }` that
protects every in-flow surface: on focus it came to rest at 16px from the
*physical* top, landing inside the Dynamic Island band and leaving most of the
pill behind opaque hardware. It is the last untreated surface of the family
`CLAUDE.md` documents, and the most direct one, being an interactive control
rather than a title.

The fix is one `.sr-ios-app`-gated rule in `globals.css` carrying `top` and
`left` only. Nothing needed lifting first (unlike the map panel and the Help
overlay, the skip link's positioning already lived in the stylesheet and
`App.tsx` carries no inline style on it), so there is no TSX change at all.

Alongside it, the stylesheet-guard parser that `CLAUDE.md` said should be shared
at its third consumer has been extracted, and the two existing consumers migrated
onto it.

**Desktop and web are byte-identical.** The gate is what guarantees it:
`index.html` ships `viewport-fit=cover` to browsers too, so `env(safe-area-inset-*)`
is non-zero in iOS Safari on the *web* build, and an ungated rule would have
silently changed shipped web rendering on every notched phone. `.sr-ios-app` is
set on `<html>` by `main.tsx` only under `isIOS()`.

### How to test

`pipeline/skip-link-safe-area/how-to-see.md` has the step-by-step. In short:
`npm run build` and `npm test` in `frontend/`, then Tab once in the running app
to confirm the link still reveals at exactly 16px on desktop, and finally the
iOS simulator with a hardware keyboard for the behaviour that actually changed.

### Notes for reviewer

**The rule, and the three decisions inside it.**

```css
.sr-ios-app .sr-skip-link:focus {
  top: calc(16px + env(safe-area-inset-top, 0px));
  left: calc(16px + env(safe-area-inset-left, 0px));
}
```

- **`:focus` only, never the base rule.** This is the wrong turn the bug brief
  named, and it trades the bug for a worse one. The base rule's `top: -100px` is
  the off-screen *park*; the pill is 41px tall at 1x and 62px at 200% text scale,
  so adding a 59px inset there puts its bottom edge at **+21px** and the hidden
  link becomes permanently visible in the Island band. The `calc()` and
  `padding-top` forms of the mistake fail identically. Measured, not reasoned:
  see the reproduction below.
- **Re-point, don't pad.** The two panel precedents pad because they are
  `inset: 0` full-viewport boxes; padding a point-anchored `width: auto` pill
  would grow it by the inset and paint its green background across the Island.
  The precedent that fits is `.sr-ios-app .sr-bc-matrix--pinned thead th`, which
  moves an offset.
- **`left` yes, `right` never.** `left` is the edge at risk in landscape, and it
  self-corrects: in the rotation where the housing is on the far side,
  `inset-left` is 0 and the `calc` collapses to the shipped 16px. The element
  declares no `right` at all, and adding one to a `width: auto` fixed box would
  stretch the pill across the viewport. That is a deliberate deviation from the
  two panel rules, which need both edges only because `inset: 0` pins both; the
  reason is recorded in a comment beside the rule so it does not read as an
  omission.

Both offsets are anchored to the shipped `16px` literal, so wherever the inset is
0 the rule degrades to today's exact geometry, and both keep the `0px` fallback.

**The shared parser (the reason this touches two files it did not have to).**
`CLAUDE.md` records that a stylesheet test for a rule that must apply at *all*
viewport widths has to parse exact top-level selectors and skip at-rule blocks
whole, that two guards already needed that shape, and that **a third should share
one helper rather than re-derive it**. This is that third guard, so:

- `frontend/src/lib/cssTopLevelRules.ts` is the extracted parser (test-only;
  nothing in the app imports it, so it is never bundled).
- `iosChrome.test.ts` drops its in-file `parseTopLevelRules` for it, and hosts
  the new skip-link guard.
- `mapIosFullscreen.test.ts` drops its `stripMediaBlocks` + `iosRule` + `cssRule`
  trio for it. This is strictly stricter than what it replaces: the old `cssRule`
  distinguished `.sr-map-fullscreen-panel` from `.sr-ios-app .sr-map-fullscreen-panel`
  by requiring each to start its own line, where the shared parser keys on the
  exact selector.
- `cssTopLevelRules.test.ts` asserts the parser's own three properties against
  fixtures, so the two guards can assert about `globals.css` rather than about
  their plumbing.

Every `it()` in both migrated files still asserts what it asserted before; only
the plumbing moved. Two titles changed where they named a function that no longer
exists. I confirmed the migration did not blunt them by mutating `globals.css`
and watching each one fail (below).

Deliberately **not** migrated: `filterControlSizeCss.test.ts` and
`breedingCodePinnedCss.test.ts` ask *offset* questions ("is this rule inside the
≤640 tier?", "does it come after that one?") that a selector→body map cannot
answer. Also unchanged: `iosChrome.test.ts`'s loose `rule()` helper, which serves
two assertions that never claimed top-level placement. Folding those in would
have strengthened claims rather than moved plumbing.

**Verification.**

- `npm run build` clean (the repo's real pre-push gate, not just vitest/lint),
  `npm run lint` clean, full suite 1898 passed / 144 files.
- The rule survives minification with `env()` and its fallback intact:
  `dist/assets/index-*.css` contains
  `.sr-ios-app .sr-skip-link:focus{top:calc(16px + env(safe-area-inset-top,0px));left:calc(16px + env(safe-area-inset-left,0px))}`.
- **Nine mutations, each rejected by the suite.** The five that prove the new
  guard has teeth: inset moved to the parked state (5 failures), the gate removed
  so the ungated rule carries `env()` (2), padded instead of re-pointed (2), a
  `right` edge added (1), the `0px` fallback dropped (1). Plus the gated rule
  DRY-consolidated into the ≤640 tier (4) — the any-width trap. And four against
  the *migrated* guards, confirming the refactor preserved their teeth: the map
  panel's gated rule moved into a media block, `.sr-map-content` losing
  `position: relative`, and a `.sr-map-ios-fullscreen` child rule moved into a
  media block.
- **A browser reproduction, because the claim is geometric.** jsdom has no layout
  engine, so "the pill clears the band" is invisible to vitest. A throwaway
  Playwright script rendered the **real declarations parsed out of `globals.css`**
  (not a hand-retyped copy) at 393×852 with `env(safe-area-inset-top, 0px)`
  substituted as a literal 59px, against a band drawn at y=11..48, and measured
  the boxes. Every number in the bug brief is confirmed exactly:

  | scenario | state | box | overlaps Island |
  |---|---|---|---|
  | shipped, 1x | focused | y 16→57 (41px) | **32px** |
  | shipped, 200% | focused | y 16→78 (62px) | **32px** |
  | fixed, 1x | focused | y 75→116 | 0 (27px clearance) |
  | fixed, 200% | focused | y 75→137 | 0 |
  | fixed, 200% | parked | y −100→−38 | off-screen |
  | **wrong turn**, 200% | parked | y −41→**+21** | **on screen** |

  Landscape was run both ways (housing charged to the left, and to the right):
  with `inset-left` at 59px the pill moves to `left: 75`, and with it at 0 the
  `calc` collapses to the shipped `left: 16` and the rule is a no-op.

**Two things that stay unproven off-device, and are not claimed as verified:**
that iOS actually reports 59px on any given model, and which edge iOS charges the
inset to in landscape. Neither needs to be settled for this rule to be correct,
because the rule *defers to the platform value* rather than hardcoding one: it
adds whatever `env()` reports to the shipped 16px, so it is right for 59px, for
iPad's ~24px, and for 0. The landscape pair above is the same argument made
concrete — the rule behaves correctly under either answer. The on-device
confirmation is a Tab press in the simulator, in `how-to-see.md`.

**Records.** `CLAUDE.md`'s "Known untreated" note is replaced by the shipped
convention (pad a full-viewport box, re-point a point-anchored one, and gate on
the on-screen state), the shipped-instances list gains `.sr-skip-link:focus`, and
the shared-parser bullet now names the extracted helper. `ROADMAP.md` drops the
item. No version bump, no `CHANGELOG.md` entry: one build in a bundled Spool
release.

`ACCESSIBILITY.md` and `docs/HELP.md` were checked and are unchanged, for a
reason worth stating rather than assuming. The published statement's only mention
of this control claims tab-order position and nothing geometric, so it stayed
true throughout. The sentence this bug *did* falsify is a different one, "Wherever
keyboard focus lands, you can see it", which was untrue on iOS for the app's very
first tab stop and is made true by this change. No edit keeps either honest, and
adding device-specific geometry to a published statement would create a claim
needing maintenance. (`website/index.html` has its own `.skip-link`, unaffected:
it is `position: absolute`, and the site ships no `viewport-fit=cover`.)

## Convention Flags

- When a `position: fixed` element needs a safe-area inset, ask which of its
  *states* the offset describes. A point-anchored element with an off-screen park
  must take the inset on the on-screen state only; padding it, or insetting the
  park, makes a hidden element visible.
- Inset only the edges an element actually declares. Copying a full-viewport
  panel's top/left/right block onto a `width: auto` element stretches it across
  the viewport.
- The shared top-level stylesheet parser now exists at
  `frontend/src/lib/cssTopLevelRules.ts`; a fourth guard should reuse it, but
  offset-question guards should not be forced onto it.
- When a fix's core claim is geometric, render the declarations *parsed from the
  real stylesheet* rather than retyping them into a fixture. Retyping is how a
  reproduction quietly stops testing the shipped code.
