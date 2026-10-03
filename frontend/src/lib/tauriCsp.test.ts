/// <reference types="node" />
// THE TAURI CONTENT SECURITY POLICY (improve: desktop-csp-frame-protection).
//
// WHAT IT GUARDS. `src-tauri/tauri.conf.json` `app.security.csp` is the one
// policy the Mac, Windows, iPhone and iPad apps share: one webview, one config.
// It replaced `"csp": null`. The page may run only its own bundled scripts,
// talk only to the hosts it already uses, and frame only the Macaulay Library
// embed. API calls (eBird, OpenWeather, NOAA, Nominatim, GitHub) go through the
// http plugin over IPC, so they need no host here; only the IPC origins do.
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
// WHAT IT CANNOT SEE. The http plugin's `https://**` fetch scope is outside the
// page's CSP (Rust makes that request), and an iframe or image added at a call
// site other than these three is not read here (`.claude/rules/security.md`).
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
