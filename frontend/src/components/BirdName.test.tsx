// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BirdName } from './BirdName'

afterEach(cleanup)

describe('BirdName', () => {
  it('renders the common name as a link and calls onOpenSpecies when hasEntry', () => {
    const onOpen = vi.fn()
    render(<BirdName commonName="American Robin" hasEntry onOpenSpecies={onOpen} />)
    const btn = screen.getByRole('button', { name: 'American Robin' })
    fireEvent.click(btn)
    expect(onOpen).toHaveBeenCalledWith('American Robin')
  })

  it('renders plain text (no button) when there is no entry', () => {
    render(<BirdName commonName="Spotted Owl" hasEntry={false} onOpenSpecies={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Spotted Owl')).toBeTruthy()
  })

  it('renders plain text when onOpenSpecies is missing even if hasEntry', () => {
    render(<BirdName commonName="House Sparrow" hasEntry />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the eBird + Birds of the World favicon links when a taxonCode is given', () => {
    const { container } = render(<BirdName commonName="Anna's Hummingbird" taxonCode="annhum" />)
    const links = container.querySelectorAll('a[href]')
    const hrefs = [...links].map(a => a.getAttribute('href'))
    expect(hrefs.some(h => h?.includes('ebird.org/species/annhum'))).toBe(true)
    expect(hrefs.some(h => h?.includes('birdsoftheworld.org/bow/species/annhum'))).toBe(true)
  })

  it('omits favicons when no taxonCode is provided', () => {
    const { container } = render(<BirdName commonName="Mystery Bird" />)
    expect(container.querySelectorAll('a[href]').length).toBe(0)
  })

  it('wraps each favicon in a fixed-size slot so a slow or failed load cannot shift layout', () => {
    const { container } = render(<BirdName commonName="Anna's Hummingbird" taxonCode="annhum" />)
    const slots = container.querySelectorAll('.sr-favicon-slot')
    expect(slots.length).toBe(2)
    for (const slot of slots) {
      // The favicon is the mark a user normally sees, and the slot is its box.
      expect(slot.querySelector('img.sr-favicon')).toBeTruthy()
      expect(slot.querySelector('svg')).toBeNull()
    }
  })

  it('shows a fallback glyph in the same slot when a favicon fails, never an empty one', () => {
    const { container } = render(<BirdName commonName="Anna's Hummingbird" taxonCode="annhum" />)
    for (const img of container.querySelectorAll('img.sr-favicon')) fireEvent.error(img)

    const slots = container.querySelectorAll('.sr-favicon-slot')
    expect(slots.length).toBe(2)
    for (const slot of slots) {
      // The image is never unmounted -- it holds the reserved box and can still
      // report a late success -- and the glyph is revealed over it.
      expect(slot.querySelector('img.sr-favicon')).toBeTruthy()
      expect(slot.querySelector('svg')).toBeTruthy()
    }
    // The names the links announce are unchanged by the substitution.
    expect(screen.getByRole('link', { name: "View Anna's Hummingbird on eBird (opens in a new tab)" })).toBeTruthy()
  })

  it('shows the scientific name only when showSci is set', () => {
    const { rerender, queryByText } = render(
      <BirdName commonName="American Robin" scientificName="Turdus migratorius" />
    )
    expect(queryByText('Turdus migratorius')).toBeNull()
    rerender(<BirdName commonName="American Robin" scientificName="Turdus migratorius" showSci />)
    expect(queryByText('Turdus migratorius')).toBeTruthy()
  })

  // taxonomic-splits-lumps: the default-off opt-in that lets a slash name wrap
  // after its "/" rather than mid-word. <wbr> adds no character, so the text
  // and the accessible name are unchanged, and the default is byte-identical.
  it('breakAfterSlash puts a <wbr> after each "/" and changes neither the text nor the default markup', () => {
    const name = 'European/African/Eastern Red-rumped Swallow'
    const plain = render(<BirdName commonName={name} />).container.innerHTML
    cleanup()
    const off = render(<BirdName commonName={name} breakAfterSlash={false} />).container
    expect(off.innerHTML).toBe(plain)
    expect(off.querySelectorAll('wbr')).toHaveLength(0)
    cleanup()
    const on = render(<BirdName commonName={name} breakAfterSlash />).container
    expect(on.querySelectorAll('wbr')).toHaveLength(2)
    expect(on.textContent).toBe(name)
    cleanup()
    render(<BirdName commonName={name} breakAfterSlash hasEntry onOpenSpecies={() => {}} />)
    expect(screen.getByRole('button', { name }).querySelectorAll('wbr')).toHaveLength(2)
    cleanup()
    const noSlash = render(<BirdName commonName="Redpoll" breakAfterSlash />).container.innerHTML
    cleanup()
    expect(noSlash).toBe(render(<BirdName commonName="Redpoll" />).container.innerHTML)
  })
})
