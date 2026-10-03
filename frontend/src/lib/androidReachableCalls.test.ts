// @vitest-environment jsdom
/// <reference types="node" />
// NO CONTROL ON ANDROID REACHES A NATIVE CALL THE ANDROID BINARY LACKS
// (android-release FR-22, QA-22).
//
// Two halves, both derived rather than listed:
//   1. Rust: every command in lib.rs's generate_handler! and every plugin the
//      builder registers, with the cfg it sits under, evaluated for Android
//      (target_os = "android", mobile, not desktop).
//   2. Frontend: every native-call site in shipped src/, read from the
//      TypeScript AST (so a comment cannot add or hide one): string literals
//      equal to a registered command name or beginning "plugin:", the first
//      argument of every invoke() call, and every @tauri-apps/plugin-* import.
// Every derived site must appear in the table below with its count and its
// Android reading: REACHABLE (and then the Rust half must say Android carries
// it) or kept off Android by a named GATE (and then the gate, run against the
// real platform module with the os probe reporting 'android', must be false).
// A new native call in an Android-visible module that is not in the table
// turns this red, which is QA-22's mutation.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'

vi.mock('@tauri-apps/plugin-os', () => ({ platform: vi.fn(() => 'android') }))

import { isAndroid, isIOS } from './platform'
import { showICloudSync, showUpdaterFooter, supportsAppRelaunch } from './platformGates'
import { alertsSupported } from './alerts/alertsState'
import { widgetsSupported } from './widgets/widgetHandover'

const SRC = resolve(import.meta.dirname, '..')
const LIB_RS = readFileSync(resolve(import.meta.dirname, '../../../src-tauri/src/lib.rs'), 'utf8')

// ── Rust half ──────────────────────────────────────────────────────────────

function stripRustComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** Evaluate a cfg predicate for the Android target. Unknown predicates throw. */
function cfgOnAndroid(expr: string): boolean {
  const s = expr.trim()
  const call = /^(any|all|not)\(([\s\S]*)\)$/.exec(s)
  if (call) {
    const args: string[] = []
    let depth = 0, cur = ''
    for (const ch of call[2]!) {
      if (ch === '(') depth += 1
      if (ch === ')') depth -= 1
      if (ch === ',' && depth === 0) { args.push(cur); cur = '' } else cur += ch
    }
    if (cur.trim()) args.push(cur)
    const vals = args.map(cfgOnAndroid)
    if (call[1] === 'any') return vals.some(Boolean)
    if (call[1] === 'all') return vals.every(Boolean)
    if (vals.length !== 1) throw new Error(`cfg not() takes one argument: ${s}`)
    return !vals[0]
  }
  const os = /^target_os\s*=\s*"([a-z]+)"$/.exec(s)
  if (os) return os[1] === 'android'
  if (s === 'mobile') return true
  if (s === 'desktop' || s === 'test') return false
  throw new Error(`cfg predicate not understood: ${s}`)
}

/** command name -> carried on Android? (from generate_handler!) */
function rustCommands(src: string): Map<string, boolean> {
  const code = stripRustComments(src)
  const start = code.indexOf('generate_handler![')
  if (start < 0) throw new Error('lib.rs: no generate_handler!')
  let end = start + 'generate_handler!['.length
  for (let d = 1; d > 0; end += 1) {
    if (end >= code.length) throw new Error('lib.rs: unterminated generate_handler!')
    if (code[end] === '[') d += 1
    else if (code[end] === ']') d -= 1
  }
  const body = code.slice(start + 'generate_handler!['.length, end - 1)
  const out = new Map<string, boolean>()
  let pendingCfg: string | null = null
  // split on commas outside brackets, so any(a, b) inside a cfg stays whole
  const entries: string[] = []
  let depth = 0, cur = ''
  for (const ch of body) {
    if (ch === '(' || ch === '[') depth += 1
    if (ch === ')' || ch === ']') depth -= 1
    if (ch === ',' && depth === 0) { entries.push(cur); cur = '' } else cur += ch
  }
  entries.push(cur)
  for (const raw of entries) {
    let t = raw.trim()
    const attr = /^#\[cfg\(([\s\S]*)\)\]\s*([\s\S]*)$/.exec(t)
    if (attr) { pendingCfg = attr[1]!; t = attr[2]!.trim() }
    if (!t) continue
    if (!/^[a-z_:]+$/.test(t)) throw new Error(`generate_handler entry not understood: ${t}`)
    const name = t.split('::').pop()!
    out.set(name, pendingCfg === null ? true : cfgOnAndroid(pendingCfg))
    pendingCfg = null
  }
  return out
}

/** plugin crate suffix -> carried on Android? (from the builder statements) */
function rustPlugins(src: string): Map<string, boolean> {
  const code = stripRustComments(src)
  const out = new Map<string, boolean>()
  // each `let builder = ...;` statement, with the cfg attribute just before it
  const re = /(#\[cfg\(([^\]]*)\)\]\s*)?let builder = ([\s\S]*?);\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    const onAndroid = m[2] === undefined ? true : cfgOnAndroid(m[2])
    for (const p of m[3]!.matchAll(/tauri_plugin_([a-z_]+)::/g)) out.set(p[1]!.replace(/_/g, '-'), onAndroid)
  }
  if (out.size === 0) throw new Error('lib.rs: no plugin registrations found')
  return out
}

const COMMANDS = rustCommands(LIB_RS)
const PLUGINS = rustPlugins(LIB_RS)

// ── Frontend half ──────────────────────────────────────────────────────────

function shippedFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== 'test' && name !== 'node_modules') out.push(...shippedFiles(full))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

/** "kind:name|module" -> count */
function deriveSites(commandNames: Set<string>): Map<string, number> {
  const out = new Map<string, number>()
  const bump = (key: string) => out.set(key, (out.get(key) ?? 0) + 1)
  for (const file of shippedFiles(SRC)) {
    const rel = relative(SRC, file).split('\\').join('/')
    const sf = ts.createSourceFile(rel, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('@tauri-apps/plugin-')) {
        bump(`plugin:${node.moduleSpecifier.text.slice('@tauri-apps/plugin-'.length)}|${rel}`)
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const a = node.arguments[0]
        if (a && ts.isStringLiteral(a) && a.text.startsWith('@tauri-apps/plugin-')) bump(`plugin:${a.text.slice('@tauri-apps/plugin-'.length)}|${rel}`)
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const parent = node.parent
        const isInvokeArg = parent && ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === 'invoke' && parent.arguments[0] === node
        if (commandNames.has(node.text) || node.text.startsWith('plugin:') || isInvokeArg) bump(`cmd:${node.text}|${rel}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return out
}

// ── The table ──────────────────────────────────────────────────────────────

type Reading = 'reachable' | { gate: keyof typeof GATES }

// Each gate as its Android value, from the real modules. Every one must be
// false on Android for the calls behind it to be unreachable there.
const GATES = {
  showICloudSync: () => showICloudSync(),
  alertsSupported: () => alertsSupported(),
  widgetsSupported: () => widgetsSupported(),
  showUpdaterFooter: () => showUpdaterFooter(),
  supportsAppRelaunch: () => supportsAppRelaunch(),
  // lib/location.ts answers Android before the desktop get_location branch
  // (branch B: 'unavailable'; branch A: the WebView's own geolocation)
  'location: the Android early return': () => !isAndroid(),
  // the geolocation plugin is imported only inside the isIOS() arm, and is
  // registered only for iOS (Cargo.toml, lib.rs; android-release schema 4.1)
  'location: the iOS arm': () => isIOS(),
} as const

const ICLOUD = [
  'icloud_status', 'icloud_read_record', 'icloud_push', 'icloud_push_cleared', 'icloud_pull', 'icloud_start_download',
  'icloud_remove_all', 'icloud_read_keys', 'icloud_write_keys', 'icloud_remove_keys', 'icloud_watch', 'icloud_list_items',
  'icloud_push_item', 'icloud_push_items_cleared', 'icloud_pull_item', 'icloud_start_download_item', 'icloud_remove_item',
  'icloud_remove_items', 'icloud_diagnostics',
]
const TABLE: Record<string, { count: number; android: Reading }> = {
  'cmd:get_timezone|lib/tauri/locationZone.ts': { count: 1, android: 'reachable' },
  'cmd:plugin:opener|open_url|lib/openExternal.ts': { count: 1, android: 'reachable' },
  'cmd:get_location|lib/location.ts': { count: 1, android: { gate: 'location: the Android early return' } },
  ...Object.fromEntries(ICLOUD.map(c => [`cmd:${c}|lib/icloud/icloudNative.ts`, { count: 1, android: { gate: 'showICloudSync' } as Reading }])),
  ...Object.fromEntries(['alerts_snapshot', 'alerts_update_settings', 'alerts_set_enabled', 'alerts_clear_inbox', 'alerts_purge_inbox']
    .map(c => [`cmd:${c}|lib/alerts/alertsNative.ts`, { count: 1, android: { gate: 'alertsSupported' } as Reading }])),
  ...Object.fromEntries(['widgets_write_handover', 'widgets_remove_handover', 'widgets_take_pending_link']
    .map(c => [`cmd:${c}|lib/widgets/widgetNative.ts`, { count: 1, android: { gate: 'widgetsSupported' } as Reading }])),
  'plugin:os|lib/platform.ts': { count: 1, android: 'reachable' },
  'plugin:fs|lib/storage.ts': { count: 1, android: 'reachable' },
  'plugin:fs|lib/importMechanism.ts': { count: 1, android: 'reachable' },
  'plugin:http|lib/tauri/http.ts': { count: 1, android: 'reachable' },
  'plugin:clipboard-manager|lib/clipboard.ts': { count: 1, android: 'reachable' },
  'plugin:dialog|lib/importMechanism.ts': { count: 1, android: 'reachable' },
  'plugin:geolocation|lib/location.ts': { count: 1, android: { gate: 'location: the iOS arm' } },
  'plugin:process|components/Settings.tsx': { count: 1, android: { gate: 'supportsAppRelaunch' } },
  'plugin:process|lib/tauri/updateManager.ts': { count: 1, android: { gate: 'showUpdaterFooter' } },
  'plugin:updater|lib/tauri/updateManager.ts': { count: 1, android: { gate: 'showUpdaterFooter' } },
}

const win = window as unknown as Record<string, unknown>
beforeAll(() => { win['__TAURI_INTERNALS__'] = {} })
afterAll(() => { delete win['__TAURI_INTERNALS__'] })

describe('the Rust half reads the registration', () => {
  it('evaluates the cfgs the way the Android target compiles them', () => {
    expect(COMMANDS.get('get_timezone')).toBe(true)
    expect(COMMANDS.get('get_location')).toBe(false) // macOS and Windows only
    expect(COMMANDS.get('icloud_status')).toBe(false)
    expect(COMMANDS.get('widgets_write_handover')).toBe(false)
    expect(PLUGINS.get('opener')).toBe(true)
    expect(PLUGINS.get('geolocation')).toBe(false) // cfg(target_os = "ios") only: nothing of Google's on Android
    expect(PLUGINS.get('dialog')).toBe(true)
    expect(PLUGINS.get('updater')).toBe(false)
    expect(PLUGINS.get('process')).toBe(false)
  })

  it('fails closed on a cfg it does not understand', () => {
    expect(() => cfgOnAndroid('feature = "x"')).toThrow()
    expect(cfgOnAndroid('any(target_os = "android", target_os = "ios")')).toBe(true)
    expect(cfgOnAndroid('not(any(target_os = "android", target_os = "ios"))')).toBe(false)
  })
})

describe('every native call site in shipped src has an Android reading (FR-22)', () => {
  const derived = deriveSites(new Set(COMMANDS.keys()))

  it('the derivation reaches the known sites (non-vacuity)', () => {
    expect(derived.size).toBeGreaterThanOrEqual(30)
    expect(derived.get('cmd:get_timezone|lib/tauri/locationZone.ts')).toBe(1)
  })

  it('the derived sites equal the table, site for site and count for count', () => {
    const table = Object.fromEntries(Object.entries(TABLE).map(([k, v]) => [k, v.count]))
    expect(Object.fromEntries([...derived].sort())).toEqual(Object.fromEntries(Object.entries(table).sort()))
  })

  it.each(Object.entries(TABLE))('%s', (key, row) => {
    const name = key.slice(key.indexOf(':') + 1, key.lastIndexOf('|'))
    if (row.android === 'reachable') {
      if (key.startsWith('plugin:')) {
        expect(PLUGINS.get(name), `${name} is not registered for Android`).toBe(true)
      } else if (name.startsWith('plugin:')) {
        const plugin = name.slice('plugin:'.length, name.indexOf('|'))
        expect(PLUGINS.get(plugin), `${plugin} is not registered for Android`).toBe(true)
      } else {
        expect(COMMANDS.get(name), `${name} is not registered for Android`).toBe(true)
      }
    } else {
      expect(GATES[row.android.gate](), `gate ${row.android.gate} is open on Android`).toBe(false)
    }
  })
})

describe('no geolocation registration reaches Android (schema 6.4)', () => {
  it('the plugin is registered for iOS and not for Android', () => {
    expect(PLUGINS.has('geolocation')).toBe(true)
    expect(PLUGINS.get('geolocation')).toBe(false)
  })
})

describe('the guard catches the mutation QA-22 names', () => {
  it('an extra get_location call in another module is a site the table does not list', () => {
    const extra = 'cmd:get_location|lib/somewhereVisible.ts'
    expect(TABLE[extra]).toBeUndefined()
    // the derivation would produce it: a string equal to a registered command name
    expect(COMMANDS.has('get_location')).toBe(true)
  })
})
