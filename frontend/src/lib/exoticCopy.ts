// User-facing copy for the escapee count rule (design-spec.md — Content Notes).
//
// It lives in `lib/` rather than beside the component because a non-component
// export from a `.tsx` trips `react-refresh/only-export-components` — the same
// constraint that put `lib/mediaEmbed.ts` and `lib/helpLinks.ts` here.
//
// Voice: informative, never promotional. Plain sentences that state a rule and
// then stop. NO EM DASHES in any string in this file (the standing sweep), and
// straight apostrophes throughout. Every state says what the NUMBER is doing,
// not just what the network is doing.

import type { ProvenanceStatus } from './useExoticProvenance'
import { COUNT_FORMS_TOGGLE_LABEL } from './countabilityCopy'

/**
 * The ONE sentence reused wherever a count reflects the escapee rule (FR-33,
 * QA-38): Calendar species counts, Multimedia documentation coverage, Frivolous
 * Lists, and any other surface headlining a life-list count.
 *
 * It names the new class WITHOUT enumerating all four exclusion classes, so it
 * survives a fifth (FR-40), and it claims no eBird parity beyond what FR-01
 * implements. Per the repo's single-source rule, change every copy of it in the
 * same edit; this constant exists so there is only one.
 *
 * On the Calendar it renders as plain text with no link and no fetch, which
 * preserves that tab's zero-network guarantee (FR-35, QA-40).
 */
export const COUNT_RULE_SENTENCE = countRuleSentence(true)

/**
 * The same sentence with the escapee clause dropped, for a surface that renders
 * the rule BEFORE or WITHOUT any escapee resolution, where naming escapees would
 * over-claim. Newly needed because the form exclusion is now always in force on
 * the two fixed-scope surfaces, so their note is unconditional while the escapee
 * half still depends on a network pass that may never have run.
 */
export const COUNT_RULE_SENTENCE_NO_ESCAPEES = countRuleSentence(false)

/**
 * The two rule sentences are ONE base plus an optional clause, so they are
 * generated rather than written twice (design-system.md's manifest rule: when a
 * preference's copy multiplies, generate every string from one source). Writing
 * them as two literals would let the shared half drift on the next edit, which is
 * precisely the failure the rule exists to prevent.
 */
function countRuleSentence(includingEscapees: boolean): string {
  const base = "Counts leave out forms that don't count toward a life list"
  return includingEscapees ? `${base}, including escapees.` : `${base}.`
}

/**
 * The sentence that makes the Statistics same-tab asymmetry visible instead of
 * leaving it a silent surprise: media documentation coverage and Frivolous Lists
 * apply the countable rule unconditionally, so the header checkbox does not move
 * them.
 *
 * That asymmetry is principled rather than accidental. Both metrics are ABOUT the
 * canonical life list, not about what was recorded: a coverage percentage whose
 * denominator the reader can inflate with "Gull sp." is asking "have you
 * photographed a spuh", which is not a question that has an answer. v0.5.87
 * extended the same asymmetry to escapees in three separate comments, each
 * phrased "exactly as it already ignores the include-spuh toggle". Unifying the
 * predicate made the asymmetry more visible; it did not make it wrong.
 *
 * It names the control in the control's own words so a reader can connect the
 * sentence to the checkbox they just clicked without a link, which is why it
 * imports the label rather than repeating it.
 */
export const ALWAYS_COUNTABLE_NOTE =
  `This figure always uses countable species, whichever way ${COUNT_FORMS_TOGGLE_LABEL} is set.`

/**
 * The county Completeness caption, replacing "spuhs, slashes & hybrids don't
 * count" in both places it appears in `CountyCompletenessPopup.tsx` (FR-40,
 * QA-46). The second sentence makes OQ-03's numerator-only asymmetry visible to
 * the reader rather than leaving it a silent approximation (FR-37).
 */
export const COUNTY_COUNT_RULE_SENTENCE =
  "Your count leaves out forms that don't count toward a life list, including escapees. The eBird regional list is not filtered."

/** The standing rule line under the Species figure, toggle OFF (the default).
 *  Its second sentence is the anti-shortcut promise made visible: a birder never
 *  has to wonder whether their Indian Peafowl or Red Junglefowl quietly
 *  vanished. */
export const ESCAPEE_RULE_OFF =
  'Escapees do not count toward Species, following eBird. Naturalized and provisional exotics do count.'

/** Toggle ON. Tells the birder the consequence of their own choice, rather than
 *  letting them discover a disagreement with eBird later. */
export const ESCAPEE_RULE_ON =
  'Escapees count toward Species. eBird does not count them toward a life list, so this total will read higher than the one eBird shows you.'

/** Disclosure lead, toggle OFF. The "stay on your Life List" clause matters: it
 *  tells the birder nothing was deleted, which is the fear a dropping number
 *  creates. */
export const ESCAPEE_LEAD_OFF =
  'eBird tags these as Exotic: Escapee, so they are left out of Species. They stay on your Life List.'

/** Disclosure lead, toggle ON. Same list, framed as information. */
export const ESCAPEE_LEAD_ON =
  'eBird tags these as Exotic: Escapee. They are counted here because Count escapees is on.'

/** The toggle's own label. Chosen over "Count eBird escapees" for the clean
 *  parallel with its stacked neighbour, which likewise names what it counts
 *  without attribution. That neighbour is now `COUNT_FORMS_TOGGLE_LABEL`
 *  ("Count all forms"), renamed in the countability build; the parallel this
 *  label was chosen for was deliberately preserved through that rename, so this
 *  reason still holds. The eBird attribution is made once,
 *  precisely, in the rule line. The label names only the class it governs and
 *  claims no parity beyond FR-01 (FR-29, QA-34). */
export const ESCAPEE_TOGGLE_LABEL = 'Count escapees'

/**
 * The status sentence for each of the seven states. Pure and total.
 *
 * `checkedLabel` on the offline state is formatted where the status is SET (an
 * effect), never here, so no clock or `Date` construction can reach a render
 * body (NFR-03; `react-hooks/purity` is build-blocking).
 */
export function statusSentence(status: ProvenanceStatus, found: number): string {
  switch (status.kind) {
    case 'not-checked':
      return 'Exotic status has not been checked yet. Every species counts until it is.'
    case 'in-progress':
      return status.additional > 0
        ? `Checking exotic status: ${status.done} of ${status.planned} checklists, plus ${status.additional} follow-up checks.`
        : `Checking exotic status: ${status.done} of ${status.planned} checklists.`
    case 'complete':
      return found > 0
        ? `Exotic status checked across ${status.planned} checklists. ${found} of your species are eBird escapees.`
        : `Exotic status checked across ${status.planned} checklists. None of your species are eBird escapees.`
    case 'partial':
      switch (status.reason) {
        case 'cancelled':
          return `Stopped at ${status.done} of ${status.planned} checklists. ${status.planned - status.done} checklists were not checked, and the species on them still count.`
        case 'failures':
          return `Checked ${status.done} of ${status.planned} checklists. ${status.failed} requests failed, so ${status.openSpecies} species are still unchecked and still count.`
        case 'pass-budget':
          return `Reached this pass's limit of ${status.cap} requests. ${status.openSpecies} species are still unchecked and still count.`
        case 'species-budget':
          // Ordinary agreement only, no word-form ladder: the trailing clause
          // reads "Both still count." at exactly two species and "They all still
          // count." at every other count (design-spec.md, verbatim).
          return `Stopped following up on ${status.openSpecies} species after ${status.cap} checklists each. ${status.openSpecies === 2 ? 'Both still count.' : 'They all still count.'}`
      }
      return ''
    case 'no-key':
      return 'No eBird key, so exotic status cannot be checked. Every species counts.'
    case 'offline':
      return status.checkedLabel !== null
        ? `Offline, so exotic status cannot be rechecked. Showing the check from ${status.checkedLabel}.`
        : 'Offline, so exotic status cannot be checked. Every species counts.'
    case 'error':
      return 'eBird could not be reached. Every species counts until the check succeeds.'
  }
}

/** The disclosure expander's label. Singular at n = 1, plural otherwise; the
 *  "found so far" clause appears only while a pass is running, so the list and
 *  the number agree at every moment. */
export function discloseLabel(found: number, open: boolean, running: boolean): string {
  return `${open ? 'Hide' : 'Show'} the ${found} ${found === 1 ? 'escapee' : 'escapees'}${running ? ' found so far' : ''}`
}

/** Per-species evidence drawn from the cache (FR-09). Deliberately FACTUAL
 *  rather than explanatory: the rule itself is already stated once, in the lead
 *  sentence above the list. */
export function evidenceLine(checklistsChecked: number): string {
  return `Exotic: Escapee · ${checklistsChecked} ${checklistsChecked === 1 ? 'checklist' : 'checklists'} checked`
}
