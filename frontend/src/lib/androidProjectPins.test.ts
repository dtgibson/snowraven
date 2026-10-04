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
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  REPO, readRepo, stripKotlinComments, kotlinBlock, kotlinStatements, stripXmlComments, xmlTags,
} from '../test/androidProject'
import { ANDROID_LOCATION_BRANCH } from './androidLocation'

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
  // minSdk 26 (Android 8.0), the user's decision of 2026-10-03: the locked Tauri
  // runtime's Jackson crashes at launch on API 24 and 25 (decisions.md, BLOCKER).
  it('minSdk 26 in both the overlay and Gradle; targetSdk and compileSdk 36', () => {
    expect(androidConf.bundle?.android?.minSdkVersion).toBe(26)
    const g = gradlePins(gradle)
    expect(g.minSdk).toBe(26)
    expect(g.targetSdk).toBe(36)
    expect(g.compileSdk).toBe(36)
  })

  it('the target level carries the date it was read, in the one place it is recorded', () => {
    const raw = readRepo(`${APP}/build.gradle.kts`)
    expect(raw).toMatch(/targetSdk 36 \(Android 16\), read 2026-10-03/)
    // revised FR-07: the comment names no store
    const comment = raw.slice(raw.indexOf('// targetSdk 36'), raw.indexOf('targetSdk = 36'))
    expect(comment).not.toMatch(/Google|Play/)
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

/** The permission set each location branch requires (schema 3.4). */
function expectedPermissions(branch: 'A' | 'B'): string[] {
  return branch === 'A'
    ? ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.INTERNET']
    : ['android.permission.INTERNET']
}

describe('the manifest (FR-24, NFR-05, QA-24, QA-56)', () => {
  it('declares exactly the permission set of the location branch in force (INTERNET only under B)', () => {
    expect(permissions(manifest)).toEqual(expectedPermissions(ANDROID_LOCATION_BRANCH))
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

  // QA-52, NFR-01: Android System WebView's Safe Browsing is on by default and
  // checks the page's URLs with Google. The opt-out is application-level
  // meta-data, so it must sit directly in <application>: inside the activity or
  // the provider the WebView never reads it.
  it('turns off the WebView\'s Safe Browsing with application-level meta-data', () => {
    expect(appLevelMetaData(manifest)).toContainEqual({
      'android:name': 'android.webkit.WebView.EnableSafeBrowsing',
      'android:value': 'false',
    })
  })
})

function appLevelMetaData(xml: string): Array<Record<string, string>> {
  const body = stripXmlComments(xml).match(/<application\b[^>]*>([\s\S]*)<\/application>/)?.[1]
  if (body === undefined) throw new Error('manifest: no <application> element')
  return xmlTags(body.replace(/<(activity|provider)\b[\s\S]*?<\/\1>/g, ''), 'meta-data')
}

describe('the launch state (FR-31, FR-32, design-spec section 1)', () => {
  const style = (rel: string) => {
    const items: Record<string, string> = {}
    for (const m of stripXmlComments(readRepo(rel)).matchAll(/<item name="([^"]+)">([^<]*)<\/item>/g)) items[m[1]!] = m[2]!.trim()
    return items
  }

  // Both bars are named explicitly (QA-31): left to the MaterialComponents
  // parent, the API 26 launch frames drew its purple status bar and a black
  // navigation bar before edge-to-edge applied.
  it('API 26 to 30, light and dark alike: the green layer-list, green bars, windowLightStatusBar off', () => {
    for (const dir of ['values', 'values-night']) {
      expect(style(`${RES}/${dir}/themes.xml`), dir).toEqual({
        'android:windowBackground': '@drawable/sr_launch_background',
        'android:windowLightStatusBar': 'false',
        'android:statusBarColor': '@color/ic_launcher_background',
        'android:navigationBarColor': '@color/ic_launcher_background',
      })
    }
  })

  it('API 31 and later, light and dark alike: the platform splash on the green, green bars', () => {
    for (const dir of ['values-v31', 'values-night-v31']) {
      expect(style(`${RES}/${dir}/themes.xml`), dir).toEqual({
        'android:windowBackground': '@color/ic_launcher_background',
        'android:windowLightStatusBar': 'false',
        'android:statusBarColor': '@color/ic_launcher_background',
        'android:navigationBarColor': '@color/ic_launcher_background',
        'android:windowSplashScreenBackground': '@color/ic_launcher_background',
        'android:windowSplashScreenAnimatedIcon': '@mipmap/ic_launcher_foreground',
      })
    }
  })

  it('no template color survives in the launch resources: colors.xml defines none, the launcher green is #2D8653', () => {
    expect(xmlTags(readRepo(`${RES}/values/colors.xml`), 'color')).toEqual([])
    expect(stripXmlComments(readRepo(`${RES}/values/ic_launcher_background.xml`)))
      .toMatch(/<color name="ic_launcher_background">#2D8653<\/color>/)
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

  // The token rows below cannot see a registration that is present but never
  // reached: an early `return` at the top of installInsets compiles and leaves
  // the listener dead (QA-03 residual). So each install method's statements are
  // pinned: installInsets is the registration and nothing else, and
  // installThemeChannel returns early only on the feature check.
  it('both registrations are reached: no statement runs before the inset listener, only the feature check before the theme listener', () => {
    const insets = kotlinStatements(kotlinBlock(mainActivity, 'private fun installInsets(webView: WebView)'))
    expect(insets).toHaveLength(1)
    expect(insets[0]).toMatch(/^ViewCompat\.setOnApplyWindowInsetsListener\(webView\) \{/)
    const channel = kotlinStatements(kotlinBlock(mainActivity, 'private fun installThemeChannel(webView: WebView)'))
    expect(channel).toHaveLength(2)
    expect(channel[0]).toBe('if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return')
    expect(channel[1]).toMatch(/^WebViewCompat\.addWebMessageListener\(/)
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

  it('mobile.json applies to iOS and Android and grants only the dialog; desktop.json names no mobile platform', () => {
    expect(cap('mobile').platforms).toEqual(['iOS', 'android'])
    expect(cap('mobile').permissions).toEqual(['dialog:allow-open'])
    expect(cap('desktop').platforms).not.toContain('android')
    expect(cap('desktop').platforms).not.toContain('iOS')
  })

  it('ios.json alone carries the three geolocation grants, for iOS only (schema 4.3)', () => {
    expect(cap('ios').platforms).toEqual(['iOS'])
    expect(cap('ios').permissions).toEqual([
      'geolocation:allow-check-permissions', 'geolocation:allow-request-permissions', 'geolocation:allow-get-current-position',
    ])
    expect(geolocationGrantsOffIos(cap('mobile'))).toEqual([])
  })

  it('all four stay scoped to the one main window', () => {
    for (const c of ['default', 'desktop', 'mobile', 'ios']) expect(cap(c).windows, c).toEqual(['main'])
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

/** Geolocation grants in a capability that is not iOS-only (must be none). */
function geolocationGrantsOffIos(c: { platforms?: string[]; permissions: unknown[] }): unknown[] {
  if (c.platforms && c.platforms.length === 1 && c.platforms[0] === 'iOS') return []
  return c.permissions.filter(p => String(typeof p === 'string' ? p : (p as { identifier: string }).identifier).startsWith('geolocation:'))
}

describe('nothing from Google in the Android build: the geolocation plugin is iOS-only (FR-54, schema 4.1)', () => {
  const cargo = readRepo('src-tauri/Cargo.toml').split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
  const libRs = readRepo('src-tauri/src/lib.rs').replace(/\/\/[^\n]*/g, '')

  it('Cargo.toml names tauri-plugin-geolocation only inside the cfg(target_os = "ios") block', () => {
    const blocks = cargo.split(/^(?=\[)/m)
    const holders = blocks.filter(b => /^tauri-plugin-geolocation\s*=/m.test(b)).map(b => b.split('\n')[0])
    expect(holders).toEqual([`[target.'cfg(target_os = "ios")'.dependencies]`])
  })

  it('lib.rs registers the geolocation plugin only under #[cfg(target_os = "ios")]', () => {
    const inits = [...libRs.matchAll(/tauri_plugin_geolocation::init\(\)/g)]
    expect(inits).toHaveLength(1)
    const before = libRs.slice(0, inits[0]!.index)
    const lastCfg = before.lastIndexOf('#[cfg(')
    expect(before.slice(lastCfg, before.indexOf(']', lastCfg) + 1)).toBe('#[cfg(target_os = "ios")]')
    // and the cfg(mobile) chain carries the dialog alone
    expect(libRs).toMatch(/#\[cfg\(mobile\)\]\s*let builder = builder\.plugin\(tauri_plugin_dialog::init\(\)\);/)
  })
})

describe('the Gradle build has no wrapper jar and runs cargo tauri (schema 3.8, 6.0, FR-61)', () => {
  const env = Object.fromEntries(
    readRepo('scripts/android/toolchain.env').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/\s+#.*$/, '').replace(/^"|"$/g, '').trim()]
    }),
  )

  it('BuildTask.kt calls `cargo tauri android android-studio-script`, never npm', () => {
    const task = stripKotlinComments(readRepo('src-tauri/gen/android/buildSrc/src/main/java/com/dtgibson/snowraven/kotlin/BuildTask.kt'))
    expect(task).toContain('val executable = """cargo""";')
    expect(task).toContain('val args = listOf("tauri", "android", "android-studio-script");')
    expect(task).not.toContain('"""npm"""')
  })

  it('gradlew is the four-line shim; the wrapper jar and gradlew.bat are absent and ignored', () => {
    expect(readRepo('src-tauri/gen/android/gradlew')).toBe(
      '#!/bin/sh\n'
      + "# Not Gradle's wrapper. SnowRaven commits no wrapper jar (android-release schema 3.8, FR-61):\n"
      + '# Gradle 8.14.3 is pinned in gradle/wrapper/gradle-wrapper.properties, and CI, the release\n'
      + "# machine and F-Droid's build server each put that Gradle on PATH as `gradle`.\n"
      + 'cd "$(dirname "$0")" && exec gradle "$@"\n',
    )
    expect(existsSync(resolve(REPO, 'src-tauri/gen/android/gradle/wrapper/gradle-wrapper.jar'))).toBe(false)
    expect(existsSync(resolve(REPO, 'src-tauri/gen/android/gradlew.bat'))).toBe(false)
    const ignore = readRepo('src-tauri/gen/android/.gitignore').split('\n').map(l => l.trim())
    expect(ignore).toEqual(expect.arrayContaining(['gradle/wrapper/gradle-wrapper.jar', 'gradlew.bat']))
  })

  it('gradle-wrapper.properties pins the same Gradle as toolchain.env', () => {
    const props = readRepo('src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties')
    expect(props).toContain(`distributionUrl=https\\://services.gradle.org/distributions/gradle-${env.GRADLE_VERSION}-bin.zip`)
    expect(env.GRADLE_VERSION).toBe('8.14.3')
  })

  it('toolchain.env names the tauri-cli version the npm lockfile carries', () => {
    const lock = JSON.parse(readRepo('package-lock.json')) as { packages: Record<string, { version?: string }> }
    expect(lock.packages['node_modules/@tauri-apps/cli']?.version).toBe(env.TAURI_CLI_VERSION)
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

  it('builds the frontend, then runs the one build script, unsigned, and fails if a keystore is present', () => {
    expect(wf).toContain('run: npm --prefix frontend ci && npm --prefix frontend run build')
    expect(wf).toContain('sh scripts/android/build-apk.sh')
    expect(wf).toContain('test -z "${SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES:-}"')
    expect(wf).toContain('test ! -e src-tauri/gen/android/keystore.properties')
    expect(wf).not.toMatch(/--aab|\.aab/)
  })

  it('takes its pins from toolchain.env, builds tauri-cli from crates.io and puts the pinned Gradle on PATH', () => {
    expect(wf).toContain('. scripts/android/toolchain.env')
    expect(wf).toContain('toolchain: ${{ env.RUST_TOOLCHAIN }}')
    expect(wf).toContain('tool: tauri-cli@${{ env.TAURI_CLI_VERSION }}')
    expect(wf).toContain('gradle-version: ${{ env.GRADLE_VERSION }}')
    expect(wf).toContain('"ndk;$NDK_VERSION"')
  })

  it('build-apk.sh is the cargo tauri universal APK build for the three targets, with no AAB', () => {
    const sh = readRepo('scripts/android/build-apk.sh').split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
    expect(sh).toContain("cargo tauri android build --ci --apk --target aarch64 armv7 x86_64 \\\n  --config '{\"build\":{\"beforeBuildCommand\":null}}'")
    expect(sh).not.toMatch(/--aab/)
    expect(sh).toContain('test "$(ls "$OUT"/*.apk | wc -l)" -eq 1')
  })

  it('collects exactly one universal APK under the name the release skill states', () => {
    expect(wf).toContain('[ "${#APKS[@]}" -eq 1 ]')
    expect(wf).toContain('dist-android/SnowRaven_${VERSION}_android_universal_unsigned.apk')
    expect(wf).toMatch(/name: android-build\s*\n\s+path: dist-android\/\*\s*\n\s+if-no-files-found: error/)
  })

  it('pins the NDK the local toolchain uses', () => {
    expect(readRepo('scripts/android/toolchain.env')).toContain('NDK_VERSION=27.2.12479018')
    expect(readRepo('pipeline/android-release/toolchain.md')).toContain('ndk;27.2.12479018')
  })
})

// THE RELEASE MAC'S SCRIPTS (schema 6.2, FR-35, FR-36, FR-38, QA-35, QA-36).
// What is pinned is what no dry run on a key-less CI runner can show: no code
// path creates a keystore (the keytool command exists only inside the printed
// user step), no password is passed on a command line, nothing creates or
// overwrites a GitHub release, and the attach waits on the device check. Shell
// comments and the user-step heredoc are stripped before the code is scanned.
const USER_STEP = /<<'USER_STEP'\n([\s\S]*?)\nUSER_STEP\n/
function shellCode(text: string): string {
  return text.replace(new RegExp(USER_STEP.source, 'g'), '\n').split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
}
function createsKeystore(text: string): boolean { return /genkeypair|genkey\b/.test(shellCode(text)) }

describe('the release Mac\'s preflight, sign and attach scripts (schema 6.2)', () => {
  const NAMES = ['preflight.sh', 'sign.sh', 'attach.sh']
  const lib = readRepo('scripts/android/release-lib.sh')
  const scripts = Object.fromEntries(NAMES.map(n => [n, readRepo(`scripts/android/${n}`)]))
  const allCode = [lib, ...Object.values(scripts)].map(shellCode).join('\n')

  it('are bash scripts that source the one helper file', () => {
    for (const n of NAMES) {
      expect(scripts[n].split('\n')[0], n).toBe('#!/usr/bin/env bash')
      expect(shellCode(scripts[n]), n).toContain('. "$(dirname "$0")/release-lib.sh"')
    }
  })

  it('never create a keystore: the keytool command is the printed user step, the skill\'s command exactly', () => {
    expect(allCode.length).toBeGreaterThan(2000)
    for (const t of [lib, ...Object.values(scripts)]) expect(createsKeystore(t)).toBe(false)
    const step = lib.match(USER_STEP)?.[1] ?? ''
    const cmd = 'keytool -genkeypair -v -storetype PKCS12 -keystore ~/.tauri/snowraven-android.p12 -alias snowraven -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=SnowRaven, O=Dave Gibson"'
    expect(step).toContain(cmd)
    expect(readRepo('.claude/skills/snowraven-release/SKILL.md')).toContain(cmd)
  })

  it('hand passwords over by file, never on a command line', () => {
    expect(shellCode(scripts['sign.sh'])).toContain('--ks-pass "file:$KS_PASS_FILE" --key-pass "file:$KEY_PASS_FILE"')
    expect(shellCode(scripts['preflight.sh'])).toContain('-storepass:file "$KS_PASS_FILE"')
    expect(allCode).not.toMatch(/pass:\$|pass:"|-storepass "|-storepass \$|--ks-pass pass/)
  })

  it('attach uploads to an existing release only after the device check, and never creates or overwrites one', () => {
    const attach = shellCode(scripts['attach.sh'])
    expect(attach).toContain('case "${ANDROID_DEVICE_CHECK:-}" in')
    expect(attach.indexOf('case "${ANDROID_DEVICE_CHECK:-}" in')).toBeLessThan(attach.indexOf('gh release upload'))
    expect(attach).toContain('gh release upload "$TAG" "$APK" --repo "$SR_REPO"')
    expect(allCode).not.toMatch(/gh release create|--clobber/)
  })

  it('pin the CI run to the tag\'s commit and use the asset names the workflow and the skill state', () => {
    expect(shellCode(scripts['preflight.sh'])).toContain('--workflow android-build.yml --status success --commit "$TAG_SHA"')
    expect(lib).toContain('SR_UNSIGNED_NAME="SnowRaven_${VERSION}_android_universal_unsigned.apk"')
    expect(lib).toContain('SR_SIGNED_NAME="SnowRaven_${VERSION}_android_universal.apk"')
  })

  it('guard the guard: a keytool call outside the user step is caught, the same text inside it is not', () => {
    const inStep = 'cat <<\'USER_STEP\'\n  keytool -genkeypair -alias x\nUSER_STEP\n'
    expect(createsKeystore(inStep)).toBe(false)
    expect(createsKeystore(`${inStep}keytool -genkeypair -alias x\n`)).toBe(true)
    expect(createsKeystore('# keytool -genkeypair in a comment\n')).toBe(false)
  })
})

// GUARD THE GUARD: the same pin functions, driven against scratch strings in
// the shapes the defect would return in.
describe('the pins reject the shapes a regeneration or a slip would produce', () => {
  it('a minSdk of 24 is read as 24 (and so fails the pin above)', () => {
    expect(gradlePins(gradle.replace(/minSdk = 26/, 'minSdk = 24')).minSdk).toBe(24)
  })

  it('a second minSdk assignment fails closed rather than picking one', () => {
    expect(() => gradlePins(gradle.replace(/minSdk = 26/, 'minSdk = 26\n        minSdk = 28'))).toThrow(/exactly one/)
  })

  it('a missing defaultConfig block fails closed', () => {
    expect(() => gradlePins(gradle.replace('defaultConfig {', 'defaultConfigX {'))).toThrow()
  })

  it('a commented-out permission is not counted; an extra real one is', () => {
    const commented = manifest.replace('<application', '<!-- <uses-permission android:name="android.permission.CAMERA" /> -->\n    <application')
    expect(permissions(commented)).toEqual(permissions(manifest))
    const extra = manifest.replace('<application', '<uses-permission android:name="android.permission.CAMERA" />\n    <application')
    expect(permissions(extra)).toContain('android.permission.CAMERA')
  })

  it('a // comment holding a pin cannot satisfy it (the stripper removes it, strings survive)', () => {
    expect(stripKotlinComments('// targetSdk = 36\nval u = "https://x"')).toBe('\nval u = "https://x"')
    expect(stripKotlinComments('/* a /* nested */ b */c')).toBe('c')
    expect(() => stripKotlinComments('val s = "open')).toThrow()
  })

  it('a mobile.json carrying a geolocation grant is seen; the iOS-only file is exempt', () => {
    expect(geolocationGrantsOffIos({ platforms: ['iOS', 'android'], permissions: ['dialog:allow-open', 'geolocation:allow-get-current-position'] })).toHaveLength(1)
    expect(geolocationGrantsOffIos({ platforms: ['iOS'], permissions: ['geolocation:allow-get-current-position'] })).toEqual([])
  })

  it('the branch-A permission set differs from branch B, so a manifest left on the wrong set goes red', () => {
    expect(expectedPermissions('A')).not.toEqual(expectedPermissions('B'))
  })

  it('a manifest with two activities is seen as two', () => {
    const two = manifest.replace('</application>', '<activity android:name=".Second" android:exported="false" />\n    </application>')
    expect(xmlTags(two, 'activity')).toHaveLength(2)
  })
})
