export type ConfigurableTab =
  | 'weather'
  | 'species-detail'
  | 'birding-stats'
  | 'calendar'
  | 'map-explorer'
  | 'life-list'
  | 'breeding-codes'
  | 'named-birds'
  | 'checklists'
  | 'comparer'

export const DEFAULT_TAB_ORDER: ConfigurableTab[] = [
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
]

/**
 * The default order as it shipped through 1.0.18 (Calendar third, Map Explorer
 * fifth). It exists for ONE equality in parseLayout: a saved order that is this
 * list element-for-element was never reordered by the user (Restore defaults,
 * or a hide/show with no drag, writes the default back verbatim), so it carries
 * no order preference and reads as the current default. The tab layout is
 * device-local and never synced, so without this step the 1.0.19 swap would
 * reach fresh installs only. Not a default for anything; do not read it as one.
 */
export const PREVIOUS_DEFAULT_TAB_ORDER: readonly ConfigurableTab[] = [
  'weather',
  'birding-stats',
  'calendar',
  'species-detail',
  'map-explorer',
  'life-list',
  'breeding-codes',
  'checklists',
  'comparer',
  'named-birds',
]

export const TAB_LABELS: Record<ConfigurableTab, string> = {
  'weather':        'Weather',
  'species-detail': 'Species Detail',
  'birding-stats':  'Statistics',
  'calendar':       'Calendar',
  'map-explorer':   'Map Explorer',
  'life-list':      'Multimedia',
  'breeding-codes': 'Breeding Codes',
  'named-birds':    'Named Birds',
  'checklists':     'Checklists',
  'comparer':       'List Comparer',
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

/** Plain JSON shape persisted to storage (Set is not serializable). */
export interface SerializedLayout {
  order: string[]
  hidden: string[]
}

const KNOWN_TABS = new Set<string>(DEFAULT_TAB_ORDER)
const STORAGE_KEY = 'sr-tab-layout'

function defaultState(): TabLayoutState {
  return { order: [...DEFAULT_TAB_ORDER], hidden: new Set() }
}

function sameOrder(a: readonly ConfigurableTab[], b: readonly ConfigurableTab[]): boolean {
  return a.length === b.length && a.every((tab, i) => tab === b[i])
}

/**
 * Validate and normalize an untrusted stored value into a TabLayoutState.
 * Unknown tab IDs are dropped; tabs missing from the stored order are
 * appended (so tabs added in a later release still appear); and an order
 * that, after those two steps, is the previous default element-for-element
 * reads as the current default (see PREVIOUS_DEFAULT_TAB_ORDER). Any other
 * order is returned as saved. The hidden set is never touched by that step,
 * and nothing here writes back: a migrated layout is persisted only when
 * the user next reorders, hides, shows or restores. Returns the default
 * layout for anything malformed. Shared by the localStorage path (web) and
 * the storage seam (desktop).
 */
export function parseLayout(parsed: unknown): TabLayoutState {
  if (typeof parsed !== 'object' || parsed === null) return defaultState()
  const obj = parsed as Record<string, unknown>

  const rawOrder = obj['order']
  if (!Array.isArray(rawOrder)) return defaultState()

  const knownOrder = rawOrder.filter((id): id is ConfigurableTab =>
    typeof id === 'string' && KNOWN_TABS.has(id)
  )

  const seen = new Set(knownOrder)
  for (const tab of DEFAULT_TAB_ORDER) {
    if (!seen.has(tab)) knownOrder.push(tab)
  }

  const order = sameOrder(knownOrder, PREVIOUS_DEFAULT_TAB_ORDER)
    ? [...DEFAULT_TAB_ORDER]
    : knownOrder

  const rawHidden = obj['hidden']
  const hiddenArr = Array.isArray(rawHidden) ? rawHidden : []
  const hidden = new Set<ConfigurableTab>(
    hiddenArr.filter((id): id is ConfigurableTab =>
      typeof id === 'string' && KNOWN_TABS.has(id)
    )
  )

  return { order, hidden }
}

/** TabLayoutState → plain JSON for persistence. */
export function serializeLayout(state: TabLayoutState): SerializedLayout {
  return { order: [...state.order], hidden: [...state.hidden] }
}

/** Synchronous read from localStorage. Used for the web/Pi first paint. */
export function loadTabLayout(): TabLayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return parseLayout(JSON.parse(raw) as unknown)
  } catch {
    return defaultState()
  }
}

/** Synchronous write to localStorage. Durable on web/Pi. */
export function saveTabLayout(state: TabLayoutState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeLayout(state)))
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
