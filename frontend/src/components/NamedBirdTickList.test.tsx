// @vitest-environment jsdom

// The selectable sighting strip: the listbox contract, the option payloads, the
// keyboard map, the readout, and the two hit-test properties.
//
// WHAT THIS FILE CANNOT SEE, stated so its greenness is not over-read. jsdom has
// no layout engine, so every `getBoundingClientRect` is zero and the pointer hit
// test has to be driven through a stubbed rect (below) rather than measured; and
// jsdom has no accessibility tree at all, so an accessible NAME asserted here is
// `dom-accessibility-api`'s computation and not Chromium's or WebKit's. Names are
// therefore pinned with `getByRole(..., { name })`, which asserts the guarantee
// rather than the mechanism carrying it, and any claim that a name CHANGED is
// settled in a real engine instead.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { NamedBirdTickList } from './NamedBirdTickList'
import { buildLanes, masterAxis } from '../lib/namedBirdTimeline'
import type { NamedBird, NamedSighting } from '../lib/namedBirds'
import { restMaster, restPerBird } from '../lib/namedBirdTimelineCopy'

afterEach(cleanup)

const sighting = (date: string, location = 'Pierce and Washington', submissionId = `S${date}-${location}`): NamedSighting => ({
  date, submissionId, comment: '', location, locationId: 'L1', latitude: null, longitude: null,
})

/**
 * `computeNamedBirds`' own ordering: NEWEST DATE FIRST, submission id breaking
 * ties DESCENDING. Fixtures go through it so these tests are fed what production
 * hands over — an ascending array is an order production never produces, and it
 * is what let a reversed place order pass while the shipped tab read a
 * two-checklist morning backwards.
 */
const productionOrder = (sightings: NamedSighting[]): NamedSighting[] =>
  [...sightings].sort((a, b) =>
    a.date !== b.date ? b.date.localeCompare(a.date) : b.submissionId.localeCompare(a.submissionId))

const bird = (key: string, name: string, sightings: NamedSighting[], commonName = 'Common Raven'): NamedBird => {
  const dates = sightings.map(s => s.date).sort()
  return {
    key, name, commonName, scientificName: 'Corvus corax',
    firstSeen: dates[0], lastSeen: dates[dates.length - 1],
    sightingCount: sightings.length, sightings: productionOrder(sightings),
  }
}

const RAVENS = bird('ravens', 'Bridge-Ravens', [
  sighting('2026-05-21', 'Solano Hill'),
  // The real two-checklist morning: Buchanan Curl at 07:00, Pierce at 07:50.
  // Production hands these over LATE FIRST, so the expected name below is the
  // reverse of the input and this fixture can actually reject the defect.
  sighting('2026-06-12', 'Buchanan Curl', 'S356193531'),
  sighting('2026-06-12', 'Pierce and Washington', 'S356373753'),
  sighting('2026-06-15'),
  sighting('2026-07-10'),
])
const TURKEYS = bird('turkeys', 'Freeway-Turkey-Fam', [
  sighting('2026-06-08', 'Buchanan Curl'),
  sighting('2026-07-03', 'Freeway Underpass'),
], 'Wild Turkey')

const TODAY = '2026-09-06'

const lanesFor = (birds: NamedBird[], range: 'last-sighting' | 'today' = 'last-sighting') => {
  const axis = masterAxis(birds, range, TODAY)
  return { axis, lanes: buildLanes(birds, axis) }
}

const card = (range: 'last-sighting' | 'today' = 'last-sighting') => {
  const { axis, lanes } = lanesFor([RAVENS], range)
  return render(
    <NamedBirdTickList
      variant="card" ariaLabel="Sightings of Bridge-Ravens over time"
      lanes={lanes} axis={axis} restLine={restPerBird}
    />,
  )
}

const master = (range: 'last-sighting' | 'today' = 'last-sighting') => {
  const { axis, lanes } = lanesFor([RAVENS, TURKEYS], range)
  return render(
    <NamedBirdTickList
      variant="master" ariaLabel="Sightings of every named bird over time"
      lanes={lanes} axis={axis} restLine={restMaster}
      caption="2 named birds · first to last sighting" showSpecies
    />,
  )
}

const listbox = () => screen.getByRole('listbox')
const options = () => screen.getAllByRole('option')
const readoutEl = () => document.querySelector('.sr-nbt-readout')!
const line1 = () => readoutEl().querySelector('.l1')!.textContent
const line2 = () => readoutEl().querySelector('.l2')!.textContent

/**
 * jsdom gives every element a zero rect, so a press at a client X carries no
 * meaning until the rail has a width. This stubs a 200px rail starting at x=0,
 * which makes clientX read directly as a percentage times two.
 */
function stubRails(width = 200, left = 0) {
  for (const rail of document.querySelectorAll('.sr-nbt-rail')) {
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({
      width, left, right: left + width, top: 0, bottom: 24, height: 24, x: left, y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  }
}

describe('the listbox contract', () => {
  it('is ONE role="listbox" with a name, a literal tabindex="0", and options that are not tab stops', () => {
    card()
    const lb = listbox()
    // Asserted as ATTRIBUTES, not as props: the attribute is the property that
    // makes WebKit's default tab mode irrelevant.
    expect(lb.getAttribute('tabindex')).toBe('0')
    expect(lb.getAttribute('aria-label')).toBe('Sightings of Bridge-Ravens over time')
    expect(document.querySelectorAll('div[role="listbox"][tabindex="0"]')).toHaveLength(1)
    expect(document.querySelectorAll('[role="option"][tabindex]')).toHaveLength(0)
  })

  it('a mark carries no tabIndex, no anchor and no per-mark handler', () => {
    card()
    for (const o of options()) {
      expect(o.getAttribute('tabindex')).toBeNull()
      expect(o.tagName).toBe('DIV')
      expect(o.querySelector('a')).toBeNull()
    }
  })

  it('aria-activedescendant is ABSENT with nothing committed and names a rendered option once one is', () => {
    card()
    const lb = listbox()
    expect(lb.hasAttribute('aria-activedescendant')).toBe(false)
    fireEvent.keyDown(lb, { key: 'ArrowRight' })
    const id = lb.getAttribute('aria-activedescendant')
    expect(id).toBeTruthy()
    const active = document.getElementById(id!)
    expect(active).toBeTruthy()
    expect(active!.getAttribute('role')).toBe('option')
    expect(lb.contains(active)).toBe(true)
  })

  it('THE TAB-STOP COUNT IS INVARIANT in the number of birds and of sightings', () => {
    // The property that made selectable marks acceptable, so it is asserted as a
    // count rather than left to follow from the implementation.
    const count = () => ({
      listboxes: document.querySelectorAll('div[role="listbox"][tabindex="0"]').length,
      options: document.querySelectorAll('[role="option"][tabindex]').length,
    })
    const many = Array.from({ length: 40 }, (_, i) =>
      bird(`k${i}`, `Bird ${i}`, [sighting('2026-05-21'), sighting('2026-06-15'), sighting('2026-07-10')]))

    master()
    expect(count()).toEqual({ listboxes: 1, options: 0 })
    cleanup()

    const big = lanesFor(many)
    render(<NamedBirdTickList variant="master" ariaLabel="x" lanes={big.lanes} axis={big.axis} restLine={restMaster} />)
    expect(document.querySelectorAll('[role="option"]').length).toBeGreaterThan(100)
    expect(count()).toEqual({ listboxes: 1, options: 0 })
  })
})

describe('each option carries its whole payload', () => {
  it('names the date and the places on a card, and the bird in front on the master', () => {
    card()
    expect(screen.getByRole('option', { name: 'Jun 15, 2026, Pierce and Washington' })).toBeTruthy()
    cleanup()
    master()
    expect(screen.getByRole('option', { name: 'Bridge-Ravens, Jun 15, 2026, Pierce and Washington' })).toBeTruthy()
  })

  it('names BOTH places when one date carries two checklists', () => {
    master()
    expect(screen.getByRole('option', {
      name: 'Bridge-Ravens, Jun 12, 2026, Buchanan Curl and Pierce and Washington',
    })).toBeTruthy()
  })

  it('carries NO position words in the name — that is aria-posinset\'s job', () => {
    master()
    for (const o of options()) {
      expect(o.getAttribute('aria-label')).not.toMatch(/\b\d+ of \d+\b/)
    }
  })

  it('carries aria-posinset 1..N in date order and an aria-setsize equal to the DISTINCT date count', () => {
    card()
    // Five sightings, four distinct dates (two checklists share Jun 12).
    const opts = options()
    expect(opts).toHaveLength(4)
    expect(opts.map(o => o.getAttribute('aria-posinset'))).toEqual(['1', '2', '3', '4'])
    expect(opts.every(o => o.getAttribute('aria-setsize') === '4')).toBe(true)
    // Left-to-right IS date order, because the marks are built ascending.
    expect(opts.map(o => Number.parseFloat(o.style.left)))
      .toEqual([...opts.map(o => Number.parseFloat(o.style.left))].sort((a, b) => a - b))
  })
})

describe('the readout', () => {
  it('is rendered from the FIRST commit, never unmounted, never hidden, and hidden from AT', () => {
    card()
    const p = readoutEl()
    expect(p).toBeTruthy()
    expect(p.getAttribute('aria-hidden')).toBe('true')
    expect(line1()).toBe(restPerBird)
    expect(line2()).toBe('')
    fireEvent.keyDown(listbox(), { key: 'End' })
    expect(readoutEl()).toBe(p)                        // the same node, refilled
    expect((p as HTMLElement).style.display).not.toBe('none')
    expect((p as HTMLElement).style.visibility).not.toBe('hidden')
  })

  it('names the sighting on line 1 and the position IN DATES on line 2', () => {
    card()
    fireEvent.keyDown(listbox(), { key: 'End' })
    expect(line1()).toBe('Jul 10, 2026 · Pierce and Washington')
    expect(line2()).toBe('4 of 4 dates')
  })

  it('leads with the bird\'s name on the master', () => {
    master()
    fireEvent.keyDown(listbox(), { key: 'Home' })
    expect(line1()).toBe('Bridge-Ravens · May 21, 2026 · Solano Hill')
  })

  it('is never a link in any state', () => {
    card()
    expect(readoutEl().querySelector('a')).toBeNull()
    fireEvent.keyDown(listbox(), { key: 'End' })
    expect(readoutEl().querySelector('a')).toBeNull()
  })
})

describe('the keyboard map', () => {
  it('Arrow Right and Left move one sighting and CLAMP at both ends without wrapping', () => {
    card()
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'ArrowRight' })
    expect(line2()).toBe('1 of 4 dates')
    fireEvent.keyDown(lb, { key: 'ArrowLeft' })
    expect(line2()).toBe('1 of 4 dates')                 // clamps, does not wrap to the end
    for (let i = 0; i < 6; i += 1) fireEvent.keyDown(lb, { key: 'ArrowRight' })
    expect(line2()).toBe('4 of 4 dates')                 // clamps, does not wrap to the start
  })

  it('Home and End reach the first and last sighting', () => {
    card()
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'End' })
    expect(line2()).toBe('4 of 4 dates')
    fireEvent.keyDown(lb, { key: 'Home' })
    expect(line2()).toBe('1 of 4 dates')
  })

  it('Arrow Up and Down move one BIRD on the master, landing nearest in date', () => {
    master()
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'Home' })               // Bridge-Ravens, May 21
    expect(line1()).toContain('Bridge-Ravens')
    fireEvent.keyDown(lb, { key: 'ArrowDown' })
    // The turkeys' nearest date to May 21 is Jun 8, their first.
    expect(line1()).toBe('Freeway-Turkey-Fam · Jun 8, 2026 · Buchanan Curl')
    fireEvent.keyDown(lb, { key: 'ArrowDown' })
    expect(line1()).toContain('Freeway-Turkey-Fam')      // clamps at the last lane
    fireEvent.keyDown(lb, { key: 'ArrowUp' })
    expect(line1()).toContain('Bridge-Ravens')
  })

  it('the lane the arrow keys are in takes the active-lane class', () => {
    master()
    fireEvent.keyDown(listbox(), { key: 'Home' })
    const on = document.querySelectorAll('.sr-nbt-lane.is-on')
    expect(on).toHaveLength(1)
    expect(within(on[0] as HTMLElement).getByText('Bridge-Ravens')).toBeTruthy()
  })

  it('Arrow Up and Down do NOTHING on a card, structurally: it holds one lane', () => {
    card()
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'End' })
    const before = line1()
    fireEvent.keyDown(lb, { key: 'ArrowDown' })
    fireEvent.keyDown(lb, { key: 'ArrowUp' })
    expect(line1()).toBe(before)
  })

  it('Enter and Space are bound to NOTHING', () => {
    card()
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'End' })
    const l1 = line1()
    const active = lb.getAttribute('aria-activedescendant')
    fireEvent.keyDown(lb, { key: 'Enter' })
    fireEvent.keyDown(lb, { key: ' ' })
    expect(line1()).toBe(l1)
    expect(lb.getAttribute('aria-activedescendant')).toBe(active)
  })

  it('Escape is CONSUMED only while something is selected, and bubbles otherwise', () => {
    // Both directions, following the shipped SpeciesCombobox guard: an outer
    // Escape layer must still receive the press when there is nothing to clear.
    const outer = vi.fn()
    // ESCAPES ONLY. A bare keydown counter also counts the End press between the
    // two probes, which reads as a bubbling Escape and is not one.
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') outer() }
    document.addEventListener('keydown', listener)
    try {
      card()
      const lb = listbox()

      // Nothing selected → the press reaches the document listener.
      fireEvent.keyDown(lb, { key: 'Escape' })
      expect(outer).toHaveBeenCalledTimes(1)

      // Something selected → the press is consumed, and clears.
      fireEvent.keyDown(lb, { key: 'End' })
      expect(lb.hasAttribute('aria-activedescendant')).toBe(true)
      fireEvent.keyDown(lb, { key: 'Escape' })
      expect(outer).toHaveBeenCalledTimes(1)             // still one: it did not bubble
      expect(lb.hasAttribute('aria-activedescendant')).toBe(false)
      expect(line1()).toBe(restPerBird)
    } finally {
      document.removeEventListener('keydown', listener)
    }
  })

  it('blur clears the selection and returns the readout to its resting line', () => {
    card()
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'End' })
    expect(line1()).not.toBe(restPerBird)
    fireEvent.blur(lb)
    expect(line1()).toBe(restPerBird)
    expect(line2()).toBe('')
    expect(lb.hasAttribute('aria-activedescendant')).toBe(false)
  })
})

describe('the pointer: a press anywhere on the track selects the NEAREST sighting', () => {
  /** An independently written nearest-neighbour oracle over the same positions. */
  const nearest = (pcts: number[], p: number) =>
    pcts.reduce((best, v, i) => (Math.abs(v - p) < Math.abs(pcts[best] - p) ? i : best), 0)

  it('agrees with the oracle at both extreme ends and inside a dense cluster', () => {
    card()
    stubRails(200, 0)
    const lb = listbox()
    const pcts = options().map(o => Number.parseFloat(o.style.left))

    // x = 0, x = full width, and three points inside the May-to-June cluster.
    for (const x of [0, 200, 1, 60, 62]) {
      fireEvent.pointerDown(lb, { clientX: x, pointerType: 'mouse', buttons: 1 })
      const expectedIdx = nearest(pcts, (x / 200) * 100)
      expect(line2(), `press at x=${x}`).toBe(`${expectedIdx + 1} of ${pcts.length} dates`)
    }
  })

  it('NO press produces no selection, so no slice of the width is unreachable', () => {
    card()
    stubRails(200, 0)
    const lb = listbox()
    for (let x = 0; x <= 200; x += 5) {
      fireEvent.pointerDown(lb, { clientX: x, pointerType: 'mouse', buttons: 1 })
      expect(lb.hasAttribute('aria-activedescendant'), `press at x=${x}`).toBe(true)
    }
  })

  it('a MOUSE HOVER previews the readout and leaves aria-activedescendant byte-identical', () => {
    card()
    stubRails(200, 0)
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'Home' })
    const committed = lb.getAttribute('aria-activedescendant')
    expect(line2()).toBe('1 of 4 dates')

    fireEvent.pointerMove(lb, { clientX: 200, pointerType: 'mouse', buttons: 0 })
    expect(line2()).toBe('4 of 4 dates')                          // the readout previewed
    expect(lb.getAttribute('aria-activedescendant')).toBe(committed)  // the cursor did not move

    fireEvent.pointerLeave(lb)
    expect(line2()).toBe('1 of 4 dates')                          // the preview released
  })

  it('a TOUCH move never previews, because there is no hover on iOS', () => {
    card()
    stubRails(200, 0)
    const lb = listbox()
    fireEvent.pointerMove(lb, { clientX: 200, pointerType: 'touch', buttons: 0 })
    expect(line1()).toBe(restPerBird)
  })

  it('a held press scrubs and commits continuously', () => {
    card()
    stubRails(200, 0)
    const lb = listbox()
    fireEvent.pointerDown(lb, { clientX: 0, pointerType: 'mouse', buttons: 1 })
    expect(line2()).toBe('1 of 4 dates')
    fireEvent.pointerMove(lb, { clientX: 200, pointerType: 'mouse', buttons: 1 })
    expect(line2()).toBe('4 of 4 dates')
    expect(lb.getAttribute('aria-activedescendant')).toBeTruthy()
  })
})

describe('the master strip\'s lanes', () => {
  it('every lane is a role="group" named "{name}, {species}", with the visible label aria-hidden', () => {
    master()
    const groups = screen.getAllByRole('group')
    expect(groups.map(g => g.getAttribute('aria-label')))
      .toEqual(['Bridge-Ravens, Common Raven', 'Freeway-Turkey-Fam, Wild Turkey'])
    // The bird's name is announced ONCE, by the group, and the visible label that
    // repeats it is hidden from the accessibility tree.
    for (const [i, g] of groups.entries()) {
      const label = g.querySelector('.sr-nbt-lanelabel')!
      expect(label.getAttribute('aria-hidden')).toBe('true')
      expect(label.textContent).toBe(['Bridge-RavensCommon Raven', 'Freeway-Turkey-FamWild Turkey'][i])
    }
  })

  it('names the individual alone where the tab omits the species', () => {
    const { axis, lanes } = lanesFor([RAVENS, TURKEYS])
    render(<NamedBirdTickList variant="master" ariaLabel="x" lanes={lanes} axis={axis} restLine={restMaster} />)
    expect(screen.getAllByRole('group').map(g => g.getAttribute('aria-label')))
      .toEqual(['Bridge-Ravens', 'Freeway-Turkey-Fam'])
  })

  it('the in-listbox caption and both axis end dates are aria-hidden', () => {
    master()
    const cap = document.querySelector('.sr-nbt-cap')!
    expect(cap.getAttribute('aria-hidden')).toBe('true')
    expect(cap.textContent).toBe('2 named birds · first to last sighting')
    const endsRow = document.querySelector('.sr-nbt-mends')!
    expect(endsRow.getAttribute('aria-hidden')).toBe('true')
    expect(listbox().contains(endsRow)).toBe(true)
  })

  it('the lane label is a PLAIN SPAN, never a BirdName anchor', () => {
    // An anchor here would join the tab-order guard's counted <a href> population
    // inside a listbox operated by arrow keys.
    master()
    for (const g of screen.getAllByRole('group')) {
      expect(g.querySelector('.sr-nbt-lanelabel a')).toBeNull()
      expect(g.querySelector('.sr-nbt-lanelabel button')).toBeNull()
    }
  })
})

describe('the plot area carries no rendered text', () => {
  it('both axis end labels and both readout lines are SIBLINGS of the card track, not descendants', () => {
    card()
    const track = document.querySelector('.sr-nbt-track')!
    expect(track.textContent).toBe('')
    const ends = document.querySelector('.sr-nbt-ends')!
    expect(track.contains(ends)).toBe(false)
    expect(track.contains(readoutEl())).toBe(false)
    expect(ends.textContent).toBe('May 21, 2026Jul 10, 2026')
  })

  it('every master lane TRACK is textless; the label sits outside it', () => {
    master()
    for (const t of document.querySelectorAll('.sr-nbt-lanetrack')) expect(t.textContent).toBe('')
  })
})

describe('the selection is keyed by BIRD PLUS DATE, so it survives the axis moving', () => {
  it('survives a range flip and a re-sort with only the option\'s position moving', () => {
    const { axis, lanes } = lanesFor([RAVENS, TURKEYS])
    const { rerender } = render(
      <NamedBirdTickList variant="master" ariaLabel="x" lanes={lanes} axis={axis} restLine={restMaster} showSpecies />,
    )
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'ArrowRight' })
    fireEvent.keyDown(lb, { key: 'ArrowRight' })
    fireEvent.keyDown(lb, { key: 'ArrowRight' })
    const named = line1()
    expect(named).toContain('Bridge-Ravens')
    expect(named).toContain('Jun 15, 2026')
    const leftBefore = document.getElementById(lb.getAttribute('aria-activedescendant')!)!.style.left

    // Flip the range: the axis end moves to today.
    const flipped = lanesFor([RAVENS, TURKEYS], 'today')
    rerender(
      <NamedBirdTickList variant="master" ariaLabel="x" lanes={flipped.lanes} axis={flipped.axis} restLine={restMaster} showSpecies />,
    )
    expect(line1()).toBe(named)
    const active = document.getElementById(listbox().getAttribute('aria-activedescendant')!)!
    expect(active.getAttribute('aria-label')).toContain('Jun 15, 2026')
    expect(active.style.left).not.toBe(leftBefore)          // only the position moved

    // Re-sort: the same bird and date, in a different lane position.
    const resorted = lanesFor([TURKEYS, RAVENS], 'today')
    rerender(
      <NamedBirdTickList variant="master" ariaLabel="x" lanes={resorted.lanes} axis={resorted.axis} restLine={restMaster} showSpecies />,
    )
    expect(line1()).toBe(named)
    expect(document.getElementById(listbox().getAttribute('aria-activedescendant')!)!
      .getAttribute('aria-label')).toContain('Bridge-Ravens, Jun 15, 2026')
  })
})

describe('no live region anywhere in the strip', () => {
  it('renders no aria-live, no role="status" and no role="alert" in any state', () => {
    master()
    fireEvent.keyDown(listbox(), { key: 'Home' })
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(0)
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(0)
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })
})

describe('option ids are IDREF-safe, whatever the export contains (security review, Low)', () => {
  // An `aria-activedescendant` value is an IDREF. An id containing whitespace
  // cannot resolve as one, so the announcement simply does not happen -- nothing
  // throws, nothing renders wrong, and the published accessibility claim
  // quietly stops being true. The dates, names and places here all come from the
  // user's CSV, and the shipped form interpolated the date straight into the id.
  const HOSTILE = [
    '2026-06-12 07:00',                 // eBird's own date-with-time shape
    '2026 06 12',                       // spaces where the separators were
    '2026-06-12\tT',                    // a tab
    '2026-06-12"><img src=x>',          // markup, to confirm escaping as well
    "2026-06-12' onload='x",            // an attribute break
    '2026-06-12\nnewline',              // a line terminator
    '2026-06-12 nbsp',             // a non-breaking space, which \s matches
  ]

  const hostileLane = () => ({
    key: 'hostile::bird',
    name: 'Bird "With" \'Quotes\' <b>',
    commonName: 'Species Sep',
    marks: HOSTILE.map((date, i) => ({
      date,
      pct: (i / (HOSTILE.length - 1)) * 100,
      places: [`Place ${i} <script>`, 'Second place'],
    })),
  })

  const renderHostile = () => {
    const lane = hostileLane()
    const axis = { start: HOSTILE[0], end: HOSTILE[HOSTILE.length - 1], spanDays: 400 }
    return render(
      <NamedBirdTickList
        variant="master" ariaLabel="Sightings of every named bird over time"
        lanes={[lane]} axis={axis} restLine={restMaster} caption="1 named bird" showSpecies
      />,
    )
  }

  it('every id is a single IDREF token: no whitespace, and nothing an IDREF cannot carry', () => {
    renderHostile()
    const ids = options().map(o => o.id)
    expect(ids).toHaveLength(HOSTILE.length)
    for (const id of ids) {
      expect(id, `"${id}" must be a single token`).not.toMatch(/\s/)
      expect(id, `"${id}" must be IDREF-safe`).toMatch(/^[A-Za-z0-9:_-]+$/)
    }
  })

  it('ids are unique within a listbox even when two marks carry equal-looking dates', () => {
    renderHostile()
    const ids = options().map(o => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ids are unique ACROSS both listboxes on the page, which is what useId buys', () => {
    // The tab renders the open card's strip and the strip at the bottom at the
    // same time. Two components keying on the same lane and mark indices would
    // collide were the id not namespaced per instance.
    const { axis, lanes } = lanesFor([RAVENS, TURKEYS])
    render(
      <>
        <NamedBirdTickList variant="card" ariaLabel="card" lanes={[lanes[0]]} axis={axis} restLine={restPerBird} />
        <NamedBirdTickList variant="master" ariaLabel="master" lanes={lanes} axis={axis} restLine={restMaster} />
      </>,
    )
    const ids = screen.getAllByRole('option').map(o => o.id)
    expect(ids.length).toBeGreaterThan(4)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('aria-activedescendant RESOLVES to a rendered option, which is the property at stake', () => {
    renderHostile()
    const lb = listbox()
    fireEvent.keyDown(lb, { key: 'Home' })
    const id = lb.getAttribute('aria-activedescendant')
    expect(id).toBeTruthy()
    // `getElementById` is the resolution an assistive technology performs. An id
    // with a space in it returns null here, which is the whole finding.
    const target = document.getElementById(id!)
    expect(target, `aria-activedescendant "${id}" resolved to nothing`).toBeTruthy()
    expect(target!.getAttribute('role')).toBe('option')
    fireEvent.keyDown(lb, { key: 'End' })
    const lastId = lb.getAttribute('aria-activedescendant')
    expect(lastId).not.toBe(id)
    expect(document.getElementById(lastId!)).toBeTruthy()
  })

  it('the payload assertions still hold: posinset, setsize and the accessible name', () => {
    // Keying the id on position must not move anything the Tester checks in a
    // real accessibility tree.
    renderHostile()
    const opts = options()
    expect(opts.map(o => o.getAttribute('aria-posinset'))).toEqual(
      HOSTILE.map((_, i) => String(i + 1)))
    expect(opts.every(o => o.getAttribute('aria-setsize') === String(HOSTILE.length))).toBe(true)
    for (const o of opts) {
      const name = o.getAttribute('aria-label')!
      expect(name.startsWith('Bird "With" \'Quotes\' <b>, ')).toBe(true)
      expect(name).toMatch(/Place \d+ <script> and Second place$/)
      expect(name).not.toMatch(/\b\d+ of \d+\b/)
    }
  })

  it('hostile text is rendered as TEXT: no injected element and no event attribute', () => {
    renderHostile()
    const lb = listbox()
    expect(lb.querySelector('img')).toBeNull()
    expect(lb.querySelector('script')).toBeNull()
    for (const el of lb.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        expect(attr.name.toLowerCase().startsWith('on'), `${attr.name} on <${el.tagName}>`).toBe(false)
      }
    }
  })
})
