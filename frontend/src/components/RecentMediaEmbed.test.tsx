// @vitest-environment jsdom
// Species Detail Recent Media: the embed plus the info + attribution row beneath it.
// The Macaulay Library attribution/link is compliance-relevant, so it is locked here.
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RecentMediaEmbed } from './RecentMediaEmbed'

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})
afterEach(() => cleanup())

describe('RecentMediaEmbed — embed + info/attribution row', () => {
  it('renders the embed and an info row: date, a Macaulay Library link to the asset, and the checklist', () => {
    render(<RecentMediaEmbed id="123456" type="Photo" species="Acorn Woodpecker" date="2024-06-08" checklistId="S42" />)
    // The embed.
    expect(document.querySelector('iframe')!.getAttribute('src'))
      .toBe('https://macaulaylibrary.org/asset/123456/embed')
    // Attribution + click-through to the exact asset on the Macaulay Library.
    expect(screen.getByRole('link', { name: /on the Macaulay Library \(ML123456\)/i }).getAttribute('href'))
      .toBe('https://macaulaylibrary.org/asset/123456')
    // Media info: the capture date.
    expect(screen.getByText('Jun 8, 2024')).toBeTruthy()
    // The eBird checklist link.
    expect(screen.getByRole('link', { name: /open checklist S[0-9]+ on eBird/i }).getAttribute('href'))
      .toBe('https://ebird.org/checklist/S42')
  })

  it('keeps the date + Macaulay Library link + checklist when offline (no live embed)', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<RecentMediaEmbed id="77" type="Audio" species="Wrentit" date="2024-06-08" checklistId="S9" />)
    // No live iframe while offline.
    expect(document.querySelector('iframe')).toBeNull()
    // The attribution/link + info persist (all local).
    expect(screen.getByRole('link', { name: /on the Macaulay Library \(ML77\)/i }).getAttribute('href'))
      .toBe('https://macaulaylibrary.org/asset/77')
    expect(screen.getByText('Jun 8, 2024')).toBeTruthy()
    expect(screen.getByRole('link', { name: /open checklist S[0-9]+ on eBird/i })).toBeTruthy()
  })

  it('renders no Macaulay Library attribution link for a non-numeric id (safe-id guard)', () => {
    render(<RecentMediaEmbed id="not-a-number" type="Photo" species="X" />)
    expect(screen.queryByRole('link', { name: /Macaulay Library/i })).toBeNull()
  })
})
