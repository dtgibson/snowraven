// Regression guard for the in-app Help table of contents (v0.5.75).
//
// The bug this locks: docs/HELP.md is the single source of truth for Help content, and
// HelpDocs.tsx renders EVERY `##` section from it — but the sidebar TOC is a separate
// hand-maintained array. Three sections (Calendar, Using SnowRaven offline, Updating
// SnowRaven) shipped as content while never being added to that array, so for several
// versions they rendered in the body and were unreachable from the sidebar. Nothing
// failed; the sections were simply invisible unless you scrolled past everything else.
//
// We parse BOTH sides and assert they agree, so adding a `##` section to HELP.md without
// adding its TOC entry fails here.
//
// Why parse the source instead of importing TOC: HelpDocs.tsx is a component file, and
// exporting a const from it would trip react-refresh/only-export-components (the same
// constraint that put MediaEmbed's constants in lib/mediaEmbed.ts). Reading the source is
// the established pattern for this repo's structural guards — see entryChunk.test.ts.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const helpSrc = readFileSync(new URL('../components/HelpDocs.tsx', import.meta.url), 'utf8')
const helpMd = readFileSync(new URL('../../../docs/HELP.md', import.meta.url), 'utf8')

/** The id formula HelpDocs stamps on each rendered heading. Kept byte-identical here;
 *  if it changes there, this test's expectations must be re-derived deliberately. */
function textToId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
}

/** Top-level (`sub: false`) TOC entries, in declaration order. */
const tocTopLevel = (() => {
  const start = helpSrc.indexOf('const TOC')
  const end = helpSrc.indexOf('\n]', start)
  if (start < 0 || end < 0) throw new Error('could not locate the TOC array in HelpDocs.tsx')
  const body = helpSrc.slice(start, end)
  const out: { id: string; label: string }[] = []
  const re = /\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*sub:\s*(true|false)\s*\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (m[3] === 'false') out.push({ id: m[1], label: m[2] })
  }
  if (out.length === 0) throw new Error('parsed zero top-level TOC entries — the parser is stale')
  return out
})()

/** Every `##` (h2) section heading in HELP.md, in document order. */
const mdSections = helpMd
  .split('\n')
  .filter(l => l.startsWith('## '))
  .map(l => l.slice(3).trim())

describe('in-app Help TOC ↔ docs/HELP.md parity', () => {
  it('every `##` section in HELP.md has a top-level TOC entry, in the same order', () => {
    expect(tocTopLevel.map(t => t.label)).toEqual(mdSections)
  })

  it('every TOC id matches the id the renderer stamps on that heading', () => {
    // A mismatched id renders a jump link that silently goes nowhere.
    expect(tocTopLevel.map(t => t.id)).toEqual(mdSections.map(textToId))
  })

  it('covers all 16 sections, including the three that were unreachable before v0.5.75', () => {
    expect(mdSections).toHaveLength(16)
    expect(tocTopLevel).toHaveLength(16)
    for (const label of ['Calendar', 'Using SnowRaven offline', 'Updating SnowRaven']) {
      expect(tocTopLevel.map(t => t.label)).toContain(label)
    }
  })

  it('sub-entries reference real `###` headings in HELP.md', () => {
    const subIds = (() => {
      const start = helpSrc.indexOf('const TOC')
      const end = helpSrc.indexOf('\n]', start)
      const body = helpSrc.slice(start, end)
      const out: string[] = []
      const re = /\{\s*id:\s*'([^']+)',\s*label:\s*'[^']+',\s*sub:\s*true\s*\}/g
      let m: RegExpExecArray | null
      while ((m = re.exec(body)) !== null) out.push(m[1])
      return out
    })()
    const h3Ids = helpMd
      .split('\n')
      .filter(l => l.startsWith('### '))
      .map(l => textToId(l.slice(4).trim()))
    // The TOC lists a deliberate SUBSET of the h3s (HELP.md has 30+), so this checks
    // containment, not equality — but every listed one must actually exist.
    for (const id of subIds) expect(h3Ids).toContain(id)
  })
})
