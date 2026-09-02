// icloud-api-key-sync FR-10, FR-11, FR-13, FR-14, FR-29 (QA-10, QA-12, QA-20,
// QA-24): every row of the schema's reconciliation table, millisecond UTC
// comparison, an untimed local key older than everything, the entry-origin
// tiebreaker converging from both sides, same-value adopt against
// different-value apply, and every marker case. No row deletes a local key
// for a null shared slot (the FR-20 guarantee the validator relies on).

import { describe, it, expect } from 'vitest'
import { reconcileKeySlot, type LocalKeyEntry } from './keyReconcile'
import type { SharedKeyEntry } from './keyRecord'

const ME = 'a'.repeat(32)
const PEER = 'f'.repeat(32)
const LOW = '0'.repeat(32)
const T0 = Date.parse('2026-08-31T01:48:00.000Z')
const T1 = T0 + 1 // one millisecond later
const iso = (ms: number) => new Date(ms).toISOString()

const sharedKey = (value: string, at: number, deviceId = PEER): SharedKeyEntry =>
  ({ state: 'key', value, changedAt: iso(at), origin: { deviceId, label: 'iPhone', platform: 'iphone' } })
const sharedCleared = (at: number, deviceId = PEER): SharedKeyEntry =>
  ({ state: 'cleared', clearedAt: iso(at), origin: { deviceId, label: 'iPhone', platform: 'iphone' } })
const localKey = (value: string, changedAt: number | null, originId: string | null = ME): LocalKeyEntry =>
  ({ state: 'key', value, changedAt, originId })
const localCleared = (clearedAt: number, originId: string | null = ME): LocalKeyEntry =>
  ({ state: 'cleared', clearedAt, originId })

describe('nothing shared', () => {
  it('neither present: none', () => {
    expect(reconcileKeySlot({ local: null, shared: null }).action).toBe('none')
  })
  it('untimed local key: seed (FR-13)', () => {
    expect(reconcileKeySlot({ local: localKey('k', null, null), shared: null }).action).toBe('seed')
  })
  it('timed local key: push', () => {
    expect(reconcileKeySlot({ local: localKey('k', T0), shared: null }).action).toBe('push')
  })
  it('a local cleared marker goes up with its original time (FR-30)', () => {
    expect(reconcileKeySlot({ local: localCleared(T0), shared: null }).action).toBe('push')
  })
})

describe('nothing local', () => {
  it('shared key: apply, not replaced', () => {
    expect(reconcileKeySlot({ local: null, shared: sharedKey('k', T0) })).toMatchObject({ action: 'apply', replaced: false })
  })
  it("shared cleared marker: none (today's empty state; the marker is not copied down)", () => {
    expect(reconcileKeySlot({ local: null, shared: sharedCleared(T0) }).action).toBe('none')
  })
})

describe('an untimed local key is older than any shared entry (FR-13)', () => {
  it('same value: adopt (OQ-3)', () => {
    expect(reconcileKeySlot({ local: localKey('same', null, null), shared: sharedKey('same', T0) }).action).toBe('adopt')
  })
  it('different value: apply, replaced', () => {
    expect(reconcileKeySlot({ local: localKey('old', null, null), shared: sharedKey('new', T0) })).toMatchObject({ action: 'apply', replaced: true })
  })
  it('shared marker: clear-local (FR-29)', () => {
    expect(reconcileKeySlot({ local: localKey('old', null, null), shared: sharedCleared(T0) }).action).toBe('clear-local')
  })
})

describe('timed local key against a shared key (FR-10, millisecond UTC)', () => {
  it('shared one millisecond newer, same value: adopt', () => {
    expect(reconcileKeySlot({ local: localKey('same', T0), shared: sharedKey('same', T1) }).action).toBe('adopt')
  })
  it('shared one millisecond newer, different value: apply, replaced', () => {
    expect(reconcileKeySlot({ local: localKey('old', T0), shared: sharedKey('new', T1) })).toMatchObject({ action: 'apply', replaced: true })
  })
  it('local one millisecond newer: push, same value too (the record says who changed it last)', () => {
    expect(reconcileKeySlot({ local: localKey('new', T1), shared: sharedKey('old', T0) }).action).toBe('push')
    expect(reconcileKeySlot({ local: localKey('same', T1), shared: sharedKey('same', T0) }).action).toBe('push')
  })
  it('equal time, same origin: none (identical)', () => {
    expect(reconcileKeySlot({ local: localKey('k', T0, PEER), shared: sharedKey('k', T0, PEER) }).action).toBe('none')
  })
  it('equal time, local origin unknown: none (reads as identical, as files do)', () => {
    expect(reconcileKeySlot({ local: localKey('k', T0, null), shared: sharedKey('k', T0, PEER) }).action).toBe('none')
  })
})

describe("the FR-11 tiebreaker compares the ENTRIES' origin ids and converges from both sides", () => {
  it('the greater id wins: local greater pushes; local smaller applies (different value) or adopts (same value)', () => {
    expect(reconcileKeySlot({ local: localKey('mine', T0, PEER), shared: sharedKey('theirs', T0, ME) }).action).toBe('push')
    expect(reconcileKeySlot({ local: localKey('mine', T0, ME), shared: sharedKey('theirs', T0, PEER) })).toMatchObject({ action: 'apply', replaced: true })
    expect(reconcileKeySlot({ local: localKey('same', T0, ME), shared: sharedKey('same', T0, PEER) }).action).toBe('adopt')
  })
  it('two devices holding the two entries reach the same winner', () => {
    // Device A holds entry a (origin LOW), device B holds entry b (origin PEER); the record holds the other.
    const onA = reconcileKeySlot({ local: localKey('a', T0, LOW), shared: sharedKey('b', T0, PEER) })
    const onB = reconcileKeySlot({ local: localKey('b', T0, PEER), shared: sharedKey('a', T0, LOW) })
    expect(onA.action).toBe('apply') // A takes b
    expect(onB.action).toBe('push') // B keeps b and pushes it
  })
  it("a local entry that ADOPTED a peer's origin ties against that peer's entry as identical", () => {
    expect(reconcileKeySlot({ local: localKey('k', T0, PEER), shared: sharedKey('k', T0, PEER) }).action).toBe('none')
  })
})

describe('markers (FR-29, FR-14)', () => {
  it('shared marker newer than the local key: clear-local; equal time: clear-local', () => {
    expect(reconcileKeySlot({ local: localKey('k', T0), shared: sharedCleared(T1) }).action).toBe('clear-local')
    expect(reconcileKeySlot({ local: localKey('k', T0), shared: sharedCleared(T0) }).action).toBe('clear-local')
  })
  it('local key newer than the shared marker: push (a set after a Clear survives it, QA-24)', () => {
    expect(reconcileKeySlot({ local: localKey('k', T1), shared: sharedCleared(T0) }).action).toBe('push')
  })
  it('local marker vs shared key: the newer event wins; equal time by origin id', () => {
    expect(reconcileKeySlot({ local: localCleared(T1), shared: sharedKey('k', T0) }).action).toBe('push')
    expect(reconcileKeySlot({ local: localCleared(T0), shared: sharedKey('k', T1) })).toMatchObject({ action: 'apply', replaced: false })
    expect(reconcileKeySlot({ local: localCleared(T0, PEER), shared: sharedKey('k', T0, ME) }).action).toBe('push')
    expect(reconcileKeySlot({ local: localCleared(T0, ME), shared: sharedKey('k', T0, PEER) }).action).toBe('apply')
    expect(reconcileKeySlot({ local: localCleared(T0, null), shared: sharedKey('k', T0, PEER) }).action).toBe('apply')
  })
  it('marker vs marker: local newer pushes, otherwise nothing', () => {
    expect(reconcileKeySlot({ local: localCleared(T1), shared: sharedCleared(T0) }).action).toBe('push')
    expect(reconcileKeySlot({ local: localCleared(T0), shared: sharedCleared(T1) }).action).toBe('none')
    expect(reconcileKeySlot({ local: localCleared(T0), shared: sharedCleared(T0) }).action).toBe('none')
  })
})

describe('the safety property (FR-20)', () => {
  it('no row deletes a local key for a null shared slot: every local shape against null is seed, push or none', () => {
    for (const local of [localKey('k', null, null), localKey('k', T0), localKey('k', T0, null), localCleared(T0), null]) {
      const d = reconcileKeySlot({ local, shared: null })
      expect(['seed', 'push', 'none']).toContain(d.action)
      expect(d.action).not.toBe('clear-local')
      expect(d.action).not.toBe('apply')
    }
  })
  it('every decision names its rule', () => {
    expect(reconcileKeySlot({ local: localKey('k', T0), shared: sharedKey('k', T1) }).rule).toMatch(/FR-/)
  })
})
