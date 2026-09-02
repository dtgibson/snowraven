// @vitest-environment jsdom
// icloud-sync FR-35: the data-file epoch (lib/filesChanged.ts) and its React
// seam (lib/useFilesEpoch.ts). The epoch increments, subscribers fire once
// per notification, an unsubscribed callback stays quiet, and a component
// reading the hook re-renders on notify.

import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { getFilesEpoch, notifyFilesChanged, subscribeFilesChanged } from './filesChanged'
import { useFilesEpoch } from './useFilesEpoch'

describe('filesChanged epoch', () => {
  it('increments on notify and fires every subscriber once', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unA = subscribeFilesChanged(a)
    const unB = subscribeFilesChanged(b)
    const before = getFilesEpoch()
    notifyFilesChanged()
    expect(getFilesEpoch()).toBe(before + 1)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unA()
    notifyFilesChanged()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
    unB()
  })

  it('useFilesEpoch re-renders with the new epoch', () => {
    const { result } = renderHook(() => useFilesEpoch())
    const first = result.current
    act(() => { notifyFilesChanged() })
    expect(result.current).toBe(first + 1)
    act(() => { notifyFilesChanged() })
    expect(result.current).toBe(first + 2)
  })
})
