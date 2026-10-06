// The F-Droid listing, committed as Fastlane metadata at the repository root
// (android-release FR-57, schema 6.4 and 6.5). F-Droid reads this folder at
// each tagged commit, so a release whose version code has no changelog file
// shows no "What's new" for that version: this guard goes red at the bump
// until `changelogs/<versionCode>.txt` exists. The listing text is published
// copy, changed only on the user's yes (CLAUDE.md, published copy).
import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPO, readRepo, readRepoBytes, readPng } from '../test/androidProject'

const DIR = 'fastlane/metadata/android/en-US'
const SHORT_MAX = 80
const CHANGELOG_MAX = 500
const FULL_MAX = 4000

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
  if (!files.has(`changelogs/${versionCode}.txt`)) out.push(`changelogs/${versionCode}.txt is missing`)
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

  it('has a changelog for the current version code, and every file is within F-Droid\'s limits', () => {
    expect(listingProblems(files, currentVersionCode())).toEqual([])
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
  it('removing the current changelog in a scratch copy is caught', () => {
    const files = readListing()
    const code = currentVersionCode()
    files.delete(`changelogs/${code}.txt`)
    expect(listingProblems(files, code)).toContain(`changelogs/${code}.txt is missing`)
  })

  it('a bump to a version code with no changelog is caught', () => {
    expect(listingProblems(readListing(), String(Number(currentVersionCode()) + 1))).toHaveLength(1)
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
