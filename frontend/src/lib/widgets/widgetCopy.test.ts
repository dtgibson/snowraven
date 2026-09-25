/// <reference types="node" />
// THE WIDGET'S WORDS AND THE PROSE THIS FEATURE CHANGED (ios-lifer-widgets
// NFR-10; QA-42, QA-55): no em dash (U+2014) and none of the house list of
// British spellings, in the Swift copy table, the Edit Widget strings, every
// Swift view, the extension plist, and the published files FR-42 rewrote.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const repo = (p: string) => readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8')
const EM_DASH = '—'
const BRITISH = /\b(colour|behaviour|favourite|centre|metre|kilometre|organise|recognise|licence|grey|catalogue|analyse|neighbour|honour|travelled|modelled)\w*/i

const swiftDir = 'src-tauri/gen/apple/snowraven_widgets/Sources'
function swiftFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(new URL(`../../../../${dir}`, import.meta.url), { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...swiftFiles(`${dir}/${e.name}`))
    else if (e.isFile() && e.name.endsWith('.swift')) out.push(`${dir}/${e.name}`)
  }
  return out
}

/** Only string literals: a comment is not copy. */
const literals = (src: string) => [...src.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map(m => m[1]!)

/** The passages this feature wrote or rewrote (whole files carry older text
 *  outside this feature's scope). */
function passage(md: string, from: string, to: string): string {
  const i = md.indexOf(from)
  const j = md.indexOf(to, i + from.length)
  return i < 0 || j < 0 ? '' : md.slice(i, j)
}
const CHANGED_PROSE: [string, () => string][] = [
  ['HELP.md Widgets', () => passage(repo('docs/HELP.md'), '### Widgets', '## Multimedia')],
  ['PRIVACY_POLICY.md Your Location', () => passage(repo('PRIVACY_POLICY.md'), '## Your Location', '## Map Tiles')],
  ['PRIVACY_POLICY.md iOS App', () => passage(repo('PRIVACY_POLICY.md'), '## iOS App', '## iCloud Sync')],
  ['PRIVACY_POLICY.md Connections', () => passage(repo('PRIVACY_POLICY.md'), '## Connections to Bird and Weather Services', '## Your Location')],
  ['ACCESSIBILITY.md widget paragraph', () => passage(repo('ACCESSIBILITY.md'), 'home-screen widget reads to VoiceOver', '---')],
]

describe('widget copy', () => {
  it('every string literal in the extension is free of em dashes and British spellings', () => {
    const files = swiftFiles(swiftDir)
    expect(files.some(f => f.endsWith('WidgetCopy.swift'))).toBe(true)
    let count = 0
    for (const f of files) {
      for (const lit of literals(repo(f))) {
        count++
        expect(lit.includes(EM_DASH), `${f}: ${lit}`).toBe(false)
        expect(BRITISH.test(lit), `${f}: ${lit}`).toBe(false)
      }
    }
    expect(count).toBeGreaterThan(50)
  })

  it('the extension plist display name and the usage string are clean', () => {
    for (const f of ['src-tauri/gen/apple/snowraven_widgets/Info.plist', 'src-tauri/Info.ios.plist']) {
      const strings = [...repo(f).matchAll(/<string>([^<]*)<\/string>/g)].map(m => m[1]!)
      for (const s of strings) {
        expect(s.includes(EM_DASH), `${f}: ${s}`).toBe(false)
        expect(BRITISH.test(s), `${f}: ${s}`).toBe(false)
      }
    }
  })

  it.each(CHANGED_PROSE)('%s carries no em dash and no British spelling', (_name, get) => {
    const text = get()
    expect(text.length).toBeGreaterThan(200)
    expect(text.includes(EM_DASH)).toBe(false)
    const m = BRITISH.exec(text)
    expect(m?.[0] ?? null).toBeNull()
  })

  it('the scan is not vacuous: it catches a planted em dash and a planted spelling', () => {
    expect(literals('let a = "Colour me — grey"')[0]!.includes(EM_DASH)).toBe(true)
    expect(BRITISH.test('Colour')).toBe(true)
    expect(BRITISH.test('color')).toBe(false)
  })
})
