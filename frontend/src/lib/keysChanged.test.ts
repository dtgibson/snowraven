// @vitest-environment jsdom
// icloud-api-key-sync FR-23/FR-24: the API-key epoch (lib/keysChanged.ts) and
// its React seam (lib/useKeysEpoch.ts). The epoch increments, subscribers
// fire once per notification, an unsubscribed callback stays quiet, and a
// component reading the hook re-renders on notify. A key epoch is
// independent of the file epoch.

import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { getKeysEpoch, notifyKeysChanged, subscribeKeysChanged } from './keysChanged'
import { useKeysEpoch } from './useKeysEpoch'
import { getFilesEpoch, notifyFilesChanged } from './filesChanged'

describe('keysChanged epoch', () => {
  it('increments on notify and fires every subscriber once', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unA = subscribeKeysChanged(a)
    const unB = subscribeKeysChanged(b)
    const before = getKeysEpoch()
    notifyKeysChanged()
    expect(getKeysEpoch()).toBe(before + 1)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unA()
    notifyKeysChanged()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
    unB()
  })

  it('useKeysEpoch re-renders with the new epoch', () => {
    const { result } = renderHook(() => useKeysEpoch())
    const first = result.current
    act(() => { notifyKeysChanged() })
    expect(result.current).toBe(first + 1)
    act(() => { notifyKeysChanged() })
    expect(result.current).toBe(first + 2)
  })

  it('a key epoch never moves the file epoch and a file epoch never moves the key epoch', () => {
    const files = getFilesEpoch()
    const keys = getKeysEpoch()
    notifyKeysChanged()
    expect(getFilesEpoch()).toBe(files)
    notifyFilesChanged()
    expect(getKeysEpoch()).toBe(keys + 1)
  })
})
