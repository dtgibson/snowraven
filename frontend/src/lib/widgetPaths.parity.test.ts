/// <reference types="node" />
// iOS WIDGETS, THREE LANGUAGES, ONE SET OF CONSTANTS (ios-lifer-widgets,
// schema.md section 8; QA-33, QA-49, NFR-04). The app writes the hand-over in
// TypeScript through Rust, the extension reads it in Swift, and the deep link
// is built in Swift and parsed in TypeScript. Nothing in CI compiles the Swift,
// so what the three must agree on is source-grepped here, the
// icloudPaths.parity.test.ts pattern: a rename or a bound moved on one side
// fails on CI rather than as a silent S1 ("Open SnowRaven once") on a phone.
//
// Split of evidence, stated so no row is read as more than it is: the rows
// below pin DECLARATIONS to each other. Each side's ENFORCEMENT of the bounds
// is pinned by that side's own suite (widgetHandover.test.ts for TypeScript,
// `cargo test widgets` for Rust, HandoverDecodingTests for Swift), each of
// which goes red when its own check is deleted.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  APP_GROUP_ID, HANDOVER_FILE, HANDOVER_MAX_BYTES, MAX_KEY_LEN, MAX_NAME_UNITS, MAX_SET_ENTRIES, WIDGETS_DIR,
} from './widgets/widgetHandover'
import { LINK_MAX_LENGTH, LINK_SCHEME, LOC_ID_RE } from './links/deepLink'
import { SPECIES_CODE_RE } from './speciesCode'
import { RECORD_MAX_STRING, WIDGET_BACK_DAYS, WIDGET_DIST_KM } from './widgets/widgetRows'

const repo = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
const APPLE = 'src-tauri/gen/apple'
const rust = repo('src-tauri/src/widgets.rs')
/** widgets.rs with // and //! comment text removed: its own doc comments name
 *  the things these rows forbid (Debug, SceneRequested), and a raw scan would
 *  fail a correct file (.claude/rules/testing.md). */
const rustCode = rust.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
const libRs = repo('src-tauri/src/lib.rs')
const native = readFileSync(new URL('./widgets/widgetNative.ts', import.meta.url), 'utf8')
const swift = (f: string) => repo(`${APPLE}/snowraven_widgets/Sources/${f}`)
const appGroupSwift = swift('Logic/AppGroup.swift')
const handoverSwift = swift('Logic/Handover.swift')
const deepLinkSwift = swift('Logic/DeepLink.swift')
const reducerSwift = swift('Logic/RecentObsReducer.swift')
const cacheSwift = swift('Logic/WidgetCache.swift')
const requestSwift = swift('Logic/EBirdRequest.swift')

function rustConst(name: string): string {
  const m = new RegExp(`pub const ${name}: [^=]+= ([^;]+);`).exec(rust)
  if (!m) throw new Error(`widgets.rs: const ${name} not found`)
  return m[1]!.replace(/"/g, '').replace(/_/g, '')
}
const num = (n: number) => String(n)

describe('the App Group and file names are one string on every side', () => {
  it('the group id', () => {
    expect(APP_GROUP_ID).toBe('group.com.dtgibson.snowraven')
    expect(rustConst('APP_GROUP_ID')).toBe(APP_GROUP_ID)
    expect(appGroupSwift).toContain(`static let id = "${APP_GROUP_ID}"`)
    for (const ent of [`${APPLE}/snowraven_iOS/snowraven_iOS.entitlements`, `${APPLE}/snowraven_widgets/snowraven_widgets.entitlements`]) {
      expect(repo(ent)).toContain(`<string>${APP_GROUP_ID}</string>`)
    }
  })

  it('the directory and the hand-over file name', () => {
    expect(rustConst('WIDGETS_DIR')).toBe(WIDGETS_DIR)
    expect(rustConst('HANDOVER_FILE')).toBe(HANDOVER_FILE)
    expect(appGroupSwift).toContain(`static let widgetsDir = "${WIDGETS_DIR}"`)
    expect(appGroupSwift).toContain(`static let handoverFile = "${HANDOVER_FILE}"`)
  })
})

describe('the hand-over bounds are the same numbers on every side', () => {
  it('the whole-document byte bound', () => {
    expect(rustConst('HANDOVER_MAX_BYTES')).toBe(num(HANDOVER_MAX_BYTES))
    expect(appGroupSwift).toContain(`static let handoverMaxBytes = ${HANDOVER_MAX_BYTES.toLocaleString('en-US').replace(/,/g, '_')}`)
  })

  it('entries per set, UTF-16 units per name, key length', () => {
    expect(rustConst('MAX_SET_ENTRIES')).toBe(num(MAX_SET_ENTRIES))
    expect(rustConst('MAX_NAME_UNITS')).toBe(num(MAX_NAME_UNITS))
    expect(rustConst('MAX_KEY_LEN')).toBe(num(MAX_KEY_LEN))
    expect(handoverSwift).toContain(`static let maxSetEntries = ${MAX_SET_ENTRIES.toLocaleString('en-US').replace(/,/g, '_')}`)
    expect(handoverSwift).toContain(`static let maxNameUnits = ${MAX_NAME_UNITS}`)
    expect(handoverSwift).toContain(`static let maxKeyLength = ${MAX_KEY_LEN}`)
  })

  it('the record string bound, the request, and the version', () => {
    expect(reducerSwift).toContain(`static let maxStringUnits = ${RECORD_MAX_STRING}`)
    expect(requestSwift).toContain(`static let backDays = ${WIDGET_BACK_DAYS}`)
    // The radius is computed the way the handlers compute it, never restated.
    expect(cacheSwift).toContain('static let distKm = Int((25 * 1.60934).rounded())')
    expect(WIDGET_DIST_KM).toBe(Math.round(25 * 1.60934))
    expect(rustConst('HANDOVER_VERSION')).toBe('1')
    expect(handoverSwift).toContain('static let currentVersion = 1')
  })

  it('the Rust struct that carries the key derives no Debug, and no error string can carry the body', () => {
    const decl = rustCode.slice(rustCode.lastIndexOf('#[derive(', rustCode.indexOf('struct HandoverDoc {')), rustCode.indexOf('struct HandoverDoc {'))
    expect(decl).toContain('#[derive(Deserialize)]')
    expect(decl).not.toMatch(/Debug/)
    expect(rustCode).not.toMatch(/derive\([^)]*Debug[^)]*\)\s*(#\[[^\]]*\]\s*)*struct (HandoverDoc|DefaultLocation)/)
    expect(rust).toContain('#[serde(deny_unknown_fields, rename_all = "camelCase")]')
    // Every error the command returns is one of three fixed strings.
    const errs = new Set([...rust.matchAll(/Err\("([^"]+)"\)|"(too-large|invalid|no-app-group|unavailable)"/g)].map(m => m[1] ?? m[2]))
    for (const e of errs) expect(['too-large', 'invalid', 'no-app-group', 'unavailable']).toContain(e)
    expect(rustCode).not.toMatch(/format!\([^)]*document/)
    expect(rustCode).not.toMatch(/(println|eprintln|log::\w+)!/)
  })
})

describe('the deep link: one scheme, one length bound, one event', () => {
  it('the scheme', () => {
    expect(LINK_SCHEME).toBe('snowraven')
    expect(rustConst('LINK_SCHEME')).toBe(LINK_SCHEME)
    expect(deepLinkSwift).toContain(`static let scheme = "${LINK_SCHEME}"`)
  })

  it('the TypeScript and Swift length bound agree; native parks at most its own larger bound', () => {
    expect(deepLinkSwift).toContain(`static let maxLength = ${LINK_MAX_LENGTH}`)
    expect(Number(rustConst('LINK_MAX_BYTES'))).toBeGreaterThanOrEqual(LINK_MAX_LENGTH)
  })

  // Stage 8: the bird ids. The two engines cannot share a regex object, so the
  // pattern TEXT is compared; the TypeScript side is the app's one definition
  // (lib/speciesCode.ts, which SpeciesLinks also gates on).
  it('the species-code and location-id patterns are one text on both sides, and the app\'s own', () => {
    expect(SPECIES_CODE_RE.source).toBe('^[a-z0-9-]{2,16}$')
    expect(deepLinkSwift).toContain(`static let speciesCodePattern = "${SPECIES_CODE_RE.source}"`)
    expect(deepLinkSwift).toContain(`static let locIdPattern = "${LOC_ID_RE.source}"`)
    const speciesLinks = readFileSync(new URL('../components/SpeciesLinks.tsx', import.meta.url), 'utf8')
    expect(speciesLinks).toContain("import { SPECIES_CODE_RE } from '../lib/speciesCode'")
    expect(speciesLinks).not.toMatch(/const SPECIES_CODE_RE\s*=/)
  })

  it('the event and the three commands exist on both sides and are registered for iOS only', () => {
    expect(rustConst('LINK_EVENT')).toBe('snowraven-link')
    expect(native).toContain("export const LINK_EVENT = 'snowraven-link'")
    for (const c of ['widgets_write_handover', 'widgets_remove_handover', 'widgets_take_pending_link']) {
      expect(rust).toContain(`pub fn ${c}(`)
      expect(native).toContain(`'${c}'`)
      expect(libRs).toContain(`#[cfg(target_os = "ios")]\n            widgets::${c},`)
    }
    expect(libRs).toContain('#[cfg(any(target_os = "ios", test))]\nmod widgets;')
    expect(libRs).toContain('#[cfg(target_os = "ios")]\n    let builder = builder.plugin(widgets::plugin());')
    // The single-webview keeper is untouched: still Builder::run with Tauri's own callback.
    expect(libRs).toContain('.run(tauri::generate_context!())')
    expect(rustCode).not.toContain('SceneRequested')
    expect(rustCode).toContain('RunEvent::Opened')
  })
})

describe('the extension never reads the app sandbox, and carries the app brand (QA-33)', () => {
  const swiftFiles = (dir: string): string[] => {
    const out: string[] = []
    for (const e of readdirSync(new URL(`../../../${dir}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) out.push(...swiftFiles(`${dir}/${e.name}`))
      else if (e.isFile() && e.name.endsWith('.swift')) out.push(`${dir}/${e.name}`)
    }
    return out
  }
  const sources = swiftFiles(`${APPLE}/snowraven_widgets/Sources`)

  it('no extension source names the app\'s own documents', () => {
    expect(sources.length).toBeGreaterThan(15)
    for (const f of sources) {
      const text = repo(f)
      for (const banned of ['api-keys.json', 'settings.json', 'metadata.json', 'replay.json', 'AppLocalData']) {
        expect(text.includes(banned), `${f} names ${banned}`).toBe(false)
      }
    }
  })

  it('the only network code is one URLSession file that talks to api.ebird.org', () => {
    const net = sources.filter(f => /URLSession\b/.test(repo(f)))
    expect(net.map(f => f.split('/').pop())).toEqual(['EBirdClient.swift'])
    expect(requestSwift).toContain('static let host = "api.ebird.org"')
    expect(requestSwift).toContain('"https://\\(host)\\(path)?lat=')
  })

  it('the raven path is the in-app RavenGlyph path, byte for byte', () => {
    const tsx = readFileSync(new URL('../components/RavenGlyph.tsx', import.meta.url), 'utf8')
    const web = /const RAVEN_PATH =\s*'([^']+)'/.exec(tsx)![1]
    const sw = /static let pathData = "([^"]+)"/.exec(swift('Widget/RavenGlyph.swift'))![1]
    expect(sw).toBe(web)
  })

  it('the widget colors are the app tokens they name, light and dark (design-spec.md "Design Tokens Applied")', () => {
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
    const block = (sel: string) => { const i = css.indexOf(`${sel} {`); return css.slice(i, css.indexOf('}', i)) }
    const token = (b: string, name: string) => new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(b)![1]!.toUpperCase()
    const root = block(':root'), dark = block('[data-theme="dark"]')
    const colorset = (name: string) => {
      const doc = JSON.parse(repo(`${APPLE}/snowraven_widgets/Assets.xcassets/${name}.colorset/Contents.json`)) as {
        colors: { appearances?: unknown[]; color: { components: { red: string; green: string; blue: string } } }[]
      }
      const hex = (c: { red: string; green: string; blue: string }) => `#${[c.red, c.green, c.blue].map(v => v.slice(2)).join('')}`.toUpperCase()
      return { light: hex(doc.colors.find(c => !c.appearances)!.color.components), dark: hex(doc.colors.find(c => c.appearances)!.color.components) }
    }
    for (const [set, tok] of [['WidgetText', '--sr-text'], ['WidgetMuted', '--sr-text-muted'], ['WidgetAccent', '--sr-accent']] as const) {
      expect(colorset(set), set).toEqual({ light: token(root, tok), dark: token(dark, tok) })
    }
    // The container: --sr-surface in light; the system widget dark ground in
    // dark, the one named exception in the design spec.
    expect(colorset('WidgetBackground')).toEqual({ light: token(root, '--sr-surface'), dark: '#1C1C1E' })
  })
})

describe('the Swift tests state that CI cannot run them (schema.md section 7.4)', () => {
  it('every XCTest file carries the one-sentence header', () => {
    const dir = `${APPLE}/snowraven_widgetsTests`
    const files = readdirSync(new URL(`../../../${dir}`, import.meta.url)).filter(f => f.endsWith('.swift'))
    expect(files.length).toBeGreaterThanOrEqual(7)
    for (const f of files) {
      expect(repo(`${dir}/${f}`).split('\n')[0], f).toBe(
        '// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).',
      )
    }
  })
})
