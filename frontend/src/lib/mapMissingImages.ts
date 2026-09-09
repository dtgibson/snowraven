import type { MissingStyleImageResolver } from 'maplibre-gl'

/**
 * The subset of MapLibre's Map used by the missing-image registry. Keeping this
 * structural lets both the real Map and react-map-gl's MapRef use the same seam.
 */
export interface MissingStyleImageMap {
  setMissingStyleImageResolver(resolver: MissingStyleImageResolver | null): unknown
}

/** Return true when the id belongs to this handler, whether it was just added
 * or was already present. Foreign ids return false so the next owner can try. */
export type MissingStyleImageHandler = (id: string) => boolean

interface Registry {
  handlers: Set<MissingStyleImageHandler>
  resolver: MissingStyleImageResolver
}

const registries = new WeakMap<object, Registry>()

/**
 * MapLibre v6 allows one missing-style-image resolver per map. SnowRaven has
 * several independent sprite owners that can share a map, so install one
 * dispatcher and register each owner's exact-id handler behind it.
 */
export function registerMissingStyleImageHandler(
  map: MissingStyleImageMap,
  handler: MissingStyleImageHandler,
): () => void {
  let registry = registries.get(map)
  if (!registry) {
    const handlers = new Set<MissingStyleImageHandler>()
    const resolver: MissingStyleImageResolver = id => {
      for (const candidate of handlers) {
        if (candidate(id)) return
      }
    }
    registry = { handlers, resolver }
    registries.set(map, registry)
    map.setMissingStyleImageResolver(resolver)
  }

  registry.handlers.add(handler)
  let registered = true

  return () => {
    if (!registered) return
    registered = false
    const current = registries.get(map)
    if (!current) return
    current.handlers.delete(handler)
    if (current.handlers.size === 0) {
      map.setMissingStyleImageResolver(null)
      registries.delete(map)
    }
  }
}
