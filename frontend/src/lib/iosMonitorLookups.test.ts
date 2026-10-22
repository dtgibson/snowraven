/// <reference types="node" />
// MONITOR LOOKUPS STAY OFF iOS (ios27-iphone-duo; tao issue 1373).
//
// On the iPhone Duo's inner screen tao's iOS `current_monitor()` reads
// `[window screen]`, which is nil there, and retains it unchecked, so the app
// aborts; `available_monitors()` aborts the same way. Nothing reaches either
// today: `src-tauri/src/window_geometry.rs`, the one module that looks up
// monitors, is compiled for desktop only, the window-state plugin (which calls
// `available_monitors()` in its restore) is a desktop-only dependency, and no
// frontend file calls the JS window API's monitor functions. This guard keeps
// it that way, because the failure is an abort on a device no agent can touch
// and nothing else in the suite would see it.
//
// ITS REACH, stated so it is not over-read:
//   - Rust: every `.rs` file under src-tauri/src (subdirectories included), with
//     comment lines dropped. A lookup is a call spelled `current_monitor(`,
//     `available_monitors(`, `primary_monitor(` or `monitor_from_point(`. It is
//     allowed only in a file of a module that lib.rs declares under a cfg that
//     cannot hold on iOS (`desktop`, `not(mobile)`, or a macOS, Windows or Linux
//     `target_os`). lib.rs and main.rs are crate roots and compile everywhere,
//     so a lookup there fails even inside a cfg block: move it into a
//     desktop-only module.
//   - Frontend: every shipped `.ts`/`.tsx` under frontend/src (tests and the
//     src/test helpers excluded), with comment lines dropped. Any use of the
//     four JS functions (`currentMonitor`, `availableMonitors`, `primaryMonitor`,
//     `monitorFromPoint`) or their `plugin:window|...` command names fails,
//     because the bundle ships to the iPhone too.
//   - Cargo: tauri-plugin-window-state stays in the non-mobile target table.
//   - Capabilities: src-tauri/capabilities/ios.json denies the four window
//     commands, which core:default otherwise grants on iOS through
//     core:window:default. Tauri checks a deny before any allow, so a lookup
//     that reached the webview's IPC is refused there (defense in depth; the
//     identifiers themselves are validated by tauri-build at compile time).
//   - OUTSIDE IT: tao, tauri and every plugin's own code (vendored or not), a
//     call reached through a renamed import or a macro, and Swift in the
//     extensions. The vendored tao is deliberately not patched (brief).
//
// All four Rust spellings are guarded although only two are the measured
// aborts: the other two are the same family in tao's iOS code, and nothing in
// the app needs any of them there, so a row that wanted one would argue it.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const abs = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url))

const RUST_DIR = abs('../../../src-tauri/src/')
const FRONTEND_DIR = abs('../')
const CARGO = abs('../../../src-tauri/Cargo.toml')
const LIB_RS = join(RUST_DIR, 'lib.rs')
const IOS_CAPABILITY = abs('../../../src-tauri/capabilities/ios.json')
const WINDOW_API_TYPES = abs('../../node_modules/@tauri-apps/api/window.d.ts')

const RUST_LOOKUP = /\b(?:current_monitor|available_monitors|primary_monitor|monitor_from_point)\s*\(/g
const JS_LOOKUP = /\b(?:currentMonitor|availableMonitors|primaryMonitor|monitorFromPoint)\b|plugin:window\|(?:current_monitor|available_monitors|primary_monitor|monitor_from_point)\b/g

/** The cfg spellings that cannot hold on iOS. Anything else is treated as "may be iOS". */
const DESKTOP_ONLY_CFGS = new Set([
  '#[cfg(desktop)]',
  '#[cfg(not(mobile))]',
  '#[cfg(target_os = "macos")]',
  '#[cfg(target_os = "windows")]',
  '#[cfg(target_os = "linux")]',
])

/**
 * Source with comment lines dropped: whole-line `//` (Rust doc comments
 * included) and any line a `/*` block opens or continues. Line-based, as in
 * singleWebviewInvariant.test.ts, so it can never damage a comment marker
 * inside a string on a code line, and it fails in the safe direction: a call
 * left on a code line behind a trailing comment is still found.
 */
function code(text: string): string {
  const kept: string[] = []
  let inBlock = false
  for (const line of text.split('\n')) {
    const trimmed = line.trimStart()
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false
      continue
    }
    if (trimmed.startsWith('//')) continue
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlock = true
      continue
    }
    kept.push(line)
  }
  return kept.join('\n')
}

/** Every file under `dir` whose name passes `keep`, as absolute paths. */
function walk(dir: string, keep: (path: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...walk(path, keep))
    } else if (entry.isFile() && keep(path)) out.push(path)
  }
  return out
}

/**
 * The modules lib.rs declares under a cfg that cannot hold on iOS. Read off the
 * attribute lines directly above each `mod name;` (comment lines between them
 * are skipped), so the allowance follows the declaration rather than a list
 * kept here.
 */
function desktopOnlyModules(libRs: string): Set<string> {
  const lines = libRs.split('\n')
  const out = new Set<string>()
  lines.forEach((line, i) => {
    const m = /^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+([a-z_][a-z0-9_]*)\s*;/.exec(line)
    if (!m) return
    const attrs: string[] = []
    for (let j = i - 1; j >= 0; j--) {
      const t = lines[j].trim()
      if (t.startsWith('#[')) attrs.push(t)
      else if (t.startsWith('//')) continue
      else break
    }
    if (attrs.some(a => DESKTOP_ONLY_CFGS.has(a))) out.add(m[1])
  })
  return out
}

/** The module a source file belongs to: its first path segment, `.rs` dropped. */
function moduleOf(path: string): string {
  return relative(RUST_DIR, path).split(sep)[0].replace(/\.rs$/, '')
}

function rustOffenders(files: string[], desktopOnly: Set<string>): string[] {
  const out: string[] = []
  for (const file of files) {
    const hits = code(readFileSync(file, 'utf8')).match(RUST_LOOKUP) ?? []
    const mod = moduleOf(file)
    const crateRoot = mod === 'lib' || mod === 'main'
    if (hits.length > 0 && (crateRoot || !desktopOnly.has(mod))) {
      out.push(`src-tauri/src/${relative(RUST_DIR, file)}: ${[...new Set(hits)].join(', ')}`)
    }
  }
  return out
}

const RUST_FILES = walk(RUST_DIR, p => p.endsWith('.rs'))
const LIB = readFileSync(LIB_RS, 'utf8')
const DESKTOP_ONLY = desktopOnlyModules(LIB)
const SHIPPED_TS = walk(FRONTEND_DIR, p =>
  /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.endsWith('.d.ts')
  && !relative(FRONTEND_DIR, p).split(sep).includes('test') && !p.endsWith('test-setup.ts'))

describe('no monitor lookup can run on iOS', () => {
  it('Rust: a lookup appears only in a module lib.rs compiles for desktop alone', () => {
    expect(
      rustOffenders(RUST_FILES, DESKTOP_ONLY),
      'a monitor lookup in a file that compiles for iOS. tao aborts on the iPhone Duo\'s inner screen '
        + '(issue 1373); move it into a module declared under #[cfg(desktop)] in lib.rs. This row reads '
        + 'src-tauri/src only, not tao, tauri or any plugin.',
    ).toEqual([])
  })

  it('frontend: no shipped file calls the JS window API\'s monitor functions', () => {
    const offenders = SHIPPED_TS.flatMap(file => {
      const hits = code(readFileSync(file, 'utf8')).match(JS_LOOKUP) ?? []
      return hits.length ? [`frontend/src/${relative(FRONTEND_DIR, file)}: ${[...new Set(hits)].join(', ')}`] : []
    })
    expect(
      offenders,
      'a monitor lookup in shipped frontend code, which runs on the iPhone too, where tao aborts on the '
        + 'Duo\'s inner screen (issue 1373). This row reads frontend/src only.',
    ).toEqual([])
  })

  it('Cargo: tauri-plugin-window-state (it calls available_monitors()) is a desktop-only dependency', () => {
    const tables: Array<{ header: string; body: string }> = []
    for (const chunk of readFileSync(CARGO, 'utf8').split(/^(?=\[)/m)) {
      const header = /^\[[^\]\n]*\]+/.exec(chunk)?.[0] ?? '(preamble)'
      tables.push({ header, body: code(chunk.replace(/^\s*#.*$/gm, '')) })
    }
    const holding = tables.filter(t => /^\s*tauri-plugin-window-state\s*=/m.test(t.body)).map(t => t.header)
    expect(holding).toEqual([`[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`])
  })

  it('capabilities: ios.json denies the four monitor commands core:default grants, on iOS only', () => {
    const ios = JSON.parse(readFileSync(IOS_CAPABILITY, 'utf8')) as { platforms?: string[]; permissions: unknown[] }
    expect(ios.platforms).toEqual(['iOS'])
    const denies = ios.permissions.filter(p => typeof p === 'string' && p.startsWith('core:window:deny-'))
    expect(denies).toEqual([
      'core:window:deny-current-monitor',
      'core:window:deny-available-monitors',
      'core:window:deny-primary-monitor',
      'core:window:deny-monitor-from-point',
    ])
  })
})

// GUARD THE GUARD. Each row shows the scan can see what it exists to refuse.
describe('the monitor-lookup scan is not vacuous', () => {
  it('reads a real tree, and finds window_geometry as a desktop-only module that DOES look up monitors', () => {
    expect(RUST_FILES.map(moduleOf)).toEqual(expect.arrayContaining(['lib', 'main', 'window_geometry']))
    expect(SHIPPED_TS.length).toBeGreaterThan(100)
    expect(DESKTOP_ONLY.has('window_geometry')).toBe(true)
    // The allowance is what admits it: without it, the Rust row would go red.
    const geometry = RUST_FILES.filter(f => moduleOf(f) === 'window_geometry')
    expect(rustOffenders(geometry, new Set())).toHaveLength(1)
  })

  it('the derivation admits only a cfg that cannot hold on iOS', () => {
    const lib = [
      '// a note',
      '#[cfg(desktop)]',
      'mod a;',
      '#[cfg(any(target_os = "macos", target_os = "ios"))]',
      'mod b;',
      'mod c;',
      '#[cfg(target_os = "windows")]',
      '// a note between',
      'mod d;',
      '#[cfg(any(target_os = "ios", test))]',
      'mod e;',
    ].join('\n')
    expect([...desktopOnlyModules(lib)].sort()).toEqual(['a', 'd'])
    // And the real lib.rs: the Apple-shared iCloud module and the iOS-only ones
    // are not admitted, so a lookup added to any of them goes red.
    for (const mod of ['icloud', 'widgets', 'alerts', 'launch_backdrop', 'worker_csp']) {
      expect(DESKTOP_ONLY.has(mod), mod).toBe(false)
    }
  })

  it('the comment stripper strips, so a comment naming a lookup cannot fail a correct file', () => {
    // window_geometry.rs's own notes name the lookups, so the raw text holds more
    // of them than its code does.
    const geometry = readFileSync(join(RUST_DIR, 'window_geometry.rs'), 'utf8')
    expect((geometry.match(RUST_LOOKUP) ?? []).length).toBeGreaterThan((code(geometry).match(RUST_LOOKUP) ?? []).length)
    expect(code('//! calls current_monitor()\n/* available_monitors()\n*/\nfn x() {}').match(RUST_LOOKUP)).toBeNull()
    expect(code('fn x(w: &W) { w.current_monitor(); }').match(RUST_LOOKUP)).toHaveLength(1)
    expect(code('// currentMonitor()\nconst a = 1').match(JS_LOOKUP)).toBeNull()
    expect(code("void invoke('plugin:window|available_monitors')").match(JS_LOOKUP)).toHaveLength(1)
  })

  it('the JS names guarded are the names the installed window API really exports', () => {
    const types = readFileSync(WINDOW_API_TYPES, 'utf8')
    for (const name of ['currentMonitor', 'availableMonitors', 'primaryMonitor', 'monitorFromPoint']) {
      expect(types, name).toMatch(new RegExp(`declare function ${name}\\b`))
    }
  })
})
