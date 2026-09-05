/// <reference types="node" />
// @vitest-environment jsdom
//
// The DISPLAYED chord (FR-45 to FR-48, QA-43, QA-44, QA-46).
//
// PRESENTATION ONLY, and the last describe block is what keeps that honest: a
// source scan proving the `navigator.userAgent` read exists in this module and
// nowhere else in the feature, that its definition site says why, and that
// `lib/platform.ts` is unchanged. Without that scan this file would prove the
// helper returns the right label and say nothing about the boundary the label
// is allowed to cross.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

const P = vi.hoisted(() => ({ isIOS: vi.fn(), isMacOS: vi.fn(), isTauri: vi.fn() }))
vi.mock('./platform', () => ({ isIOS: P.isIOS, isMacOS: P.isMacOS, isTauri: P.isTauri }))

import { chordHintText, resolveChordHint } from './paletteHint'

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120'
const LINUX_UA = 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/120'

/** jsdom has no matchMedia at all, so every case installs the one it needs. */
function setPointer(coarse: boolean | 'absent' | 'throws') {
  if (coarse === 'absent') {
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'matchMedia')
    return
  }
  vi.stubGlobal('matchMedia', (q: string) => {
    if (coarse === 'throws') throw new SyntaxError('unknown media feature')
    return { matches: coarse && q.includes('coarse'), media: q } as MediaQueryList
  })
}

function setUA(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

beforeEach(() => {
  P.isIOS.mockReturnValue(false)
  P.isMacOS.mockReturnValue(false)
  P.isTauri.mockReturnValue(false)
  setPointer(false)
  setUA(WINDOWS_UA)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('resolveChordHint: the FR-45 table (QA-43)', () => {
  const CASES: {
    name: string
    ios?: boolean; mac?: boolean; tauri?: boolean
    pointer?: boolean | 'absent' | 'throws'
    ua?: string
    expected: 'none' | 'cmd' | 'ctrl'
  }[] = [
    { name: 'the iOS build', ios: true, tauri: true, expected: 'none' },
    { name: 'an iPad, whose userAgent LIES and says Macintosh', ios: true, tauri: true, ua: IPAD_UA, expected: 'none' },
    { name: 'a coarse primary pointer on the web', pointer: true, ua: IPAD_UA, expected: 'none' },
    { name: 'the macOS desktop build', mac: true, tauri: true, ua: MAC_UA, expected: 'cmd' },
    { name: 'the Windows desktop build', tauri: true, ua: WINDOWS_UA, expected: 'ctrl' },
    { name: 'a Mac in the browser, fine pointer', ua: MAC_UA, expected: 'cmd' },
    { name: 'Windows in the browser', ua: WINDOWS_UA, expected: 'ctrl' },
    { name: 'the Raspberry Pi build', ua: LINUX_UA, expected: 'ctrl' },
  ]

  it.each(CASES.map(c => [c.name, c] as const))('%s', (_label, c) => {
    P.isIOS.mockReturnValue(c.ios ?? false)
    P.isMacOS.mockReturnValue(c.mac ?? false)
    P.isTauri.mockReturnValue(c.tauri ?? false)
    setPointer(c.pointer ?? false)
    setUA(c.ua ?? WINDOWS_UA)
    expect(resolveChordHint()).toBe(c.expected)
  })

  it('the coarse-pointer gate comes FIRST, which is what stops an iPad showing a chord', () => {
    // The whole reason FR-45 orders the clauses this way. An iPad's WKWebView
    // reports a desktop-Safari "Macintosh" userAgent, so clause (c) alone would
    // put "⌘K" on a touch surface with no keyboard. The gate is ahead of it.
    P.isIOS.mockReturnValue(false)          // the WEB build on an iPad, where isIOS() is false
    P.isTauri.mockReturnValue(false)
    setUA(IPAD_UA)
    setPointer(true)
    expect(resolveChordHint()).toBe('none')
    // ...and with a fine pointer the same userAgent DOES resolve to cmd, so the
    // gate is doing the work rather than the userAgent test being dead.
    setPointer(false)
    expect(resolveChordHint()).toBe('cmd')
  })

  it('a userAgent read inside the DESKTOP build cannot reach clause (c)', () => {
    // Clause (c) is gated on `!isTauri()`. Under Tauri, `isMacOS()` is the
    // authority and a Windows build with a stray Apple token in its UA still
    // resolves to ctrl.
    P.isTauri.mockReturnValue(true)
    P.isMacOS.mockReturnValue(false)
    setUA(MAC_UA)
    expect(resolveChordHint()).toBe('ctrl')
  })
})

describe('the matchMedia read is guarded in both directions', () => {
  it('a missing matchMedia (jsdom, an old engine) does not throw and does not suppress the hint', () => {
    setPointer('absent')
    setUA(MAC_UA)
    expect(() => resolveChordHint()).not.toThrow()
    expect(resolveChordHint()).toBe('cmd')
  })

  it('a THROWING matchMedia fails closed rather than taking the navigation down', () => {
    // This runs on the navigation's render path. `matches` can throw on an
    // engine that does not know the feature, and a throw here would take the
    // whole nav with it -- the same reasoning as isFocusVisible's guarded
    // `el.matches(...)` in TabNav.tsx.
    setPointer('throws')
    setUA(WINDOWS_UA)
    expect(() => resolveChordHint()).not.toThrow()
    expect(resolveChordHint()).toBe('ctrl')
  })
})

describe('chordHintText (FR-46, QA-44)', () => {
  it('renders the platform glyph, and NOTHING for none', () => {
    expect(chordHintText('cmd')).toBe('⌘K')
    expect(chordHintText('ctrl')).toBe('Ctrl K')
    // The user is never shown a chord they have no way to press. Every shipped
    // caller omits the element entirely as well, so this is belt and braces.
    expect(chordHintText('none')).toBe('')
    expect(chordHintText('none')).not.toMatch(/Cmd|Ctrl|⌘/)
  })
})

describe('the userAgent read is hint-only (FR-48, QA-46)', () => {
  const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
  const code = (rel: string) =>
    src(rel).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

  it('this module reads navigator.userAgent, and its definition site says why', () => {
    expect(code('./paletteHint.ts')).toContain('navigator.userAgent')
    // The boundary, in prose, at the definition site -- so it is not later
    // mistaken for a platform predicate in the sense lib/platform.ts uses that
    // word (a file whose own comments record that UA sniffing is unreliable on
    // exactly the device family iPadOS is in).
    expect(src('./paletteHint.ts')).toMatch(/IT IS FOR THE HINT[\s\S]{0,24}ONLY \(FR-48\)/)
  })

  it('and no other file in the feature reads it', () => {
    for (const rel of [
      './usePaletteHotkey.ts',
      './paletteRows.ts',
      './paletteFocus.ts',
      './paletteCopy.ts',
      './paletteSpeciesLoad.ts',
      './speciesIndex.ts',
      './speciesMatch.ts',
      '../components/CommandPalette.tsx',
    ]) {
      expect(code(rel)).not.toContain('userAgent')
    }
  })

  it('lib/platform.ts still exposes exactly the three predicates this consumes', () => {
    // QA-46's "lib/platform.ts is unchanged", stated as the property that
    // matters rather than as a byte comparison an unrelated edit would break.
    const platform = code('./platform.ts')
    expect(platform).toMatch(/export function isTauri\(\)/)
    expect(platform).toMatch(/export function isIOS\(\)/)
    expect(platform).toMatch(/export function isMacOS\(\)/)
  })

  it('the Apple-token pattern is a module literal with no /g flag, so it is stateless', () => {
    // It is not built from the query and is outside NFR-07's scan, which is
    // scoped to the query path -- but a /g flag would give it `lastIndex` state
    // across calls, which is a defect in its own right.
    const m = code('./paletteHint.ts').match(/^const APPLE_PLATFORM_UA = (\/.*\/[a-z]*)$/m)
    expect(m).toBeTruthy()
    expect(m?.[1]).not.toMatch(/\/[a-z]*g[a-z]*$/)
  })
})
