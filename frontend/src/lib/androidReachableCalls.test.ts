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
//
// The same two halves also hold the command registry complete in both
// directions (security-bloat-deps-and-tests-cleanup, which removed three
// keychain commands that had been registered with no caller since v0.3.16):
// every #[tauri::command] function under src-tauri/src is in generate_handler!
// (by module path), and every registered command has a caller by string in
// shipped frontend code. A caller behind a platform gate counts, so the
// iOS-only commands pass on their gated callers; that the gate matches the
// command's platform is the table's business for Android and nobody's for the
// other targets (stated limit). Rust is read with comments removed and string
// contents blanked by a small tokenizer, and the TypeScript side reads string
// nodes from the AST, so a commented-out caller or registration counts for
// nothing; both strips are proved below on fixtures.
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
const RUST_SRC = resolve(import.meta.dirname, '../../../src-tauri/src')
const LIB_RS = readFileSync(join(RUST_SRC, 'lib.rs'), 'utf8')

// ── Rust half ──────────────────────────────────────────────────────────────

/**
 * Rust source with every comment removed (line, doc and nested block), string
 * and char literals read as literals, newlines kept. A regex strip is not
 * enough: a `/*` inside a string ("capabilities/*") opens a "comment" that
 * runs to the next `*\/` and swallows real code. With `blank`, the contents of
 * every string, raw string and char literal are blanked too, so a brace or a
 * fake attribute inside one cannot be counted; the cfg reader keeps them.
 */
function stripRustComments(src: string, blank = false): string {
  let out = ''
  let i = 0
  const n = src.length
  const ident = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_]/.test(c)
  while (i < n) {
    const c = src[i]!
    const d = src[i + 1]
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && d === '*') {
      let depth = 1
      i += 2
      while (i < n && depth > 0) {
        if (src[i] === '/' && src[i + 1] === '*') { depth += 1; i += 2 }
        else if (src[i] === '*' && src[i + 1] === '/') { depth -= 1; i += 2 }
        else { if (src[i] === '\n') out += '\n'; i += 1 }
      }
      if (depth > 0) throw new Error('Rust source: unterminated block comment')
      out += ' '
      continue
    }
    const raw = !ident(src[i - 1]) ? /^b?r(#*)"/.exec(src.slice(i, i + 64)) : null
    if (raw) {
      const close = '"' + raw[1]!
      const end = src.indexOf(close, i + raw[0].length)
      if (end < 0) throw new Error('Rust source: unterminated raw string')
      const body = src.slice(i + raw[0].length, end)
      out += raw[0] + (blank ? body.replace(/[^\n]/g, ' ') : body) + close
      i = end + close.length
      continue
    }
    if (c === '"') {
      out += '"'
      i += 1
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') { out += blank ? '  ' : src.slice(i, i + 2); i += 2; continue }
        out += blank && src[i] !== '\n' ? ' ' : src[i]
        i += 1
      }
      if (i >= n) throw new Error('Rust source: unterminated string')
      out += '"'
      i += 1
      continue
    }
    if (c === "'") {
      // a char literal ('x', '\n', '\u{1F600}', a surrogate pair), else a lifetime or label
      let end = -1
      if (d === '\\') end = src.indexOf("'", i + 3)
      else if (src[i + 2] === "'") end = i + 2
      else if (d !== undefined && /[\uD800-\uDBFF]/.test(d) && src[i + 3] === "'") end = i + 3
      if (end > 0) { out += blank ? "' '" : src.slice(i, end + 1); i = end + 1; continue }
    }
    out += c
    i += 1
  }
  return out
}

/** Every `#[tauri::command]` function in one file, as its module path (`alerts::ios::alerts_snapshot`). */
function commandDefinitions(file: string, src: string): string[] {
  const code = stripRustComments(src, true)
  const root = file === 'lib.rs' ? [] : [file.replace(/\.rs$/, '')]
  const stack: { name: string; depth: number }[] = []
  const out: string[] = []
  let depth = 0
  const re = /\bmod\s+([a-z_][a-z0-9_]*)\s*\{|#\[tauri::command(?:\([^)]*\))?\]|[{}]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    if (m[0] === '{') depth += 1
    else if (m[0] === '}') {
      depth -= 1
      if (stack.length && stack[stack.length - 1]!.depth === depth) stack.pop()
    } else if (m[1] !== undefined) {
      stack.push({ name: m[1], depth })
      depth += 1
    } else {
      const fn = /^[\s\S]*?\bfn\s+([a-z_][a-z0-9_]*)/.exec(code.slice(re.lastIndex))
      if (!fn) throw new Error(`${file}: #[tauri::command] with no fn after it`)
      out.push([...root, ...stack.map(s => s.name), fn[1]!].join('::'))
    }
  }
  if (depth !== 0) throw new Error(`${file}: unbalanced braces after the strip`)
  return out
}

function rustFiles(): [string, string][] {
  return readdirSync(RUST_SRC, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.rs'))
    .map(d => [d.name, readFileSync(join(RUST_SRC, d.name), 'utf8')])
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

/** Every generate_handler! entry as written (`location::get_location`), with the cfg above it. */
function handlerEntries(src: string): { path: string; cfg: string | null }[] {
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
  const out: { path: string; cfg: string | null }[] = []
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
    out.push({ path: t, cfg: pendingCfg })
    pendingCfg = null
  }
  return out
}

/** command name -> carried on Android? (from generate_handler!) */
function rustCommands(src: string): Map<string, boolean> {
  const out = new Map<string, boolean>()
  for (const e of handlerEntries(src)) out.set(e.path.split('::').pop()!, e.cfg === null ? true : cfgOnAndroid(e.cfg))
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
  return sitesInSources(
    shippedFiles(SRC).map(file => [relative(SRC, file).split('\\').join('/'), readFileSync(file, 'utf8')]),
    commandNames,
  )
}

function sitesInSources(sources: [string, string][], commandNames: Set<string>): Map<string, number> {
  const out = new Map<string, number>()
  const bump = (key: string) => out.set(key, (out.get(key) ?? 0) + 1)
  for (const [rel, text] of sources) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
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

const DERIVED = deriveSites(new Set(COMMANDS.keys()))

describe('every native call site in shipped src has an Android reading (FR-22)', () => {
  const derived = DERIVED

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

// ── The registry, both directions ───────────────────────────────────────────

// Each comment form hides a command, a string holds a block-comment opener
// with a later comment closing it, a raw string holds a fake command and an
// unbalanced brace, and char literals hold a quote and a brace.
const RUST_FIXTURE = [
  '// #[tauri::command] fn ghost_line() {}',
  '/// #[tauri::command]',
  '/* #[tauri::command] fn ghost_block() {} /* nested */ #[tauri::command] fn ghost_nested() {} */',
  'const GLOB: &str = "capabilities/*.json";',
  'const RAW: &str = r#"#[tauri::command] fn ghost_raw() { "quoted" "#;',
  "const Q: char = '\"'; const B: char = '{'; fn lt<'a>(x: &'a str) -> &'a str { x }",
  '#[tauri::command]',
  'fn real_one() {}',
  'pub mod inner {',
  '    #[tauri::command(rename_all = "snake_case")]',
  '    pub async fn real_two() {}',
  '}',
  '/* a later comment */',
  'fn after() {}',
].join('\n')

describe('the strips read code, never comments (proved on fixtures)', () => {
  it('the Rust strip finds exactly the two real commands, with their module paths', () => {
    expect(commandDefinitions('fix.rs', RUST_FIXTURE)).toEqual(['fix::real_one', 'fix::inner::real_two'])
  })

  it('the fixture discriminates: the old regex strip invents one command and loses both real ones', () => {
    const naive = RUST_FIXTURE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(naive).toContain('fn ghost_nested')
    expect(naive).not.toContain('fn real_one')
    expect(naive).not.toContain('fn real_two')
  })

  it('a commented-out or runtime-built command name is not a caller; a literal one is', () => {
    const text = [
      "// invoke('ghost_cmd')",
      "/* invoke('ghost_cmd') */",
      'const t = `${prefix}ghost_cmd`',
      "export const x = () => invoke('real_cmd')",
    ].join('\n')
    expect(Object.fromEntries(sitesInSources([['lib/fixture.ts', text]], new Set(['ghost_cmd', 'real_cmd'])))).toEqual({
      'cmd:real_cmd|lib/fixture.ts': 1,
    })
  })

  it('on the real files the strip removes comment text and keeps code', () => {
    expect(LIB_RS).toContain('SINGLE-WEBVIEW INVARIANT')
    const code = stripRustComments(LIB_RS)
    expect(code).not.toContain('SINGLE-WEBVIEW INVARIANT')
    expect(code).toContain('generate_handler![')
    expect(code).toContain('fn get_timezone')
  })

  it('every command the strip reads is one a line count also sees, file by file', () => {
    for (const [file, src] of rustFiles()) {
      const lines = src.split('\n').filter(l => l.trimStart().startsWith('#[tauri::command')).length
      expect(commandDefinitions(file, src).length, file).toBe(lines)
    }
  })
})

describe('every command is registered, and every registered command has a caller', () => {
  const definitions = rustFiles().flatMap(([file, src]) => commandDefinitions(file, src)).sort()
  const entries = handlerEntries(LIB_RS).map(e => e.path).sort()

  it('every #[tauri::command] function under src-tauri/src is in generate_handler!, and every entry names one', () => {
    expect(definitions.length).toBeGreaterThanOrEqual(30)
    expect(entries).toEqual(definitions)
  })

  it.each(entries)('%s has a caller by string in shipped frontend code', (path) => {
    const name = path.split('::').pop()!
    const sites = [...DERIVED].filter(([key]) => key.startsWith(`cmd:${name}|`))
    expect(sites.length, `${name} is registered but nothing in shipped src calls it`).toBeGreaterThan(0)
  })
})
