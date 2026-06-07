import { describe, it, expect, vi, afterEach } from 'vitest'
import { describeLocationError } from './location'
import type { LocationError } from './location'

// isWindows() reads navigator.userAgent; mock the platform module so the
// permission-denied/tauri branch is deterministic per test.
vi.mock('./platform', () => ({
  isTauri: () => false,
  isWindows: vi.fn(() => false),
}))
import { isWindows } from './platform'

afterEach(() => {
  vi.mocked(isWindows).mockReturnValue(false)
})

describe('describeLocationError', () => {
  it('web permission-denied points at browser settings', () => {
    const e: LocationError = { code: 'permission-denied', platform: 'web' }
    expect(describeLocationError(e)).toMatch(/browser settings/i)
  })

  it('tauri permission-denied on macOS points at System Settings', () => {
    const e: LocationError = { code: 'permission-denied', platform: 'tauri' }
    expect(describeLocationError(e)).toMatch(/System Settings/i)
  })

  it('tauri permission-denied on Windows points at Windows Settings', () => {
    vi.mocked(isWindows).mockReturnValue(true)
    const e: LocationError = { code: 'permission-denied', platform: 'tauri' }
    expect(describeLocationError(e)).toMatch(/Windows Settings/i)
  })

  it('timeout message mentions a timeout', () => {
    expect(describeLocationError({ code: 'timeout' })).toMatch(/timed out/i)
  })

  it('dev-mode message mentions a production build', () => {
    expect(describeLocationError({ code: 'dev-mode' })).toMatch(/production build/i)
  })

  it('insecure-context message mentions HTTPS', () => {
    expect(describeLocationError({ code: 'insecure-context' })).toMatch(/HTTPS/i)
  })

  it('unavailable falls back to the generic message', () => {
    expect(describeLocationError({ code: 'unavailable' })).toMatch(/Unable to determine your location/i)
  })
})
