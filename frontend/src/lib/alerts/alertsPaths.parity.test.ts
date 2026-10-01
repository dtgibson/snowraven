/// <reference types="node" />
// iOS ALERTS, THREE LANGUAGES, ONE SET OF CONSTANTS (ios-alerts, schema.md 3.1,
// 6.1 and 8.2; QA-14, QA-50, NFR-05). The webview's store, the Rust plumbing
// and the Swift alert actor must agree on file names, bounds, rule constants,
// identifiers and the event name; nothing in CI compiles the Swift, so the
// DECLARATIONS are compared to each other here (never restated as a literal:
// testing.md). Each side's enforcement is its own suite's (the XCTests on the
// release machine, `cargo test`, the vitest rows).
//
// Three structural claims ride with it, each read with comments STRIPPED and
// each with a guard-the-guard row:
//   * no Swift in the app target calls an authorization or background-location
//     API (the app's only location prompt stays the geolocation plugin's);
//   * the widget extension never names an alert document;
//   * the Rust module derives no Debug on anything.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import * as S from './alertsState'

const repo = (p: string) => readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8')
const APPLE = 'src-tauri/gen/apple'
const filesSwift = repo(`${APPLE}/Sources/snowraven/AlertsLogic/AlertsFiles.swift`)
const rulesSwift = repo(`${APPLE}/Sources/snowraven/AlertsLogic/AlertRules.swift`)
const alertsRs = repo('src-tauri/src/alerts.rs')

function swiftLet(src: string, name: string): string {
  const m = new RegExp(`static let ${name}(?::[^=]+)? = ([^\\n]+)`).exec(src)
  if (!m) throw new Error(`static let ${name} not found`)
  return m[1]!.trim().replace(/^"|"$/g, '').replace(/_/g, '')
}
function rustConst(name: string): string {
  const m = new RegExp(`pub const ${name}: [^=]+= ([^;]+);`).exec(alertsRs)
  if (!m) throw new Error(`alerts.rs: const ${name} not found`)
  return m[1]!.replace(/"/g, '').replace(/_/g, '')
}

// Swift or Rust source with line comments and block comments removed
// (line-based for the line form, which never appears inside a string these
// files carry).
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
}

function swiftFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(new URL(`../../../../${dir}`, import.meta.url), { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...swiftFiles(`${dir}/${e.name}`))
    else if (e.isFile() && e.name.endsWith('.swift')) out.push(`${dir}/${e.name}`)
  }
  return out
}

describe('the documents and bounds are one declaration on the TypeScript and Swift sides', () => {
  it('the directory and the three file names', () => {
    expect(swiftLet(filesSwift, 'dir')).toBe(S.ALERTS_DIR)
    expect(swiftLet(filesSwift, 'settingsFile')).toBe(S.ALERTS_SETTINGS_FILE)
    expect(swiftLet(filesSwift, 'stateFile')).toBe(S.ALERTS_STATE_FILE)
    expect(swiftLet(filesSwift, 'inboxFile')).toBe(S.ALERTS_INBOX_FILE)
    // The byte bounds are Swift-only (the webview never reads the files); they
    // are present and ordered as the schema sizes them.
    const b = ['settingsMaxBytes', 'stateMaxBytes', 'inboxMaxBytes'].map(n => Number(swiftLet(filesSwift, n)))
    expect(b).toEqual([16384, 262144, 2097152])
  })

  it('the rule constants', () => {
    const pairs: [string, number | string][] = [
      ['dedupeDays', S.ALERT_DEDUPE_DAYS], ['retentionDays', S.ALERT_RETENTION_DAYS], ['maxRows', S.ALERT_INBOX_MAX_ROWS],
      ['positionMaxAgeHours', S.ALERT_POSITION_MAX_AGE_HOURS], ['futureSkewHours', S.ALERT_FUTURE_SKEW_HOURS],
      ['radiusMin', S.ALERT_RADIUS_MIN],
      ['radiusMax', S.ALERT_RADIUS_MAX], ['radiusDefault', S.ALERT_RADIUS_DEFAULT],
      ['quietDefaultStart', S.ALERT_QUIET_DEFAULT.startMin], ['quietDefaultEnd', S.ALERT_QUIET_DEFAULT.endMin],
      ['hourlySeconds', S.ALERT_HOURLY_SECONDS], ['dailySeconds', S.ALERT_DAILY_SECONDS],
      ['notificationPrefix', S.ALERT_NOTIFICATION_PREFIX], ['deferredId', S.ALERT_DEFERRED_ID],
    ]
    for (const [name, v] of pairs) expect(swiftLet(rulesSwift, name), name).toBe(String(v))
  })

  it('the task id and the event name are one value in TypeScript and Rust', () => {
    expect(rustConst('BG_TASK_ID')).toBe(S.BG_TASK_ID)
    expect(rustConst('ALERTS_EVENT')).toBe(S.ALERTS_EVENT)
    const native = readFileSync(new URL('./alertsNative.ts', import.meta.url), 'utf8')
    expect(native).toContain('listen(ALERTS_EVENT')
  })

  it('the five commands are named once on each side', () => {
    const native = readFileSync(new URL('./alertsNative.ts', import.meta.url), 'utf8')
    const lib = repo('src-tauri/src/lib.rs')
    for (const c of ['alerts_snapshot', 'alerts_update_settings', 'alerts_set_enabled', 'alerts_clear_inbox', 'alerts_purge_inbox']) {
      expect(alertsRs).toContain(`pub async fn ${c}(`)
      expect(native).toContain(`'${c}'`)
      expect(lib).toContain(`#[cfg(target_os = "ios")]\n            alerts::ios::${c},`)
    }
    expect(lib).toContain('#[cfg(any(target_os = "ios", test))]\nmod alerts;')
  })

  it('build.rs lets the iOS cdylib leave exactly the three Swift entry points undefined', () => {
    const build = repo('src-tauri/build.rs')
    for (const sym of ['_snowraven_alerts_init', '_snowraven_alerts_call', '_snowraven_alerts_free']) {
      expect(build).toContain(`cargo:rustc-cdylib-link-arg=-Wl,-U,${sym}`)
    }
    const bridge = repo(`${APPLE}/Sources/snowraven/Alerts/AlertsBridge.swift`)
    for (const sym of ['snowraven_alerts_init', 'snowraven_alerts_call', 'snowraven_alerts_free']) {
      expect(bridge).toContain(`@_cdecl("${sym}")`)
    }
  })
})

const FORBIDDEN = [
  'requestAlwaysAuthorization', 'requestWhenInUseAuthorization', 'allowsBackgroundLocationUpdates',
  'startMonitoringSignificantLocationChanges', 'startUpdatingLocation',
]

describe('QA-14: nothing in the app target asks for location authorization or reads location in the background', () => {
  const files = swiftFiles(`${APPLE}/Sources/snowraven`)

  it('is non-vacuous: the alert sources are there, the locator among them', () => {
    expect(files.length).toBeGreaterThanOrEqual(15)
    expect(files.some(f => f.endsWith('Alerts/AlertsLocator.swift'))).toBe(true)
  })

  it.each(FORBIDDEN)('no %s in code (comments stripped)', api => {
    for (const f of files) expect(stripComments(repo(f)).includes(api), f).toBe(false)
  })

  it('guard the guard: the stripper removes a mention in a comment and keeps one in code', () => {
    expect(stripComments('// never calls requestAlwaysAuthorization\nlet x = 1').includes('requestAlwaysAuthorization')).toBe(false)
    expect(stripComments('/* startUpdatingLocation */ let y = 2').includes('startUpdatingLocation')).toBe(false)
    expect(stripComments('m.requestWhenInUseAuthorization() // prompt').includes('requestWhenInUseAuthorization')).toBe(true)
  })

  it('the Rust side reads no location either', () => {
    const rust = stripComments(repo('src-tauri/src/alerts.rs'))
    for (const api of [...FORBIDDEN, 'CLLocationManager', 'geolocation']) expect(rust.includes(api), api).toBe(false)
  })
})

describe('QA-50: the widget extension never opens an alert document, and Rust derives no Debug', () => {
  it('no extension source names alerts/ or the three file names', () => {
    const ext = swiftFiles(`${APPLE}/snowraven_widgets/Sources`)
    expect(ext.length).toBeGreaterThan(15)
    for (const f of ext) {
      const code = stripComments(repo(f))
      for (const s of ['"alerts"', 'alerts/', 'settings.json', 'state.json', 'inbox.json']) expect(code.includes(s), `${f}: ${s}`).toBe(false)
    }
  })

  it('alerts.rs derives Debug on nothing (it holds no document and no key)', () => {
    expect(stripComments(alertsRs)).not.toMatch(/derive\([^)]*Debug/)
    expect(stripComments(alertsRs)).not.toMatch(/(println|eprintln|log::\w+|dbg)!/)
  })

  it('every new XCTest file exists and is covered by the header row (widgetPaths.parity.test.ts)', () => {
    const tests = readdirSync(new URL(`../../../../${APPLE}/snowraven_widgetsTests`, import.meta.url)).filter(f => f.endsWith('.swift'))
    for (const t of [
      'AlertRulesParityTests.swift', 'CountabilityTests.swift', 'AlertDocumentsTests.swift', 'QuietHoursTests.swift',
      'NotificationTextTests.swift', 'AlertLinkTests.swift', 'ResolvePointTests.swift', 'InboxEvictTests.swift',
      'AlertsEngineTests.swift',
    ]) expect(tests, t).toContain(t)
  })
})
