// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installExactMatchMedia,
  PHONE_MEDIA_QUERY,
  REDUCED_MOTION_MEDIA_QUERY,
  type ExactMatchMediaStub,
} from './matchMedia'

let stub: ExactMatchMediaStub | null = null

afterEach(() => {
  stub?.restore()
  stub = null
})

describe('installExactMatchMedia', () => {
  it('keeps the phone, tablet, reduced-motion, and unknown queries independent', () => {
    stub = installExactMatchMedia({
      [PHONE_MEDIA_QUERY]: true,
      [REDUCED_MOTION_MEDIA_QUERY]: false,
    })

    expect(window.matchMedia(PHONE_MEDIA_QUERY).matches).toBe(true)
    expect(window.matchMedia('(max-width: 1024px)').matches).toBe(false)
    expect(window.matchMedia('(max-width:1024px)').matches).toBe(false)
    expect(window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches).toBe(false)
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false)

    stub.setMatches(REDUCED_MOTION_MEDIA_QUERY, true)
    expect(window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches).toBe(true)
    expect(window.matchMedia(PHONE_MEDIA_QUERY).matches).toBe(true)
  })

  it('updates and notifies only listeners for the exact query that changed', () => {
    stub = installExactMatchMedia({
      [PHONE_MEDIA_QUERY]: true,
      '(max-width: 1024px)': false,
    })
    const phone = window.matchMedia(PHONE_MEDIA_QUERY)
    const tablet = window.matchMedia('(max-width: 1024px)')
    const phoneListener = vi.fn()
    const tabletListener = vi.fn()
    phone.addEventListener('change', phoneListener)
    tablet.addEventListener('change', tabletListener)

    stub.setMatches(PHONE_MEDIA_QUERY, false)

    expect(phone.matches).toBe(false)
    expect(tablet.matches).toBe(false)
    expect(phoneListener).toHaveBeenCalledOnce()
    expect(phoneListener.mock.calls[0][0]).toMatchObject({
      matches: false,
      media: PHONE_MEDIA_QUERY,
    })
    expect(tabletListener).not.toHaveBeenCalled()
  })
})
