// @vitest-environment jsdom
/// <reference types="node" />
//
// FR-19 / QA-22: with both Calendar overlays OFF, the rendered markup of every
// cell, the legend and an open day popup is byte-identical to the pre-feature
// rendering, except for the metric noun FR-28 adds to every data day's
// accessible name.
//
// HOW THE FIXTURE WAS MADE, and why it is a committed file. The capture was
// taken ONCE at the branch's base commit (a9c9042), before any source file of
// the calendar-overlays build was edited, by running this file with
// CAPTURE_CALENDAR_OFF=1. That writes calendarOverlaysOff.fixture.json beside
// it; every later run compares against it. It is a tracked file, never a
// gitignored per-run one (CLAUDE.md v1.0.12), so CI on a fresh clone reads the
// same bytes this machine captured.
//
// A ONE-BUILD GUARD BY NATURE. The fixture pins today's Calendar markup, so a
// later DELIBERATE restyle of the cells, the legend or the popup turns this red
// and regenerates it (run with CAPTURE_CALENDAR_OFF=1 and review the diff). The
// fixture's own `about` field says the same thing to whoever opens it.
//
// The dataset deliberately CARRIES media (catalog ids) and breeding codes on
// several days, including a zero-count day, so the off-state comparison is made
// over data that WOULD produce overlay facts, not over a backup that happens to
// have none.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ObservationEntry } from '../types'

// The combined ("All years") grid aligns its weekday lead-in to the CURRENT
// year, read once at module import (Calendar.tsx SESSION_NOW_MS). Pin it so the
// fixture does not go stale on January 1st; restored right after the import.
const { dateNowSpy } = vi.hoisted(() => ({
  dateNowSpy: vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 5, 15, 12)),
}))

const { getSetting, setSetting, loadMLExport } = vi.hoisted(() => ({
  getSetting: vi.fn(async (): Promise<unknown> => null),
  setSetting: vi.fn(async () => {}),
  loadMLExport: vi.fn(async () => null),
}))

let observations: ObservationEntry[] = []

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: { filename: 'x.csv', uploadedAt: '' }, ml: null })),
    getSetting,
    setSetting,
  },
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations })),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport }))

import { Calendar } from './Calendar'

dateNowSpy.mockRestore()

// jsdom makes import.meta.url an http URL, so the fixture resolves from the
// vitest root (frontend/), the house pattern (mapFullscreenWiring.test.tsx).
const FIXTURE_PATH = resolve(process.cwd(), 'src/components/calendarOverlaysOff.fixture.json')
const CAPTURE = process.env.CAPTURE_CALENDAR_OFF === '1'

function obs(over: Partial<ObservationEntry> & { date: string; submissionId: string; commonName: string }): ObservationEntry {
  return {
    submissionId: over.submissionId,
    commonName: over.commonName,
    scientificName: 'Sci name',
    date: over.date,
    location: over.location ?? 'West Pond',
    locationId: 'L1',
    latitude: null,
    longitude: null,
    county: null,
    count: over.count ?? 1,
    breedingCode: over.breedingCode ?? null,
    speciesComments: '',
    catalogIds: over.catalogIds ?? [],
    ...('time' in over ? { time: over.time } : {}),
  }
}

function dataset(): ObservationEntry[] {
  return [
    // 2025-03-14: two checklists, media on both, codes on one.
    obs({ date: '2025-03-14', submissionId: 'S100', commonName: 'American Robin', time: '07:30 AM', location: 'Point Reyes NS--Bear Valley', catalogIds: ['101', '102'], breedingCode: 'NY', count: 4 }),
    obs({ date: '2025-03-14', submissionId: 'S100', commonName: 'Song Sparrow', time: '07:30 AM', location: 'Point Reyes NS--Bear Valley', breedingCode: 'S', count: 2 }),
    obs({ date: '2025-03-14', submissionId: 'S101', commonName: 'Blue Jay', time: null, location: 'Abbotts Lagoon', catalogIds: ['103'], count: 3 }),
    // 2025-03-15: a lighter day with no facts.
    obs({ date: '2025-03-15', submissionId: 'S102', commonName: 'American Crow', count: 12 }),
    // 2025-05-17: four codes across three species, one unknown code.
    obs({ date: '2025-05-17', submissionId: 'S104', commonName: 'Oak Titmouse', breedingCode: 'FY', catalogIds: ['201'], count: 2 }),
    obs({ date: '2025-05-17', submissionId: 'S104', commonName: 'Wrentit', breedingCode: 'A' }),
    obs({ date: '2025-05-17', submissionId: 'S104', commonName: 'Bushtit', breedingCode: 'ZZ' }),
    obs({ date: '2025-05-17', submissionId: 'S105', commonName: 'Spotted Towhee', breedingCode: 'H', time: '10:15 AM', location: 'Abbotts Lagoon' }),
    // 2025-06-01: spuh only, so present-but-zero under Species, WITH media.
    obs({ date: '2025-06-01', submissionId: 'S103', commonName: 'gull sp.', catalogIds: ['301'] }),
    // 2024: a second navigable year and a second Mar-14 for the combined view.
    obs({ date: '2024-03-14', submissionId: 'S201', commonName: 'American Robin', breedingCode: 'NB', catalogIds: ['401'] }),
    obs({ date: '2024-04-10', submissionId: 'S200', commonName: 'Mallard' }),
  ]
}

type Snapshot = Record<string, string>

async function mount() {
  render(<Calendar onGoToSettings={() => {}} filesVersion={0} />)
  await screen.findByText('January')
  if (ROUND_TRIP) {
    // Both overlays on, the codes choice moved, then both off again: the user
    // who tried the feature and turned it off must get today's Calendar back,
    // byte for byte, not merely something that looks the same. Every code is
    // the press that moves it, since By category is the default
    // (calendar-breeding-category-default).
    fireEvent.click(screen.getByRole('switch', { name: 'Media' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Breeding' }))
    fireEvent.click(screen.getByRole('button', { name: 'Every code' }))
    expect(screen.getByRole('button', { name: 'Every code' }).getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(document.querySelectorAll('.sr-cal-facts').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('switch', { name: 'Media' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Breeding' }))
    await waitFor(() => expect(document.querySelectorAll('.sr-cal-facts--enter, .sr-cal-legend-ov--enter')).toHaveLength(0))
  }
}
// Set by the round-trip rows below; never in capture mode (the switches do not
// exist at the base commit).
let ROUND_TRIP = false

// Grids are captured as the live element's outerHTML plus, in capture mode,
// the element itself so it can be encoded (see encodeGrid).
const GRID_ELEMENTS = new Map<string, Element>()
let gridSeq = 0
function gridHtml(): string {
  const el = document.querySelector('.sr-cal-months') ?? document.querySelector('.sr-cal-year')
  if (!el) throw new Error('no grid rendered')
  const html = el.outerHTML
  if (CAPTURE) GRID_ELEMENTS.set(`${gridSeq++}\u241f${html}`, el.cloneNode(true) as Element)
  return html
}
function legendHtml(): string {
  const el = document.querySelector('.legend')
  if (!el) throw new Error('no legend rendered')
  return el.outerHTML
}
// The popup's whole backdrop subtree (the role="presentation" root), so the
// header, the stat tiles and every checklist row are inside the comparison.
async function popupHtml(name: RegExp): Promise<string> {
  fireEvent.click(screen.getByRole('button', { name }))
  const dialog = await screen.findByRole('dialog')
  const html = (dialog.parentElement as HTMLElement).outerHTML
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  return html
}

// Each scenario returns its captured markup; `noun` is the metric noun FR-28
// adds to every DATA day's accessible name in that state (zero days keep theirs).
interface Scenario { name: string; noun: string; run: () => Promise<Snapshot> }

const SCENARIOS: Scenario[] = [
  {
    name: 'compact · species · 2025',
    noun: 'countable species',
    run: async () => {
      await mount()
      return {
        grid: gridHtml(),
        legend: legendHtml(),
        popupMar14: await popupHtml(/^Mar 14, 2025: \d/),
        popupMay17: await popupHtml(/^May 17, 2025: \d/),
        popupJun1Zero: await popupHtml(/^Jun 1, 2025: birded/),
      }
    },
  },
  {
    name: 'compact · species · 2025 · textures',
    noun: 'countable species',
    run: async () => {
      await mount()
      fireEvent.click(screen.getByRole('switch', { name: 'Use Textures' }))
      return { grid: gridHtml(), legend: legendHtml() }
    },
  },
  {
    name: 'compact · checklists · 2025',
    noun: 'checklists',
    run: async () => {
      await mount()
      fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
      return { grid: gridHtml(), legend: legendHtml(), popupMar14: await popupHtml(/^Mar 14, 2025: \d/) }
    },
  },
  {
    name: 'compact · total · 2025 · all forms',
    noun: 'individuals',
    run: async () => {
      await mount()
      fireEvent.click(screen.getByRole('button', { name: 'Total count' }))
      fireEvent.click(screen.getByRole('switch', { name: /Count all forms/ }))
      return { grid: gridHtml(), legend: legendHtml(), popupMar14: await popupHtml(/^Mar 14, 2025: \d/) }
    },
  },
  {
    name: 'compact · species · 2025 · all forms',
    noun: 'species',
    run: async () => {
      await mount()
      fireEvent.click(screen.getByRole('switch', { name: /Count all forms/ }))
      return { grid: gridHtml(), legend: legendHtml(), popupJun1: await popupHtml(/^Jun 1, 2025: \d/) }
    },
  },
  {
    name: 'large · species · 2025',
    noun: 'countable species',
    run: async () => {
      await mount()
      fireEvent.click(screen.getByRole('button', { name: 'Large' }))
      await waitFor(() => expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12))
      const plain = gridHtml()
      fireEvent.click(screen.getByRole('switch', { name: 'Use Textures' }))
      return { grid: plain, gridTextures: gridHtml(), legend: legendHtml(), popupMay17: await popupHtml(/^May 17, 2025: \d/) }
    },
  },
  {
    name: 'compact · species · all years',
    noun: 'countable species',
    run: async () => {
      await mount()
      fireEvent.click(screen.getByRole('button', { name: 'All years' }))
      await screen.findByText('Species ever recorded')
      return { grid: gridHtml(), legend: legendHtml(), popupMar14: await popupHtml(/^Mar 14: \d/) }
    },
  },
  {
    name: 'compact · species filter American Robin',
    noun: 'species',
    run: async () => {
      await mount()
      const input = screen.getByRole('combobox', { name: /Filter the calendar to one species/ })
      fireEvent.focus(input)
      const listbox = await screen.findByRole('listbox', { name: /Filter the calendar to one species/ })
      fireEvent.click(within(listbox).getAllByRole('option').find(o => o.textContent?.includes('American Robin'))!)
      await screen.findByText(/American Robin only/)
      return { grid: gridHtml(), legend: legendHtml(), popupMar14: await popupHtml(/^Mar 14, 2025: \d/) }
    },
  },
]

// FIXTURE ENCODING. A year of cells is mostly the same few dozen elements
// repeated (every no-data cell, every weekday header row), so the capture
// stores each DISTINCT cell / header row once in `parts` and writes a
// {{p:N}} placeholder in its place. Decoding is a plain substitution, and the
// comparison is always decoded-capture against the live outerHTML string, so
// the encoding cannot hide a difference: a changed cell is simply a string
// that no longer equals its part. Placeholders cannot collide with markup
// (no Calendar element renders a double brace).
function encodeGrid(el: Element, parts: string[], index: Map<string, number>): string {
  const clone = el.cloneNode(true) as Element
  const toPart = (node: Element) => {
    const html = node.outerHTML
    let i = index.get(html)
    if (i === undefined) { i = parts.length; parts.push(html); index.set(html, i) }
    node.replaceWith(document.createTextNode(`{{p:${i}}}`))
  }
  // Walked structurally (card -> [name, weekday row, cell grid] in Compact,
  // card -> [name, .sr-cal-minigrid] in Large) rather than by selector, so the
  // encoder does not depend on selector-engine support for :last-child.
  for (const card of Array.from(clone.children)) {
    const kids = Array.from(card.children)
    const cellGrid = kids[kids.length - 1]
    for (const cell of Array.from(cellGrid.children)) toPart(cell)
    if (kids.length === 3) toPart(kids[1]) // Compact's aria-hidden weekday row
  }
  return clone.outerHTML
}
function decode(encoded: string, parts: readonly string[]): string {
  return encoded.replace(/\{\{p:(\d+)\}\}/g, (_, i: string) => parts[Number(i)])
}

// FR-28's one permitted difference: "{date}: {N}. Open day details" becomes
// "{date}: {N} {noun}. Open day details" on a data day. A zero day's name
// ("{date}: birded, 0 {noun}. ...") has no ": {N}." sequence and is untouched.
function withMetricNoun(html: string, noun: string): string {
  return html.replace(/(aria-label="[^"]*?: )(\d+)(\. Open day details")/g, `$1$2 ${noun}$3`)
}

beforeEach(() => {
  observations = dataset()
  getSetting.mockClear()
  setSetting.mockClear()
  loadMLExport.mockClear()
})
afterEach(cleanup)

describe('Calendar overlays OFF is byte-identical to the pre-feature markup (FR-19, QA-22)', () => {
  if (CAPTURE) {
    it('captures the pre-feature fixture (CAPTURE_CALENDAR_OFF=1)', async () => {
      const scenarios: Record<string, Snapshot> = {}
      const parts: string[] = []
      const index = new Map<string, number>()
      for (const s of SCENARIOS) {
        GRID_ELEMENTS.clear()
        const snap = await s.run()
        const byHtml = new Map([...GRID_ELEMENTS].map(([k, el]) => [k.slice(k.indexOf('\u241f') + 1), el]))
        const encoded: Snapshot = {}
        for (const [key, html] of Object.entries(snap)) {
          const el = byHtml.get(html)
          encoded[key] = el ? encodeGrid(el, parts, index) : html
          // The encoding must round-trip exactly, or the fixture is wrong.
          expect(decode(encoded[key], parts)).toBe(html)
        }
        scenarios[s.name] = encoded
        cleanup()
      }
      const doc = {
        about: 'Calendar markup with both overlays off, captured at base a9c9042 before the calendar-overlays build edited any source. '
          + 'A one-build guard: a deliberate later restyle of the Calendar cells, legend or popup regenerates it with CAPTURE_CALENDAR_OFF=1. '
          + 'Read by calendarOverlaysOff.test.tsx, which decodes the {{p:N}} parts and substitutes the FR-28 metric noun into data-day accessible names.',
        parts,
        scenarios,
      }
      writeFileSync(FIXTURE_PATH, JSON.stringify(doc, null, 1) + '\n')
      expect(existsSync(FIXTURE_PATH)).toBe(true)
    }, 30_000)
    return
  }

  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as { parts: string[]; scenarios: Record<string, Snapshot> }

  it('the fixture covers every scenario this file drives', () => {
    expect(Object.keys(fixture.scenarios).sort()).toEqual(SCENARIOS.map(s => s.name).sort())
  })

  for (const s of SCENARIOS) {
    it(`${s.name}: cells, legend and popup match the capture`, async () => {
      const actual = await s.run()
      const captured = fixture.scenarios[s.name]
      expect(Object.keys(actual).sort()).toEqual(Object.keys(captured).sort())
      for (const key of Object.keys(captured)) {
        expect(actual[key], `${s.name} → ${key}`).toBe(withMetricNoun(decode(captured[key], fixture.parts), s.noun))
      }
      // Off means off: no ML export read on the default path (FR-31, QA-35).
      expect(loadMLExport).not.toHaveBeenCalled()
    }, 15_000)
  }

  for (const s of SCENARIOS) {
    it(`${s.name}: identical again after turning both overlays on and off`, async () => {
      ROUND_TRIP = true
      try {
        const actual = await s.run()
        const captured = fixture.scenarios[s.name]
        for (const key of Object.keys(captured)) {
          expect(actual[key], `${s.name} (round trip) → ${key}`).toBe(withMetricNoun(decode(captured[key], fixture.parts), s.noun))
        }
      } finally {
        ROUND_TRIP = false
      }
    }, 15_000)
  }
})
