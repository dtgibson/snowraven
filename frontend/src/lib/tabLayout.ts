export type ConfigurableTab =
  | 'weather'
  | 'species-detail'
  | 'birding-stats'
  | 'map-explorer'
  | 'life-list'
  | 'breeding-codes'
  | 'comparer'

export const DEFAULT_TAB_ORDER: ConfigurableTab[] = [
  'weather',
  'species-detail',
  'birding-stats',
  'map-explorer',
  'life-list',
  'breeding-codes',
  'comparer',
]

export const TAB_LABELS: Record<ConfigurableTab, string> = {
  'weather':        'Weather',
  'species-detail': 'Species Detail',
  'birding-stats':  'Statistics',
  'map-explorer':   'Map Explorer',
  'life-list':      'Media List',
  'breeding-codes': 'Breeding Codes',
  'comparer':       'Life List Comparer',
}

export type Tab = ConfigurableTab | 'settings'

export interface TabLayoutState {
  order: ConfigurableTab[]
  hidden: Set<ConfigurableTab>
}

/**
 * The configurable tabs that should be shown, in the user's saved order,
 * with hidden tabs removed. Both the desktop bar and the compact dropdown
 * render from this list (each appends Settings itself).
 */
export function visibleTabs(layout: TabLayoutState): ConfigurableTab[] {
  return layout.order.filter(tab => !layout.hidden.has(tab))
}

const KNOWN_TABS = new Set<string>(DEFAULT_TAB_ORDER)
const STORAGE_KEY = 'sr-tab-layout'

function defaultState(): TabLayoutState {
  return { order: [...DEFAULT_TAB_ORDER], hidden: new Set() }
}

export function loadTabLayout(): TabLayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return defaultState()
    const obj = parsed as Record<string, unknown>

    const rawOrder = obj['order']
    if (!Array.isArray(rawOrder)) return defaultState()

    // Keep only known tab IDs in the stored order
    const knownOrder = rawOrder.filter((id): id is ConfigurableTab =>
      typeof id === 'string' && KNOWN_TABS.has(id)
    )

    // Append any tab not present in the stored order (FR-13: new tabs added later)
    const seen = new Set(knownOrder)
    for (const tab of DEFAULT_TAB_ORDER) {
      if (!seen.has(tab)) knownOrder.push(tab)
    }

    const rawHidden = obj['hidden']
    const hiddenArr = Array.isArray(rawHidden) ? rawHidden : []
    const hidden = new Set<ConfigurableTab>(
      hiddenArr.filter((id): id is ConfigurableTab =>
        typeof id === 'string' && KNOWN_TABS.has(id)
      )
    )

    return { order: knownOrder, hidden }
  } catch {
    return defaultState()
  }
}

export function saveTabLayout(state: TabLayoutState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      order: state.order,
      hidden: [...state.hidden],
    }))
  } catch {
    // private browsing — silently ignore
  }
}

export function clearTabLayout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // private browsing — silently ignore
  }
}
