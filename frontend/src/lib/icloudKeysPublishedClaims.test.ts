// icloud-api-key-sync FR-48 to FR-52, NFR-02, NFR-05 (QA-36, QA-37, QA-38,
// QA-42, QA-45): the published statements about the key path. Every
// hand-maintained restatement is in the file set (the docs-and-website rule:
// prose files included), the guards extract SENTENCES rather than windows,
// and each claim is asserted as a CONDITION (a qualifier in the same
// sentence), not a co-occurrence, so an editorial rewrite that keeps the
// claim true stays green and one that drops the qualifier goes red.
//
// What is pinned:
// - "end-to-end" appears in a published statement only in the same sentence
//   as the Advanced Data Protection qualifier (NFR-02, QA-42);
// - no sentence claims that API keys never leave the device / stay on the
//   device / are never synced without naming the key switch or its opt-in
//   in the same sentence (FR-48, QA-36);
// - both policy pages carry the key storage, protection and removal
//   statements, and the HELP sentence "Your API keys, settings and caches
//   are never synced." is gone (FR-48, FR-49, QA-37);
// - README, the website and the App Store record name the switch, and the
//   LISTING's "never written to it" claim no longer covers API keys (FR-50,
//   FR-51, QA-38);
// - no em dash in any of them, nor in the feature's copy module (QA-45).
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
const strip = (html: string) => html
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ')

const SURFACES: Array<[string, string]> = [
  ['PRIVACY_POLICY.md', read('PRIVACY_POLICY.md')],
  ['website/privacy.html', strip(read('website/privacy.html'))],
  ['docs/HELP.md', read('docs/HELP.md')],
  ['README.md', read('README.md')],
  ['website/index.html', strip(read('website/index.html'))],
  ['appstore/LISTING.md', read('appstore/LISTING.md')],
  ['ACCESSIBILITY.md', read('ACCESSIBILITY.md')],
]

/** A document's sentences, whitespace-normalised (the projectsPublishedClaims shape). */
function sentences(src: string): string[] {
  return src
    .split(/(?<=[.!?])\s+/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** A sentence that qualifies a "keys stay local" claim by naming the key switch or its opt-in. */
const KEY_SWITCH_QUALIFIER = /Sync API keys|key sync|key switch|unless you turn on|unless you also turn on|only if you also turn on|opt-in/i
/** The shapes an unqualified "keys stay local" claim takes. */
const STAYS_LOCAL = /never (leave|synced|written|uploaded)|stays? on (your|each|this|the) (own )?(device|machine|computer)|only on your device|never sync/i

describe('NFR-02 / QA-42: "end-to-end" is never said without the Advanced Data Protection qualifier', () => {
  it.each(SURFACES)('%s', (_name, src) => {
    const hits = sentences(src).filter(s => /end-to-end/i.test(s))
    for (const s of hits) expect(s).toMatch(/Advanced Data Protection/)
  })

  it('the qualifier is actually present on both policy pages (non-vacuity)', () => {
    for (const [name, src] of SURFACES.slice(0, 2)) {
      expect(sentences(src).filter(s => /end-to-end/i.test(s)).length, name).toBeGreaterThan(0)
    }
  })
})

describe('FR-48 / QA-36: no sentence claims API keys stay on the device without naming the key switch', () => {
  it.each(SURFACES)('%s', (_name, src) => {
    const claims = sentences(src).filter(s => /API keys?/i.test(s) && STAYS_LOCAL.test(s))
    for (const s of claims) expect(s).toMatch(KEY_SWITCH_QUALIFIER)
  })

  it('GUARD THE GUARD: the 1.0.11 sentences the feature replaced would fail', () => {
    const old = [
      'Nothing else is written: your API keys, app settings, map preferences and cached lookups stay on each device and are never synced.',
      'Your API keys, settings and caches are never synced.',
      'Your files, settings, and API keys stay on your device.',
      'Your eBird backup, Macaulay Library export, settings, and API keys never leave your computer.',
    ]
    for (const s of old) {
      expect(s).toMatch(STAYS_LOCAL)
      expect(s).not.toMatch(KEY_SWITCH_QUALIFIER)
    }
    // And a live sentence from each surface still trips the claim detector,
    // so the sweep is asserting about real sentences rather than an empty set.
    for (const [name, src] of SURFACES.slice(0, 5)) {
      expect(sentences(src).some(s => /API keys?/i.test(s) && STAYS_LOCAL.test(s)), `${name} has a keys sentence`).toBe(true)
    }
  })

  it('the privacy page meta description no longer claims keys stay on the device unqualified', () => {
    const meta = /<meta name="description" content="([^"]*)"/.exec(read('website/privacy.html'))![1]
    expect(meta).toMatch(/API keys/)
    expect(meta).toMatch(KEY_SWITCH_QUALIFIER)
  })
})

describe('FR-48 / QA-36: the policy and its mirror carry the key storage, protection and removal statements', () => {
  const section = (text: string, start: RegExp, end: RegExp) => {
    const a = text.search(start)
    expect(a).toBeGreaterThanOrEqual(0)
    const rest = text.slice(a + 1)
    const b = rest.search(end)
    return b > 0 ? rest.slice(0, b) : rest
  }
  const md = section(read('PRIVACY_POLICY.md'), /^## iCloud Sync$/m, /^## /m)
  const html = section(read('website/privacy.html'), /<h2 id="icloud-sync">/, /<h2 /)

  it.each([['PRIVACY_POLICY.md', md], ['website/privacy.html', html]])('%s', (_name, text) => {
    expect(text).toMatch(/Sync API keys/) // the switch, named
    expect(text).toMatch(/the key exactly as you entered it, when it was last changed, and which device changed it/) // what is stored
    expect(text).toMatch(/Apple encrypts the record in transit and at rest/) // how it is protected
    expect(text).toMatch(/end-to-end encrypted only if Advanced Data Protection is turned on/) // exactly what iCloud provides
    expect(text).toMatch(/developer has no way to see/) // invisible to the developer
    expect(text).toMatch(/Remove synced keys from iCloud/) // how to remove it
    expect(text).toMatch(/written only while the separate/) // keys written only with the key switch on
    expect(text).toMatch(/settings, map preferences and cached lookups stay on each device and are never synced/) // still true of the rest
    expect(text).not.toMatch(/your API keys, app settings, map preferences and cached lookups stay/)
  })

  it('the two carry the same sentences (the hand-kept mirror has not drifted at sentence scale)', () => {
    for (const claim of [
      'Your API keys are written only while the separate',
      'It goes only to your own iCloud account, and only your devices that also turn the switch on receive it.',
      'The developer has no way to see it.',
      'and Sync API keys goes off with it.',
    ]) {
      expect(md).toContain(claim)
      expect(strip(html)).toContain(claim)
    }
  })
})

describe('FR-49 / QA-37: the in-app help', () => {
  const help = read('docs/HELP.md')
  it('the old sentence is gone and the API Keys, iCloud Sync and offline sections describe the key path', () => {
    expect(help).not.toContain('Your API keys, settings and caches are never synced.')
    const apiKeys = help.slice(help.indexOf('### API Keys'), help.indexOf('### Default Files'))
    expect(apiKeys).toMatch(/\*\*Sync API keys\*\*/)
    for (const label of ['Up to date', 'Syncing', 'Waiting to upload', 'iCloud unavailable', 'Sync off', 'Could not sync', 'Retry']) {
      expect(apiKeys).toContain(label)
    }
    expect(apiKeys).toMatch(/masked exactly like one you typed/)
    expect(apiKeys).toMatch(/Clear asks you to confirm first/)
    expect(apiKeys).toMatch(/Replaced by the key from/)
    const ics = help.slice(help.indexOf('### iCloud Sync'), help.indexOf('### Default Location'))
    expect(ics).toMatch(/\*\*Sync API keys\.\*\*/)
    expect(ics).toMatch(/Turn on iCloud Sync first\./)
    expect(ics).toMatch(/Turning iCloud Sync off turns Sync API keys off too/)
    expect(ics).toMatch(/\*\*Remove synced keys from iCloud\*\*/)
    expect(ics).toMatch(/Advanced Data Protection/)
    const offline = help.slice(help.indexOf('## Using SnowRaven offline'), help.indexOf('## Updating SnowRaven'))
    expect(offline).toMatch(/keeps working with the keys it has/)
  })
})

describe('FR-50 / FR-51 / QA-38: README, the website and the App Store record', () => {
  it('README and the website name the second switch', () => {
    expect(read('README.md')).toMatch(/\*\*Sync API keys\*\* switch/)
    expect(strip(read('website/index.html'))).toMatch(/A second switch, also off by\s+default, can share your two API keys/)
    expect(strip(read('website/index.html'))).not.toContain('nothing else is synced')
  })

  it('the LISTING corrects its bullet, records why Data Not Collected still holds, and no longer says keys stay on the device unqualified', () => {
    const listing = read('appstore/LISTING.md')
    expect(listing).not.toContain('API keys, settings and caches are never written to it.')
    expect(listing).toMatch(/iCloud API key sync \(v1\.0\.12\)/)
    const bullet = listing.slice(listing.indexOf('**iCloud API key sync (v1.0.12):**'), listing.indexOf('Nuance to hold onto'))
    expect(bullet).toMatch(/"Data Not Collected"\s+holds/)
    expect(bullet).toMatch(/device-to-Apple/)
    expect(bullet).toMatch(/no server and no access/)
    expect(bullet).toMatch(/Advanced\s+Data Protection/)
    expect(listing).not.toContain('Your files, settings, and API keys stay on your device.')
  })

  it('the website version pill and footer follow the app version', () => {
    const pkg = JSON.parse(read('frontend/package.json')) as { version: string }
    const conf = JSON.parse(read('src-tauri/tauri.conf.json')) as { version: string }
    expect(conf.version).toBe(pkg.version)
    expect(read('website/index.html')).toContain(`v${pkg.version}`)
    expect(read('CHANGELOG.md')).toContain(`## [${pkg.version}]`)
  })
})

describe('NFR-05 / QA-45: no em dash in the published surfaces or the feature copy', () => {
  it.each([
    ...SURFACES.map(([name]) => name),
    'frontend/src/lib/icloud/icloudCopy.ts',
    'frontend/src/lib/icloud/keyRecord.ts',
    'frontend/src/lib/icloud/keyReconcile.ts',
    'frontend/src/lib/keysChanged.ts',
    'frontend/src/lib/useKeysEpoch.ts',
    'pipeline/icloud-api-key-sync/how-to-see.md',
  ])('%s carries no em dash', (name) => {
    expect(read(name).includes('—'), name).toBe(false)
  })
})
