import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadTabLayout, saveTabLayout, clearTabLayout, visibleTabs, DEFAULT_TAB_ORDER } from './tabLayout'

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
    // Stored without 'comparer' — simulates a tab added after preferences were saved
    localStorageMock.setItem('sr-tab-layout', JSON.stringify({
      order: ['weather', 'species-detail', 'birding-stats', 'map-explorer', 'life-list', 'breeding-codes'],
      hidden: [],
    }))
    const state = loadTabLayout()
    expect(state.order).toContain('comparer')
    expect(state.order[state.order.length - 1]).toBe('comparer')
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
