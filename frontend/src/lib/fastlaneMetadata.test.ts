// The F-Droid listing, committed as Fastlane metadata at the repository root
// (android-release FR-57, schema 6.4 and 6.5). F-Droid reads this folder at
// each tagged commit and builds one APK per processor type, each under its own
// version code (the app's code times ten plus 1, 2 or 4; the recipe's
// VercodeOperation), and it looks a release's "What's new" up by THAT code. So
// every release carries three changelog files with the same text, one per
// per-processor code, and none under the unsplit code (mezinster's review on
// MR 51451, 2026-10-09): this guard goes red at the bump until all three exist.
// The listing text is published copy, changed only on the user's yes (CLAUDE.md,
// published copy).
import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPO, readRepo, readRepoBytes, readPng } from '../test/androidProject'

const DIR = 'fastlane/metadata/android/en-US'
const SHORT_MAX = 80
const CHANGELOG_MAX = 500
const FULL_MAX = 4000
/** The per-processor version-code offsets, in the order fdroidRecipe.test.ts builds them. */
const ABI_OFFSETS = [1, 2, 4]
/** The codes F-Droid looks a release's changelog up by. */
const abiCodes = (versionCode: string) => ABI_OFFSETS.map(o => String(Number(versionCode) * 10 + o))

/** The version code the next tag will carry, from the one committed source F-Droid reads. */
function currentVersionCode(): string {
  const conf = JSON.parse(readRepo('src-tauri/tauri.conf.json')) as { bundle?: { android?: { versionCode?: number } } }
  const code = conf.bundle?.android?.versionCode
  if (typeof code !== 'number') throw new Error('tauri.conf.json: no bundle.android.versionCode')
  return String(code)
}

/** Every listing file's text, keyed by its path under the folder. */
function readListing(): Map<string, string> {
  const files = new Map<string, string>()
  for (const name of ['title.txt', 'short_description.txt', 'full_description.txt']) files.set(name, readRepo(`${DIR}/${name}`))
  for (const name of readdirSync(resolve(REPO, DIR, 'changelogs'))) files.set(`changelogs/${name}`, readRepo(`${DIR}/changelogs/${name}`))
  return files
}

/** Every reason the listing text is wrong for `versionCode`. Pure, so a scratch copy can be checked. */
function listingProblems(files: Map<string, string>, versionCode: string): string[] {
  const out: string[] = []
  const text = (name: string) => (files.get(name) ?? '').replace(/\n$/, '')
  if (text('title.txt') !== 'SnowRaven') out.push(`title.txt reads ${JSON.stringify(text('title.txt'))}`)
  const short = text('short_description.txt')
  if (short.length === 0 || short.length > SHORT_MAX) out.push(`short_description.txt is ${short.length} characters (1 to ${SHORT_MAX})`)
  const full = text('full_description.txt')
  if (full.length === 0 || full.length > FULL_MAX) out.push(`full_description.txt is ${full.length} characters (1 to ${FULL_MAX})`)
  const bodies = abiCodes(versionCode).map(c => files.get(`changelogs/${c}.txt`))
  abiCodes(versionCode).forEach((c, i) => {
    if (bodies[i] === undefined) out.push(`changelogs/${c}.txt is missing`)
  })
  if (new Set(bodies.filter(b => b !== undefined)).size > 1) out.push(`the changelogs for ${abiCodes(versionCode).join(', ')} differ`)
  if (files.has(`changelogs/${versionCode}.txt`)) {
    out.push(`changelogs/${versionCode}.txt is named by the unsplit code, which F-Droid never looks up`)
  }
  for (const [name, body] of files) {
    if (name.startsWith('changelogs/')) {
      if (!/^changelogs\/\d+\.txt$/.test(name)) out.push(`${name} is not named by a version code`)
      const len = body.replace(/\n$/, '').length
      if (len === 0 || len > CHANGELOG_MAX) out.push(`${name} is ${len} characters (1 to ${CHANGELOG_MAX})`)
    }
    if (body.includes('—')) out.push(`${name} contains an em dash`)
  }
  return out
}

describe('the F-Droid listing (fastlane/metadata/android/en-US)', () => {
  const files = readListing()

  it('reads at least the three text files and one changelog', () => {
    expect([...files.keys()].filter(k => k.startsWith('changelogs/')).length).toBeGreaterThan(0)
    expect(files.get('full_description.txt')!.length).toBeGreaterThan(1000)
  })

  it('has the same changelog under each per-processor code of the current version, and every file is within F-Droid\'s limits', () => {
    expect(listingProblems(files, currentVersionCode())).toEqual([])
  })

  it('the per-processor offsets are the recipe\'s VercodeOperation', () => {
    const recipe = readRepo('pipeline/android-release/fdroid/com.dtgibson.snowraven.yml')
    expect([...recipe.matchAll(/^ {2}- 10 \* %c \+ (\d+)$/gm)].map(m => Number(m[1]))).toEqual(ABI_OFFSETS)
  })

  it('the listing icon is a 512 px fully opaque PNG', () => {
    const png = readPng(readRepoBytes(`${DIR}/images/icon.png`))
    expect([png.width, png.height]).toEqual([512, 512])
    expect(png.minAlpha).toBe(255)
  })

  it('carries phone and ten-inch screenshots, each a readable PNG', () => {
    for (const set of ['phoneScreenshots', 'tenInchScreenshots']) {
      const shots = readdirSync(resolve(REPO, DIR, 'images', set)).filter(n => n.endsWith('.png'))
      expect(shots.length, set).toBeGreaterThan(0)
      for (const shot of shots) expect(readPng(readRepoBytes(`${DIR}/images/${set}/${shot}`)).width, `${set}/${shot}`).toBeGreaterThan(0)
    }
  })
})

describe('guard-the-guard', () => {
  it('removing one per-processor changelog, changing one, or adding the unsplit one in a scratch copy is each caught', () => {
    const code = currentVersionCode()
    const [first, second] = abiCodes(code)
    const missing = readListing()
    missing.delete(`changelogs/${second}.txt`)
    expect(listingProblems(missing, code)).toEqual([`changelogs/${second}.txt is missing`])
    const differs = readListing()
    differs.set(`changelogs/${first}.txt`, 'Something else.\n')
    expect(listingProblems(differs, code)).toEqual([`the changelogs for ${abiCodes(code).join(', ')} differ`])
    const unsplit = readListing()
    unsplit.set(`changelogs/${code}.txt`, unsplit.get(`changelogs/${first}.txt`)!)
    expect(listingProblems(unsplit, code)).toEqual([`changelogs/${code}.txt is named by the unsplit code, which F-Droid never looks up`])
  })

  it('a bump to a version code with no changelogs is caught three times', () => {
    expect(listingProblems(readListing(), String(Number(currentVersionCode()) + 1))).toHaveLength(3)
  })

  it('an over-long short description, an over-long changelog and an em dash are each caught', () => {
    const files = readListing()
    files.set('short_description.txt', 'x'.repeat(SHORT_MAX + 1))
    files.set('changelogs/1.txt', 'y'.repeat(CHANGELOG_MAX + 1))
    files.set('title.txt', 'SnowRaven —')
    const p = listingProblems(files, currentVersionCode())
    expect(p.some(s => s.startsWith('short_description.txt'))).toBe(true)
    expect(p.some(s => s.startsWith('changelogs/1.txt is'))).toBe(true)
    expect(p.some(s => s.includes('em dash'))).toBe(true)
  })
})
