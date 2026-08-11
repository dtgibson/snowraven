/// <reference types="node" />
//
// feature: uniform-map-fabs — the cascade-competitor scan CLAUDE.md's v0.5.81
// convention requires when a rule moves.
//
// WHAT QUESTION THIS ANSWERS, precisely, because it is easy to read it as
// answering a different one. The convention was written for an INLINE-to-class
// move, where specificity DROPS from (1,0,0) to (0,1,0) and every other rule in
// the bundle gains a chance to win that it did not previously have. This is a
// CLASS-to-class move: three hand-duplicated class rules became one shared class
// rule plus a size modifier, and specificity is unchanged at (0,1,0) throughout.
// So the scan is not repairing a specificity drop. It is proving that the NEW
// shared rule — which now paints five controls across five map surfaces instead
// of three controls with their own copies — cannot be outranked by anything else
// the bundle ships.
//
// The SOURCE-ORDER half of the risk (two same-specificity rules of our own, where
// only position decides, which is how a hovered pinned button could silently lose
// its green tint) is NOT visible to this scan and is owned by
// lib/mapFabClusterCss.test.ts.
//
// Three properties of the scan are load-bearing, per the convention:
//
//  1. It covers EVERY stylesheet the bundle emits, not just globals.css.
//     SnowRaven also ships maplibre-gl.css (imported by SnowMap.tsx, emitted as
//     a lazy vendor-maplibre-*.css chunk that stays in the document once any map
//     tab has mounted) — and these buttons live inside a map container.
//  2. It tests the RIGHTMOST COMPOUND of each selector to decide whether a rule
//     can MATCH the element. An ancestor part of a descendant combinator can
//     always be satisfied, so `.anything .sr-map-fab` is a competitor while
//     `.sr-map-fab .anything` is not. Deciding whether a matching rule is OURS is
//     a different question and reads the ancestor part too — see isOurs, and the
//     inert-glyph-profile defect it records.
//  3. It records the @layer, not only the specificity. globals.css is unlayered
//     and Tailwind preflight sits in `@layer base`; unlayered beats layered
//     regardless of specificity, and preflight's `*{padding:0}` and its `button`
//     reset compete directly with the base's `padding` and `border`. The layer is
//     determined mechanically from the enclosing at-rule stack in the BUILT css,
//     never by eye.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../', import.meta.url))            // frontend/src/
const DIST_ASSETS = resolve(SRC, '../dist/assets')

// ── A rule walker that keeps each rule's enclosing at-rule stack ─────────────

interface Rule {
  /** The selector list, verbatim. */
  prelude: string
  /** Declarations. */
  body: string
  /** Byte offset, i.e. source order within its stylesheet. */
  index: number
  /** Enclosing at-rule preludes, outermost first. */
  atStack: string[]
  /** Which stylesheet it came from. */
  sheet: string
}

/**
 * Every rule in a stylesheet, at every nesting depth, with its at-rule stack.
 *
 * Deliberately NOT parseTopLevelRules: that helper answers "does this rule apply
 * at every viewport width" and skips at-rule blocks WHOLE, which is exactly the
 * wrong behaviour here — a competitor inside `@media` or `@layer` is still a
 * competitor, and the layer is the thing being recorded.
 */
function walkRules(src: string, sheet: string): Rule[] {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: Rule[] = []
  const scan = (start: number, end: number, atStack: string[]) => {
    let i = start
    let selStart = start
    while (i < end) {
      if (css[i] === ';') { i++; selStart = i; continue }   // @import/@charset/@layer a,b;
      if (css[i] !== '{') { i++; continue }
      let depth = 1
      let j = i + 1
      while (j < end && depth > 0) {
        if (css[j] === '{') depth++
        else if (css[j] === '}') depth--
        j++
      }
      const prelude = css.slice(selStart, i).trim()
      if (prelude.startsWith('@')) {
        // Conditional group rules CONTAIN rules and must be descended into.
        // @keyframes / @font-face / @property / @counter-style do not paint our
        // elements, and their inner blocks are jumped over with the rest.
        if (/^@(media|supports|layer|container|scope|document)\b/.test(prelude)) {
          scan(i + 1, j - 1, [...atStack, prelude])
        }
      } else if (prelude) {
        out.push({ prelude, body: css.slice(i + 1, j - 1), index: i, atStack, sheet })
      }
      i = j
      selStart = j
    }
  }
  scan(0, css.length, [])
  return out
}

const isLayered = (r: Rule) => r.atStack.some(a => /^@layer\b/.test(a))

// ── Selector analysis ────────────────────────────────────────────────────────

/** Split a selector list on top-level commas (not inside () or []). */
function splitList(sel: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map(p => p.trim()).filter(Boolean)
}

/** The rightmost compound of one complex selector (the part that must match the element). */
function rightmostCompound(sel: string): string {
  let depth = 0
  let cut = 0
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) cut = i + 1
  }
  return sel.slice(cut).trim()
}

/** Simple selectors inside one compound, in order. */
function simpleParts(compound: string): string[] {
  const parts: string[] = []
  let i = 0
  while (i < compound.length) {
    const ch = compound[i]
    if (ch === '[') {
      const end = compound.indexOf(']', i)
      parts.push(compound.slice(i, end + 1)); i = end + 1; continue
    }
    if (ch === '#' || ch === '.' || ch === ':') {
      let j = i + 1
      if (ch === ':' && compound[j] === ':') j++
      while (j < compound.length && /[-\w\\]/.test(compound[j])) j++
      if (compound[j] === '(') {           // functional pseudo: take the whole ()
        let d = 1; j++
        while (j < compound.length && d > 0) { if (compound[j] === '(') d++; else if (compound[j] === ')') d--; j++ }
      }
      parts.push(compound.slice(i, j)); i = j; continue
    }
    let j = i
    while (j < compound.length && /[-\w*|\\]/.test(compound[j])) j++
    if (j === i) { i++; continue }
    parts.push(compound.slice(i, j)); i = j
  }
  return parts
}

/** (a,b,c). Functional pseudos take the MAX of their arguments; :where() takes 0. */
function specificity(sel: string): [number, number, number] {
  let a = 0, b = 0, c = 0
  const compounds = sel.split(/(?![^([]*[)\]])[\s>+~]+/).filter(Boolean)
  for (const compound of compounds) {
    for (const p of simpleParts(compound)) {
      if (p.startsWith('#')) a++
      else if (p.startsWith('[')) b++
      else if (p.startsWith('::')) c++
      else if (p.startsWith(':')) {
        const name = p.slice(1).replace(/\(.*$/s, '').toLowerCase()
        const args = p.match(/\((.*)\)$/s)?.[1]
        if (name === 'where') continue
        if (args && ['not', 'is', 'has', 'matches', 'any'].includes(name)) {
          let best: [number, number, number] = [0, 0, 0]
          for (const inner of splitList(args)) {
            const s = specificity(inner)
            if (s[0] > best[0] || (s[0] === best[0] && (s[1] > best[1] || (s[1] === best[1] && s[2] > best[2])))) best = s
          }
          a += best[0]; b += best[1]; c += best[2]
          continue
        }
        b++
      }
      else if (p === '*') continue
      else c++
    }
  }
  return [a, b, c]
}

const rank = ([a, b, c]: [number, number, number]) => a * 1e6 + b * 1e3 + c

/** Every class this feature's own rules key off. */
const FAB_CLASSES = new Set([
  'sr-map-fab', 'sr-map-fab--std', 'sr-map-fab--compact',
  'sr-share-drop-btn', 'sr-share-drop-btn--compact',
  'sr-map-locate-btn', 'sr-map-fullscreen-btn', 'sr-map-center-share-btn',
])

/** The two element profiles a FAB rule paints: the disc, and the glyph inside it. */
const PROFILES = {
  disc: { tags: new Set(['button']), classes: FAB_CLASSES },
  glyph: { tags: new Set(['svg']), classes: new Set(['lucide', 'spin']) },
}

/**
 * Could this compound match the element profile?
 *
 * Conservative in the direction that FAILS LOUDLY: an attribute selector or an
 * unrecognized pseudo-class is assumed to match, so a real competitor is never
 * silently dropped. Only an id, a foreign class, or a foreign type selector
 * rules a rule out — those genuinely cannot match a `<button class="sr-map-fab
 * sr-map-fab--std sr-map-locate-btn">`.
 *
 * Pseudo-ELEMENTS are excluded: `::before` paints a generated box, not the
 * button's own, so it is not competing for the button's `background`.
 */
function canMatch(compound: string, profile: { tags: Set<string>; classes: Set<string> }): boolean {
  for (const p of simpleParts(compound)) {
    if (p.startsWith('#')) return false
    if (p.startsWith('.')) { if (!profile.classes.has(p.slice(1).replace(/\\/g, ''))) return false; continue }
    if (p.startsWith('::')) return false
    if (p.startsWith(':') || p.startsWith('[') || p === '*') continue
    if (!profile.tags.has(p.toLowerCase())) return false
  }
  return true
}

/**
 * One spelling for a selector across sheets. The source stylesheet writes
 * `[role="tab"]:focus-visible` and the build emits `[role=tab]:focus-visible`;
 * without this, a resolution recorded against one form sits inert against the
 * other and the same rule reads as two different competitors.
 */
const normalizeSelector = (sel: string) =>
  sel.replace(/["']/g, '').replace(/\s*([>+~])\s*/g, '$1').replace(/\s+/g, ' ').trim()

/**
 * Is this one of THIS feature's own rules?
 *
 * Reads the ANCESTOR part as well as the rightmost compound, and that is
 * load-bearing rather than defensive. The glyph rule is `.sr-map-fab svg`: its
 * rightmost compound is a bare `svg`, carrying no FAB class at all. A
 * compound-only test therefore classified our own glyph rule as an OUTSIDER,
 * which left `results.glyph.ours` permanently empty — and with nothing of ours
 * to defend, `scan()` resolved every glyph outsider to `undefined` and skipped
 * it, so both glyph assertions passed on a stylesheet with any competitor in it
 * whatsoever. Caught in security review by injecting `.sr-panel svg { width:
 * 99px }` and watching all eight tests stay green. The per-profile non-vacuity
 * assertions below are the second half of that fix: this one restores the
 * classification, those make a return of the dead branch fail out loud.
 */
const isOurs = (c: { compound: string; ancestorClasses: string[] }) =>
  simpleParts(c.compound).some(p => p.startsWith('.') && FAB_CLASSES.has(p.slice(1))) ||
  c.ancestorClasses.some(cls => FAB_CLASSES.has(cls))

/** A declaration's value in a (possibly minified) body, or undefined. */
const declOf = (body: string, prop: string) =>
  body.match(new RegExp(`(?:^|[;{])\\s*${prop}\\s*:\\s*([^;}]+)`))?.[1].trim()

/** The properties the shared base and its modifiers actually set. */
const CONTESTED = [
  'display', 'align-items', 'justify-content', 'padding', 'flex', 'background',
  'color', 'border', 'border-radius', 'cursor', 'box-shadow', 'transition',
  'width', 'height',
] as const

interface Candidate {
  rule: Rule
  /** The ONE complex selector analysed, not the whole comma list it came from. */
  selector: string
  compound: string
  spec: [number, number, number]
  props: string[]
  /** Classes appearing in the selector OUTSIDE the rightmost compound. */
  ancestorClasses: string[]
}

/** Every rule in `sheets` that could paint a contested property on a FAB element. */
function candidatesFor(rules: Rule[], profile: { tags: Set<string>; classes: Set<string> }): Candidate[] {
  const out: Candidate[] = []
  for (const rule of rules) {
    for (const one of splitList(rule.prelude)) {
      const compound = rightmostCompound(one)
      if (!canMatch(compound, profile)) continue
      const props = CONTESTED.filter(p => declOf(rule.body, p) !== undefined)
      if (!props.length) continue
      const ancestorPart = one.slice(0, one.length - compound.length)
      out.push({
        rule,
        selector: normalizeSelector(one),
        compound,
        spec: specificity(one),
        props: [...props],
        ancestorClasses: [...ancestorPart.matchAll(/\.([-\w]+)/g)].map(m => m[1]),
      })
    }
  }
  return out
}

/** Does `other` beat `ours` for a normal declaration? Layer first, then specificity, then order. */
function beats(other: Candidate, ours: Candidate): boolean {
  const oLayered = isLayered(other.rule)
  const uLayered = isLayered(ours.rule)
  if (oLayered !== uLayered) return uLayered            // unlayered wins, whatever the specificity
  if (rank(other.spec) !== rank(ours.spec)) return rank(other.spec) > rank(ours.spec)
  if (other.rule.sheet !== ours.rule.sheet) return true // two sheets, load order not decided here
  return other.rule.index > ours.rule.index
}

// ── The sheets ───────────────────────────────────────────────────────────────

/** Always available: the source stylesheet plus the vendor CSS as shipped. */
const SOURCE_SHEETS: Array<[string, string]> = [
  ['globals.css', readFileSync(resolve(SRC, 'globals.css'), 'utf8')],
  ['maplibre-gl.css', readFileSync(resolve(SRC, '../node_modules/maplibre-gl/dist/maplibre-gl.css'), 'utf8')],
]

/** The emitted bundle, when a production build is present. */
function builtSheets(): Array<[string, string]> {
  if (!existsSync(DIST_ASSETS)) return []
  return readdirSync(DIST_ASSETS)
    .filter(f => f.endsWith('.css'))
    .map(f => [f, readFileSync(resolve(DIST_ASSETS, f), 'utf8')] as [string, string])
}

function scan(sheets: Array<[string, string]>) {
  const rules = sheets.flatMap(([name, css]) => walkRules(css, name))
  const results: Record<string, {
    /** Outside rules that outrank ours, deduped by selector. */
    outranking: Candidate[]
    ours: number
    outsiders: number
    layeredOutsiders: number
  }> = {}
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    const all = candidatesFor(rules, profile)
    const ours = all.filter(isOurs)
    const outsiders = all.filter(c => !isOurs(c))
    const outranking = new Map<string, Candidate>()
    for (const outsider of outsiders) {
      for (const prop of outsider.props) {
        // The WEAKEST of our own rules declaring this property is the one that
        // has to survive: if an outsider beats that, the resting value is wrong.
        const mine = ours
          .filter(c => c.props.includes(prop))
          .sort((x, y) => rank(x.spec) - rank(y.spec) || x.rule.index - y.rule.index)[0]
        if (!mine) continue
        if (beats(outsider, mine)) outranking.set(outsider.selector, outsider)
      }
    }
    results[profileName] = {
      outranking: [...outranking.values()],
      ours: ours.length,
      outsiders: outsiders.length,
      layeredOutsiders: outsiders.filter(c => isLayered(c.rule)).length,
    }
  }
  return results
}

/**
 * Classes that CANNOT be on a map FAB's ancestor chain.
 *
 * This is how an ancestor-scoped competitor is resolved, and it is the one place
 * the scan needs a fact about the DOM rather than about the stylesheet. A
 * descendant combinator needs EVERY part satisfied, so one unsatisfiable
 * ancestor rules the whole selector out — hence "at least one of these", not
 * "all of these". The FABs live in `.sr-map-fab-cluster` (Map Explorer) or
 * `.sr-share-corner` (the other four maps), both siblings of the map canvas.
 */
const NEVER_A_FAB_ANCESTOR: Record<string, string> = {
  'sr-map-layers-seg': 'the basemap switcher segment, top-right of the map; holds only its own three buttons',
  'sr-field-row': 'a stacking wrapper for paired form controls; the cluster is not a form row',
  'sr-action-row-stack': 'a label-plus-action row; same, and it is sidebar/panel furniture',
  'sr-map-sidebar-overlay': 'the filters sidebar, which the cluster sits outside of (and is hidden while it is open)',
  'maplibregl-ctrl-group': "maplibre's own control stack, injected inside the canvas container",
  'maplibregl-ctrl': 'same, one level up',
}

/**
 * Unscoped competitors: a bare `button`/`*` compound with no class ancestor at
 * all, so it genuinely reaches every FAB. Each needs a reason it is correct for
 * it to win, because it does win.
 */
const FOCUS_RING_REASON =
  'the app-wide focus ring (globals.css, "explicit selectors to override Tailwind\'s base ' +
  'reset"). It replaces the FAB drop shadow WHILE KEYBOARD-FOCUSED, which is deliberate and ' +
  'unchanged by this extraction: the three rules replaced here were (0,1,0) too, so the ring ' +
  'already won on every one of them. The visible signal is the 3px outline, which no ' +
  'box-shadow can suppress. [tabindex] is not hypothetical here — the fullscreen FAB ships ' +
  'tabIndex={0}, so that arm really does match.'
const INTENDED_UNSCOPED: Record<string, string> = {
  'button:focus-visible': FOCUS_RING_REASON,
  '[role=tab]:focus-visible': FOCUS_RING_REASON,
  '[role=button]:focus-visible': FOCUS_RING_REASON,
  '[role=switch]:focus-visible': FOCUS_RING_REASON,
  '[role=radio]:focus-visible': FOCUS_RING_REASON,
  '[tabindex]:focus-visible': FOCUS_RING_REASON,
}

// ── The guard ────────────────────────────────────────────────────────────────

/**
 * Every outranking rule is resolved here, by name, rather than the scan being
 * tuned until it reports nothing. Two resolutions are available and no others:
 * an ancestor that a FAB can never have, or a documented intent to win. A NEW
 * competitor matches neither and fails this, which is the whole point.
 */
function resolveAll(outranking: Candidate[]): string[] {
  const unresolved: string[] = []
  for (const c of outranking) {
    if (c.ancestorClasses.some(cls => cls in NEVER_A_FAB_ANCESTOR)) continue
    if (c.selector in INTENDED_UNSCOPED) continue
    unresolved.push(`${c.rule.sheet}: ${c.selector} { ${c.props.join(', ')} }`)
  }
  return unresolved
}

describe('cascade-competitor scan: source stylesheets', () => {
  const results = scan(SOURCE_SHEETS)

  /**
   * NON-VACUITY, PER PROFILE. Not one assertion for the scan as a whole.
   *
   * The scan partitions its work into two element profiles, and a partition that
   * finds nothing of ours to defend cannot find a competitor either: with `ours`
   * empty, scan()'s inner loop resolves `mine` to undefined and skips every
   * outsider, so `outranking` is `[]` and "no unresolved competitor" passes on any
   * stylesheet at all. That is exactly what shipped for the `glyph` half, and it
   * survived review of the assertions because the ONLY non-vacuity assertion
   * covered `disc`. Each partition now proves it saw both halves of its own job.
   */
  it('finds our own rules in BOTH profiles, so neither half can be vacuous', () => {
    expect(results.disc.ours, 'disc profile found none of our rules').toBeGreaterThan(3)
    // The glyph rule is `.sr-map-fab svg` and the two `[aria-disabled] svg` state
    // rules: three, all reached through their ANCESTOR class rather than the
    // rightmost compound, which is the classification the fix restored.
    expect(results.glyph.ours, 'glyph profile found none of our rules').toBeGreaterThan(0)
    // What this does NOT reject, said out loud so it is not over-read: because
    // three of our rules land in the glyph profile, deleting the glyph rule alone
    // leaves it live and this stays green. That is the intended division of
    // labour — this file owns "the profile can still see", and
    // mapFabClusterCss.test.ts owns "the glyph rule exists and says the right
    // thing", which does go red on that deletion. Both were mutation-checked.
  })

  it('leaves no unresolved competitor in globals.css or maplibre-gl.css', () => {
    expect(resolveAll(results.disc.outranking)).toEqual([])
    expect(resolveAll(results.glyph.outranking)).toEqual([])
  })

  it('actually considered outside rules in both profiles', () => {
    // maplibre-gl.css is full of `button` rules (.maplibregl-ctrl button and
    // friends), and this is where an over-eager canMatch() would show up as a
    // suspiciously empty candidate set. The glyph half has a thinner but real
    // field: rules whose rightmost compound is a bare `svg`.
    expect(results.disc.outsiders).toBeGreaterThan(0)
    expect(results.disc.outranking.length).toBeGreaterThan(0)
    expect(results.glyph.outsiders).toBeGreaterThan(0)
  })

  it('resolves each competitor for a stated reason, and every reason is used', () => {
    // A resolution nobody needs is a resolution that has stopped describing the
    // stylesheet — it would sit there excusing a rule that no longer exists while
    // reading as though it still had teeth.
    const seenAncestors = new Set(results.disc.outranking.flatMap(c => c.ancestorClasses))
    for (const cls of Object.keys(NEVER_A_FAB_ANCESTOR)) {
      expect(seenAncestors.has(cls), `${cls} is excused but no longer competes`).toBe(true)
    }
    const seenSelectors = new Set(results.disc.outranking.map(c => c.selector))
    for (const sel of Object.keys(INTENDED_UNSCOPED)) {
      expect(seenSelectors.has(sel), `${sel} is excused but no longer competes`).toBe(true)
    }
  })
})

// The BUILT bundle is where Tailwind preflight lives, and preflight is the one
// competitor that matters: `*{padding:0}` and its `button` reset set `padding`
// and `border` on exactly these elements. It loses on LAYER, not specificity,
// which is precisely why the convention says to record the layer.
describe.skipIf(builtSheets().length === 0)('cascade-competitor scan: the emitted bundle', () => {
  const sheets = builtSheets()
  const results = scan(sheets)
  const rules = sheets.flatMap(([name, css]) => walkRules(css, name))
  const fabBase = rules.find(r => splitList(r.prelude).includes('.sr-map-fab'))

  it('emits both stylesheets, so the vendor sheet is genuinely in scope', () => {
    const names = sheets.map(([n]) => n)
    expect(names.some(n => /^index-.*\.css$/.test(n))).toBe(true)
    expect(names.some(n => /^vendor-maplibre-.*\.css$/.test(n))).toBe(true)
  })

  it('ships the FAB base UNLAYERED, which is the stronger of its two grounds', () => {
    // Verified mechanically from the enclosing at-rule stack, never by eye.
    // Recording the layer matters independently of the specificity: were these
    // rules ever moved into an @layer, they would forfeit this ground and start
    // depending on specificity alone against preflight.
    expect(fabBase, '.sr-map-fab must survive the build as its own rule').toBeTruthy()
    expect(fabBase!.atStack).toEqual([])
    expect(isLayered(fabBase!)).toBe(false)
  })

  it('saw Tailwind preflight as a candidate and ruled it out on layer', () => {
    // Non-vacuity for the layer half specifically: there MUST be layered outside
    // rules setting a contested property on a button, or the "unlayered beats
    // layered" reasoning is being applied to an empty set.
    expect(results.disc.layeredOutsiders).toBeGreaterThan(0)
    const preflight = rules.filter(r =>
      isLayered(r) &&
      splitList(r.prelude).some(s => canMatch(rightmostCompound(s), PROFILES.disc)) &&
      CONTESTED.some(p => declOf(r.body, p) !== undefined))
    expect(preflight.length).toBeGreaterThan(0)
    for (const r of preflight) expect(r.atStack.some(a => /^@layer\b/.test(a))).toBe(true)
  })

  it('leaves no unresolved competitor in ANY emitted stylesheet, disc or glyph', () => {
    // This is the assertion the convention is asking for. It covers the vendor
    // sheet as well as the app's own, tests the rightmost compound of every
    // selector, and has already accounted for the layer above.
    //
    // Both profiles are re-proved non-vacuous against the BUILT sheets, not only
    // against the sources: the minifier rewrites selectors, and a profile that
    // classified correctly in globals.css could still find nothing here.
    expect(results.disc.ours, 'disc profile found none of our rules').toBeGreaterThan(3)
    expect(results.glyph.ours, 'glyph profile found none of our rules').toBeGreaterThan(0)
    expect(resolveAll(results.disc.outranking)).toEqual([])
    expect(resolveAll(results.glyph.outranking)).toEqual([])
  })
})
