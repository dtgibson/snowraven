/// <reference types="node" />
// THE iOS WIDGET MANIFEST (ios-lifer-widgets FR-20, FR-34, FR-40, FR-47,
// FR-49; QA-20, QA-34, QA-39, QA-40, QA-49).
//
// The widget feature lives in files nothing in CI can build (a Swift extension
// target, Apple plists, entitlements, an xcodegen spec, a vendored Rust crate),
// so what they must agree on is pinned here, in pure JS, on every CI run:
//   * the `snowraven` URL scheme, identical in the three iOS plist sources
//     (the Tauri overlay, the generated plist the build reads, and the xcodegen
//     input), and absent from the macOS bundle;
//   * the When In Use usage string, identical in the same three sources, and
//     naming the widgets;
//   * the extension: a WidgetKit extension point, NSWidgetUsesLocation, iOS
//     17.0 while the app stays on 16.0, embedded by the app, and its version
//     keys build settings stamped from the app's plist, never a literal;
//   * the App Group, the same single id in both entitlement files;
//   * the vendored tao forward that delivers a cold-start widget tap.
//
// Each check is a pure function over file text, run once against the real
// files and once against a one-character mutation of them, so a check that
// silently matches nothing cannot pass (GUARD THE GUARD, QA-49).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parsePlist, yamlBlock, yamlWithoutComments, type PlistValue } from '../test/appleManifest'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

const OVERLAY = 'src-tauri/Info.ios.plist'
const GENERATED = 'src-tauri/gen/apple/snowraven_iOS/Info.plist'
const PROJECT_YML = 'src-tauri/gen/apple/project.yml'
const EXT_PLIST = 'src-tauri/gen/apple/snowraven_widgets/Info.plist'
const APP_ENT = 'src-tauri/gen/apple/snowraven_iOS/snowraven_iOS.entitlements'
const EXT_ENT = 'src-tauri/gen/apple/snowraven_widgets/snowraven_widgets.entitlements'
const TAO_SCENE = 'src-tauri/vendor/tao/src/platform_impl/ios/scene.rs'
const MAC_PLIST = 'src-tauri/Info.plist'
const TAURI_CONF = 'src-tauri/tauri.conf.json'

const APP_GROUP = 'group.com.dtgibson.snowraven'
const SCHEME = 'snowraven'
const USAGE_KEY = 'NSLocationWhenInUseUsageDescription'

type Dict = Record<string, PlistValue>
const dict = (xml: string): Dict => {
  const v = parsePlist(xml)
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('plist root is not a dict')
  return v as Dict
}

// ── Checks (pure; each returns a list of problems, empty when correct) ───────

/** A plist's CFBundleURLTypes is exactly one Viewer entry with exactly the one scheme. */
function urlTypeProblems(xml: string): string[] {
  const d = dict(xml)
  const types = d.CFBundleURLTypes
  if (!Array.isArray(types) || types.length !== 1) return ['CFBundleURLTypes must hold exactly one entry']
  const t = types[0] as Dict
  const out: string[] = []
  if (t.CFBundleTypeRole !== 'Viewer') out.push('CFBundleTypeRole must be Viewer')
  if (t.CFBundleURLName !== 'com.dtgibson.snowraven') out.push('CFBundleURLName must be com.dtgibson.snowraven')
  const schemes = t.CFBundleURLSchemes
  if (!Array.isArray(schemes) || schemes.length !== 1 || schemes[0] !== SCHEME) out.push(`CFBundleURLSchemes must be [${SCHEME}]`)
  return out
}

/** project.yml's app target declares the same single URL type. */
function ymlUrlTypeProblems(yml: string): string[] {
  const block = yamlBlock(yml, 'CFBundleURLTypes').map(l => l.trim())
  const want = ['- CFBundleTypeRole: Viewer', 'CFBundleURLName: com.dtgibson.snowraven', `CFBundleURLSchemes: [${SCHEME}]`]
  return JSON.stringify(block) === JSON.stringify(want) ? [] : [`project.yml CFBundleURLTypes block is ${JSON.stringify(block)}`]
}

function ymlUsageString(yml: string): string | null {
  const line = yamlWithoutComments(yml).split('\n').find(l => new RegExp(`^\\s*${USAGE_KEY}:`).test(l))
  return line ? line.slice(line.indexOf(':') + 1).trim() : null
}

/** The extension's plist: WidgetKit point, NSWidgetUsesLocation, version keys that cannot drift from the app's, no usage keys. */
function extensionPlistProblems(xml: string, appXml: string = generated): string[] {
  const d = dict(xml)
  const app = dict(appXml)
  const out: string[] = []
  const ext = d.NSExtension as Dict | undefined
  if (!ext || ext.NSExtensionPointIdentifier !== 'com.apple.widgetkit-extension') out.push('not a WidgetKit extension')
  if (d.NSWidgetUsesLocation !== true) out.push('NSWidgetUsesLocation must be true')
  // The build phase sets the SHIPPED values from the app plist; this file may
  // hold the build-setting form, or (after a `tauri ios build --build-number`
  // stamp) the app's own value, and never anything that differs from it.
  if (d.CFBundleShortVersionString !== '$(MARKETING_VERSION)' && d.CFBundleShortVersionString !== app.CFBundleShortVersionString) {
    out.push('CFBundleShortVersionString must be $(MARKETING_VERSION) or equal the app plist')
  }
  if (d.CFBundleVersion !== '$(CURRENT_PROJECT_VERSION)' && d.CFBundleVersion !== app.CFBundleVersion) {
    out.push('CFBundleVersion must be $(CURRENT_PROJECT_VERSION) or equal the app plist')
  }
  for (const k of Object.keys(d)) if (/UsageDescription$/.test(k)) out.push(`the extension must not declare ${k}`)
  return out
}

/** project.yml: the extension target, its 17.0 target, the app's 16.0, the embed and the version stamp. */
function projectProblems(yml: string): string[] {
  const out: string[] = []
  const ext = yamlBlock(yml, 'snowraven_widgets').map(l => l.trim())
  if (!ext.includes('type: app-extension')) out.push('snowraven_widgets must be type app-extension')
  if (!ext.includes('deploymentTarget: "17.0"')) out.push('snowraven_widgets must target iOS "17.0"')
  if (!ext.includes('PRODUCT_BUNDLE_IDENTIFIER: com.dtgibson.snowraven.widgets')) out.push('the extension bundle id')
  if (!ext.includes('INFOPLIST_FILE: snowraven_widgets/Info.plist')) out.push('the hand-maintained extension plist')
  if (!ext.includes('CODE_SIGN_ENTITLEMENTS: snowraven_widgets/snowraven_widgets.entitlements')) out.push('the extension entitlements')
  if (ext.some(l => l.startsWith('groups:'))) out.push('the extension must not take the app settings group')
  const stamp = ext.join('\n')
  if (!stamp.includes('SRC="${SRCROOT}/snowraven_iOS/Info.plist"')
    || !stamp.includes('Add :CFBundleShortVersionString string $V')
    || !stamp.includes('Add :CFBundleVersion string $B')) out.push('the version stamp from the app plist')
  const options = yamlBlock(yml, 'deploymentTarget').map(l => l.trim())
  if (!options.includes('iOS: 16.0')) out.push('the app deployment target must stay 16.0')
  const app = yamlBlock(yml, 'snowraven_iOS').join('\n')
  if (!/- target: snowraven_widgets\n\s+embed: true/.test(app)) out.push('the app must embed snowraven_widgets')
  // xcodegen REWRITES a file named by an `entitlements:` key from its
  // `properties`; with none it wrote an empty dict over the app's entitlements,
  // dropping iCloud Sync and the App Group. Both targets name their file
  // through CODE_SIGN_ENTITLEMENTS instead, which xcodegen never writes.
  if (/^\s*entitlements:/m.test(yamlWithoutComments(yml))) out.push('no target may use the xcodegen entitlements: key')
  if (!app.includes('CODE_SIGN_ENTITLEMENTS: snowraven_iOS/snowraven_iOS.entitlements')) out.push('the app entitlements setting')
  return out
}

function appGroups(xml: string): PlistValue | undefined {
  return dict(xml)['com.apple.security.application-groups']
}

/** Rust source with // comments removed (so the forward cannot be satisfied by prose). */
function stripRustComments(src: string): string {
  return src.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
}

/** The cold-start forward sits inside scene_willConnectToSession_options and emits Opened. */
function taoForwardProblems(src: string): string[] {
  const code = stripRustComments(src)
  const start = code.indexOf('fn scene_willConnectToSession_options(')
  const end = code.indexOf('#[unsafe(method(sceneDidDisconnect:))]', start)
  if (start < 0 || end < 0) return ['scene_willConnectToSession_options not found']
  const body = code.slice(start, end)
  const out: string[] = []
  if (!body.includes('app_state::connect_scene(scene, connection_options);')) out.push('the upstream connect_scene call')
  if (!/let contexts: Option<Retained<NSSet<UIOpenURLContext>>> =\s*objc2::msg_send!\[connection_options, URLContexts\];/.test(body)) {
    out.push('the Option-typed URLContexts read')
  }
  // The generated binding declares a non-optional return and panics on the
  // nil UIKit returns for an ordinary launch: an abort on EVERY launch,
  // measured. Never call it here.
  if (body.includes('.URLContexts()')) out.push('the crashing URLContexts() binding')
  if (!body.includes('Event::Opened { urls }')) out.push('the Event::Opened emit')
  if (body.includes('SceneRequested')) out.push('the forward must never emit SceneRequested')
  return out
}

// ── The real files ───────────────────────────────────────────────────────────

const overlay = read(OVERLAY)
const generated = read(GENERATED)
const yml = read(PROJECT_YML)

describe('the URL scheme (FR-34, QA-34)', () => {
  it.each([[OVERLAY, overlay], [GENERATED, generated]])('%s declares exactly the snowraven scheme', (_n, xml) => {
    expect(urlTypeProblems(xml)).toEqual([])
  })

  it('project.yml declares the same, so a regeneration keeps it', () => {
    expect(ymlUrlTypeProblems(yml)).toEqual([])
  })

  it('the two plists carry byte-equal URL types, so the overlay merge is a no-op', () => {
    expect(dict(overlay).CFBundleURLTypes).toEqual(dict(generated).CFBundleURLTypes)
  })

  it('the macOS bundle registers no scheme and no deep-link plugin (QA-39)', () => {
    expect(dict(read(MAC_PLIST)).CFBundleURLTypes).toBeUndefined()
    const conf = JSON.parse(read(TAURI_CONF)) as { plugins?: Record<string, unknown>; bundle?: { macOS?: Record<string, unknown> } }
    expect(conf.plugins?.['deep-link']).toBeUndefined()
    expect(JSON.stringify(conf.bundle?.macOS ?? {})).not.toContain(SCHEME + '://')
  })
})

describe('the location usage string (FR-20, QA-20)', () => {
  it('is identical in all three iOS sources and names the widgets', () => {
    const a = dict(overlay)[USAGE_KEY]
    const b = dict(generated)[USAGE_KEY]
    const c = ymlUsageString(yml)
    expect(typeof a).toBe('string')
    expect(b).toBe(a)
    expect(c).toBe(a)
    expect(a as string).toMatch(/widget/)
    expect(a as string).not.toContain('—')
  })
})

describe('the extension target (FR-40, FR-47, QA-40)', () => {
  it('is a WidgetKit extension that rides the app location grant and stamps its version from the app', () => {
    expect(extensionPlistProblems(read(EXT_PLIST))).toEqual([])
  })

  it('accepts a CFBundleVersion stamped EQUAL to the app plist (what tauri ios build --build-number writes)', () => {
    const appBuild = dict(generated).CFBundleVersion as string
    expect(extensionPlistProblems(read(EXT_PLIST).replace('$(CURRENT_PROJECT_VERSION)', appBuild))).toEqual([])
  })

  it('targets iOS 17.0 while the app and the Tauri config stay on 16.0, and the app embeds it', () => {
    expect(projectProblems(yml)).toEqual([])
    const conf = JSON.parse(read(TAURI_CONF)) as { bundle: { iOS: { minimumSystemVersion: string } } }
    expect(conf.bundle.iOS.minimumSystemVersion).toBe('16.0')
  })

  it('project.yml still declares no version keys (the one-source rule survives the new target)', () => {
    const bare = yamlWithoutComments(yml)
    expect(bare).not.toMatch(/^\s*CFBundleShortVersionString:/m)
    expect(bare).not.toMatch(/^\s*CFBundleVersion:/m)
  })
})

describe('the App Group (FR-47, QA-49)', () => {
  it('both entitlement files carry exactly the one group', () => {
    expect(appGroups(read(APP_ENT))).toEqual([APP_GROUP])
    expect(appGroups(read(EXT_ENT))).toEqual([APP_GROUP])
  })

  it('the extension carries nothing else, and the app keeps its three iCloud keys', () => {
    expect(Object.keys(dict(read(EXT_ENT)))).toEqual(['com.apple.security.application-groups'])
    expect(Object.keys(dict(read(APP_ENT))).sort()).toEqual([
      'com.apple.developer.icloud-container-identifiers', 'com.apple.developer.icloud-services',
      'com.apple.developer.ubiquity-container-identifiers', 'com.apple.security.application-groups',
    ])
  })
})

describe('the vendored cold-start forward (schema.md section 4.3)', () => {
  it('scene_willConnectToSession_options forwards the launching URLs as Event::Opened', () => {
    expect(taoForwardProblems(read(TAO_SCENE))).toEqual([])
  })
})

// ── GUARD THE GUARD: one-character mutations must be caught ─────────────────

describe('each check goes red on a one-character mutation of its source (QA-49)', () => {
  const extPlist = read(EXT_PLIST)
  const tao = read(TAO_SCENE)
  const cases: [string, () => string[] | boolean][] = [
    ['overlay scheme', () => urlTypeProblems(overlay.replace('<string>snowraven</string>', '<string>snowravex</string>'))],
    ['generated scheme', () => urlTypeProblems(generated.replace('<string>snowraven</string>', '<string>snowravem</string>'))],
    ['yml scheme', () => ymlUrlTypeProblems(yml.replace('CFBundleURLSchemes: [snowraven]', 'CFBundleURLSchemes: [snowravem]'))],
    ['usage string', () => ymlUsageString(yml.replace('home-screen widgets.', 'home-screen widgets!')) === dict(overlay)[USAGE_KEY]],
    ['extension point', () => extensionPlistProblems(extPlist.replace('com.apple.widgetkit-extension', 'com.apple.widgetkit-extensiom'))],
    ['widget location flag', () => extensionPlistProblems(extPlist.replace(/<key>NSWidgetUsesLocation<\/key>\s*<true\/>/, '<key>NSWidgetUsesLocation</key><false/>'))],
    // Pins its own app version, like the row below: against the LIVE app plist a
    // fixed literal stops leading the moment a ship stamps that version (1.0.36).
    ['literal version that leads the app', () => extensionPlistProblems(extPlist.replace('$(MARKETING_VERSION)', '1.0.36'), generated.replace(/(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*/, '$11.0.35'))],
    ['stamped build number that differs from the app', () => extensionPlistProblems(extPlist.replace('$(CURRENT_PROJECT_VERSION)', '1.0.35.2'), generated.replace(/(<key>CFBundleVersion<\/key>\s*<string>)[^<]*/, '$11.0.35.1'))],
    ['extension target 17.0', () => projectProblems(yml.replace('deploymentTarget: "17.0"', 'deploymentTarget: "16.0"'))],
    ['app target 16.0', () => projectProblems(yml.replace('iOS: 16.0', 'iOS: 17.0'))],
    ['embed', () => projectProblems(yml.replace(/- target: snowraven_widgets\n(\s+)embed: true/, '- target: snowraven_widgets\n$1embed: false'))],
    ['version stamp', () => projectProblems(yml.replace('Add :CFBundleVersion string $B', 'Add :CFBundleVersion string 1'))],
    ['xcodegen entitlements key', () => projectProblems(yml.replace('    scheme:\n      environmentVariables:', '    entitlements:\n      path: snowraven_iOS/snowraven_iOS.entitlements\n    scheme:\n      environmentVariables:'))],
    ['app group', () => JSON.stringify(appGroups(read(APP_ENT).replace(APP_GROUP, 'group.com.dtgibson.snowravem'))) === JSON.stringify([APP_GROUP])],
    ['tao forward removed', () => taoForwardProblems(tao.replace('connection_options, URLContexts]', 'connection_options, URLContextz]'))],
    ['tao crashing binding', () => taoForwardProblems(tao.replace('let urls: Vec<url::Url> = contexts', 'let _c = connection_options.URLContexts();\n        let urls: Vec<url::Url> = contexts'))],
    ['tao forward commented out', () => taoForwardProblems(tao.replace(/(\n\s*)(app_state::handle_nonuser_event\(EventWrapper::StaticEvent\(Event::Opened \{ urls \}\)\);)/, '$1// $2'))],
  ]
  it.each(cases)('%s', (_name, run) => {
    const r = run()
    if (typeof r === 'boolean') expect(r).toBe(false)
    else expect(r.length, 'the mutation must produce at least one problem').toBeGreaterThan(0)
  })

  it('the mutations actually change the text they claim to (no silent no-op)', () => {
    expect(overlay.replace('<string>snowraven</string>', '<string>snowravex</string>')).not.toBe(overlay)
    expect(yml.replace('deploymentTarget: "17.0"', 'deploymentTarget: "16.0"')).not.toBe(yml)
    expect(read(EXT_PLIST).replace('$(MARKETING_VERSION)', '1.0.36')).not.toBe(read(EXT_PLIST))
    expect(read(TAO_SCENE).replace('connection_options, URLContexts]', 'connection_options, URLContextz]')).not.toBe(read(TAO_SCENE))
  })
})
