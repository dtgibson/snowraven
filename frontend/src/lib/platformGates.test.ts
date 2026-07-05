// Platform-visibility gates (mobile-app FR-14 / FR-15 / FR-23), isIOS mocked
// both ways — the components (UpdateFooter, Settings) consume these predicates.
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./platform', () => ({ isIOS: vi.fn(), isTauri: vi.fn(), isWindows: vi.fn() }))

import { isIOS } from './platform'
import {
  showUpdaterFooter,
  showOfflineMapsSection,
  compactChrome,
  supportsAppRelaunch,
} from './platformGates'

afterEach(() => {
  vi.mocked(isIOS).mockReset()
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

describe('showOfflineMapsSection (FR-15 / FR-23)', () => {
  it('is false on iOS — the Tier B region manager is a true absence', () => {
    vi.mocked(isIOS).mockReturnValue(true)
    expect(showOfflineMapsSection()).toBe(false)
  })

  it('is true on desktop AND web — web keeps its disabled-toggle presentation (byte-parity)', () => {
    vi.mocked(isIOS).mockReturnValue(false)
    expect(showOfflineMapsSection()).toBe(true)
  })
})
