// Drift guard for the published privacy policy page (ios-app-store-release).
//
// PRIVACY_POLICY.md is the canonical policy; website/privacy.html is a
// hand-maintained mirror of it, published at snowraven.dtgibson.com/privacy.html
// and entered as the App Store Connect privacy policy URL. Every hand-kept
// mirror of a single-source document in this repo has drifted before (the Help
// TOC lost three sections for several versions with nothing failing), so the
// mirror gets a parity test: helpToc.test.ts is the precedent and the pattern.
//
// What this asserts: the page's h2 headings are exactly the policy's `##`
// sections, same set, same order, and each carries the anchor id the page's
// own slug convention produces. The page's lead band deliberately renders its
// "Data Not Collected" headline as a styled paragraph, not an h2, so the h2
// sequence stays clean for exactly this assertion (the page says so in a
// comment beside the band).
//
// Body-text parity stays under the standing same-edit rule (QA-06 checks it
// section for section); headings are the automated tripwire because a section
// added, removed, renamed, or reordered on one side only is the drift that
// hides longest.
//
// This file is test-only and never bundled, but any file under frontend/ is a
// Tailwind source (auto source detection scans the build root), so its words
// can mint CSS rules. The shipped-bundle byte-compare for this addition is
// recorded in pipeline/ios-app-store-release/decisions.md.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const policy = readFileSync(new URL('../../../PRIVACY_POLICY.md', import.meta.url), 'utf8')
const page = readFileSync(new URL('../../../website/privacy.html', import.meta.url), 'utf8')

/** Every `##` (h2) section heading in the canonical policy, in document order. */
const policySections = policy
  .split('\n')
  .filter(l => l.startsWith('## '))
  .map(l => l.slice(3).trim())

/** Every <h2> on the page, in document order, with its id attribute. */
const pageH2s = (() => {
  const out: { id: string; text: string }[] = []
  const re = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(page)) !== null) {
    const idMatch = /id="([^"]*)"/.exec(m[1])
    out.push({ id: idMatch ? idMatch[1] : '', text: m[2].replace(/<[^>]+>/g, '').trim() })
  }
  return out
})()

/** The page's anchor-id convention (the helpToc textToId formula). */
function textToId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
}

describe('website/privacy.html ↔ PRIVACY_POLICY.md parity', () => {
  it('parses a non-empty section list from both sides', () => {
    // Vacuity guard: a broken parser must fail here, not pass the set check
    // on two empty arrays.
    expect(policySections.length).toBeGreaterThan(0)
    expect(pageH2s.length).toBeGreaterThan(0)
  })

  it('the page h2 set and order mirror the policy `##` sections exactly', () => {
    expect(pageH2s.map(h => h.text)).toEqual(policySections)
  })

  it('every page h2 carries the anchor id its own slug convention produces', () => {
    expect(pageH2s.map(h => h.id)).toEqual(policySections.map(textToId))
  })

  it('covers all 12 sections, including the iOS App section added at the App Store launch', () => {
    expect(policySections).toHaveLength(12)
    for (const label of ['Overview', 'iOS App', 'Software Updates', 'Contact']) {
      expect(policySections).toContain(label)
    }
    // The iOS App section sits between Map Tiles and the embedded-media
    // section, where the launch edit placed it.
    expect(policySections.indexOf('iOS App')).toBe(policySections.indexOf('Map Tiles') + 1)
  })

  it('the lead band headline is not an h2 (the h2 sequence belongs to the policy alone)', () => {
    expect(pageH2s.map(h => h.text)).not.toContain('Data Not Collected')
  })
})
