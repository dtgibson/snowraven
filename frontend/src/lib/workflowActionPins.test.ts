/// <reference types="node" />
// EVERY ACTION IN EVERY WORKFLOW IS PINNED TO A FULL COMMIT SHA (security L3).
//
// android-build.yml was pinned first, because the APK it builds is signed with
// the user's key and published. windows-build.yml builds the installer that
// release.sh re-signs and publishes, and pipeline.yml and pages.yml run
// third-party code with the repository checked out, so a moved tag or a
// compromised action would run someone else's code in any of them. Every
// `uses:` therefore names a 40-character commit SHA, with the release it stands
// for in a trailing comment (the one place a comment is required rather than
// stripped: the SHA alone says nothing to a reader). How to move a pin is in
// pipeline.yml's header.
//
// The workflow list is read from the directory, regular files only (testing.md
// v1.0.20), so a new workflow is covered the day it lands. This file replaced
// androidProjectPins.test.ts's Android-only row, which ran the same predicate
// over one file (removal-ledger.md, security-bloat-deps-and-tests-cleanup).
//
// Stated limit: a composite action's own steps are outside what a pin here
// reaches (actions/upload-pages-artifact names actions/upload-artifact by tag
// inside its own action.yml).
import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPO, readRepo } from '../test/androidProject'

const DIR = '.github/workflows'
const workflows = readdirSync(resolve(REPO, DIR), { withFileTypes: true })
  .filter(d => d.isFile() && /\.ya?ml$/.test(d.name))
  .map(d => d.name)
  .sort()

/** Every `uses:` step line, with its ref and whatever follows it on the line. */
function usesLines(text: string) {
  return [...text.matchAll(/^\s*(?:- )?uses:\s*(\S+)(.*)$/gm)]
    .map(([line, ref, rest]) => ({ line: line.trim(), ref, rest: rest.trim() }))
}

/** Lines that mention `uses:` outside a YAML comment, however they are written. */
function usesMentions(text: string): number {
  return text.split('\n').filter(l => /\buses:/.test(l) && !/^\s*#/.test(l)).length
}

/** null when pinned; otherwise what is wrong. A release comment is a version
 *  tag (`# v4.4.0`) or, for an action pinned off a branch, the branch and the
 *  date of its head (`# stable (2026-11-15)`). */
function pinProblem(ref: string, rest: string): string | null {
  if (!/^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[0-9a-f]{40}$/.test(ref)) return 'not owner/repo@<full commit SHA>'
  if (!/^# (?:v\d+(?:\.\d+)*\b|[a-z][\w.-]* \(\d{4}-\d{2}-\d{2}\))/.test(rest)) return 'no release in a trailing comment'
  return null
}

describe('workflow actions are pinned by commit SHA (security L3)', () => {
  it('reads every workflow in .github/workflows, the four known ones included', () => {
    expect(workflows).toEqual(expect.arrayContaining(['android-build.yml', 'pages.yml', 'pipeline.yml', 'windows-build.yml']))
  })

  it.each(workflows)('%s pins every action to a full commit SHA with its release in a trailing comment', file => {
    const text = readRepo(`${DIR}/${file}`)
    const uses = usesLines(text)
    expect(uses.length, `${file} names no action, so this row would check nothing`).toBeGreaterThan(0)
    // Every `uses:` the file mentions is one the matcher read, so a step
    // written in another shape cannot pass by not being seen.
    expect(uses.length, `${file}: a uses: line the matcher did not read`).toBe(usesMentions(text))
    for (const { line, ref, rest } of uses) expect(pinProblem(ref, rest), line).toBeNull()
  })

  it('the predicate refuses the shapes a slip or a revert would produce, and admits the pinned ones', () => {
    const sha = 'd23441a48e516b6c34aea4fa41551a30e30af803'
    const refused: Array<[string, string]> = [
      ['actions/checkout@v4', ''],
      ['actions/checkout@v4', '# v4'],
      ['actions/checkout@main', '# main (2026-11-15)'],
      ['actions/checkout@d23441a', '# v6.1.0'],
      [`actions/checkout@${sha.toUpperCase()}`, '# v6.1.0'],
      [`actions/checkout@${sha}`, ''],
      [`actions/checkout@${sha}`, '# pinned'],
      [`actions/checkout@${sha}`, '# stable'],
      ['./.github/actions/local', '# v1'],
      ['docker://alpine:3', '# v3'],
    ]
    for (const [ref, rest] of refused) expect(pinProblem(ref, rest), `${ref} ${rest}`).not.toBeNull()
    const admitted: Array<[string, string]> = [
      [`actions/checkout@${sha}`, '# v6.1.0'],
      [`gradle/actions/setup-gradle@${sha}`, '# v4.4.3'],
      [`dtolnay/rust-toolchain@${sha}`, '# v1 (2026-10-01); the toolchain comes from the input below'],
      [`dtolnay/rust-toolchain@${sha}`, '# stable (2026-11-15), the branch head'],
    ]
    for (const [ref, rest] of admitted) expect(pinProblem(ref, rest), `${ref} ${rest}`).toBeNull()
    // A step written as a flow mapping is a mention the line matcher cannot read.
    const flow = '    steps:\n      - { uses: actions/checkout@v4 }\n      # - uses: actions/setup-node@v4\n'
    expect(usesLines(flow)).toHaveLength(0)
    expect(usesMentions(flow)).toBe(1)
  })
})
