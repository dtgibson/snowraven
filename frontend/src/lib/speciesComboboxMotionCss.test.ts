/// <reference types="node" />
//
// improve: searchable-species-pickers — the shared species picker's listbox
// entrance motion (the Motion Spec: 140ms ease-out, origin-aware, scaling from
// the input above) and its reduced-motion coverage.
//
// Reads the REAL globals.css off disk (vitest stubs CSS `?raw`), the same
// posture as milestoneContrast / mapFabClusterCss. The node types live only in
// tsconfig.node, so the reference above stays file-scoped.
//
// WHAT THIS PROVES: the .sr-combobox-list rule exists at TOP LEVEL (applies at
// every width), with the exact spec values; the keyframes it names exist; and
// the global prefers-reduced-motion rule that neutralizes it still collapses
// animation durations (the component adds no per-component reduced-motion
// query on purpose — the standing globals.css convention).
//
// WHAT IT CANNOT PROVE: that the animation visually plays, or that reduced
// motion renders an instant appear — jsdom loads no stylesheet and has no
// animation engine. The component half (the class reaching the listbox in all
// three sizes) is asserted in SpeciesCombobox.test.tsx.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseTopLevelRules } from './cssTopLevelRules'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const TOP = parseTopLevelRules(CSS)

describe('speciesCombobox row-truncation dependency (.sr-truncate)', () => {
  it('keeps the clipping declarations the no-text-overlap guarantee rests on', () => {
    // Both row spans (common name, scientific name) carry .sr-truncate; its
    // overflow clipping is what makes a crowded row truncate with an ellipsis
    // instead of painting one text across the other. The 40% cap on the sci
    // span (inline, pinned in SpeciesCombobox.test.tsx) bounds how crowded a
    // row can get; this pins the class those spans depend on.
    const body = TOP.get('.sr-truncate')
    expect(body).toBeTruthy()
    expect(body).toContain('overflow: hidden')
    expect(body).toContain('text-overflow: ellipsis')
    expect(body).toContain('white-space: nowrap')
    expect(body).toContain('min-width: 0')
  })
})

describe('speciesCombobox listbox entrance motion (globals.css)', () => {
  it('declares the 140ms ease-out origin-aware entrance at top level', () => {
    const body = TOP.get('.sr-combobox-list')
    expect(body).toBeTruthy()
    // The Motion Spec values, exactly: 140ms, the ease-out cubic-bezier, and
    // an origin at the input edge so the list scales FROM its trigger.
    expect(body).toContain('animation: sr-combobox-list-in 140ms cubic-bezier(0.2, 0, 0, 1)')
    expect(body).toContain('transform-origin: top center')
  })

  it('the keyframes it names exist and scale from the input (opacity + scaleY)', () => {
    // Keyframes are an at-rule, outside parseTopLevelRules' map by design;
    // slice the block out of the raw stylesheet.
    const start = CSS.indexOf('@keyframes sr-combobox-list-in')
    expect(start).toBeGreaterThan(-1)
    const block = CSS.slice(start, CSS.indexOf('}', CSS.indexOf('to', start)) + 1)
    expect(block).toContain('scaleY(0.96)')
    expect(block).toContain('scaleY(1)')
    expect(block).toContain('opacity: 0')
    expect(block).toContain('opacity: 1')
  })

  it('the global reduced-motion rule that neutralizes it is still in force', () => {
    // The component deliberately relies on the app-wide collapse (the entrance's
    // end state IS its resting state, so ~1 microsecond loses nothing). This
    // pins the mechanism that promise rests on: a universal-selector rule
    // inside the prefers-reduced-motion media block collapsing animation
    // durations with !important.
    const marker = '@media (prefers-reduced-motion: reduce)'
    let found = false
    let idx = CSS.indexOf(marker)
    while (idx !== -1) {
      // Walk this media block's braces to slice exactly its body.
      const open = CSS.indexOf('{', idx)
      let depth = 1
      let i = open + 1
      while (i < CSS.length && depth > 0) {
        if (CSS[i] === '{') depth++
        else if (CSS[i] === '}') depth--
        i++
      }
      const block = CSS.slice(open + 1, i - 1)
      if (block.includes('*, *::before, *::after') &&
          block.includes('animation-duration: 0.001ms !important')) {
        found = true
        break
      }
      idx = CSS.indexOf(marker, i)
    }
    expect(found).toBe(true)
  })
})
