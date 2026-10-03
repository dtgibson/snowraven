// The Mechanism A/B switch is one measured constant PER mobile platform
// (android-release FR-26 / schema 5.4), never one shared literal: each
// platform's reading is resolved here and a flip of one cannot move the other.
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./platform', () => ({ isIOS: vi.fn(() => false), isAndroid: vi.fn(() => false) }))

import { isIOS, isAndroid } from './platform'
import { activeImportMechanism, ANDROID_IMPORT_MECHANISM, IOS_IMPORT_MECHANISM } from './importMechanism'

afterEach(() => {
  vi.mocked(isIOS).mockReturnValue(false)
  vi.mocked(isAndroid).mockReturnValue(false)
})

describe('activeImportMechanism', () => {
  it('iOS resolves to the iOS constant', () => {
    vi.mocked(isIOS).mockReturnValue(true)
    expect(activeImportMechanism()).toBe(IOS_IMPORT_MECHANISM)
  })

  it('Android resolves to the Android constant', () => {
    vi.mocked(isAndroid).mockReturnValue(true)
    expect(activeImportMechanism()).toBe(ANDROID_IMPORT_MECHANISM)
  })

  it('desktop, web and Pi always use the file input', () => {
    expect(activeImportMechanism()).toBe('input')
  })

  it('both shipped constants are the measured file input (Mechanism A)', () => {
    // iOS: mobile-app V2 in the simulator. Android: the API 36 emulator run
    // recorded in pipeline/android-release/decisions.md (OQ-12).
    expect(IOS_IMPORT_MECHANISM).toBe('input')
    expect(ANDROID_IMPORT_MECHANISM).toBe('input')
  })
})
