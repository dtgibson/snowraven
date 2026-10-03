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
import { readdirSync, statSync } from 'node:fs'
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
  'minSdk = 24',
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
    const bad = gradle.replace('minSdk = 24', 'minSdk = 24\n        multiDexEnabled = true')
    expect(versionFindings(bad).defaultConfig).not.toEqual(EXPECTED_DEFAULT_CONFIG)
  })

  it('a commented-out hand-set version is not a finding', () => {
    const commented = gradle.replace('minSdk = 24', 'minSdk = 24\n        // versionName = "9.9.9"')
    expect(versionFindings(commented).defaultConfig).toEqual(EXPECTED_DEFAULT_CONFIG)
  })
})
