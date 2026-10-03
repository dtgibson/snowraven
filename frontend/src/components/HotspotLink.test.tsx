// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { HotspotLink, hotspotLinkAriaLabel, type HotspotLinkProps } from './HotspotLink'
import UNCHANGED from './HotspotLink.unchanged.fixture.json'

afterEach(cleanup)

describe('HotspotLink', () => {
  it('links a public hotspot to its eBird page with the canonical accessible name', () => {
    render(<HotspotLink locId="L99" name="Crissy Field" isHotspot />)
    const link = screen.getByRole('link', { name: hotspotLinkAriaLabel('Crissy Field') })
    expect(link.getAttribute('href')).toBe('https://ebird.org/hotspot/L99')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(link.textContent).toContain('Crissy Field')
  })

  it('renders plain text (no link) for a non-hotspot personal location', () => {
    render(<HotspotLink locId="L1234" name="My Backyard" isHotspot={false} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('My Backyard')).toBeTruthy()
  })

  it('renders plain text when the id is the wrong shape, even if flagged a hotspot', () => {
    // A junk id must never produce a styled 404 link (the standing security check).
    render(<HotspotLink locId="not-an-id" name="Mystery Spot" isHotspot />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Mystery Spot')).toBeTruthy()
  })

  it('compact mode links with an icon only but keeps the full accessible name', () => {
    render(<HotspotLink locId="L7" name="Pier 7" isHotspot compact />)
    const link = screen.getByRole('link', { name: hotspotLinkAriaLabel('Pier 7') })
    expect(link.querySelector('svg')).toBeTruthy()
    // The visible text omits the name in compact mode (icon-only).
    expect(link.textContent?.trim()).not.toContain('Pier 7')
  })

  it('clamps a truncating hotspot LINK to its parent width so a long name cannot overflow', () => {
    // The shaded county popup's top-3 renders public-hotspot place names through
    // the LINK branch with truncate. Without maxWidth:100% the inline-flex link
    // shrink-to-fits to max-content and ran off the popup's right edge (the latent
    // bug the v0.5.48 county-name wrap did not cover). Parity with the plain branch.
    render(<HotspotLink locId="L42" name="A Very Long Hotspot Name That Would Overflow" isHotspot truncate />)
    const link = screen.getByRole('link', { name: hotspotLinkAriaLabel('A Very Long Hotspot Name That Would Overflow') })
    expect(link.style.maxWidth).toBe('100%')
    expect(link.style.minWidth).toBe('0px')
    // The inner span carries the ellipsis mechanism.
    expect(link.querySelector('.sr-truncate')).toBeTruthy()
  })

  it('does not force maxWidth on a non-truncating hotspot link (parity with the plain branch)', () => {
    render(<HotspotLink locId="L43" name="Short Spot" isHotspot />)
    const link = screen.getByRole('link', { name: hotspotLinkAriaLabel('Short Spot') })
    expect(link.style.maxWidth).toBe('')
  })
})

// ── The full-name link: the glyph follows the last word (targets-hotspot-link) ──
//
// The full-name branch (neither truncate nor compact) is inline flow: the name's
// lead in a plain span, then ONE inline-block holding the last word and the
// glyph, so on a wrapping name the glyph sits right after the last word.

/** The anchor's two parts, read off the DOM. */
function parts(name: string) {
  const { container } = render(<HotspotLink locId="L5" name={name} isHotspot />)
  const a = container.querySelector('a')!
  const spans = [...a.children] as HTMLElement[]
  const box = spans[spans.length - 1]
  const lead = spans.length === 2 ? spans[0] : null
  return { a, spans, box, lead }
}

describe('HotspotLink full-name link', () => {
  // Written as literals so a change to where the name is cut is caught here.
  const TABLE: Array<[name: string, lead: string, last: string]> = [
    ['Pier', '', 'Pier'],
    ['Crissy Field', 'Crissy ', 'Field'],
    ['Hayward Regional Shoreline--Winton Ave. entrance', 'Hayward Regional Shoreline--Winton Ave. ', 'entrance'],
    ['MLK Jr. Regional Shoreline--Arrowhead Marsh', 'MLK Jr. Regional Shoreline--Arrowhead ', 'Marsh'],
    // The last token is itself hyphenated: the cut is at the last SPACE only.
    ['Alviso--Marina', '', 'Alviso--Marina'],
    ['Don Edwards NWR--Alviso--Marina', 'Don Edwards ', 'NWR--Alviso--Marina'],
  ]

  it.each(TABLE)('splits %j at its last space, and the parts rejoin to the name', (name, lead, last) => {
    const p = parts(name)
    expect(p.lead?.textContent ?? '').toBe(lead)
    expect(p.box.firstChild!.nodeType).toBe(Node.TEXT_NODE)
    expect(p.box.firstChild!.textContent).toBe(last)
    expect((p.lead?.textContent ?? '') + p.box.textContent).toBe(name)
    expect(p.a.textContent).toBe(name)
    cleanup()
  })

  it('never adds or drops a character, over a generated corpus of names', () => {
    // Every sequence of up to four tokens, spaces (single, double, leading,
    // trailing) and "--" runs included, so the property is checked over shapes
    // nobody thought to type.
    const TOKENS = ['Park', 'A', '--', 'Lake--Shore', ' ', '  ', 'Ave.']
    const names = new Set<string>()
    const build = (prefix: string, depth: number) => {
      if (depth === 0) return
      for (const t of TOKENS) { names.add(prefix + t); build(prefix + t, depth - 1) }
    }
    build('', 4)
    expect(names.size).toBeGreaterThan(2000)
    for (const name of names) {
      const p = parts(name)
      const lead = p.lead?.textContent ?? ''
      const last = p.box.firstChild?.nodeType === Node.TEXT_NODE ? p.box.firstChild.textContent! : ''
      expect(lead + last, JSON.stringify(name)).toBe(name)
      // The last part holds no space; the lead, when present, ends with the cut space.
      expect(last.includes(' '), JSON.stringify(name)).toBe(false)
      if (p.lead) expect(lead.endsWith(' '), JSON.stringify(name)).toBe(true)
      expect(p.box.querySelectorAll('svg')).toHaveLength(1)
      cleanup()
    }
  })

  it('a one-word name is one box: the word and the glyph, with no lead span', () => {
    const p = parts('Pier')
    expect(p.spans).toHaveLength(1)
    expect(p.lead).toBeNull()
    expect(p.box.textContent).toBe('Pier')
    expect(p.box.lastElementChild!.tagName.toLowerCase()).toBe('svg')
  })

  it('the glyph lives in the same inline-block as the last word, never in the lead or bare in the anchor', () => {
    const p = parts('Coyote Hills Regional Park')
    expect(p.spans).toHaveLength(2)
    expect(p.a.querySelectorAll('svg')).toHaveLength(1)
    const svg = p.a.querySelector('svg')!
    expect(svg.parentElement).toBe(p.box)
    expect(p.lead!.querySelector('svg')).toBeNull()
    expect(p.box.style.display).toBe('inline-block')
    expect(p.box.style.maxWidth).toBe('100%')
    expect(p.box.style.overflowWrap).toBe('anywhere')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    // Tailwind preflight makes every svg display:block, which drops the glyph onto
    // a line of its own under the last word. jsdom loads no stylesheet and cannot
    // see that, so the inline override is pinned here; the real-engine check is in
    // the build's browser probe (ui.md, the inline lucide glyph rule).
    expect(svg.style.display).toBe('inline-block')
    expect(svg.style.marginLeft).toBe('3px')
    expect(svg.style.verticalAlign).toBe('baseline')
    expect(svg.getAttribute('width')).toBe('10')
  })

  it('the anchor is inline flow, keeps the caller style, and is always the accent color', () => {
    const { container } = render(
      <HotspotLink locId="L6" name="Every Sighting Spot" isHotspot style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-text-muted)' }} />,
    )
    const a = container.querySelector('a')!
    expect(a.style.display).toBe('')
    expect(a.style.textDecoration).toBe('none')
    expect(a.style.fontSize).toBe('0.75rem')
    expect(a.style.fontWeight).toBe('600')
    expect(a.style.color).toBe('var(--sr-accent)')
  })

  it('the accessible name is unchanged: the whole name in the shared formula', () => {
    render(<HotspotLink locId="L9" name="Hayward Regional Shoreline--Winton Ave. entrance" isHotspot title="t" className="c" />)
    const link = screen.getByRole('link', { name: 'Open Hayward Regional Shoreline--Winton Ave. entrance on eBird (opens in a new tab)' })
    expect(link.getAttribute('href')).toBe('https://ebird.org/hotspot/L9')
    expect(link.getAttribute('title')).toBe('t')
    expect(link.className).toBe('c')
  })
})

// ── Every other branch renders byte-identically to the base commit ─────────────
//
// HotspotLink.unchanged.fixture.json was captured from the UNEDITED component
// at the base commit, before this build touched it (testing.md, v1.0.38). Each
// case below is rendered and compared to it as a string, so any change to the
// truncate, compact or plain markup fails here.

const UNCHANGED_CASES: Record<string, HotspotLinkProps> = {
  'truncate link': { locId: 'L42', name: 'Hayward Regional Shoreline--Winton Ave. entrance', isHotspot: true, truncate: true, title: 'Hayward Regional Shoreline--Winton Ave. entrance', style: { fontSize: '0.75rem', color: 'var(--sr-text-muted)', minWidth: 0 } },
  'truncate link, md, caller layout keys': { locId: 'L43', name: 'Coyote Hills Regional Park', isHotspot: true, truncate: true, size: 'md', style: { color: 'var(--sr-text-muted)', maxWidth: '100%', justifyContent: 'flex-end' } },
  'compact link': { locId: 'L7', name: 'Pier 7', isHotspot: true, compact: true, className: 'sr-map-icon-btn-touch', style: { flexShrink: 0, width: 26, height: 26, justifyContent: 'center' } },
  'compact link, md': { locId: 'L8', name: 'Lake Merritt', isHotspot: true, compact: true, size: 'md' },
  'plain, personal': { locId: 'L1234', name: 'My Backyard', isHotspot: false, style: { color: 'var(--sr-text-muted)' } },
  'plain, personal, truncate': { locId: 'L1234', name: 'My Backyard Feeder Station', isHotspot: false, truncate: true, title: 'My Backyard Feeder Station', style: { fontSize: '0.75rem' } },
  'plain, junk id': { locId: 'not-an-id', name: 'Mystery Spot', isHotspot: true },
}

describe('HotspotLink truncate, compact and plain branches are unchanged', () => {
  it('the fixture and the case table name the same cases', () => {
    expect(Object.keys(UNCHANGED_CASES).sort()).toEqual(Object.keys(UNCHANGED).sort())
  })

  it.each(Object.keys(UNCHANGED_CASES))('%s renders the base markup byte for byte', key => {
    const { container } = render(<HotspotLink {...UNCHANGED_CASES[key]} />)
    expect(container.innerHTML).toBe((UNCHANGED as Record<string, string>)[key])
  })
})
