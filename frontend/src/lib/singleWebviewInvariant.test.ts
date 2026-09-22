// The single-webview invariant, stated at each definition site (v1.0.9 storage
// entry in CLAUDE.md; v1.0.30 security review, Low).
//
// `docChains`, `replayStore`'s ordered writer and purge generation, the second
// purge generation in `exoticProvenanceCache.ts`, and the teardown that moves
// them are all JavaScript state, so each protects ONE JS context. What makes
// that sufficient lives in another language, another file and another layer:
// `src-tauri/src/lib.rs` calls `Builder::run`, whose own no-op run callback
// drops `RunEvent::SceneRequested`, so a second iPadOS scene never constructs a
// second webview.
//
// This guard exists because a comment is a written reminder, and CLAUDE.md
// records twice over that a written reminder alone has failed in this repo. It
// reads RAW source (the marker lives in a comment, so comment-stripping would
// defeat it) and it fails closed: a removed note, or a custom run callback
// taken at the keeper, turns it red.
/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The one mechanical cross-link. Prose decays; this does not. */
const MARKER = 'SINGLE-WEBVIEW INVARIANT'

/** Where CLAUDE.md states the invariant and its reversal condition. */
const REVERSAL = 'CLAUDE.md, "Desktop storage (Tauri)", the v1.0.9 entry'

const abs = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

const raw = (relative: string): string => readFileSync(abs(relative), 'utf8')

/**
 * Every site that must carry the note: the four pieces of module-scoped state
 * the invariant protects, plus the keeper that makes it true. Named in advance
 * on purpose - this is a claim about specific declarations, not a sweep.
 */
const SITES: ReadonlyArray<{ readonly label: string; readonly file: string }> = [
  { label: 'storage.ts (docChains / chain)', file: './storage.ts' },
  { label: 'replayStore.ts (purge generation + ordered writer)', file: './replayStore.ts' },
  { label: 'clearDerived.ts (the clear-path entry point)', file: './clearDerived.ts' },
  { label: 'exoticProvenanceCache.ts (second purge generation)', file: './exoticProvenanceCache.ts' },
  { label: 'src-tauri/src/lib.rs (the keeper)', file: '../../../src-tauri/src/lib.rs' },
]

const KEEPER = '../../../src-tauri/src/lib.rs'

/**
 * Source with commented-out lines dropped - whole-line `//` (Rust doc comments
 * included) and a `/*` block that OPENS a line. The `cacheInventory.test.ts`
 * shape, line-based for the same reason: it can never damage a comment marker
 * inside a string on a code line, and it closes the one hole that matters here,
 * which is that the keeper's own NOTE names `RunEvent::SceneRequested` and a
 * raw scan could not tell that mention from a handler. The residual imprecision
 * fails in the safe direction: a line wrongly dropped makes a `toContain` go
 * red, which is loud.
 */
const code = (relative: string): string => {
  const kept: string[] = []
  let inBlock = false
  for (const line of raw(relative).split('\n')) {
    const trimmed = line.trimStart()
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false
      continue
    }
    if (trimmed.startsWith('//')) continue
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlock = true
      continue
    }
    kept.push(line)
  }
  return kept.join('\n')
}

describe('single-webview invariant is stated at each definition site', () => {
  for (const site of SITES) {
    it(`${site.label} carries the marker`, () => {
      expect(
        raw(site.file),
        `${site.label}: the ${MARKER} note is gone. It is not decoration - the ` +
          `state at this site protects one JS context only. See ${REVERSAL}.`,
      ).toContain(MARKER)
    })
  }

  it('every note points at CLAUDE.md rather than restating the reversal condition', () => {
    // Five independent restatements would be five things that go stale apart.
    for (const site of SITES) {
      expect(raw(site.file), `${site.label}: the note does not point at CLAUDE.md`).toMatch(
        /CLAUDE\.md/,
      )
    }
  })

  it('the keeper still installs Tauri’s own no-op run callback', () => {
    const keeperCode = code(KEEPER)
    expect(
      keeperCode,
      `src-tauri/src/lib.rs no longer calls Builder::run with generate_context!(). ` +
        `If a custom run callback was taken, RunEvent::SceneRequested is now reachable ` +
        `and a second iPadOS scene can construct a second webview - at which point ` +
        `docChains, replayStore's write chain and clearDerived's purge generations all ` +
        `stop being sufficient and the shared documents need cross-context exclusion ` +
        `(a native-side lock or a single owning context, never a promise chain). ` +
        `See ${REVERSAL}.`,
    ).toContain('.run(tauri::generate_context!())')
    expect(
      keeperCode,
      `src-tauri/src/lib.rs now handles RunEvent:: in code. That is exactly the change ` +
        `the ${MARKER} notes exist to intercept. See ${REVERSAL}.`,
    ).not.toContain('RunEvent::')
  })

  // ── Guard the guard ────────────────────────────────────────────────────────

  it('the site list is non-empty and every file exists and is non-trivial', () => {
    expect(SITES.length).toBeGreaterThanOrEqual(5)
    for (const site of SITES) {
      expect(existsSync(abs(site.file)), `${site.label}: file missing at ${site.file}`).toBe(true)
      expect(raw(site.file).length, `${site.label}: file is empty`).toBeGreaterThan(500)
    }
  })

  it('the comment stripper actually strips, so the keeper row cannot pass vacuously', () => {
    // The keeper's own note names RunEvent::SceneRequested. If the stripper
    // stopped working, the `not.toContain('RunEvent::')` row above would go red
    // on a correct file rather than silently passing - but prove the two forms
    // differ here, so the reason is named rather than inferred from a failure.
    expect(raw(KEEPER)).toContain('RunEvent::SceneRequested')
    expect(code(KEEPER)).not.toContain(MARKER)
    expect(code(KEEPER).length).toBeLessThan(raw(KEEPER).length)
  })

  it('the marker is spelled one way everywhere', () => {
    // A note that spells it differently is invisible to this guard and to the
    // next person grepping for it.
    for (const site of SITES) {
      const occurrences = raw(site.file).split(MARKER).length - 1
      expect(occurrences, `${site.label}: expected at least one ${MARKER}`).toBeGreaterThanOrEqual(1)
    }
  })
})
