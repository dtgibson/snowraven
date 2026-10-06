// The privacy policy's Android sentences, held to the code (android-release,
// held-copy section (d), approved 2026-10-05). `.claude/rules/docs-and-website.md`
// asks that a change adding sentences to PRIVACY_POLICY.md carry a guard of
// this shape in the same change: each row first asserts the claim EXISTS in
// both PRIVACY_POLICY.md and website/privacy.html (deleting a sentence is the
// move this guards against), scoped to its own passage, then checks the claim
// against the file in the build that makes it true.
//
// What the rows hold:
//   - "requests no location permission": the Android manifest's permission set
//     names no location permission, and the geolocation plugin is registered
//     only under the iOS cfg.
//   - "turns off the WebView's Safe Browsing and usage statistics": both
//     application-level meta-data entries are in the manifest.
//   - "no Google services, no Firebase": the app module's Gradle dependencies
//     name no Play services or Firebase coordinate.
//   - "does not make the GitHub update check": the updater footer is gated off
//     on every mobile app, Android included.
//   - the Android App section reads the same in both files.
import { describe, it, expect } from 'vitest'
import { readRepo, stripXmlComments, xmlTags } from '../test/androidProject'

const policy = readRepo('PRIVACY_POLICY.md')
const page = readRepo('website/privacy.html')
const manifest = readRepo('src-tauri/gen/android/app/src/main/AndroidManifest.xml')
const gradle = readRepo('src-tauri/gen/android/app/build.gradle.kts')
const libRs = readRepo('src-tauri/src/lib.rs')
const gates = readRepo('frontend/src/lib/platformGates.ts')

/** Plain text of an HTML fragment: tags dropped, entities decoded, whitespace collapsed. */
function plainHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Plain text of a Markdown passage: emphasis and code marks dropped, whitespace collapsed. */
function plainMd(md: string): string {
  return md.replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim()
}

/** The text of one policy section in each file, from its heading to the next. */
function section(title: string, id: string): { md: string; html: string } {
  const mdStart = policy.search(new RegExp(`^## ${title}$`, 'm'))
  if (mdStart < 0) throw new Error(`PRIVACY_POLICY.md: no "## ${title}" section`)
  const mdRest = policy.slice(mdStart + 3)
  const mdEnd = mdRest.search(/^## /m)
  const htmlStart = page.indexOf(`<h2 id="${id}">`)
  if (htmlStart < 0) throw new Error(`website/privacy.html: no <h2 id="${id}">`)
  const htmlRest = page.slice(htmlStart)
  const htmlNext = htmlRest.slice(4).search(/<h2 /)
  const htmlEnd = htmlNext < 0 ? -1 : htmlNext + 4
  return {
    md: plainMd(mdEnd < 0 ? mdRest : mdRest.slice(0, mdEnd)),
    html: plainHtml(htmlEnd < 0 ? htmlRest : htmlRest.slice(0, htmlEnd)),
  }
}

/** The sentence in `text` that contains `needle`, or undefined. */
function sentenceWith(text: string, needle: string): string | undefined {
  return text.split(/(?<=[.;])\s+/).find(s => s.includes(needle))
}

function bothSay(sec: { md: string; html: string }, needle: string): string {
  const md = sentenceWith(sec.md, needle)
  const html = sentenceWith(sec.html, needle)
  expect(md, `PRIVACY_POLICY.md says "${needle}"`).toBeDefined()
  expect(html, `website/privacy.html says "${needle}"`).toBeDefined()
  return md!
}

function appLevelMetaData(xml: string): Array<Record<string, string>> {
  const body = stripXmlComments(xml).match(/<application\b[^>]*>([\s\S]*)<\/application>/)?.[1]
  if (body === undefined) throw new Error('manifest: no <application> element')
  return xmlTags(body.replace(/<(activity|provider)\b[\s\S]*?<\/\1>/g, ''), 'meta-data')
}

const stripLineComments = (src: string) => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')

describe('the privacy policy\'s Android sentences hold against the build', () => {
  const android = section('Android App', 'android-app')
  const location = section('Your Location', 'your-location')
  const updates = section('Software Updates', 'software-updates')

  it('the Android App section reads the same in PRIVACY_POLICY.md and website/privacy.html', () => {
    expect(android.md.length).toBeGreaterThan(400)
    expect(android.html).toBe(android.md)
  })

  it('"requests no location permission": the manifest names no location permission, and geolocation is iOS-only', () => {
    bothSay(location, 'requests no location permission')
    const perms = xmlTags(stripXmlComments(manifest), 'uses-permission').map(a => a['android:name']!)
    expect(perms.length).toBeGreaterThan(0)
    expect(perms.filter(p => /LOCATION/i.test(p))).toEqual([])
    // The plugin's only registration is on the iOS-only builder line.
    const code = stripLineComments(libRs)
    const regs = [...code.matchAll(/tauri_plugin_geolocation::init\(\)/g)]
    expect(regs).toHaveLength(1)
    const before = code.slice(0, regs[0]!.index)
    expect(before.slice(before.lastIndexOf('#[cfg(')).startsWith('#[cfg(target_os = "ios")]')).toBe(true)
  })

  it('"turns off the WebView\'s Safe Browsing and usage statistics": both switches are application-level meta-data', () => {
    const s = bothSay(android, 'turns off the WebView\'s Safe Browsing and usage statistics')
    expect(s).toContain('SnowRaven')
    const meta = appLevelMetaData(manifest)
    expect(meta).toContainEqual({ 'android:name': 'android.webkit.WebView.EnableSafeBrowsing', 'android:value': 'false' })
    expect(meta).toContainEqual({ 'android:name': 'android.webkit.WebView.MetricsOptOut', 'android:value': 'true' })
  })

  it('"no Google services, no Firebase": the app module depends on neither', () => {
    bothSay(android, 'no Google services, no Firebase')
    const deps = [...stripLineComments(gradle).matchAll(/(?:implementation|api|runtimeOnly)\("([^"]+)"\)/g)].map(m => m[1]!)
    expect(deps.length).toBeGreaterThan(0)
    expect(deps.filter(d => /^com\.google\.(android\.gms|firebase)|^com\.google\.android\.play|firebase/i.test(d))).toEqual([])
  })

  it('"does not make the GitHub update check": the updater footer is off on every mobile app, Android included', () => {
    bothSay(updates, 'The Android app contains no self-update mechanism of its own')
    const body = stripLineComments(gates).match(/export function showUpdaterFooter\(\): boolean \{([^}]*)\}/)?.[1]
    expect(body?.trim()).toBe('return !isMobileApp();')
    expect(readRepo('frontend/src/lib/platform.ts')).toMatch(/export function isMobileApp\(\): boolean \{\s*return isIOS\(\) \|\| isAndroid\(\);/)
  })
})

describe('guard-the-guard', () => {
  it('a sentence missing from one file is caught, not passed', () => {
    const sec = { md: 'SnowRaven turns off the WebView\'s Safe Browsing and usage statistics.', html: 'Something else.' }
    expect(sentenceWith(sec.md, 'turns off the WebView')).toBeDefined()
    expect(sentenceWith(sec.html, 'turns off the WebView')).toBeUndefined()
  })

  it('a location permission in the manifest would be counted, a commented one would not', () => {
    const extra = manifest.replace('<application', '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <application')
    const commented = manifest.replace('<application', '<!-- <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" /> -->\n    <application')
    const loc = (xml: string) => xmlTags(stripXmlComments(xml), 'uses-permission').filter(a => /LOCATION/.test(a['android:name']!))
    expect(loc(extra)).toHaveLength(1)
    expect(loc(commented)).toHaveLength(0)
  })

  it('a Play services dependency would be caught', () => {
    const bad = gradle.replace('dependencies {', 'dependencies {\n    implementation("com.google.android.gms:play-services-location:21.3.0")')
    const deps = [...stripLineComments(bad).matchAll(/(?:implementation|api|runtimeOnly)\("([^"]+)"\)/g)].map(m => m[1]!)
    expect(deps.some(d => d.startsWith('com.google.android.gms'))).toBe(true)
  })
})
