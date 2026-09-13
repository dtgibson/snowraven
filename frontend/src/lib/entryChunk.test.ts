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
import { readFileSync, existsSync, readdirSync } from 'node:fs'
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
  [...ext].filter(s => s === 'maplibre-gl' || s.startsWith('maplibre-gl/') || s.startsWith('react-map-gl'))

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

  it('the weather-block reader and its section stay off the entry chunk (weather-stats)', () => {
    // Structural rather than lucky: BirdingStats is lazy()-loaded in App.tsx, so
    // everything reachable only through it is already off first paint. Asserted
    // anyway, because the invariant that keeps it true is one static import
    // away from being false, and nothing else would say so.
    expect(has('lib/weatherBlockParse.ts')).toBe(false)
    expect(has('lib/weatherStats.ts')).toBe(false)
    expect(has('components/WeatherStatsSection.tsx')).toBe(false)
    // The chain they hang off is off it too.
    expect(has('lib/statsBundle.ts')).toBe(false)
    // Non-vacuity: weatherFormatter IS on the entry graph (the Weather tab's own
    // code path reaches it), so the walk would find these three if an edge
    // existed. Without this the assertions above could pass on a broken walk.
    expect(has('components/BirdingStats.tsx')).toBe(false)
    expect(has('App.tsx')).toBe(true)
  })

  it('the Species Detail Weather card and its seam stay off the entry chunk (species-detail-weather)', () => {
    // Structural rather than lucky: `SpeciesDetail` is reached only through
    // `lazy(() => import('./components/SpeciesDetail'))`, so every static import
    // inside it is off first paint by construction, and the CARD is itself
    // reached through a second `lazy` inside that. Asserted anyway, because "it
    // is off today" is not the same claim as "it is guarded", and one static
    // import in App.tsx is all it would take.
    expect(has('lib/weatherStatsShared.ts')).toBe(false)
    expect(has('lib/useExportWeather.ts')).toBe(false)
    expect(has('lib/weatherDisplay.ts')).toBe(false)
    expect(has('components/WeatherSpeciesRow.tsx')).toBe(false)
    expect(has('components/SpeciesWeatherCard.tsx')).toBe(false)
    // The three the shipped guard above already covers, restated here so this
    // feature's own row fails on its own terms rather than by borrowing.
    expect(has('lib/weatherStats.ts')).toBe(false)
    expect(has('lib/weatherBlockParse.ts')).toBe(false)
    expect(has('lib/statsBundle.ts')).toBe(false)
    // Non-vacuity: SpeciesDetail itself is genuinely absent from the walk, which
    // is what makes every negative above mean something, and App.tsx is present.
    expect(has('components/SpeciesDetail.tsx')).toBe(false)
    expect(has('App.tsx')).toBe(true)
  })

  it('and the Species Detail subtree really does reach them, which is what makes that negative live', () => {
    // Without this, the assertions above would pass just as happily on a walk
    // that resolved nothing at all -- the failure mode `.claude/rules/testing.md`
    // calls a green line that means "not run".
    const sd = closureFrom(resolve(SRC, 'components/SpeciesDetail.tsx'))
    expect(hasIn(sd.files, 'lib/useExportWeather.ts')).toBe(true)
    expect(hasIn(sd.files, 'lib/weatherStatsShared.ts')).toBe(true)
    expect(hasIn(sd.files, 'lib/weatherStats.ts')).toBe(true)
    // The CARD is NOT on that static graph either: it is `lazy`-imported inside
    // Species Detail, which is NFR-03's structural half -- a user whose export
    // carries no weather block never fetches the chart code at all.
    expect(hasIn(sd.files, 'components/SpeciesWeatherCard.tsx')).toBe(false)
    expect(hasIn(sd.files, 'components/WeatherSpeciesRow.tsx')).toBe(false)
  })

  it('the county-completeness code is only reachable through the lazy Map Explorer (NFR-02)', () => {
    expect(has('lib/countyCompleteness.ts')).toBe(false)
    expect(has('lib/countyCompletenessCache.ts')).toBe(false)
    expect(has('lib/useCountyCompleteness.ts')).toBe(false)
    expect(has('components/map/CountyCompletenessPopup.tsx')).toBe(false)
  })

  it('the clear-path teardown rides the entry chunk without dragging a store onto it', () => {
    // clear-means-clear. Settings.tsx IS on this graph and imports the teardown
    // plainly, so the registry itself is here — it is a slot table with no
    // static imports at all. Every store it tears down is reached through
    // `import()`, which is what keeps countyCompletenessCache (asserted absent
    // above) and the rest off first paint. If a row is ever "simplified" into a
    // static import, that assertion goes red rather than the bundle growing
    // silently.
    expect(has('lib/clearDerived.ts')).toBe(true)
    const registry = closureFrom(resolve(SRC, 'lib/clearDerived.ts'))
    expect(registry.files.size).toBe(1)          // itself, and nothing else
    expect([...registry.externals]).toEqual([])
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
    expect(maplibreIn(externals)).toEqual([])
  })

  it('the lazy SnowMap subtree owns both MapLibre and its Vite-emitted worker (guards the guard)', () => {
    const snowMap = closureFrom(resolve(SRC, 'components/SnowMap.tsx'))
    expect([...snowMap.externals]).toContain('maplibre-gl')
    expect([...snowMap.externals]).toContain('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')
    expect([...snowMap.externals]).toContain('react-map-gl/maplibre')
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

  // ── The command palette (command-palette NFR-01 / QA-57). Every negative is
  // paired with a positive, per this file's own convention: an unpaired negative
  // passes vacuously on a build that never wired the feature at all.
  it('the palette overlay and its lazy half are OFF the entry graph', () => {
    expect(has('components/CommandPalette.tsx')).toBe(false)
    expect(has('lib/speciesIndex.ts')).toBe(false)
    expect(has('lib/speciesMatch.ts')).toBe(false)
    expect(has('lib/paletteRows.ts')).toBe(false)
    expect(has('lib/paletteSpeciesLoad.ts')).toBe(false)
    // SpeciesCombobox really is off it: its only three importers (Calendar,
    // Species Detail, Map Explorer) are all lazy, and the palette must not
    // become a fourth, static one.
    expect(has('components/SpeciesCombobox.tsx')).toBe(false)
  })

  it('the entry-safe half IS on it, which is what makes those negatives mean something', () => {
    // The chord has to work before any lazy chunk has loaded, and the nav's
    // search control needs its label and its hint at first paint. These four are
    // the whole of what rides the entry chunk for this feature.
    expect(has('lib/usePaletteHotkey.ts')).toBe(true)
    expect(has('lib/paletteCopy.ts')).toBe(true)
    expect(has('lib/paletteHint.ts')).toBe(true)
    expect(has('lib/paletteFocus.ts')).toBe(true)
    // The dynamic edge this walker deliberately cannot see, in the one source
    // form App.tsx spells it -- including the idle prefetch, which is the whole
    // of FR-20's "no wait" on a COLD first chord press and the single easiest
    // line in this feature to lose in a merge.
    const appSrc = readFileSync(APP, 'utf8')
    expect(appSrc).toContain("import('./components/CommandPalette')")
    expect(appSrc).toContain('void importCommandPalette()')
  })

  it('and the palette subtree really does reach what those negatives exclude', () => {
    // Guards the guard: without this, the five negatives above would pass on a
    // build where the palette was never wired to any of them.
    const pal = closureFrom(resolve(SRC, 'components/CommandPalette.tsx'))
    expect(hasIn(pal.files, 'lib/speciesIndex.ts')).toBe(true)
    expect(hasIn(pal.files, 'lib/speciesMatch.ts')).toBe(true)
    expect(hasIn(pal.files, 'lib/paletteRows.ts')).toBe(true)
    expect(hasIn(pal.files, 'lib/paletteSpeciesLoad.ts')).toBe(true)
    expect(pal.files.size).toBeGreaterThan(5)
    expect(maplibreIn(pal.externals)).toEqual([])
  })

  it('the palette adds no BirdName edge, which is the honest form of NFR-01', () => {
    // PRD CORRECTION, and it is deliberate rather than an oversight. NFR-01 and
    // QA-57 say `<BirdName>` is off App.tsx's entry graph. That is TRUE of
    // SpeciesCombobox and FALSE of BirdName, which is statically reachable from
    // App.tsx by three independent chains this feature cannot touch:
    //   App.tsx -> NamedBirds.tsx
    //   App.tsx -> LifeList.tsx -> LifeListTable.tsx
    //   App.tsx -> BreedingCodeList.tsx -> BreedingCodeTable.tsx
    // So `expect(has('components/BirdName.tsx')).toBe(false)` would go RED on
    // arrival, and the tempting repair -- editing the assertion -- is what this
    // file's own header names as THE failure mode. The palette's real obligation
    // is not to add a FOURTH edge, and FR-27 already forbids the only way it
    // could, so that is what is asserted, on the palette's own subtree.
    //
    // DO NOT "fix" this later by adding the App-level negative. Moving BirdName
    // off the entry graph means moving NamedBirds, LifeListTable and
    // BreedingCodeTable off it, which is a separate build and belongs on the
    // ROADMAP.
    const pal = closureFrom(resolve(SRC, 'components/CommandPalette.tsx'))
    expect(hasIn(pal.files, 'components/BirdName.tsx')).toBe(false)
    expect(hasIn(pal.files, 'components/SpeciesCombobox.tsx')).toBe(false)
    // Non-vacuity for the correction itself: the three chains really are there,
    // so this is a statement about the world rather than a convenient story.
    expect(has('components/BirdName.tsx')).toBe(true)
  })


  // ── The Named Birds sighting timelines (named-birds-timelines, NFR-01 / NFR-02).
  // `NamedBirds` is a STATIC import in App.tsx while every other heavy tab is
  // lazy, so everything this feature adds is paid for on first paint by every
  // user on every platform. Both assertions are PAIRED, per this file's own
  // convention: an unpaired negative passes vacuously.
  it('no chart library is reachable from App.tsx (NFR-01 / QA-61)', () => {
    // The externals-based maplibre check above had no recharts equivalent, and a
    // `recharts` import inside this feature would put ~112 KB gz of chart library
    // on first paint. Its four importers (BirdingStats, MediaStatsSections,
    // ProjectsSection, speciesDetail/SightingsGraph) are all lazy-only today.
    const charting = [...externals].filter(
      s => s === 'recharts' || s.startsWith('recharts/') || s === 'd3' || s.startsWith('d3-') || s === 'chart.js',
    )
    expect(charting).toEqual([])
    // Guards the guard, twice over: the static tab really IS on this graph, so a
    // chart import added to it would be found...
    expect(has('components/NamedBirds.tsx')).toBe(true)
    expect(has('components/NamedBirdsTable.tsx')).toBe(true)
    // ...and a real recharts edge exists somewhere for the matcher to find, so a
    // broken filter cannot report a clean result for every root.
    const stats = closureFrom(resolve(SRC, 'components/BirdingStats.tsx'))
    expect([...stats.externals]).toContain('recharts')
  })

  it('the timeline modules reach no chart library, no map, no transport and no SegControl', () => {
    // ROOTED AT THE MODULES THIS FEATURE ADDS, deliberately not at
    // NamedBirdsTable: that component imports useHotspotSet, and NamedBirdRow
    // imports NamedBirdMedia / ChecklistLink / HotspotLink, chains that
    // legitimately reach network code this feature neither adds nor uses. A walk
    // rooted at the table would report a transport edge that has nothing to do
    // with these timelines.
    const ROOTS = [
      'lib/namedBirdTimeline.ts',
      'lib/namedBirdTimelineCopy.ts',
      'components/NamedBirdTickList.tsx',
      'components/NamedBirdTimeline.tsx',
      'components/NamedBirdMasterTimeline.tsx',
      'components/NamedBirdRangeControl.tsx',
    ]
    const FORBIDDEN_FILES = [
      'lib/transport.ts',
      'lib/statsFormat.ts',              // the eventual convergence runs the OTHER way
      'components/map/MapSidebarUI.tsx', // SegControl: pulls countyTextures + countyCompleteness
      'components/ProjectsSection.tsx',  // a lazy chunk, and it imports recharts
      'components/SnowMap.tsx',
      'components/SightingsMap.tsx',
    ]
    for (const root of ROOTS) {
      const sub = closureFrom(resolve(SRC, root))
      const files = [...sub.files].map(f => f.replace(/\\/g, '/'))
      for (const forbidden of FORBIDDEN_FILES) {
        expect(files.some(f => f.endsWith(forbidden)), `${root} must not reach ${forbidden}`).toBe(false)
      }
      expect(files.some(f => /lib\/tauri\/.*Service\.ts$/.test(f)), `${root} must reach no Tauri service`).toBe(false)
      expect(maplibreIn(sub.externals), `${root} must not reach maplibre`).toEqual([])
      expect(
        [...sub.externals].filter(s => s === 'recharts' || s.startsWith('recharts/')),
        `${root} must not reach a chart library`,
      ).toEqual([])
    }
  })

  it('the two timeline lib modules are dependency-light, which is what makes them entry-safe', () => {
    // Guards the guard above: a walker that resolved nothing would satisfy every
    // negative. The geometry module's ONLY value import is formatDate (already on
    // the entry graph and itself dependency-free); the copy module's is the same.
    // NamedBird / NamedSighting arrive as `import type` and are erased at build.
    const geom = closureFrom(resolve(SRC, 'lib/namedBirdTimeline.ts'))
    expect([...geom.files].map(f => f.replace(/\\/g, '/')).filter(f => f.endsWith('lib/formatDate.ts'))).toHaveLength(1)
    expect(geom.files.size).toBe(2)                 // itself and formatDate, nothing else
    expect([...geom.externals]).toEqual([])

    const copy = closureFrom(resolve(SRC, 'lib/namedBirdTimelineCopy.ts'))
    expect(copy.files.size).toBe(2)
    expect([...copy.externals]).toEqual([])

    // And they really ARE on the entry graph, which is why all of this matters.
    expect(has('lib/namedBirdTimeline.ts')).toBe(true)
    expect(has('lib/namedBirdTimelineCopy.ts')).toBe(true)
  })

  it('the strip components pull nothing onto first paint beyond react and lucide', () => {
    for (const root of [
      'components/NamedBirdTickList.tsx',
      'components/NamedBirdMasterTimeline.tsx',
      'components/NamedBirdRangeControl.tsx',
    ]) {
      const sub = closureFrom(resolve(SRC, root))
      // Both are already on App.tsx's entry graph, so neither adds a byte.
      for (const ext of sub.externals) expect(['react', 'lucide-react']).toContain(ext)
    }
  })

  // ── The Weather/tide Planner (tide-weather-planner, NFR-03 / QA-54).
  // WeatherForecastPanel is a STATIC import in App.tsx, so everything it
  // reaches statically is paid for on first paint. Paired, per this file's
  // convention: the chart and the two builders are OFF the graph, the merge and
  // the copy are ON it, and the chart really does reach recharts.
  it('the planner chart is off the entry graph and the panel reaches it only through import()', () => {
    expect(has('components/PlanChart.tsx')).toBe(false)
    expect(has('lib/weatherPlan.ts')).toBe(false)
    expect(has('lib/tidePlan.ts')).toBe(false)
    // The negative above is about a real edge: the panel spells the dynamic
    // import in the one form this walker deliberately cannot see.
    const panelSrc = readFileSync(resolve(SRC, 'components/WeatherForecastPanel.tsx'), 'utf8')
    expect(panelSrc).toContain("import('./PlanChart')")
    // And the chart is the module that carries the chart library.
    const chart = closureFrom(resolve(SRC, 'components/PlanChart.tsx'))
    expect([...chart.externals]).toContain('recharts')
    // ...and the chart reaches the sun and pick modules (plan-sun-moon-readout),
    // which are entry-safe and shared with the static host.
    expect(hasIn(chart.files, 'lib/planSun.ts')).toBe(true)
    expect(hasIn(chart.files, 'lib/planPick.ts')).toBe(true)
    // The builders ride the dynamically imported services, with their only consumer.
    const weatherSvc = closureFrom(resolve(SRC, 'lib/tauri/weatherService.ts'))
    expect(hasIn(weatherSvc.files, 'lib/weatherPlan.ts')).toBe(true)
    const tideSvc = closureFrom(resolve(SRC, 'lib/tauri/tideService.ts'))
    expect(hasIn(tideSvc.files, 'lib/tidePlan.ts')).toBe(true)
  })

  it('the planner\'s entry-safe half IS on the graph and is dependency-light', () => {
    expect(has('components/WeatherForecastPanel.tsx')).toBe(true)
    expect(has('components/PlanResult.tsx')).toBe(true)
    expect(has('lib/plan.ts')).toBe(true)
    expect(has('lib/planCopy.ts')).toBe(true)
    expect(has('lib/planFormat.ts')).toBe(true)
    expect(has('lib/planChartGeometry.ts')).toBe(true)
    expect(has('lib/forecastLabels.ts')).toBe(true)
    // The merge reaches no transport, no storage, no chart library, no map, no
    // builder and no Tauri service: itself and nothing else.
    const merge = closureFrom(resolve(SRC, 'lib/plan.ts'))
    expect(merge.files.size).toBe(1)
    expect([...merge.externals]).toEqual([])
    // The geometry module reaches the Days in view module (its hours rule) and
    // the merge's types (erased), nothing else; the Days in view module is
    // dependency-free.
    const geom = closureFrom(resolve(SRC, 'lib/planChartGeometry.ts'))
    expect(geom.files.size).toBe(2)
    expect(hasIn(geom.files, 'lib/planDaysInView.ts')).toBe(true)
    expect([...geom.externals]).toEqual([])
    const dv = closureFrom(resolve(SRC, 'lib/planDaysInView.ts'))
    expect(dv.files.size).toBe(1)
    expect([...dv.externals]).toEqual([])
    expect(has('lib/planDaysInView.ts')).toBe(true)
    // The copy module reaches only the shared labels.
    const copy = closureFrom(resolve(SRC, 'lib/planCopy.ts'))
    expect([...copy.files].map(f => f.replace(/\\/g, '/')).filter(f => f.endsWith('lib/forecastLabels.ts'))).toHaveLength(1)
    expect(copy.files.size).toBe(2)
    expect([...copy.externals]).toEqual([])
    // plan-sun-moon-readout (schema section 5, D6): the location's clock joins
    // the entry graph (the readout's picked minute has no string in the
    // document, so it is converted through the producers' own twin helper),
    // dependency-free and reaching nothing; and the four derivation modules
    // join beside it, each reaching no transport, no storage, no chart library
    // and no builder.
    expect(has('lib/tzClock.ts')).toBe(true)
    const clock = closureFrom(resolve(SRC, 'lib/tzClock.ts'))
    expect(clock.files.size).toBe(1)
    expect([...clock.externals]).toEqual([])
    // planPick.ts is the one derivation module OFF the entry graph: only the
    // lazy chart steps a pick, so it rides the chart chunk (the schema's table
    // listed it on the entry graph; the code needs it nowhere static, and the
    // chart closure assertion above proves it is reached).
    expect(has('lib/planPick.ts')).toBe(false)
    for (const mod of ['lib/planSun.ts', 'lib/planMoon.ts', 'lib/planReadout.ts', 'lib/planPick.ts']) {
      if (mod !== 'lib/planPick.ts') expect(has(mod), mod).toBe(true)
      const sub = closureFrom(resolve(SRC, mod))
      expect([...sub.externals].filter(s => s === 'recharts' || s.startsWith('recharts/')), mod).toEqual([])
      expect(maplibreIn(sub.externals), mod).toEqual([])
      for (const forbidden of ['lib/transport.ts', 'lib/storage.ts', 'lib/replayStore.ts', 'lib/weatherPlan.ts', 'lib/tidePlan.ts', 'components/PlanChart.tsx']) {
        expect(hasIn(sub.files, forbidden), `${mod} reaches ${forbidden}`).toBe(false)
      }
    }
    const sun = closureFrom(resolve(SRC, 'lib/planSun.ts'))
    expect(sun.files.size).toBe(1)          // Math only: the merge's types are erased
    expect([...sun.externals]).toEqual([])
    const moon = closureFrom(resolve(SRC, 'lib/planMoon.ts'))
    expect(hasIn(moon.files, 'lib/weatherFormatter.ts')).toBe(true)   // the twinned glyph, imported not copied
    const pick = closureFrom(resolve(SRC, 'lib/planPick.ts'))
    expect(hasIn(pick.files, 'lib/tzClock.ts')).toBe(true)
    // The static result region pulls no chart library, no map and no transport.
    const result = closureFrom(resolve(SRC, 'components/PlanResult.tsx'))
    expect([...result.externals].filter(s => s === 'recharts' || s.startsWith('recharts/'))).toEqual([])
    expect(maplibreIn(result.externals)).toEqual([])
    expect(hasIn(result.files, 'lib/transport.ts')).toBe(false)
    expect(hasIn(result.files, 'components/PlanChart.tsx')).toBe(false)
  })

  it('the App entry actually exists (guards against a broken closure root)', () => {
    expect(files.has(APP)).toBe(true)
    expect(files.size).toBeGreaterThan(20) // a real graph, not an empty/short-circuited one
  })
})

// Secondary: when a production build is present, assert the county chunk is not
// preloaded by the entry HTML — the literal CLAUDE.md vendor-maplibre check.
const DIST_INDEX = resolve(SRC, '../dist/index.html')
const DIST_ASSETS = resolve(SRC, '../dist/assets')
describe.skipIf(!existsSync(DIST_INDEX))('dist/index.html modulepreload (post-build)', () => {
  const html = existsSync(DIST_INDEX) ? readFileSync(DIST_INDEX, 'utf8') : ''
  it('does not modulepreload the county geometry chunk, completeness code, MapLibre, its worker, or the chart library', () => {
    const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map(m => m[1])
    expect(preloads.some(h => /us-counties|CountyLayer|countyCompleteness|vendor-maplibre|maplibre-gl-worker|vendor-recharts|PlanChart/i.test(h))).toBe(false)
  })

  it('emits the planner chart as its own lazy chunk (guards the guard above)', () => {
    const assets = existsSync(DIST_ASSETS) ? readdirSync(DIST_ASSETS) : []
    expect(assets.filter(name => /^PlanChart-[^.]+\.js$/.test(name))).toHaveLength(1)
    expect(assets.filter(name => /^vendor-recharts-[^.]+\.js$/.test(name))).toHaveLength(1)
  })

  it('emits the MapLibre module worker as its own production asset', () => {
    const assets = existsSync(DIST_ASSETS) ? readdirSync(DIST_ASSETS) : []
    expect(assets.filter(name => /^maplibre-gl-worker-[^.]+\.js$/.test(name))).toHaveLength(1)
  })

  it('the built entry chunk does not statically import MapLibre or its worker', () => {
    const entryHref = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1]
    expect(entryHref, 'the production HTML names its module entry').toBeTruthy()
    const entryFile = resolve(dirname(DIST_INDEX), entryHref!.replace(/^\//, ''))
    const entry = readFileSync(entryFile, 'utf8')
    // Vite may name lazy dependencies in its dynamic preload table. The
    // first-paint invariant is that neither asset is a static ESM import.
    expect(entry).not.toMatch(/(?:from|import)\s*["']\.\/(?:vendor-maplibre|maplibre-gl-worker)-/)
  })
})
