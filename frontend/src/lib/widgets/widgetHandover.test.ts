// The widget hand-over document (ios-lifer-widgets FR-30, FR-32; QA-15, QA-30,
// QA-32). Content, folding, sorting, the bounds this side enforces (each row
// goes red if the builder's own enforcement is deleted), and the platform gate.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const platform = vi.hoisted(() => ({ tauri: false, ios: false }))
vi.mock('../platform', () => ({ isTauri: () => platform.tauri, isIOS: () => platform.ios }))

import {
  buildHandover, buildRevocation, foldSpeciesName, handoverByteLength, HANDOVER_MAX_BYTES, isValidHandoverName, MAX_NAME_UNITS,
  MAX_SET_ENTRIES, serializeHandover, widgetsSupported, type HandoverInputs,
} from './widgetHandover'
import { normalizeSpeciesName } from '../speciesUtils'

const NOW = Date.UTC(2026, 8, 23, 18, 4, 11, 500)
const base = (over: Partial<HandoverInputs> = {}): HandoverInputs => ({
  nowMs: NOW,
  appVersion: '1.0.36',
  ebirdKey: 'abc123DEF456',
  observations: [
    { commonName: 'Mallard' }, { commonName: 'Mallard (Domestic type)' }, { commonName: 'Oak Titmouse' },
    { commonName: 'Oak Titmouse' }, { commonName: 'NORTHERN SHRIKE' }, { commonName: 'Wrentit' },
  ],
  mlRows: [
    { commonName: 'Mallard', format: 'Photo' }, { commonName: 'Mallard', format: 'Audio' }, { commonName: 'Mallard', format: 'Video' },
    { commonName: 'Oak Titmouse', format: 'Photo' },
  ],
  mapDefaults: { lat: 37.3, lng: -121.9, dist: 5 },
  ...over,
})

beforeEach(() => { platform.tauri = false; platform.ios = false })

describe('the document carries exactly the FR-30 fields (QA-30)', () => {
  it('the key set at every depth is exactly the ten fields plus lat/lng', () => {
    const doc = buildHandover(base())!
    const keys = new Set<string>()
    const walk = (v: unknown) => {
      if (Array.isArray(v)) { v.forEach(walk); return }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x) }
    }
    walk(JSON.parse(serializeHandover(doc)))
    expect([...keys].sort()).toEqual([
      'appVersion', 'defaultLocation', 'ebirdKey', 'hasEbirdBackup', 'hasMlExport', 'lat', 'lng', 'recorded',
      'targetsMissingAudio', 'targetsMissingPhoto', 'targetsMissingVideo', 'version', 'writtenAt',
    ])
    // No observation row, checklist id, ML asset id or OpenWeather key can
    // appear: nothing that looks like one is anywhere in the text.
    expect(serializeHandover(doc)).not.toMatch(/\bS[0-9]{5,}|L[0-9]{4,}|catalogId|openweather|submission/i)
  })

  it('writtenAt is ISO UTC to the second; version is 1', () => {
    const doc = buildHandover(base())!
    expect(doc.version).toBe(1)
    expect(doc.writtenAt).toBe('2026-09-23T18:04:11Z')
  })

  it('recorded = every row folded, distinct, sorted by code unit; no countability or form filter', () => {
    const doc = buildHandover(base())!
    expect(doc.recorded).toEqual(['mallard', 'northern shrike', 'oak titmouse', 'wrentit'])
    for (const n of doc.recorded) expect(n).toBe(normalizeSpeciesName(n).toLowerCase())
  })

  it('the three target sets are the in-app Media Targets definition split per type', () => {
    const doc = buildHandover(base())!
    // Mallard holds all three under its raw name; "Mallard (Domestic type)" holds
    // none under ITS raw name, so its folded name "mallard" lacks all three.
    expect(doc.targetsMissingPhoto).toEqual(['mallard', 'northern shrike', 'wrentit'])
    expect(doc.targetsMissingAudio).toEqual(['mallard', 'northern shrike', 'oak titmouse', 'wrentit'])
    expect(doc.targetsMissingVideo).toEqual(['mallard', 'northern shrike', 'oak titmouse', 'wrentit'])
    // Every target set is a subset of recorded, by construction.
    for (const set of [doc.targetsMissingPhoto, doc.targetsMissingAudio, doc.targetsMissingVideo]) {
      for (const n of set) expect(doc.recorded).toContain(n)
    }
  })

  it('a species holding all three types is in no target set', () => {
    const doc = buildHandover(base({ observations: [{ commonName: 'Mallard' }] }))!
    expect([doc.targetsMissingPhoto, doc.targetsMissingAudio, doc.targetsMissingVideo]).toEqual([[], [], []])
    expect(doc.hasMlExport).toBe(true)
  })
})

describe('the clear shapes (FR-31)', () => {
  it('no backup: hasEbirdBackup false and recorded [] (S3); the target sets are [] too', () => {
    const doc = buildHandover(base({ observations: null }))!
    expect(doc.hasEbirdBackup).toBe(false)
    expect(doc.recorded).toEqual([])
    expect([doc.targetsMissingPhoto, doc.targetsMissingAudio, doc.targetsMissingVideo]).toEqual([[], [], []])
  })

  it('no export, or an EMPTY export (the in-app hasML rule): hasMlExport false and every set [] (S4)', () => {
    for (const mlRows of [null, []]) {
      const doc = buildHandover(base({ mlRows }))!
      expect(doc.hasMlExport).toBe(false)
      expect([doc.targetsMissingPhoto, doc.targetsMissingAudio, doc.targetsMissingVideo]).toEqual([[], [], []])
    }
  })

  it('a cleared key is null (S2)', () => {
    expect(buildHandover(base({ ebirdKey: null }))!.ebirdKey).toBeNull()
  })

  it('the Default Location carries lat/lng only; malformed or out-of-range reads as none', () => {
    expect(buildHandover(base())!.defaultLocation).toEqual({ lat: 37.3, lng: -121.9 })
    for (const bad of [null, undefined, 'x', { lat: '37', lng: -122 }, { lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: NaN, lng: 0 }, JSON.parse('{"__proto__":{"lat":1,"lng":2}}')]) {
      expect(buildHandover(base({ mapDefaults: bad }))!.defaultLocation).toBeNull()
    }
  })
})

describe('the builder REFUSES a document over its bounds (this side\'s enforcement)', () => {
  it('a key outside ^[A-Za-z0-9]{1,128}$', () => {
    for (const k of ['', 'abc def', 'abc\r\nX: 1', 'a'.repeat(129), 'é']) expect(buildHandover(base({ ebirdKey: k }))).toBeNull()
    expect(buildHandover(base({ ebirdKey: 'a'.repeat(128) }))).not.toBeNull()
  })

  it('a name over 200 UTF-16 units, or carrying a control character, is SKIPPED, never refusing the document (M1)', () => {
    const long = 'a'.repeat(MAX_NAME_UNITS + 1)
    const doc = buildHandover(base({
      observations: [{ commonName: long }, { commonName: 'Mal\tlard' }, { commonName: 'Mal\u007Flard' }, { commonName: 'Mallard' }],
    }))!
    expect(doc).not.toBeNull()
    expect(doc.recorded).toEqual(['mallard'])
    for (const set of [doc.targetsMissingPhoto, doc.targetsMissingAudio, doc.targetsMissingVideo]) {
      for (const n of set) expect(isValidHandoverName(n), n).toBe(true)
    }
    // The bound itself is unchanged: 200 units is kept, 201 is not.
    const edge = buildHandover(base({ observations: [{ commonName: 'a'.repeat(MAX_NAME_UNITS) }, { commonName: long }] }))!
    expect(edge.recorded).toEqual(['a'.repeat(MAX_NAME_UNITS)])
  })

  it('a set over 20,000 entries', () => {
    const many = Array.from({ length: MAX_SET_ENTRIES + 1 }, (_, i) => ({ commonName: `Species ${i}` }))
    expect(buildHandover(base({ observations: many, mlRows: null }))).toBeNull()
    expect(buildHandover(base({ observations: many.slice(1), mlRows: null }))).not.toBeNull()
  })

  it('a document over 4,000,000 UTF-8 bytes, measured in bytes', () => {
    // 19,000 names of 199 units, four copies (recorded + three target sets,
    // no export holds anything): about 15 MB, far over the byte bound while
    // under both the entry and the name bounds.
    const many = Array.from({ length: 19_000 }, (_, i) => ({ commonName: `${i}`.padEnd(199, 'x') }))
    expect(buildHandover(base({ observations: many, mlRows: [{ commonName: 'none', format: 'Photo' }] }))).toBeNull()
    expect(handoverByteLength('é')).toBe(2)
    expect(HANDOVER_MAX_BYTES).toBe(4_000_000)
  })

  it('a name that folds to nothing is skipped rather than refusing the document', () => {
    const doc = buildHandover(base({ observations: [{ commonName: '(Domestic type)' }, { commonName: 'Mallard' }] }))!
    expect(doc.recorded).toEqual(['mallard'])
  })
})

describe('the revocation document (M1)', () => {
  it('carries no key, no names and no location, and is valid under every bound', () => {
    const doc = buildRevocation(Date.UTC(2026, 8, 24, 12, 0, 0), '1.0.36')!
    expect(doc).toEqual({
      version: 1, writtenAt: '2026-09-24T12:00:00Z', appVersion: '1.0.36', ebirdKey: null,
      hasEbirdBackup: false, recorded: [], hasMlExport: false,
      targetsMissingPhoto: [], targetsMissingAudio: [], targetsMissingVideo: [], defaultLocation: null,
    })
  })

  it('an app version the class refuses is written as unknown', () => {
    expect(buildRevocation(0, 'not a version!')!.appVersion).toBe('unknown')
  })

  it('the one exception: a clock outside the years 0000 to 9999 returns null, and never throws', () => {
    expect(buildRevocation(Date.UTC(9999, 11, 31, 23, 59, 59), '1.0.36')).not.toBeNull()
    expect(buildRevocation(Date.UTC(10000, 0, 1), '1.0.36')).toBeNull()
    expect(buildRevocation(Date.UTC(-1, 0, 1), '1.0.36')).toBeNull()
    expect(() => buildRevocation(8.64e15 + 1, '1.0.36')).not.toThrow()
    expect(buildRevocation(8.64e15 + 1, '1.0.36')).toBeNull()
  })
})

describe('the shared name predicate', () => {
  it('is 1..200 code units, no C0 control or DEL, no JS-trim whitespace at either end', () => {
    expect(isValidHandoverName('mallard')).toBe(true)
    expect(isValidHandoverName('brant\u0085')).toBe(true)   // U+0085 is not in JS's trim set
    for (const bad of ['', ' mallard', 'mallard ', '﻿mallard', 'mallard　', 'mal\u0000lard', 'a'.repeat(201)]) {
      expect(isValidHandoverName(bad), JSON.stringify(bad)).toBe(false)
    }
    expect(foldSpeciesName('  NORTHERN SHRIKE (Borealis)  ')).toBe('northern shrike')
  })
})

describe('the platform gate (FR-32, QA-32)', () => {
  it('is true only on the iPhone and iPad apps', () => {
    expect(widgetsSupported()).toBe(false)
    platform.tauri = true
    expect(widgetsSupported()).toBe(false)   // macOS / Windows desktop
    platform.ios = true
    expect(widgetsSupported()).toBe(true)
    platform.tauri = false
    expect(widgetsSupported()).toBe(false)   // web / Pi
  })
})
