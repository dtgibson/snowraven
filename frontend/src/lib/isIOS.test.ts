// @vitest-environment jsdom
// isIOS seam tests (mobile-app schema §2.5). jsdom so `window` exists and the
// __TAURI_INTERNALS__ presence check can be exercised both ways; the plugin-os
// platform() probe is mocked (it is sync in v2 — verify-item V1, confirmed
// against the installed package's dist-js types).
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@tauri-apps/plugin-os', () => ({ platform: vi.fn() }))

import { platform } from '@tauri-apps/plugin-os'
import { isIOS } from './platform'

const win = window as unknown as Record<string, unknown>

afterEach(() => {
  delete win['__TAURI_INTERNALS__']
  vi.mocked(platform).mockReset()
})

describe('isIOS', () => {
  it('returns false outside Tauri even if the OS probe would say ios (web/Pi builds)', () => {
    vi.mocked(platform).mockReturnValue('ios')
    expect(isIOS()).toBe(false)
    expect(platform).not.toHaveBeenCalled() // short-circuits before the probe
  })

  it('returns true in Tauri when the plugin reports ios (iPhone AND iPadOS both report "ios")', () => {
    win['__TAURI_INTERNALS__'] = {}
    vi.mocked(platform).mockReturnValue('ios')
    expect(isIOS()).toBe(true)
  })

  it('returns false in Tauri on every desktop platform', () => {
    win['__TAURI_INTERNALS__'] = {}
    for (const p of ['macos', 'windows', 'linux'] as const) {
      vi.mocked(platform).mockReturnValue(p)
      expect(isIOS()).toBe(false)
    }
  })

  it('returns false (never throws) when the probe throws — e.g. the os plugin is not registered', () => {
    win['__TAURI_INTERNALS__'] = {}
    vi.mocked(platform).mockImplementation(() => {
      throw new Error('os plugin internals absent')
    })
    expect(isIOS()).toBe(false)
  })
})
