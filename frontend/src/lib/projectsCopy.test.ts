// The Projects copy table (county-shading-and-project-stats, FR-49, FR-50,
// FR-61; QA-52, QA-53, QA-77).
//
// THE ELEVEN STATES ARE NOT ELEVEN HAND-WRITTEN STRINGS: one pure tally clause
// plus one clause per state, so the denominator is carried by the FUNCTION
// rather than by discipline. These tests assert that property directly, which is
// what makes "a tally without its context is not expressible" a fact about the
// code rather than a habit.
import { describe, it, expect } from 'vitest'
import {
  checkedClause, tally, estimateMinutes, estimateClause, noneCheckedClause,
  projectsCopy, skippedNote, shareClause,
  UNNAMED_PROJECT_NOTE, PORTALS_NOTE, PROJECTS_SUBLABEL, PORTALS_SUBLABEL,
  PROJECTS_CHART_CAPTION, PORTALS_CHART_CAPTION,
} from './projectsCopy'
import {
  SPECIES_SHADING_HINT, STATS_SHADING_HINT, STATS_EMPTY_NOTE,
  speciesEmptyNote, speciesLegendTitle,
} from './countyShadingUi'
import { TEXTURES_HINT } from '../components/map/CountyShadingPanel'
import { ACTIVITY_START_SPACING_DEFAULT_MS } from './rateLimit'
import { restingStatus, type ProjectsStatus } from './useChecklistProjects'

describe('the one denominator clause', () => {
  it('names both numbers on a partial answer', () => {
    expect(checkedClause(412, 3252)).toBe('412 of 3,252 checklists checked')
  })

  it('reads as a whole on a complete one', () => {
    expect(checkedClause(3252, 3252)).toBe('all 3,252 of your checklists')
  })

  it('is thousands-separated, matching every other figure on the tab', () => {
    expect(checkedClause(1, 10000)).toContain('10,000')
  })
})

describe('the one tally clause (FR-49, FR-50)', () => {
  it('is EMPTY at checked = 0 — a never-run section shows no count, not a zero', () => {
    // Zero is a claim the app has not earned.
    expect(tally(0, 0, 3252)).toBe('')
    expect(tally(3, 0, 3252)).toBe('')
  })

  it('states the earned zero against its denominator', () => {
    expect(tally(0, 412, 3252)).toBe('No projects found across 412 of 3,252 checklists checked.')
  })

  it('singularizes one project and pluralizes the rest', () => {
    expect(tally(1, 412, 3252)).toBe('1 project across 412 of 3,252 checklists checked.')
    expect(tally(3, 412, 3252)).toBe('3 projects across 412 of 3,252 checklists checked.')
  })

  it('a tally ALWAYS carries its denominator, whatever the inputs', () => {
    // The structural claim: there is no reachable input that produces a bare
    // count. A twelfth state composing this clause inherits the guarantee.
    for (const found of [0, 1, 2, 9]) {
      for (const [checked, total] of [[1, 1], [1, 5], [412, 3252], [3252, 3252]]) {
        const t = tally(found, checked, total)
        if (t === '') continue
        expect(t, `${found}/${checked}/${total}`).toMatch(/\d/)
        expect(t).toContain(total.toLocaleString())
      }
    }
  })
})

describe('the duration estimate is DERIVED, never hardcoded (FR-49)', () => {
  it('follows the count and the shipped spacing', () => {
    expect(estimateMinutes(3252)).toBe(Math.round(3252 * ACTIVITY_START_SPACING_DEFAULT_MS / 60000))
    expect(estimateMinutes(3252)).toBe(8)
    expect(estimateMinutes(20000)).toBe(50)
  })

  it('never reads "about 0 minutes"', () => {
    expect(estimateMinutes(0)).toBe(1)
    expect(estimateMinutes(1)).toBe(1)
  })

  it('is a property of the FORMULA across its whole input domain, not two samples', () => {
    // Two things that hold for EVERY n, which is what "derived" means. Note it
    // is deliberately NOT "doubling n doubles the estimate": rounding breaks
    // that (1,000 rounds 2.5 up to 3 while 2,000 gives exactly 5), and a claim
    // that is false at the boundary is worse than no claim.
    for (let n = 0; n <= 40_000; n += 137) {
      const exact = n * ACTIVITY_START_SPACING_DEFAULT_MS / 60000
      // Never more than half a minute from the exact figure, floored at 1.
      expect(estimateMinutes(n)).toBeGreaterThanOrEqual(1)
      if (exact >= 1) expect(Math.abs(estimateMinutes(n) - exact)).toBeLessThanOrEqual(0.5)
      // Monotone: a bigger sweep never reports a shorter estimate.
      if (n > 0) expect(estimateMinutes(n)).toBeGreaterThanOrEqual(estimateMinutes(n - 137))
    }
  })
})

// ── The unit belongs to the number (QA-52) ──────────────────────────────────
//
// FOUR states quote a duration and every one of them interpolated
// `about ${estimateMinutes(n)} minutes` with a HARDCODED plural, so any figure
// of 1 shipped "about 1 minutes". `estimateMinutes` returns 1 for every n in
// 0-599, which is not only small accounts: the `stopped` and `partial` states
// quote what is LEFT, so the tail of every sweep, on every account, passes
// through it.
//
// The guard that appeared to cover this could not fail. `toContain('about 1
// minute')` is satisfied by the superstring "about 1 minutes", so the assertion
// was true of the defect. Every assertion below is anchored on a word boundary
// or matches the whole phrase.
describe('the duration estimate carries the right unit (QA-52)', () => {
  it('says "minute" for one and "minutes" for anything else', () => {
    expect(estimateClause(1)).toBe('about 1 minute')
    expect(estimateClause(0)).toBe('about 1 minute')
    expect(estimateClause(599)).toBe('about 1 minute')
    expect(estimateClause(600)).toBe('about 2 minutes')
    expect(estimateClause(3252)).toBe('about 8 minutes')
    expect(estimateClause(20000)).toBe('about 50 minutes')
  })

  it('never emits a plural after a bare 1, for ANY input', () => {
    for (let n = 0; n <= 40_000; n += 97) {
      const clause = estimateClause(n)
      expect(clause, `n=${n}`).not.toMatch(/\babout 1 minutes\b/)
      expect(clause, `n=${n}`).toMatch(/^about [\d,]+ minutes?$/)
    }
  })

  it('GUARD THE GUARD: the shipped defect would fail these', () => {
    // The exact string four states rendered. If a `toContain` were used here it
    // would pass, which is the whole reason this block exists.
    const defect = `about ${estimateMinutes(400)} minutes`
    expect(defect).toBe('about 1 minutes')
    expect(defect).toMatch(/\babout 1 minutes\b/)
    expect(defect).not.toBe(estimateClause(400))
  })

  it('reaches every one of the four states that quote a duration', () => {
    // Each of these has a figure that lands on 1, which is the only value the
    // defect was visible at. `never-run` and `complete` quote the TOTAL;
    // `stopped` and `partial` quote what is left, which is why the defect
    // reached large accounts too.
    const cases: Array<[string, ProjectsStatus]> = [
      ['never-run', { kind: 'never-run', total: 400, skipped: 0 }],
      ['complete', { kind: 'complete', checked: 400, total: 400 }],
      ['stopped', { kind: 'stopped', checked: 100, total: 400 }],
      ['partial', { kind: 'partial', checked: 100, total: 400, remaining: 300 }],
    ]
    for (const [name, status] of cases) {
      const { note } = projectsCopy(status, 1)
      expect(note, name).toMatch(/\babout 1 minute\b/)
      expect(note, name).not.toMatch(/\babout 1 minutes\b/)
    }
    // Non-vacuity: at a larger figure the same four states DO say "minutes".
    const big: Array<[string, ProjectsStatus]> = [
      ['never-run', { kind: 'never-run', total: 3252, skipped: 0 }],
      ['complete', { kind: 'complete', checked: 3252, total: 3252 }],
      ['stopped', { kind: 'stopped', checked: 100, total: 3252 }],
      ['partial', { kind: 'partial', checked: 100, total: 3252, remaining: 3152 }],
    ]
    for (const [name, status] of big) {
      expect(projectsCopy(status, 1).note, name).toMatch(/\babout \d+ minutes\b/)
    }
  })

  it('no shipped state string can say "1 minutes" at any figure', () => {
    // The sweep the four-state test above cannot make: every state, every
    // interesting count, both strings.
    for (const { where, text } of shippedStrings()) {
      expect(text, where).not.toMatch(/\b1 minutes\b/)
      expect(text, where).not.toMatch(/\b1 seconds\b/)
    }
  })
})

// ── AGREEMENT, AS A RULE RATHER THAN A BAN LIST (QA-52, QA-54) ───────────────
//
// The round that fixed "about 1 minutes" also shipped "1 requests" and "The
// other 1 have not been asked about yet." — both in states the ban list swept,
// past a ban list that named four bad strings and could not name a fifth. So
// the guard below states the RULE instead: over every string every reachable
// state can render, at every count where a singular can appear, no count of one
// may take a plural noun, no determiner may take a bare "1", and no plural verb
// may follow a subject counted at one.
//
// THE GRID IS THE APP'S OWN. The nine resting states come out of the shipped
// `restingStatus` over the cross product of its inputs, not out of a list
// written here: a hand-written list is a replica, and a replica can drift from
// the real precedence (at-capacity outranks everything; complete outranks
// stopped, which is why "the other 0" is not reachable and is not asserted on).
// The two transient states the hook publishes directly are added at their own
// reachable counts.

/** Totals worth sweeping: the singular, its neighbours, the estimate's own
 *  minute boundary, and the user's real export. */
const TOTALS = [1, 2, 3, 599, 600, 3300]

interface Sample { where: string; text: string }

/** Every string every reachable state can render, over the grid. */
function shippedStrings(): Sample[] {
  const out: Sample[] = []
  const push = (where: string, text: string) => out.push({ where, text })

  for (const total of TOTALS) {
    const checkeds = [...new Set([0, 1, 2, total - 1, total])].filter(c => c >= 0 && c <= total)
    for (const checked of checkeds) {
      const view = { checked, total, skipped: 0 }
      const statuses: ProjectsStatus[] = []
      // The ten resting states, through the shipped precedence (`paused`
      // joined the cross product with project-checker-rate-limiting).
      for (const hasEbirdKey of [true, false]) {
        for (const online of [true, false]) {
          for (const atCapacity of [true, false]) {
            for (const paused of [true, false]) {
              for (const failed of [0, 1, 2, checked]) {
                for (const stopped of [true, false]) {
                  statuses.push(restingStatus(
                    view as never,
                    { hasEbirdKey, online, atCapacity, paused, failed, stopped },
                  ))
                }
              }
            }
          }
        }
      }
      // The three the hook publishes directly rather than through
      // `restingStatus`: two while a pass is in flight, and the transport
      // failure at `useChecklistProjects.ts:404`.
      statuses.push({ kind: 'running', checked, total })
      statuses.push({ kind: 'error', checked, total })
      for (const seconds of [1, 2, 60]) statuses.push({ kind: 'cooldown', checked, total, seconds })

      for (const st of statuses) {
        for (const found of [0, 1, 2]) {
          const c = projectsCopy(st, found)
          const at = `${st.kind} checked=${checked} total=${total} found=${found}`
          push(`${at} msg`, c.msg)
          push(`${at} note`, c.note)
          for (const a of c.actions) push(`${at} action ${a.id}`, a.label)
          if (c.link) push(`${at} link`, c.link)
        }
      }
      // The clause functions the component composes outside `projectsCopy`.
      push(`skippedNote ${checked}/${total}`, skippedNote(checked, total))
      push(`shareClause ${checked}`, shareClause('100%', checked))
      push(`checkedClause ${checked}/${total}`, checkedClause(checked, total))
      push(`noneCheckedClause ${total}`, noneCheckedClause(total))
      for (const found of [0, 1, 2]) push(`tally ${found} ${checked}/${total}`, tally(found, checked, total))
    }
  }
  return out
}

/** A count of one taking a plural noun: "1 requests", "1 rows". */
const ONE_PLURAL_NOUN = /\b1 [a-z]+s\b/

/**
 * A determiner that has already named the noun, taking a bare numeral: "the
 * other 1", "those 1", "all 1 of your checklists", "of the 1 checked". The
 * lookahead keeps "the 10" and the thousands separator in "the 1,234" out of
 * it, WITHOUT also excusing a trailing comma: "the other 1, about 1 minute"
 * shipped, and `(?![\d,])` would have let it through.
 */
const DETERMINER_BARE_ONE = /\b(?:all|those|these|the|other) 1(?!\d|,\d)/

/**
 * Subject-verb agreement, scoped to the sentence: for each verb that only ever
 * takes a plural subject, the nearest count named before it in the same
 * sentence must not be one. This is what catches "1 row ... carry", which no
 * fixed-distance pattern reaches, and "The other 1 have".
 */
const PLURAL_ONLY_VERBS = new Set(['have', 'are', 'were', 'carry', 'do', 'go', 'stay', 'cover', 'take'])

function pluralVerbAfterOne(text: string): string | null {
  for (const sentence of text.split(/(?<=[.:])\s+/)) {
    let lastCount: string | null = null
    for (const m of sentence.matchAll(/\d[\d,]*|[A-Za-z']+/g)) {
      const token = m[0]
      if (/^\d/.test(token)) { lastCount = token; continue }
      if (lastCount === '1' && PLURAL_ONLY_VERBS.has(token.toLowerCase())) {
        return `"${token}" after a count of 1: ${sentence}`
      }
    }
  }
  return null
}

describe('number agreement holds in every state at every count (QA-52, QA-54)', () => {
  const corpus = shippedStrings()

  it('the grid reaches all twelve states, and reaches the singular', () => {
    // Non-vacuity for the sweep itself. A grid that quietly stopped producing
    // `partial`, or stopped producing it at remaining = 1, would make every
    // assertion below pass by not looking.
    const kinds = new Set(corpus.map(s => s.where.split(' ')[0]))
    for (const kind of [
      'never-run', 'running', 'cooldown', 'stopped', 'paused', 'partial',
      'complete', 'unanswered', 'at-capacity', 'no-key', 'offline', 'error',
    ]) expect(kinds, kind).toContain(kind)
    // The two counts the two shipped defects needed: a total of one, and a
    // remaining of one at the tail of a real sweep.
    expect(corpus.some(s => s.where === 'never-run checked=0 total=1 found=0 note')).toBe(true)
    expect(corpus.some(s => s.where === 'partial checked=3299 total=3300 found=0 msg')).toBe(true)
    expect(corpus.length).toBeGreaterThan(2000)
  })

  it('no count of one takes a plural noun', () => {
    for (const { where, text } of corpus) expect(text, where).not.toMatch(ONE_PLURAL_NOUN)
  })

  it('no determiner takes a bare "1"', () => {
    for (const { where, text } of corpus) expect(text, where).not.toMatch(DETERMINER_BARE_ONE)
  })

  it('no plural verb follows a subject counted at one', () => {
    for (const { where, text } of corpus) expect(pluralVerbAfterOne(text), where).toBeNull()
  })

  it('GUARD THE GUARD: each rule fires on the defect it was written for', () => {
    // Every string here SHIPPED. If a rule stops matching its own defect, the
    // three sweeps above are decoration.
    expect('on its own: 1 requests, about 1 minute').toMatch(ONE_PLURAL_NOUN)
    expect('so they are outside the 1.').toMatch(DETERMINER_BARE_ONE)
    expect('1 project across all 1 of your checklists.').toMatch(DETERMINER_BARE_ONE)
    expect('Counts below cover only those 1.').toMatch(DETERMINER_BARE_ONE)
    expect('Resuming asks only about the other 1, about 1 minute.').toMatch(DETERMINER_BARE_ONE)
    expect('100% of the 1 checked').toMatch(DETERMINER_BARE_ONE)
    expect(pluralVerbAfterOne('The other 1 have not been asked about yet.')).toBeTruthy()
    expect(pluralVerbAfterOne('1 row in this backup carry no usable checklist id.')).toBeTruthy()
    // And each rule leaves the CORRECTED string alone, so the fix is not merely
    // a different way of tripping the same assertion.
    expect('on its own: 1 request, about 1 minute').not.toMatch(ONE_PLURAL_NOUN)
    expect('1 project across your only checklist.').not.toMatch(DETERMINER_BARE_ONE)
    expect('the 3,299 checklists behind them').not.toMatch(DETERMINER_BARE_ONE)
    expect('the 1,234 checklists behind them').not.toMatch(DETERMINER_BARE_ONE)
    expect('the 10 checklists behind them').not.toMatch(DETERMINER_BARE_ONE)
    expect('the other 12, about 1 minute').not.toMatch(DETERMINER_BARE_ONE)
    expect(pluralVerbAfterOne('The other one has not been asked about yet.')).toBeNull()
    expect(pluralVerbAfterOne('2 rows in this backup carry no usable checklist id.')).toBeNull()
    // The rule is sentence-scoped: a plural verb whose own sentence names no
    // count of one is not a fault, which is what "Stored answers are full at 1
    // checklist" depends on.
    expect(pluralVerbAfterOne('Stored answers are full at 1 checklist.')).toBeNull()
    expect(pluralVerbAfterOne('These counts are complete for it.')).toBeNull()
  })

  it('the singular renderings read as written, not merely as legal', () => {
    // The rules above say what may not appear. These say what does — the exact
    // sentences the two shipped defects occupied.
    expect(projectsCopy({ kind: 'never-run', total: 1, skipped: 0 }, 0).note)
      .toContain('on its own: 1 request, about 1 minute')
    expect(projectsCopy({ kind: 'partial', checked: 3299, total: 3300, remaining: 1 }, 2).msg)
      .toBe('3,299 of 3,300 checklists checked. The other one has not been asked about yet.')
    expect(skippedNote(1, 3300))
      .toBe('1 row in this backup carries no usable checklist id, so it is outside the 3,300.')
    expect(checkedClause(0, 1)).toBe('0 of 1 checklist checked')
    expect(checkedClause(1, 1)).toBe('your 1 checklist')
    expect(shareClause('100%', 1)).toBe('100% of the one checked')
  })
})

// ── The denominator survives `checked === 0` (QA-53) ─────────────────────────
describe('the two states reachable with NOTHING checked still name the total', () => {
  it('unanswered at checked = 0 carries the export total', () => {
    // A first pass that fails every request on a fresh store. The tally is empty
    // by design there (FR-49 forbids a count of any kind, a zero included), so
    // without a clause of its own the card read " 3 checklists could not be
    // answered and are not counted." with 3,252 nowhere on it.
    const { msg } = projectsCopy({ kind: 'unanswered', checked: 0, total: 3252, failed: 3 }, 0)
    expect(msg).toContain('3,252')
    expect(msg).toContain(noneCheckedClause(3252))
    // Still no count of any kind about PROJECTS.
    expect(msg).not.toMatch(/\b0 projects\b/)
    expect(msg).not.toMatch(/No projects found/)
  })

  it('at-capacity at checked = 0 names the total and claims nothing about zero', () => {
    const { msg, note } = projectsCopy({ kind: 'at-capacity', checked: 0, total: 3252, capacity: 500 }, 0)
    expect(msg).toContain('3,252')
    // It used to read "for the 0 checklists behind them".
    expect(note).not.toMatch(/\b0 checklists\b/)
    expect(note).not.toMatch(/counts above/)
  })

  it('leaves the checked > 0 wording exactly as it was', () => {
    const { msg, note } = projectsCopy({ kind: 'at-capacity', checked: 500, total: 3252, capacity: 500 }, 2)
    expect(msg).toContain('2 projects across 500 of 3,252 checklists checked.')
    expect(note).toContain('The counts above stay true for the 500 checklists behind them.')
    expect(msg).not.toContain(noneCheckedClause(3252))
  })
})

describe('every state composes the shared clauses (FR-51)', () => {
  const STATES: ProjectsStatus[] = [
    { kind: 'never-run', total: 3252, skipped: 0 },
    { kind: 'running', checked: 412, total: 3252 },
    { kind: 'cooldown', checked: 412, total: 3252, seconds: 7 },
    { kind: 'stopped', checked: 412, total: 3252 },
    { kind: 'paused', checked: 412, total: 3252 },
    { kind: 'partial', checked: 412, total: 3252, remaining: 2840 },
    { kind: 'complete', checked: 3252, total: 3252 },
    { kind: 'unanswered', checked: 3200, total: 3252, failed: 52 },
    { kind: 'at-capacity', checked: 500, total: 3252, capacity: 500 },
    { kind: 'no-key' },
    { kind: 'offline', checked: 412, total: 3252 },
    { kind: 'error', checked: 412, total: 3252 },
  ]

  it('returns a sentence, a note and an icon for all twelve', () => {
    expect(STATES).toHaveLength(12)
    for (const s of STATES) {
      const c = projectsCopy(s, 3)
      expect(c.msg.length, s.kind).toBeGreaterThan(10)
      expect(c.note.length, s.kind).toBeGreaterThan(10)
      expect(c.icon, s.kind).toBeTruthy()
      expect(c.tone, s.kind).toBeTruthy()
    }
  })

  it('offers a control only where the state can actually perform one', () => {
    // Offline and at-capacity offer none, because there is nothing they could
    // do; no-key offers an inline link instead of an action.
    const byKind = Object.fromEntries(STATES.map(s => [s.kind, projectsCopy(s, 3)]))
    expect(byKind['offline'].actions).toEqual([])
    expect(byKind['at-capacity'].actions).toEqual([])
    expect(byKind['no-key'].actions).toEqual([])
    expect(byKind['no-key'].link).toBe('Add a key in Settings')
    expect(byKind['never-run'].actions[0].primary).toBe(true)
    // The paused state can still act — the hour is guidance, not a lockout —
    // and its control is the SHIPPED resume id, so the component's action
    // mapping needed no new arm.
    expect(byKind['paused'].actions.map(a => a.id)).toEqual(['resume'])
  })

  it('only ONE control on the whole card is the accent-filled primary', () => {
    // It is the only press that costs the user eight minutes.
    const primaries = STATES.flatMap(s => projectsCopy(s, 3).actions.filter(a => a.primary))
    expect(primaries).toHaveLength(1)
    expect(primaries[0].label).toBe('Check projects')
  })

  it('the unanswered note singularizes one failure', () => {
    expect(projectsCopy({ kind: 'unanswered', checked: 9, total: 10, failed: 1 }, 0).note)
      .toContain('asks only about that one')
    expect(projectsCopy({ kind: 'unanswered', checked: 5, total: 10, failed: 5 }, 0).note)
      .toContain('asks only about those 5')
  })

  it('the cooldown sentence singularizes one second', () => {
    expect(projectsCopy({ kind: 'cooldown', checked: 1, total: 10, seconds: 1 }, 0).msg)
      .toContain('about 1 second.')
  })

  it('the skipped note agrees in number', () => {
    expect(skippedNote(1, 3252)).toContain('1 row in this backup')
    expect(skippedNote(1, 3252)).toContain('it is outside')
    expect(skippedNote(4, 3252)).toContain('4 rows in this backup')
    expect(skippedNote(4, 3252)).toContain('they are outside')
  })

  it('a share clause always names what it is a share OF', () => {
    expect(shareClause('5%', 3252)).toBe('5% of the 3,252 checked')
    expect(shareClause('<1%', 3252)).toBe('<1% of the 3,252 checked')
  })
})

// ── The paused row (project-checker-rate-limiting) ───────────────────────────
//
// One row of copy, exactly as the file's header promises. The row composes the
// same shared clauses as its neighbours, so the denominator, the agreement
// helpers and the corpus sweep all cover it for free; what is pinned here is
// what is DISTINCT about it — the hour suggestion, the kept answers, and the
// shipped resume control.
describe('the paused row', () => {
  it('suggests about an hour, keeps the tally, and offers the shipped Resume control', () => {
    const c = projectsCopy({ kind: 'paused', checked: 412, total: 3252 }, 2)
    expect(c.icon).toBe('clock')
    expect(c.tone).toBe('warning')
    expect(c.msg).toContain('412 of 3,252 checklists checked')
    expect(c.msg).toContain('every answer so far is kept')
    expect(c.msg).toContain('paused itself')
    expect(c.note).toContain('about an hour')
    expect(c.actions).toEqual([{ id: 'resume', label: 'Resume' }])
    expect(c.progress).toBeUndefined()
  })

  it('the resume clause quotes what is LEFT, derived, with its unit', () => {
    const { note } = projectsCopy({ kind: 'paused', checked: 412, total: 3252 }, 2)
    expect(note).toContain('the other 2,840')
    expect(note).toContain(estimateClause(2840))
  })

  it('at nothing checked it states the denominator and claims no count of any kind', () => {
    const c = projectsCopy({ kind: 'paused', checked: 0, total: 3252 }, 0)
    expect(c.msg).toContain(noneCheckedClause(3252))
    expect(c.msg).not.toMatch(/\b0 /)
    expect(c.note).toContain('3,252 requests')
    expect(c.note).toContain('about an hour')
  })

  it('singularizes one remaining checklist, exactly as stopped does', () => {
    const { note } = projectsCopy({ kind: 'paused', checked: 3299, total: 3300 }, 1)
    expect(note).toContain('the other one, about 1 minute')
  })

  it('a paused re-check (nothing left unanswered) never renders "the other 0"', () => {
    // Reachable through Check again: the store is complete, so checked equals
    // total while targets remain. Unlike stopped, paused outranks the
    // complete branch, so this pair reaches the row.
    const { msg, note } = projectsCopy({ kind: 'paused', checked: 3300, total: 3300 }, 1)
    expect(msg).toContain('3,300 of 3,300 checklists checked')
    expect(note).not.toContain('other 0')
    expect(note).toContain('about an hour')
    expect(note).toContain('already has a stored answer')
  })

  it('reads differently from cooldown and from stopped — three states, three sentences', () => {
    const paused = projectsCopy({ kind: 'paused', checked: 412, total: 3252 }, 2).msg
    const cooldown = projectsCopy({ kind: 'cooldown', checked: 412, total: 3252, seconds: 7 }, 2).msg
    const stopped = projectsCopy({ kind: 'stopped', checked: 412, total: 3252 }, 2).msg
    expect(new Set([paused, cooldown, stopped]).size).toBe(3)
    // Cooldown promises to carry on by itself; paused must NOT (it will not).
    expect(paused).not.toContain('carries on by itself')
  })
})

// ── FR-61 / QA-77: no em dashes in any new user-facing copy ──────────────────
// The sweep is over the STRINGS THE USER SEES, not over the source files. Code
// comments are explicitly out of the rule's scope, and a file scan would both
// over-report (this file's own prose uses them) and under-report (a sentence
// composed from two halves is invisible to it).
describe('the no-em-dash sweep (FR-61, QA-77)', () => {
  const STATES: ProjectsStatus[] = [
    { kind: 'never-run', total: 3252, skipped: 2 },
    { kind: 'running', checked: 1, total: 10 },
    { kind: 'cooldown', checked: 1, total: 10, seconds: 7 },
    { kind: 'stopped', checked: 1, total: 10 },
    { kind: 'paused', checked: 0, total: 10 },
    { kind: 'paused', checked: 1, total: 10 },
    { kind: 'paused', checked: 10, total: 10 },
    { kind: 'partial', checked: 1, total: 10, remaining: 9 },
    { kind: 'complete', checked: 10, total: 10 },
    { kind: 'unanswered', checked: 9, total: 10, failed: 1 },
    { kind: 'at-capacity', checked: 5, total: 10, capacity: 5 },
    { kind: 'no-key' },
    { kind: 'offline', checked: 0, total: 10 },
    { kind: 'offline', checked: 5, total: 10 },
    { kind: 'error', checked: 0, total: 10 },
    { kind: 'error', checked: 5, total: 10 },
  ]

  function everyUserFacingString(): string[] {
    const all: string[] = [
      UNNAMED_PROJECT_NOTE, PORTALS_NOTE, PROJECTS_SUBLABEL, PORTALS_SUBLABEL,
      PROJECTS_CHART_CAPTION, PORTALS_CHART_CAPTION,
      SPECIES_SHADING_HINT, STATS_SHADING_HINT, STATS_EMPTY_NOTE, TEXTURES_HINT,
      speciesLegendTitle('Common Raven'), speciesEmptyNote('Common Raven'),
      skippedNote(1, 10), skippedNote(4, 10),
      shareClause('<1%', 10), shareClause('5%', 3252),
      checkedClause(1, 10), checkedClause(10, 10),
      tally(0, 5, 10), tally(1, 5, 10), tally(3, 10, 10),
    ]
    for (const s of STATES) {
      for (const found of [0, 1, 3]) {
        const c = projectsCopy(s, found)
        all.push(c.msg, c.note, c.link ?? '', ...c.actions.map(a => a.label))
      }
    }
    return all
  }

  it('no generated string contains an em dash, in any state', () => {
    const all = everyUserFacingString()
    for (const str of all) expect(str).not.toContain('\u2014')
    expect(all.length).toBeGreaterThan(50)   // non-vacuity: it really swept
  })

  it('no generated string contains a curly apostrophe', () => {
    for (const str of everyUserFacingString()) expect(str).not.toContain('\u2019')
  })

  it('an EN dash is allowed, and only where a numeric range needs one', () => {
    // The en dash is the sanctioned glyph for a range and is out of the sweep's
    // scope. None of the composed sentences needs one; the date span is built
    // by the shipped formatDateRange, which supplies its own.
    for (const str of everyUserFacingString()) expect(str).not.toContain('\u2013')
  })
})
