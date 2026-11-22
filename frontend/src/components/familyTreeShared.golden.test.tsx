// @vitest-environment jsdom
// MARKUP GOLDENS for the two shared components the Family Tree tab changes
// (family-rollups-and-tree schema 9.3; QA-12, QA-91).
//
// WHY THIS FILE EXISTS AND WHY ITS ORDER MATTERS. Two changes must leave every
// existing surface byte-identical: Life Lists' media presence cell leaves
// `LifeListsRows.tsx` for `components/MediaPresenceCell.tsx`, so both tabs
// render one implementation, and `<BirdName>` gains one optional prop, `lead`,
// so a name can lead with its scientific name. "Before and after" can only be
// compared if the BEFORE exists as an artifact, so `familyTreeShared.golden.json`
// was captured from the UNMODIFIED components in a commit of its own, run
// green, and only then were the two changes made, with this file untouched
// (testing.md, the v1.0.22 golden-before-refactor rule). If this suite goes
// red, fix the code, never the JSON.
//
// HOW THE GOLDEN WAS CAPTURED: `SR_CAPTURE_FAMILY_TREE_GOLDEN=1 npx vitest run
// src/components/familyTreeShared.golden.test.tsx` writes the JSON instead of
// comparing. A capture is a deliberate act and is never run in the same change
// as the refactor it pins.

import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { render, cleanup } from '@testing-library/react'
import { BirdName, type BirdNameProps } from './BirdName'
import { LifeListsRows } from './lifeLists/LifeListsRows'
import type { LifeListRow } from '../lib/lifeLists'

afterEach(cleanup)

const GOLDEN = join(dirname(fileURLToPath(import.meta.url)), 'familyTreeShared.golden.json')
const CAPTURE = process.env.SR_CAPTURE_FAMILY_TREE_GOLDEN === '1'

/** React `useId` values renumbered by first appearance, so the golden pins
 *  structure, not the process-wide counter. */
function normalize(html: string): string {
  const ids = new Map<string, string>()
  return html.replace(/_r_[0-9a-z]+_|:r[0-9a-z]+:/g, m => {
    if (!ids.has(m)) ids.set(m, `ID${ids.size}`)
    return ids.get(m)!
  })
}

const ROWS: LifeListRow[] = [
  {
    name: 'Snow Goose', scientificName: 'Anser caerulescens', position: 3, media: { photo: true, audio: false, video: true },
    day: 20240505, minute: 425, time: '7:05 AM', checklistId: 'S123456', location: 'Lake Park', place: 'Marin, CA',
  },
  {
    name: 'Eastern/Western Warbling Vireo', scientificName: '', position: 2, media: { photo: false, audio: false, video: false },
    day: 20230101, minute: null, time: null, checklistId: 'not-an-id', location: '', place: '',
  },
  {
    name: "Ross's Goose", scientificName: 'Anser rossii', position: 1, media: { photo: true, audio: true, video: true },
    day: 20200101, minute: 0, time: '12:00 AM', checklistId: '', location: 'Pond', place: 'CA',
  },
]

function lifeListsRowsMarkup(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const showMedia of [true, false]) {
    for (const added of [null, new Set(['Snow Goose'])]) {
      const { container } = render(
        <LifeListsRows rows={ROWS} total={7} showMedia={showMedia} addedFrom={added} codeFor={n => (n === 'Snow Goose' ? 'snogoo' : undefined)} onOpenSpecies={() => {}} />,
      )
      out[`media=${showMedia} added=${added === null ? 'none' : 'one'}`] = normalize(container.innerHTML)
      cleanup()
    }
  }
  return out
}

/** The prop matrix every existing call can reach: everything but `lead`. */
function birdNameMarkup(): Record<string, string> {
  const out: Record<string, string> = {}
  const names: [string, string | undefined][] = [
    ['Snow Goose', 'Anser caerulescens'], ['Eastern/Western Warbling Vireo', undefined], ['Dark-eyed Junco (Oregon)', ''],
  ]
  for (const [commonName, scientificName] of names) {
    // `md` is the size the Life Lists rows above render; a code failing the
    // shape renders as no code, which SpeciesLinks' own suite holds.
    for (const hasEntry of [false, true]) for (const showSci of [false, true]) for (const size of ['sm', 'lg'] as const) {
      for (const taxonCode of [undefined, 'snogoo']) for (const breakAfterSlash of [false, true]) for (const trailing of [undefined, ',']) {
        const props: BirdNameProps = {
          commonName, scientificName, hasEntry, showSci, size, taxonCode, breakAfterSlash, trailing,
          onOpenSpecies: hasEntry ? () => {} : undefined,
        }
        const { container } = render(<BirdName {...props} />)
        out[JSON.stringify({ commonName, scientificName, hasEntry, showSci, size, taxonCode, breakAfterSlash, trailing })] = normalize(container.innerHTML)
        cleanup()
      }
    }
  }
  return out
}

describe('the shared components render byte-identically to the captured golden', () => {
  const now = { lifeListsRows: lifeListsRowsMarkup(), birdName: birdNameMarkup() }
  if (CAPTURE) {
    writeFileSync(GOLDEN, JSON.stringify(now, null, 1) + '\n')
  }
  const golden = existsSync(GOLDEN) ? (JSON.parse(readFileSync(GOLDEN, 'utf8')) as typeof now) : null

  it('the golden exists and covers the matrix', () => {
    expect(golden).not.toBeNull()
    expect(Object.keys(golden!.lifeListsRows)).toHaveLength(4)
    expect(Object.keys(golden!.birdName).length).toBeGreaterThanOrEqual(150)
  })
  it('Life Lists rows, the media cell included, are unchanged', () => {
    expect(now.lifeListsRows).toEqual(golden!.lifeListsRows)
  })
  it('every BirdName prop combination an existing call can reach is unchanged', () => {
    expect(now.birdName).toEqual(golden!.birdName)
  })
})
