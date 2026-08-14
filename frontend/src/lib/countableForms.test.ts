// THE PROOF FOR report-as-countability.
//
// `isNonCountableForm` ships eBird's countability verdict in a COMPRESSED form:
// eBird's own naming convention (`isNonCountableNameShape`) plus 169 corrections
// in `assets/ebird-countability.json`. Shipping all 17,891 verdicts would cost
// ~105 KB gzipped on the entry chunk; the compression costs 2.6 KB.
//
// A compression is only safe if it is verified rather than argued, so this file
// re-derives eBird's verdict INDEPENDENTLY from the taxonomy snapshot (it does not
// import the generator) and asserts:
//
//   1. the shipped artifact is exactly what the snapshot implies (no stale file),
//   2. the shipped predicate equals the full `reportAs` lookup NAME BY NAME over
//      every published name, which is the compression's whole claim,
//   3. both directions of the delta, with the counts the record quotes,
//   4. the fallback for a name eBird does not publish,
//   5. the one question real data structurally cannot answer, via probes.
//
// The independent derivation is deliberate: a test that reused the generator's own
// code would pass on a generator bug. Here the test is the specification and the
// generator must match it.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  isNonCountableForm,
  isNonCountableNameShape,
  normalizeSpeciesName,
  truncateAtFirstParen,
  COUNTABILITY_VERSION,
} from './speciesUtils'

interface Snapshot {
  version: string
  byCode: Record<string, string>
  byCom: Record<string, string>
  reportAs: Record<string, string>
}
interface Artifact {
  version: string
  names: number
  countable: string[]
  nonCountable: string[]
}

const snapshot = JSON.parse(
  readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8'),
) as Snapshot
const artifact = JSON.parse(
  readFileSync(new URL('../assets/ebird-countability.json', import.meta.url), 'utf8'),
) as Artifact

// ── The independent derivation ────────────────────────────────────────────────

/** name -> speciesCode over ALL categories. `byCode` is the only all-category map,
 *  so inverting it enumerates every name eBird publishes. */
const nameToCode = new Map<string, string>()
for (const [code, name] of Object.entries(snapshot.byCode)) {
  if (name) nameToCode.set(name, code)
}
/** `byCom` is species-only, so its VALUES are exactly the species codes. */
const speciesCodes = new Set(Object.values(snapshot.byCom))

/** eBird's rule, straight from the taxonomy: a code counts when it is a species,
 *  or when `reportAs` resolves it to one. */
function eBirdCounts(code: string): boolean {
  return speciesCodes.has(code) || Object.prototype.hasOwnProperty.call(snapshot.reportAs, code)
}

const publishedNames = [...nameToCode.keys()]

describe('the inversion the whole design rests on', () => {
  it('is lossless: every published name maps to exactly one code', () => {
    // If two codes shared a name, a name could not decide a verdict at all and the
    // predicate would have to be keyed by something else.
    expect(Object.keys(snapshot.byCode)).toHaveLength(17_891)
    expect(nameToCode.size).toBe(17_891)
    const lowered = new Set(publishedNames.map(n => n.toLowerCase()))
    expect(lowered.size).toBe(17_891)   // no case-only collisions either
  })

  it('splits the published names into 15,287 countable and 2,604 not', () => {
    const nonCountable = publishedNames.filter(n => !eBirdCounts(nameToCode.get(n)!))
    expect(nonCountable).toHaveLength(2_604)
    expect(publishedNames.length - nonCountable.length).toBe(15_287)
  })
})

// ── 1. The artifact is not stale ──────────────────────────────────────────────

describe('the shipped artifact matches the shipped snapshot', () => {
  const expectedCountable = publishedNames
    .filter(n => eBirdCounts(nameToCode.get(n)!) && isNonCountableNameShape(n))
    .sort()
  const expectedNonCountable = publishedNames
    .filter(n => !eBirdCounts(nameToCode.get(n)!) && !isNonCountableNameShape(n))
    .sort()

  it('lists exactly the names the snapshot implies, member by member', () => {
    expect(artifact.countable).toEqual(expectedCountable)
    expect(artifact.nonCountable).toEqual(expectedNonCountable)
  })

  it('was built from THIS taxonomy revision', () => {
    // The one way the pair can silently go stale: regenerating the snapshot on the
    // annual Clements revision without regenerating the corrections.
    expect(artifact.version).toBe(snapshot.version)
    expect(COUNTABILITY_VERSION).toBe(snapshot.version)
    expect(artifact.names).toBe(nameToCode.size)
  })

  it('keeps the two lists disjoint, which is what makes their order irrelevant', () => {
    const counts = new Set(artifact.countable)
    expect(artifact.nonCountable.filter(n => counts.has(n))).toEqual([])
  })
})

// ── 2. The compression is exact ───────────────────────────────────────────────

describe('the shipped predicate IS eBird\'s verdict over every published name', () => {
  it('agrees with the full reportAs lookup on all 17,891 names', () => {
    // THE load-bearing assertion of this build. Everything else is detail.
    const divergences = publishedNames.filter(
      name => isNonCountableForm(name) === eBirdCounts(nameToCode.get(name)!),
    )
    expect(divergences).toEqual([])
    expect(publishedNames).toHaveLength(17_891)   // never vacuous
  })

  it('the sweep DETECTS a compression that drops the admissions', () => {
    // Guard the guard. A sweep that reported zero divergences for everything would
    // pass the assertion above while proving nothing, so point it at a named wrong
    // compression: one that ships only the rejections and forgets the 88 names
    // eBird counts. It must report exactly those 88.
    const rejects = new Set(artifact.nonCountable)
    const halfCompressed = (name: string): boolean =>
      rejects.has(name) ? true : isNonCountableNameShape(name)
    const divergences = publishedNames.filter(
      name => halfCompressed(name) === eBirdCounts(nameToCode.get(name)!),
    )
    expect(divergences).toHaveLength(88)
  })
})

// ── 3. Both directions of the delta ───────────────────────────────────────────

describe('direction A: 88 names eBird counts that the shape rule rejected', () => {
  const admitted = artifact.countable

  it('admits 88 names folding into 59 parent species', () => {
    expect(admitted).toHaveLength(88)
    const parents = new Set(
      admitted.map(n => {
        const code = nameToCode.get(n)!
        return snapshot.reportAs[code] ?? code
      }),
    )
    expect(parents.size).toBe(59)
  })

  it('is bread-and-butter North American birding, not an edge case', () => {
    for (const name of [
      'Canada Goose (moffitti/maxima)',
      'Redpoll (Common/Hoary)',
      'Dark-eyed Junco (Slate-colored/cismontanus)',
      'Iceland Gull (thayeri/kumlieni)',
      'Red-tailed Hawk (calurus/abieticola)',
      'Song Sparrow (melodia/atlantica)',
    ]) {
      expect(admitted).toContain(name)
      expect(isNonCountableNameShape(name)).toBe(true)   // the old rule excluded it
      expect(isNonCountableForm(name)).toBe(false)       // eBird counts it
    }
  })

  it('every one of them is a subspecies-group form, never a species-level slash', () => {
    // The distinction the whole change turns on: ambiguity about which SUBSPECIES
    // counts as the parent, ambiguity about which SPECIES does not. If a
    // species-level slash ever appeared here, the rule would be admitting a bird
    // whose identity is genuinely unknown.
    for (const name of admitted) {
      const code = nameToCode.get(name)!
      expect(speciesCodes.has(code)).toBe(false)                 // not a species itself
      expect(snapshot.reportAs[code]).toBeDefined()              // resolves to a parent
      expect(speciesCodes.has(snapshot.reportAs[code])).toBe(true)
    }
  })
})

describe('direction B: 81 names the shape rule counted that eBird does not', () => {
  const rejected = artifact.nonCountable

  it('rejects 81 names: 3 named hybrids, 25 spuhs, 53 undescribed forms', () => {
    expect(rejected).toHaveLength(81)
    const hybrids = rejected.filter(n => /\(hybrid\)$/.test(n))
    const spuhs = rejected.filter(n => !/\(hybrid\)$/.test(n) && n.includes(' sp.'))
    const undescribed = rejected.filter(
      n => !/\(hybrid\)$/.test(n) && !n.includes(' sp.') && /undescribed|unrecognized/.test(n),
    )
    expect(hybrids).toHaveLength(3)
    expect(spuhs).toHaveLength(25)
    expect(undescribed).toHaveLength(53)
    // The three partitions account for every name, so none is silently uncategorized.
    expect(hybrids.length + spuhs.length + undescribed.length).toBe(rejected.length)
  })

  it('names the three hybrids a birder plausibly holds', () => {
    // These carry no " x " anywhere, so no rule reading the name can see them. A
    // birder with Brewster's Warbler had it counting as a species until this build.
    expect(rejected.filter(n => /\(hybrid\)$/.test(n)).sort()).toEqual([
      'Bogota Sunangel (hybrid)',
      "Brewster's Warbler (hybrid)",
      "Lawrence's Warbler (hybrid)",
    ])
    for (const name of ["Brewster's Warbler (hybrid)", "Lawrence's Warbler (hybrid)"]) {
      expect(isNonCountableNameShape(name)).toBe(false)  // the old rule counted it
      expect(isNonCountableForm(name)).toBe(true)        // eBird does not
    }
  })

  it('the 25 spuhs are the ones a parenthetical hid from the " sp." suffix test', () => {
    const spuhs = rejected.filter(n => !/\(hybrid\)$/.test(n) && n.includes(' sp.'))
    for (const name of spuhs) {
      expect(name.endsWith(' sp.')).toBe(false)   // which is exactly why shape missed them
    }
    expect(spuhs).toContain('Domestic goose sp. (Domestic type)')
  })
})

// ── 4. The 37-versus-36 loose end ─────────────────────────────────────────────

describe('the 37-versus-36 reconciliation', () => {
  // Two numbers in the record that look like they disagree and do not. 37 is the
  // count of published names containing " x " that eBird counts. 36 is what
  // v0.5.86's parser convergence actually rescued, into 26 parent species. This
  // pins the gap to the single name that explains it, so neither figure has to be
  // corrected and the discrepancy cannot be rediscovered as a defect.
  const withX = publishedNames.filter(n => n.includes(' x '))
  const countableWithX = withX.filter(n => eBirdCounts(nameToCode.get(n)!))
  // v0.5.86 relaxed the " x " half ONLY: a parenthetical " x " whose raw name is
  // not also a spuh or a slash.
  const rescuedByV0586 = withX.filter(
    n => !normalizeSpeciesName(n).includes(' x ') && !n.endsWith(' sp.') && !n.includes('/'),
  )

  it('reconciles to exactly one name, and names it', () => {
    expect(countableWithX).toHaveLength(37)
    expect(rescuedByV0586).toHaveLength(36)
    const gap = countableWithX.filter(n => !rescuedByV0586.includes(n))
    expect(gap).toEqual(['Common Tern (hirundo/tibetana x longipennis)'])
  })

  it('explains the gap: a slash inside the parenthetical kept it out of the 36', () => {
    const gap = 'Common Tern (hirundo/tibetana x longipennis)'
    expect(gap.includes('/')).toBe(true)              // the slash half still excluded it
    expect(isNonCountableNameShape(gap)).toBe(true)   // so v0.5.86 never rescued it
    expect(isNonCountableForm(gap)).toBe(false)       // and THIS build is what admits it
    expect(artifact.countable).toContain(gap)         // i.e. it sits inside direction A
  })

  it('keeps all 36 of the v0.5.86 intergrades countable', () => {
    // v0.5.83 warned that collapsing the raw/normalized predicate pair is a silent
    // data-loss bug. This is what discharges the warning: the names it protected
    // are still counted after the collapse, swept rather than spot-checked.
    for (const name of rescuedByV0586) expect(isNonCountableForm(name)).toBe(false)
    expect(new Set(rescuedByV0586.map(truncateAtFirstParen)).size).toBe(26)
  })
})

// ── 5. The fallback, and what real data cannot decide ─────────────────────────

describe('a name eBird does not publish falls back to the naming convention', () => {
  it('does not default to "counts"', () => {
    // Defaulting an unknown name to countable is the v0.5.87 escapee precedent and
    // it deliberately does not transfer: there an unresolved name would erase a
    // bird the birder really saw. Here it would admit every non-countable form the
    // snapshot has never heard of.
    for (const name of ['Fakebird sp.', 'Fake/Faker Bird', 'Fakebird x Otherbird']) {
      expect(nameToCode.has(name)).toBe(false)
      expect(isNonCountableForm(name)).toBe(true)
    }
  })

  it('still counts a since-renamed species, which is what the fallback is for', () => {
    // "Cattle Egret" became "Western Cattle-Egret"; an older export still carries
    // the old name and the bird still counts.
    expect(nameToCode.has('Cattle Egret')).toBe(false)
    expect(isNonCountableForm('Cattle Egret')).toBe(false)
  })

  it('behaves EXACTLY as the pre-change rule did for every unpublished name', () => {
    // The bounded-delta promise: this build changes nothing outside the 17,891
    // names eBird publishes. `isNonCountableNameShape` is byte-identical to the
    // predicate that shipped before it, so agreement here is that promise.
    for (const name of ['Fakebird sp.', 'Cattle Egret', "Fake Warbler (Myrtle x Audubon's)"]) {
      expect(isNonCountableForm(name)).toBe(isNonCountableNameShape(name))
    }
  })
})

describe('the question real data structurally cannot answer (the probe set)', () => {
  // Every eBird name is well formed: at most one "(", always closed, always
  // trailing. So a sweep over the snapshot cannot distinguish the fallback's
  // normalization choice at all, and a snapshot-only guard would pass a wrong
  // implementation. This is the v0.5.84 rule, and BOTH numbers are asserted so the
  // suite states in its own body why it is shaped this way.
  //
  // THE COMPETING WRONG IMPLEMENTATION, named so the claim is falsifiable: a
  // fallback that tests " x " on `truncateAtFirstParen` (cuts at the FIRST "(",
  // closed or not) instead of `normalizeSpeciesName` (strips a TRAILING
  // parenthetical). The two are the repo's documented near-miss pair.
  const wrongShapeRule = (name: string): boolean =>
    name.endsWith(' sp.') || name.includes('/') || truncateAtFirstParen(name).includes(' x ')

  // Characters the function actually branches on. "s"/"p"/"." reach the " sp."
  // suffix test, "/" the slash test, "x" and " " the hybrid test, and the parens
  // are what separate the two normalizations.
  //
  // Enumerated to length 5 rather than 4, and that is measured rather than
  // stylistic: at length 4 all 13 divergences run the SAME way (the truncating
  // variant over-reports), because the only mechanism reachable is `trim()`
  // removing a boundary space of " x ". Length 5 is where the second mechanism
  // appears, an unclosed "(" that the truncating variant cuts at and the real rule
  // keeps, and it diverges the OTHER way. A probe set that exercised one direction
  // would have looked thorough while testing half the difference.
  const ALPHABET = [' ', '(', ')', 'x', '/', '.', 's', 'p']
  const probes: string[] = []
  let frontier = ['']
  for (let len = 1; len <= 5; len += 1) {
    const next: string[] = []
    for (const prefix of frontier) for (const ch of ALPHABET) next.push(prefix + ch)
    probes.push(...next)
    frontier = next
  }

  it('scores ZERO divergences across every real published name', () => {
    const divergences = publishedNames.filter(n => isNonCountableNameShape(n) !== wrongShapeRule(n))
    expect(divergences).toEqual([])
    expect(publishedNames).toHaveLength(17_891)
  })

  it('and the probes DO discriminate, so the guard above is not the whole story', () => {
    // Without this second number the first one reads as evidence the two
    // implementations are equivalent. They are not; real names simply cannot tell.
    expect(probes).toHaveLength(37_448)
    const divergences = probes.filter(s => isNonCountableNameShape(s) !== wrongShapeRule(s))
    expect(divergences).toHaveLength(105)

    // Both mechanisms, asserted separately so a change that silenced one of them
    // could not hide behind the other's count.
    //
    // 1. `trim()`: the real rule strips the boundary space off " x ", the
    //    truncating variant (which returns the name untouched when there is no
    //    "(") keeps it and over-reports.
    const truncateOverReports = divergences.filter(s => wrongShapeRule(s))
    expect(truncateOverReports).toHaveLength(95)
    expect(isNonCountableNameShape(' x ')).toBe(false)
    expect(wrongShapeRule(' x ')).toBe(true)

    // 2. The cut point: an UNCLOSED "(" is not a trailing parenthetical, so the
    //    real rule keeps the whole string while the truncating variant cuts at it
    //    and throws the " x " away, under-reporting.
    const truncateUnderReports = divergences.filter(s => !wrongShapeRule(s))
    expect(truncateUnderReports).toHaveLength(10)
    expect(isNonCountableNameShape('( x (')).toBe(true)
    expect(wrongShapeRule('( x (')).toBe(false)
  })

  it('the probe alphabet really contains the characters the rule branches on', () => {
    // Non-vacuity for the probe set itself: an alphabet that quietly lost a member
    // would shrink the divergence count and still pass a hand-written figure.
    expect(ALPHABET).toEqual([' ', '(', ')', 'x', '/', '.', 's', 'p'])
    expect(probes).toContain(' sp.')
    expect(probes).toContain(' x ')
    expect(probes).toContain('/')
  })
})
