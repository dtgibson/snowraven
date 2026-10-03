/// <reference types="node" />
// ONE LICENSE, DECLARED THE SAME WAY EVERYWHERE F-DROID AND A PACKAGE TOOL READ
// IT (android-release FR-62; schema 6.4).
//
// The repository's LICENSE is the GNU AGPL, version 3. F-Droid lists the
// recipe's License field, cargo and npm read their manifests' license fields,
// and npm copies package.json's into the lockfile root. All of them say
// AGPL-3.0-only: "only" because nothing in the repository grants a
// later-version option (decisions.md, the license entry). A change to one of
// them without the others, or a LICENSE replaced by a different license text,
// goes red here.
import { describe, it, expect } from 'vitest'
import { readRepo } from '../test/androidProject'
import { parseFlatYaml, yamlText } from '../test/fdroidRecipe'

const SPDX = 'AGPL-3.0-only'

/** The `license` of the [package] table only; comments stripped; throws unless exactly one. */
function cargoPackageLicense(toml: string): string {
  const lines = toml.split('\n').map(l => l.replace(/\s+#.*$/, '')).filter(l => !/^\s*#/.test(l))
  const start = lines.findIndex(l => l.trim() === '[package]')
  if (start < 0) throw new Error('Cargo.toml: no [package] table')
  const end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l))
  const body = lines.slice(start + 1, end < 0 ? undefined : end)
  const ms = body.map(l => /^license\s*=\s*"([^"]*)"\s*$/.exec(l)?.[1]).filter((v): v is string => v !== undefined)
  if (ms.length !== 1) throw new Error(`Cargo.toml: expected exactly one [package] license, found ${ms.length}`)
  return ms[0]!
}

/** The LICENSE file's title and version lines (its first two non-blank lines, trimmed). */
function licenseHeading(text: string): [string, string] {
  const [title, version] = text.split('\n').map(l => l.trim()).filter(l => l !== '')
  return [title ?? '', version ?? '']
}

/** Every declared field, by where it is read. */
function declaredLicenses(files: {
  cargo: string; rootPkg: string; frontendPkg: string; rootLock: string; frontendLock: string; recipe: string
}): Record<string, string> {
  const pkg = (s: string) => (JSON.parse(s) as { license?: string }).license ?? '(none)'
  const lockRoot = (s: string) => (JSON.parse(s) as { packages: Record<string, { license?: string }> }).packages['']?.license ?? '(none)'
  return {
    'src-tauri/Cargo.toml': cargoPackageLicense(files.cargo),
    'package.json': pkg(files.rootPkg),
    'frontend/package.json': pkg(files.frontendPkg),
    'package-lock.json': lockRoot(files.rootLock),
    'frontend/package-lock.json': lockRoot(files.frontendLock),
    'F-Droid recipe License': yamlText(parseFlatYaml(files.recipe), 'License'),
  }
}

const files = {
  cargo: readRepo('src-tauri/Cargo.toml'),
  rootPkg: readRepo('package.json'),
  frontendPkg: readRepo('frontend/package.json'),
  rootLock: readRepo('package-lock.json'),
  frontendLock: readRepo('frontend/package-lock.json'),
  recipe: readRepo('pipeline/android-release/fdroid/com.dtgibson.snowraven.yml'),
}

describe('the license (FR-62)', () => {
  it('every manifest, both lockfile roots and the F-Droid recipe read AGPL-3.0-only', () => {
    const declared = declaredLicenses(files)
    expect(Object.keys(declared)).toHaveLength(6)
    for (const [where, value] of Object.entries(declared)) expect(value, where).toBe(SPDX)
  })

  it('the root LICENSE is the GNU Affero General Public License, version 3', () => {
    const [title, version] = licenseHeading(readRepo('LICENSE'))
    expect(title).toBe('GNU AFFERO GENERAL PUBLIC LICENSE')
    expect(version).toMatch(/^Version 3, /)
  })
})

// GUARD THE GUARD: the same readers against scratch text.
describe('the license checks reject the shapes a slip would produce', () => {
  it('an or-later field anywhere is seen', () => {
    const scratch = {
      ...files,
      frontendPkg: files.frontendPkg.replace(`"license": "${SPDX}"`, '"license": "AGPL-3.0-or-later"'),
    }
    expect(scratch.frontendPkg).not.toBe(files.frontendPkg)
    expect(declaredLicenses(scratch)['frontend/package.json']).toBe('AGPL-3.0-or-later')
    const recipe = files.recipe.replace(`License: ${SPDX}`, 'License: AGPL-3.0-or-later')
    expect(declaredLicenses({ ...files, recipe })['F-Droid recipe License']).toBe('AGPL-3.0-or-later')
  })

  it('Cargo.toml: a license outside [package] or commented out is not read; a second one fails closed', () => {
    const moved = files.cargo.replace(`license = "${SPDX}"\n`, '') + `\n[package.metadata.x]\nlicense = "${SPDX}"\n`
    expect(() => cargoPackageLicense(moved)).toThrow(/found 0/)
    const commented = files.cargo.replace(`license = "${SPDX}"`, `# license = "${SPDX}"`)
    expect(() => cargoPackageLicense(commented)).toThrow(/found 0/)
    const twice = files.cargo.replace(`license = "${SPDX}"`, `license = "${SPDX}"\nlicense = "MIT"`)
    expect(() => cargoPackageLicense(twice)).toThrow(/found 2/)
  })

  it('a GPL text in LICENSE is not the AGPL', () => {
    expect(licenseHeading('\n   GNU GENERAL PUBLIC LICENSE\n   Version 3, 29 June 2007\n')[0]).not.toBe('GNU AFFERO GENERAL PUBLIC LICENSE')
    expect(licenseHeading('GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 1, March 2002\n')[1]).not.toMatch(/^Version 3, /)
  })
})
