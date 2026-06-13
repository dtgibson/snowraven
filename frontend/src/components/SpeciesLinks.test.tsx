// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SpeciesLinks } from './SpeciesLinks'

afterEach(cleanup)

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
    const ebird = screen.getByRole('link', { name: "View Anna's Hummingbird on eBird (opens in new tab)" })
    const bow = screen.getByRole('link', { name: "View Anna's Hummingbird on Birds of the World (opens in new tab)" })
    expect(ebird.getAttribute('target')).toBe('_blank')
    expect(bow.getAttribute('target')).toBe('_blank')
    // The visible title stays free of the parenthetical so the tooltip is terse.
    expect(ebird.getAttribute('title')).toBe("View Anna's Hummingbird on eBird")
  })

  it('falls back to a generic accessible name when no common name is given', () => {
    render(<SpeciesLinks speciesCode="annhum" />)
    expect(screen.getByRole('link', { name: 'View on eBird (opens in new tab)' })).toBeTruthy()
  })
})
