// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SpeciesLinks } from './SpeciesLinks'

afterEach(cleanup)

/** The two `<img>` favicons, in render order: eBird first, Birds of the World second. */
function favicons(container: HTMLElement): HTMLImageElement[] {
  return [...container.querySelectorAll<HTMLImageElement>('img.sr-favicon')]
}

/** The fallback glyph inside a mark's reserved slot, or null while the favicon shows. */
function glyphIn(link: Element): SVGElement | null {
  return link.querySelector<SVGElement>('.sr-favicon-slot svg')
}

describe('SpeciesLinks', () => {
  it('renders nothing without a species code', () => {
    const { container } = render(<SpeciesLinks speciesCode={undefined} />)
    expect(container.querySelectorAll('a[href]').length).toBe(0)
  })

  it('links to eBird and Birds of the World for the species code', () => {
    const { container } = render(<SpeciesLinks speciesCode="annhum" commonName="Anna's Hummingbird" />)
    const hrefs = [...container.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))
    expect(hrefs).toContain('https://ebird.org/species/annhum')
    expect(hrefs.some(h => h?.includes('birdsoftheworld.org/bow/species/annhum'))).toBe(true)
  })

  it('opens each favicon link in a new tab and announces that in the accessible name (F078)', () => {
    render(<SpeciesLinks speciesCode="annhum" commonName="Anna's Hummingbird" />)
    const ebird = screen.getByRole('link', { name: "View Anna's Hummingbird on eBird (opens in a new tab)" })
    const bow = screen.getByRole('link', { name: "View Anna's Hummingbird on Birds of the World (opens in a new tab)" })
    expect(ebird.getAttribute('target')).toBe('_blank')
    expect(bow.getAttribute('target')).toBe('_blank')
    // The visible title stays free of the parenthetical so the tooltip is terse.
    expect(ebird.getAttribute('title')).toBe("View Anna's Hummingbird on eBird")
  })

  it('falls back to a generic accessible name when no common name is given', () => {
    render(<SpeciesLinks speciesCode="annhum" />)
    expect(screen.getByRole('link', { name: 'View on eBird (opens in a new tab)' })).toBeTruthy()
  })

  // ── The href shape gate ────────────────────────────────────────────────────
  // A code that is not shaped like an eBird species code renders NOTHING, which
  // is exactly what the component already does when handed no code at all. Never
  // a styled link built from a junk value.

  it('renders nothing for a code that is not shaped like a species code', () => {
    for (const code of [
      'ANNHUM',                 // uppercase
      'a',                      // too short
      'a'.repeat(17),           // too long
      'ann hum',                // space
      'annhum/../etc/passwd',   // path traversal shape
      'annhum?x=1',             // query smuggling shape
      'javascript:alert(1)',    // scheme
      'annhum\n',               // trailing newline: JS `$` is end-of-input, so this misses
    ]) {
      const { container } = render(<SpeciesLinks speciesCode={code} commonName="Anna's Hummingbird" />)
      expect(container.querySelectorAll('a[href]').length, code).toBe(0)
      expect(container.innerHTML, code).toBe('')
      cleanup()
    }
  })

  it('leaves a well-formed code untouched in both hrefs, digits and hyphens included', () => {
    const { container } = render(<SpeciesLinks speciesCode="y00478" />)
    const hrefs = [...container.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))
    expect(hrefs).toEqual([
      'https://ebird.org/species/y00478',
      'https://birdsoftheworld.org/bow/species/y00478/cur/introduction',
    ])
    const dashed = render(<SpeciesLinks speciesCode="x-00001" />)
    expect([...dashed.container.querySelectorAll('a[href]')].length).toBe(2)
  })

  // ── The fallback glyph ─────────────────────────────────────────────────────

  it('shows a glyph in the reserved slot when a favicon fails, keeping the link intact', () => {
    const { container } = render(<SpeciesLinks speciesCode="annhum" commonName="Anna's Hummingbird" />)
    const links = [...container.querySelectorAll('a[href]')]
    expect(links.every(link => glyphIn(link) === null)).toBe(true)

    for (const img of favicons(container)) fireEvent.error(img)

    for (const link of links) {
      const glyph = glyphIn(link)
      expect(glyph).toBeTruthy()
      expect(glyph?.getAttribute('aria-hidden')).toBe('true')
      expect(glyph?.getAttribute('focusable')).toBe('false')
      // The image is never unmounted: it keeps the box it reserved and stays able
      // to report a late success.
      expect(link.querySelector('img.sr-favicon')).toBeTruthy()
      expect(link.querySelector<HTMLImageElement>('img.sr-favicon')?.style.visibility).toBe('hidden')
      expect((link as HTMLElement).style.padding).toBe('5px')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('tabindex')).toBe('0')
    }
    // Accessible name and destination are untouched by the substitution.
    const ebird = screen.getByRole('link', { name: "View Anna's Hummingbird on eBird (opens in a new tab)" })
    expect(ebird.getAttribute('href')).toBe('https://ebird.org/species/annhum')
    expect(screen.getByRole('link', { name: "View Anna's Hummingbird on Birds of the World (opens in a new tab)" })).toBeTruthy()
  })

  it('restores the favicon when a later load succeeds, so the failure is not latched', () => {
    const { container } = render(<SpeciesLinks speciesCode="annhum" commonName="Anna's Hummingbird" />)
    const [ebirdImg] = favicons(container)
    const ebirdLink = container.querySelectorAll('a[href]')[0]

    fireEvent.error(ebirdImg)
    expect(glyphIn(ebirdLink)).toBeTruthy()

    fireEvent.load(ebirdImg)
    expect(glyphIn(ebirdLink)).toBeNull()
    expect(favicons(container)[0].style.visibility).toBe('')
  })

  it('lets each mark decide for itself, so one favicon beside one glyph is a real state', () => {
    const { container } = render(<SpeciesLinks speciesCode="annhum" commonName="Anna's Hummingbird" />)
    const [ebirdLink, bowLink] = [...container.querySelectorAll('a[href]')]

    // eBird's favicon is a 302 with no cache headers and goes first offline; Birds
    // of the World's max-age=3600 can outlive it by up to an hour.
    fireEvent.error(favicons(container)[0])

    expect(glyphIn(ebirdLink)).toBeTruthy()
    expect(glyphIn(bowLink)).toBeNull()
    expect(favicons(container)[0].style.visibility).toBe('hidden')
    expect(favicons(container)[1].style.visibility).toBe('')
    // Both marks keep the same 14px slot, so the pair cannot shift.
    expect(container.querySelectorAll('.sr-favicon-slot').length).toBe(2)
  })

  it('pairs Globe with eBird and SquareLibrary with Birds of the World', () => {
    const { container } = render(<SpeciesLinks speciesCode="annhum" />)
    for (const img of favicons(container)) fireEvent.error(img)
    const [ebirdLink, bowLink] = [...container.querySelectorAll('a[href]')]
    // lucide stamps each icon with its own kebab-case class; that is the stable
    // handle on WHICH glyph rendered.
    expect(glyphIn(ebirdLink)?.getAttribute('class')).toContain('lucide-globe')
    expect(glyphIn(bowLink)?.getAttribute('class')).toContain('lucide-square-library')
  })

  it('draws the glyph as an svg in app ink, so the dark-theme favicon filter cannot reach it', () => {
    const { container } = render(<SpeciesLinks speciesCode="annhum" />)
    for (const img of favicons(container)) fireEvent.error(img)
    // `[data-theme="dark"] img.sr-favicon { filter: brightness(0) invert(1) }` is
    // img-scoped: the glyph is an <svg> and carries no `sr-favicon` class, so
    // inverting a token-coloured stroke is structurally impossible.
    expect(container.querySelectorAll('img.sr-favicon').length).toBe(2)
    for (const glyph of container.querySelectorAll('.sr-favicon-slot svg')) {
      expect(glyph.tagName.toLowerCase()).toBe('svg')
      expect(glyph.classList.contains('sr-favicon')).toBe(false)
      expect((glyph as SVGElement).style.color).toBe('var(--sr-text)')
      expect(glyph.getAttribute('stroke')).toBe('currentColor')
      expect(glyph.getAttribute('stroke-width')).toBe('2.2')
      expect(glyph.getAttribute('width')).toBe('14')
      expect(glyph.getAttribute('height')).toBe('14')
    }
  })

  it('adds no transition to the slot, the glyph or the anchor: a substitution is not an entrance', () => {
    const { container } = render(<SpeciesLinks speciesCode="annhum" />)
    for (const img of favicons(container)) fireEvent.error(img)
    for (const el of container.querySelectorAll<HTMLElement>('*')) {
      expect(el.getAttribute('style') ?? '').not.toContain('transition')
    }
  })
})
