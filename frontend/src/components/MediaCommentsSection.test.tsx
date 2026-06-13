// @vitest-environment jsdom
//
// The Media Comments section lives at the bottom of the Multimedia tab. The tab
// (LifeList) renders a "Jump to comments" affordance whose target is this
// section's `id="media-comments"` scroll anchor, so that id — and the section's
// null-render when there are no comments — are a cross-component contract the
// affordance depends on. These tests lock both, plus the section label.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MediaCommentsSection } from './MediaCommentsSection'
import type { MLExportRow } from '../lib/parseMLExport'

afterEach(cleanup)

function row(overrides: Partial<MLExportRow> = {}): MLExportRow {
  return {
    catalogId: '12345678',
    commonName: 'American Robin',
    scientificName: 'Turdus migratorius',
    format: 'Photo',
    date: '2025-03-02 10:55',
    location: 'Stanley Park',
    county: null,
    latitude: null,
    longitude: null,
    caption: '',
    mediaNotes: '',
    observationDetails: '',
    ageSex: '',
    behaviors: '',
    time: '',
    year: null,
    month: null,
    avgRating: null,
    numRatings: 0,
    checklistId: '',
    ...overrides,
  }
}

const baseProps = { backboneNames: new Set<string>(), taxonMap: {}, onOpenSpecies: undefined }

describe('MediaCommentsSection', () => {
  it('renders the #media-comments scroll target when a row carries a comment', () => {
    const { container } = render(
      <MediaCommentsSection rows={[row({ caption: 'Singing at dawn' })]} {...baseProps} />,
    )
    expect(container.querySelector('#media-comments')).not.toBeNull()
  })

  it('labels the section "Media Comments"', () => {
    render(<MediaCommentsSection rows={[row({ mediaNotes: 'Backlit' })]} {...baseProps} />)
    expect(screen.getByText('Media Comments')).toBeTruthy()
  })

  it('renders nothing when no row carries a comment', () => {
    const { container } = render(
      <MediaCommentsSection rows={[row(), row({ format: 'Audio' })]} {...baseProps} />,
    )
    expect(container.querySelector('#media-comments')).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('makes the #media-comments scroll target focusable so jump links can move focus (F029)', () => {
    const { container } = render(
      <MediaCommentsSection rows={[row({ caption: 'Singing at dawn' })]} {...baseProps} />,
    )
    expect(container.querySelector('#media-comments')!.getAttribute('tabindex')).toBe('-1')
  })

  it('the filter input has an accessible name, not just a placeholder (F051)', () => {
    render(<MediaCommentsSection rows={[row({ caption: 'Singing at dawn' })]} {...baseProps} />)
    expect(screen.getByRole('textbox', { name: 'Filter media comments' })).toBeTruthy()
  })
})
