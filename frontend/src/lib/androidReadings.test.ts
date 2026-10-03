// @vitest-environment jsdom
/// <reference types="node" />
// android-release FR-11 / QA-11: every isIOS() call site was classified as
// Apple-specific, mobile, or no-updater, and takes a deliberate Android reading.
// One row per line of the FR-11 table, run against the REAL platform module
// with only the os plugin's synchronous platform() probe reporting 'android'
// (plus __TAURI_INTERNALS__, as in the app), so a reading cannot pass by a
// mock's arrangement. Where the reading lives in a component, the row pins the
// pure reading here and the call site's wiring by a comment-stripped source
// check, so reverting the call site to its isIOS() form turns that row red.
//
// What this file cannot see: whether the composed Settings tree renders the
// wording (Settings.test.tsx's mobile suite), and anything on a real device.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@tauri-apps/plugin-os', () => ({ platform: vi.fn(() => 'android') }))
const invokeMock = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
const geo = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
}))
vi.mock('@tauri-apps/plugin-geolocation', () => geo)

import { isAndroid, isIOS, isMobileApp } from './platform'
import { showUpdaterFooter, supportsAppRelaunch, compactChrome, showICloudSync } from './platformGates'
import { alertsSupported } from './alerts/alertsState'
import { widgetsSupported } from './widgets/widgetHandover'
import { fileRowButtonLabel } from './fileRowCopy'
import { activeImportMechanism, ANDROID_IMPORT_MECHANISM } from './importMechanism'
import { getCurrentLocation } from './location'
import { mobileMapFullscreen, mapContentClass } from './mapFullscreen'
import { applyPlatformRootMarkers } from './rootMarkers'
import { resolveChordHint, chordHintText } from './paletteHint'

const win = window as unknown as Record<string, unknown>

/** Source with block and whole-line comments removed (testing.md, v1.0.14). */
function code(rel: string): string {
  const src = readFileSync(resolve(import.meta.dirname, rel), 'utf8')
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !/^\s*\/\//.test(line))
    .join('\n')
}

beforeEach(() => {
  win['__TAURI_INTERNALS__'] = {}
})
afterEach(() => {
  delete win['__TAURI_INTERNALS__']
  invokeMock.mockReset()
  geo.checkPermissions.mockReset()
  geo.requestPermissions.mockReset()
  geo.getCurrentPosition.mockReset()
  vi.unstubAllGlobals()
})

describe('the probe itself reads Android', () => {
  it('isAndroid and isMobileApp are true, isIOS false (the precondition every row rests on)', () => {
    expect(isAndroid()).toBe(true)
    expect(isMobileApp()).toBe(true)
    expect(isIOS()).toBe(false)
  })
})

describe('FR-11, one row per call site, on Android', () => {
  it('platformGates.showUpdaterFooter: false (no-updater)', () => {
    expect(showUpdaterFooter()).toBe(false)
  })

  it('platformGates.supportsAppRelaunch: false (no process plugin on mobile)', () => {
    expect(supportsAppRelaunch()).toBe(false)
  })

  it('platformGates.compactChrome: true (mobile, Designer-confirmed)', () => {
    expect(compactChrome()).toBe(true)
  })

  it('platformGates.showICloudSync: false by construction (Apple-specific)', () => {
    expect(showICloudSync()).toBe(false)
  })

  it('alertsState.alertsSupported: false (Apple-specific)', () => {
    expect(alertsSupported()).toBe(false)
  })

  it('widgetHandover.widgetsSupported: false (Apple-specific)', () => {
    expect(widgetsSupported()).toBe(false)
  })

  it('Settings file-row label: the Import wording, wired through isMobileApp()', () => {
    expect(fileRowButtonLabel(false, false, isMobileApp())).toBe('Import file…')
    expect(fileRowButtonLabel(false, true, isMobileApp())).toBe('Import new…')
    expect(fileRowButtonLabel(true, false, isMobileApp())).toBe('Importing…')
    expect(code('../components/Settings.tsx')).toContain('fileRowButtonLabel(uploading, !!info, isMobileApp())')
  })

  it('Settings pick handler: the measured Android mechanism, through activeImportMechanism()', () => {
    expect(activeImportMechanism()).toBe(ANDROID_IMPORT_MECHANISM)
    expect(ANDROID_IMPORT_MECHANISM).toBe('input')
    const settings = code('../components/Settings.tsx')
    expect(settings).toContain("if (activeImportMechanism() === 'dialog' && onNativePick)")
    expect(settings).not.toMatch(/isIOS\(\)/)
  })

  // ON HOLD (2026-10-03 direction change): the Android location path waits on
  // the F-Droid revision. The interim reading is the honest generic
  // 'unavailable', reached WITHOUT invoking the desktop-only get_location
  // command and without the Play-services-backed geolocation plugin. The
  // permission-denied branch of describeLocationError (FR-18) is therefore
  // unreachable on Android until the revised schema wires a path.
  it('location.getCurrentLocation: rejects unavailable and invokes nothing (interim, on hold)', async () => {
    await expect(getCurrentLocation()).rejects.toEqual({ code: 'unavailable', platform: 'tauri' })
    expect(invokeMock).not.toHaveBeenCalled()
    expect(geo.checkPermissions).not.toHaveBeenCalled()
    expect(geo.requestPermissions).not.toHaveBeenCalled()
    expect(geo.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('MapExplorer fullscreen tier: the mobile reading, through mobileMapFullscreen()', () => {
    expect(mobileMapFullscreen(true)).toBe(true)
    expect(mobileMapFullscreen(false)).toBe(false)
    expect(mobileMapFullscreen(undefined)).toBe(false)
    expect(mapContentClass(mobileMapFullscreen(true))).toBe('sr-map-content sr-map-ios-fullscreen')
  })

  it('main.tsx root marker: sr-android-app, never sr-ios-app', () => {
    const root = document.createElement('html')
    applyPlatformRootMarkers(root)
    expect(root.classList.contains('sr-android-app')).toBe(true)
    expect(root.classList.contains('sr-ios-app')).toBe(false)
    expect(code('../main.tsx')).toContain('applyPlatformRootMarkers(document.documentElement)')
  })

  it('paletteHint.resolveChordHint: none on a touchscreen, Ctrl K with a fine pointer (unchanged module)', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' }))
    expect(resolveChordHint()).toBe('none')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(chordHintText(resolveChordHint())).toBe('Ctrl K')
  })
})
