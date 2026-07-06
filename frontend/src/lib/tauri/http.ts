import { fetch as rawFetch } from '@tauri-apps/plugin-http'

// Default request budget for desktop service calls. Mirrors the backend's httpx
// timeouts so a stalled network (captive portal, flaky signal, provider hiccup)
// surfaces a typed error instead of hanging the spinner forever.
export const DEFAULT_TIMEOUT_MS = 10_000

type RawInit = NonNullable<Parameters<typeof rawFetch>[1]>

/**
 * `@tauri-apps/plugin-http` fetch with a hard request timeout. Drop-in replacement
 * for the plugin's `fetch` (imported as `tauriFetch` everywhere) — same call shape,
 * plus an optional `timeoutMs`. On timeout it aborts and throws a typed error
 * (`{ status: 0, timeout: true }`) that the services' existing catch blocks already
 * surface as "Could not reach …".
 */
export async function tauriFetch(
  input: Parameters<typeof rawFetch>[0],
  init: RawInit & { timeoutMs?: number } = {},
): Promise<Awaited<ReturnType<typeof rawFetch>>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await rawFetch(input, { ...rest, signal: controller.signal })
  } catch (err) {
    if (controller.signal.aborted) {
      throw Object.assign(
        new Error('The request timed out. Check your connection and try again.'),
        { status: 0, timeout: true },
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
