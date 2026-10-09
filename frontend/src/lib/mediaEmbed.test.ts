// mediaItemLinkGroups: the grouping behind the named-bird item list
// (ml-media-links, schema.md section 4). Every fixture is run through the
// production join, computeNamedBirdMedia, so the order under test is the order
// the gallery really shows (newest first, catalog id descending on a tie) and
// not one written by hand (.claude/rules/testing.md, v1.0.21).
import { describe, it, expect } from 'vitest'
import { MEDIA_FORMAT_ORDER, mediaItemLinkGroups } from './mediaEmbed'
import { computeNamedBirdMedia, type NamedBirdAsset } from './namedBirdMedia'
import { namedBirdKey } from './namedBirds'
import type { MLExportRow } from './parseMLExport'
import type { MediaType } from '../types'

function row(catalogId: string, format: MediaType, date: string): MLExportRow {
  return {
    catalogId, commonName: "Anna's Hummingbird", scientificName: 'Calypte anna', format, date,
    location: '', county: null, latitude: null, longitude: null,
    caption: '[name:Winky]', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0,
    checklistId: '',
  }
}

/** The bird's gallery, in the order the tab shows it. */
function gallery(rows: MLExportRow[]): NamedBirdAsset[] {
  return computeNamedBirdMedia(rows).get(namedBirdKey('Winky', "Anna's Hummingbird")) ?? []
}

const shape = (groups: ReturnType<typeof mediaItemLinkGroups>) =>
  groups.map(g => [g.format, g.items.map(i => i.catalogId)])

describe('mediaItemLinkGroups', () => {
  it('groups in Photo, Audio, Video order whatever the input order, keeping the gallery order within each', () => {
    // Fed oldest first and video first; two photos share a date, so the join's
    // catalog-id tie-break decides their order.
    const assets = gallery([
      row('901', 'Video', '2026-03-01'),
      row('101', 'Photo', '2024-05-05'),
      row('501', 'Audio', '2025-01-10'),
      row('120', 'Photo', '2025-06-20'),
      row('130', 'Photo', '2025-06-20'),
      row('502', 'Audio', '2026-02-02'),
      row('110', 'Photo', '2026-01-18'),
    ])
    expect(assets.map(a => a.catalogId)).toEqual(['901', '502', '110', '130', '120', '501', '101'])
    const groups = mediaItemLinkGroups(assets)
    expect(shape(groups)).toEqual([
      ['Photo', ['110', '130', '120', '101']],
      ['Audio', ['502', '501']],
      ['Video', ['901']],
    ])
    expect(groups[0].items[0]).toEqual({ catalogId: '110', date: '2026-01-18' })
    expect(MEDIA_FORMAT_ORDER).toEqual(['Photo', 'Audio', 'Video'])
  })

  it('gives a format with no linkable item no group', () => {
    expect(shape(mediaItemLinkGroups(gallery([row('1', 'Video', '2025-01-01'), row('2', 'Video', '2024-01-01')]))))
      .toEqual([['Video', ['1', '2']]])
    expect(shape(mediaItemLinkGroups(gallery([row('3', 'Audio', '2025-01-01'), row('4', 'Photo', '')]))))
      .toEqual([['Photo', ['4']], ['Audio', ['3']]])
  })

  it('drops an item whose catalog number fails the tile\'s gate, so it takes no number and is not counted', () => {
    // The join itself does not validate ids (the parser does), so these reach
    // the gallery in production order, interleaved with valid ones.
    const assets = gallery([
      row('201', 'Photo', '2026-01-03'),
      row('', 'Photo', '2026-01-02'),
      row('ML123', 'Photo', '2026-01-01'),
      row('12a', 'Photo', '2025-12-31'),
      row('\u0661\u0662', 'Photo', '2025-12-30'),   // Arabic-Indic digits: not ASCII, not \d without the u flag
      row('199', 'Photo', '2025-12-29'),
    ])
    expect(assets).toHaveLength(6)
    const groups = mediaItemLinkGroups(assets)
    expect(shape(groups)).toEqual([['Photo', ['201', '199']]])
    expect(groups[0].items).toHaveLength(2)
  })

  it('returns [] when nothing is linkable, and skips a format outside the three', () => {
    expect(mediaItemLinkGroups([])).toEqual([])
    expect(mediaItemLinkGroups(gallery([row('x1', 'Photo', '2025-01-01'), row('', 'Audio', '2025-01-02')]))).toEqual([])
    expect(mediaItemLinkGroups([{ catalogId: '7', format: '__proto__' as MediaType, date: '' }])).toEqual([])
  })
})
