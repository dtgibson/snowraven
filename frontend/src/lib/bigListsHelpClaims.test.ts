/// <reference types="node" />
// The two sentences in docs/HELP.md that name numbers big-old-life-lists moved,
// pinned to the constants that make them true (.claude/rules/docs-and-website.md:
// a published-claims guard scopes to its own passage, asserts the claim EXISTS
// before checking it, and builds its matchers from the imported constants).
//
//   * The Settings upload paragraph names each platform's cap. Its numbers are
//     built here from EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM and MAX_UPLOAD_BYTES, so a cap that moves turns
//     this red until the sentence moves with it.
//   * The Statistics milestone sentence names the first and last threshold of
//     MILESTONE_THRESHOLDS, formatted the way the badges print them.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM, MAX_UPLOAD_BYTES } from './uploadGuard'
import { MILESTONE_THRESHOLDS } from './birdingStats'
import { fmt } from './statsFormat'

const HELP = readFileSync(new URL('../../../docs/HELP.md', import.meta.url), 'utf8')
const paragraphs = HELP.split(/\n\s*\n/)
const MB = (bytes: number) => `${bytes / (1024 * 1024)} MB`

const para = paragraphs.find(p => p.startsWith('Each slot checks what you give it before saving.')) ?? ''

describe('docs/HELP.md, the upload size sentence', () => {

  it('exists, once', () => {
    expect(para, 'the paragraph exists').not.toBe('')
    expect(paragraphs.filter(p => p.startsWith('Each slot checks what you give it before saving.'))).toHaveLength(1)
    expect(para).toContain('a file larger than this device takes')
  })

  it('names each platform\'s cap, as the constants say', () => {
    const { mac, ios, android, windows, web } = EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM
    expect(mac).toBe(ios)
    expect(windows).toBe(web)
    expect(para).toContain(`The largest eBird backup the Mac, iPhone, and iPad apps take is ${MB(ios)}`)
    expect(para).toContain(`the Android app ${MB(android)}`)
    expect(para).toContain(`the Windows app and a browser ${MB(web)}`)
    expect(para).toContain(`the largest ML export is ${MB(MAX_UPLOAD_BYTES)} everywhere`)
    // And the refusal is before the read, which is what the code does.
    expect(para).toContain('before it is read')
    // No stale single figure left anywhere in the file.
    expect(HELP).not.toMatch(/larger than 50 MB/)
  })

  it('every other sentence in Help that names the cap names the same three figures (paragraph-scope sweep)', () => {
    const { ios, android, web } = EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM
    const others = paragraphs.filter(p => p !== para && /larger than/.test(p) && /\bMB\b/.test(p))
    // The Settings walkthrough restates it; deleting that restatement is not the fix.
    expect(others.length).toBeGreaterThan(0)
    for (const p of others) {
      expect(p).toContain(`${MB(ios)} in the Mac, iPhone, and iPad apps`)
      expect(p).toContain(`${MB(android)} in the Android app`)
      expect(p).toContain(`${MB(web)} in the Windows app and a browser`)
      expect(p).toContain(`for the ML export, ${MB(MAX_UPLOAD_BYTES)}`)
    }
  })
})

describe('docs/HELP.md, the milestone sentence', () => {
  it('names the first and last threshold the badges can show', () => {
    const line = HELP.split('\n').find(l => l.startsWith('Milestone pills mark every threshold')) ?? ''
    expect(line, 'the sentence exists').not.toBe('')
    const first = fmt(MILESTONE_THRESHOLDS[0])
    const last = fmt(MILESTONE_THRESHOLDS[MILESTONE_THRESHOLDS.length - 1])
    expect(line).toContain(`from ${first} to ${last} species`)
  })
})
