/// <reference types="node" />
// THE COMMITTED ANDROID PROJECT KEEPS ITS DELIBERATE EDITS (android-release
// FR-03, QA-03, QA-04, QA-07, QA-23, QA-24, QA-56).
//
// src-tauri/gen/android was generated once by `tauri android init` and then
// edited by hand. A regeneration rewrites every template file, so this guard
// pins each deliberate edit by CONTENT (the release skill's Android section
// names the keep-aside-and-restore procedure; CLAUDE.md's xcodegen rule is its
// iOS twin). It reads the committed files in pure JS with comments stripped
// first, so a commented-out permission or pin can neither satisfy nor fail it,
// and it runs on the Linux CI runner with no Android tooling.
//
// What it cannot see: the MERGED manifest of a real build, which adds library
// entries (androidx.core's signature-level DYNAMIC_RECEIVER_NOT_EXPORTED
// permission, and the activity and receiver the linked libraries declare).
// That is read with `aapt2 dump permissions` on the built APK and recorded in
// pipeline/android-release/decisions.md.
import { describe, it, expect } from 'vitest'
import {
  readRepo, stripKotlinComments, kotlinBlock, kotlinStatements, stripXmlComments, xmlTags,
} from '../test/androidProject'

const APP = 'src-tauri/gen/android/app'
const RES = `${APP}/src/main/res`
const ID = 'com.dtgibson.snowraven'

const androidConf = JSON.parse(readRepo('src-tauri/tauri.android.conf.json')) as {
  identifier: string
  bundle?: { android?: Record<string, unknown> }
}
const tauriConf = JSON.parse(readRepo('src-tauri/tauri.conf.json')) as { identifier: string }
const gradle = stripKotlinComments(readRepo(`${APP}/build.gradle.kts`))
const manifest = readRepo(`${APP}/src/main/AndroidManifest.xml`)
const mainActivity = stripKotlinComments(readRepo(`${APP}/src/main/java/com/dtgibson/snowraven/MainActivity.kt`))

// ── The pins, as functions over file text, so the guard-the-guard rows below
// drive the SAME code against scratch strings. ─────────────────────────────

function gradlePins(src: string) {
  const android = kotlinBlock(src, 'android')
  const defaultConfig = kotlinBlock(android, 'defaultConfig')
  const debug = kotlinBlock(android, 'getByName("debug")')
  const release = kotlinBlock(android, 'getByName("release")')
  const num = (key: string, scope: string) => {
    const ms = [...scope.matchAll(new RegExp(`\\b${key}\\s*=\\s*(\\d+)`, 'g'))]
    if (ms.length !== 1) throw new Error(`${key}: expected exactly one assignment, found ${ms.length}`)
    return Number(ms[0]![1])
  }
  const str = (key: string, scope: string) => {
    const ms = [...scope.matchAll(new RegExp(`\\b${key}\\s*=\\s*"([^"]*)"`, 'g'))]
    if (ms.length !== 1) throw new Error(`${key}: expected exactly one assignment, found ${ms.length}`)
    return ms[0]![1]
  }
  const cleartext = (scope: string) =>
    [...scope.matchAll(/manifestPlaceholders\["usesCleartextTraffic"\]\s*=\s*"(\w+)"/g)].map(m => m[1])
  return {
    compileSdk: num('compileSdk', android),
    namespace: str('namespace', android),
    applicationId: str('applicationId', defaultConfig),
    minSdk: num('minSdk', defaultConfig),
    targetSdk: num('targetSdk', defaultConfig),
    cleartextDefault: cleartext(defaultConfig),
    cleartextDebug: cleartext(debug),
    cleartextRelease: cleartext(release),
    cleartextAll: cleartext(src),
  }
}

function permissions(xml: string): string[] {
  return xmlTags(xml, 'uses-permission').map(a => a['android:name']!).sort()
}

describe('the application id and the desktop identifier (FR-04, QA-04)', () => {
  it('tauri.android.conf.json sets com.dtgibson.snowraven; tauri.conf.json stays com.snowraven', () => {
    expect(androidConf.identifier).toBe(ID)
    expect(tauriConf.identifier).toBe('com.snowraven')
  })

  it('the Gradle namespace, the applicationId and the MainActivity package all carry it', () => {
    const g = gradlePins(gradle)
    expect(g.namespace).toBe(ID)
    expect(g.applicationId).toBe(ID)
    expect(mainActivity).toMatch(/^\s*package com\.dtgibson\.snowraven\s*$/m)
  })
})

describe('API levels (FR-07, QA-07)', () => {
  it('minSdk 24 in both the overlay and Gradle; targetSdk and compileSdk 36', () => {
    expect(androidConf.bundle?.android?.minSdkVersion).toBe(24)
    const g = gradlePins(gradle)
    expect(g.minSdk).toBe(24)
    expect(g.targetSdk).toBe(36)
    expect(g.compileSdk).toBe(36)
  })

  it('the target level carries the date it was read, in the one place it is recorded', () => {
    const raw = readRepo(`${APP}/build.gradle.kts`)
    expect(raw).toMatch(/targetSdk 36 \(Android 16\), read 2026-10-03/)
  })

  it('the overlay sets no versionCode and no auto-increment (FR-05)', () => {
    const a = androidConf.bundle?.android ?? {}
    expect(a.versionCode).toBeUndefined()
    expect(a.autoIncrementVersionCode).not.toBe(true)
  })
})

describe('cleartext and signing (FR-24, NFR-05, NFR-07)', () => {
  it('cleartext is "false" in defaultConfig, "true" only for debug, and the manifest reads the placeholder', () => {
    const g = gradlePins(gradle)
    expect(g.cleartextDefault).toEqual(['false'])
    expect(g.cleartextDebug).toEqual(['true'])
    expect(g.cleartextRelease).toEqual([])
    expect(g.cleartextAll).toEqual(['false', 'true'])
    const app = xmlTags(manifest, 'application')
    expect(app).toHaveLength(1)
    expect(app[0]!['android:usesCleartextTraffic']).toBe('${usesCleartextTraffic}')
  })

  it('the release signing block reads a properties file outside the repo and writes no password', () => {
    expect(gradle).toContain('System.getenv("SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES")')
    expect(gradle).toContain('rootProject.file("keystore.properties")')
    expect(gradle).toMatch(/storePassword\s*=\s*keystoreProperties\.getProperty\("storePassword"\)/)
    expect(gradle).toMatch(/keyPassword\s*=\s*keystoreProperties\.getProperty\("keyPassword"\)/)
    expect(gradle).not.toMatch(/(store|key)Password\s*=\s*"/)
    // The block exists only when the file does, so CI builds unsigned.
    expect(gradle).toMatch(/if \(keystoreProperties\.getProperty\("storeFile"\) != null\)/)
    expect(gradle).toContain('signingConfigs.findByName("release")?.let { signingConfig = it }')
    const ignore = readRepo('src-tauri/gen/android/.gitignore').split('\n').map(l => l.trim())
    expect(ignore).toContain('keystore.properties')
    expect(ignore).toContain('key.properties')
  })

  it('the per-build tauri.properties (the version source) is gitignored, never committed', () => {
    const ignore = readRepo(`${APP}/.gitignore`).split('\n').map(l => l.trim())
    expect(ignore).toContain('/tauri.properties')
  })
})

describe('the manifest (FR-24, NFR-05, QA-24, QA-56)', () => {
  it('declares exactly INTERNET and the two location permissions', () => {
    expect(permissions(manifest)).toEqual([
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.INTERNET',
    ])
  })

  it('one Activity, MainActivity, single-task, the launcher entry; no Android TV leanback', () => {
    const acts = xmlTags(manifest, 'activity')
    expect(acts).toHaveLength(1)
    expect(acts[0]!['android:name']).toBe('.MainActivity')
    expect(acts[0]!['android:launchMode']).toBe('singleTask')
    const cats = xmlTags(manifest, 'category').map(a => a['android:name'])
    expect(cats).toEqual(['android.intent.category.LAUNCHER'])
    expect(stripXmlComments(manifest)).not.toMatch(/leanback/i)
  })

  it('keeps the platform-default backup behavior (OQ-09): no backup attributes', () => {
    const app = xmlTags(manifest, 'application')[0]!
    for (const attr of ['android:allowBackup', 'android:fullBackupContent', 'android:dataExtractionRules']) {
      expect(app[attr], attr).toBeUndefined()
    }
  })

  it('the launcher icon is the committed adaptive icon', () => {
    expect(xmlTags(manifest, 'application')[0]!['android:icon']).toBe('@mipmap/ic_launcher')
  })
})

describe('the launch state (FR-31, FR-32, design-spec section 1)', () => {
  const style = (rel: string) => {
    const items: Record<string, string> = {}
    for (const m of stripXmlComments(readRepo(rel)).matchAll(/<item name="([^"]+)">([^<]*)<\/item>/g)) items[m[1]!] = m[2]!.trim()
    return items
  }

  it('API 24 to 30, light and dark alike: the green layer-list and light status glyphs', () => {
    for (const dir of ['values', 'values-night']) {
      expect(style(`${RES}/${dir}/themes.xml`), dir).toEqual({
        'android:windowBackground': '@drawable/sr_launch_background',
        'android:windowLightStatusBar': 'false',
      })
    }
  })

  it('API 31 and later, light and dark alike: the platform splash on the green', () => {
    for (const dir of ['values-v31', 'values-night-v31']) {
      expect(style(`${RES}/${dir}/themes.xml`), dir).toEqual({
        'android:windowBackground': '@color/ic_launcher_background',
        'android:windowLightStatusBar': 'false',
        'android:windowSplashScreenBackground': '@color/ic_launcher_background',
        'android:windowSplashScreenAnimatedIcon': '@mipmap/ic_launcher_foreground',
      })
    }
  })

  it('the layer-list centers the 108dp foreground on the launcher green', () => {
    const items = xmlTags(readRepo(`${RES}/drawable/sr_launch_background.xml`), 'item')
    expect(items).toEqual([
      { 'android:drawable': '@color/ic_launcher_background' },
      { 'android:width': '108dp', 'android:height': '108dp', 'android:gravity': 'center', 'android:drawable': '@mipmap/ic_launcher_foreground' },
    ])
  })
})

describe('MainActivity.kt: the native half of the inset and theme contracts (design-spec 2 and 4)', () => {
  const css = readRepo('frontend/src/globals.css')
  const theme = readRepo('frontend/src/lib/theme.ts')

  it('installs both hooks in onWebViewCreate, after edge-to-edge', () => {
    expect(mainActivity).toMatch(/enableEdgeToEdge\(\)\s*\n\s*super\.onCreate/)
    const hook = kotlinBlock(mainActivity, 'override fun onWebViewCreate(webView: WebView)')
    expect(kotlinStatements(hook)).toEqual(['installInsets(webView)', 'installThemeChannel(webView)'])
  })

  it('sets exactly the four inset properties the stylesheet reads, and the keyboard class it reads', () => {
    const set = [...mainActivity.matchAll(/setProperty\('(--sr-inset-[a-z]+)'/g)].map(m => m[1]).sort()
    const read = [...new Set([...css.matchAll(/var\((--sr-inset-[a-z]+)/g)].map(m => m[1]))].sort()
    expect(set).toEqual(['--sr-inset-bottom', '--sr-inset-left', '--sr-inset-right', '--sr-inset-top'])
    expect(read).toEqual(set)
    expect(mainActivity).toContain("r.classList.toggle('sr-ime-open',")
    expect(css).toContain('.sr-android-app.sr-ime-open .sr-navbar')
    // insets from system bars and the cutout; the keyboard handled natively
    expect(mainActivity).toMatch(/WindowInsetsCompat\.Type\.systemBars\(\) or WindowInsetsCompat\.Type\.displayCutout\(\)/)
    expect(mainActivity).toContain('WindowInsetsCompat.Type.ime()')
  })

  it('the theme channel: the name theme.ts posts to, the app origin only, light or dark only, main frame only', () => {
    expect(mainActivity).toMatch(/addWebMessageListener\(\s*webView,\s*"srAndroid",\s*setOf\("http:\/\/tauri\.localhost"\)/)
    expect(theme).toContain('window.srAndroid?.postMessage(effective)')
    expect(mainActivity).toContain('if (!isMainFrame) return')
    expect(mainActivity).toContain('if (theme != "light" && theme != "dark") return')
    expect(mainActivity).toContain('WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)')
  })
})

describe('capabilities (FR-23, NFR-05, QA-23)', () => {
  const cap = (name: string) => JSON.parse(readRepo(`src-tauri/capabilities/${name}.json`)) as {
    platforms?: string[]; windows: string[]; permissions: unknown[]
  }

  it('mobile.json applies to iOS and Android; desktop.json does not name Android', () => {
    expect(cap('mobile').platforms).toEqual(['iOS', 'android'])
    expect(cap('desktop').platforms).not.toContain('android')
  })

  it('all three stay scoped to the one main window', () => {
    for (const c of ['default', 'desktop', 'mobile']) expect(cap(c).windows, c).toEqual(['main'])
  })

  it('the default file scope is unchanged: the five fs grants on $APPLOCALDATA/** only', () => {
    const fs = cap('default').permissions.filter(
      (p): p is { identifier: string; allow: unknown } => typeof p === 'object' && p !== null && String((p as { identifier: string }).identifier).startsWith('fs:'),
    )
    expect(fs).toEqual(
      ['fs:allow-read-text-file', 'fs:allow-write-text-file', 'fs:allow-mkdir', 'fs:allow-exists', 'fs:allow-remove'].map(identifier => ({
        identifier, allow: [{ path: '$APPLOCALDATA/**' }],
      })),
    )
  })
})

describe('the CI build (FR-34, QA-34, NFR-07)', () => {
  // YAML comments stripped line by line before scanning, so the workflow's own
  // explanation of what it does not hold cannot satisfy or fail a row.
  const wf = readRepo('.github/workflows/android-build.yml')
    .split('\n')
    .filter(l => !/^\s*#/.test(l))
    .join('\n')

  it('runs on the version tag and by hand, read-only, referencing no secret', () => {
    expect(wf).toMatch(/on:\s*\n\s+push:\s*\n\s+tags: \['v\*'\]\s*\n\s+workflow_dispatch:/)
    expect(wf).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m)
    expect(wf).not.toMatch(/secrets\./)
  })

  it('builds unsigned, for all four Android targets, and fails if a keystore is present', () => {
    expect(wf).toContain('npx tauri android build --ci --aab --apk --target aarch64 armv7 i686 x86_64')
    expect(wf).toContain('test -z "${SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES:-}"')
    expect(wf).toContain('test ! -e src-tauri/gen/android/keystore.properties')
  })

  it('collects exactly one AAB and one universal APK under the names the release skill states', () => {
    expect(wf).toContain('[ "${#AABS[@]}" -eq 1 ]')
    expect(wf).toContain('[ "${#APKS[@]}" -eq 1 ]')
    expect(wf).toContain('dist-android/SnowRaven_${VERSION}_android.aab')
    expect(wf).toContain('dist-android/SnowRaven_${VERSION}_android_universal.apk')
    expect(wf).toMatch(/name: android-build\s*\n\s+path: dist-android\/\*\s*\n\s+if-no-files-found: error/)
  })

  it('pins the NDK the local toolchain uses', () => {
    expect(wf).toContain("ANDROID_NDK_VERSION: '27.2.12479018'")
    expect(readRepo('pipeline/android-release/toolchain.md')).toContain('ndk;27.2.12479018')
  })
})

// GUARD THE GUARD: the same pin functions, driven against scratch strings in
// the shapes the defect would return in.
describe('the pins reject the shapes a regeneration or a slip would produce', () => {
  it('a minSdk of 23 is read as 23 (and so fails the pin above)', () => {
    expect(gradlePins(gradle.replace(/minSdk = 24/, 'minSdk = 23')).minSdk).toBe(23)
  })

  it('a second minSdk assignment fails closed rather than picking one', () => {
    expect(() => gradlePins(gradle.replace(/minSdk = 24/, 'minSdk = 24\n        minSdk = 26'))).toThrow(/exactly one/)
  })

  it('a missing defaultConfig block fails closed', () => {
    expect(() => gradlePins(gradle.replace('defaultConfig {', 'defaultConfigX {'))).toThrow()
  })

  it('a commented-out permission is not counted; an extra real one is', () => {
    const commented = manifest.replace('<application', '<!-- <uses-permission android:name="android.permission.CAMERA" /> -->\n    <application')
    expect(permissions(commented)).toHaveLength(3)
    const extra = manifest.replace('<application', '<uses-permission android:name="android.permission.CAMERA" />\n    <application')
    expect(permissions(extra)).toContain('android.permission.CAMERA')
  })

  it('a // comment holding a pin cannot satisfy it (the stripper removes it, strings survive)', () => {
    expect(stripKotlinComments('// targetSdk = 36\nval u = "https://x"')).toBe('\nval u = "https://x"')
    expect(stripKotlinComments('/* a /* nested */ b */c')).toBe('c')
    expect(() => stripKotlinComments('val s = "open')).toThrow()
  })

  it('a manifest with two activities is seen as two', () => {
    const two = manifest.replace('</application>', '<activity android:name=".Second" android:exported="false" />\n    </application>')
    expect(xmlTags(two, 'activity')).toHaveLength(2)
  })
})
