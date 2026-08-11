// Guard for the memo bound in improve: species-name-normalizer-consolidation.
//
// `normalizeSpeciesName` memoizes because it runs ~12x per observation across the stats
// passes. That memo was keyed by the raw name, uncapped, and never cleared. The roadmap
// called it "bounded in practice because `Map.set` stores a reference to a string the
// parsed-observation array already holds" - true only while that array is alive, and it
// is not alive after the user loads a second file. Measured with every other reference
// dropped: 26.5 MB retained across ten successive loads of 20k disjoint names, 200,000
// entries, none released.
//
// Everything here drives the REAL exported function. The Map is reached through a
// test-only accessor rather than reimplemented, because a bound asserted against a copy
// of the cache is not a bound on the shipped one.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizeSpeciesName,
  __normCacheForTests,
  __resetNormCacheForTests,
  __longCacheForTests,
  __MEMO_LIMITS_FOR_TESTS as LIMITS,
} from './speciesUtils'

// The pre-change implementation, as the oracle for every correctness claim below.
const oracleNormalize = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim()

/** A distinct well-formed name of exactly `len` characters. */
function nameOfLength(i: number, len: number): string {
  const tag = `q${i}q`
  return (tag + 'x'.repeat(Math.max(0, len - tag.length))).slice(0, len)
}

beforeEach(() => {
  __resetNormCacheForTests()
})

describe('the memo limits are sized off measurement, not guessed', () => {
  it('admits every real name with room to spare', () => {
    // The longest string of ANY category in the bundled taxonomy snapshot is 63
    // characters ("American Herring/Vega/European Herring x Glaucous Gull (hybrid)"),
    // p99 47, p50 21. The key limit is a multiple of that measured maximum rather than
    // the maximum itself, so a taxonomy revision that lengthens names cannot quietly
    // push a real species onto the uncached path.
    expect(LIMITS.maxKeyLength).toBe(128)
    expect(LIMITS.maxKeyLength / 63).toBeGreaterThanOrEqual(2)

    // The snapshot holds 17,891 distinct names across all categories, so the entry
    // limit clears the entire eBird taxonomy: a user who had recorded every taxon on
    // earth would still evict nothing.
    expect(LIMITS.maxEntries).toBe(32768)
    expect(LIMITS.maxEntries / 17891).toBeGreaterThanOrEqual(1.8)
  })

  it('bounds retention structurally, all four facts at once', () => {
    // THE GUARANTEE IS STRUCTURAL, not a byte figure. An earlier version of this test
    // asserted `32,768 x 172 B < 6 MiB` from a heap measurement taken on one machine -
    // and it was wrong in the direction that matters: independent measurement put the
    // worst case at 208 B/entry (6.49 MiB), so the assertion stated a ceiling the true
    // worst case exceeds while passing anyway. A byte-per-entry constant encodes one
    // engine's heap accounting and drifts with the runtime, the string representation and
    // the allocator, so it can go false without ever failing. What genuinely bounds
    // retention is the four limits below, and they are exact.
    //
    // Drive a mixed hostile load - far too many distinct names, most of them far too
    // long, some repeated - then assert all four together, because it is their
    // conjunction that is the bound.
    for (let i = 0; i < LIMITS.maxEntries + 3000; i++) {
      normalizeSpeciesName(`Gull ${i} (Domestic type)`)
      if (i % 10 === 0) normalizeSpeciesName(nameOfLength(i, 2000) + ' (x)')
      if (i % 100 === 0) normalizeSpeciesName('Mallard (Domestic type)')
    }

    // 1. the Map holds at most `maxEntries` entries ...
    expect(__normCacheForTests().size).toBeLessThanOrEqual(LIMITS.maxEntries)
    // 2. ... none of whose keys exceeds `maxKeyLength` ...
    const keys = [...__normCacheForTests().keys()]
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThanOrEqual(LIMITS.maxKeyLength)
    // 3. ... no key in it exceeds the length limit at all ...
    expect(keys.filter((k) => k.length > LIMITS.maxKeyLength)).toEqual([])
    // 4. ... and the over-length names that just went through are held in the separate
    // budgeted cache, within its budget, rather than accumulating anywhere.
    expect(__longCacheForTests().chars).toBeLessThanOrEqual(LIMITS.longCharBudget)
    expect(__longCacheForTests().entries).toBeGreaterThan(0)
  })
})

describe('the memo cannot grow without bound', () => {
  it('never exceeds the entry limit, however many distinct names arrive', () => {
    const overflow = LIMITS.maxEntries + 5000
    for (let i = 0; i < overflow; i++) normalizeSpeciesName(`Gull ${i} (Domestic type)`)
    expect(__normCacheForTests().size).toBe(LIMITS.maxEntries)
  })

  it('never stores a key past the key limit', () => {
    // Hostile input: many distinct names far longer than any real one. Before the bound
    // these were the expensive entries (2,093 B each at 2,000 characters).
    for (let i = 0; i < 200; i++) normalizeSpeciesName(nameOfLength(i, 2000) + ' (x)')
    expect(__normCacheForTests().size).toBe(0)

    // And a mixed load leaves only the short ones behind.
    for (let i = 0; i < 50; i++) {
      normalizeSpeciesName(nameOfLength(i, 2000) + ' (x)')
      normalizeSpeciesName(`Gull ${i} (Domestic type)`)
    }
    const keys = [...__normCacheForTests().keys()]
    expect(keys).toHaveLength(50)
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThanOrEqual(LIMITS.maxKeyLength)
  })

  it('holds a name exactly at the limit and skips the one character past it', () => {
    // Off-by-one at the boundary, in both directions.
    normalizeSpeciesName(nameOfLength(1, LIMITS.maxKeyLength))
    expect(__normCacheForTests().size).toBe(1)
    normalizeSpeciesName(nameOfLength(2, LIMITS.maxKeyLength + 1))
    expect(__normCacheForTests().size).toBe(1)
  })
})

describe('bounding the memo does not change a single answer', () => {
  it('agrees with the oracle on names the cache declined to admit', () => {
    // Overflow the cache, then re-ask for names offered after it filled. A pure function
    // memoized is still that function; this is the test that says so once admission has
    // actually started refusing.
    const early: string[] = []
    for (let i = 0; i < 100; i++) early.push(`Gull ${i} (Domestic type)`)
    for (const n of early) normalizeSpeciesName(n)

    for (let i = 0; i < LIMITS.maxEntries + 200; i++) {
      normalizeSpeciesName(`Filler ${i} (Domestic type)`)
    }
    // The early keys were admitted first, so under admission control they survive; the
    // filler names offered after the cache filled were declined.
    for (const n of early) expect(__normCacheForTests().has(n)).toBe(true)
    const declined = `Filler ${LIMITS.maxEntries + 199} (Domestic type)`
    expect(__normCacheForTests().has(declined)).toBe(false)
    // Every one of them still normalizes identically, admitted or not.
    for (const n of early) expect(normalizeSpeciesName(n)).toBe(oracleNormalize(n))
    expect(normalizeSpeciesName(declined)).toBe(oracleNormalize(declined))
  })

  it('agrees with the oracle on names too long to cache at all', () => {
    const long = [
      nameOfLength(1, 200) + ' (Domestic type)',
      nameOfLength(2, 2000) + ' (a) (b)',
      nameOfLength(3, 500) + ' (unclosed',
      ' '.repeat(200) + 'Gull (x) ',
      '('.repeat(300),
    ]
    for (const n of long) {
      expect(normalizeSpeciesName(n)).toBe(oracleNormalize(n))
      // Repeating it must not change the answer either: the over-length path caches, and
      // a cache that returned a stale value would show up here.
      expect(normalizeSpeciesName(n)).toBe(oracleNormalize(n))
    }
    expect(__normCacheForTests().size).toBe(0)
  })

  it('keeps the over-length cache honest when names alternate', () => {
    // Two distinct over-length names in a loop. This is the workload that defeated the
    // original single slot outright, and the shape where a cache that stored a key
    // against the wrong value returns the wrong name.
    const a = nameOfLength(1, 300) + ' (alpha)'
    const b = nameOfLength(2, 300) + ' (beta)'
    for (let i = 0; i < 20; i++) {
      expect(normalizeSpeciesName(a)).toBe(oracleNormalize(a))
      expect(normalizeSpeciesName(b)).toBe(oracleNormalize(b))
    }
  })
})

describe('the over-length cache is budgeted, and survives capacity PLUS ONE', () => {
  // This block exists because the first implementation of this path was a single slot,
  // and a single slot is a one-entry cache. It was measured on ONE repeated name - i.e.
  // at its own capacity, where it never evicts and every call is a hit - and it collapsed
  // on two: 3,493.7 ms against 1.5 ms, which is 1.048x the skip-only implementation the
  // slot was written to avoid and a 1,457x regression against the uncapped Map.
  //
  // THE RULE, and the reason these tests are shaped this way: a fixed-size cache's
  // performance claim must be measured at CAPACITY PLUS ONE. Every workload below that
  // matters is therefore expressed relative to the budget, not as a round number.

  /** Distinct, well-formed, over-length names of `len` characters. */
  function longNames(count: number, len: number, salt = 0): string[] {
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      const tag = `q${salt}_${i}q`
      out.push(tag + 'w'.repeat(Math.max(0, len - tag.length - 16)) + ' (Domestic type)')
    }
    return out
  }

  it('admits nothing until an over-length name arrives', () => {
    expect(__longCacheForTests().entries).toBe(0)
    normalizeSpeciesName('Mallard (Domestic type)')
    expect(__longCacheForTests().entries).toBe(0)
    expect(__longCacheForTests().chars).toBe(0)
  })

  it('never retains more than the character budget', () => {
    // Far past capacity: 2,000 distinct 40,000-character names is ~80 million characters
    // offered against a 1,048,576 budget.
    for (const n of longNames(2000, 40000)) normalizeSpeciesName(n)
    const c = __longCacheForTests()
    expect(c.chars).toBeLessThanOrEqual(LIMITS.longCharBudget)
    // Non-vacuous: it did fill, rather than admitting nothing at all.
    expect(c.entries).toBeGreaterThan(20)
    expect(c.chars).toBeGreaterThan(LIMITS.longCharBudget * 0.9)
    // The over-length path never touches the main Map.
    expect(__normCacheForTests().size).toBe(0)
  })

  it('still serves a single name larger than the whole budget', () => {
    // Admitted into an empty cache on purpose: otherwise one huge repeated value would
    // recompute forever, which is the exact defect this path exists to prevent. This is
    // the one case where retention is "one name" rather than "the budget".
    const huge = longNames(1, LIMITS.longCharBudget * 3)[0]
    for (let i = 0; i < 200; i++) expect(normalizeSpeciesName(huge)).toBe(oracleNormalize(huge))
    const c = __longCacheForTests()
    expect(c.entries).toBe(1)
    expect(c.chars).toBeGreaterThan(LIMITS.longCharBudget)
  })

  it('charges the character budget once per admitted name, not once per call', () => {
    // The accounting variable gets its own assertion, separate from the cache's contents,
    // because it can go wrong while the contents stay perfectly correct.
    //
    // The failure this rejects: with a truthiness hit test, an over-length name that
    // normalizes to `''` misses its own cache entry on every call, falls through, and
    // re-charges `_longChars` each time. Nothing about the returned value or the entry
    // count changes, so every other assertion in this file stays green - until the total
    // creeps past the budget, at which point ADMISSION CLOSES PERMANENTLY and the cache is
    // silently disabled for the rest of the session. Pinning the counter turns a mysterious
    // late admission failure into an immediate, local one.
    const name = `(${'a'.repeat(200)})`
    expect(name.length).toBeGreaterThan(LIMITS.maxKeyLength)
    expect(normalizeSpeciesName(name)).toBe('') // over-length AND falsy: both paths at once

    expect(__longCacheForTests().entries).toBe(1)
    expect(__longCacheForTests().chars).toBe(name.length)

    for (let i = 0; i < 50; i++) expect(normalizeSpeciesName(name)).toBe('')
    // Exactly once, not 51 times.
    expect(__longCacheForTests().entries).toBe(1)
    expect(__longCacheForTests().chars).toBe(name.length)

    // And the consequence the counter protects: admission is still open afterwards.
    const other = `${'b'.repeat(200)} (x)`
    normalizeSpeciesName(other)
    expect(__longCacheForTests().entries).toBe(2)
    expect(__longCacheForTests().chars).toBe(name.length + other.length)
  })

  it('answers identically whether a name was admitted or not', () => {
    // Correctness must not depend on admission. Fill past the budget, then check names
    // from both sides of the line against the oracle.
    const admitted = longNames(4, 40000, 1)
    for (const n of admitted) normalizeSpeciesName(n)
    const rejected = longNames(200, 40000, 2)
    for (const n of rejected) normalizeSpeciesName(n)
    expect(__longCacheForTests().chars).toBeLessThanOrEqual(LIMITS.longCharBudget)
    for (const n of [...admitted, ...rejected]) {
      expect(normalizeSpeciesName(n)).toBe(oracleNormalize(n))
    }
  })

  // The timing guard. Unlike the LRU and thrashing questions on the main Map - where the
  // gaps were 3.54x and 9.77x, too narrow for a wall clock - the gap here is ~900x, which
  // is margin a shared runner cannot close from either side. A distinct input per run, so
  // no run can be measuring a cache hit left by the previous one.
  const ALTERNATING_CEILING_MS = 300
  const TIMED_CALLS = 240_000

  function fastestRotating(distinct: number, len: number): number {
    let best = Infinity
    for (let run = 0; run < 3; run++) {
      __resetNormCacheForTests()
      const names = longNames(distinct, len, 1000 + run)
      let sink = 0
      const t0 = performance.now()
      for (let i = 0; i < TIMED_CALLS; i++) sink += normalizeSpeciesName(names[i % distinct]).length
      const elapsed = performance.now() - t0
      if (sink < 0) throw new Error('unreachable')
      if (elapsed < best) best = elapsed
    }
    return best
  }

  it('does not collapse on TWO alternating over-length names (slot: 3,493 ms)', () => {
    // The exact workload that failed review. Two keys defeat a one-entry cache totally.
    expect(fastestRotating(2, 40000)).toBeLessThan(ALTERNATING_CEILING_MS)
  })

  it('does not collapse at the minimum over-threshold length either', () => {
    // 129 characters is the smallest name that reaches this path, and the point it makes
    // is that the defect was never confined to absurd lengths: the single slot cost 27.3
    // ms even here.
    //
    // ITS DISCRIMINATION AGAINST THE SINGLE SLOT USED TO BE ABSENT, and the note saying so
    // also carried a false justification - it claimed the test "was verified to go red on
    // M12". It was not. M12 mutates `truncateAtFirstParen`, which this test never calls,
    // and re-running the whole matrix against it found the test stayed GREEN under every
    // single mutation. It was decoration, kept by an unverified sentence.
    //
    // It is now a ratio against the slot design itself, which is what gives it teeth at
    // the length it names. Measured, min of each side over 3 interleaved rounds: shipped
    // 0.67 ms, slot 7.56 ms - 11.2x against a threshold of 3, and the spread only widens
    // with length (18.9x at 256 characters, 46.1x at 1,000).
    //
    // Verified rather than assumed this time: re-running the matrix against this test
    // alone, it now goes RED on M7 (long cache removed), M8 (single slot restored) and
    // M8e (budget shrunk below two names), and stays green on the mutations that do not
    // touch the over-length path. That list is what the previous note should have carried.
    const MIN_LENGTH_RATIO = 3
    const len = LIMITS.maxKeyLength + 1

    /** The one-entry slot that failed round 1 of security review. */
    function makeSlot(): (n: string) => string {
      let key: string | null = null
      let val = ''
      return (n: string) => {
        if (n.length <= LIMITS.maxKeyLength) return oracleNormalize(n)
        if (n === key) return val
        const v = oracleNormalize(n)
        key = n
        val = v
        return v
      }
    }

    const CALLS = 60_000
    let bestShipped = Infinity
    let bestSlot = Infinity
    for (let run = 0; run < 3; run++) {
      const ns = longNames(2, len, 5000 + run)
      const time = (fn: (n: string) => string, reset: boolean): number => {
        if (reset) __resetNormCacheForTests()
        let sink = 0
        const t0 = performance.now()
        for (let i = 0; i < CALLS; i++) sink += fn(ns[i % 2]).length
        const e = performance.now() - t0
        if (sink < 0) throw new Error('unreachable')
        return e
      }
      if (run % 2 === 0) {
        bestShipped = Math.min(bestShipped, time(normalizeSpeciesName, true))
        bestSlot = Math.min(bestSlot, time(makeSlot(), false))
      } else {
        bestSlot = Math.min(bestSlot, time(makeSlot(), false))
        bestShipped = Math.min(bestShipped, time(normalizeSpeciesName, true))
      }
    }
    expect(bestSlot / bestShipped).toBeGreaterThan(MIN_LENGTH_RATIO)
  })

  // An evicting cache is the design this one was chosen over, so the guard measures the
  // two against each other rather than against a wall clock. A RATIO is the right shape
  // here: it is scale-invariant, so a slow or contended runner slows both sides together
  // and cannot move it, where an absolute ceiling has to sit inside the gap and gets
  // squeezed from both ends. The previous version of this test sat 7x under its ceiling,
  // which is inside the range CLAUDE.md calls no margin at all.
  //
  // Workload: capacity+1 at the MINIMUM over-threshold length, which is both the cheapest
  // input for a malformed file to contain and the widest, steadiest spread of the three
  // capacity+1 cases measured (the 40,000-character case is 26-33x and takes 5 s a round;
  // the 2,000-character case is ~10x).
  //
  // Measured, min of each side over 3 interleaved rounds: admission 10.6 ms, evicting
  // 798.5 ms - a 75x spread, with the worst single round still 49x. The threshold is 5x,
  // so the guard sits ~15x clear of anything a shared runner can do to it, and the
  // rejected design is 15x the wrong side of it.
  const CLIFF_RATIO_MIN = 5

  /** The evicting design this one replaced, as the differential comparator. */
  function makeEvictingCache(): (n: string) => string {
    const c = new Map<string, string>()
    let chars = 0
    return (n: string) => {
      if (n.length <= LIMITS.maxKeyLength) return oracleNormalize(n)
      const hit = c.get(n)
      if (hit !== undefined) return hit
      const v = oracleNormalize(n)
      c.set(n, v)
      chars += n.length
      while (chars > LIMITS.longCharBudget && c.size > 1) {
        const oldest = c.keys().next().value as string | undefined
        if (oldest === undefined) break
        c.delete(oldest)
        chars -= oldest.length
      }
      return v
    }
  }

  it('degrades gracefully at CAPACITY PLUS ONE, where an evicting cache falls off a cliff', () => {
    const len = LIMITS.maxKeyLength + 1
    const overCapacity = Math.floor(LIMITS.longCharBudget / len) + 1
    expect(overCapacity).toBe(8129)
    // One clear of capacity is enough to expose the cliff; a little past it keeps the
    // fixture honest about being a working set the cache cannot hold.
    const distinct = overCapacity + 71

    let bestShipped = Infinity
    let bestEvicting = Infinity
    for (let run = 0; run < 3; run++) {
      const ns = longNames(distinct, len, 2000 + run)
      const timeShipped = (): number => {
        __resetNormCacheForTests()
        let sink = 0
        const t0 = performance.now()
        for (let i = 0; i < TIMED_CALLS; i++) sink += normalizeSpeciesName(ns[i % distinct]).length
        const e = performance.now() - t0
        if (sink < 0) throw new Error('unreachable')
        return e
      }
      const timeEvicting = (): number => {
        const fn = makeEvictingCache()
        let sink = 0
        const t0 = performance.now()
        for (let i = 0; i < TIMED_CALLS; i++) sink += fn(ns[i % distinct]).length
        const e = performance.now() - t0
        if (sink < 0) throw new Error('unreachable')
        return e
      }
      // Alternate which side runs first, so neither is systematically warmed by the other.
      const [a, b] = run % 2 === 0 ? [timeShipped(), timeEvicting()] : [timeEvicting(), timeShipped()]
      const [shipped, evicting] = run % 2 === 0 ? [a, b] : [b, a]
      if (shipped < bestShipped) bestShipped = shipped
      if (evicting < bestEvicting) bestEvicting = evicting
    }

    expect(bestEvicting / bestShipped).toBeGreaterThan(CLIFF_RATIO_MIN)
  }, 120_000)
})

describe('the short cache admits rather than evicts, and the hit path stays empty', () => {
  // This block used to pin FIFO EVICTION on the short cache, and pinning it is how the
  // design survived to a second security review. Past 32,768 distinct names a FIFO misses,
  // deletes and inserts on every call: 2,544.9 ms at capacity+1 against 15.2 ms for no
  // cache at all, on ordinary 24-character names. The rule that catches this was written
  // into `speciesUtils.ts` during the previous round and then applied to the over-length
  // cache only, fifteen lines above the code that violated it.
  //
  // The short cache now uses the same admission control. These tests assert THAT, so the
  // eviction design cannot come back by looking like the thing the suite expects.
  it('stops admitting at the limit instead of evicting the oldest', () => {
    const first = 'Gull 0 (Domestic type)'
    for (let i = 0; i < LIMITS.maxEntries; i++) normalizeSpeciesName(`Gull ${i} (Domestic type)`)
    expect(__normCacheForTests().size).toBe(LIMITS.maxEntries)

    // One more distinct name. Under FIFO this evicts the oldest; under admission control
    // nothing moves and the newcomer simply is not cached.
    normalizeSpeciesName('Gull NEW (Domestic type)')
    expect(__normCacheForTests().size).toBe(LIMITS.maxEntries)
    expect(__normCacheForTests().has(first)).toBe(true)
    expect(__normCacheForTests().has('Gull NEW (Domestic type)')).toBe(false)
    // The whole original set is intact, so nothing was displaced.
    expect([...__normCacheForTests().keys()][0]).toBe(first)
  })

  it('answers correctly for a name it declined to admit', () => {
    // Correctness must not depend on admission - the same property the over-length cache
    // carries. An unadmitted name recomputes, and recomputing is the whole contract.
    for (let i = 0; i < LIMITS.maxEntries; i++) normalizeSpeciesName(`Gull ${i} (Domestic type)`)
    for (const n of [
      'Unadmitted Warbler (Myrtle)',
      '  Unadmitted Gull (Domestic type)  ',
      'Unadmitted (a) (b)',
      'Unadmitted (',
    ]) {
      expect(__normCacheForTests().has(n)).toBe(false)
      expect(normalizeSpeciesName(n)).toBe(oracleNormalize(n))
      // Still declined, and still correct on a repeat.
      expect(__normCacheForTests().has(n)).toBe(false)
      expect(normalizeSpeciesName(n)).toBe(oracleNormalize(n))
    }
    expect(__normCacheForTests().size).toBe(LIMITS.maxEntries)
  })

  it('serves a FALSY cached value from the cache instead of recomputing', () => {
    // Both caches test their hit with `!== undefined` rather than truthiness, and that is
    // load-bearing rather than stylistic: a cached value of `''` is trivially reachable.
    // `normalizeSpeciesName('(abc)')` is `''` from a five-character name.
    expect(normalizeSpeciesName('(abc)')).toBe('')
    expect(__normCacheForTests().get('(abc)')).toBe('')

    // Reachability alone does not discriminate: a truthiness test recomputes the same
    // pure answer, so it is invisible to any assertion on the value. To make "served from
    // cache" observable WITHOUT a wall clock, seed the cache with a value a recompute
    // could not produce, then require that value back. Under `if (hit)` the `''` is falsy,
    // the hit is missed, and the recompute returns 'Sentinel Gull' instead.
    //
    // The cast is deliberate. The accessor returns a ReadonlyMap so app code cannot hold a
    // mutable handle; seeding the cache to probe its hit path is the one sanctioned
    // exception, and it is confined to this test.
    ;(__normCacheForTests() as Map<string, string>).set('Sentinel Gull', '')
    expect(normalizeSpeciesName('Sentinel Gull')).toBe('')
  })

  it('does not reorder the cache on a hit', () => {
    // True LRU would need a delete+set on every hit, measured 3.54x slower on the
    // realistic hot path for a policy no workload here benefits from. Structural rather
    // than timed: that gap is far too narrow for a wall clock, and order is exact.
    for (let i = 0; i < 5; i++) normalizeSpeciesName(`Gull ${i} (Domestic type)`)
    const before = [...__normCacheForTests().keys()]
    for (let i = 4; i >= 0; i--) normalizeSpeciesName(`Gull ${i} (Domestic type)`)
    expect([...__normCacheForTests().keys()]).toEqual(before)
  })
})

describe('the guards above are not vacuous', () => {
  // Each bound test would pass against a cache that simply never stored anything, and the
  // eviction tests would pass against one that never evicted. Prove the memo does its job
  // in the ordinary case.
  it('caches an ordinary name and reuses it', () => {
    expect(__normCacheForTests().size).toBe(0)
    normalizeSpeciesName('Mallard (Domestic type)')
    expect(__normCacheForTests().size).toBe(1)
    expect(__normCacheForTests().get('Mallard (Domestic type)')).toBe('Mallard')
    normalizeSpeciesName('Mallard (Domestic type)')
    expect(__normCacheForTests().size).toBe(1)
  })

  it('holds a realistic working set with room to spare', () => {
    // The sizing claim, exercised rather than asserted: the entire bundled taxonomy fits
    // with room left, so no real dataset reaches the limit.
    //
    // THIS TEST USED TO BE THE WHOLE PERFORMANCE STORY FOR THE SHORT CACHE, and it is
    // explicitly a BELOW-capacity test (`distinct < maxEntries`). That is the gap that let
    // a capacity+1 cliff ship: the suite pinned the design without ever measuring the
    // state in which the design fails. It is kept for the sizing claim it does make; the
    // state it cannot reach is covered by `every bounded structure survives CAPACITY PLUS
    // ONE` below.
    const distinct = 17891
    for (let i = 0; i < distinct; i++) normalizeSpeciesName(`Gull ${i} (Domestic type)`)
    expect(__normCacheForTests().size).toBe(distinct)
    expect(distinct).toBeLessThan(LIMITS.maxEntries)
    expect(__normCacheForTests().has('Gull 0 (Domestic type)')).toBe(true)
  })
})

describe('every bounded structure survives CAPACITY PLUS ONE', () => {
  // The module has exactly TWO bounded structures, and this block covers both. That count
  // is the point: the capacity+1 rule was discovered on one of them, written into the
  // source, and then applied to only that one - so the sweep, and a guard per structure,
  // is what makes the rule true of the module rather than of one branch.
  //
  //   1. `_normCache`  - entry-capped at MEMO_MAX_ENTRIES, ordinary-length names.
  //   2. `_longCache`  - character-budgeted at MEMO_LONG_CHAR_BUDGET, over-length names.
  //
  // Both are asserted here as RATIOS against the evicting design each replaced, because a
  // ratio is scale-invariant: a contended runner slows both sides together and cannot move
  // it, where an absolute ceiling has to sit inside the gap and gets squeezed from both
  // ends. Adding a third bounded structure to this module means adding a third case here.

  const CLIFF_RATIO_MIN = 5
  // A ratio is scale-invariant in call count, so the fixture is sized for suite runtime
  // rather than for a headline figure: 60,000 calls reproduce the same spread as the
  // 240,000 used when measuring, at a quarter of the cost. The evicting comparator is what
  // is slow here (it is the defect), which is also why each test carries its own timeout.
  const TIMED_CALLS = 60_000
  const RATIO_TEST_TIMEOUT_MS = 120_000

  function names(count: number, len: number, salt: number): string[] {
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      const tag = `q${salt}_${i}`
      out.push((tag + 'w'.repeat(Math.max(1, len - tag.length - 4)) + ' (x)').slice(0, len))
    }
    return out
  }

  /** The FIFO-evicting short cache, as the differential comparator. */
  function makeEvictingShortCache(): (n: string) => string {
    const c = new Map<string, string>()
    return (n: string) => {
      if (n.length > LIMITS.maxKeyLength) return oracleNormalize(n)
      const hit = c.get(n)
      if (hit !== undefined) return hit
      const v = oracleNormalize(n)
      if (c.size >= LIMITS.maxEntries) {
        const oldest = c.keys().next().value as string | undefined
        if (oldest !== undefined) c.delete(oldest)
      }
      c.set(n, v)
      return v
    }
  }

  function ratioAgainstEviction(
    distinct: number,
    len: number,
    makeEvicting: () => (n: string) => string,
  ): number {
    let bestShipped = Infinity
    let bestEvicting = Infinity
    for (let run = 0; run < 3; run++) {
      const ns = names(distinct, len, 3000 + run)
      const shipped = (): number => {
        __resetNormCacheForTests()
        let sink = 0
        const t0 = performance.now()
        for (let i = 0; i < TIMED_CALLS; i++) sink += normalizeSpeciesName(ns[i % distinct]).length
        const e = performance.now() - t0
        if (sink < 0) throw new Error('unreachable')
        return e
      }
      const evicting = (): number => {
        const fn = makeEvicting()
        let sink = 0
        const t0 = performance.now()
        for (let i = 0; i < TIMED_CALLS; i++) sink += fn(ns[i % distinct]).length
        const e = performance.now() - t0
        if (sink < 0) throw new Error('unreachable')
        return e
      }
      // Alternate which side runs first, so neither is systematically warmed by the other.
      if (run % 2 === 0) {
        bestShipped = Math.min(bestShipped, shipped())
        bestEvicting = Math.min(bestEvicting, evicting())
      } else {
        bestEvicting = Math.min(bestEvicting, evicting())
        bestShipped = Math.min(bestShipped, shipped())
      }
    }
    return bestEvicting / bestShipped
  }

  it('structure 1: the entry-capped short cache, at capacity+1', () => {
    // 24 characters is a realistic name length (snapshot mean is 22.9), and one name past
    // the cap is all it takes. Measured: shipped 16.4 ms, evicting 2,544.9 ms - a 155x
    // spread against a threshold of 5, so the guard sits ~31x clear of anything a shared
    // runner can do to it.
    expect(ratioAgainstEviction(LIMITS.maxEntries + 1, 24, makeEvictingShortCache)).toBeGreaterThan(
      CLIFF_RATIO_MIN,
    )
  }, RATIO_TEST_TIMEOUT_MS)

  it('structure 1 again: and it is not merely relocated further out', () => {
    // A cliff that reappears at 2x capacity would be the same defect one step away.
    // Measured: shipped 22.3 ms, evicting 2,601.8 ms.
    expect(ratioAgainstEviction(LIMITS.maxEntries * 2, 24, makeEvictingShortCache)).toBeGreaterThan(
      CLIFF_RATIO_MIN,
    )
  }, RATIO_TEST_TIMEOUT_MS)

  it('neither structure is ever much worse than having no cache at all', () => {
    // The property that actually matters to a user: a bounded cache past its bound must
    // degrade toward the un-memoized baseline, never past it. The FIFO short cache was
    // 167x WORSE than no cache; the single slot was 1.048x the no-cache cost on the long
    // path. Measured now: short cache 1.08x at capacity+1 and 1.60x at twice capacity (a
    // failed Map lookup per miss, a small constant rather than a cliff), long cache 0.98x.
    //
    // FIXTURE SIZING MATTERS HERE in a way it does not for the ratios above. This ratio
    // depends on REUSE: with fewer calls than distinct names every call is a first sight,
    // the memo can only cost and never help, and the figure climbs to 4.75x. That regime
    // cannot occur in the app - the stats passes normalize ~12x per observation and there
    // can be no more distinct names than observations, so calls per distinct name is at
    // least 12. This fixture uses 240,000 calls, i.e. 3.7 per name at twice capacity,
    // which is still conservative against the real 12 and does not flatter the memo.
    const noCache = (n: string): string => oracleNormalize(n)
    const REUSE_CALLS = 240_000
    function ratioAgainstNoCache(distinct: number, len: number): number {
      let bestShipped = Infinity
      let bestNone = Infinity
      for (let run = 0; run < 3; run++) {
        const ns = names(distinct, len, 4000 + run)
        const time = (fn: (n: string) => string, reset: boolean): number => {
          if (reset) __resetNormCacheForTests()
          let sink = 0
          const t0 = performance.now()
          for (let i = 0; i < REUSE_CALLS; i++) sink += fn(ns[i % distinct]).length
          const e = performance.now() - t0
          if (sink < 0) throw new Error('unreachable')
          return e
        }
        if (run % 2 === 0) {
          bestShipped = Math.min(bestShipped, time(normalizeSpeciesName, true))
          bestNone = Math.min(bestNone, time(noCache, false))
        } else {
          bestNone = Math.min(bestNone, time(noCache, false))
          bestShipped = Math.min(bestShipped, time(normalizeSpeciesName, true))
        }
      }
      return bestShipped / bestNone
    }
    // Generous ceilings: the claim is "a small constant", not a tuned number, and the
    // defects this rejects were 167x and 1.048x-plus-a-cliff.
    expect(ratioAgainstNoCache(LIMITS.maxEntries * 2, 24)).toBeLessThan(4)
    const longCapacity = Math.floor(LIMITS.longCharBudget / (LIMITS.maxKeyLength + 1))
    expect(ratioAgainstNoCache(longCapacity * 2, LIMITS.maxKeyLength + 1)).toBeLessThan(4)
  }, RATIO_TEST_TIMEOUT_MS)
})
