/// <reference types="node" />
// The bar-chart import tail (targets-tab, schema.md section 2.4; FR-26, FR-27,
// FR-29, FR-37; QA-28, QA-29, QA-31). The order is the contract: filename
// refusal before the bytes are read, content refusal before anything is
// written, one write, then exactly one epoch bump. Every refusal row asserts
// the storage seam was never asked to write AND the epoch never moved, not only
// that a message came back.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const H = vi.hoisted(() => ({
  writeBarChartFile: vi.fn(),
  deleteBarChartFile: vi.fn(),
  deleteAllBarChartFiles: vi.fn(),
  notify: vi.fn(),
  barChartSaved: vi.fn(),
}))
vi.mock('../storage', () => ({
  storage: { writeBarChartFile: H.writeBarChartFile, deleteBarChartFile: H.deleteBarChartFile, deleteAllBarChartFiles: H.deleteAllBarChartFiles },
}))
vi.mock('../barChartFilesChanged', () => ({ notifyBarChartFilesChanged: H.notify }))
vi.mock('../icloud/icloudState', () => ({ icloudActions: { barChartSaved: H.barChartSaved } }))

import { importBarChartFile, removeBarChartFile, clearAllBarChartFiles, BARCHART_SAVE_FAILED_MESSAGE, BARCHART_READ_FAILED_MESSAGE } from './barChartImport'
import {
  BARCHART_EXTENSION_MESSAGE, BARCHART_LAYOUT_MESSAGE, BARCHART_UNREADABLE_CODE_MESSAGE,
  TOO_LARGE_MESSAGE, MAX_UPLOAD_BYTES, barChartRegionMismatchMessage,
} from '../uploadGuard'

const SAMPLE = readFileSync(new URL('./barchart-sample.fixture.txt', import.meta.url), 'utf8')
const ALAMEDA = 'US-CA-001'
const LABEL = 'Alameda, CA'
const NAME = 'ebird_US-CA-001__1900_2026_1_12_barchart.txt'

beforeEach(() => {
  H.writeBarChartFile.mockReset().mockResolvedValue(undefined)
  H.deleteBarChartFile.mockReset().mockResolvedValue(undefined)
  H.deleteAllBarChartFiles.mockReset()
  H.notify.mockReset()
  H.barChartSaved.mockReset()
})

function expectNoSideEffects() {
  expect(H.writeBarChartFile).not.toHaveBeenCalled()
  expect(H.notify).not.toHaveBeenCalled()
}

describe('a successful import (QA-28)', () => {
  it('writes once and bumps the bar-chart epoch once', async () => {
    const res = await importBarChartFile(ALAMEDA, LABEL, NAME, async () => SAMPLE)
    expect(res).toEqual({ ok: true })
    expect(H.writeBarChartFile).toHaveBeenCalledTimes(1)
    expect(H.writeBarChartFile).toHaveBeenCalledWith(ALAMEDA, SAMPLE, NAME)
    expect(H.notify).toHaveBeenCalledTimes(1)
    // The bump follows the write.
    expect(H.notify.mock.invocationCallOrder[0]).toBeGreaterThan(H.writeBarChartFile.mock.invocationCallOrder[0])
  })

  it('a name with no region code is attributed to the county it was added on (FR-29)', async () => {
    expect(await importBarChartFile('US-CA-013', 'Contra Costa, CA', 'barchart.txt', async () => SAMPLE)).toEqual({ ok: true })
    expect(H.writeBarChartFile).toHaveBeenCalledWith('US-CA-013', SAMPLE, 'barchart.txt')
  })
})

describe('refusals store nothing and bump nothing (FR-27, QA-29)', () => {
  it('a wrong extension is refused BEFORE the bytes are read', async () => {
    const getContent = vi.fn(async () => SAMPLE)
    for (const name of ['MyEBirdData.csv', 'barchart.zip', 'barchart.txt.gz']) {
      expect(await importBarChartFile(ALAMEDA, LABEL, name, getContent)).toEqual({ ok: false, reason: BARCHART_EXTENSION_MESSAGE })
    }
    expect(getContent).not.toHaveBeenCalled()
    expectNoSideEffects()
  })

  it('another county\'s file is refused, naming both (QA-31)', async () => {
    const res = await importBarChartFile('US-CA-013', 'Contra Costa, CA', NAME, async () => SAMPLE)
    expect(res).toEqual({ ok: false, reason: barChartRegionMismatchMessage('US-CA-001', 'Contra Costa, CA') })
    expect(res.ok === false && res.reason).toContain('US-CA-001')
    expect(res.ok === false && res.reason).toContain('Contra Costa, CA')
    expectNoSideEffects()
  })

  it('an unreadable eBird-shaped name is refused without echoing it', async () => {
    const res = await importBarChartFile(ALAMEDA, LABEL, 'ebird_CA-ON__1900_2026_1_12_barchart.txt', async () => SAMPLE)
    expect(res).toEqual({ ok: false, reason: BARCHART_UNREADABLE_CODE_MESSAGE })
    expectNoSideEffects()
  })

  it('a file that is not a bar chart (an eBird CSV renamed .txt) is refused with FR-28\'s words', async () => {
    const csv = 'Submission ID,Common Name,Scientific Name\nS1,American Robin,Turdus migratorius\n'
    expect(await importBarChartFile(ALAMEDA, LABEL, 'MyEBirdData.txt', async () => csv)).toEqual({ ok: false, reason: BARCHART_LAYOUT_MESSAGE })
    expectNoSideEffects()
  })

  it('an over-cap file is refused as too large', async () => {
    const big = SAMPLE + 'x'.repeat(MAX_UPLOAD_BYTES)
    expect(await importBarChartFile(ALAMEDA, LABEL, NAME, async () => big)).toEqual({ ok: false, reason: TOO_LARGE_MESSAGE })
    expectNoSideEffects()
  })

  it('a read that fails is a refusal too, with nothing written', async () => {
    expect(await importBarChartFile(ALAMEDA, LABEL, NAME, async () => { throw new Error('revoked') }))
      .toEqual({ ok: false, reason: BARCHART_READ_FAILED_MESSAGE })
    expectNoSideEffects()
  })
})

describe('a failed write', () => {
  it('reports the failure and bumps nothing', async () => {
    H.writeBarChartFile.mockRejectedValue(new Error('File save failed (413)'))
    expect(await importBarChartFile(ALAMEDA, LABEL, NAME, async () => SAMPLE)).toEqual({ ok: false, reason: BARCHART_SAVE_FAILED_MESSAGE })
    expect(H.notify).not.toHaveBeenCalled()
  })
})

describe('remove (FR-37)', () => {
  it('deletes then bumps once', async () => {
    await removeBarChartFile(ALAMEDA)
    expect(H.deleteBarChartFile).toHaveBeenCalledWith(ALAMEDA)
    expect(H.notify).toHaveBeenCalledTimes(1)
  })

  it('a failed delete rethrows and bumps nothing', async () => {
    H.deleteBarChartFile.mockRejectedValue(new Error('File delete failed (500)'))
    await expect(removeBarChartFile(ALAMEDA)).rejects.toThrow('File delete failed')
    expect(H.notify).not.toHaveBeenCalled()
  })
})

describe('icloud-bar-chart-sync: the origin, the line, and the bulk removal (FR-07, FR-21, FR-22)', () => {
  const ORIGIN = { deviceId: 'a'.repeat(32), label: "Dave's Mac", platform: 'mac' as const }

  it('an add with an origin passes it to the seam, sets the line BEFORE the bump, and bumps once', async () => {
    expect(await importBarChartFile(ALAMEDA, LABEL, NAME, async () => SAMPLE, ORIGIN)).toEqual({ ok: true })
    expect(H.writeBarChartFile).toHaveBeenCalledWith(ALAMEDA, SAMPLE, NAME, ORIGIN)
    expect(H.barChartSaved).toHaveBeenCalledWith(ALAMEDA)
    expect(H.notify).toHaveBeenCalledTimes(1)
    expect(H.barChartSaved.mock.invocationCallOrder[0]).toBeLessThan(H.notify.mock.invocationCallOrder[0])
    expect(H.barChartSaved.mock.invocationCallOrder[0]).toBeGreaterThan(H.writeBarChartFile.mock.invocationCallOrder[0])
  })

  it('an add without an origin (sync off, every non-Apple platform) sets no line and keeps the three-argument write', async () => {
    await importBarChartFile(ALAMEDA, LABEL, NAME, async () => SAMPLE)
    expect(H.writeBarChartFile.mock.calls[0]).toHaveLength(3)
    expect(H.barChartSaved).not.toHaveBeenCalled()
  })

  it('a refusal or a failed write with an origin sets no line', async () => {
    await importBarChartFile(ALAMEDA, LABEL, 'notes.csv', async () => SAMPLE, ORIGIN)
    H.writeBarChartFile.mockRejectedValue(new Error('File save failed (413)'))
    await importBarChartFile(ALAMEDA, LABEL, NAME, async () => SAMPLE, ORIGIN)
    expect(H.barChartSaved).not.toHaveBeenCalled()
    expect(H.notify).not.toHaveBeenCalled()
  })

  it('clearAllBarChartFiles: one seam call, one bump when anything went, and the result passes through', async () => {
    H.deleteAllBarChartFiles.mockResolvedValue({ removed: ['US-CA-001', 'US-NY-005'], failed: ['US-CA-013'] })
    expect(await clearAllBarChartFiles()).toEqual({ removed: ['US-CA-001', 'US-NY-005'], failed: ['US-CA-013'] })
    expect(H.deleteAllBarChartFiles).toHaveBeenCalledTimes(1)
    expect(H.notify).toHaveBeenCalledTimes(1)
  })

  it('clearAllBarChartFiles: nothing removed bumps nothing; a rejected seam rethrows and bumps nothing', async () => {
    H.deleteAllBarChartFiles.mockResolvedValue({ removed: [], failed: ['US-CA-013'] })
    await clearAllBarChartFiles()
    expect(H.notify).not.toHaveBeenCalled()
    H.deleteAllBarChartFiles.mockRejectedValue(new Error('File delete failed (500)'))
    await expect(clearAllBarChartFiles()).rejects.toThrow('File delete failed')
    expect(H.notify).not.toHaveBeenCalled()
  })
})

describe('the refusal copy', () => {
  it('carries no em dash', () => {
    for (const s of [BARCHART_SAVE_FAILED_MESSAGE, BARCHART_READ_FAILED_MESSAGE]) expect(s).not.toContain('\u2014')
  })
})
