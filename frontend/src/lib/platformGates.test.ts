// Platform-visibility gates (mobile-app FR-14), isIOS mocked both ways — the
// components (UpdateFooter, Settings) consume these predicates.
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./platform', () => {
  // isMobileApp is derived from the two mocked OS probes, so a row that sets
  // isIOS (or isAndroid) true sees the mobile gates follow, as in the app.
  const isIOS = vi.fn()
  const isAndroid = vi.fn(() => false)
  return {
    isIOS,
    isTauri: vi.fn(),
    isWindows: vi.fn(),
    isMacOS: vi.fn(),
    isAndroid,
    isMobileApp: vi.fn(() => isIOS() || isAndroid()),
  }
})

import { isIOS, isTauri, isMacOS, isAndroid } from './platform'
import {
  showUpdaterFooter,
  compactChrome,
  supportsAppRelaunch,
  showICloudSync,
  showLocationControls,
  allowInlineMediaFrame,
} from './platformGates'

afterEach(() => {
  vi.mocked(isIOS).mockReset()
  vi.mocked(isTauri).mockReset()
  vi.mocked(isMacOS).mockReset()
  vi.mocked(isAndroid).mockReset()
  vi.mocked(isAndroid).mockReturnValue(false)
})

// icloud-sync FR-01/FR-02 (QA-01): the ONE predicate that decides whether any
// iCloud markup exists and whether the controller boots. Every platform the
// app ships on, both ways.
describe('showICloudSync (icloud-sync FR-01/FR-02)', () => {
  const cases: Array<[string, boolean, boolean, boolean, boolean]> = [
    // label, isTauri, isIOS, isMacOS, expected
    ['macOS desktop app', true, false, true, true],
    ['iPhone / iPad app', true, true, false, true],
    ['Windows desktop app', true, false, false, false],
    ['web / Pi (browser)', false, false, false, false],
    ['browser on a Mac (isTauri false, os probes irrelevant)', false, false, true, false],
    ['browser on an iPhone (isTauri false)', false, true, false, false],
  ]
  it.each(cases)('%s', (_label, tauri, ios, mac, expected) => {
    vi.mocked(isTauri).mockReturnValue(tauri)
    vi.mocked(isIOS).mockReturnValue(ios)
    vi.mocked(isMacOS).mockReturnValue(mac)
    expect(showICloudSync()).toBe(expected)
  })

  it('is false by construction when nothing is mocked true (the default install)', () => {
    vi.mocked(isTauri).mockReturnValue(false)
    expect(showICloudSync()).toBe(false)
  })
})

describe('showUpdaterFooter (FR-14)', () => {
  it('is false on iOS — no update affordance at all', () => {
    vi.mocked(isIOS).mockReturnValue(true)
    expect(showUpdaterFooter()).toBe(false)
  })

  it('is true everywhere else (desktop and web keep their affordances)', () => {
    vi.mocked(isIOS).mockReturnValue(false)
    expect(showUpdaterFooter()).toBe(true)
  })
})

describe('compactChrome (preview-driven iOS composition fix)', () => {
  it('is true on iOS — slim single-line header + above-the-fold map panel', () => {
    vi.mocked(isIOS).mockReturnValue(true)
    expect(compactChrome()).toBe(true)
  })

  it('is false on desktop and web — full brand header, shipped panel sizing', () => {
    vi.mocked(isIOS).mockReturnValue(false)
    expect(compactChrome()).toBe(false)
  })
})

describe('supportsAppRelaunch (QA round-1 — RebuildCaches gating)', () => {
  it('is false on iOS — no process plugin in the binary, no programmatic relaunch', () => {
    vi.mocked(isIOS).mockReturnValue(true)
    expect(supportsAppRelaunch()).toBe(false)
  })

  it('is true on desktop — Rebuild caches keeps its restart step', () => {
    vi.mocked(isIOS).mockReturnValue(false)
    expect(supportsAppRelaunch()).toBe(true)
  })
})

// android-release FR-11 / QA-11: the Android world is isTauri true, isIOS
// false, isAndroid true (the mock derives isMobileApp from the two probes, as
// platform.ts does). Each row goes red if its gate is reverted to the isIOS()
// form, because isIOS() is false here.
describe('Android readings of the four gates (android-release FR-11)', () => {
  function android() {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isIOS).mockReturnValue(false)
    vi.mocked(isMacOS).mockReturnValue(false)
    vi.mocked(isAndroid).mockReturnValue(true)
  }

  it('showUpdaterFooter is false: no update control and no GitHub request (FR-12)', () => {
    android()
    expect(showUpdaterFooter()).toBe(false)
  })

  it('supportsAppRelaunch is false: Rebuild caches skips the relaunch (FR-13)', () => {
    android()
    expect(supportsAppRelaunch()).toBe(false)
  })

  it('compactChrome is true: the slim header and the above-the-fold map panel (FR-14)', () => {
    android()
    expect(compactChrome()).toBe(true)
  })

  it('showICloudSync stays false: iCloud is Apple-specific (FR-15)', () => {
    android()
    expect(showICloudSync()).toBe(false)
  })
})

// android-release FR-56: showLocationControls() is false only for Android under
// location branch B (the shipped constant; location.android.test.ts mocks the
// switch both ways against the real platform module).
describe('showLocationControls (FR-56)', () => {
  it('is false on Android under branch B', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isAndroid).mockReturnValue(true)
    expect(showLocationControls()).toBe(false)
  })

  it('is true on iOS, desktop and web', () => {
    vi.mocked(isIOS).mockReturnValue(true)
    expect(showLocationControls()).toBe(true)
    vi.mocked(isIOS).mockReturnValue(false)
    expect(showLocationControls()).toBe(true)
  })
})

// android-release security M1: on Android wry hands every iframe the Tauri IPC
// bridge and attributes its calls to the main frame, so the one third-party
// frame (the Macaulay Library embed) is never mounted there. Every other
// target keeps the player: iOS and macOS attribute IPC by frame, web/Pi has
// no IPC. The gate is consumed by lib/mlEmbedGate.ts, not by a component.
describe('allowInlineMediaFrame (security M1)', () => {
  it('is false on Android', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isAndroid).mockReturnValue(true)
    expect(allowInlineMediaFrame()).toBe(false)
  })

  it('is true on iOS, macOS, Windows desktop and web', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isIOS).mockReturnValue(true)
    expect(allowInlineMediaFrame()).toBe(true)
    vi.mocked(isIOS).mockReturnValue(false)
    vi.mocked(isMacOS).mockReturnValue(true)
    expect(allowInlineMediaFrame()).toBe(true)
    vi.mocked(isMacOS).mockReturnValue(false)
    expect(allowInlineMediaFrame()).toBe(true)
    vi.mocked(isTauri).mockReturnValue(false)
    expect(allowInlineMediaFrame()).toBe(true)
  })
})
