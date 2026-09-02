// Build-inspection test (NFR-03 / QA-30) — the County overlay's maplibre-coupled
// code and its geometry asset must stay OFF the entry chunk, reachable only via
// `import()` / React.lazy. This is the same standing check CLAUDE.md applies
// manually to `vendor-maplibre` and `ca-atlas-blocks.json`, encoded as a test.
//
// Primary check (always runs, no build needed): walk App.tsx's STATIC import
// graph — following only value (non-type) relative / "@/" imports, NOT `import()`
// or `lazy(() => import())` — and assert CountyLayer.tsx and us-counties.json are
// absent. As methodology sanity, the known-lazy AtlasLayer / ca-atlas-blocks must
// also be absent, and no statically-reachable file may import maplibre.
//
// Secondary check (only when a production build exists): assert the county
// geometry chunk is not in dist/index.html's modulepreload — the literal
// vendor-maplibre standing check, extended to us-counties.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../', import.meta.url))        // frontend/src/
const APP = resolve(SRC, 'App.tsx')

/**
 * Strip comments before scanning, tracking string and template state so a URL's
 * `//` is never mistaken for a line comment.
 *
 * NOT defensive tidiness. Without it, the word "import" or "export" inside a
 * prose comment starts the lazy specifier match, which then runs forward to the
 * NEXT real `from '...'` and reports an edge that does not exist. Its sibling
 * `exoticProvenanceGraph.test.ts` hit exactly that on its first run, and
 * CLAUDE.md has recorded since v0.5.87 that THIS file still carried the
 * weakness. Closed here because report-as-countability adds a new always-loaded
 * asset, which is precisely what this file exists to police.
 */
function stripComments(code: string): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i += 1
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') { out += code[i]; i += 1 }
        if (i < code.length) { out += code[i]; i += 1 }
      }
      out += quote
      i += 1
      continue
    }
    out += c
    i += 1
  }
  return out
}

// Static import / re-export specifiers in a TS/TSX source, EXCLUDING:
//  - dynamic `import(` (needs whitespace after `import`, so `import(` never matches)
//  - type-only `import type` / `export type` (erased at build — no runtime edge)
function staticSpecifiers(source: string): string[] {
  const code = stripComments(source)
  const specs: string[] = []
  const fromRe = /(?:import|export)\s+[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(code)) !== null) {
    if (/^(?:import|export)\s+type\b/.test(m[0].trim())) continue // type-only, erased
    specs.push(m[1])
  }
  const sideRe = /import\s*['"]([^'"]+)['"]/g                      // side-effect: import './x.css'
  while ((m = sideRe.exec(code)) !== null) specs.push(m[1])
  return specs
}

// Resolve a relative / "@/" specifier to an on-disk file; null for bare (node_modules).
function resolveLocal(spec: string, fromFile: string): string | null {
  const clean = spec.split('?')[0] // strip ?raw / ?worker
  let base: string
  if (clean.startsWith('@/')) base = resolve(SRC, clean.slice(2))
  else if (clean.startsWith('.')) base = resolve(dirname(fromFile), clean)
  else return null // bare specifier (external)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`]
  return candidates.find(p => existsSync(p) && !p.endsWith('/')) ?? null
}

// Transitive closure of a ROOT's static graph: resolved local file paths + the
// set of bare (external) specifiers reached.
//
// Parameterized on the root (county-shading-and-project-stats, FR-21). It was
// hard-wired to App.tsx, with the Calendar test carrying an ad-hoc copy of the
// same walk; three subtrees now need it (Calendar, Species Detail, Statistics),
// so the copy is replaced rather than multiplied.
function closureFrom(root: string): { files: Set<string>; externals: Set<string> } {
  const files = new Set<string>()
  const externals = new Set<string>()
  const stack = [root]
  while (stack.length) {
    const file = stack.pop()!
    if (files.has(file)) continue
    files.add(file)
    if (!/\.tsx?$/.test(file)) continue // only follow TS/TSX
    const specs = staticSpecifiers(readFileSync(file, 'utf8'))
    for (const spec of specs) {
      const local = resolveLocal(spec, file)
      if (local) { if (!files.has(local)) stack.push(local) }
      else if (!spec.startsWith('.') && !spec.startsWith('@/')) externals.add(spec)
    }
  }
  return { files, externals }
}

const hasIn = (fs: Set<string>, suffix: string) =>
  [...fs].some(f => f.replace(/\\/g, '/').endsWith(suffix))
const maplibreIn = (ext: Set<string>) =>
  [...ext].filter(s => s === 'maplibre-gl' || s.startsWith('react-map-gl'))

const { files, externals } = closureFrom(APP)
const has = (suffix: string) => hasIn(files, suffix)

describe('entry-chunk exclusion (NFR-03 / QA-30)', () => {
  it('App.tsx does not statically import CountyLayer (it is lazy via MapExplorer)', () => {
    expect(has('components/map/CountyLayer.tsx')).toBe(false)
  })

  it('App.tsx does not statically import the county geometry asset', () => {
    expect(has('assets/us-counties.json')).toBe(false)
  })

  it('App.tsx does not statically import the shared county-geometry loader (FR-21)', () => {
    // lib/countyGeometry.ts is the ONE load site for the 3.85 MB asset. It is
    // dependency-free at runtime (its only import is a TYPE import, erased at
    // build), so it could ride the entry chunk without dragging anything with
    // it — which is exactly why the negative has to be asserted rather than
    // inferred from the asset's own absence.
    expect(has('lib/countyGeometry.ts')).toBe(false)
  })

  it('the checklist `fields=` flag table stays off the entry chunk (NFR-04, QA-23)', () => {
    // THE ONE MODULE THAT MADE "NO ENTRY-CHUNK GROWTH" FALSE. `transport.ts` is
    // in the first-paint set, and it statically imported `lib/checklistFields.ts`
    // to resolve the flags before handing them to the dynamically-imported
    // desktop service — putting the whole table on the entry chunk for a mapping
    // only that service uses. The transport now passes the raw `fields` string
    // and the service resolves it, so the table rides the lazy chunk with its
    // only consumer.
    expect(has('lib/checklistFields.ts')).toBe(false)
    // Non-vacuity, and the reason this assertion is not trivially true: the
    // module that USED to import it really is on the entry graph, so the walk
    // would find the table if the edge were still there.
    expect(has('lib/transport.ts')).toBe(true)
  })

  it('the desktop checklist service, which owns the table now, is off it too', () => {
    // It is reached only through `await import('./tauri/checklistService')`, so
    // moving the table there costs the entry chunk nothing rather than moving
    // the weight sideways.
    expect(has('lib/tauri/checklistService.ts')).toBe(false)
    const svc = closureFrom(resolve(SRC, 'lib/tauri/checklistService.ts'))
    expect(hasIn(svc.files, 'lib/checklistFields.ts')).toBe(true)
  })

  it('the county-completeness code is only reachable through the lazy Map Explorer (NFR-02)', () => {
    expect(has('lib/countyCompleteness.ts')).toBe(false)
    expect(has('lib/countyCompletenessCache.ts')).toBe(false)
    expect(has('lib/useCountyCompleteness.ts')).toBe(false)
    expect(has('components/map/CountyCompletenessPopup.tsx')).toBe(false)
  })

  it('the Pin Share map-coupled files are only reachable through a lazy map tab (NFR-10)', () => {
    // Settings.tsx IS on App.tsx's static graph and imports lib/shareCopyPreference,
    // which re-exports ShareCopySelection from lib/shareLocation — so BOTH of those
    // lib modules must stay map-free, and these three components must stay off
    // the entry graph. If either lib module ever imports a map type (or an
    // `import type` a later refactor promotes to a value import), the ~1 MB
    // maplibre vendor chunk lands on first paint.
    expect(has('components/map/SharePin.tsx')).toBe(false)
    expect(has('components/map/SharePopup.tsx')).toBe(false)
    expect(has('components/map/useMapLongPressDrop.ts')).toBe(false)
  })

  it('the Pin Share lib modules ARE on the entry graph, which is what makes the check above live', () => {
    // Guards the guard: if Settings ever stopped importing the preference, the
    // map-free assertion would pass vacuously.
    expect(has('lib/shareCopyPreference.ts')).toBe(true)
    expect(has('lib/shareLocation.ts')).toBe(true)
  })

  it('the 1.7 MB taxonomy snapshot stays off the entry graph (report-as-countability)', () => {
    // Live risk since the countability build: the shipped rule is derived FROM
    // that snapshot, so the obvious "simplification" is to import it here and
    // compute the verdict at load. It is dynamic-imported by taxonomyService for
    // a reason, and a static edge would put 1.7 MB on first paint.
    expect(has('assets/ebird-taxonomy.json')).toBe(false)
  })

  it('the countability artifact IS on the entry graph, and is the small one', () => {
    // Guards the guard above: the rule really is statically resolved (no load
    // order, no flicker, no async predicate), and the file carrying it is the
    // 169-name corrections list rather than a full verdict table. If this ever
    // grows past a few tens of KB, the compression has been abandoned.
    expect(has('assets/ebird-countability.json')).toBe(true)
    const artifact = readFileSync(resolve(SRC, 'assets/ebird-countability.json'), 'utf8')
    expect(artifact.length).toBeLessThan(20_000)
  })

  it('methodology sanity: the known-lazy AtlasLayer / ca-atlas-blocks are also absent', () => {
    // If these appeared, the resolver would be wrong (or someone broke the
    // map-lazy rule); the County checks above would then be meaningless.
    expect(has('components/AtlasLayer.tsx')).toBe(false)
    expect(has('assets/ca-atlas-blocks.json')).toBe(false)
  })

  it('no statically-reachable file imports maplibre (vendor-maplibre off first paint)', () => {
    const maplibre = [...externals].filter(s => s === 'maplibre-gl' || s.startsWith('react-map-gl'))
    expect(maplibre).toEqual([])
  })

  it('App.tsx does not statically import the Calendar tab (it is lazy) (OQ-09)', () => {
    // Calendar is React.lazy(() => import('./components/Calendar')); its subtree
    // (and the ChecklistLink etc. it uses) must not join App.tsx's static closure.
    expect(has('components/Calendar.tsx')).toBe(false)
  })

  it('no calendar file statically imports maplibre / SnowMap / SightingsMap (FR-43)', () => {
    // Walk the Calendar subtree independently and assert it is map-free. Uses
    // the shared `closureFrom` rather than the ad-hoc copy of the same walk it
    // carried before (FR-21).
    const cal = closureFrom(resolve(SRC, 'components/Calendar.tsx'))
    const calFiles = [...cal.files].map(p => p.replace(/\\/g, '/'))
    expect(calFiles.some(p => /components\/(SnowMap|SightingsMap)\.tsx$/.test(p))).toBe(false)
    expect(hasIn(cal.files, 'components/map/CountyLayer.tsx')).toBe(false)
    expect(maplibreIn(cal.externals)).toEqual([])
    // Guard the guard: a walk that resolved nothing would satisfy every
    // negative above. The Calendar really does have a graph.
    expect(cal.files.size).toBeGreaterThan(10)
  })

  // ── The two NEW county mount sites (county-shading-and-project-stats, FR-21)
  // Each host is asserted TWICE and the pair is the point:
  //   1. the host is absent from App.tsx's static closure — otherwise its now
  //      STATIC CountyLayer import would drag maplibre onto first paint;
  //   2. the host's OWN subtree walk actually REACHES CountyLayer, and does NOT
  //      reach the geometry asset or the shared loader.
  // Without (2), (1) plus the geometry negatives would pass vacuously on a build
  // that never wired the overlay at all.
  //
  // The static/dynamic split is the inverse of the intuitive reading, and it is
  // forced by this file's own walker: it follows STATIC edges only, so a DYNAMIC
  // CountyLayer import would make the guard-the-guard unsatisfiable and fail a
  // correct implementation. CountyLayer is therefore static at each host and the
  // GEOMETRY LOADER is dynamic at all three call sites, which is what keeps the
  // 3.85 MB asset two dynamic hops from any host.
  const HOSTS: Array<[string, string]> = [
    ['Species Detail', 'components/SpeciesDetail.tsx'],
    ['Statistics', 'components/BirdingStats.tsx'],
  ]

  it.each(HOSTS)('%s is off the App static closure', (_label, host) => {
    expect(has(host)).toBe(false)
  })

  it.each(HOSTS)('%s statically reaches CountyLayer (guards the guard)', (_label, host) => {
    const sub = closureFrom(resolve(SRC, host))
    expect(hasIn(sub.files, 'components/map/CountyLayer.tsx')).toBe(true)
    expect(sub.files.size).toBeGreaterThan(20) // a real graph, not a short-circuited one
  })

  it.each(HOSTS)('%s does NOT statically reach the geometry asset or its loader', (_label, host) => {
    const sub = closureFrom(resolve(SRC, host))
    expect(hasIn(sub.files, 'assets/us-counties.json')).toBe(false)
    expect(hasIn(sub.files, 'lib/countyGeometry.ts')).toBe(false)
  })

  it.each(HOSTS)('%s reaches no completeness CONTROLLER (FR-16, QA-18)', (_label, host) => {
    // NOTE the module named here. `lib/countyCompleteness.ts` is the PURE band
    // table and CANNOT be excluded: CountyLayer statically imports
    // CountyCompletenessPopup, which value-imports `cacheLineText` / `monthDay`
    // from it, so a correct implementation necessarily pulls it in. The thing
    // FR-16 is actually about is the CONTROLLER — the module that fetches
    // /map/county-species — and that is imported only by MapExplorer.
    const sub = closureFrom(resolve(SRC, host))
    expect(hasIn(sub.files, 'lib/useCountyCompleteness.ts')).toBe(false)
    // Guard the guard for THIS assertion specifically: the pure module IS
    // reachable, which is what proves the walk is finding CountyLayer's real
    // subtree rather than stopping short of it.
    expect(hasIn(sub.files, 'lib/countyCompleteness.ts')).toBe(true)
  })

  it('the MapExplorer keeps the completeness controller, so the negative above means something', () => {
    const sub = closureFrom(resolve(SRC, 'components/MapExplorer.tsx'))
    expect(hasIn(sub.files, 'lib/useCountyCompleteness.ts')).toBe(true)
    // ...and it too reaches the geometry only dynamically, through the loader.
    expect(hasIn(sub.files, 'assets/us-counties.json')).toBe(false)
    expect(hasIn(sub.files, 'lib/countyGeometry.ts')).toBe(false)
  })

  it('the mobile-only plugins are dynamic-only — never static on the entry graph (mobile-app NFR-06)', () => {
    // location.ts (geolocation) and iosImport.ts (dialog) ARE statically
    // reachable from App.tsx, so this assertion is live: their plugin loads
    // must stay `await import(...)` so desktop/web bundles never execute them
    // and the entry chunk never grows. plugin-os is deliberately static (a
    // few-KB sync probe backing isIOS()); it is not in this list.
    const mobilePlugins = [...externals].filter(
      s => s.startsWith('@tauri-apps/plugin-geolocation') || s.startsWith('@tauri-apps/plugin-dialog'),
    )
    expect(mobilePlugins).toEqual([])
  })

  // ── iCloud Sync (icloud-sync, NFR-09 / QA-44): the controller and the
  // native wrapper (which statically import @tauri-apps/api) are reached only
  // through App.tsx's `import('./lib/icloud/icloudSync')` after first paint;
  // the entry-safe state store, copy module and file epoch ARE on the graph,
  // which is what makes the negatives mean something.
  it('the iCloud Sync controller and native wrapper are off the entry graph', () => {
    expect(has('lib/icloud/icloudSync.ts')).toBe(false)
    expect(has('lib/icloud/icloudNative.ts')).toBe(false)
    // The event module is imported only by the native wrapper; core is already
    // on the graph through lib/location.ts, so only event is a usable negative.
    expect([...externals]).not.toContain('@tauri-apps/api/event')
  })

  it('the iCloud Sync state store, copy and the file epoch ARE on the entry graph (guards the guard)', () => {
    expect(has('lib/icloud/icloudState.ts')).toBe(true)
    expect(has('lib/icloud/icloudCopy.ts')).toBe(true)
    expect(has('lib/filesChanged.ts')).toBe(true)
    expect(has('lib/useFilesEpoch.ts')).toBe(true)
    expect(has('lib/platformGates.ts')).toBe(true)
    // And the negative above is asserting about a real edge: the controller
    // reaches the native wrapper through `import()` (a dynamic edge this
    // walker deliberately does not follow), and the wrapper's OWN closure is
    // what carries @tauri-apps/api/event.
    const ctrlSrc = readFileSync(resolve(SRC, 'lib/icloud/icloudSync.ts'), 'utf8')
    expect(ctrlSrc).toContain("import('./icloudNative')")
    const wrapper = closureFrom(resolve(SRC, 'lib/icloud/icloudNative.ts'))
    expect([...wrapper.externals]).toContain('@tauri-apps/api/event')
    expect([...wrapper.externals]).toContain('@tauri-apps/api/core')
  })

  // ── iCloud API key sync (icloud-api-key-sync NFR-08 / QA-47): the entry
  // graph may carry the store, the platform gate, the copy, the record
  // types/bounds and the keys epoch; the pure RECONCILE table is
  // controller-only (proving the logic did not leak into Settings), and the
  // controller and wrapper stay off as before.
  it('the keys epoch and the key record module ARE on the entry graph; the key reconcile table is NOT', () => {
    expect(has('lib/keysChanged.ts')).toBe(true)
    expect(has('lib/useKeysEpoch.ts')).toBe(true)
    expect(has('lib/icloud/keyRecord.ts')).toBe(true)
    expect(has('lib/icloud/keyReconcile.ts')).toBe(false)
    // And the controller (off the graph) really is what reaches the table.
    const ctrl = closureFrom(resolve(SRC, 'lib/icloud/icloudSync.ts'))
    expect(hasIn(ctrl.files, 'lib/icloud/keyReconcile.ts')).toBe(true)
    expect(hasIn(ctrl.files, 'lib/icloud/keyRecord.ts')).toBe(true)
  })

  it('the App entry actually exists (guards against a broken closure root)', () => {
    expect(files.has(APP)).toBe(true)
    expect(files.size).toBeGreaterThan(20) // a real graph, not an empty/short-circuited one
  })
})

// Secondary: when a production build is present, assert the county chunk is not
// preloaded by the entry HTML — the literal CLAUDE.md vendor-maplibre check.
const DIST_INDEX = resolve(SRC, '../dist/index.html')
describe.skipIf(!existsSync(DIST_INDEX))('dist/index.html modulepreload (post-build)', () => {
  const html = existsSync(DIST_INDEX) ? readFileSync(DIST_INDEX, 'utf8') : ''
  it('does not modulepreload the county geometry chunk, completeness code, or maplibre', () => {
    const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map(m => m[1])
    expect(preloads.some(h => /us-counties|CountyLayer|countyCompleteness|vendor-maplibre/i.test(h))).toBe(false)
  })
})
