import { useCallback, useEffect, useRef, useState } from 'react'
import { storage, type StorageAdapter } from './storage'

export const EMBEDDED_MEDIA_SETTING_KEY = 'disableEmbeddedMedia'
export const EMBEDDED_MEDIA_PREFERENCE_ERROR = "Couldn't save this setting. Your previous choice was restored."

type PreferenceStorage = Pick<StorageAdapter, 'getSetting' | 'setSetting'>

/** Only the literal boolean true disables embeds. Every legacy or malformed
 * value preserves SnowRaven's existing embed-enabled behavior. */
export function normalizeDisableEmbeddedMedia(raw: unknown): boolean {
  return raw === true
}

/**
 * Owns the durable, app-wide embedded-media preference.
 *
 * `disableEmbeddedMedia === null` is the startup hydration state. The derived
 * `embedAllowed` value deliberately stays false until the storage seam has
 * resolved, so a saved opt-out can never flash or request an iframe first.
 * Writes are serialized while the UI updates immediately; a failed latest write
 * rolls back to the last value that actually reached durable storage.
 */
export function useEmbeddedMediaPreference(preferenceStorage: PreferenceStorage = storage) {
  const [disableEmbeddedMedia, setDisableEmbeddedMediaState] = useState<boolean | null>(null)
  const [preferenceError, setPreferenceError] = useState<string | null>(null)
  const [pendingWrites, setPendingWrites] = useState(0)

  const mountedRef = useRef(false)
  const hydratedRef = useRef(false)
  const durableValueRef = useRef(false)
  const latestRequestRef = useRef(0)
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    void preferenceStorage.getSetting<unknown>(EMBEDDED_MEDIA_SETTING_KEY)
      .then(raw => {
        if (cancelled) return
        const normalized = normalizeDisableEmbeddedMedia(raw)
        durableValueRef.current = normalized
        hydratedRef.current = true
        setDisableEmbeddedMediaState(normalized)
      })
      .catch(() => {
        if (cancelled) return
        // A missing/unreadable value follows the approved legacy-safe default.
        durableValueRef.current = false
        hydratedRef.current = true
        setDisableEmbeddedMediaState(false)
      })

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [preferenceStorage])

  const setDisableEmbeddedMedia = useCallback((next: boolean) => {
    if (!hydratedRef.current) return

    const requestId = ++latestRequestRef.current
    if (mountedRef.current) {
      setDisableEmbeddedMediaState(next)
      setPreferenceError(null)
      setPendingWrites(count => count + 1)
    }

    // One settings document backs desktop persistence, so serialize writes. The
    // visible state still changes above in the same interaction.
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      try {
        await preferenceStorage.setSetting(EMBEDDED_MEDIA_SETTING_KEY, next)
        durableValueRef.current = next
      } catch {
        // An older failed request must not roll back a newer user choice. Only the
        // newest request reconciles the control to the last durable value.
        if (mountedRef.current && requestId === latestRequestRef.current) {
          setDisableEmbeddedMediaState(durableValueRef.current)
          setPreferenceError(EMBEDDED_MEDIA_PREFERENCE_ERROR)
        }
      } finally {
        if (mountedRef.current) setPendingWrites(count => Math.max(0, count - 1))
      }
    })
  }, [preferenceStorage])

  return {
    disableEmbeddedMedia,
    // Both unresolved and explicitly disabled states are closed to iframe mounts.
    embedAllowed: disableEmbeddedMedia === false,
    preferenceError,
    preferenceSaving: pendingWrites > 0,
    setDisableEmbeddedMedia,
  }
}
