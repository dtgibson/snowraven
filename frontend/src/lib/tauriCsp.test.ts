/// <reference types="node" />
// THE TAURI CONTENT SECURITY POLICY (improve: desktop-csp-frame-protection).
//
// WHAT IT GUARDS. `src-tauri/tauri.conf.json` `app.security.csp` is the one
// policy the Mac, Windows, iPhone and iPad apps share: one webview, one config.
// It replaced `"csp": null`. The page may run only its own bundled scripts,
// talk only to the hosts it already uses, and frame only the Macaulay Library
// embed. API calls (every `lib/tauri/` service) go through the http plugin
// over IPC, so they need no host here; only the IPC origins do.
//
// WHY THE HOSTS ARE DERIVED, NEVER RESTATED. A missed host fails quietly: a
// blank map base, an empty embed, a favicon replaced by its fallback glyph. A
// second copy of the host list in this file would stay green through exactly
// the drift it exists to catch (CLAUDE.md, compare two declarations to each
// other). So each host is read from the call site that loads it, through the
// TypeScript AST, where a comment is never a node and so can never count as a
// load: `lib/mapStyle.ts` (style and tile hosts), the iframe in
// `components/MediaEmbed.tsx`, and the `faviconSrc` props in
// `components/SpeciesLinks.tsx`. A reader that cannot resolve a value to a fixed
// origin throws, because a dynamic host cannot be written into a static policy.
//
// WHAT IS NOT DERIVED, AND WHY. `'self'`, `data:`, `blob:` and the IPC origins
// (`ipc:` on macOS and iOS, `http://ipc.localhost` on Windows) are Tauri's and
// the browser's, not a call site's. eBird's favicon answers 302 to an S3 host
// eBird chooses, and CSP checks the redirect target, so that host is in
// `img-src` by policy and nowhere in source; if it moves, the mark shows its
// bundled glyph (the favicon's own failure state), never a broken link.
//
// WHAT IT CANNOT SEE. A request the http plugin sends is outside the page's CSP
// (Rust makes it); where such a request may go is the http permit's job, held
// to the services' call sites by `lib/tauriHttpScope.test.ts`. An iframe or
// image added at a call site other than these three is not read here
// (`.claude/rules/security.md`).
//
// WORKERS (worker-csp). Tauri sends the policy only with `.html`, and a worker
// loaded by URL takes its policy from its own script response, so the app
// builds its one window in code (`app.windows[0].create` is false) with a
// web-resource hook that puts the same directive map on every non-HTML file
// (`src-tauri/src/worker_csp.rs`). The last block below holds that pairing and
// the hook's shape: config creates no window and code creates exactly one, one
// setup closure on every target, the policy read from config with no directive
// or host typed in Rust, nothing attached in a dev build, and HTML untouched.
// The predicate's behaviour is the Rust tests' business (`cargo test`); these
// rows hold the source shape those tests cannot see from inside the module.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import ts from 'typescript'
import { VECTOR_STYLE_URL, RASTER_BASES, TRAILS_TILES } from './mapStyle'

const at = (p: string) => new URL(`../../../${p}`, import.meta.url)
const read = (p: string) => readFileSync(at(p), 'utf8')

const CONF = 'src-tauri/tauri.conf.json'
const MAP_STYLE = 'frontend/src/lib/mapStyle.ts'
const MEDIA_EMBED = 'frontend/src/components/MediaEmbed.tsx'
const SPECIES_LINKS = 'frontend/src/components/SpeciesLinks.tsx'

// ── The policy, read as Tauri's directive-map form ────────────────────────────
//
// Only the map-of-lists form is accepted. Tauri also takes one policy string,
// but its parser splits on single spaces, so a doubled space becomes an empty
// source; the list form has no such failure and is the form read here. Any
// other shape fails closed rather than being half-read.
type Policy = Record<string, string[]>

function readPolicy(security: unknown): Policy {
  expect(typeof security === 'object' && security !== null, 'app.security is missing').toBe(true)
  const csp = (security as { csp?: unknown }).csp
  expect(csp, 'app.security.csp is null or absent: the webview runs with no policy').toBeTruthy()
  expect(typeof csp === 'object' && !Array.isArray(csp), 'csp must be the directive-map form').toBe(true)
  const policy: Policy = {}
  for (const [directive, sources] of Object.entries(csp as Record<string, unknown>)) {
    expect(
      Array.isArray(sources) && sources.every(s => typeof s === 'string' && s.length > 0 && !/\s/.test(s)),
      `${directive} must be a list of single sources`,
    ).toBe(true)
    policy[directive] = sources as string[]
  }
  return policy
}

const conf = JSON.parse(read(CONF)) as { app: { security: Record<string, unknown> } }
const security = conf.app.security
const policy = readPolicy(security)

// ── The source readers ────────────────────────────────────────────────────────

function parse(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
}

/** The fixed text a literal starts with, and whether that text is the whole
 *  value: a string or a template with no substitutions is whole, a template's
 *  head is not. Anything else is not readable. */
function literalPrefix(e: ts.Node): { text: string; whole: boolean } | null {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return { text: e.text, whole: true }
  if (ts.isTemplateExpression(e)) return { text: e.head.text, whole: false }
  return null
}

/** The origin a URL prefix names. Throws when the fixed text stops before the
 *  host is complete (`https://${host}/...` or `https://example.org${rest}`),
 *  because a substitution could still change the host. */
function originOf({ text, whole }: { text: string; whole: boolean }, where: string): string {
  const end = whole ? '(?:[/?#]|$)' : '[/?#]'
  const m = new RegExp(`^https://[^/?#\\s]+${end}`).exec(text)
  if (!m) throw new Error(`${where}: "${text}" does not name a fixed https origin`)
  return new URL(text.slice(0, m[0].length).replace(/[?#]$/, '')).origin
}

/** Every https origin a string or template literal in the file starts with. */
function literalOrigins(file: string, text: string): string[] {
  const out: string[] = []
  const visit = (n: ts.Node): void => {
    const prefix = literalPrefix(n)
    if (prefix !== null && prefix.text.startsWith('https://')) out.push(originOf(prefix, file))
    ts.forEachChild(n, visit)
  }
  visit(parse(file, text))
  return out
}

/** The origin of every JSX attribute `attr` (on tag `tag`, or on any element
 *  when `tag` is null). A value the reader cannot resolve throws. */
function attributeOrigins(file: string, text: string, tag: string | null, attr: string): string[] {
  const out: string[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      if (tag === null || n.tagName.getText() === tag) {
        for (const a of n.attributes.properties) {
          if (!ts.isJsxAttribute(a) || a.name.getText() !== attr) continue
          const init = a.initializer
          const value = init && ts.isJsxExpression(init) ? init.expression : init
          const prefix = value ? literalPrefix(value) : null
          if (prefix === null) throw new Error(`${file}: <${n.tagName.getText()} ${attr}> is not a literal URL`)
          out.push(originOf(prefix, file))
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(parse(file, text))
  return out
}

const mapHosts = [...new Set(literalOrigins(MAP_STYLE, read(MAP_STYLE)))]
const frameHosts = [...new Set(attributeOrigins(MEDIA_EMBED, read(MEDIA_EMBED), 'iframe', 'src'))]
const faviconHosts = [...new Set(attributeOrigins(SPECIES_LINKS, read(SPECIES_LINKS), null, 'faviconSrc'))]

// The one host that exists only in the policy. https://ebird.org/favicon.ico
// answers 302 to this S3 bucket, and CSP checks the redirect target, so it is
// in img-src while no source line names it. eBird chooses it and may move it;
// a miss shows the mark's bundled glyph, never a broken link.
const EBIRD_FAVICON_REDIRECT_HOST = 'https://is-ebird-web-static-content-prod.s3.amazonaws.com'

const sorted = (xs: Iterable<string>) => [...xs].sort()

describe('the Tauri CSP (tauri.conf.json app.security)', () => {
  it.each([
    // script-src carries no 'unsafe-inline' and no 'unsafe-eval'. Tauri hashes
    // index.html's inline boot script at build and adds the hash itself; if it
    // did not, the launch splash would never release.
    ['script-src', ["'self'"]],
    // 'unsafe-inline' is load-bearing: the HTML-string style="" attributes on the
    // Map Explorer legend teardrops, the Species Detail pin and the Media Targets
    // chip icons are dropped without it. React style props go through CSSOM and
    // are unaffected.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['default-src', ["'self'"]],
    // blob: is a hedge for MapLibre's blob-module worker fallback, which it takes
    // only when the worker URL's origin reads differently from location.origin;
    // the built Mac app reads both as tauri://localhost and takes the direct path.
    ['worker-src', ["'self'", 'blob:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    // form-action does not fall back to default-src. The app has no form and no
    // native navigation handler, so nothing else would stop a form submission
    // from carrying its fields to another host.
    ['form-action', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
  ])('%s is exactly %j', (directive, sources) => {
    expect(policy[directive]).toEqual(sources)
  })

  it('carries exactly the directives this file pins, and no others', () => {
    // A more specific directive overrides its parent (script-src-elem over
    // script-src, style-src-elem over style-src), and a new one such as font-src
    // would be bounded by no row here, so the SET of names is pinned too.
    expect(sorted(Object.keys(policy))).toEqual(sorted([
      'default-src', 'script-src', 'style-src', 'img-src', 'connect-src', 'worker-src',
      'frame-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors',
    ]))
  })

  it('no directive admits a wildcard or a whole scheme of hosts', () => {
    for (const [directive, sources] of Object.entries(policy)) {
      for (const s of sources) {
        expect(s.includes('*'), `${directive} admits ${s}`).toBe(false)
        expect(['https:', 'http:', 'wss:', 'ws:'], `${directive} admits every ${s} host`).not.toContain(s)
      }
    }
  })

  it('Tauri may rewrite every directive except style-src', () => {
    // Tauri adds a nonce to style-src whenever it may modify it, and any nonce or
    // hash makes a browser IGNORE 'unsafe-inline'. Script modification stays on,
    // because that is what admits the boot script.
    expect(security.dangerousDisableAssetCspModification).toEqual(['style-src'])
  })

  it('connect-src is exactly self, the two IPC origins, and the map hosts mapStyle.ts names', () => {
    expect(sorted(policy['connect-src']!)).toEqual(
      sorted(["'self'", 'ipc:', 'http://ipc.localhost', ...mapHosts]))
  })

  it('img-src is exactly self, data:, blob:, the map and favicon hosts, and eBird\'s redirect host', () => {
    // data: for maplibre-gl.css's control icons and the splash glyph; blob: for
    // MapLibre's image decoding. The map hosts cover MapLibre's HTMLImageElement
    // tile path, which it takes when tile refresh is off.
    expect(sorted(policy['img-src']!)).toEqual(
      sorted(new Set(["'self'", 'data:', 'blob:', ...mapHosts, ...faviconHosts, EBIRD_FAVICON_REDIRECT_HOST])))
  })

  it('frame-src is exactly the iframe host MediaEmbed.tsx frames', () => {
    expect(sorted(policy['frame-src']!)).toEqual(sorted(frameHosts))
  })

  it('no platform overlay replaces app.security, so every platform runs this policy', () => {
    // Tauri merges tauri.<platform>.conf.json (and any --config overlay) over this
    // file as a JSON merge patch, so an overlay carrying app.security would
    // silently swap the policy on that platform.
    const dir = at('src-tauri/')
    const overlays = readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isFile() && /^tauri\..+\.conf\.json$/.test(d.name))
      .map(d => d.name)
    expect(overlays.length, 'no overlays found: the scan read the wrong directory').toBeGreaterThan(0)
    for (const name of overlays) {
      const o = JSON.parse(read(`src-tauri/${name}`)) as { app?: { security?: unknown } }
      expect(o.app?.security, `${name} overrides app.security`).toBeUndefined()
    }
  })
})

// GUARD THE GUARD. The readers are hand-written over the TypeScript AST, so each
// is shown to find its call site in the real source and to read only live code.
// Without these, a reader that matched nothing would make every host row above
// vacuous: an empty set is a subset of anything.
describe('the CSP source readers', () => {
  it('find every call site in the real source', () => {
    // mapStyle.ts: the scan sees at least every host the module exports. This is
    // a second derivation, by import rather than by reading text.
    const exported = [
      ...Object.values(VECTOR_STYLE_URL),
      ...Object.values(RASTER_BASES).flatMap(b => b.tiles),
      ...TRAILS_TILES,
    ].map(u => new URL(u).origin)
    expect(exported.length).toBeGreaterThan(0)
    for (const o of exported) expect(mapHosts, `the scan missed ${o}`).toContain(o)
    expect(frameHosts, 'MediaEmbed.tsx frames exactly one host').toHaveLength(1)
    expect(faviconHosts.length, 'SpeciesLinks.tsx names no favicon').toBeGreaterThan(0)
  })

  it('read live code only: a commented-out load is not a load', () => {
    const fixture = [
      "// const OLD = 'https://old.example/tiles/{z}'",
      "/* <iframe src={`https://old-frame.example/x`} /> */",
      'export const LIVE = "https://live.example/tiles/{z}"',
      'export const A = () => <>',
      '  {/* <iframe src="https://hidden-frame.example/" /> */}',
      '  <iframe src={`https://live-frame.example/asset/${id}/embed`} title="t" />',
      '  <Mark faviconSrc="https://live-icon.example/favicon.ico" />',
      '  {/* <Mark faviconSrc="https://hidden-icon.example/favicon.ico" /> */}',
      '</>',
    ].join('\n')
    expect(literalOrigins('f.tsx', fixture).sort()).toEqual(
      ['https://live-frame.example', 'https://live-icon.example', 'https://live.example'])
    expect(attributeOrigins('f.tsx', fixture, 'iframe', 'src')).toEqual(['https://live-frame.example'])
    expect(attributeOrigins('f.tsx', fixture, null, 'faviconSrc')).toEqual(['https://live-icon.example'])
  })

  it('fail closed on a src that names no fixed origin', () => {
    const variable = 'export const A = () => <iframe src={url} />'
    const dynamicHost = 'export const A = () => <iframe src={`https://${host}/embed`} />'
    // The host's own text is fixed but a substitution follows it directly, so
    // `${rest}` could still be `.evil.example` or `:8443`.
    const openHost = 'export const A = () => <iframe src={`https://example.org${rest}`} />'
    expect(() => attributeOrigins('f.tsx', variable, 'iframe', 'src')).toThrow(/not a literal URL/)
    expect(() => attributeOrigins('f.tsx', dynamicHost, 'iframe', 'src')).toThrow(/fixed https origin/)
    expect(() => attributeOrigins('f.tsx', openHost, 'iframe', 'src')).toThrow(/fixed https origin/)
  })
})

// ── The worker policy: the window built in code, and the hook ────────────────

const LIB_RS = 'src-tauri/src/lib.rs'
const WORKER_CSP_RS = 'src-tauri/src/worker_csp.rs'

/** Rust with commented-out lines dropped: whole-line `//` (doc comments
 *  included) and a `/*` block that opens a line. Line-based, as in
 *  `singleWebviewInvariant.test.ts`, so it never damages a `//` inside a string
 *  on a code line, and a line wrongly dropped turns a `toContain` red, which is
 *  loud. These rows must never be satisfied by a call that is commented out. */
function rustCode(text: string): string {
  const kept: string[] = []
  let inBlock = false
  for (const line of text.split('\n')) {
    const t = line.trimStart()
    if (inBlock) {
      if (t.includes('*/')) inBlock = false
      continue
    }
    if (t.startsWith('//')) continue
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) inBlock = true
      continue
    }
    kept.push(line)
  }
  return kept.join('\n')
}

/** Code with every `#[cfg(test)] mod name { ... }` removed, by brace depth. */
function withoutTestModules(code: string): string {
  let out = code
  for (;;) {
    const m = /#\[cfg\(test\)\]\s*mod \w+ \{/.exec(out)
    if (m === null) return out
    let depth = 0
    let i = m.index + m[0].length - 1
    for (; i < out.length; i++) {
      if (out[i] === '{') depth++
      else if (out[i] === '}' && --depth === 0) break
    }
    if (depth !== 0) throw new Error('a test module never closes')
    out = out.slice(0, m.index) + out.slice(i + 1)
  }
}

const count = (text: string, needle: string) => text.split(needle).length - 1

const libCode = rustCode(read(LIB_RS))
const libShipped = withoutTestModules(libCode)
const workerCode = rustCode(read(WORKER_CSP_RS))
const workerShipped = withoutTestModules(workerCode)

/** The text of the one setup closure, from `.setup(|app| {` to its `Ok(())`. */
function setupBody(code: string): string {
  const start = code.indexOf('.setup(|app| {')
  expect(start, 'lib.rs has no `.setup(|app| {` closure').toBeGreaterThanOrEqual(0)
  const end = code.indexOf('Ok(())', start)
  expect(end, 'the setup closure has no `Ok(())`').toBeGreaterThan(start)
  return code.slice(start, end)
}

// Every CSP directive name: the configured ones, plus the rest of CSP Level 3,
// so a directive typed in Rust that the config does not carry is caught too.
const DIRECTIVE_NAMES = new Set([
  ...Object.keys(policy),
  'script-src-elem', 'script-src-attr', 'style-src-elem', 'style-src-attr', 'font-src', 'media-src',
  'child-src', 'manifest-src', 'sandbox', 'upgrade-insecure-requests', 'report-uri', 'report-to',
  'require-trusted-types-for', 'trusted-types',
])

describe('the worker policy (the main window built in code, with its hook)', () => {
  const windows = (conf as unknown as { app: { windows: Array<Record<string, unknown>> } }).app.windows

  it('config creates no window and code creates exactly one, from that config entry, labelled main', () => {
    // The two halves of one change: `create: false` with no window built in
    // code opens the app with no window; a window built in code while config
    // still creates one fails setup() on a duplicate label and aborts launch.
    expect(windows, 'tauri.conf.json must declare exactly one window').toHaveLength(1)
    expect(windows[0]!.create, 'app.windows[0].create must be false: lib.rs builds the window').toBe(false)
    // The label comes from config (absent means Tauri's default, main), and it
    // is what every capability names, or the window gets no permissions.
    expect(windows[0]!.label ?? 'main').toBe('main')
    for (const name of readdirSync(at('src-tauri/capabilities/'))) {
      if (!name.endsWith('.json')) continue
      const cap = JSON.parse(read(`src-tauri/capabilities/${name}`)) as { windows?: unknown }
      expect(cap.windows, `${name} names a window other than main`).toEqual(['main'])
    }
    expect(count(libShipped, 'WebviewWindowBuilder::from_config('), 'lib.rs must build exactly one window').toBe(1)
    // Built from the config entry, so its label is read, never typed again.
    const built = /WebviewWindowBuilder::from_config\(\s*app\.handle\(\),\s*&(\w+)\s*\)/.exec(libShipped)
    expect(built, 'from_config is not handed the config window').not.toBeNull()
    expect(libShipped).toMatch(new RegExp(
      `let ${built![1]} = app\\s*\\.config\\(\\)\\s*\\.app\\s*\\.windows\\s*\\.first\\(\\)`))
    expect(libShipped, 'lib.rs types the window label again').not.toMatch(/"main"/)
  })

  it('the hook is attached before the window is built, and the window is built first', () => {
    const body = setupBody(libShipped)
    const from = body.indexOf('from_config(')
    const hook = body.indexOf('.on_web_resource_request(')
    const build = body.indexOf('.build()?;')
    expect(from, 'the window is not built in the setup closure').toBeGreaterThan(0)
    expect(count(body, '.on_web_resource_request('), 'exactly one hook').toBe(1)
    expect(hook, 'the hook must be attached to the builder, before build()').toBeGreaterThan(from)
    expect(build, 'the window is never built').toBeGreaterThan(hook)
    // Nothing runs before the window, and nothing gates it: window_geometry and
    // the launch backdrop both need it, and every platform needs a window.
    expect(body.slice(0, from), 'something gated or ran before the window').not.toMatch(/#\[cfg|::install\(|keep_window_on_screen/)
  })

  it('lib.rs has exactly one setup closure, on the builder every target shares', () => {
    // Builder::setup keeps only its last closure, so the last `.setup` wins: a
    // second one chained AFTER the shared closure replaces it and that platform
    // (Android included, once it lands) opens with no window, and one placed
    // BEFORE it, on a platform `let builder` line, is silently ignored and its
    // step never runs. This row refuses both shapes.
    expect(count(libShipped, '.setup('), 'lib.rs must call Builder::setup exactly once').toBe(1)
    // Directly on the final `builder` expression, with no cfg attribute between
    // the previous statement and it.
    expect(libShipped, 'the setup closure is not on the unconditional builder').toMatch(/;\s*builder\s*\.setup\(\|app\| \{/)
  })

  it('the Rust reads the policy from config: no host and no directive name is typed outside tests', () => {
    expect(libShipped).toContain('worker_csp::policy_header(app.config().app.security.csp.as_ref())')
    expect(workerShipped).toMatch(/pub fn policy_header\(csp: Option<&Csp>\)/)
    for (const [file, code] of [[LIB_RS, libShipped], [WORKER_CSP_RS, workerShipped]] as const) {
      expect(code, `${file} types a URL`).not.toMatch(/https?:\/\//)
      for (const name of DIRECTIVE_NAMES) {
        expect(new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(code), `${file} types the directive ${name}`).toBe(false)
      }
      expect(code, `${file} types a directive name`).not.toMatch(/[a-z]-src(?![\w-])/)
    }
  })

  it('a dev build attaches nothing: the hook passes is_dev, and the predicate refuses it first', () => {
    const hook = setupBody(libShipped).slice(setupBody(libShipped).indexOf('.on_web_resource_request('))
    expect(hook).toMatch(/^\.on_web_resource_request\(move \|_request, response\| \{\s*worker_csp::attach\(tauri::is_dev\(\), response,/)
    expect(workerShipped).toMatch(/pub fn should_attach\(is_dev: bool, content_type: Option<&str>\) -> bool \{\s*if is_dev \{\s*return false;/)
    expect(workerCode, 'the Rust row for the dev gate is gone').toMatch(/#\[test\]\s*fn a_dev_build_attaches_nothing\(\)/)
  })

  it('an HTML response is never touched: the one header write sits behind the content-type check', () => {
    expect(count(workerShipped, '.insert('), 'worker_csp.rs writes a header in more than one place').toBe(1)
    expect(workerShipped).toMatch(/\.get\(CONTENT_TYPE\)/)
    expect(workerShipped).toMatch(/if should_attach\(is_dev, content_type\) \{\s*response\s*\.headers_mut\(\)\s*\.insert\(CONTENT_SECURITY_POLICY,/)
    expect(workerShipped).toContain('!essence.eq_ignore_ascii_case("text/html")')
    expect(workerCode, 'the Rust row for HTML is gone').toMatch(/#\[test\]\s*fn an_html_response_is_never_touched\(\)/)
    expect(workerCode, 'the Rust row for the real config is gone').toMatch(/#\[test\]\s*fn the_header_carries_exactly_the_configured_directive_map\(\)/)
  })

  it('no platform overlay sets app.windows, so every platform builds this one window', () => {
    // An overlay is a JSON merge patch, and a `windows` array in one replaces the
    // whole list: `create` back to true there means a duplicate label on that
    // platform, a missing `create` the same.
    const overlays = readdirSync(at('src-tauri/'), { withFileTypes: true })
      .filter(d => d.isFile() && /^tauri\..+\.conf\.json$/.test(d.name))
      .map(d => d.name)
    expect(overlays.length, 'no overlays found: the scan read the wrong directory').toBeGreaterThan(0)
    for (const name of overlays) {
      const o = JSON.parse(read(`src-tauri/${name}`)) as { app?: { windows?: unknown } }
      expect(o.app?.windows, `${name} overrides app.windows`).toBeUndefined()
    }
  })

  // Guard the guard: each reader is shown to strip what it claims to strip and
  // keep what it claims to keep, so no row above passes over an empty string.
  it('the Rust readers drop comments and test modules, and keep the shipped code', () => {
    expect(read(WORKER_CSP_RS)).toMatch(/\/\/!.*script-src/)
    expect(workerCode).not.toMatch(/\/\/!/)
    expect(workerCode).toContain('fn the_header_carries_exactly_the_configured_directive_map()')
    expect(workerShipped).not.toContain('fn the_header_carries_exactly_the_configured_directive_map()')
    expect(workerShipped).toContain('pub fn should_attach(')
    expect(workerShipped).toContain('pub fn attach(')
    expect(libCode).toContain('fn an_empty_name_becomes_the_fallback_zone()')
    expect(libShipped).not.toContain('fn an_empty_name_becomes_the_fallback_zone()')
    expect(libShipped).toContain('pub fn run()')
    expect(libShipped).toContain('.run(tauri::generate_context!())')
    expect(withoutTestModules('a\n#[cfg(test)]\nmod t {\n fn x() { let s = "{y}"; }\n}\nb')).toBe('a\n\nb')
    expect(() => withoutTestModules('#[cfg(test)]\nmod t {\n fn x() {\n')).toThrow(/never closes/)
  })
})
