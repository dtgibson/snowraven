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
import { DEFAULT_TAB_ORDER, TAB_LABELS } from './tabLayout'

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

  it('covers all 18 sections, including the three that were unreachable before v0.5.75', () => {
    // 16 until the command palette added Search after Getting Started, 17 until
    // targets-tab added Targets between Calendar and Map Explorer. The count
    // is asserted rather than derived so that ADDING a section is a deliberate,
    // reviewable act: the parity test above would happily accept a section that
    // was added to both sides by accident.
    expect(mdSections).toHaveLength(18)
    expect(tocTopLevel).toHaveLength(18)
    for (const label of ['Calendar', 'Using SnowRaven offline', 'Updating SnowRaven', 'Search', 'Targets']) {
      expect(tocTopLevel.map(t => t.label)).toContain(label)
    }
  })

  it('the Projects sub-entry exists and resolves to its `###` heading', () => {
    // FR-58: the heading, the TOC entry and this guard land in the same edit,
    // which is the whole reason the parity test exists (three sections once
    // shipped as content and stayed unreachable from the sidebar for versions).
    const start = helpSrc.indexOf('const TOC')
    const body = helpSrc.slice(start, helpSrc.indexOf('\n]', start))
    expect(body).toContain("id: 'projects'")
    const h3s = helpMd.split('\n').filter(l => l.startsWith('### ')).map(l => l.slice(4).trim())
    expect(h3s).toContain('Projects')
    expect(textToId('Projects')).toBe('projects')
    // ...and it sits under Statistics, between Effort and Outings and Data
    // Quality, matching the tab's own section order and the jump-nav chip.
    const order = helpMd.split('\n').filter(l => l.startsWith('### ')).map(l => l.slice(4).trim())
    expect(order.indexOf('Projects')).toBeGreaterThan(order.indexOf('Effort and Outings'))
    expect(order.indexOf('Projects')).toBeLessThan(order.indexOf('Data Quality'))
  })

  it('the Bar-chart files sub-entry exists and resolves to its `###` heading under Settings (icloud-bar-chart-sync)', () => {
    // The heading, the TOC entry and this row land in the same edit (the
    // reason this parity file exists).
    const start = helpSrc.indexOf('const TOC')
    const body = helpSrc.slice(start, helpSrc.indexOf('\n]', start))
    expect(body).toContain("{ id: 'bar-chart-files',      label: 'Bar-chart files',        sub: true  }")
    expect(textToId('Bar-chart files')).toBe('bar-chart-files')
    const order = helpMd.split('\n').filter(l => l.startsWith('### ')).map(l => l.slice(4).trim())
    expect(order).toContain('Bar-chart files')
    // ...between Tab Layout and Troubleshooting, the order Settings draws them in,
    // and its TOC entry sits after the Settings entry and before the next section.
    expect(order.indexOf('Bar-chart files')).toBe(order.indexOf('Tab Layout') + 1)
    expect(order.indexOf('Troubleshooting (Mac, Windows, iPhone and iPad)')).toBe(order.indexOf('Bar-chart files') + 1)
    expect(body.indexOf("id: 'bar-chart-files'")).toBeGreaterThan(body.indexOf("id: 'settings'"))
    expect(body.indexOf("id: 'bar-chart-files'")).toBeLessThan(body.indexOf("id: 'using-snowraven-offline'"))
  })

  it('the tab sections run in DEFAULT_TAB_ORDER, named through TAB_LABELS, in HELP.md and in the TOC (help-docs-refresh)', () => {
    // The app's navigation, README and the website all list the tabs in this
    // order; Help drifted from it a section at a time. Every tab has its own
    // `##` section, and they form one run between Default Files and Settings.
    const tabs = DEFAULT_TAB_ORDER.map(t => TAB_LABELS[t])
    for (const label of tabs) expect(mdSections, label).toContain(label)
    const at = mdSections.indexOf(tabs[0])
    expect(mdSections.slice(at, at + tabs.length)).toEqual(tabs)
    expect(mdSections[at - 1]).toBe('Default Files')
    expect(mdSections[at + tabs.length]).toBe('Settings')
    // The sidebar follows the same order (the parity row above implies it; this
    // says why a reorder of either side goes red here by name).
    const toc = tocTopLevel.map(t => t.label)
    const tocAt = toc.indexOf(tabs[0])
    expect(toc.slice(tocAt, tocAt + tabs.length)).toEqual(tabs)
  })

  it('the Widgets sub-entry exists and resolves to its `###` heading under Map Explorer (help-docs-refresh)', () => {
    // The heading, the TOC entry and this row land in the same edit (the
    // reason this parity file exists).
    const start = helpSrc.indexOf('const TOC')
    const body = helpSrc.slice(start, helpSrc.indexOf('\n]', start))
    expect(body).toContain("{ id: 'widgets',              label: 'Widgets',                sub: true  }")
    expect(textToId('Widgets')).toBe('widgets')
    // The heading sits inside the Map Explorer section, before the next `##`.
    const lines = helpMd.split('\n')
    const map = lines.indexOf('## Map Explorer')
    const next = lines.findIndex((l, i) => i > map && l.startsWith('## '))
    const at = lines.indexOf('### Widgets')
    expect(map).toBeGreaterThan(-1)
    expect(at).toBeGreaterThan(map)
    expect(at).toBeLessThan(next)
    // ...and its TOC entry sits after the Map Explorer entry and before the next section's.
    const nextId = tocTopLevel[tocTopLevel.findIndex(t => t.id === 'map-explorer') + 1].id
    expect(body.indexOf("id: 'widgets'")).toBeGreaterThan(body.indexOf("id: 'map-explorer'"))
    expect(body.indexOf("id: 'widgets'")).toBeLessThan(body.indexOf(`id: '${nextId}'`))
  })

  it('the Alerts sub-entry exists and resolves to its `###` heading under Settings (help-docs-refresh)', () => {
    const start = helpSrc.indexOf('const TOC')
    const body = helpSrc.slice(start, helpSrc.indexOf('\n]', start))
    expect(body).toContain("{ id: 'alerts-iphone-and-ipad', label: 'Alerts',               sub: true  }")
    expect(textToId('Alerts (iPhone and iPad)')).toBe('alerts-iphone-and-ipad')
    const order = helpMd.split('\n').filter(l => l.startsWith('### ')).map(l => l.slice(4).trim())
    expect(order).toContain('Alerts (iPhone and iPad)')
    // ...between Default Location and Tab Layout, the order Settings draws them
    // in, and its TOC entry sits after Settings and before Bar-chart files.
    expect(order.indexOf('Alerts (iPhone and iPad)')).toBe(order.indexOf('Default Location') + 1)
    expect(order.indexOf('Tab Layout')).toBe(order.indexOf('Alerts (iPhone and iPad)') + 1)
    expect(body.indexOf("id: 'alerts-iphone-and-ipad'")).toBeGreaterThan(body.indexOf("id: 'settings'"))
    expect(body.indexOf("id: 'alerts-iphone-and-ipad'")).toBeLessThan(body.indexOf("id: 'bar-chart-files'"))
  })

  it('the Settings walkthrough follows the order Settings draws its sections in (help-docs-refresh)', () => {
    // The app's own sequence is pinned in components/settingsSectionOrder.test.tsx
    // (iPhone and iPad render every section; the other platforms render a subset
    // in the same relative order). HELP's `###` headings under Settings carry a
    // platform note in parentheses where a section is platform-gated; that note
    // is not part of the on-screen header, so it is dropped before comparing.
    const lines = helpMd.split('\n')
    const settings = lines.indexOf('## Settings')
    const end = lines.findIndex((l, i) => i > settings && l.startsWith('## '))
    expect(settings).toBeGreaterThan(-1)
    const walkthrough = lines.slice(settings, end)
      .filter(l => l.startsWith('### '))
      .map(l => l.slice(4).replace(/\s*\([^)]*\)$/, '').trim())
    expect(walkthrough).toEqual([
      'API Keys', 'Default Files', 'iCloud Sync', 'Help & Documentation', 'Appearance', 'Sharing',
      'Default Location', 'Alerts', 'Tab Layout', 'Bar-chart files', 'Troubleshooting', 'Acknowledgments',
    ])
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
