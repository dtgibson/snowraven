// The bundled project/portal label table and the two shipped lookups it brought
// with it (county-shading-and-project-stats, FR-57, NFR-09; QA-62, QA-65).
//
// THE KEY IS THE ATTACKER-INFLUENCEABLE PART, not the table. The table is a
// bundled build-time asset — an attacker who could change it could already
// change the code that reads it — so it needs no runtime validation. Its KEYS
// arrive from the eBird response, which is why every lookup goes through
// `Object.hasOwn`: a bare index on an object literal returns a TRUTHY INHERITED
// MEMBER for at least twelve strings, so `TABLE[raw] ?? raw` silently returns an
// inherited member instead of falling through to the raw input.

import { describe, it, expect } from 'vitest'
import { canonicalProject, isGenericPortal, hasPublishedName } from './projectLabels'
import { protocolName, submissionAppName, submissionLabel } from './checklistMeta'

// The twelve strings a bare index resolves to something truthy on an object
// literal. Every guarded lookup must return the RAW INPUT for all of them.
const PROTOTYPE_CHAIN = [
  'constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty',
  'isPrototypeOf', 'toLocaleString', 'propertyIsEnumerable',
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
]

describe('canonicalProject (FR-57)', () => {
  it('resolves BOTH forms of the atlas to ONE canonical key', () => {
    // This is what makes a checklist naming the same project by a code and by a
    // numeric id count once.
    const byCode = canonicalProject('EBIRD_ATL_CA')
    const byId = canonicalProject('1050')
    expect(byCode.key).toBe(byId.key)
    expect(byCode.label).toBe('California Breeding Bird Atlas')
    expect(byId.label).toBe('California Breeding Bird Atlas')
  })

  it('labels the two generic portals, or the submitted-via block renders raw codes', () => {
    expect(canonicalProject('EBIRD').label).toBe('eBird')
    expect(canonicalProject('EBIRD_MERLIN').label).toBe('Merlin')
  })

  it('an UNKNOWN identifier is its own key and renders VERBATIM', () => {
    // A name is never invented: no public eBird endpoint resolves an id.
    expect(canonicalProject('FOO_BAR')).toEqual({ key: 'FOO_BAR', label: 'FOO_BAR' })
    expect(canonicalProject('9999')).toEqual({ key: '9999', label: '9999' })
    expect(hasPublishedName('9999')).toBe(false)
    expect(hasPublishedName('EBIRD_ATL_CA')).toBe(true)
  })

  it('two unknown identifiers are SEPARATE keys — the app cannot know and does not guess', () => {
    expect(canonicalProject('9999').key).not.toBe(canonicalProject('FOO_BAR').key)
  })

  it.each(PROTOTYPE_CHAIN)('QA-65: %s returns the RAW input, not an inherited member', (name) => {
    const got = canonicalProject(name)
    expect(got.label).toBe(name)
    expect(got.key).toBe(name)
    expect(typeof got.label).toBe('string')
    expect(hasPublishedName(name)).toBe(false)
  })

  it('returns plain strings only, so no identifier can become a URL (FR-29)', () => {
    for (const id of ['EBIRD_ATL_CA', '1050', 'FOO_BAR', '__proto__']) {
      const got = canonicalProject(id)
      expect(typeof got.key).toBe('string')
      expect(typeof got.label).toBe('string')
      expect(got.label).not.toMatch(/^https?:/i)
    }
  })
})

describe('isGenericPortal', () => {
  it('names the two submission portals and nothing else', () => {
    expect(isGenericPortal('EBIRD')).toBe(true)
    expect(isGenericPortal('EBIRD_MERLIN')).toBe(true)
    // A PROJECT portal is not generic, which is what keeps the atlas a project.
    expect(isGenericPortal('EBIRD_ATL_CA')).toBe(false)
    expect(isGenericPortal('FOO_BAR')).toBe(false)
  })

  it.each(PROTOTYPE_CHAIN)('is false for %s (a Set has no prototype hazard)', (name) => {
    expect(isGenericPortal(name)).toBe(false)
  })
})

describe('the two shipped lookups converted in this change (FR-57, QA-65)', () => {
  it('protocolName still resolves every real code', () => {
    expect(protocolName('P22')).toBe('Traveling')
    expect(protocolName('P21')).toBe('Stationary')
    expect(protocolName('P60')).toBe('Pelagic')
    expect(protocolName('P99')).toBe('P99')       // unknown falls through raw
    expect(protocolName('')).toBe('')
    expect(protocolName(null)).toBe('')
  })

  it.each(PROTOTYPE_CHAIN)('protocolName(%j) returns the raw input, not an inherited member', (name) => {
    // Before the guard this returned `Object.prototype[name]` — a function for
    // most of these — which is neither a protocol name nor a string.
    expect(protocolName(name)).toBe(name)
  })

  it('submissionAppName still resolves every real code and its prefix fallback', () => {
    expect(submissionAppName('EBIRD_iOS')).toBe('eBird iOS')
    expect(submissionAppName('EBIRD_WEB')).toBe('eBird Website')
    expect(submissionAppName('EBIRD')).toBe('eBird Website')
    expect(submissionAppName('EBIRD_Future')).toBe('eBird Future')  // prefix fallback
    expect(submissionAppName('SOMETHING')).toBe('SOMETHING')
    expect(submissionAppName(null)).toBe('')
  })

  it.each(PROTOTYPE_CHAIN)('submissionAppName(%j) returns the raw input', (name) => {
    // It was indexed TWICE (`if (APP_NAMES[code]) return APP_NAMES[code]`), so
    // both reads had to move behind the guard.
    expect(submissionAppName(name)).toBe(name)
  })

  it('submissionLabel composes on the guarded name', () => {
    expect(submissionLabel('EBIRD_iOS', '3.6.5')).toBe('eBird iOS 3.6.5')
    expect(submissionLabel('constructor', '1')).toBe('constructor 1')
  })
})
