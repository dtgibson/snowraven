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

  it('shows the scientific name only when showSci is set', () => {
    const { rerender, queryByText } = render(
      <BirdName commonName="American Robin" scientificName="Turdus migratorius" />
    )
    expect(queryByText('Turdus migratorius')).toBeNull()
    rerender(<BirdName commonName="American Robin" scientificName="Turdus migratorius" showSci />)
    expect(queryByText('Turdus migratorius')).toBeTruthy()
  })
})
