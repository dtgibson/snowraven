// The bird-tap focus derivations (ios-lifer-widgets Stage 8; schema.md 4.5).
// Pure functions over a search's results; MapExplorerWidgetLink.test.tsx drives
// them through the real Map Explorer.
import { describe, it, expect, vi } from 'vitest'
import {
  boundedLocation, focusAbsentStatement, focusLifers, focusPillLabel, focusPillText, focusTargets,
  LANDING_LOCATION_BOUND_MS, landingText, nameForCode, type LinkFocus,
} from './linkFocus'
import type { DisplayTargetPin, NearbyLiferLocation } from '../mapExplorerTypes'

const lifer = (speciesCode: string, comName: string, recentDate = '2026-09-20') => ({ speciesCode, comName, recentDate, subId: 'S1' })
const loc = (locId: string, lat: number, lifers: ReturnType<typeof lifer>[]): NearbyLiferLocation => ({
  locId, locName: locId, lat, lng: -122, lifers, count: lifers.length,
  mostRecentDate: lifers.reduce((m, l) => (l.recentDate > m ? l.recentDate : m), ''), tier: 'old',
})
const tpin = (speciesCode: string, locId: string, lat: number): DisplayTargetPin => ({
  speciesCode, comName: speciesCode.toUpperCase(), locId, locName: locId, lat, lng: -122,
  recentDate: '2026-09-20', checklistCount: 1, subId: 'S1', missingTypes: ['Photo'],
})
const CENTER = { lat: 37.0, lng: -122 }
const focus = (speciesCode: string, locId: string, searchId = 5): LinkFocus => ({ speciesCode, locId, searchId })

const LOCS = [
  loc('L1', 37.2, [lifer('ruff', 'Ruff', '2026-09-01'), lifer('baisan', "Baird's Sandpiper")]),
  loc('L2', 37.05, [lifer('ruff', 'Ruff', '2026-09-23')]),
  loc('L3', 37.5, [lifer('baisan', "Baird's Sandpiper")]),
]

describe('focusLifers', () => {
  it('no focus, or results from a DIFFERENT search: everything, untouched', () => {
    expect(focusLifers(LOCS, null, 5, CENTER)).toEqual({ kind: 'none', pins: LOCS })
    expect(focusLifers(LOCS, focus('ruff', 'L1', 4), 5, CENTER)).toEqual({ kind: 'none', pins: LOCS })
  })

  it('only the spots holding the species, each narrowed to it with its own date and count 1; the listed spot', () => {
    const r = focusLifers(LOCS, focus('ruff', 'L1'), 5, CENTER)
    expect(r.kind).toBe('focused')
    if (r.kind !== 'focused') return
    expect(r.pins.map(p => p.locId)).toEqual(['L1', 'L2'])
    expect(r.pins.every(p => p.count === 1 && p.lifers.length === 1 && p.lifers[0]!.speciesCode === 'ruff')).toBe(true)
    expect(r.pins[0]!.mostRecentDate).toBe('2026-09-01')
    expect(r.target.locId).toBe('L1')
    expect(r.name).toBe('Ruff')
  })

  it('the listed spot is gone: the nearest spot of the species to the center', () => {
    const r = focusLifers(LOCS, focus('ruff', 'L999'), 5, CENTER)
    expect(r.kind === 'focused' && r.target.locId).toBe('L2')
    const noCenter = focusLifers(LOCS, focus('ruff', 'L999'), 5, null)
    expect(noCenter.kind === 'focused' && noCenter.target.locId).toBe('L1')
  })

  it('the species is absent: absent, and every result kept', () => {
    expect(focusLifers(LOCS, focus('nosuch', 'L1'), 5, CENTER)).toEqual({ kind: 'absent', pins: LOCS })
    expect(focusLifers([], focus('ruff', 'L1'), 5, CENTER)).toEqual({ kind: 'absent', pins: [] })
  })

  it('never mutates the results it was given', () => {
    const before = JSON.stringify(LOCS)
    focusLifers(LOCS, focus('ruff', 'L1'), 5, CENTER)
    expect(JSON.stringify(LOCS)).toBe(before)
  })
})

describe('focusTargets', () => {
  const PINS = [tpin('wrenti', 'L1', 37.3), tpin('stejay', 'L1', 37.3), tpin('wrenti', 'L2', 37.02), tpin('wrenti', 'L3', 37.02)]
  it('only the species; the listed pin, else the nearest (the first on a tie)', () => {
    const r = focusTargets(PINS, focus('wrenti', 'L1'), 5, CENTER)
    expect(r.kind === 'focused' && r.pins.map(p => p.locId)).toEqual(['L1', 'L2', 'L3'])
    expect(r.kind === 'focused' && r.target.locId).toBe('L1')
    const near = focusTargets(PINS, focus('wrenti', 'L9'), 5, CENTER)
    expect(near.kind === 'focused' && near.target.locId).toBe('L2')
    expect(near.kind === 'focused' && near.name).toBe('WRENTI')
  })

  it('a stale or missing focus, and an absent species', () => {
    expect(focusTargets(PINS, focus('wrenti', 'L1', 1), 5, CENTER).kind).toBe('none')
    expect(focusTargets(PINS, focus('ruff', 'L1'), 5, CENTER)).toEqual({ kind: 'absent', pins: PINS })
  })
})

describe('nameForCode: the name the app already holds for a code', () => {
  it('reads an own entry; none, or two names for one code, give null', () => {
    expect(nameForCode('stejay', { "Steller's Jay": 'stejay', Wrentit: 'wrenti' })).toBe("Steller's Jay")
    expect(nameForCode('ruff', { Wrentit: 'wrenti' })).toBeNull()
    expect(nameForCode('x', { A: 'x', B: 'x' })).toBeNull()
  })

  it('an own __proto__ or constructor key from the data is data, and an inherited member is never a name', () => {
    const polluted = JSON.parse('{"__proto__": "evilcode", "Wrentit": "wrenti"}') as Record<string, string>
    expect(nameForCode('evilcode', polluted)).toBe('__proto__')
    expect(nameForCode('wrenti', polluted)).toBe('Wrentit')
    expect(nameForCode('toString', {})).toBeNull()
    expect(nameForCode('constructor', { Wrentit: 'wrenti' })).toBeNull()
  })
})

describe('the copy (design-spec.md "In-app landing copy (bird tap)")', () => {
  it('the pill, its accessible names, and the statement line in both views', () => {
    expect(focusPillText("Baird's Sandpiper")).toEqual({ only: "Only Baird's Sandpiper", action: 'Show all' })
    expect(focusPillLabel("Baird's Sandpiper", 'lifers')).toBe("Showing only Baird's Sandpiper. Show all nearby lifers")
    expect(focusPillLabel("Baird's Sandpiper", 'targets')).toBe("Showing only Baird's Sandpiper. Show all nearby media targets")
    expect(focusAbsentStatement("Baird's Sandpiper", 'lifers')).toBe("Baird's Sandpiper was not found within 25 miles. Showing all lifers.")
    expect(focusAbsentStatement("Baird's Sandpiper", 'targets')).toBe("Baird's Sandpiper was not found within 25 miles. Showing all media targets.")
    expect(focusAbsentStatement(null, 'lifers')).toBe('The bird you tapped was not found within 25 miles. Showing all lifers.')
  })

  it('no em dash anywhere in the copy', () => {
    const all = [
      ...Object.values(focusPillText('X')), focusPillLabel('X', 'lifers'), focusPillLabel('X', 'targets'),
      focusAbsentStatement('X', 'lifers'), focusAbsentStatement(null, 'targets'),
    ]
    for (const s of all) expect(s).not.toContain('—')
  })
})

describe('the landing line (device pass on 1.0.36 build 2)', () => {
  it('names the bird when the app holds the name, else says the bird you tapped; a view tap names the view', () => {
    expect(landingText('lifers', "Baird's Sandpiper", true)).toBe("Finding Baird's Sandpiper near you\u2026")
    expect(landingText('lifers', null, true)).toBe('Finding the bird you tapped\u2026')
    expect(landingText('targets', null, true)).toBe('Finding the bird you tapped\u2026')
    expect(landingText('lifers', null, false)).toBe('Finding nearby lifers\u2026')
    expect(landingText('targets', 'ignored', false)).toBe('Finding nearby media targets\u2026')
  })

  it('a real ellipsis, never three dots, and no em dash', () => {
    for (const t of [landingText('lifers', 'X', true), landingText('lifers', null, true), landingText('targets', null, false)]) {
      expect(t.endsWith('\u2026')).toBe(true)
      expect(t).not.toContain('...')
      expect(t).not.toContain('\u2014')
    }
  })
})

describe('boundedLocation: the landing never waits on a fix forever', () => {
  it('the bound is the 10 s the web and desktop paths already keep', () => {
    expect(LANDING_LOCATION_BOUND_MS).toBe(10_000)
  })

  it('a fix inside the bound passes through; a failure passes through', async () => {
    await expect(boundedLocation(Promise.resolve({ lat: 1, lng: 2 }), 50)).resolves.toEqual({ lat: 1, lng: 2 })
    await expect(boundedLocation(Promise.reject({ code: 'permission-denied' }), 50)).rejects.toEqual({ code: 'permission-denied' })
  })

  it('a fix that never comes rejects with the timeout code at the bound, and a late fix changes nothing', async () => {
    vi.useFakeTimers()
    try {
      let late!: (v: { lat: number; lng: number }) => void
      const settled: unknown[] = []
      const p = boundedLocation(new Promise<{ lat: number; lng: number }>(r => { late = r }), LANDING_LOCATION_BOUND_MS)
      p.then(v => settled.push(['ok', v]), e => settled.push(['err', e]))
      await vi.advanceTimersByTimeAsync(LANDING_LOCATION_BOUND_MS - 1)
      expect(settled).toEqual([])
      await vi.advanceTimersByTimeAsync(1)
      expect(settled).toEqual([['err', { code: 'timeout' }]])
      late({ lat: 1, lng: 2 })
      await vi.advanceTimersByTimeAsync(10)
      expect(settled).toEqual([['err', { code: 'timeout' }]])
    } finally {
      vi.useRealTimers()
    }
  })
})
