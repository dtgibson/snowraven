// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

// SnowMap is heavy (MapLibre/WebGL); stub it so we can assert mount/teardown
// without a real GL context. The stub exposes a testid so map presence is
// observable.
vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="snowmap-stub">{children}</div>
  ),
}))
// Markers/Popups inside the (mocked) map — render children inertly.
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: null }),
}))

import { NamedBirdsTable } from './NamedBirdsTable'
import { computeNamedBirds } from '../lib/namedBirds'
import type { ObservationEntry } from '../types'

afterEach(cleanup)

function obs(p: Partial<ObservationEntry> & { submissionId: string }): ObservationEntry {
  return {
    commonName: 'Mallard', scientificName: 'Anas platyrhynchos', date: '2024-01-01',
    location: 'Loc', locationId: 'L1', latitude: null, longitude: null, county: null,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    ...p,
  }
}

// The Named Birds tab's session date, injected as a fixture rather than read
// from the clock: `singleOpen` and `today` are one discriminated pair, so a test
// that opts into the tab's surfaces has to supply both.
const TODAY = '2024-09-06'

/**
 * The accordion HEADER button for a named bird.
 *
 * Scoped rather than `getByText(name).closest('button')`: since the strip at the
 * bottom of the tab gained a labelled lane per bird, a bird's name appears twice
 * on the tab and the bare text query is ambiguous. The header is the one inside
 * a `button[aria-expanded]`.
 */
const cardHeader = (name: string): HTMLElement =>
  screen.getAllByText(name).map(el => el.closest('button[aria-expanded]')).find(Boolean) as HTMLElement

/** The card list's order, top to bottom, ignoring the strip's lane labels. */
const cardOrder = (): (string | null)[] =>
  screen.getAllByText(/^(Pete|Honk)$/)
    .filter(el => el.closest('button[aria-expanded]'))
    .map(el => el.textContent)

const birds = computeNamedBirds([
  obs({ submissionId: 'S100', commonName: 'Mallard', date: '2024-03-01', location: 'Lake Merritt', latitude: 37.8, longitude: -122.2, speciesComments: 'drake [name:Pete] at the pond' }),
  obs({ submissionId: 'S200', commonName: 'Mallard', date: '2024-05-01', location: '', latitude: null, longitude: null, speciesComments: '[name:Pete] still here' }),
  obs({ submissionId: 'S300', commonName: 'Canada Goose', date: '2024-04-01', location: 'Arrowhead Marsh', latitude: 37.7, longitude: -122.1, speciesComments: '[name:Honk]' }),
])

describe('NamedBirdsTable', () => {
  it('renders each named bird with its sighting count and the four-option sort when showSpecies', () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    expect(screen.getByText('Pete')).toBeTruthy()
    expect(screen.getByText('Honk')).toBeTruthy()
    expect(screen.getByText('2 sightings')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Name (Individual)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alphabetical' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Taxonomic' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Last Seen' })).toBeTruthy()
  })

  it('shows only Name (Individual) + Last Seen when showSpecies is false', () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies={false} />)
    expect(screen.queryByRole('button', { name: 'Alphabetical' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Taxonomic' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Name (Individual)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Last Seen' })).toBeTruthy()
  })

  it('expands a bird to show its reports (date · location · checklist link + comment)', () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    const peteRow = cardHeader('Pete')
    fireEvent.click(peteRow)
    const link = screen.getByRole('link', { name: /S200/ })
    expect(link.getAttribute('href')).toBe('https://ebird.org/checklist/S200')
    expect(screen.getByText('[name:Pete] still here')).toBeTruthy()
    // Location renders between date and checklist for the report that has one…
    expect(screen.getByText('Lake Merritt')).toBeTruthy()
  })

  it('omits the location segment for a report with no location', () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(cardHeader('Pete'))
    // S200 has no location; its row must not invent a placeholder. There are two
    // Pete reports — S100 with "Lake Merritt", S200 with none — so exactly one
    // location text appears for Pete.
    expect(screen.queryAllByText('Lake Merritt')).toHaveLength(1)
  })

  it('renders a malformed checklist id as plain text, not a link (S-id gate)', () => {
    const junk = computeNamedBirds([
      obs({ submissionId: 'N/A', commonName: 'Mallard', date: '2024-02-02', location: 'Nowhere', latitude: null, longitude: null, speciesComments: '[name:Mystery]' }),
    ])
    render(<NamedBirdsTable embedAllowed birds={junk} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(cardHeader('Mystery'))
    // The junk id shows as text but must not become a styled 404 link.
    expect(screen.getByText('N/A')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /N\/A/ })).toBeNull()
  })

  it('mounts the per-individual map (one SnowMap) only when expanded and only on the single-open tab', async () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies singleOpen today={TODAY} orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>} />)
    // Collapsed: no map.
    expect(screen.queryByTestId('snowmap-stub')).toBeNull()
    fireEvent.click(cardHeader('Pete'))
    // Pete has a coordinate-bearing sighting → exactly one map mounts. SightingsMap
    // is lazy-loaded (0.5.42 maplibre defer), so the stub appears once its chunk
    // resolves — findAllByTestId awaits that.
    expect(await screen.findAllByTestId('snowmap-stub')).toHaveLength(1)
    expect(screen.getByText(/Where Pete has been seen/i)).toBeTruthy()
  })

  it('renders no map for the Species Detail section (multi-open, no singleOpen)', () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies={false} />)
    fireEvent.click(cardHeader('Pete'))
    expect(screen.queryByTestId('snowmap-stub')).toBeNull()
  })

  it('shows the per-individual top-locations block on the tab, ranked from that bird alone', () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies singleOpen today={TODAY} orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>} />)
    expect(screen.queryByText('Top locations')).toBeNull()
    fireEvent.click(cardHeader('Pete'))
    expect(screen.getByText('Top locations')).toBeTruthy()
    // Pete has one located sighting (Lake Merritt) and one with no location, so the
    // single-location shape renders and the unlocated sighting is simply left out.
    expect(document.body.textContent).toContain('Every sighting at Lake Merritt.')
    expect(screen.queryAllByText('Lake Merritt')).toHaveLength(2) // the report row + the block
  })

  it('renders NO top-locations block for the Species Detail section (multi-open, no singleOpen)', () => {
    // Species Detail already carries its own species-wide Top Locations above this
    // section; the per-individual list is tab-only, gated by the same flag as the map.
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies={false} />)
    fireEvent.click(cardHeader('Pete'))
    expect(screen.queryByText('Top locations')).toBeNull()
    expect(document.body.textContent).not.toContain('Every sighting at')
  })

  it('single-open accordion: opening a second card collapses the first', async () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies singleOpen today={TODAY} orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(cardHeader('Pete'))
    expect(screen.getByText('[name:Pete] still here')).toBeTruthy()
    // Open Honk → Pete's panel (and its map) must tear down.
    fireEvent.click(cardHeader('Honk'))
    expect(screen.queryByText('[name:Pete] still here')).toBeNull()
    expect(screen.getByText('[name:Honk]')).toBeTruthy()
    // Lazy SightingsMap (0.5.42) → await the surviving single map stub.
    expect(await screen.findAllByTestId('snowmap-stub')).toHaveLength(1)
  })

  it('multi-open accordion (no singleOpen): a second card opens without closing the first', () => {
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies={false} />)
    fireEvent.click(cardHeader('Pete'))
    fireEvent.click(cardHeader('Honk'))
    expect(screen.getByText('[name:Pete] still here')).toBeTruthy()
    expect(screen.getByText('[name:Honk]')).toBeTruthy()
  })

  it('does not render a map for an individual with no usable coordinates', () => {
    const noCoord = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-01-01', latitude: null, longitude: null, speciesComments: '[name:Ghost]' }),
    ])
    render(<NamedBirdsTable embedAllowed birds={noCoord} showSpecies singleOpen today={TODAY} orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(cardHeader('Ghost'))
    expect(screen.queryByTestId('snowmap-stub')).toBeNull()
  })

  it('re-sorts when the Taxonomic option is chosen using orderFor', () => {
    const orderFor = (cn: string) => ({ 'Canada Goose': 1, Mallard: 5 }[cn] ?? Infinity)
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies orderFor={orderFor} renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(screen.getByRole('button', { name: 'Taxonomic' }))
    // Goose (order 1) before Mallard/Pete (order 5).
    expect(cardOrder()).toEqual(['Honk', 'Pete'])
  })
})

describe('the range control and the two timelines (Named Birds tab only)', () => {
  const tab = (extra: Partial<{ birds: typeof birds }> = {}) =>
    render(
      <NamedBirdsTable
        embedAllowed birds={extra.birds ?? birds} showSpecies singleOpen today={TODAY}
        orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>}
      />,
    )

  const pill = (name: 'Last sighting' | 'Today') =>
    screen.getAllByRole('button', { name }).map(b => b as HTMLButtonElement)

  it('renders the canonical range control in the tab control strip, under Sort', () => {
    tab()
    expect(screen.getByRole('group', { name: 'Measure every span to' })).toBeTruthy()
    expect(pill('Last sighting')[0].getAttribute('aria-pressed')).toBe('true')
    expect(pill('Today')[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('both range buttons are real tab stops with a LITERAL tabindex and aria-pressed', () => {
    tab()
    for (const b of [...pill('Last sighting'), ...pill('Today')]) {
      expect(b.getAttribute('tabindex')).toBe('0')
      expect(b.getAttribute('aria-pressed')).toMatch(/^(true|false)$/)
      expect(b.className).toContain('sr-touch-target')
    }
  })

  it('ONE VALUE FOR THE WHOLE TAB: a press inside an open card moves a collapsed card AND the strip caption', () => {
    tab()
    fireEvent.click(cardHeader('Pete'))
    // Three instances now: the tab strip, the open card, and above the strip.
    expect(screen.getByRole('group', { name: /repeated in the open card/ })).toBeTruthy()
    expect(document.body.textContent).toContain('Applies to every named bird on this tab.')

    // Every visible card names the endpoints, so the switch is legible without
    // touching it — and Honk is COLLAPSED, which is the point of this assertion.
    expect(document.body.textContent).toContain('first to last sighting')
    expect(document.body.textContent).not.toContain('first sighting to today')

    // Press the instance INSIDE the open card.
    const inCard = within(screen.getByRole('group', { name: /repeated in the open card/ }))
    fireEvent.click(inCard.getByRole('button', { name: 'Today' }))

    // ...and the whole tab moves in one commit.
    expect(document.body.textContent).toContain('first sighting to today')
    expect(document.body.textContent).not.toContain('first to last sighting')
    for (const b of pill('Today')) expect(b.getAttribute('aria-pressed')).toBe('true')
  })

  it('the duration figure follows the range while the date-range line above it does NOT', () => {
    tab()
    // Pete: 2024-03-01 to 2024-05-01 is 61 days, and 61 days is exactly "2 mos."
    expect(screen.getByText('2 mos.')).toBeTruthy()
    const dateLine = screen.getByText('Mar 1, 2024 – May 1, 2024')
    fireEvent.click(pill('Today')[0])
    // To the fixture today (2024-09-06) it is 189 days.
    expect(screen.getByText('6 mos. 6 days')).toBeTruthy()
    // Byte-identical, same node: the two dates are facts about sightings.
    expect(screen.getByText('Mar 1, 2024 – May 1, 2024')).toBe(dateLine)
  })

  it('the per-bird strip renders inside the open card, ABOVE the report rows', () => {
    tab()
    fireEvent.click(cardHeader('Pete'))
    const strip = screen.getByRole('listbox', { name: 'Sightings of Pete over time' })
    const row = screen.getByText('[name:Pete] still here')
    // DOCUMENT_POSITION_FOLLOWING: the report row comes after the strip.
    expect(strip.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a bird with a SINGLE sighting gets no strip in either range, and still shows its figure', () => {
    const single = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Rock Pigeon', date: '2024-03-02', location: 'Pierce', speciesComments: '[name:one-leg-pete]' }),
      obs({ submissionId: 'S2', commonName: 'Mallard', date: '2024-03-01', location: 'Lake', speciesComments: '[name:Pete]' }),
      obs({ submissionId: 'S3', commonName: 'Mallard', date: '2024-05-01', location: 'Lake', speciesComments: '[name:Pete]' }),
    ])
    tab({ birds: single })
    fireEvent.click(cardHeader('one-leg-pete'))
    expect(screen.queryByRole('listbox', { name: /one-leg-pete/ })).toBeNull()
    expect(screen.getByText('Same day')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    expect(screen.queryByRole('listbox', { name: /one-leg-pete/ })).toBeNull()
  })

  it('a bird whose sightings all fall on ONE date gets a SENTENCE, no listbox and no tab stop', () => {
    const sameDay = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-07-04', location: 'Buchanan Curl', speciesComments: '[name:Winky]' }),
      obs({ submissionId: 'S2', commonName: 'Mallard', date: '2024-07-04', location: 'Freeway Underpass', speciesComments: '[name:Winky]' }),
      obs({ submissionId: 'S3', commonName: 'Canada Goose', date: '2024-04-01', location: 'Marsh', speciesComments: '[name:Honk]' }),
    ])
    tab({ birds: sameDay })
    fireEvent.click(cardHeader('Winky'))
    expect(document.body.textContent).toContain('Every sighting on Jul 4, 2024.')
    expect(screen.queryByRole('listbox', { name: /Winky/ })).toBeNull()

    // With the range on today the SAME bird has a real axis and becomes selectable.
    fireEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    expect(document.body.textContent).not.toContain('Every sighting on Jul 4, 2024.')
    const strip = screen.getByRole('listbox', { name: 'Sightings of Winky over time' })
    expect(within(strip).getAllByRole('option')).toHaveLength(1)
    // Coincident at the LEFT edge: the axis now runs from that one date to today.
    expect(Number.parseFloat(within(strip).getAllByRole('option')[0].style.left)).toBe(0)
  })

  it('the strip at the bottom gives every bird a lane, in CARD ORDER, and follows Sort', () => {
    tab()
    const master = screen.getByRole('listbox', { name: 'Sightings of every named bird over time' })
    const laneNames = () => within(master).getAllByRole('group').map(g => g.getAttribute('aria-label'))
    // Default sort is Last Seen: Pete (May 1) before Honk (Apr 1).
    expect(laneNames()).toEqual(['Pete, Mallard', 'Honk, Canada Goose'])
    fireEvent.click(screen.getByRole('button', { name: 'Alphabetical' }))
    // Card order and lane order move together.
    expect(cardOrder()).toEqual(['Honk', 'Pete'])
    expect(laneNames()).toEqual(['Honk, Canada Goose', 'Pete, Mallard'])
  })

  it('the sentence above the strip carries the bird count and both dates, OUTSIDE the listbox', () => {
    tab()
    const sentence = screen.getByText('2 named birds, from Mar 1, 2024 to May 1, 2024.')
    const master = screen.getByRole('listbox', { name: 'Sightings of every named bird over time' })
    expect(master.contains(sentence)).toBe(false)
    fireEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    expect(screen.getByText('2 named birds, from Mar 1, 2024 to today, Sep 6, 2024.')).toBeTruthy()
  })

  it('no strip at the bottom with only ONE named bird: the card above already is the picture', () => {
    const one = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-03-01', speciesComments: '[name:Pete]' }),
      obs({ submissionId: 'S2', commonName: 'Mallard', date: '2024-05-01', speciesComments: '[name:Pete]' }),
    ])
    tab({ birds: one })
    expect(screen.queryByRole('listbox', { name: /every named bird/ })).toBeNull()
  })

  it('EXACTLY TWO tab stops with a card open, ONE with them all collapsed, whatever the fixture size', () => {
    const count = () => document.querySelectorAll('div[role="listbox"][tabindex="0"]').length
    tab()
    expect(count()).toBe(1)                                     // the strip only
    fireEvent.click(cardHeader('Pete'))
    expect(count()).toBe(2)                                     // + the open card's strip
    expect(document.querySelectorAll('[role="option"][tabindex]')).toHaveLength(0)

    // Invariant in the number of birds, and across a range flip and a re-sort.
    fireEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    expect(count()).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Alphabetical' }))
    expect(count()).toBe(2)
    cleanup()

    const many = computeNamedBirds(
      Array.from({ length: 40 }, (_, i) => [
        obs({ submissionId: `A${i}`, commonName: 'Mallard', date: '2024-03-01', speciesComments: `[name:Bird${i}]` }),
        obs({ submissionId: `B${i}`, commonName: 'Mallard', date: '2024-05-01', speciesComments: `[name:Bird${i}]` }),
      ]).flat(),
    )
    tab({ birds: many })
    expect(screen.getAllByRole('group', { name: /Mallard$/ })).toHaveLength(40)   // no cap, no truncation
    expect(count()).toBe(1)
    fireEvent.click(cardHeader('Bird0'))
    expect(count()).toBe(2)
  })

  it('SPECIES DETAIL gets none of it, and its figure is firstSeen to lastSeen', () => {
    // No `singleOpen`, so no `today`, so `sessionToday` is null and every
    // tab-only surface is absent BY CONSTRUCTION rather than by a branch.
    render(<NamedBirdsTable embedAllowed birds={birds} showSpecies={false} />)
    expect(screen.queryByRole('group', { name: /Measure every span to/ })).toBeNull()
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.body.textContent).not.toContain('Measure to')
    expect(document.body.textContent).not.toContain('first to last sighting')
    fireEvent.click(cardHeader('Pete'))
    expect(screen.queryByRole('listbox')).toBeNull()
    // The corrected arithmetic still reaches this surface, which is the repair.
    expect(screen.getByText('2 mos.')).toBeTruthy()
  })

  it('a future-dated export never inverts the axis: the right edge stays at lastSeen', () => {
    const future = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-03-01', speciesComments: '[name:Pete]' }),
      obs({ submissionId: 'S2', commonName: 'Mallard', date: '2099-01-01', speciesComments: '[name:Pete]' }),
      obs({ submissionId: 'S3', commonName: 'Canada Goose', date: '2024-04-01', speciesComments: '[name:Honk]' }),
    ])
    tab({ birds: future })
    fireEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    fireEvent.click(cardHeader('Pete'))
    const strip = screen.getByRole('listbox', { name: 'Sightings of Pete over time' })
    for (const o of within(strip).getAllByRole('option')) {
      const left = Number.parseFloat(o.style.left)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left).toBeLessThanOrEqual(100)
    }
    expect(document.body.textContent).toContain('Jan 1, 2099')
  })

  it('the report rows are unchanged: every sighting still carries its date, location and checklist link', () => {
    tab()
    fireEvent.click(cardHeader('Pete'))
    // The date appears on the report row and again as the strip's left axis
    // label, which is the point: the rows did not change, the strip was added.
    expect(screen.getAllByText('Mar 1, 2024').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Lake Merritt').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /S100/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /S200/ })).toBeTruthy()
  })

  it('adds no live region anywhere on the tab', () => {
    tab()
    fireEvent.click(cardHeader('Pete'))
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(0)
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(0)
  })
})

describe('the card header stays inside the card at 320px (QA-56)', () => {
  // WRITTEN AS THE INVARIANT, not as a geometry claim. jsdom has no layout
  // engine, so it cannot see a clip; what it CAN pin is the arrangement that
  // makes the clip impossible, and the arrangement is what a later edit would
  // remove. The measurement itself is a real-browser A/B at 320px across the
  // four in-app text scales.
  //
  // The failure this rejects: the right group carries `flexShrink: 0`, so it is
  // never narrowed, so the column inside it sizes to its widest child's
  // MAX-CONTENT and overflows the card's `overflow: hidden` box instead of
  // wrapping. Removing the duration line's `white-space: nowrap` (FR-64) makes
  // wrapping possible but never asks for it. Two caps and two released minimums
  // are what make it happen, and all four are load-bearing.
  const header = () => cardHeader('Pete')
  const rightGroup = () => header().querySelector<HTMLElement>('span[style*="margin-left: auto"]')!
  const dateColumn = () => rightGroup().querySelector<HTMLElement>('span[style*="flex-direction: column"]')!

  const renderTab = () =>
    render(
      <NamedBirdsTable
        embedAllowed birds={birds} showSpecies singleOpen today={TODAY}
        orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>}
      />,
    )

  it('a cluster that refuses to shrink carries a WIDTH CAP, so the cap can bind', () => {
    renderTab()
    const g = rightGroup()
    // The invariant, stated as an implication rather than as one spelling:
    // given `flex-shrink: 0`, a width cap must be present. Dropping the
    // `flexShrink` instead was measured identical in effect and would keep this
    // green, which is deliberate — what may not happen is neither of them.
    if (g.style.flexShrink === '0') {
      expect(g.style.maxWidth, 'a pinned cluster needs a width cap or it can never wrap').toBe('100%')
    }
  })

  it('BOTH nested automatic minimums on the overflow path are released', () => {
    // One cap is not enough: a flex item's `min-width: auto` floors it at its own
    // min-content whatever space is available, and there are two flex items
    // between the header and the text that was clipping.
    renderTab()
    expect(rightGroup().style.minWidth, 'the right group is a flex item').toBe('0px')
    expect(dateColumn().style.minWidth, 'the date column is a flex item too').toBe('0px')
  })

  it('the date-range line KEEPS its nowrap, so the two dates never break mid-range', () => {
    // Releasing the column's minimum must not cost the shipped line its nowrap:
    // the column's min-content stays this line's width, which is what bounds how
    // far the release can go.
    renderTab()
    const dateLine = screen.getByText('Mar 1, 2024 – May 1, 2024')
    expect((dateLine as HTMLElement).style.whiteSpace).toBe('nowrap')
  })

  it('the DURATION line carries no nowrap, in both range states (FR-64)', () => {
    renderTab()
    const durLine = () => document.querySelector<HTMLElement>('.sr-nbt-durline')!
    expect(durLine().style.whiteSpace).toBe('')
    fireEvent.click(screen.getAllByRole('button', { name: 'Today' })[0])
    expect(durLine().style.whiteSpace).toBe('')
    // ...and it is the endpoint phrase that made the wrap necessary, so the
    // phrase really is inside the line this rule governs.
    expect(durLine().textContent).toContain('first sighting to today')
  })
})
