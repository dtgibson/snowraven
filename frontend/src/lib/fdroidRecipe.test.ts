/// <reference types="node" />
// THE F-DROID RECIPE AGREES WITH THE REPOSITORY IT BUILDS (android-release
// FR-57 to FR-61, QA-34, QA-67; schema 6.4 and 6.5).
//
// pipeline/android-release/fdroid/com.dtgibson.snowraven.yml is the recipe that
// goes into fdroiddata/metadata/. F-Droid reads it before it has cloned this
// repository, so it carries the toolchain pins as literals: this guard holds
// them to scripts/android/toolchain.env. It runs the recipe's UpdateCheckData
// regexes against the committed src-tauri/tauri.conf.json the way fdroidserver's
// checkupdates runs them at a tag (test/fdroidRecipe.ts says how), so a bump
// that moves one of the two values without the other, or a config edit that
// gives a regex a second match, goes red here rather than leaving F-Droid
// unable to see a release. And it holds the recipe's build steps to the one
// script CI runs.
//
// The Builds entry and CurrentVersion/CurrentVersionCode carry tauri.conf.json's
// pair (1.0.48 / 1000048 / v1.0.48 when this was written): the Deployer moves
// them with the version bump, and these rows go red until they move together.
//
// What it cannot see: whether the sudo: block provisions a working toolchain on
// F-Droid's Debian build server (only the fdroiddata merge request's pipeline
// runs it), and whether each scandelete path exists at scan time (that needs
// the prebuild to have run; pipeline/android-release/fdroid-verification.md
// records the local fdroidserver run that checks it).
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPO, readRepo } from '../test/androidProject'
import {
  parseFlatYaml, parseShellEnv, splitUpdateCheckData, matchOnce,
  yamlText, yamlList, yamlTextList, yamlScript, yamlMap, type YamlMap,
} from '../test/fdroidRecipe'

const RECIPE_PATH = 'pipeline/android-release/fdroid/com.dtgibson.snowraven.yml'
const recipeText = readRepo(RECIPE_PATH)
const envText = readRepo('scripts/android/toolchain.env')
const tauriConfText = readRepo('src-tauri/tauri.conf.json')

const UPDATE_CHECK_DATA = 'src-tauri/tauri.conf.json|"versionCode":\\s*(\\d+)|.|"version":\\s*"([\\d.]+)"'
const OUTPUT_APK = 'src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk'

// The top-level fields, as a set: their ORDER and line folding belong to
// `fdroid rewritemeta`, which fdroiddata's CI runs on every merge request, so
// these rows hold the same in the schema's layout and in rewritemeta's. No
// Name, Summary or Description: F-Droid reads those from the Fastlane folder
// at the tag, and `fdroid lint` warns when both exist.
const TOP_LEVEL = [
  'AntiFeatures', 'AuthorName', 'AutoUpdateMode', 'Builds', 'Categories', 'Changelog', 'CurrentVersion',
  'CurrentVersionCode', 'IssueTracker', 'License', 'Repo', 'RepoType', 'SourceCode', 'UpdateCheckData',
  'UpdateCheckMode', 'WebSite',
]
// No gradle: (a bare Gradle run cannot build this app, schema 6.0), no
// scanignore, no subdir, no srclibs.
const BUILD_KEYS = [
  'build', 'commit', 'ndk', 'output', 'prebuild', 'scandelete', 'sudo', 'timeout', 'versionCode', 'versionName',
]
const sorted = (xs: string[]) => [...xs].sort()

// F-Droid names an NDK by its release letter; toolchain.env by its package
// version. One row per pin ever used; a new NDK_VERSION fails closed until its
// F-Droid name is added here.
const NDK_RELEASE_NAME: Record<string, string> = { '27.2.12479018': 'r27c' }

/** The Tauri CLI's formula, the one documented function of the version string. */
const versionCode = (v: string) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v)
  if (!m) throw new Error(`not a major.minor.patch version: ${v}`)
  return Number(m[1]) * 1_000_000 + Number(m[2]) * 1000 + Number(m[3])
}

function buildEntry(recipe: YamlMap): YamlMap {
  const builds = yamlList(recipe, 'Builds')
  if (builds.length !== 1) throw new Error(`Builds: expected the one seed entry, found ${builds.length}`)
  return yamlMap(builds[0], 'Builds[0]')
}

// ── The checks, as functions over file text that return their findings, so
// the guard-the-guard rows below drive the SAME code against scratch text. ──

/** Where the recipe's toolchain literals differ from toolchain.env. */
function toolchainProblems(recipeSrc: string, envSrc: string): string[] {
  const env = parseShellEnv(envSrc)
  const need = (k: string) => {
    if (!Object.hasOwn(env, k) || env[k] === '') throw new Error(`toolchain.env: ${k} missing`)
    return env[k]!
  }
  const rust = need('RUST_TOOLCHAIN')
  const targets = need('RUST_TARGETS').split(' ')
  const cli = need('TAURI_CLI_VERSION')
  const ndk = need('NDK_VERSION')
  const b = buildEntry(parseFlatYaml(recipeSrc))
  const problems: string[] = []
  const expectedSudo = [
    'apt-get update',
    'apt-get install -y nodejs npm rustup build-essential pkg-config libssl-dev cmake',
    'export RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo',
    `rustup toolchain install ${rust} --profile minimal ${targets.map(t => `--target ${t}`).join(' ')}`,
    `cargo +${rust} install tauri-cli --version ${cli} --locked --root /opt/cargo`,
    `ln -s /opt/rustup/toolchains/${rust}-x86_64-unknown-linux-gnu/bin/* /usr/local/bin/`,
    'ln -s /opt/cargo/bin/cargo-tauri /usr/local/bin/cargo-tauri',
    'chmod -R a+rX /opt/rustup /opt/cargo',
  ]
  const sudo = yamlScript(b, 'sudo')
  if (JSON.stringify(sudo) !== JSON.stringify(expectedSudo)) {
    problems.push(`sudo differs from toolchain.env:\n  recipe: ${JSON.stringify(sudo)}\n  expect: ${JSON.stringify(expectedSudo)}`)
  }
  // Every x.y.z in the provisioning is one of the two pins, whatever line it
  // sits on, so a stray version cannot hide behind an edited expectation.
  for (const line of sudo) {
    for (const [v] of line.matchAll(/\b\d+\.\d+\.\d+\b/g)) {
      if (v !== rust && v !== cli) problems.push(`sudo carries ${v}, which is neither RUST_TOOLCHAIN nor TAURI_CLI_VERSION`)
    }
  }
  const ndkName = Object.hasOwn(NDK_RELEASE_NAME, ndk) ? NDK_RELEASE_NAME[ndk] : undefined
  if (ndkName === undefined) problems.push(`NDK_VERSION ${ndk} has no F-Droid release name in this guard`)
  else if (yamlText(b, 'ndk') !== ndkName) problems.push(`ndk is ${yamlText(b, 'ndk')}, toolchain.env pins ${ndkName}`)
  return problems
}

/** Where the recipe's version fields disagree with tauri.conf.json or each other. */
function versionProblems(recipeSrc: string, confSrc: string): string[] {
  const recipe = parseFlatYaml(recipeSrc)
  const conf = JSON.parse(confSrc) as { version: string; bundle?: { android?: { versionCode?: unknown } } }
  const code = conf.bundle?.android?.versionCode
  const problems: string[] = []
  const cv = yamlText(recipe, 'CurrentVersion')
  const cvc = yamlText(recipe, 'CurrentVersionCode')
  // Text YAML reads as a string (two dots), and a code YAML reads as an integer.
  if (!/^\d+\.\d+\.\d+$/.test(cv)) problems.push(`CurrentVersion ${cv} is not major.minor.patch`)
  if (!/^[1-9]\d*$/.test(cvc)) problems.push(`CurrentVersionCode ${cvc} is not a positive integer`)
  if (cv !== conf.version) problems.push(`CurrentVersion ${cv} != tauri.conf.json version ${conf.version}`)
  if (cvc !== String(code)) problems.push(`CurrentVersionCode ${cvc} != tauri.conf.json bundle.android.versionCode ${String(code)}`)
  if (/^\d+\.\d+\.\d+$/.test(cv) && Number(cvc) !== versionCode(cv)) problems.push(`CurrentVersionCode ${cvc} != the formula of ${cv}`)
  const b = buildEntry(recipe)
  if (yamlText(b, 'versionName') !== cv) problems.push(`Builds[0].versionName ${yamlText(b, 'versionName')} != CurrentVersion ${cv}`)
  if (yamlText(b, 'versionCode') !== cvc) problems.push(`Builds[0].versionCode ${yamlText(b, 'versionCode')} != CurrentVersionCode ${cvc}`)
  if (yamlText(b, 'commit') !== `v${cv}`) problems.push(`Builds[0].commit ${yamlText(b, 'commit')} != v${cv}`)
  return problems
}

/** The two values F-Droid's update check reads from a file text. Throws unless each regex matches exactly once. */
function updateCheckValues(field: string, fileText: string): { code: string; name: string } {
  const u = splitUpdateCheckData(field)
  return {
    code: matchOnce(u.codeRe, fileText, 'version code').trim(),
    name: matchOnce(u.nameRe, fileText, 'version name'),
  }
}

const recipe = parseFlatYaml(recipeText)
const tauriConf = JSON.parse(tauriConfText) as {
  version: string
  bundle: { android: { versionCode: number } }
  plugins: { updater: { endpoints: string[] } }
}

describe('the recipe parses, with exactly the fields fdroiddata reads from it', () => {
  it('exactly the top-level fields; no Name, Summary or Description', () => {
    expect(sorted(Object.keys(recipe))).toEqual(TOP_LEVEL)
  })

  it('one seed Builds entry, with exactly the build keys', () => {
    expect(sorted(Object.keys(buildEntry(recipe)))).toEqual(BUILD_KEYS)
  })
})

describe('the repository identity (FR-57, FR-62)', () => {
  const source = yamlText(recipe, 'SourceCode')

  it('License is AGPL-3.0-only (androidLicense.test.ts holds the repository to it)', () => {
    expect(yamlText(recipe, 'License')).toBe('AGPL-3.0-only')
  })

  it('SourceCode is the repository the updater and Cargo.toml name', () => {
    const endpoint = tauriConf.plugins.updater.endpoints[0]!
    expect(endpoint.startsWith(`${source}/releases/`)).toBe(true)
    expect(readRepo('src-tauri/Cargo.toml')).toMatch(new RegExp(`^repository = "${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"$`, 'm'))
  })

  it('Repo, RepoType, IssueTracker and Changelog follow from it; the changelog exists', () => {
    expect(yamlText(recipe, 'RepoType')).toBe('git')
    expect(yamlText(recipe, 'Repo')).toBe(`${source}.git`)
    expect(yamlText(recipe, 'IssueTracker')).toBe(`${source}/issues`)
    // /HEAD/, never /main/: `fdroid lint`, which fdroiddata's CI runs on every
    // merge request, refuses a branch name (fdroid-verification.md).
    expect(yamlText(recipe, 'Changelog')).toBe(`${source}/blob/HEAD/CHANGELOG.md`)
    expect(existsSync(resolve(REPO, 'CHANGELOG.md'))).toBe(true)
  })

  it('WebSite is the published site (website/CNAME)', () => {
    expect(yamlText(recipe, 'WebSite')).toBe(`https://${readRepo('website/CNAME').trim()}/`)
  })

  it('AuthorName and Categories are present', () => {
    expect(yamlText(recipe, 'AuthorName')).not.toBe('')
    const cats = yamlTextList(recipe, 'Categories')
    expect(cats.length).toBeGreaterThan(0)
  })

  it('NonFreeNet is self-declared with an en-US reason, and nothing else is declared', () => {
    const af = yamlMap(recipe.AntiFeatures, 'AntiFeatures')
    expect(Object.keys(af)).toEqual(['NonFreeNet'])
    const reasons = yamlMap(af.NonFreeNet, 'AntiFeatures.NonFreeNet')
    expect(Object.keys(reasons)).toEqual(['en-US'])
    const reason = yamlText(reasons, 'en-US')
    expect(reason.length).toBeGreaterThan(0)
    expect(reason).not.toContain('\u2014')
  })
})

describe('the version F-Droid publishes (FR-05, FR-06)', () => {
  it('CurrentVersion, CurrentVersionCode and the Builds entry agree with tauri.conf.json and the formula', () => {
    expect(versionProblems(recipeText, tauriConfText)).toEqual([])
  })

  it('tauri.conf.json is the app version (frontend/package.json)', () => {
    expect(tauriConf.version).toBe((JSON.parse(readRepo('frontend/package.json')) as { version: string }).version)
  })

  it('timeout is three hours', () => {
    expect(yamlText(buildEntry(recipe), 'timeout')).toBe('10800')
  })
})

describe('the update check, run here as checkupdates runs it at a tag (QA-67)', () => {
  it('Tags mode on the release tag shape, with Version auto-update', () => {
    expect(yamlText(recipe, 'UpdateCheckMode')).toBe('Tags ^v[0-9.]+$')
    expect(yamlText(recipe, 'AutoUpdateMode')).toBe('Version')
  })

  it('the tag pattern takes every release tag and refuses a pre-release or an unprefixed one', () => {
    const mode = yamlText(recipe, 'UpdateCheckMode')
    expect(mode.startsWith('Tags ')).toBe(true)
    const pattern = mode.slice('Tags '.length)
    // Anchored at both ends, so Python's re.match and RegExp.test agree.
    expect(pattern.startsWith('^') && pattern.endsWith('$')).toBe(true)
    const tag = new RegExp(pattern)
    for (const t of ['v1.0.49', 'v1.0.48', 'v1.1.0', 'v10.20.300']) expect(tag.test(t), t).toBe(true)
    for (const t of ['v1.0.49-rc1', '1.0.49', 'v1.0.49 ', 'release-1.0.49', 'vv1.0.49']) expect(tag.test(t), t).toBe(false)
  })

  it('UpdateCheckData reads the code and then the name from tauri.conf.json, with no "|" in either regex', () => {
    expect(yamlText(recipe, 'UpdateCheckData')).toBe(UPDATE_CHECK_DATA)
    const u = splitUpdateCheckData(yamlText(recipe, 'UpdateCheckData'))
    expect(u.codeFile).toBe('src-tauri/tauri.conf.json')
    expect(u.nameFile).toBe(u.codeFile)
  })

  it('each regex matches the committed tauri.conf.json exactly once and yields its version pair', () => {
    // ASCII only, so Python's Unicode \d and \s and JavaScript's read it alike.
    expect([...tauriConfText].filter(c => c.charCodeAt(0) > 0x7f)).toEqual([])
    expect(updateCheckValues(yamlText(recipe, 'UpdateCheckData'), tauriConfText)).toEqual({
      code: String(tauriConf.bundle.android.versionCode),
      name: tauriConf.version,
    })
  })
})

describe('the toolchain the recipe installs is toolchain.env (QA-34)', () => {
  it('the sudo provisioning and the ndk carry exactly the pinned versions', () => {
    expect(toolchainProblems(recipeText, envText)).toEqual([])
  })

  it('the Tauri CLI the recipe builds from source is the one package-lock.json pins', () => {
    const lock = JSON.parse(readRepo('package-lock.json')) as { packages: Record<string, { version?: string }> }
    expect(lock.packages['node_modules/@tauri-apps/cli']?.version).toBe(parseShellEnv(envText).TAURI_CLI_VERSION)
  })
})

describe('the build steps are the ones CI runs (QA-34)', () => {
  const b = buildEntry(recipe)

  // The prebuild's last line removes the frontend toolchain before F-Droid's
  // scan, so the scan never sees whatever native binaries a build dependency
  // ships. fdroidserver 2.4.5 refuses a scandelete path that matches nothing
  // or removes nothing, which is what the schema's two node_modules entries did
  // (fdroid-verification.md, "Where the schema did not hold"). The APK build
  // needs nothing from node_modules: build-apk.sh drops the beforeBuildCommand.
  const FRONTEND_BUILD = ['npm --prefix frontend ci', 'npm --prefix frontend run build']
  const TOOLCHAIN_REMOVAL = 'rm -rf frontend/node_modules'

  it('prebuild builds the frontend and then removes its toolchain; build runs the shared script', () => {
    expect(yamlScript(b, 'prebuild')).toEqual([...FRONTEND_BUILD, TOOLCHAIN_REMOVAL])
    expect(yamlScript(b, 'build')).toEqual(['sh scripts/android/build-apk.sh'])
    expect(readRepo('scripts/android/build-apk.sh').split('\n')[0]).toBe('#!/bin/sh')
    const scriptCode = readRepo('scripts/android/build-apk.sh').split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
    expect(scriptCode).toContain('"beforeBuildCommand":null')
  })

  it('the workflow runs the same frontend build and then the same script', () => {
    // YAML comments dropped line by line, so the workflow's prose cannot satisfy the row.
    const wf = readRepo('.github/workflows/android-build.yml').split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
    const front = yamlScript(b, 'prebuild').slice(0, FRONTEND_BUILD.length).join(' && ')
    const script = yamlScript(b, 'build')[0]!
    expect(wf).toContain(front)
    expect(wf).toContain(script)
    expect(wf.indexOf(front)).toBeLessThan(wf.indexOf(script))
  })

  it('output is the one unsigned universal release APK, in the directory build-apk.sh checks', () => {
    expect(yamlText(b, 'output')).toBe(OUTPUT_APK)
    const script = readRepo('scripts/android/build-apk.sh').split('\n').filter(l => !/^\s*#/.test(l))
    const out = script.map(l => /^OUT=(\S+)$/.exec(l)?.[1]).filter(Boolean)
    expect(out).toEqual([OUTPUT_APK.slice(0, OUTPUT_APK.lastIndexOf('/'))])
  })

  it('scandelete names only the one tracked extensionless binary, which exists', () => {
    expect(yamlTextList(b, 'scandelete')).toEqual(['src-tauri/dmg/dmg-DS_Store'])
    // (Whether the scan then finds nothing is outside this guard's reach:
    // fdroid-verification.md records the local scanner and build runs.)
    // The scanner refuses a scandelete path that matches nothing.
    expect(existsSync(resolve(REPO, 'src-tauri/dmg/dmg-DS_Store'))).toBe(true)
  })
})

// GUARD THE GUARD: the same readers and checks, driven against scratch text in
// the shapes a slip would arrive in. The committed files are never edited.
describe('the recipe checks reject the shapes a slip would produce', () => {
  it('a recipe line with a different Rust version is two findings', () => {
    const bad = recipeText.replace('rustup toolchain install 1.96.1', 'rustup toolchain install 1.95.0')
    expect(bad).not.toBe(recipeText)
    const p = toolchainProblems(bad, envText)
    expect(p.some(x => x.startsWith('sudo differs'))).toBe(true)
    expect(p).toContain('sudo carries 1.95.0, which is neither RUST_TOOLCHAIN nor TAURI_CLI_VERSION')
  })

  it('a different tauri-cli version, a dropped Android target and a different ndk are each seen', () => {
    expect(toolchainProblems(recipeText.replace('--version 2.11.2', '--version 2.11.3'), envText)).not.toEqual([])
    expect(toolchainProblems(recipeText.replace(' --target armv7-linux-androideabi', ''), envText)).not.toEqual([])
    expect(toolchainProblems(recipeText.replace('ndk: r27c', 'ndk: r28b'), envText)).toEqual(['ndk is r28b, toolchain.env pins r27c'])
  })

  it('toolchain.env moving alone is seen, and an NDK the guard cannot name fails closed', () => {
    expect(toolchainProblems(recipeText, envText.replace('RUST_TOOLCHAIN=1.96.1', 'RUST_TOOLCHAIN=1.97.0'))).not.toEqual([])
    expect(toolchainProblems(recipeText, envText.replace('NDK_VERSION=27.2.12479018', 'NDK_VERSION=28.0.1'))).toEqual([
      'NDK_VERSION 28.0.1 has no F-Droid release name in this guard',
    ])
  })

  it('a version bump that moves the name but not the code, or the code off the formula, is seen', () => {
    const conf = JSON.parse(tauriConfText) as { version: string }
    const [maj, min, pat] = conf.version.split('.').map(Number) as [number, number, number]
    const ahead = `${maj}.${min}.${pat + 1}`
    const confAhead = tauriConfText.replace(`"version": "${conf.version}"`, `"version": "${ahead}"`)
    expect(confAhead).not.toBe(tauriConfText)
    expect(versionProblems(recipeText, confAhead)).toContain(`CurrentVersion ${conf.version} != tauri.conf.json version ${ahead}`)
    const recipeAhead = recipeText.replace(`CurrentVersion: ${conf.version}`, `CurrentVersion: ${ahead}`)
    expect(versionProblems(recipeAhead, confAhead).some(x => x.includes('!= the formula'))).toBe(true)
    expect(versionProblems(recipeText.replace(/commit: v\S+/, 'commit: main'), tauriConfText)).toEqual([
      `Builds[0].commit main != v${conf.version}`,
    ])
  })

  it('a second "version" or a missing versionCode in tauri.conf.json fails the update check closed', () => {
    const field = yamlText(recipe, 'UpdateCheckData')
    const twice = tauriConfText.replace('"productName"', '"version": "9.9.9",\n  "productName"')
    expect(() => updateCheckValues(field, twice)).toThrow(/exactly one match/)
    const none = tauriConfText.replace(/"versionCode":\s*\d+/, '"versionCodeX": 1')
    expect(() => updateCheckValues(field, none)).toThrow(/found 0/)
    expect(() => splitUpdateCheckData('a|b|c')).toThrow(/4/)
  })

  it('the YAML reader fails closed on shapes it does not read', () => {
    for (const [src, why] of [
      ['a:\n\tb: c\n', /tab/],
      ['a: [b, c]\n', /unsupported scalar/],
      ['a: "quoted"\n', /unsupported scalar/],
      ['a: |\n  block\n', /unsupported scalar/],
      ['a: &x b\n', /unsupported scalar/],
      ['a: b\na: c\n', /duplicate key/],
      ['a:\nb: c\n', /has no value/],
      ['a:\n- b\n', /own indentation/],
      ['a: b: c\n', /": " inside/],
      ['a: ~\n', /YAML null/],
      ['---\na: b\n', /document marker/],
      ['a: b\r\n', /CR/],
      ['a:\n  - b\n   - c\n', /opening with "- "/],
      ['a:\n  - k: v\n   x: y\n', /unexpected indentation/],
      ['a: b # note\n  c\n', /after a comment/],
      ['a: b\n\n  c\n', /after a blank/],
      ['a: b\n  c: d\n', /": " inside/],
      ['a:\n    b: c\n  d: e\n', /unexpected indentation/],
    ] as Array<[string, RegExp]>) {
      expect(() => parseFlatYaml(src), JSON.stringify(src)).toThrow(why)
    }
  })

  it('the YAML reader drops comments and reads a mapping opened on a sequence item', () => {
    expect(parseFlatYaml('# CurrentVersion: 9.9.9\na: b # note\nl:\n  - x\n  - k: v\n    m:\n      - n\n')).toEqual({
      a: 'b', l: ['x', { k: 'v', m: ['n'] }],
    })
  })

  it('the YAML reader folds continuation lines the way rewritemeta writes them, and a one-line script reads as one line', () => {
    const folded = 'k: one two\n  three\nl:\n  - a b\n    --c d\n  - e\nm:\n  - n: x\n      y\n    o: p\n'
    expect(parseFlatYaml(folded)).toEqual({ k: 'one two three', l: ['a b --c d', 'e'], m: [{ n: 'x y', o: 'p' }] })
    expect(yamlScript(parseFlatYaml('build: sh x.sh\n'), 'build')).toEqual(['sh x.sh'])
    expect(yamlScript(parseFlatYaml('build:\n  - sh x.sh\n'), 'build')).toEqual(['sh x.sh'])
    expect(() => yamlScript(parseFlatYaml('build:\n  k: v\n'), 'build')).toThrow(/not a sequence/)
  })

  it('the env reader refuses what sh would expand', () => {
    expect(() => parseShellEnv('A=$(id)\n')).toThrow(/unrecognized/)
    expect(() => parseShellEnv('A="$HOME"\n')).toThrow(/unrecognized/)
    expect(() => parseShellEnv('A=1\nA=2\n')).toThrow(/twice/)
    expect(parseShellEnv('# c\nA=1 # note\nB="x y"\n')).toEqual({ A: '1', B: 'x y' })
  })
})
