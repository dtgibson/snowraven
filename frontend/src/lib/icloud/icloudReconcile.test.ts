// icloud-sync FR-14 to FR-18, FR-21, FR-31 (QA-20, QA-29): every row of the
// reconcile table, millisecond UTC comparison, the origin-id tiebreaker in
// both directions, and the FR-31 cleared-marker cases. Also the FR-37
// structural guarantee: no input with a null shared record yields
// 'delete-local'.

import { describe, it, expect } from 'vitest'
import { reconcileSlot, compareOriginIds, type ReconcileInput } from './icloudReconcile'
import type { SharedRecord } from './icloudRecord'

const ME = 'a'.repeat(32)
const PEER = 'f'.repeat(32) // sorts AFTER ME in code-unit order
const LOWER = '0'.repeat(32) // sorts BEFORE ME

const T0 = Date.parse('2026-08-24T22:12:00.000Z')

function fileRec(uploadedAt: string, deviceId = PEER): SharedRecord {
  return {
    version: 1,
    slot: 'ebird',
    state: 'file',
    filename: 'MyEBirdData.csv',
    uploadedAt,
    origin: { deviceId, label: 'iPhone', platform: 'iphone' },
    byteLength: 1000,
    sha256: 'b'.repeat(64),
  }
}

function clearedRec(clearedAt: string, deviceId = PEER): SharedRecord {
  return {
    version: 1,
    slot: 'ebird',
    state: 'cleared',
    clearedAt,
    origin: { deviceId, label: 'iPhone', platform: 'iphone' },
  }
}

const downloaded = { downloaded: true, downloading: false }
const notDownloaded = { downloaded: false, downloading: false }

function decide(partial: Partial<ReconcileInput>) {
  return reconcileSlot({ local: null, shared: null, file: downloaded, deviceId: ME, ...partial })
}

describe('reconcileSlot: the table', () => {
  it('FR-18 neither present: none', () => {
    expect(decide({}).action).toBe('none')
  })

  it('FR-14 local only: push', () => {
    expect(decide({ local: { uploadedAt: T0, originId: null } }).action).toBe('push')
    expect(decide({ local: { uploadedAt: T0, originId: ME } }).action).toBe('push')
  })

  it('FR-15 shared only: pull when downloaded, download when not', () => {
    const shared = fileRec(new Date(T0).toISOString())
    expect(decide({ shared, file: downloaded }).action).toBe('pull')
    expect(decide({ shared, file: notDownloaded }).action).toBe('download')
  })

  it('FR-31 cleared marker with nothing local: none (nothing to delete, nothing to push)', () => {
    expect(decide({ shared: clearedRec(new Date(T0).toISOString()) }).action).toBe('none')
  })

  it('FR-31 local newer than the cleared marker: push (latest event wins, QA-29)', () => {
    const d = decide({
      local: { uploadedAt: T0 + 1, originId: ME },
      shared: clearedRec(new Date(T0).toISOString()),
    })
    expect(d.action).toBe('push')
  })

  it('FR-31 cleared marker newer than (or equal to) local: delete-local', () => {
    expect(decide({ local: { uploadedAt: T0 - 1, originId: ME }, shared: clearedRec(new Date(T0).toISOString()) }).action).toBe('delete-local')
    expect(decide({ local: { uploadedAt: T0, originId: ME }, shared: clearedRec(new Date(T0).toISOString()) }).action).toBe('delete-local')
  })

  it('FR-16 shared newer: pull or download, whole file', () => {
    const shared = fileRec(new Date(T0 + 1).toISOString())
    expect(decide({ local: { uploadedAt: T0, originId: ME }, shared, file: downloaded }).action).toBe('pull')
    expect(decide({ local: { uploadedAt: T0, originId: ME }, shared, file: notDownloaded }).action).toBe('download')
  })

  it('FR-16 local newer: push', () => {
    expect(decide({ local: { uploadedAt: T0 + 1, originId: ME }, shared: fileRec(new Date(T0).toISOString()) }).action).toBe('push')
  })

  it('FR-17 identical: equal time and same origin id -> none', () => {
    expect(decide({ local: { uploadedAt: T0, originId: PEER }, shared: fileRec(new Date(T0).toISOString(), PEER) }).action).toBe('none')
  })

  it('FR-17 identical: equal time and a pre-1.0.11 local entry with no origin -> none', () => {
    expect(decide({ local: { uploadedAt: T0, originId: null }, shared: fileRec(new Date(T0).toISOString(), PEER) }).action).toBe('none')
  })
})

describe('reconcileSlot: millisecond UTC comparison (FR-21)', () => {
  it('one millisecond decides it, in both directions', () => {
    const at = new Date(T0).toISOString()
    expect(decide({ local: { uploadedAt: T0 + 1, originId: ME }, shared: fileRec(at) }).action).toBe('push')
    expect(decide({ local: { uploadedAt: T0 - 1, originId: ME }, shared: fileRec(at) }).action).toBe('pull')
  })

  it('compares instants, not strings: an offset-form time equal to the Z form is equal', () => {
    // 22:12:00Z written as 15:12:00-07:00 is the same instant.
    const shared = fileRec('2026-08-24T15:12:00.000-07:00', PEER)
    expect(decide({ local: { uploadedAt: T0, originId: PEER }, shared }).action).toBe('none')
  })
})

describe('reconcileSlot: the origin-id tiebreaker (FR-21 + OQ-3, FR-22)', () => {
  const at = new Date(T0).toISOString()

  it('equal time, different origins: the higher origin id (code-unit order) wins', () => {
    // ME ('aaa...') < PEER ('fff...'): the peer wins, so this device pulls.
    expect(decide({ local: { uploadedAt: T0, originId: ME }, shared: fileRec(at, PEER), file: downloaded }).action).toBe('pull')
    expect(decide({ local: { uploadedAt: T0, originId: ME }, shared: fileRec(at, PEER), file: notDownloaded }).action).toBe('download')
    // ME > LOWER ('000...'): this device wins and pushes.
    expect(decide({ local: { uploadedAt: T0, originId: ME }, shared: fileRec(at, LOWER) }).action).toBe('push')
  })

  it('is deterministic from both sides: the two devices never both push or both pull', () => {
    // Device A (ME) sees B's record; device B (PEER) sees A's record.
    const aSeesB = reconcileSlot({ local: { uploadedAt: T0, originId: ME }, shared: fileRec(at, PEER), file: downloaded, deviceId: ME })
    const bSeesA = reconcileSlot({ local: { uploadedAt: T0, originId: PEER }, shared: fileRec(at, ME), file: downloaded, deviceId: PEER })
    expect([aSeesB.action, bSeesA.action].sort()).toEqual(['pull', 'push'])
  })

  it('compareOriginIds is plain code-unit order', () => {
    expect(compareOriginIds('a', 'b')).toBe(-1)
    expect(compareOriginIds('b', 'a')).toBe(1)
    expect(compareOriginIds('a', 'a')).toBe(0)
    expect(compareOriginIds(ME, PEER)).toBeLessThan(0)
  })
})

describe('reconcileSlot: the FR-37 guarantee', () => {
  it('a null shared record can never produce delete-local, whatever the local entry', () => {
    const locals = [null, { uploadedAt: T0, originId: null }, { uploadedAt: T0, originId: ME }, { uploadedAt: 0, originId: PEER }]
    for (const local of locals) {
      for (const file of [downloaded, notDownloaded]) {
        expect(decide({ local, shared: null, file }).action).not.toBe('delete-local')
      }
    }
  })

  it('every decision names its table row', () => {
    expect(decide({}).rule).toMatch(/FR-18/)
    expect(decide({ local: { uploadedAt: T0, originId: ME } }).rule).toMatch(/FR-14/)
  })
})
