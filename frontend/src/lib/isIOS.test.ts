// @vitest-environment jsdom
/// <reference types="node" />
// isIOS seam tests (mobile-app schema §2.5). jsdom so `window` exists and the
// __TAURI_INTERNALS__ presence check can be exercised both ways; the plugin-os
// platform() probe is mocked (it is sync in v2 — verify-item V1, confirmed
// against the installed package's dist-js types).
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@tauri-apps/plugin-os', () => ({ platform: vi.fn() }))

import { platform } from '@tauri-apps/plugin-os'
import { isIOS, isAndroid, isMacOS, isMobileApp } from './platform'

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

// android-release QA-10 (FR-10): isAndroid() and isMobileApp() ride the same
// synchronous platform() probe, with the same false-outside-Tauri and
// false-on-throw posture, and isIOS() keeps returning false on Android.
describe('isAndroid and isMobileApp (android-release FR-10)', () => {
  it('Android: isAndroid and isMobileApp true; isIOS and isMacOS false', () => {
    win['__TAURI_INTERNALS__'] = {}
    vi.mocked(platform).mockReturnValue('android')
    expect(isAndroid()).toBe(true)
    expect(isMobileApp()).toBe(true)
    expect(isIOS()).toBe(false)
    expect(isMacOS()).toBe(false)
  })

  it('iOS: isMobileApp true, isAndroid false', () => {
    win['__TAURI_INTERNALS__'] = {}
    vi.mocked(platform).mockReturnValue('ios')
    expect(isAndroid()).toBe(false)
    expect(isMobileApp()).toBe(true)
  })

  it('every desktop platform: neither mobile predicate is true', () => {
    win['__TAURI_INTERNALS__'] = {}
    for (const p of ['macos', 'windows', 'linux'] as const) {
      vi.mocked(platform).mockReturnValue(p)
      expect(isAndroid()).toBe(false)
      expect(isMobileApp()).toBe(false)
    }
  })

  it('outside Tauri (web/Pi): false without consulting the probe, even if it would say android', () => {
    vi.mocked(platform).mockReturnValue('android')
    expect(isAndroid()).toBe(false)
    expect(isMobileApp()).toBe(false)
    expect(platform).not.toHaveBeenCalled()
  })

  it('a throwing probe reads as false for all three, never a crash', () => {
    win['__TAURI_INTERNALS__'] = {}
    vi.mocked(platform).mockImplementation(() => {
      throw new Error('os plugin internals absent')
    })
    expect(isAndroid()).toBe(false)
    expect(isIOS()).toBe(false)
    expect(isMobileApp()).toBe(false)
  })

  it('platform.ts reads navigator.userAgent only inside isWindows (no new UA sniff)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(import.meta.dirname, 'platform.ts'), 'utf8')
    // comments stripped, so a comment naming the UA cannot satisfy or fail this
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const reads = code.match(/navigator\.userAgent/g) ?? []
    expect(reads).toHaveLength(1)
    const isWindowsBody = code.slice(code.indexOf('export function isWindows'))
    expect(isWindowsBody).toContain('navigator.userAgent')
  })
})
