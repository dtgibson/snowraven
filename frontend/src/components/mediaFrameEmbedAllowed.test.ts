// Guard: every `<MediaFrame>` call site must FORWARD the hydrated embed preference
// (`embedAllowed={embedAllowed}`), never the JSX shorthand `embedAllowed` — which is
// a hardcoded `true` and silently turns the frame's own guard into a tautology.
//
// Why this is a source-parsing test rather than a rendering one, stated plainly:
// there is no runtime difference to assert. Both parents gate ABOVE the call
// (RecentMediaEmbed's ternary, NamedBirdMedia's `embedAllowed && (…)` wrapper), so
// MediaFrame is only ever reached when the variable is already `true` — the literal
// and the forwarded value are indistinguishable at every reachable moment. A
// rendering test therefore passes on both the fixed and the unfixed code and guards
// nothing. What the fix actually restores is a STATIC property of the call site
// (MediaFrame's documented "every frame callsite must prove the hydrated global
// preference allows an iframe" defense in depth, and the reachability of its
// `useMlEmbedGate(embedAllowed ? catalogId : '')` suppression branch), so the
// property is asserted where it lives. This follows the codebase's existing
// parse-the-source guard convention (entryChunk.test.ts, milestoneContrast.test.ts,
// helpToc.test.ts): a standing check encoded as a test instead of left to review.
//
// ONE TEST PER CALL SITE, deliberately (CLAUDE.md: "A caller that reaches MediaFrame
// down two independent paths … needs its own test — a single combined test passes on
// a half-fix"). Each test reads ONLY its own component source, so fixing one file
// leaves the other test red.
//
// MediaFrame's behavior for embedAllowed={false} (renders nothing) is covered in
// MediaEmbed.test.tsx; this file locks only that each caller hands it the real value.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Extract the attribute text of every `<MediaFrame …/>` element in a source file.
 * Brace-depth aware, so an attribute value like `key={online ? 'a' : 'b'}` can't end
 * the scan early.
 */
function mediaFrameAttrs(fileUrl: URL): string[] {
  const src = readFileSync(fileUrl, 'utf8')
  const out: string[] = []
  const TAG = '<MediaFrame'
  let i = src.indexOf(TAG)
  while (i !== -1) {
    // Guard against a longer identifier that merely starts with "MediaFrame".
    const after = src[i + TAG.length]
    if (after === undefined || /[\s/>]/.test(after)) {
      let depth = 0
      let j = i + TAG.length
      for (; j < src.length; j++) {
        const c = src[j]
        if (c === '{') depth++
        else if (c === '}') depth--
        else if (depth === 0 && c === '>') break
      }
      out.push(src.slice(i + TAG.length, j))
    }
    i = src.indexOf(TAG, i + TAG.length)
  }
  return out
}

/** The forwarded form: embedAllowed={embedAllowed}. */
const FORWARDED = /\bembedAllowed\s*=\s*\{\s*embedAllowed\s*\}/
/** A bare `embedAllowed` attribute with no `=` — the JSX shorthand for `true`. */
const SHORTHAND = /\bembedAllowed\b(?!\s*=)/

function expectForwardsEmbedAllowed(attrsList: string[]) {
  expect(attrsList.length).toBeGreaterThan(0)
  for (const attrs of attrsList) {
    // Must forward the hydrated variable...
    expect(attrs).toMatch(FORWARDED)
    // ...and must not ALSO carry the shorthand (or a hardcoded literal) form.
    expect(attrs.replace(FORWARDED, '')).not.toMatch(SHORTHAND)
  }
}

describe('MediaFrame call sites forward the hydrated embedAllowed preference', () => {
  // Reads ONLY RecentMediaEmbed.tsx — still fails if NamedBirdMedia.tsx alone is fixed.
  it('RecentMediaEmbed (Species Detail "Recent Media") passes embedAllowed={embedAllowed}', () => {
    expectForwardsEmbedAllowed(mediaFrameAttrs(new URL('./RecentMediaEmbed.tsx', import.meta.url)))
  })

  // Reads ONLY NamedBirdMedia.tsx — still fails if RecentMediaEmbed.tsx alone is fixed.
  it('NamedBirdMedia (Named Birds per-individual media) passes embedAllowed={embedAllowed}', () => {
    expectForwardsEmbedAllowed(mediaFrameAttrs(new URL('./NamedBirdMedia.tsx', import.meta.url)))
  })
})
