// Shared jsdom matchMedia double. Values are keyed by the complete query string:
// a phone-width answer must never leak into a different max-width band.

export const PHONE_MEDIA_QUERY = '(max-width:640px)'
export const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)'

export interface ExactMatchMediaStub {
  setMatches(query: string, matches: boolean): void
  restore(): void
}

type LegacyListener = (event: MediaQueryListEvent) => void

interface StubMql {
  list: MediaQueryList
  modernListeners: Set<EventListenerOrEventListenerObject>
  legacyListeners: Set<LegacyListener>
}

export function installExactMatchMedia(
  initialMatches: Readonly<Record<string, boolean>> = {},
): ExactMatchMediaStub {
  const values = new Map(Object.entries(initialMatches))
  const listsByQuery = new Map<string, Set<StubMql>>()
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia')

  window.matchMedia = ((query: string) => {
    const state = {
      list: null as unknown as MediaQueryList,
      modernListeners: new Set<EventListenerOrEventListenerObject>(),
      legacyListeners: new Set<LegacyListener>(),
    }
    const list = {
      get matches() { return values.get(query) ?? false },
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type === 'change' && listener) state.modernListeners.add(listener)
      },
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type === 'change' && listener) state.modernListeners.delete(listener)
      },
      addListener: (listener: LegacyListener) => { state.legacyListeners.add(listener) },
      removeListener: (listener: LegacyListener) => { state.legacyListeners.delete(listener) },
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
    state.list = list

    let lists = listsByQuery.get(query)
    if (!lists) {
      lists = new Set()
      listsByQuery.set(query, lists)
    }
    lists.add(state)
    return list
  }) as typeof window.matchMedia

  return {
    setMatches(query: string, matches: boolean) {
      const previous = values.get(query) ?? false
      values.set(query, matches)
      if (previous === matches) return

      for (const state of listsByQuery.get(query) ?? []) {
        const event = new Event('change') as MediaQueryListEvent
        Object.defineProperties(event, {
          matches: { value: matches },
          media: { value: query },
        })
        for (const listener of state.modernListeners) {
          if (typeof listener === 'function') listener.call(state.list, event)
          else listener.handleEvent(event)
        }
        for (const listener of state.legacyListeners) listener.call(state.list, event)
        state.list.onchange?.call(state.list, event)
      }
    },
    restore() {
      if (original) Object.defineProperty(window, 'matchMedia', original)
      else Reflect.deleteProperty(window, 'matchMedia')
    },
  }
}
