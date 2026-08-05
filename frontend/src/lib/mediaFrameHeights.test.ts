// Regression guard for the Named Birds media tile heights (v0.5.75).
//
// The bug this locks: `.sr-media-iframe--audio` was 116px desktop / 130px phone, but
// `.sr-media-frame` sets `overflow: hidden`, so the Macaulay audio player's transport
// row was cut off below the frame edge — the recording was visible and unplayable.
// A component test cannot catch this: jsdom applies no stylesheet, so the height only
// exists in the CSS. We parse the REAL shipped rules instead, so a future edit that
// shrinks audio back under the player's chrome fails here rather than in a user's ears.
//
// We assert the audio height MATCHES photo/video rather than pinning a magic number,
// because the point is the relationship: audio must not be the short one again. The
// tier values are checked too, since the phone tier is the one that regressed silently
// (its rules are re-stated inside the media query to beat the 360px base).
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Vitest stubs `.css` imports (`?raw` included), so read the stylesheet directly. Node
// types are pulled in for this one file via the reference above, matching the scoping
// used by milestoneContrast.test.ts / calendarContrast.test.ts.
const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

/**
 * The ≤640 phone tier. globals.css contains SEVERAL `@media (max-width: 640px)`
 * blocks, so we brace-match every one and concatenate them; taking only the first
 * (or delimiting on a line-leading "}") silently picks up an unrelated block.
 * Returns the tier text and the [start, end) spans so the desktop scope can be
 * built by removing exactly those regions.
 */
const { phoneTier, desktop } = (() => {
  const marker = /@media\s*\(max-width:\s*640px\)/g
  const spans: [number, number][] = []
  let m: RegExpExecArray | null
  while ((m = marker.exec(css)) !== null) {
    const open = css.indexOf('{', m.index)
    if (open < 0) throw new Error('a ≤640 media query has no opening brace')
    let depth = 0
    let i = open
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    if (depth !== 0) throw new Error('unbalanced braces in a ≤640 media query')
    spans.push([m.index, i + 1])
  }
  if (spans.length === 0) throw new Error('no ≤640 phone tier block found in globals.css')

  const tierText = spans.map(([s, e]) => css.slice(s, e)).join('\n')
  // Desktop = everything outside those spans.
  let rest = ''
  let cursor = 0
  for (const [s, e] of spans) {
    rest += css.slice(cursor, s)
    cursor = e
  }
  rest += css.slice(cursor)
  return { phoneTier: tierText, desktop: rest }
})()

/**
 * Last declared height for a modifier class in `scope`, in px.
 * Handles both the shared selector list (`--photo,\n--video { height: … }`) and a
 * rule of its own, and takes the LAST match so source order (which is what the
 * cascade resolves at equal specificity) decides.
 */
function heightOf(scope: string, modifier: string): number {
  const re = new RegExp(
    `(?:^|[,{}\\s])\\.sr-media-iframe--${modifier}\\s*(?:,\\s*\\.sr-media-iframe--[a-z]+\\s*)*\\{[^}]*?height:\\s*(\\d+)px`,
    'gm',
  )
  // Also match when the modifier is the SECOND selector in a shared list.
  const reShared = new RegExp(
    `\\.sr-media-iframe--[a-z]+\\s*,\\s*\\.sr-media-iframe--${modifier}\\s*\\{[^}]*?height:\\s*(\\d+)px`,
    'gm',
  )
  let found: number | null = null
  for (const r of [re, reShared]) {
    let m: RegExpExecArray | null
    while ((m = r.exec(scope)) !== null) found = Number(m[1])
  }
  if (found === null) throw new Error(`no height found for .sr-media-iframe--${modifier}`)
  return found
}

describe('Named Birds media tile heights — audio must clear the player chrome', () => {
  it('desktop: audio is the same height as photo and video (never the short one)', () => {
    const audio = heightOf(desktop, 'audio')
    expect(audio).toBe(heightOf(desktop, 'photo'))
    expect(audio).toBe(heightOf(desktop, 'video'))
    expect(audio).toBe(230)
  })

  it('phone tier (≤640): audio is the same height as photo and video', () => {
    const audio = heightOf(phoneTier, 'audio')
    expect(audio).toBe(heightOf(phoneTier, 'photo'))
    expect(audio).toBe(heightOf(phoneTier, 'video'))
    expect(audio).toBe(280)
  })

  it('audio is never returned to a compact height that clips the transport row', () => {
    // The two shipped-and-broken values, named so a revert is unambiguous.
    expect(heightOf(desktop, 'audio')).not.toBe(116)
    expect(heightOf(phoneTier, 'audio')).not.toBe(130)
  })

  it('the phone tier is TALLER than desktop (a one-column tile is wider, so its player is taller)', () => {
    expect(heightOf(phoneTier, 'audio')).toBeGreaterThan(heightOf(desktop, 'audio'))
  })

  it('--audio keeps its OWN rule rather than being folded into --recent', () => {
    // Species Detail's --recent and Named Birds' per-format classes are numerically
    // equal today but must stay independently tunable (the v0.5.71 per-caller-height
    // decision). Collapsing them would make any future per-format tune a two-surface
    // change, so the class must still be declared in both tiers.
    expect(css).toMatch(/\.sr-media-iframe--audio\s*\{/)
    expect(css).toMatch(/\.sr-media-iframe--recent\s*\{/)
    expect(phoneTier).toMatch(/\.sr-media-iframe--audio\s*\{/)
  })
})
