// Platform-visibility gates (mobile-app FR-14), isIOS mocked both ways — the
// components (UpdateFooter, Settings) consume these predicates.
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./platform', () => ({ isIOS: vi.fn(), isTauri: vi.fn(), isWindows: vi.fn(), isMacOS: vi.fn() }))

import { isIOS, isTauri, isMacOS } from './platform'
import {
  showUpdaterFooter,
  compactChrome,
  supportsAppRelaunch,
  showICloudSync,
} from './platformGates'

afterEach(() => {
  vi.mocked(isIOS).mockReset()
  vi.mocked(isTauri).mockReset()
  vi.mocked(isMacOS).mockReset()
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
