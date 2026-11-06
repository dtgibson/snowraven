// @vitest-environment jsdom
// The "Checklists at hotspots" block's rendering (hotspot-share-stat, QA-13, QA-26,
// QA-28, QA-29). The copy sweep (lib/hotspotShareCopy.test.ts) cannot see a string
// the component builds for itself, so this file renders every view kind and holds
// every text node to the copy module's output for that view.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { HotspotShareBlock } from './HotspotShareBlock'
import { sharePctPair, type HotspotShareView } from '../lib/hotspotShare'
import { hotspotShareSentences, HOTSPOT_SHARE_NO_KEY, HOTSPOT_SHARE_ADD_KEY } from '../lib/hotspotShareCopy'

afterEach(cleanup)

const settled = (h: number, m: number): HotspotShareView =>
  ({ kind: 'settled', h, p: m - h, m, pct: sharePctPair(h, m), hotspotWidthPct: h / m * 100 })

const VIEWS: HotspotShareView[] = [
  settled(1234, 3300),
  settled(0, 5),
  settled(5, 5),
  { kind: 'pending', u: 3, m: 10, h: 4, p: 3 },
  { kind: 'pending', u: 10, m: 10, h: 0, p: 0 },
  { kind: 'offline', u: 3, m: 10, h: 4, p: 3 },
  { kind: 'unanswered', k: 1, r: 2, u: 3, m: 10, h: 4, p: 3 },
  { kind: 'no-region', u: 2, m: 12, h: 4, p: 6 },
  { kind: 'no-key' },
]

/** Every non-empty text node in the rendered block. */
function textNodes(root: HTMLElement): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent ?? '').trim()
    if (t) out.push(t)
  }
  return out
}

describe('the block renders only the copy module\'s strings (QA-26)', () => {
  it.each(VIEWS.map(v => [v.kind, v] as const))('%s', (_kind, view) => {
    const { container } = render(<HotspotShareBlock view={view} onGoToSettings={() => {}} />)
    const allowed = new Set<string>([HOTSPOT_SHARE_NO_KEY, HOTSPOT_SHARE_ADD_KEY])
    const sentences = hotspotShareSentences(view)
    for (const s of sentences) allowed.add(s)
    // The settled figures render as two spans each, split at the first space.
    if (view.kind === 'settled') {
      for (const s of sentences.slice(0, 2)) {
        const at = s.indexOf(' ')
        allowed.add(s.slice(0, at))
        allowed.add(s.slice(at + 1))
      }
    }
    const nodes = textNodes(container)
    expect(nodes.length).toBeGreaterThan(0)
    for (const t of nodes) expect(allowed.has(t), t).toBe(true)
  })

  it('the component source formats no count and spells no count-bearing word of its own', () => {
    const src = readFileSync('src/components/HotspotShareBlock.tsx', 'utf8')
    const code = src.split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
    expect(code).toContain('hotspotShareSentences(view)') // non-vacuity: the file was read
    expect(code).not.toMatch(/\bfmt\(/)
    expect(code).not.toMatch(/checklist/i)
  })
})

describe('the settled bar (QA-20, QA-28, QA-29)', () => {
  it('is aria-hidden, holds no text, and the block\'s text carries both counts, the denominator and both percentages', () => {
    const { container } = render(<HotspotShareBlock view={settled(1234, 3300)} onGoToSettings={() => {}} />)
    const bar = container.querySelector('.sr-hs-bar')!
    expect(bar.getAttribute('aria-hidden')).toBe('true')
    expect(textNodes(bar as HTMLElement)).toEqual([])
    const text = (container.textContent ?? '').replace(/\s+/g, ' ')
    for (const piece of ['37%', '63%', '1,234', '3,300', '2,066']) expect(text).toContain(piece)
    const hot = container.querySelector('.sr-hs-seg--hot') as HTMLElement
    expect(parseFloat(hot.style.width)).toBeCloseTo(37.3939, 3)
  })

  it('a share that rounds to zero keeps a visible sliver; none at hotspots has no floor', () => {
    const sliver = render(<HotspotShareBlock view={settled(3, 3300)} onGoToSettings={() => {}} />)
    expect((sliver.container.querySelector('.sr-hs-seg--hot') as HTMLElement).style.minWidth).toBe('3px')
    cleanup()
    const none = render(<HotspotShareBlock view={settled(0, 5)} onGoToSettings={() => {}} />)
    expect((none.container.querySelector('.sr-hs-seg--hot') as HTMLElement).style.minWidth).toBe('0px')
  })
})

describe('the no-key state (QA-13, FR-21)', () => {
  it('renders the sentence and a native button that calls the Settings route, and no bar, count or percentage', () => {
    const go = vi.fn()
    const { container } = render(<HotspotShareBlock view={{ kind: 'no-key' }} onGoToSettings={go} />)
    const button = screen.getByRole('button', { name: HOTSPOT_SHARE_ADD_KEY })
    expect(button.getAttribute('tabindex')).toBe('0')
    fireEvent.click(button)
    expect(go).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.sr-hs-bar')).toBeNull()
    expect(container.textContent).not.toMatch(/%|\d/)
    expect(container.textContent).toContain(HOTSPOT_SHARE_NO_KEY)
  })
})

describe('the status states (QA-15 to QA-19)', () => {
  it('carry no bar and no percentage, and the counts-so-far line only when something is classified', () => {
    for (const view of VIEWS.filter(v => v.kind !== 'settled' && v.kind !== 'no-key')) {
      const { container } = render(<HotspotShareBlock view={view} onGoToSettings={() => {}} />)
      expect(container.querySelector('.sr-hs-bar')).toBeNull()
      expect(container.textContent).not.toContain('%')
      const hp = 'h' in view ? view.h + view.p : 0
      expect(container.querySelector('.sr-hs-sofar') !== null, view.kind).toBe(hp > 0)
      cleanup()
    }
  })
})
