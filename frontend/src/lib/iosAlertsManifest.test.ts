/// <reference types="node" />
// THE iOS ALERTS MANIFEST (ios-alerts, schema.md 8.2 and 9; FR-15, QA-14,
// QA-50; NFR-03). What the background check needs from the iOS project lives
// in files nothing in CI can build (three plist sources, an xcodegen spec,
// entitlements), so it is pinned here in pure JS on every CI run (ubuntu has no
// plutil):
//   * UIBackgroundModes is EXACTLY [fetch] in all three plist sources: no
//     `location` (the feature never reads location in the background, FR-15)
//     and no `remote-notification` (there is no push);
//   * BGTaskSchedulerPermittedIdentifiers is exactly the one task id, which is
//     ONE value across the plists, alertsState.ts, alerts.rs and the Swift
//     scheduler (compared, never restated);
//   * no Always-location usage key anywhere, and no aps-environment
//     entitlement anywhere (a push entitlement would be a claim the privacy
//     copy does not make);
//   * project.yml's app target compiles the widget Logic and the eBird client
//     (named through the one widget Sources directory, narrowed by `includes`,
//     never as paths nested under it, which made two groups own each and
//     Xcode report a malformed project) and links the three frameworks, and
//     the test target compiles
//     AlertsLogic with the parity fixture as a resource;
//   * the widget extension's plist and both entitlement files are byte-for-byte
//     what they were before this feature (a snapshot row, since "no change to
//     the widgets" is a claim).
// Each check is a pure function over file text, run against the real files and
// against a one-character mutation, so a check that matches nothing cannot pass.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parsePlist, yamlBlock, yamlWithoutComments, type PlistValue } from '../test/appleManifest'
import { BG_TASK_ID } from './alerts/alertsState'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
const PLISTS = ['src-tauri/Info.ios.plist', 'src-tauri/gen/apple/snowraven_iOS/Info.plist']
const PROJECT_YML = 'src-tauri/gen/apple/project.yml'
const ENTITLEMENTS = [
  'src-tauri/gen/apple/snowraven_iOS/snowraven_iOS.entitlements',
  'src-tauri/gen/apple/snowraven_widgets/snowraven_widgets.entitlements',
]

type Dict = Record<string, PlistValue>
const dict = (xml: string): Dict => {
  const v = parsePlist(xml)
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('plist root is not a dict')
  return v as Dict
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function plistProblems(xml: string): string[] {
  const d = dict(xml)
  const out: string[] = []
  if (!same(d.UIBackgroundModes, ['fetch'])) out.push(`UIBackgroundModes is ${JSON.stringify(d.UIBackgroundModes)}`)
  if (!same(d.BGTaskSchedulerPermittedIdentifiers, [BG_TASK_ID])) {
    out.push(`BGTaskSchedulerPermittedIdentifiers is ${JSON.stringify(d.BGTaskSchedulerPermittedIdentifiers)}`)
  }
  for (const k of ['NSLocationAlwaysUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription']) {
    if (k in d) out.push(`${k} must not exist`)
  }
  return out
}

function ymlProblems(yml: string): string[] {
  const out: string[] = []
  const props = yamlBlock(yml, 'properties').map(l => l.trim())
  if (!props.includes('UIBackgroundModes: [fetch]')) out.push('project.yml: UIBackgroundModes: [fetch] missing')
  if (!props.includes(`BGTaskSchedulerPermittedIdentifiers: [${BG_TASK_ID}]`)) out.push('project.yml: the task id missing')
  if (props.some(l => /^UIBackgroundModes:/.test(l) && l !== 'UIBackgroundModes: [fetch]')) out.push('project.yml: a second mode')
  const code = yamlWithoutComments(yml)
  const app = code.slice(code.indexOf('  snowraven_iOS:'), code.indexOf('  snowraven_widgets:'))
  if (!/- path: snowraven_widgets\/Sources\s*\n\s*includes:\s*\n\s*- Logic\/\*\*\s*\n\s*- Widget\/EBirdClient\.swift\s*\n/.test(app)) {
    out.push('app target: the widget Sources narrowed to Logic/** and Widget/EBirdClient.swift missing')
  }
  // A path nested under a directory the extension target also lists gives the
  // nested group two parents: Xcode then reports the project as malformed.
  if (/- path: snowraven_widgets\/Sources\//.test(app)) out.push('app target: a path nested under snowraven_widgets/Sources')
  for (const need of [
    '- sdk: BackgroundTasks.framework', '- sdk: UserNotifications.framework', '- sdk: CoreLocation.framework',
  ]) if (!app.includes(need)) out.push(`app target: ${need} missing`)
  const tests = code.slice(code.indexOf('  snowraven_widgetsTests:'))
  if (!tests.includes('- path: Sources/snowraven/AlertsLogic')) out.push('test target: AlertsLogic missing')
  if (!/- path: \.\.\/\.\.\/\.\.\/frontend\/src\/lib\/alerts\/alertRules\.fixture\.json\s*\n\s*buildPhase: resources/.test(tests)) {
    out.push('test target: the alert fixture resource missing')
  }
  // The widget extension target gains nothing: no alerts source, no mode.
  const ext = code.slice(code.indexOf('  snowraven_widgets:'), code.indexOf('  snowraven_widgetsTests:'))
  if (/Alerts|UIBackgroundModes|BackgroundTasks|UserNotifications/.test(ext)) out.push('extension target touched')
  return out
}

function entitlementProblems(xml: string): string[] {
  return /aps-environment/.test(xml) ? ['aps-environment present'] : []
}

describe('the three plist sources declare the one background mode and the one task id', () => {
  it.each(PLISTS)('%s', p => {
    expect(plistProblems(read(p))).toEqual([])
  })
  it('project.yml', () => {
    expect(ymlProblems(read(PROJECT_YML))).toEqual([])
  })
  it('the two plist sources are identical in these keys (one declaration, three files)', () => {
    const [a, b] = PLISTS.map(p => dict(read(p)))
    expect(a!.UIBackgroundModes).toEqual(b!.UIBackgroundModes)
    expect(a!.BGTaskSchedulerPermittedIdentifiers).toEqual(b!.BGTaskSchedulerPermittedIdentifiers)
  })
})

describe('the task id is one value across the webview, Rust, Swift and the plists', () => {
  it('compared, not restated', () => {
    const rust = read('src-tauri/src/alerts.rs')
    const swift = read('src-tauri/gen/apple/Sources/snowraven/Alerts/AlertsScheduler.swift')
    expect(/pub const BG_TASK_ID: &str = "([^"]+)";/.exec(rust)?.[1]).toBe(BG_TASK_ID)
    expect(/static let taskId = "([^"]+)"/.exec(swift)?.[1]).toBe(BG_TASK_ID)
    for (const p of PLISTS) expect((dict(read(p)).BGTaskSchedulerPermittedIdentifiers as string[])[0]).toBe(BG_TASK_ID)
  })
})

describe('no push, and the widget extension is untouched', () => {
  it.each(ENTITLEMENTS)('%s carries no aps-environment', p => {
    expect(entitlementProblems(read(p))).toEqual([])
  })

  it('the extension plist and both entitlement files are byte-identical to before this feature (snapshot)', () => {
    const sha = (p: string) => createHash('sha256').update(readFileSync(new URL(`../../../${p}`, import.meta.url))).digest('hex')
    expect(sha('src-tauri/gen/apple/snowraven_widgets/Info.plist')).toBe('fce78bfcced7e9ad76ffe131f8518dc67981277f019051e4e7e8a724221d67c7')
    expect(sha(ENTITLEMENTS[1]!)).toBe('36b8bdc903ad13dc51945fa721637436381ddd26665d5a8efaebb51013de8bc9')
    expect(sha(ENTITLEMENTS[0]!)).toBe('6b7673cd778e67477d03ccd743d8d7160a81728b3da79955bb1dfc7ea976bb79')
  })
})

describe('guard the guard: each check fails on a one-character mutation', () => {
  it('the plist check', () => {
    const xml = read(PLISTS[0]!)
    expect(plistProblems(xml.replace('<string>fetch</string>', '<string>fetcH</string>'))).not.toEqual([])
    expect(plistProblems(xml.replace('<string>fetch</string>', '<string>fetch</string><string>location</string>'))).not.toEqual([])
    expect(plistProblems(xml.replace(BG_TASK_ID, BG_TASK_ID + 'x'))).not.toEqual([])
    expect(plistProblems(xml.replace('<dict>', '<dict><key>NSLocationAlwaysAndWhenInUseUsageDescription</key><string>x</string>'))).not.toEqual([])
  })
  it('the project.yml check', () => {
    const yml = read(PROJECT_YML)
    expect(ymlProblems(yml.replace('UIBackgroundModes: [fetch]', 'UIBackgroundModes: [fetcH]'))).not.toEqual([])
    expect(ymlProblems(yml.replace('- sdk: BackgroundTasks.framework', '- sdk: BackgroundTask.framework'))).not.toEqual([])
    expect(ymlProblems(yml.replace('- path: Sources/snowraven/AlertsLogic', '- path: Sources/snowraven/AlertLogic'))).not.toEqual([])
    expect(ymlProblems(yml.replace('- Widget/EBirdClient.swift', '- Widget/EBirdClient.swifT'))).not.toEqual([])
    // The two nested paths this build first used (the malformed-project form).
    expect(ymlProblems(yml.replace(/- path: snowraven_widgets\/Sources\n(\s*)includes:[\s\S]*?EBirdClient\.swift\n/,
      '- path: snowraven_widgets/Sources/Logic\n$1- path: snowraven_widgets/Sources/Widget/EBirdClient.swift\n'))).not.toEqual([])
  })
  it('the entitlement check', () => {
    expect(entitlementProblems(read(ENTITLEMENTS[0]!).replace('<dict>', '<dict><key>aps-environment</key><string>production</string>'))).not.toEqual([])
  })
})
