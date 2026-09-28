import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadTabLayout, saveTabLayout, clearTabLayout, visibleTabs, parseLayout, serializeLayout, DEFAULT_TAB_ORDER, PREVIOUS_DEFAULT_TAB_ORDER, type TabLayoutState } from './tabLayout'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear:      () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => localStorageMock.clear())

describe('loadTabLayout — no stored value', () => {
  it('returns default order when localStorage is empty', () => {
    const state = loadTabLayout()
    expect(state.order).toEqual(DEFAULT_TAB_ORDER)
    expect(state.hidden.size).toBe(0)
  })
})

describe('DEFAULT_TAB_ORDER', () => {
  it('matches the intended first-run navigation order', () => {
    // Map Explorer third and Calendar fifth since 1.0.19, so the phone bar's
    // default first four (Weather, Statistics, Map Explorer, Species Detail)
    // put the map above the fold; Targets sits right after Calendar (QA-02).
    expect(DEFAULT_TAB_ORDER).toEqual([
      'weather',
      'birding-stats',
      'map-explorer',
      'species-detail',
      'calendar',
      'targets',
      'life-list',
      'breeding-codes',
      'checklists',
      'comparer',
      'named-birds',
    ])
    expect(DEFAULT_TAB_ORDER.indexOf('targets')).toBe(5)
    expect(DEFAULT_TAB_ORDER.indexOf('targets')).toBe(DEFAULT_TAB_ORDER.indexOf('calendar') + 1)
  })

  it('keeps the 1.0.19 default as a literal, since the migration below is one equality against it', () => {
    // Spelled out rather than derived: if this constant drifts, every device
    // still on the old default silently stops following the new one. Exactly
    // one generation: the 1.0.18 order this constant used to hold is retired.
    expect(PREVIOUS_DEFAULT_TAB_ORDER).toEqual([
      'weather',
      'birding-stats',
      'map-explorer',
      'species-detail',
      'calendar',
      'life-list',
      'breeding-codes',
      'checklists',
      'comparer',
      'named-birds',
    ])
    expect(PREVIOUS_DEFAULT_TAB_ORDER).not.toEqual(DEFAULT_TAB_ORDER)
    expect(PREVIOUS_DEFAULT_TAB_ORDER).not.toContain('targets')
  })
})

// The saved documents below are literals on purpose. A test that imports the
// constant it is checking proves delivery, never content; these prove that the
// bytes a device on each default actually has on disk are what the normalizer
// recognises.
const DEFAULT_1_0_18 = [
  'weather', 'birding-stats', 'calendar', 'species-detail', 'map-explorer',
  'life-list', 'breeding-codes', 'checklists', 'comparer', 'named-birds',
]
const PREVIOUS_DEFAULT_1_0_19 = [
  'weather', 'birding-stats', 'map-explorer', 'species-detail', 'calendar',
  'life-list', 'breeding-codes', 'checklists', 'comparer', 'named-birds',
]
const NEW_DEFAULT_WITH_TARGETS = [
  'weather', 'birding-stats', 'map-explorer', 'species-detail', 'calendar',
  'targets', 'life-list', 'breeding-codes', 'checklists', 'comparer', 'named-birds',
]

describe('parseLayout — a saved order equal to the 1.0.19 default reads as the current default (QA-03)', () => {
  it('maps the previous default to the new default, Targets after Calendar, with an empty hidden set', () => {
    const state = parseLayout({ order: PREVIOUS_DEFAULT_1_0_19, hidden: [] })
    expect(state.order).toEqual(NEW_DEFAULT_WITH_TARGETS)
    expect(state.hidden.size).toBe(0)
  })

  it('keeps the hidden set through the migration (hide/show without a drag writes the default order back)', () => {
    const state = parseLayout({ order: PREVIOUS_DEFAULT_1_0_19, hidden: ['comparer', 'life-list'] })
    expect(state.order).toEqual(NEW_DEFAULT_WITH_TARGETS)
    expect([...state.hidden].sort()).toEqual(['comparer', 'life-list'])
    // and the visible list is the new default minus exactly those two
    expect(visibleTabs(state)).toEqual(NEW_DEFAULT_WITH_TARGETS.filter(t => t !== 'comparer' && t !== 'life-list'))
  })

  it('returns the new default unchanged (round-trip)', () => {
    const state = parseLayout({ order: NEW_DEFAULT_WITH_TARGETS, hidden: ['weather'] })
    expect(state.order).toEqual(NEW_DEFAULT_WITH_TARGETS)
    expect(state.hidden.has('weather')).toBe(true)
  })

  it('leaves a custom order verbatim with Targets appended LAST, including a single swap elsewhere', () => {
    // Breeding Codes and Checklists swapped; everything else in its 1.0.19
    // slot. This is a user's order: it must not move, and the new tab arrives
    // by the existing missing-tab step at the end, not after Calendar.
    const oneSwap = [
      'weather', 'birding-stats', 'map-explorer', 'species-detail', 'calendar',
      'life-list', 'checklists', 'breeding-codes', 'comparer', 'named-birds',
    ]
    expect(parseLayout({ order: oneSwap, hidden: [] }).order).toEqual([...oneSwap, 'targets'])

    // A thoroughly custom order is likewise untouched, Targets last.
    const custom = [
      'named-birds', 'comparer', 'checklists', 'breeding-codes', 'life-list',
      'map-explorer', 'species-detail', 'calendar', 'birding-stats', 'weather',
    ]
    const state = parseLayout({ order: custom, hidden: ['calendar'] })
    expect(state.order).toEqual([...custom, 'targets'])
    expect([...state.hidden]).toEqual(['calendar'])
  })

  it('compares AFTER the unknown-id drop, so a stray id does not mask an otherwise-default order', () => {
    const withStray = [...PREVIOUS_DEFAULT_1_0_19.slice(0, 3), 'unknown-future-tab', ...PREVIOUS_DEFAULT_1_0_19.slice(3)]
    const state = parseLayout({ order: withStray, hidden: [] })
    expect(state.order).toEqual(NEW_DEFAULT_WITH_TARGETS)
  })

  it('compares against the constant given the SAME missing-tab append, or the migration could never fire', () => {
    // The saved 1.0.19 default has ten ids; after the append it has eleven,
    // with Targets last. Compared against the bare ten-id constant it would
    // never be equal and every device on the old default would silently keep
    // Targets last. This row goes red if the comparison loses its append.
    const appended = [...PREVIOUS_DEFAULT_1_0_19, 'targets']
    expect(parseLayout({ order: appended, hidden: [] }).order).toEqual(NEW_DEFAULT_WITH_TARGETS)
  })

  it('does NOT migrate a previous default that is missing its tail: that shape is two generations old', () => {
    // Through 1.0.36 this shape migrated, because the append restored the tail
    // in default order and reproduced the old default exactly. With Targets in
    // the roster the append now inserts Targets BEFORE the restored tail, so
    // the result is no longer the previous default plus Targets. It is kept as
    // saved plus the append, which is the standing rule for a custom order.
    const missingTail = PREVIOUS_DEFAULT_1_0_19.slice(0, 8) // through 'checklists'
    const state = parseLayout({ order: missingTail, hidden: [] })
    expect(state.order).toEqual([...missingTail, 'targets', 'comparer', 'named-birds'])
    expect(state.order).not.toEqual(NEW_DEFAULT_WITH_TARGETS)
  })

  it('does NOT migrate the 1.0.18 default: exactly one generation migrates', () => {
    const state = parseLayout({ order: DEFAULT_1_0_18, hidden: ['comparer'] })
    expect(state.order).toEqual([...DEFAULT_1_0_18, 'targets'])
    expect(state.hidden.has('comparer')).toBe(true)
  })

  it('does NOT migrate a pre-Calendar (0.5.42) default: the append puts Calendar and Targets last', () => {
    const preCalendar = [
      'weather', 'birding-stats', 'species-detail', 'map-explorer',
      'life-list', 'breeding-codes', 'checklists', 'comparer', 'named-birds',
    ]
    const state = parseLayout({ order: preCalendar, hidden: [] })
    expect(state.order).toEqual([...preCalendar, 'calendar', 'targets'])
    expect(state.order).not.toEqual(NEW_DEFAULT_WITH_TARGETS)
  })
})

describe('loadTabLayout — the 1.0.19 default on disk', () => {
  it('reads as the new default and writes nothing back', () => {
    const stored = JSON.stringify({ order: PREVIOUS_DEFAULT_1_0_19, hidden: ['comparer'] })
    localStorageMock.setItem('sr-tab-layout', stored)
    const state = loadTabLayout()
    expect(state.order).toEqual(NEW_DEFAULT_WITH_TARGETS)
    expect(state.hidden.has('comparer')).toBe(true)
    // Hydration never persists: the document on disk is byte-for-byte what was there.
    expect(localStorageMock.getItem('sr-tab-layout')).toBe(stored)
  })
})

describe('loadTabLayout — valid stored value', () => {
  it('restores a custom order', () => {
    localStorageMock.setItem('sr-tab-layout', JSON.stringify({
      order: ['birding-stats', 'weather', 'species-detail', 'map-explorer', 'life-list', 'breeding-codes', 'comparer'],
      hidden: [],
    }))
    const state = loadTabLayout()
    expect(state.order[0]).toBe('birding-stats')
    expect(state.order[1]).toBe('weather')
  })

  it('restores hidden tabs', () => {
    localStorageMock.setItem('sr-tab-layout', JSON.stringify({
      order: DEFAULT_TAB_ORDER,
      hidden: ['comparer', 'life-list'],
    }))
    const state = loadTabLayout()
    expect(state.hidden.has('comparer')).toBe(true)
    expect(state.hidden.has('life-list')).toBe(true)
    expect(state.hidden.has('weather')).toBe(false)
  })
})

describe('loadTabLayout — malformed or invalid stored value', () => {
  it('falls back to default on malformed JSON', () => {
    localStorageMock.setItem('sr-tab-layout', 'not-json{{{')
    const state = loadTabLayout()
    expect(state.order).toEqual(DEFAULT_TAB_ORDER)
    expect(state.hidden.size).toBe(0)
  })

  it('falls back to default when value is not an object', () => {
    localStorageMock.setItem('sr-tab-layout', '"just-a-string"')
    const state = loadTabLayout()
    expect(state.order).toEqual(DEFAULT_TAB_ORDER)
  })

  it('falls back to default when order is not an array', () => {
    localStorageMock.setItem('sr-tab-layout', JSON.stringify({ order: 'bad', hidden: [] }))
    const state = loadTabLayout()
    expect(state.order).toEqual(DEFAULT_TAB_ORDER)
  })
})

describe('loadTabLayout — unknown or missing tab IDs (FR-13)', () => {
  it('ignores unknown tab IDs in order', () => {
    localStorageMock.setItem('sr-tab-layout', JSON.stringify({
      order: ['weather', 'unknown-future-tab', 'species-detail'],
      hidden: [],
    }))
    const state = loadTabLayout()
    expect(state.order).not.toContain('unknown-future-tab')
  })

  it('ignores unknown tab IDs in hidden', () => {
    localStorageMock.setItem('sr-tab-layout', JSON.stringify({
      order: DEFAULT_TAB_ORDER,
      hidden: ['unknown-tab'],
    }))
    const state = loadTabLayout()
    expect(state.hidden.size).toBe(0)
  })

  it('appends tabs that are missing from stored order', () => {
    // Stored without newer tabs — simulates tabs added after preferences were saved
    localStorageMock.setItem('sr-tab-layout', JSON.stringify({
      order: ['weather', 'species-detail', 'birding-stats', 'map-explorer', 'life-list', 'breeding-codes'],
      hidden: [],
    }))
    const state = loadTabLayout()
    expect(state.order).toContain('comparer')
    expect(state.order.slice(-3)).toEqual(['checklists', 'comparer', 'named-birds'])
  })
})

describe('saveTabLayout + loadTabLayout roundtrip', () => {
  it('round-trips order and hidden set correctly', () => {
    saveTabLayout({
      order: ['birding-stats', 'weather', 'species-detail', 'map-explorer', 'life-list', 'breeding-codes', 'comparer'],
      hidden: new Set(['comparer']),
    })
    const state = loadTabLayout()
    expect(state.order[0]).toBe('birding-stats')
    expect(state.hidden.has('comparer')).toBe(true)
    expect(state.hidden.size).toBe(1)
  })
})

describe('clearTabLayout', () => {
  it('removes stored preference so next load returns defaults', () => {
    saveTabLayout({ order: ['comparer', ...DEFAULT_TAB_ORDER.slice(0, 6)], hidden: new Set(['weather']) })
    clearTabLayout()
    const state = loadTabLayout()
    expect(state.order).toEqual(DEFAULT_TAB_ORDER)
    expect(state.hidden.size).toBe(0)
  })
})

describe('parseLayout (used by both the localStorage and storage-seam paths)', () => {
  it('normalizes a valid serialized layout', () => {
    const state = parseLayout({
      order: ['birding-stats', 'weather', 'species-detail', 'map-explorer', 'life-list', 'breeding-codes', 'comparer'],
      hidden: ['comparer'],
    })
    expect(state.order[0]).toBe('birding-stats')
    expect(state.hidden.has('comparer')).toBe(true)
    expect(state.hidden.size).toBe(1)
  })

  it('drops unknown tab IDs and appends missing tabs', () => {
    const state = parseLayout({
      order: ['weather', 'unknown-future-tab', 'species-detail'],
      hidden: ['also-unknown'],
    })
    expect(state.order).not.toContain('unknown-future-tab')
    expect(state.order).toContain('comparer') // appended
    expect(state.hidden.size).toBe(0)
  })

  it('falls back to default for malformed input', () => {
    expect(parseLayout(null).order).toEqual(DEFAULT_TAB_ORDER)
    expect(parseLayout('nope').order).toEqual(DEFAULT_TAB_ORDER)
    expect(parseLayout({ order: 'bad' }).order).toEqual(DEFAULT_TAB_ORDER)
  })

  it('appends the Checklists tab, visible, to a layout saved before it existed (QA-01)', () => {
    const preChecklists = parseLayout({
      order: ['weather', 'species-detail', 'birding-stats', 'map-explorer', 'life-list', 'breeding-codes', 'named-birds', 'comparer'],
      hidden: ['comparer'],
    })
    expect(preChecklists.order).toContain('checklists')
    expect(preChecklists.hidden.has('checklists')).toBe(false)
    expect(visibleTabs(preChecklists)).toContain('checklists')
  })

  it('appends the Calendar tab, visible, to a layout saved before it existed (QA-02)', () => {
    const preCalendar = parseLayout({
      order: ['weather', 'species-detail', 'birding-stats', 'map-explorer', 'life-list', 'breeding-codes', 'checklists', 'named-birds', 'comparer'],
      hidden: ['comparer'],
    })
    expect(preCalendar.order).toContain('calendar')
    expect(preCalendar.hidden.has('calendar')).toBe(false)
    expect(visibleTabs(preCalendar)).toContain('calendar')
    // the rest of the saved order/hidden is otherwise unchanged
    expect(preCalendar.order[0]).toBe('weather')
    expect(preCalendar.hidden.has('comparer')).toBe(true)
  })
})

describe('serializeLayout', () => {
  it('converts the hidden Set to an array and round-trips through parseLayout', () => {
    const original: TabLayoutState = {
      order: ['birding-stats', 'weather', 'calendar', 'targets', 'species-detail', 'map-explorer', 'life-list', 'breeding-codes', 'named-birds', 'checklists', 'comparer'],
      hidden: new Set(['comparer', 'life-list']),
    }
    const serialized = serializeLayout(original)
    expect(Array.isArray(serialized.hidden)).toBe(true)
    expect(serialized.hidden).toEqual(expect.arrayContaining(['comparer', 'life-list']))

    const restored = parseLayout(serialized)
    expect(restored.order).toEqual([...original.order])
    expect(restored.hidden.has('comparer')).toBe(true)
    expect(restored.hidden.has('life-list')).toBe(true)
    expect(restored.hidden.size).toBe(2)
  })
})

describe('visibleTabs', () => {
  it('returns all tabs in saved order when none are hidden (QA-07)', () => {
    const order = ['birding-stats', 'weather', 'species-detail', 'map-explorer', 'life-list', 'breeding-codes', 'comparer'] as const
    const result = visibleTabs({ order: [...order], hidden: new Set() })
    expect(result).toEqual(order)
  })

  it('omits hidden tabs while preserving order (QA-07)', () => {
    const result = visibleTabs({
      order: [...DEFAULT_TAB_ORDER],
      hidden: new Set(['comparer', 'breeding-codes']),
    })
    expect(result).not.toContain('comparer')
    expect(result).not.toContain('breeding-codes')
    expect(result[0]).toBe('weather')
    expect(result).toHaveLength(DEFAULT_TAB_ORDER.length - 2)
  })

  it('returns an empty list when every configurable tab is hidden (QA-12)', () => {
    const result = visibleTabs({
      order: [...DEFAULT_TAB_ORDER],
      hidden: new Set(DEFAULT_TAB_ORDER),
    })
    expect(result).toEqual([])
  })
})

describe('loadTabLayout — localStorage unavailable', () => {
  it('returns defaults when localStorage throws', () => {
    vi.spyOn(localStorageMock, 'getItem').mockImplementationOnce(() => { throw new Error('blocked') })
    const state = loadTabLayout()
    expect(state.order).toEqual(DEFAULT_TAB_ORDER)
    expect(state.hidden.size).toBe(0)
  })
})
