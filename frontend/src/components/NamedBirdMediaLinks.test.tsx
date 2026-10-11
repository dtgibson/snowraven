// @vitest-environment jsdom
// The named-bird item list (ml-media-links): above a named bird's gallery, one
// numbered link per item, grouped Photo, Audio, Video and numbered newest first
// within each format, each opening the same Macaulay Library page as that item's
// tile. Rendered through NamedBirdMedia, which owns it (schema.md section 5).
//
// The gallery fixtures are built by running ML rows through the production join,
// computeNamedBirdMedia, fed in an order production never shows, so the order
// and the tie-break under test are the gallery's own (.claude/rules/testing.md,
// v1.0.21). The bot-check gate is a test-controlled store, so the "bot check up"
// state and the gate lifting mid-session are both driven here. The unresolved
// embed preference reaches this component as `embedAllowed === false`, the same
// input as a saved Disable embedded media (lib/useEmbeddedMediaPreference.test.tsx
// owns that mapping), so the one `embedAllowed={false}` leg covers both.
//
// What this file cannot see: layout. The 320px / 200% reflow and the 24px and
// 44px targets are measured in real engines by
// website/tools/verify/verify-named-bird-media-links.mjs.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ComponentProps } from 'react'

const gate = vi.hoisted(() => {
  let gated = false
  const listeners = new Set<() => void>()
  return {
    get: () => gated,
    set(v: boolean) { gated = v; for (const l of listeners) l() },
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  }
})
vi.mock('../lib/mlEmbedGate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/mlEmbedGate')>()
  const { useSyncExternalStore } = await import('react')
  return { ...actual, useMlEmbedGate: () => useSyncExternalStore(gate.subscribe, gate.get, gate.get) }
})
// The real derivation, wrapped so a row can count its calls or switch the list off.
vi.mock('../lib/mediaEmbed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/mediaEmbed')>()
  return { ...actual, mediaItemLinkGroups: vi.fn(actual.mediaItemLinkGroups) }
})
// NamedBirdsTable (the Named Individuals row) reaches the map modules; stub them as
// NamedBirdsTable.test.tsx does. No fixture bird here has coordinates, so no map mounts.
vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => <div data-testid="snowmap-stub">{children}</div>,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: null }),
}))

import { NamedBirdMedia } from './NamedBirdMedia'
import { NamedBirdsTable } from './NamedBirdsTable'
import { mediaItemLinkGroups } from '../lib/mediaEmbed'
import { mlAssetUrl } from '../lib/mlCatalog'
import { computeNamedBirdMedia, type NamedBirdAsset } from '../lib/namedBirdMedia'
import { computeNamedBirds, namedBirdKey } from '../lib/namedBirds'
import { getDateFormatPref, setDateFormatPref } from '../lib/formatDate'
import { installTauriOpener } from '../test/tauriOpener'
import type { MLExportRow } from '../lib/parseMLExport'
import type { MediaType, ObservationEntry } from '../types'

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', undefined)
  vi.stubGlobal('fetch', vi.fn())
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  gate.set(false)
  vi.mocked(mediaItemLinkGroups).mockClear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── Fixtures ────────────────────────────────────────────────────────────────

const SPECIES = "Anna's Hummingbird"

function mlRow(catalogId: string, format: MediaType, date: string, name = 'Winky'): MLExportRow {
  return {
    catalogId, commonName: SPECIES, scientificName: 'Calypte anna', format, date,
    location: '', county: null, latitude: null, longitude: null,
    caption: `[name:${name}]`, mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0,
    checklistId: 'S1001',
  }
}

function galleryOf(rows: MLExportRow[], name = 'Winky'): NamedBirdAsset[] {
  return computeNamedBirdMedia(rows).get(namedBirdKey(name, SPECIES)) ?? []
}

// Winky: 24 photos and 3 recordings. Photo i has id 310000 + (7i mod 24), a
// permutation, so id order is not date order; photos 7 and 8 share a date, so the
// join's catalog-id tie-break decides them. The third newest photo is
// 2026-01-18, id 310014.
const PHOTO_DATES = [
  '2026-03-02', '2026-02-10', '2026-01-18',
  ...Array.from({ length: 21 }, (_, i) => `2025-${String(12 - Math.floor(i / 2)).padStart(2, '0')}-${i % 2 ? '05' : '24'}`),
]
PHOTO_DATES[8] = PHOTO_DATES[7]
const WINKY_ROWS: MLExportRow[] = [
  ...PHOTO_DATES.map((d, i) => mlRow(String(310000 + ((i * 7) % 24)), 'Photo', d)),
  mlRow('420003', 'Audio', '2026-02-20'),
  mlRow('420001', 'Audio', '2025-08-10'),
  mlRow('420002', 'Audio', '2024-05-05'),
].reverse()
const WINKY = galleryOf(WINKY_ROWS)
const WINKY_PHOTOS = WINKY.filter(a => a.format === 'Photo')
const WINKY_AUDIO = WINKY.filter(a => a.format === 'Audio')

type MediaProps = ComponentProps<typeof NamedBirdMedia>
function renderMedia(props: Partial<MediaProps> = {}) {
  return render(<NamedBirdMedia birdName="Winky" assets={WINKY} open hasML embedAllowed {...props} />)
}

const listRoot = (c: HTMLElement) => c.querySelector<HTMLElement>('.sr-ml-items')
const listLinks = (c: HTMLElement) => [...c.querySelectorAll<HTMLAnchorElement>('.sr-ml-items a')]
const labels = (c: HTMLElement) => [...c.querySelectorAll('.sr-mli-fmt')].map(el => el.textContent)

/** Everything a reader or a screen reader gets from the list. */
function snapshot(c: HTMLElement) {
  const root = listRoot(c)
  if (!root) return null
  return {
    lead: root.querySelector('.sr-mli-lead')?.textContent,
    groups: [...root.querySelectorAll('ul')].map(ul => ({
      label: document.getElementById(ul.getAttribute('aria-labelledby') ?? '')?.textContent,
      links: [...ul.querySelectorAll('a')].map(a => ({
        href: a.getAttribute('href'), name: a.getAttribute('aria-label'), text: a.textContent, title: a.getAttribute('title'),
      })),
    })),
  }
}

function revealAll() {
  let more: HTMLElement | null
  while ((more = screen.queryByRole('button', { name: /^Show \d+ more/ }))) fireEvent.click(more)
}

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

// ── Rows, numbers and every item ────────────────────────────────────────────

describe('the item list lists every item, by format, newest first (FR-01, FR-03..FR-06)', () => {
  it('links all 24 photos and 3 recordings before Show more reveals them, and Show more changes nothing (QA-01, QA-05, QA-10, QA-13)', () => {
    expect(WINKY).toHaveLength(27)
    const { container } = renderMedia()
    expect(container.querySelectorAll('.sr-media-item')).toHaveLength(6)

    expect(listRoot(container)!.querySelector('.sr-mli-lead')!.textContent).toBe('Winky on Macaulay Library, newest first:')
    expect(labels(container)).toEqual(['Photos', 'Audio'])
    const photos = screen.getByRole('list', { name: 'Photos' })
    const audio = screen.getByRole('list', { name: 'Audio' })
    expect(screen.queryByRole('list', { name: 'Video' })).toBeNull()
    expect(within(photos).getAllByRole('listitem')).toHaveLength(24)
    expect(within(audio).getAllByRole('listitem')).toHaveLength(3)

    const photoLinks = within(photos).getAllByRole('link')
    expect(photoLinks.map(a => a.textContent)).toEqual(Array.from({ length: 24 }, (_, i) => String(i + 1)))
    expect(photoLinks.map(a => a.getAttribute('href'))).toEqual(WINKY_PHOTOS.map(a => mlAssetUrl(a.catalogId)))
    expect(within(audio).getAllByRole('link').map(a => [a.textContent, a.getAttribute('href')]))
      .toEqual(WINKY_AUDIO.map((a, i) => [String(i + 1), mlAssetUrl(a.catalogId)]))
    // Number 1 is the newest photo, and the same-date pair keeps the gallery's catalog-id tie-break.
    expect(photoLinks[0].getAttribute('href')).toBe(mlAssetUrl('310000'))
    const tie = WINKY_PHOTOS.filter(a => a.date === PHOTO_DATES[7]).map(a => a.catalogId)
    expect(tie).toHaveLength(2)
    expect(Number(tie[0])).toBeGreaterThan(Number(tie[1]))
    expect(photoLinks.slice(7, 9).map(a => a.getAttribute('href'))).toEqual(tie.map(mlAssetUrl))

    const before = snapshot(container)
    revealAll()
    expect(container.querySelectorAll('.sr-media-item')).toHaveLength(27)
    expect(snapshot(container)).toEqual(before)
  })

  it('orders the groups Photo, Audio, Video, and gives a video-only bird only a Video group (QA-07)', () => {
    const mixed = galleryOf([mlRow('9', 'Video', '2026-01-01'), mlRow('8', 'Audio', '2025-01-01'), mlRow('7', 'Photo', '2024-01-01')])
    const first = renderMedia({ assets: mixed })
    expect(labels(first.container)).toEqual(['Photos', 'Audio', 'Video'])
    first.unmount()

    const videoOnly = galleryOf([mlRow('5', 'Video', '2025-02-02'), mlRow('6', 'Video', '2025-03-03')])
    const { container } = renderMedia({ assets: videoOnly })
    expect(labels(container)).toEqual(['Video'])
    expect(listLinks(container).map(a => [a.textContent, a.getAttribute('href')]))
      .toEqual([['1', mlAssetUrl('6')], ['2', mlAssetUrl('5')]])
  })

  it('gives every item the same URL as its own tile\'s Macaulay Library link, and nothing else (FR-05, QA-09)', () => {
    const { container } = renderMedia()
    revealAll()
    const tileLinks = screen.getAllByRole('link', { name: /^View this (photo|audio) on the Macaulay Library \(ML\d+\)/ })
    expect(tileLinks).toHaveLength(27)
    const listHrefs = listLinks(container).map(a => a.getAttribute('href'))
    expect(new Set(listHrefs).size).toBe(27)
    for (const tile of tileLinks) {
      const id = /\(ML(\d+)\)/.exec(tile.getAttribute('aria-label') ?? '')![1]
      expect(tile.getAttribute('href')).toBe(mlAssetUrl(id))
      expect(listHrefs).toContain(tile.getAttribute('href'))
    }
    for (const href of listHrefs) expect(href).not.toMatch(/media\.ebird\.org|userId|taxonCode/)
  })
})

// ── Catalog numbers that fail the tile's gate ───────────────────────────────

describe('an item without a valid catalog number gets no number (FR-01, FR-03, QA-02, QA-06)', () => {
  it('skips it, numbers the rest contiguously and counts only them, while its tile renders as before', () => {
    const assets = galleryOf([mlRow('501', 'Photo', '2026-01-03'), mlRow('x12', 'Photo', '2026-01-02'), mlRow('499', 'Photo', '2026-01-01')])
    expect(assets.map(a => a.catalogId)).toEqual(['501', 'x12', '499'])
    const { container } = renderMedia({ assets })
    const links = within(screen.getByRole('list', { name: 'Photos' })).getAllByRole('link')
    expect(links.map(a => [a.textContent, a.getAttribute('href')])).toEqual([['1', mlAssetUrl('501')], ['2', mlAssetUrl('499')]])
    for (const a of links) expect(a.getAttribute('aria-label')).toMatch(/^Photo [12] of 2 of Winky, /)
    expect(container.querySelectorAll('.sr-media-item')).toHaveLength(3)
    const invalidTile = container.querySelector<HTMLElement>('[data-media-index="1"]')!
    expect(within(invalidTile).getByText('Jan 2, 2026')).toBeTruthy()
    expect(within(invalidTile).queryByRole('link', { name: /Macaulay Library/ })).toBeNull()
  })

  it('renders no list and no lead when no item has one, and the tiles still render', () => {
    const assets = galleryOf([mlRow('x1', 'Photo', '2026-01-01'), mlRow('', 'Audio', '2025-01-01')])
    const { container } = renderMedia({ assets })
    expect(listRoot(container)).toBeNull()
    expect(screen.queryByText(/newest first/)).toBeNull()
    expect(container.querySelectorAll('.sr-media-item')).toHaveLength(2)
  })
})

describe('the list is absent wherever the gallery is (FR-01, FR-02, QA-02, QA-04)', () => {
  it('is absent in the empty state, in a collapsed card and with no ML export', () => {
    const { container, rerender } = renderMedia({ assets: [] })
    expect(screen.getByText('No media matched to this bird.')).toBeTruthy()
    expect(listRoot(container)).toBeNull()
    rerender(<NamedBirdMedia birdName="Winky" assets={WINKY} open={false} hasML embedAllowed />)
    expect(container.innerHTML).toBe('')
    rerender(<NamedBirdMedia birdName="Winky" assets={WINKY} open hasML={false} embedAllowed />)
    expect(container.innerHTML).toBe('')
    rerender(<NamedBirdMedia birdName="Winky" assets={WINKY} open hasML embedAllowed />)
    expect(listRoot(container)).not.toBeNull()
  })
})

// ── Embed independence ──────────────────────────────────────────────────────

describe('the same list in every embed state (FR-02, FR-08, QA-03, QA-14..QA-18)', () => {
  it('is identical, in the same place and the same nodes, with players working, the bot check up, embeds off and offline', () => {
    const { container, rerender } = renderMedia()
    const baseline = snapshot(container)
    const root = listRoot(container)!
    const nodes = listLinks(container)
    const header = screen.getByText('Media of Winky')
    const unchanged = () => {
      expect(snapshot(container)).toEqual(baseline)
      expect(listRoot(container)).toBe(root)
      expect(listLinks(container)).toEqual(nodes)
      expect(follows(header, root)).toBe(true)
      expect(follows(root, container.querySelector('.sr-media-item')!)).toBe(true)
    }

    // Players working.
    expect(container.querySelectorAll('iframe')).toHaveLength(6)
    unchanged()

    // The bot check up, then lifting mid-session.
    act(() => gate.set(true))
    expect(container.querySelectorAll('iframe')).toHaveLength(0)
    unchanged()
    act(() => gate.set(false))
    expect(container.querySelectorAll('iframe')).toHaveLength(6)
    unchanged()

    // Embeds off (and the unresolved preference, which arrives as the same false).
    rerender(<NamedBirdMedia birdName="Winky" assets={WINKY} open hasML embedAllowed={false} />)
    const status = screen.getByText('Embedded media is disabled in Settings.')
    unchanged()
    expect(follows(root, status)).toBe(true)

    // Offline.
    rerender(<NamedBirdMedia birdName="Winky" assets={WINKY} open hasML embedAllowed />)
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    act(() => { fireEvent(window, new Event('offline')) })
    expect(screen.getAllByText('Media unavailable offline')).toHaveLength(6)
    unchanged()
  })

  it('derives the list once per gallery: a reveal or an embed-state change does not re-run it (NFR-08, QA-31)', () => {
    const spy = vi.mocked(mediaItemLinkGroups)
    const { rerender } = renderMedia()
    expect(spy).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /^Show \d+ more/ }))
    act(() => gate.set(true))
    rerender(<NamedBirdMedia birdName="Winky" assets={WINKY} open hasML embedAllowed={false} />)
    expect(spy).toHaveBeenCalledTimes(1)
    // A new gallery (a replaced export) is a new array, and does re-derive.
    rerender(<NamedBirdMedia birdName="Winky" assets={[...WINKY]} open hasML embedAllowed={false} />)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('reads only the gallery and the bird\'s name (FR-08)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/NamedBirdMedia.tsx'), 'utf8')   // vitest's cwd is frontend/
    const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(code).toMatch(/useMemo\(\(\) => mediaItemLinkGroups\(assets\), \[assets\]\)/)
    expect(code).toMatch(/<NamedBirdMediaLinks groups=\{linkGroups\} birdName=\{birdName\} \/>/)
    const start = code.indexOf('function NamedBirdMediaLinks(')
    const end = code.indexOf('\nfunction ', start + 1)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const body = code.slice(start, end)
    expect(body).toContain('href={mlAssetUrl(item.catalogId)}')
    for (const read of ['embedAllowed', 'useOnline', 'useMlEmbedGate', 'revealCount', 'storage', 'transport', 'extractUserId', 'taxon', 'fetch']) {
      expect(body, `the list must not read ${read}`).not.toContain(read)
    }
  })
})

// ── Accessible names ────────────────────────────────────────────────────────

describe('accessible names (FR-06, FR-07, QA-10..QA-12)', () => {
  it('names each link by format, number, total, bird and date, with the new-tab cue once', () => {
    const { container } = renderMedia()
    const name = 'Photo 3 of 24 of Winky, Jan 18, 2026, on Macaulay Library (opens in a new tab)'
    const third = screen.getByRole('link', { name })
    expect(third.textContent).toBe('3')
    expect(third.getAttribute('href')).toBe(mlAssetUrl('310014'))
    expect(third.getAttribute('title')).toBe('Jan 18, 2026')
    expect(screen.getByRole('link', { name: 'Audio 1 of 3 of Winky, Feb 20, 2026, on Macaulay Library (opens in a new tab)' }).textContent).toBe('1')
    for (const a of listLinks(container)) {
      const n = a.getAttribute('aria-label') ?? ''
      expect(a.textContent).toMatch(/^\d+$/)
      expect(n).toMatch(new RegExp(`^(Photo|Audio) ${a.textContent} of (24|3) of Winky, `))
      expect(n.match(/\(opens in a new tab\)/g)).toHaveLength(1)
      expect(n).not.toContain('\u2014')
    }
    expect(listRoot(container)!.textContent).not.toContain('\u2014')
  })

  it('drops the date and its commas when the item has none, with no tooltip', () => {
    render(<NamedBirdMedia birdName="Notch" assets={galleryOf([mlRow('77', 'Photo', '', 'Notch')], 'Notch')} open hasML embedAllowed />)
    const link = screen.getByRole('link', { name: 'Photo 1 of 1 of Notch on Macaulay Library (opens in a new tab)' })
    expect(link.hasAttribute('title')).toBe(false)
  })

  it('follows the date-format preference, as the tile\'s date does', () => {
    const prev = getDateFormatPref()
    setDateFormatPref('iso')
    try {
      renderMedia()
      expect(screen.getByRole('link', { name: 'Photo 3 of 24 of Winky, 2026-01-18, on Macaulay Library (opens in a new tab)' })).toBeTruthy()
    } finally {
      setDateFormatPref(prev)
    }
  })
})

describe('DOM ids and URL inputs (NFR-05, QA-29)', () => {
  it.each(['Old Blue', 'x" y'])('keys every id on an index, never on the name %j, and puts no name in a URL', (name) => {
    const { container } = renderMedia({ birdName: name })
    const root = listRoot(container)!
    expect(root.querySelector('.sr-mli-name')!.textContent).toBe(name)
    const ids = [...root.querySelectorAll('[id]')].map(el => el.id)
    const refs = [...root.querySelectorAll('[aria-labelledby]')].map(el => el.getAttribute('aria-labelledby') ?? '')
    expect(ids).toHaveLength(2)
    expect(refs).toEqual(ids)
    for (const v of ids) {
      expect(v).not.toMatch(/\s/)
      expect(v).not.toContain(name)
      expect(v).not.toMatch(/Blue|x"/)
    }
    expect(refs.map(r => document.getElementById(r)?.textContent)).toEqual(['Photos', 'Audio'])
    for (const a of listLinks(container)) expect(a.getAttribute('href')).toMatch(/^https:\/\/macaulaylibrary\.org\/asset\/\d+$/)
  })
})

// ── Opening a link ──────────────────────────────────────────────────────────

describe('opening a link (FR-09, QA-19, QA-20)', () => {
  it('web and Pi: a new-tab anchor with noreferrer, and a click the app does not cancel', () => {
    const { container } = renderMedia()
    for (const a of listLinks(container)) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toContain('noreferrer')
    }
    let cancelled: boolean | null = null
    // Read the click at the window, then cancel it there only so jsdom does not
    // attempt the navigation it cannot perform.
    const probe = (e: MouseEvent) => { cancelled = e.defaultPrevented; e.preventDefault() }
    window.addEventListener('click', probe)
    try {
      fireEvent.click(screen.getByRole('link', { name: /^Photo 3 of 24 of Winky,/ }))
    } finally {
      window.removeEventListener('click', probe)
    }
    expect(cancelled).toBe(false)
  })

  it('Tauri apps: a click sends that link\'s own URL once, including an item Show more has not revealed', () => {
    const { container } = renderMedia()
    const opener = installTauriOpener()
    try {
      const third = screen.getByRole('link', { name: /^Photo 3 of 24 of Winky,/ }) as HTMLAnchorElement
      const last = screen.getByRole('link', { name: /^Photo 24 of 24 of Winky,/ }) as HTMLAnchorElement
      // The last photo's tile is behind Show more: no tile link carries its URL yet.
      const tileHrefs = [...container.querySelectorAll('.sr-media-item a')].map(a => a.getAttribute('href'))
      expect(tileHrefs).not.toContain(last.getAttribute('href'))
      expect(fireEvent.click(third)).toBe(false)
      expect(fireEvent.click(last)).toBe(false)
      expect(opener.calls()).toEqual([{ url: third.href, via: 'own' }, { url: last.href, via: 'own' }])
      expect(third.href).toBe(mlAssetUrl('310014'))
    } finally {
      opener.uninstall()
    }
  })
})

describe('keyboard (NFR-02, QA-27)', () => {
  it('makes every number a tab stop, Photos then Audio, after the header and before the first tile control', () => {
    const { container } = renderMedia()
    const links = listLinks(container)
    expect(links.every(a => a.tabIndex === 0)).toBe(true)
    expect(links.map(a => a.textContent)).toEqual([...Array.from({ length: 24 }, (_, i) => String(i + 1)), '1', '2', '3'])
    const photos = screen.getByRole('list', { name: 'Photos' })
    expect(links.slice(0, 24).every(a => photos.contains(a))).toBe(true)
    const stops = [...container.querySelectorAll<HTMLElement>('a[href], button, iframe, [tabindex]')].filter(el => el.tabIndex >= 0)
    const at = stops.indexOf(links[0])
    expect(stops.slice(at, at + links.length)).toEqual(links)
    expect(follows(screen.getByText('Media of Winky'), links[0])).toBe(true)
    expect(stops[at + links.length].closest('.sr-media-item')).not.toBeNull()
  })
})

// ── Everything else in the section is unchanged ─────────────────────────────

describe('the rest of the section is unchanged by the list (FR-10, QA-21, QA-28, QA-31)', () => {
  const tileSide = (c: HTMLElement) => ({
    links: [...c.querySelectorAll('a')].filter(a => !a.closest('.sr-ml-items'))
      .map(a => [a.getAttribute('href'), a.textContent, a.getAttribute('aria-label')]),
    iframes: c.querySelectorAll('iframe').length,
    showing: screen.getByText(/^Showing \d+ of \d+$/).textContent,
    more: screen.getByRole('button', { name: /^Show \d+ more/ }).getAttribute('aria-label'),
  })

  it.each([true, false])('keeps tile links, players, the count line and Show more identical with and without it (embedAllowed=%s), requesting nothing', (embedAllowed) => {
    const withList = renderMedia({ embedAllowed })
    expect(listRoot(withList.container)).not.toBeNull()
    const a = tileSide(withList.container)
    expect(a.links.length).toBeGreaterThan(0)
    withList.unmount()

    vi.mocked(mediaItemLinkGroups).mockImplementationOnce(() => [])
    const without = renderMedia({ embedAllowed })
    expect(listRoot(without.container)).toBeNull()
    expect(tileSide(without.container)).toEqual(a)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a reveal that exhausts the gallery still moves focus to the first newly revealed tile, never into the list', () => {
    const eight = WINKY.slice(0, 8)
    const { container } = renderMedia({ assets: eight })
    expect(listRoot(container)).not.toBeNull()
    const more = screen.getByRole('button', { name: /Show 2 more \(of 8\)/ })
    more.focus()
    fireEvent.click(more)
    const active = document.activeElement as HTMLElement
    expect(active.getAttribute('data-media-index')).toBe('6')
    expect(active.closest('.sr-ml-items')).toBeNull()
  })
})

describe('the list follows the stored export (FR-11, QA-22)', () => {
  it('lists only the new export\'s items after a replace, and nothing after a removal', () => {
    const exportA = galleryOf([mlRow('100', 'Photo', '2025-01-01'), mlRow('101', 'Photo', '2025-01-02')])
    const exportB = galleryOf([mlRow('200', 'Audio', '2025-02-01')])
    const { container, rerender } = renderMedia({ assets: exportA })
    expect(listLinks(container).map(a => a.getAttribute('href'))).toEqual([mlAssetUrl('101'), mlAssetUrl('100')])
    rerender(<NamedBirdMedia birdName="Winky" assets={exportB} open hasML embedAllowed />)
    expect(labels(container)).toEqual(['Audio'])
    expect(listLinks(container).map(a => a.getAttribute('href'))).toEqual([mlAssetUrl('200')])
    rerender(<NamedBirdMedia birdName="Winky" assets={[]} open hasML={false} embedAllowed />)
    expect(listRoot(container)).toBeNull()
  })
})

describe('Species Detail\'s Named Individuals stays without media (FR-12, QA-23)', () => {
  function obs(p: Partial<ObservationEntry> & { submissionId: string }): ObservationEntry {
    return {
      commonName: SPECIES, scientificName: 'Calypte anna', date: '2026-01-18', location: 'Loc', locationId: 'L1',
      latitude: null, longitude: null, county: null, count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
      ...p,
    }
  }
  const birds = computeNamedBirds([obs({ submissionId: 'S1001', speciesComments: '[name:Winky] at the feeder' })])
  const media = computeNamedBirdMedia(WINKY_ROWS)
  const openCard = () =>
    fireEvent.click(screen.getAllByText('Winky').map(el => el.closest('button[aria-expanded]')).find(Boolean) as HTMLElement)

  it('shows no list there even when handed media, while the Named Birds tab does', () => {
    const sd = render(<NamedBirdsTable birds={birds} showSpecies={false} embedAllowed mediaByBird={media} hasML />)
    openCard()
    expect(sd.container.querySelector('.sr-ml-items')).toBeNull()
    expect(sd.container.querySelector('a[href^="https://macaulaylibrary.org/asset/"]')).toBeNull()
    sd.unmount()

    const tab = render(<NamedBirdsTable birds={birds} showSpecies singleOpen today="2026-10-08" embedAllowed mediaByBird={media} hasML />)
    openCard()
    expect(tab.container.querySelector('.sr-ml-items')).not.toBeNull()
  })
})
