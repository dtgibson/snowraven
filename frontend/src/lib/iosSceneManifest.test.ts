/// <reference types="node" />
// THE iOS SCENE MANIFEST AND THE iOS VERSION SOURCE OF TRUTH
// (improve: apple-platform-readiness, items 1 and 4).
//
// WHY THIS GUARD EXISTS. Under the iOS 27 SDK an app with no
// `UIApplicationSceneManifest` trips
// `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`. The
// configuration must be STATIC and must name tao's own delegate class exactly,
// because the iOS 27 validator reads the static manifest and ignores tao's
// runtime registration. The class is `TaoSceneDelegate`: the `#[name = ...]` on
// the `define_class!` in tao's `platform_impl/ios/scene.rs`. Nothing in the
// release recipe would catch a regression here: `altool --validate-app` checks
// icons and entitlements, not scene adoption, so TestFlight accepts the build
// and the user gets an app that does not work.
//
// CORRECTED v1.0.31. This header used to state that tao 0.35.3 "does not
// implement `application:configurationForConnectingSceneSession:options:` --
// that landed in tao 0.37". Both halves were wrong. tao 0.35.3 implements that
// callback and registers it at `view.rs:752` whenever `multiple_scenes_enabled()`
// reads true, which is precisely what the manifest below makes true; what landed
// later was the FIX, tauri-apps/tao#1245, first released in tao 0.36.0. Until
// then the implementation returned a pointer to a `Retained` dropped at function
// exit, so UIKit received a freed `UISceneConfiguration` and RELEASE builds
// crashed on launch (tauri-apps/tao#1244) -- which is what shipped in 1.0.31 and
// why `src-tauri/vendor/tao` exists. The guard's conclusion is UNCHANGED and this
// file is deliberately not weakened: the manifest was the trigger of that crash,
// not its cause, and a newer tao retires the vendored patch rather than this
// manifest.
//
// THE FAILURE IS SILENT, WHICH IS WHY THE VALUES ARE PINNED RATHER THAN
// DOCUMENTED. Measured on an iOS 27.0 simulator: with
// `UIApplicationSupportsMultipleScenes` FALSE the app does not crash -- the
// process stays alive, WebKit loads and finishes the page, and the screen is
// blank, because tao's `multiple_scenes_enabled()` reads exactly that key and a
// false value sends tao down its non-scene startup path while UIKit runs the
// app in scene mode, leaving the window attached to no scene. With TRUE the app
// renders. A liveness check passes both.
//
// THREE FILES, ON PURPOSE, AND THEY MUST AGREE.
//   * `gen/apple/snowraven_iOS/Info.plist` is what the BUILD reads
//     (`GENERATE_INFOPLIST_FILE=NO`, `INFOPLIST_FILE=snowraven_iOS/Info.plist`).
//   * `gen/apple/project.yml` is the xcodegen INPUT. `xcodegen` is installed on
//     the build machine and regenerating would rewrite the plist from it, so a
//     manifest missing here is a manifest one command away from being lost.
//   * `src-tauri/Info.ios.plist` is Tauri's build-time overlay, merged into the
//     generated plist on every `tauri ios build`. It is the ONLY one of the
//     three that lives outside `gen/`, so it is the only one that survives a
//     re-run of `tauri ios init` -- which DECISIONS.md v0.5.68 records as a real
//     hazard, because init re-stamps Tauri's placeholders over `gen/apple`.
//
// Do NOT "simplify" the configuration to the empty `UISceneConfigurations` dict
// shown in Tauri's own documentation: tauri-apps/tauri #15719 reports that form
// trapping under the iOS 27 SDK too, because the validator reads the static
// manifest and ignores tao's runtime registration.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const at = (p: string) => new URL(`../../../${p}`, import.meta.url)
const read = (p: string) => readFileSync(at(p), 'utf8')

const GENERATED_PLIST = 'src-tauri/gen/apple/snowraven_iOS/Info.plist'
const TAURI_OVERLAY = 'src-tauri/Info.ios.plist'
const PROJECT_YML = 'src-tauri/gen/apple/project.yml'

// ── A minimal plist reader ──────────────────────────────────────────────────
// Pure JS on purpose: the frontend CI job runs on ubuntu-latest, where neither
// `plutil` nor `PlistBuddy` exists, so shelling out would make this guard
// macOS-only and it would silently not run where it matters most. It fails
// CLOSED on anything it does not understand rather than returning a partial
// object, so a plist shape it cannot read is an error and never a pass.
type PlistValue = string | number | boolean | PlistValue[] | { [k: string]: PlistValue }

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
}
const decodeEntities = (s: string) => s.replace(/&(?:amp|lt|gt|quot|apos);/g, m => ENTITIES[m])

export function parsePlist(xml: string): PlistValue {
  const src = xml
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  let i = 0
  const ws = () => { while (i < src.length && /\s/.test(src[i]!)) i += 1 }
  function tag(): { name: string, closing: boolean, selfClosing: boolean } {
    ws()
    if (src[i] !== '<') throw new Error(`plist: expected '<' at offset ${i}`)
    const end = src.indexOf('>', i)
    if (end < 0) throw new Error('plist: unterminated tag')
    const raw = src.slice(i + 1, end)
    i = end + 1
    return {
      name: raw.replace(/^\//, '').replace(/\/$/, '').trim().split(/\s/)[0]!,
      closing: raw.startsWith('/'),
      // `<dict/>` is how an EMPTY dict is spelled, and it is exactly the shape
      // of the trap this guard exists to reject (tauri-apps/tauri #15719).
      // Without this the self-closing form is read as an OPENING tag, silently
      // swallows its parent's terminator, and the reader throws somewhere else
      // entirely -- which is how the guard-the-guard row below found it.
      selfClosing: raw.endsWith('/') && !raw.startsWith('/'),
    }
  }
  function text(until: string): string {
    const close = `</${until}>`
    const at2 = src.indexOf(close, i)
    if (at2 < 0) throw new Error(`plist: unterminated <${until}>`)
    const t = src.slice(i, at2)
    i = at2 + close.length
    return decodeEntities(t)
  }
  function value(): PlistValue {
    const t = tag()
    if (t.closing) throw new Error(`plist: unexpected closing </${t.name}>`)
    switch (t.name) {
      case 'true': return true
      case 'false': return false
      case 'string': return t.selfClosing ? '' : text('string')
      case 'integer': return Number(text('integer'))
      case 'real': return Number(text('real'))
      case 'dict': {
        if (t.selfClosing) return {}
        const out: Record<string, PlistValue> = {}
        for (;;) {
          ws()
          const next = tag()
          if (next.closing && next.name === 'dict') return out
          if (next.closing || next.name !== 'key') throw new Error(`plist: expected <key>, got <${next.name}>`)
          out[text('key')] = value()
        }
      }
      case 'array': {
        if (t.selfClosing) return []
        const out: PlistValue[] = []
        for (;;) {
          ws()
          const mark = i
          const next = tag()
          if (next.closing && next.name === 'array') return out
          i = mark
          out.push(value())
        }
      }
      default: throw new Error(`plist: unsupported element <${t.name}>`)
    }
  }
  const root = tag()
  if (root.name !== 'plist') throw new Error(`plist: expected <plist>, got <${root.name}>`)
  return value()
}

const asDict = (v: PlistValue, what: string): Record<string, PlistValue> => {
  expect(typeof v === 'object' && v !== null && !Array.isArray(v), `${what} is not a dict`).toBe(true)
  return v as Record<string, PlistValue>
}

// ── A targeted reader for project.yml ───────────────────────────────────────
// Deliberately NOT a YAML parser: no YAML library is a declared dependency of
// `frontend`, and adding one to read four values would be a production
// dependency added for a test. This reads the manifest BLOCK by indentation and
// then asserts on its lines. What it cannot see, stated rather than assumed: a
// flow-style mapping (`{ a: 1 }`), an anchor/alias, or a quoted key. Every one
// of those would make the block-shape assertions below fail rather than pass,
// so it errs closed.

/** project.yml with YAML comments removed. */
function yamlWithoutComments(src: string): string {
  return src.split('\n').map(line => line.replace(/(^|\s)#.*$/, '')).join('\n')
}

/** The indented block under `key:`, comments already stripped. */
function yamlBlock(src: string, key: string): string[] {
  const lines = yamlWithoutComments(src).split('\n')
  const start = lines.findIndex(l => new RegExp(`^(\\s*)${key}:\\s*$`).test(l))
  if (start < 0) return []
  const indent = lines[start]!.match(/^\s*/)![0].length
  const out: string[] = []
  for (let n = start + 1; n < lines.length; n += 1) {
    const line = lines[n]!
    if (line.trim() === '') continue
    if (line.match(/^\s*/)![0].length <= indent) break
    out.push(line)
  }
  return out
}

const yml = read(PROJECT_YML)
const generated = asDict(parsePlist(read(GENERATED_PLIST)), GENERATED_PLIST)
const overlay = asDict(parsePlist(read(TAURI_OVERLAY)), TAURI_OVERLAY)

const SCENE_KEY = 'UIApplicationSceneManifest'
const ROLE = 'UIWindowSceneSessionRoleApplication'
const DELEGATE = 'TaoSceneDelegate'

describe('the iOS scene manifest', () => {
  it.each([[GENERATED_PLIST, generated], [TAURI_OVERLAY, overlay]])(
    '%s declares UIApplicationSceneManifest', (_name, dict) => {
      expect(dict[SCENE_KEY]).toBeDefined()
    })

  it('project.yml declares it too, so a regeneration cannot lose it', () => {
    expect(yamlBlock(yml, SCENE_KEY).length).toBeGreaterThan(0)
  })

  it.each([[GENERATED_PLIST, generated], [TAURI_OVERLAY, overlay]])(
    '%s supports multiple scenes (false ships a blank window, measured)', (_name, dict) => {
      const manifest = asDict(dict[SCENE_KEY]!, SCENE_KEY)
      expect(manifest.UIApplicationSupportsMultipleScenes).toBe(true)
    })

  it('project.yml agrees on the multiple-scenes flag', () => {
    const block = yamlBlock(yml, SCENE_KEY)
    const line = block.find(l => /^\s*UIApplicationSupportsMultipleScenes:/.test(l))
    expect(line, 'project.yml does not set UIApplicationSupportsMultipleScenes').toBeTruthy()
    expect(line!.split(':')[1]!.trim()).toBe('true')
  })

  it.each([[GENERATED_PLIST, generated], [TAURI_OVERLAY, overlay]])(
    '%s names exactly one real scene configuration for TaoSceneDelegate', (_name, dict) => {
      const manifest = asDict(dict[SCENE_KEY]!, SCENE_KEY)
      const configs = asDict(manifest.UISceneConfigurations!, 'UISceneConfigurations')
      // The EMPTY-dict form from Tauri's docs is the documented trap
      // (tauri-apps/tauri #15719), so emptiness is asserted against, not merely
      // left unasserted.
      expect(Object.keys(configs)).toEqual([ROLE])
      const entries = configs[ROLE]
      expect(Array.isArray(entries), `${ROLE} must be an array`).toBe(true)
      expect((entries as PlistValue[]).length).toBe(1)
      const entry = asDict((entries as PlistValue[])[0]!, `${ROLE}[0]`)
      // EXACT equality, never a substring: `TaoSceneDelegateV2` is a different
      // class and UIKit would fail to find it.
      expect(entry.UISceneDelegateClassName).toBe(DELEGATE)
      expect(entry.UISceneConfigurationName).toBe('Default Configuration')
    })

  it('project.yml agrees on the delegate class and the single configuration', () => {
    const block = yamlBlock(yml, SCENE_KEY)
    const text = block.join('\n')
    expect(text).toMatch(new RegExp(`^\\s*${ROLE}:\\s*$`, 'm'))
    const delegates = block
      .filter(l => /^\s*-?\s*UISceneDelegateClassName:/.test(l))
      .map(l => l.split(':')[1]!.trim())
    expect(delegates).toEqual([DELEGATE])
    const names = block.filter(l => /^\s*-\s*UISceneConfigurationName:/.test(l))
    expect(names.length, 'exactly one configuration entry').toBe(1)
  })

  it('the two plists carry byte-equal manifests, so the overlay merge is a no-op', () => {
    // Tauri merges Info.ios.plist over the generated plist on every iOS build.
    // If the two ever disagreed the overlay would silently win, and the file the
    // build reads would stop matching the file a regeneration produces.
    expect(overlay[SCENE_KEY]).toEqual(generated[SCENE_KEY])
  })
})

describe('the iOS version has ONE source of truth', () => {
  it('project.yml declares no version keys at all', () => {
    // COMMENTS ARE STRIPPED FIRST and that is load-bearing: project.yml's own
    // comment explains why these keys are absent, and names them. A raw scan
    // would match the explanation and fail a correct file (.claude/rules/
    // testing.md, v1.0.14).
    const bare = yamlWithoutComments(yml)
    expect(bare).not.toMatch(/^\s*CFBundleShortVersionString:/m)
    expect(bare).not.toMatch(/^\s*CFBundleVersion:/m)
  })

  it('the generated plist is internally consistent: build = version + "." + number', () => {
    const short = generated.CFBundleShortVersionString
    const build = generated.CFBundleVersion
    expect(typeof short).toBe('string')
    expect(typeof build).toBe('string')
    expect(short as string).toMatch(/^\d+\.\d+\.\d+$/)
    expect(build as string).toMatch(new RegExp(`^${(short as string).replace(/\./g, '\\.')}\\.\\d+$`))
  })

  it('the stamped iOS version never LEADS the app version', () => {
    // Deliberately NOT equality. CLAUDE.md's release rhythm bumps
    // frontend/package.json first and stamps the iOS plist several commits
    // later, so `main` legitimately sits with the plist BEHIND the app version
    // for the length of a ship. An equality guard would be red on main every
    // release -- the exact failure the four-file parity guard already caused
    // once. Leading, on the other hand, can only be a mistake.
    const pkg = JSON.parse(read('frontend/package.json')) as { version: string }
    const num = (v: string) => v.split('.').map(Number)
    const [a, b, c] = num(generated.CFBundleShortVersionString as string)
    const [x, y, z] = num(pkg.version)
    const plist = (a! * 1e6) + (b! * 1e3) + c!
    const app = (x! * 1e6) + (y! * 1e3) + z!
    expect(plist, `iOS plist ${generated.CFBundleShortVersionString} is ahead of app ${pkg.version}`)
      .toBeLessThanOrEqual(app)
  })
})

// GUARD THE GUARD. Both readers are hand-written, so each is exercised against
// the shapes the defect actually returns in. Without these, a reader that threw
// or silently matched nothing would make every assertion above vacuous.
describe('the plist reader', () => {
  const wrap = (body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "">\n<plist version="1.0">\n${body}\n</plist>`

  it('reads nested dicts, arrays and booleans', () => {
    expect(parsePlist(wrap(
      '<dict><key>a</key><true/><key>b</key><dict><key>c</key><array><string>x</string><integer>2</integer></array></dict></dict>',
    ))).toEqual({ a: true, b: { c: ['x', 2] } })
  })

  it('distinguishes true from false rather than reading both as present', () => {
    expect(parsePlist(wrap('<dict><key>a</key><false/></dict>'))).toEqual({ a: false })
  })

  it('decodes entities in keys and strings', () => {
    expect(parsePlist(wrap('<dict><key>a&amp;b</key><string>&lt;x&gt;</string></dict>')))
      .toEqual({ 'a&b': '<x>' })
  })

  it('ignores comments rather than reading them as content', () => {
    expect(parsePlist(wrap('<dict><!-- <key>ghost</key><true/> --><key>a</key><true/></dict>')))
      .toEqual({ a: true })
  })

  it('fails closed on an element it does not understand', () => {
    expect(() => parsePlist(wrap('<dict><key>a</key><date>2026-01-01</date></dict>'))).toThrow(/unsupported/)
  })

  it('fails closed on a malformed dict rather than returning a partial object', () => {
    expect(() => parsePlist(wrap('<dict><string>no key</string></dict>'))).toThrow(/expected <key>/)
  })

  it('an empty configurations dict is visible as empty (the #15719 shape)', () => {
    const parsed = parsePlist(wrap(
      '<dict><key>UIApplicationSceneManifest</key><dict><key>UIApplicationSupportsMultipleScenes</key><true/><key>UISceneConfigurations</key><dict/></dict></dict>',
    )) as Record<string, Record<string, PlistValue>>
    expect(parsed.UIApplicationSceneManifest!.UISceneConfigurations).toEqual({})
  })
})

describe('the project.yml block reader', () => {
  const fixture = [
    'targets:',
    '  app:',
    '    info:',
    '      properties:',
    '        # CFBundleVersion: 9.9.9  <- a comment naming the key',
    '        UIApplicationSceneManifest:',
    '          UIApplicationSupportsMultipleScenes: true',
    '          UISceneConfigurations:',
    '            UIWindowSceneSessionRoleApplication:',
    '              - UISceneConfigurationName: Default Configuration',
    '                UISceneDelegateClassName: TaoSceneDelegate',
    '        LSRequiresIPhoneOS: true',
  ].join('\n')

  it('takes the indented block and stops at the first dedent', () => {
    const block = yamlBlock(fixture, 'UIApplicationSceneManifest')
    expect(block.some(l => l.includes('TaoSceneDelegate'))).toBe(true)
    expect(block.some(l => l.includes('LSRequiresIPhoneOS')), 'must stop at the sibling key').toBe(false)
  })

  it('a commented-out key does not count as declaring it', () => {
    expect(yamlWithoutComments(fixture)).not.toMatch(/^\s*CFBundleVersion:/m)
  })

  it('an UNcommented key IS seen (so the check above is not vacuous)', () => {
    const withKey = fixture.replace('        LSRequiresIPhoneOS: true', '        CFBundleVersion: "9.9.9"')
    expect(yamlWithoutComments(withKey)).toMatch(/^\s*CFBundleVersion:/m)
  })

  it('reports an absent block as empty rather than swallowing the next key', () => {
    expect(yamlBlock(fixture, 'NoSuchKey')).toEqual([])
  })
})
