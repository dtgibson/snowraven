/// <reference types="node" />
// THE ANDROID VERSION HAS ONE SOURCE (android-release FR-05, FR-06, QA-05,
// QA-06): the Android versionName is tauri.conf.json's version and the
// versionCode is the Tauri CLI's derivation from it (major * 1000000 +
// minor * 1000 + patch), both written per build into the gitignored
// app/tauri.properties. No committed Android file hand-sets either, so the
// four-file version bump (CLAUDE.md, Versioning) stays four files.
//
// This is the twin of iosSceneManifest.test.ts's "stamped version never leads"
// row, with one sharpening recorded in pipeline/android-release/decisions.md:
// the schema asked that every semver-shaped literal under gen/android never
// lead package.json, but the Gradle files are full of legitimate DEPENDENCY
// coordinates (the Android Gradle plugin 8.11.0, Gradle 8.14.3) that always
// would. So the guard pins the version ASSIGNMENTS, wherever Android reads
// one: Gradle's versionName/versionCode, the manifest's android:version*
// attributes, and the overlay config. Pure JS, comments stripped first, and
// it fails closed on a defaultConfig shape it does not recognise.
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import {
  ANDROID, REPO, readRepo, stripKotlinComments, kotlinBlock, kotlinStatements, stripXmlComments,
} from '../test/androidProject'

const APP = 'src-tauri/gen/android/app'

// The one recognised defaultConfig: anything added, removed or reshaped by a
// regeneration or a hand edit fails here first and must be looked at.
const EXPECTED_DEFAULT_CONFIG = [
  'manifestPlaceholders["usesCleartextTraffic"] = "false"',
  'applicationId = "com.dtgibson.snowraven"',
  'minSdk = 26',
  'targetSdk = 36',
  'versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()',
  'versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")',
]

function versionFindings(gradleSrc: string) {
  const code = stripKotlinComments(gradleSrc)
  const defaultConfig = kotlinStatements(kotlinBlock(kotlinBlock(code, 'android'), 'defaultConfig'))
  const assignments = [...code.matchAll(/\b(versionCode|versionName)\s*=\s*([^\n]+)/g)].map(m => `${m[1]} = ${m[2]!.trim()}`)
  return { defaultConfig, assignments }
}

/** Every committed text file under gen/android that Gradle or aapt reads. */
function androidTextFiles(): string[] {
  const out: string[] = []
  const skipDirs = new Set(['build', '.gradle', 'jniLibs', 'generated', 'assets', '.idea'])
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name)
      if (statSync(full).isDirectory()) {
        if (!skipDirs.has(name)) walk(full)
      } else if (/\.(kts|gradle|xml|kt|properties|pro)$/.test(name) && name !== 'tauri.properties' && name !== 'local.properties') {
        out.push(relative(REPO, full))
      }
    }
  }
  walk(ANDROID)
  return out.sort()
}

describe('the version source (FR-05)', () => {
  it('defaultConfig is exactly the recognised shape, versions read only from tauri.properties', () => {
    expect(versionFindings(readRepo(`${APP}/build.gradle.kts`)).defaultConfig).toEqual(EXPECTED_DEFAULT_CONFIG)
  })

  it('nothing else in the app module assigns versionCode or versionName', () => {
    expect(versionFindings(readRepo(`${APP}/build.gradle.kts`)).assignments).toEqual([
      'versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()',
      'versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")',
    ])
  })

  it('no committed Android file sets a version: no android:version* attribute, no versionCode literal', () => {
    const files = androidTextFiles()
    // non-vacuity: the walk reached the files a version would live in
    expect(files).toEqual(expect.arrayContaining([
      `${APP}/build.gradle.kts`, `${APP}/src/main/AndroidManifest.xml`, 'src-tauri/gen/android/build.gradle.kts',
    ]))
    for (const f of files) {
      const raw = readRepo(f)
      const text = f.endsWith('.xml') ? stripXmlComments(raw) : /\.(kts|kt|gradle)$/.test(f) ? stripKotlinComments(raw) : raw
      expect(text, f).not.toMatch(/android:version(Code|Name)\s*=/)
      expect(text, f).not.toMatch(/\bversionCode\s*=\s*\d/)
      expect(text, f).not.toMatch(/\bversionName\s*=\s*"/)
    }
  })

  it('the overlay config sets no versionCode; tauri.conf.json is the version and agrees with package.json', () => {
    const overlay = JSON.parse(readRepo('src-tauri/tauri.android.conf.json')) as Record<string, unknown>
    expect(overlay.version).toBeUndefined()
    expect((overlay.bundle as { android?: Record<string, unknown> }).android?.versionCode).toBeUndefined()
    const tauri = JSON.parse(readRepo('src-tauri/tauri.conf.json')) as { version: string }
    const pkg = JSON.parse(readRepo('frontend/package.json')) as { version: string }
    expect(tauri.version).toBe(pkg.version)
  })

  it('the derived versionCode never leads the app version and rises with every patch', () => {
    // The CLI's formula, restated so the release preflight's expected code is
    // one documented function of the version string.
    const code = (v: string) => { const [a, b, c] = v.split('.').map(Number); return a! * 1_000_000 + b! * 1000 + c! }
    const pkg = JSON.parse(readRepo('frontend/package.json')) as { version: string }
    expect(code('1.0.48')).toBe(1_000_048)
    expect(code('1.0.49')).toBeGreaterThan(code('1.0.48'))
    expect(code('1.1.0')).toBeGreaterThan(code('1.0.999'))
    expect(code(pkg.version)).toBe(code(JSON.parse(readRepo('src-tauri/tauri.conf.json')).version))
  })
})

// GUARD THE GUARD: the same finder, driven against the shapes the defect would
// arrive in.
describe('the version guard rejects a hand-set version', () => {
  const gradle = readRepo(`${APP}/build.gradle.kts`)

  it('a literal versionName one patch ahead is seen', () => {
    const bad = gradle.replace(/versionName = tauriProperties[^\n]+/, 'versionName = "1.0.49"')
    expect(versionFindings(bad).defaultConfig).not.toEqual(EXPECTED_DEFAULT_CONFIG)
    expect(versionFindings(bad).assignments).toContain('versionName = "1.0.49"')
  })

  it('a hand-set versionCode is seen', () => {
    const bad = gradle.replace(/versionCode = tauriProperties[^\n]+/, 'versionCode = 1000049')
    expect(versionFindings(bad).assignments).toContain('versionCode = 1000049')
  })

  it('an unrecognised statement in defaultConfig fails the shape check', () => {
    const bad = gradle.replace('minSdk = 26', 'minSdk = 26\n        multiDexEnabled = true')
    expect(versionFindings(bad).defaultConfig).not.toEqual(EXPECTED_DEFAULT_CONFIG)
  })

  it('a commented-out hand-set version is not a finding', () => {
    const commented = gradle.replace('minSdk = 26', 'minSdk = 26\n        // versionName = "9.9.9"')
    expect(versionFindings(commented).defaultConfig).toEqual(EXPECTED_DEFAULT_CONFIG)
  })
})

// Revised FR-05 (schema 3.3): F-Droid's update checker reads the version name
// AND code from a committed file at each tag, so the code is written into
// tauri.conf.json beside the string it derives from, and moved with it at every
// bump. The formula is the Tauri CLI's own (major * 1000000 + minor * 1000 +
// patch), so the committed code and the CLI's derivation can never disagree.
const formula = (v: string) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v)
  if (!m) throw new Error(`version not understood: ${v}`)
  return Number(m[1]) * 1_000_000 + Number(m[2]) * 1000 + Number(m[3])
}

function committedPairProblems(conf: { version?: string; bundle?: { android?: { versionCode?: unknown } } }, pkgVersion: string): string[] {
  const out: string[] = []
  const v = conf.version
  const code = conf.bundle?.android?.versionCode
  if (typeof v !== 'string') return ['tauri.conf.json has no version']
  if (typeof code !== 'number') return ['tauri.conf.json has no bundle.android.versionCode']
  if (code !== formula(v)) out.push(`versionCode ${code} is not the formula of ${v} (${formula(v)})`)
  if (v !== pkgVersion) out.push(`tauri.conf.json ${v} differs from frontend/package.json ${pkgVersion}`)
  return out
}

describe('the committed version code (revised FR-05, schema 3.3)', () => {
  const conf = JSON.parse(readRepo('src-tauri/tauri.conf.json')) as { version: string; bundle: { android?: { versionCode?: number } } }
  const pkg = JSON.parse(readRepo('frontend/package.json')) as { version: string }

  it('bundle.android.versionCode equals the formula of the version, and the version equals package.json', () => {
    expect(committedPairProblems(conf, pkg.version)).toEqual([])
  })

  it('neither the version string nor the code literal appears in a committed file under gen/android', () => {
    for (const f of androidTextFiles()) {
      const raw = readRepo(f)
      expect(raw.includes(conf.version), `${f} names ${conf.version}`).toBe(false)
      expect(raw.includes(String(conf.bundle.android!.versionCode)), `${f} names the code`).toBe(false)
    }
  })

  it('where the per-build app/tauri.properties exists, its pair never leads package.json (absent in CI)', () => {
    const rel = `${APP}/tauri.properties`
    if (!existsSync(resolve(REPO, rel))) return
    const props = Object.fromEntries(readRepo(rel).split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(x => x.trim())))
    const name = props['tauri.android.versionName']
    const code = Number(props['tauri.android.versionCode'])
    if (name) expect(formula(name)).toBeLessThanOrEqual(formula(pkg.version))
    if (!Number.isNaN(code)) expect(code).toBeLessThanOrEqual(formula(pkg.version))
  })

  it('guard the guard: a version one patch ahead with the old code, or a code one off, is reported', () => {
    expect(committedPairProblems({ version: '1.0.49', bundle: { android: { versionCode: 1_000_048 } } }, '1.0.49')).toHaveLength(1)
    expect(committedPairProblems({ version: '1.0.48', bundle: { android: { versionCode: 1_000_047 } } }, '1.0.48')).toHaveLength(1)
    expect(committedPairProblems({ version: '1.0.48', bundle: {} }, '1.0.48')).toEqual(['tauri.conf.json has no bundle.android.versionCode'])
    expect(committedPairProblems({ version: '1.0.48', bundle: { android: { versionCode: 1_000_048 } } }, '1.0.48')).toEqual([])
  })
})
