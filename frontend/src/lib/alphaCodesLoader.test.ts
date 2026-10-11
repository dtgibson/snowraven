// The alpha-code loader and store (species-code-search, schema.md section 6;
// QA-31, QA-32, QA-34). Driven through the importer seam, so each row controls
// what the dynamic import does: resolve, reject, hand back a wrong shape, or
// never settle. One row runs the REAL import, which is what proves the seam's
// default is the committed asset.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  _resetAlphaCodesForTests, _setAlphaCodesImporterForTests, getAlphaCodes, loadAlphaCodes, subscribeAlphaCodes,
} from './alphaCodesAsset'

const TABLE = { v: 1, version: '2027', generated: '2026-10-10', codes: { 'american robin': 'AMRO' } }

beforeEach(() => _resetAlphaCodesForTests())
afterEach(() => _resetAlphaCodesForTests())

describe('loadAlphaCodes', () => {
  it('imports once however many surfaces ask (QA-32)', async () => {
    let imports = 0
    _setAlphaCodesImporterForTests(async () => { imports += 1; return { default: TABLE } })
    const all = await Promise.all(Array.from({ length: 50 }, () => loadAlphaCodes()))
    expect(imports).toBe(1)
    expect(all.every(t => t === all[0])).toBe(true)
    await loadAlphaCodes()
    expect(imports).toBe(1)
  })

  it('nothing loads until something asks (no import at module evaluation, FR-24)', () => {
    let imports = 0
    _setAlphaCodesImporterForTests(async () => { imports += 1; return { default: TABLE } })
    expect(getAlphaCodes()).toBeNull()
    expect(imports).toBe(0)
  })

  it('publishes the table and notifies each listener once on arrival', async () => {
    _setAlphaCodesImporterForTests(async () => ({ default: TABLE }))
    let notified = 0
    const unsubscribe = subscribeAlphaCodes(() => { notified += 1 })
    expect(getAlphaCodes()).toBeNull()
    const loaded = await loadAlphaCodes()
    expect(loaded).toBe(TABLE)
    expect(getAlphaCodes()).toBe(TABLE)
    expect(notified).toBe(1)
    await loadAlphaCodes()
    expect(notified).toBe(1)
    unsubscribe()
  })

  it('a never-settling import leaves the store null (QA-31)', async () => {
    _setAlphaCodesImporterForTests(() => new Promise(() => {}))
    void loadAlphaCodes()
    await Promise.resolve()
    await new Promise(r => setTimeout(r, 0))
    expect(getAlphaCodes()).toBeNull()
  })

  it.each([
    ['a rejected import', () => Promise.reject(new Error('chunk failed'))],
    ['a wrong version', async () => ({ default: { ...TABLE, v: 2 } })],
    ['no codes object', async () => ({ default: { v: 1, version: '2027', generated: 'x' } })],
    ['codes as an array', async () => ({ default: { ...TABLE, codes: [] } })],
    ['a non-object module', async () => ({ default: 'nope' })],
  ])('%s resolves null, leaves the store null, and is never retried (QA-34)', async (_label, importer) => {
    let imports = 0
    _setAlphaCodesImporterForTests(() => { imports += 1; return importer() as Promise<{ default: unknown }> })
    let notified = 0
    subscribeAlphaCodes(() => { notified += 1 })
    expect(await loadAlphaCodes()).toBeNull()
    expect(getAlphaCodes()).toBeNull()
    expect(await loadAlphaCodes()).toBeNull()
    expect(imports).toBe(1)
    expect(notified).toBe(0)
  })

  it('the real import loads the committed asset', async () => {
    const table = await loadAlphaCodes()
    expect(table?.v).toBe(1)
    expect(table?.codes['yellow-rumped warbler']).toBe('YRWA')
  })
})
