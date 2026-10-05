/// <reference types="node" />
// THE TAURI HTTP FETCH PERMIT (improve: http-permit-narrowed).
//
// WHAT IT GUARDS. Every API call the Mac, Windows, iPhone and iPad apps make
// goes through `tauriFetch` (`lib/tauri/http.ts`), which hands the request to
// the http plugin over IPC, so Rust sends it, outside the page's content
// security policy. The plugin sends only to a URL that `http:allow-fetch` in
// `src-tauri/capabilities/default.json` admits. That scope was `https://**`; it
// now names only the origins the services fetch, each entry held to a fixed
// path on its host.
//
// WHY THE ORIGINS ARE DERIVED, NEVER RESTATED. A missed host fails quietly: the
// plugin refuses before sending, the rejection carries no HTTP status,
// `isOfflineError` reads it as offline, and a tab shows offline or replayed
// data in the Tauri apps while `npm run dev` and vitest stay green (the
// 2026-05-26 post-mortem's shape). A second copy of the host list in this file
// would stay green through exactly that drift (CLAUDE.md, compare two
// declarations to each other). So every URL is read from the source of each
// file that imports `tauriFetch`, through the TypeScript AST, where a comment is
// never a node: a literal that starts with `https://`, and a template led by a
// module constant that holds one (`${EBIRD_BASE}/ref/...`). Each substitution
// reads as `*` and the query is dropped, because the plugin admits any query.
// A URL the reader cannot pin to one fixed https host throws.
//
// HOW THE PLUGIN MATCHES (tauri-plugin-http 2.5.9, `src/scope.rs` and
// `src/commands.rs`). Each entry is a URLPattern: the host is exact, the port is
// the scheme's default, a `*` in the path matches anything including `/`, and
// an empty or `/` path, query or fragment is widened to `*`. The scope is
// checked once, on the URL the call asks for, and the redirects reqwest follows
// after it are not checked, which is why each entry carries a path: an entry
// that names no fixed path segment admits the whole host. CI runs Node 20,
// which has no URLPattern, so this file checks STRUCTURE (one fixed host, at
// most one wildcard standing for whole segments, no dot segment or percent
// escape, every call-site URL inside an entry) and never a runtime match that
// could skip on CI and still read as coverage. The dot segment and the escape
// are refused rather than modeled: urlpattern resolves them in an entry and the
// url crate in a request, while this file compares the text as written. These
// checks are a floor, not tightness: an entry shortened to a broader prefix on
// its own host stays green here, so keeping each entry as narrow as its call
// sites is a review check (`.claude/rules/security.md`). The dev-mode check
// that the plugin admits these URLs and refuses another host is recorded in
// `pipeline/http-permit-narrowed/pr-description.md`.
//
// WHAT IT CANNOT SEE. A URL built from a value that is not a literal in the
// importing file (a parameter, another module's constant, a stored setting) is
// invisible here. The permit refuses it in the apps unless it falls inside an
// entry, so it fails toward refusal, and every importer must show at least one
// URL or the reader is what failed. A substitution that climbs out of an
// entry's path with `..` is refused by the permit, which is the point. The
// permit bounds where a request goes, not its method, headers, body or query.
// The updater (tauri-plugin-updater's own client) and the iOS widgets' and
// Alerts' native requests never pass through this scope.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SRC = join(ROOT, 'frontend', 'src')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const rel = (abs: string) => relative(ROOT, abs).split(sep).join('/')

const HTTP_MODULE = 'frontend/src/lib/tauri/http.ts'
const PLUGIN = '@tauri-apps/plugin-http'
const CAPABILITIES = 'src-tauri/capabilities'
const PERMIT_FILE = `${CAPABILITIES}/default.json`

const sorted = (xs: Iterable<string>) => [...xs].sort()

function parse(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
}

// ── Which files ship, and which of them reach the plugin ──────────────────────

/** Every TypeScript file under frontend/src that a build can include, as a
 *  repo-relative path. Test files, `src/test/` and the test setup never ship
 *  and are left out. A link is refused rather than followed or skipped. */
function shippedSources(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, d.name)
      if (d.isSymbolicLink()) throw new Error(`${rel(abs)} is a link, which this scan does not follow`)
      if (d.isDirectory()) {
        if (abs !== join(SRC, 'test')) walk(abs)
      } else if (
        d.isFile() && /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name)
        && abs !== join(SRC, 'test-setup.ts')
      ) {
        out.push(rel(abs))
      }
    }
  }
  walk(SRC)
  return out.sort()
}

/** Every module a file names: imports and re-exports, `import x = require()`,
 *  `import()` and `require()`. A dynamic target that is not a literal throws,
 *  because what it loads cannot be read. */
function moduleSpecifiers(file: string, text: string): string[] {
  const out: string[] = []
  const visit = (n: ts.Node): void => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) {
      if (ts.isStringLiteral(n.moduleSpecifier)) out.push(n.moduleSpecifier.text)
    } else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) {
      const e = n.moduleReference.expression
      if (ts.isStringLiteral(e)) out.push(e.text)
    } else if (
      ts.isCallExpression(n)
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))
    ) {
      const arg = n.arguments[0]
      if (arg === undefined || !ts.isStringLiteralLike(arg)) {
        throw new Error(`${file}: an import() or require() whose target is not a literal cannot be read`)
      }
      out.push(arg.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(parse(file, text))
  return out
}

/** The repo-relative module a relative or `@/` specifier names, without its
 *  extension; a package specifier is null. */
function resolveSpecifier(file: string, spec: string): string | null {
  let abs: string
  if (spec.startsWith('./') || spec.startsWith('../')) abs = resolve(dirname(join(ROOT, file)), spec)
  else if (spec.startsWith('@/')) abs = join(SRC, spec.slice(2))
  else return null
  return rel(abs).replace(/\.(ts|tsx|js)$/, '')
}

const importsHttpModule = (file: string, spec: string) =>
  resolveSpecifier(file, spec) === HTTP_MODULE.replace(/\.ts$/, '')
const isPlugin = (spec: string) => spec === PLUGIN || spec.startsWith(`${PLUGIN}/`)

/** String literals that name one of the plugin's IPC commands by hand
 *  (`plugin:http|fetch`), the one way round both imports. */
function commandNames(file: string, text: string): string[] {
  const out: string[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteralLike(n) && n.text.startsWith('plugin:http|')) out.push(n.text)
    ts.forEachChild(n, visit)
  }
  visit(parse(file, text))
  return out
}

// ── The URLs an importer builds ───────────────────────────────────────────────

const URL_TEXT = /^https?:\/\//i

function requireHttps(file: string, text: string): void {
  if (!text.startsWith('https://')) throw new Error(`${file}: "${text}" is not https, and the permit admits https only`)
}

/** Whether an identifier sits in a name slot (a declaration's name, a property
 *  name) rather than reading a value. */
function isNameSlot(n: ts.Identifier): boolean {
  const p = n.parent
  return ((ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyAccessExpression(p)) && p.name === n)
}

/** Every URL the file can fetch, as fixed text with each substitution read as
 *  `*`. A module constant that holds a URL is a base when every use of it
 *  leads a template, and a URL in its own right otherwise. */
function urlShapes(file: string, text: string): string[] {
  const sf = parse(file, text)
  const bases = new Map<string, string>()
  const collect = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isStringLiteralLike(n.initializer) && URL_TEXT.test(n.initializer.text)) {
      const name = n.name.getText(sf)
      requireHttps(file, n.initializer.text)
      const list = n.parent
      if (!ts.isIdentifier(n.name) || !ts.isVariableDeclarationList(list) || !(list.flags & ts.NodeFlags.Const)) {
        throw new Error(`${file}: ${name} holds a URL but is not a plain const`)
      }
      const statement = list.parent
      if (ts.isVariableStatement(statement) && statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        throw new Error(`${file}: ${name} is exported, and a base URL shared across files is outside this reader`)
      }
      if (bases.has(name)) throw new Error(`${file}: ${name} is declared twice`)
      bases.set(name, n.initializer.text)
    }
    ts.forEachChild(n, collect)
  }
  collect(sf)

  const shapes: string[] = []
  const led = new Set<string>()
  const bare = new Set<string>()
  const rest = (spans: readonly ts.TemplateSpan[]) => spans.map(s => `*${s.literal.text}`).join('')
  const visit = (n: ts.Node): void => {
    if (ts.isTemplateExpression(n)) {
      const first = n.templateSpans[0]!
      if (n.head.text === '' && ts.isIdentifier(first.expression) && bases.has(first.expression.text)) {
        led.add(first.expression.text)
        shapes.push(bases.get(first.expression.text)! + first.literal.text + rest(n.templateSpans.slice(1)))
        for (const s of n.templateSpans.slice(1)) visit(s.expression)
        return
      }
      if (URL_TEXT.test(n.head.text)) {
        requireHttps(file, n.head.text)
        shapes.push(n.head.text + rest(n.templateSpans))
      }
    } else if (ts.isStringLiteralLike(n) && URL_TEXT.test(n.text)) {
      requireHttps(file, n.text)
      if (!(ts.isVariableDeclaration(n.parent) && n.parent.initializer === n)) shapes.push(n.text)
    } else if (ts.isIdentifier(n) && bases.has(n.text) && !isNameSlot(n)) {
      bare.add(n.text)
    } else if (ts.isExportDeclaration(n) && !n.moduleSpecifier && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) {
        const local = (e.propertyName ?? e.name).text
        if (bases.has(local)) throw new Error(`${file}: ${local} is exported, and a base URL shared across files is outside this reader`)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  for (const [name, value] of bases) if (bare.has(name) || !led.has(name)) shapes.push(value)
  return shapes
}

interface Shape { file: string; url: string; origin: string; path: string }

/** A `.` or `..` path segment, in every spelling the WHATWG URL parser reads as
 *  one (`%2e` in either case is a dot, and `\` separates segments in an https
 *  URL), ended by a separator or the end of the path. Both the url crate (on a
 *  request) and urlpattern (in an entry's fixed text) resolve it before the
 *  permit matches, while this file compares text as written, so a path holding
 *  one is refused rather than modeled (security review L2). A segment that only
 *  contains a dot (`3.0`, `latest.json`, `..x`, `...`) is not one. */
const DOT_SEGMENT = /[/\\](?:\.|%2e){1,2}(?=[/\\]|$)/i

/** A URL shape's origin and path. The host must be fixed text: a substitution
 *  in it, a port or credentials throw, since the entries name none of them. A
 *  dot segment in the fixed path throws too: the request would resolve it to a
 *  path this file never compared against the entries. */
function splitShape(file: string, url: string): Shape {
  const m = /^https:\/\/([^/?#]*)([^?#]*)/.exec(url)
  if (!m || m[1] === '' || /[*@:]/.test(m[1]!)) throw new Error(`${file}: "${url}" does not name one fixed https host`)
  const path = m[2] || '/'
  if (DOT_SEGMENT.test(path)) throw new Error(`${file}: "${url}" has a dot segment, which the request resolves before the permit matches it`)
  return { file, url, origin: `https://${m[1]}`, path }
}

// ── The permit ────────────────────────────────────────────────────────────────

interface Entry { raw: string; origin: string; path: string }

const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z][a-z0-9-]*[a-z0-9]$/

/** One permit entry, checked against the only shape this guard models: a fixed
 *  https host, then a path with at most one `*` standing for whole segments
 *  after at least one fixed segment, and no dot segment or percent escape (both
 *  of which urlpattern rewrites before matching). Anything else throws, with
 *  the reason. */
function parseEntry(raw: string): Entry {
  if (!raw.startsWith('https://')) throw new Error(`${raw} is not https`)
  if (/[?#]/.test(raw)) throw new Error(`${raw} carries a query or fragment`)
  const afterScheme = raw.slice('https://'.length)
  const slash = afterScheme.indexOf('/')
  const host = slash < 0 ? afterScheme : afterScheme.slice(0, slash)
  const path = slash < 0 ? '' : afterScheme.slice(slash)
  if (!HOST.test(host)) throw new Error(`${raw} does not name one fixed host (no wildcard, port, credentials or address)`)
  if (/[:(){}+\\\s]/.test(path)) throw new Error(`${raw} uses URLPattern syntax this guard does not model`)
  if (DOT_SEGMENT.test(path)) throw new Error(`${raw} has a dot segment, which URLPattern resolves before matching`)
  if (path.includes('%')) throw new Error(`${raw} has a percent escape, which URLPattern rewrites before matching`)
  const star = path.indexOf('*')
  if (star >= 0) {
    if (path.indexOf('*', star + 1) >= 0) throw new Error(`${raw} has more than one wildcard`)
    if (path[star - 1] !== '/' || (star + 1 < path.length && path[star + 1] !== '/')) {
      throw new Error(`${raw} has a wildcard that is not a whole path segment`)
    }
  }
  if ((star < 0 ? path : path.slice(0, star)).replace(/\/+$/, '') === '') {
    throw new Error(`${raw} names no fixed path, so it admits the whole host`)
  }
  return { raw, origin: `https://${host}`, path }
}

/** Whether an entry admits every URL a shape can produce, read structurally:
 *  without a wildcard the path must be equal (so a substitution in it fails);
 *  with one, the shape must carry the fixed text on both sides of it. */
function admits(entry: Entry, shape: Shape): boolean {
  if (entry.origin !== shape.origin) return false
  const star = entry.path.indexOf('*')
  if (star < 0) return shape.path === entry.path
  const head = entry.path.slice(0, star)
  const tail = entry.path.slice(star + 1)
  return shape.path.length >= head.length + tail.length && shape.path.startsWith(head) && shape.path.endsWith(tail)
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const permissionId = (p: unknown) => (typeof p === 'string' ? p : isObject(p) ? p.identifier : undefined)

/** The permit's entries as written. A shape the plugin would not read as one
 *  entry is kept as its JSON text, so the rows that parse it go red on it. */
function permitEntries(): string[] {
  const cap = JSON.parse(read(PERMIT_FILE)) as { permissions?: unknown }
  const perms = Array.isArray(cap.permissions) ? cap.permissions : []
  const fetch = perms.find(p => isObject(p) && p.identifier === 'http:allow-fetch')
  const allow = isObject(fetch) && Array.isArray(fetch.allow) ? fetch.allow : []
  return allow.map(a => (typeof a === 'string' ? a : isObject(a) && typeof a.url === 'string' ? a.url : JSON.stringify(a)))
}

/** Every capability file tauri-build reads (`capabilities/**`), recursively. */
function capabilityFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, d.name)
      if (d.isDirectory()) walk(abs)
      else out.push(rel(abs))
    }
  }
  walk(join(ROOT, CAPABILITIES))
  return out.sort()
}

// ── The derivation, computed once ─────────────────────────────────────────────

interface Derived { shipped: string[]; importers: string[]; shapes: Shape[] }
let derived: Derived | null = null
function derive(): Derived {
  if (derived) return derived
  const shipped = shippedSources()
  const importers = shipped.filter(f => moduleSpecifiers(f, read(f)).some(s => importsHttpModule(f, s)))
  const shapes = importers.flatMap(f => urlShapes(f, read(f)).map(u => splitShape(f, u)))
  derived = { shipped, importers, shapes }
  return derived
}

describe('the http fetch permit (capabilities/default.json, http:allow-fetch)', () => {
  it('every entry names one fixed https host and a path inside it', () => {
    const entries = permitEntries()
    expect(entries.length, 'http:allow-fetch admits nothing: every API call would be refused').toBeGreaterThan(0)
    for (const raw of entries) expect(() => parseEntry(raw), raw).not.toThrow()
  })

  it('its origins are exactly the origins the services fetch', () => {
    const permitOrigins = permitEntries().map(raw => {
      try { return parseEntry(raw).origin } catch { return `unreadable entry ${raw}` }
    })
    expect(sorted(new Set(permitOrigins))).toEqual(sorted(new Set(derive().shapes.map(s => s.origin))))
  })

  it('every URL a service builds falls inside an entry for its host', () => {
    const entries = permitEntries().flatMap(raw => { try { return [parseEntry(raw)] } catch { return [] } })
    for (const shape of derive().shapes) {
      expect(entries.some(e => admits(e, shape)), `${shape.file}: no entry admits ${shape.url}`).toBe(true)
    }
  })

  it('every entry admits a URL some service builds', () => {
    // A path the services no longer fetch is width with no caller, so an entry
    // left behind by a removed call site goes red here rather than staying open.
    const { shapes } = derive()
    for (const raw of permitEntries()) {
      const entry = parseEntry(raw)
      expect(shapes.some(s => admits(entry, s)), `${raw} admits no URL the services build`).toBe(true)
    }
  })

  it('the one http scope in the app is this permit, and http:default stays a bare string', () => {
    // tauri-build reads every file under capabilities/ (json, json5 or toml),
    // and a capability can also be inlined in tauri.conf.json. Any http
    // permission written elsewhere, or as an object with a second scope, would
    // widen what the plugin admits beyond the entries checked above.
    const files = capabilityFiles()
    expect(files).toContain(PERMIT_FILE)
    const found: string[] = []
    for (const f of files) {
      expect(f.endsWith('.json'), `${f} is a capability format this guard does not read`).toBe(true)
      const cap = JSON.parse(read(f)) as { permissions?: unknown }
      for (const p of Array.isArray(cap.permissions) ? cap.permissions : []) {
        const id = permissionId(p)
        if (typeof id !== 'string' || !id.startsWith('http:')) continue
        found.push(`${f} ${typeof p === 'string' ? id : `${id} {${sorted(Object.keys(p as object)).join(',')}}`}`)
      }
    }
    expect(found).toEqual([`${PERMIT_FILE} http:default`, `${PERMIT_FILE} http:allow-fetch {allow,identifier}`])
    for (const name of readdirSync(join(ROOT, 'src-tauri')).filter(n => /^tauri(\..+)?\.conf\.json$/.test(n))) {
      const conf = JSON.parse(read(`src-tauri/${name}`)) as { app?: { security?: { capabilities?: unknown } } }
      expect(conf.app?.security?.capabilities, `${name} inlines capabilities`).toBeUndefined()
    }
  })

  it('only lib/tauri/http.ts imports the plugin, and no source names its commands', () => {
    // A file that reached the plugin another way would fetch URLs this
    // derivation never reads; the permit would still refuse them, but the
    // guard's claim that it reads every caller would be false.
    for (const f of derive().shipped) {
      const text = read(f)
      if (f !== HTTP_MODULE) {
        expect(moduleSpecifiers(f, text).filter(isPlugin), `${f} imports ${PLUGIN}`).toEqual([])
      }
      expect(commandNames(f, text), `${f} invokes the http plugin by command name`).toEqual([])
    }
    expect(moduleSpecifiers(HTTP_MODULE, read(HTTP_MODULE)).filter(isPlugin)).toEqual([PLUGIN])
  })
})

// GUARD THE GUARD. The readers are hand-written over the TypeScript AST and the
// entry check is a hand-written model of URLPattern, so each is shown to read
// the real tree, to read only live code, and to refuse what it must. Without
// these, a reader that matched nothing would make the rows above vacuous: an
// empty set of URLs is admitted by any permit.
describe('the permit readers', () => {
  it('read the real tree: the shipped files, the importers, and a URL from each', () => {
    const { shipped, importers, shapes } = derive()
    expect(shipped).toContain(HTTP_MODULE)
    expect(shipped).toContain('frontend/src/main.tsx')
    expect(shipped.filter(f => /\.test\.tsx?$/.test(f))).toEqual([])
    expect(importers).toContain('frontend/src/lib/tauri/mapService.ts')
    expect(importers).toContain('frontend/src/lib/tauri/versionService.ts')
    expect(importers).not.toContain(HTTP_MODULE)
    // Per partition: an importer the reader finds no URL in is a reader
    // failure, never a file with nothing to check.
    for (const f of importers) {
      expect(shapes.filter(s => s.file === f).length, `no URL read from ${f}`).toBeGreaterThan(0)
    }
    // A floor on the denominator, not a second copy of the list: the six are
    // the services PRIVACY_POLICY.md names. Removing a service lowers it in the
    // same change; adding one is the permit rows' business.
    expect(new Set(shapes.map(s => s.origin)).size).toBeGreaterThanOrEqual(6)
  })

  it('read live code only: a commented-out URL or import is not one', () => {
    const fixture = [
      "import { tauriFetch } from './http'",
      "// import { fetch } from '@tauri-apps/plugin-http'",
      "/* import { fetch as f2 } from '@tauri-apps/plugin-http' */",
      "// const OLD_BASE = 'https://old.example/v1'",
      "/* tauriFetch('https://hidden.example/x') */",
      "const BASE = 'https://live.example/v2'",
      '// tauriFetch(`${BASE}/commented/${id}`)',
      'export const get = (id: string) => tauriFetch(`${BASE}/items/${id}?fmt=json`)',
    ].join('\n')
    const file = 'frontend/src/lib/tauri/fixture.ts'
    expect(moduleSpecifiers(file, fixture)).toEqual(['./http'])
    expect(moduleSpecifiers(file, fixture).some(s => importsHttpModule(file, s))).toBe(true)
    expect(urlShapes(file, fixture)).toEqual(['https://live.example/v2/items/*?fmt=json'])
    expect(commandNames(file, "// invoke('plugin:http|fetch', {})")).toEqual([])
    expect(commandNames(file, "invoke('plugin:http|fetch', {})")).toEqual(['plugin:http|fetch'])
  })

  it('resolve a base through the template it leads, and count a base used bare', () => {
    const file = 'frontend/src/lib/tauri/fixture.ts'
    const fixture = [
      "const LED = 'https://a.example'",
      "const BARE = 'https://b.example/one/path'",
      "const BOTH = 'https://c.example/v3'",
      'f(`${LED}/search?q=${q}&n=5`)',
      'f(`${LED}/reverse?lat=${lat}&lon=${lon}`)',
      'f(BARE)',
      'f(`${BOTH}/x/${id}/y`)',
      'f(BOTH)',
      'f(`https://d.example/asset/${encodeURIComponent(id)}/embed`)',
      "f('https://e.example/whole')",
    ].join('\n')
    expect(sorted(urlShapes(file, fixture))).toEqual(sorted([
      'https://a.example/search?q=*&n=5',
      'https://a.example/reverse?lat=*&lon=*',
      'https://b.example/one/path',
      'https://c.example/v3/x/*/y',
      'https://c.example/v3',
      'https://d.example/asset/*/embed',
      'https://e.example/whole',
    ]))
    // The resolver is what reaches these from an importer: a reader that saw
    // only literals would find the bare base and never its paths.
    expect(splitShape(file, 'https://a.example/search?q=*&n=5')).toMatchObject({ origin: 'https://a.example', path: '/search' })
    expect(splitShape(file, 'https://a.example')).toMatchObject({ path: '/' })
  })

  it('import resolution covers relative, @/ and dynamic forms, and refuses an unreadable one', () => {
    const file = 'frontend/src/components/Fixture.tsx'
    const forms = [
      "import { tauriFetch } from '../lib/tauri/http'",
      "import { tauriFetch as f } from '@/lib/tauri/http'",
      "const m = await import('../lib/tauri/http.ts')",
      "export { tauriFetch } from '../lib/tauri/http'",
    ]
    for (const form of forms) {
      const specs = moduleSpecifiers(file, form)
      expect(specs.some(s => importsHttpModule(file, s)), form).toBe(true)
    }
    expect(moduleSpecifiers(file, "import x = require('@tauri-apps/plugin-http/sub')").filter(isPlugin)).toHaveLength(1)
    expect(importsHttpModule(file, '../lib/tauri/httpish')).toBe(false)
    expect(() => moduleSpecifiers(file, 'const m = await import(target)')).toThrow(/not a literal/)
  })

  it.each([
    ['a substitution in the host', 'tauriFetch(`https://${host}/x`)', /fixed https host/],
    ['a substitution glued to the host', 'tauriFetch(`https://example.org${rest}`)', /fixed https host/],
    ['a port', "tauriFetch('https://example.org:8443/x')", /fixed https host/],
    ['credentials', "tauriFetch('https://user@example.org/x')", /fixed https host/],
    ['plain http', "tauriFetch('http://example.org/x')", /https only/],
    ['an http base', "const B = 'http://example.org'\ntauriFetch(`${B}/x`)", /https only/],
    ['an exported base', "export const B = 'https://example.org'\ntauriFetch(`${B}/x`)", /exported/],
    ['a base exported by name', "const B = 'https://example.org'\nexport { B }\ntauriFetch(`${B}/x`)", /exported/],
    ['a base that is not const', "let B = 'https://example.org'\ntauriFetch(`${B}/x`)", /not a plain const/],
    ['a dot segment after a base', "const B = 'https://api.ebird.org/v2'\ntauriFetch(`${B}/../ref/x`)", /dot segment/],
    ['an escaped dot segment in capitals', "tauriFetch('https://example.org/v2/%2E%2E/x')", /dot segment/],
    ['a dot segment between backslashes', String.raw`tauriFetch('https://example.org/v2/x\\..\\y')`, /dot segment/],
  ])('fail closed on %s', (_label, source, reason) => {
    const file = 'frontend/src/lib/tauri/fixture.ts'
    expect(() => urlShapes(file, source).map(u => splitShape(file, u))).toThrow(reason)
  })

  it.each([
    ['https://**', /fixed host/],
    ['https://*.ebird.org/v2/*', /fixed host/],
    ['https://api.ebird.org:443/v2/*', /fixed host/],
    ['https://user@api.ebird.org/v2/*', /fixed host/],
    ['https://API.ebird.org/v2/*', /fixed host/],
    ['https://127.0.0.1/v2/*', /fixed host/],
    ['http://api.ebird.org/v2/*', /not https/],
    ['*://api.ebird.org/v2/*', /not https/],
    ['https://api.ebird.org', /whole host/],
    ['https://api.ebird.org/', /whole host/],
    ['https://api.ebird.org/*', /whole host/],
    ['https://api.ebird.org/v2*', /whole path segment/],
    ['https://api.ebird.org/v2/*x', /whole path segment/],
    ['https://api.ebird.org/v2/*/*', /more than one wildcard/],
    ['https://api.ebird.org/v2/*?x=*', /query or fragment/],
    ['https://api.ebird.org/v2/*#f', /query or fragment/],
    ['https://api.ebird.org/:id/v2', /URLPattern syntax/],
    ['https://api.ebird.org/v2/(.*)', /URLPattern syntax/],
    ['https://api.ebird.org/v2/../*', /dot segment/],
    ['https://api.ebird.org/v2/%2e%2e/*', /dot segment/],
    ['https://api.ebird.org/v2/./*', /dot segment/],
    ['https://api.ebird.org/v2/..', /dot segment/],
    ['https://api.ebird.org/v2/a%2fb/*', /percent escape/],
  ])('the entry check refuses %s', (raw, reason) => {
    expect(() => parseEntry(raw)).toThrow(reason)
  })

  it('the dot-segment checks refuse whole dot segments only, so the real tree and dotted names pass', () => {
    // The half of those refusals that must stay green: a segment that only
    // contains a dot is ordinary to the URL parser, and OpenWeather's `3.0` is one.
    expect(() => derive()).not.toThrow()
    for (const raw of permitEntries()) expect(() => parseEntry(raw), raw).not.toThrow()
    for (const raw of [
      'https://a.example/data/3.0/*',
      'https://a.example/.well-known/x',
      'https://a.example/v2/..x/*',
      'https://a.example/v2/x../*',
      'https://a.example/v2/.../*',
    ]) expect(() => parseEntry(raw), raw).not.toThrow()
    const file = 'frontend/src/lib/tauri/fixture.ts'
    for (const url of [
      'https://a.example/repos/x/releases/latest.json?q=*',
      'https://a.example/.well-known/*',
      'https://a.example/v2/..x/*',
      'https://a.example/v2/.*/y',
      'https://a.example/v2/...',
    ]) expect(() => splitShape(file, url), url).not.toThrow()
  })

  it('the entry check accepts each form the permit uses', () => {
    expect(parseEntry('https://a.example/v2/*')).toEqual({ raw: 'https://a.example/v2/*', origin: 'https://a.example', path: '/v2/*' })
    expect(parseEntry('https://a.example/api/prod/getter').path).toBe('/api/prod/getter')
    expect(parseEntry('https://a.example/asset/*/embed').path).toBe('/asset/*/embed')
    expect(parseEntry('https://a.b-c.example/data/3.0/*').origin).toBe('https://a.b-c.example')
  })

  it('the admission model matches what URLPattern admits, by structure', () => {
    const file = 'frontend/src/lib/tauri/fixture.ts'
    const at = (url: string) => splitShape(file, url)
    const prefix = parseEntry('https://a.example/v2/*')
    expect(admits(prefix, at('https://a.example/v2/ref/*/x?k=*'))).toBe(true)
    expect(admits(prefix, at('https://a.example/v2/'))).toBe(true)
    expect(admits(prefix, at('https://a.example/v2'))).toBe(false)
    expect(admits(prefix, at('https://a.example/v1/x'))).toBe(false)
    expect(admits(prefix, at('https://a.example/*/v2/x'))).toBe(false)
    expect(admits(prefix, at('https://b.example/v2/x'))).toBe(false)
    const exact = parseEntry('https://a.example/search')
    expect(admits(exact, at('https://a.example/search?q=*&n=5'))).toBe(true)
    expect(admits(exact, at('https://a.example/search/*'))).toBe(false)
    expect(admits(exact, at('https://a.example/search*'))).toBe(false)
    const middle = parseEntry('https://a.example/asset/*/embed')
    expect(admits(middle, at('https://a.example/asset/*/embed'))).toBe(true)
    expect(admits(middle, at('https://a.example/asset/*'))).toBe(false)
    expect(admits(middle, at('https://a.example/asset/*/embed/x'))).toBe(false)
    expect(admits(middle, at('https://a.example/asset/embed'))).toBe(false)
  })
})
