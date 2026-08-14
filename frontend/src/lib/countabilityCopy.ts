// User-facing copy for the countability rule (design-refinement.md — the four
// labels and the three Calendar strings).
//
// WHY THIS IS NOT IN `exoticCopy.ts`, where the sibling count-rule sentences
// live. `components/LifeList.tsx` is on `App.tsx`'s STATIC import graph, so
// anything it imports rides the entry chunk; `exoticCopy.ts` is lazy (~3.7 KB
// gzipped, reached only through the Statistics and Calendar tabs). Importing it
// from LifeList to share one 15-character string would move all of it onto first
// paint. This module holds only the strings an entry-chunk surface needs, and
// `exoticCopy.ts` imports the label it quotes rather than repeating it.
//
// Voice: informative, never promotional. NO EM DASHES in any string here, and
// straight apostrophes throughout. The sweep that enforces that is in
// `components/ExoticProvenanceAccount.test.tsx` ("copy hygiene"), which imports
// this module by name: until then it swept `exoticCopy` only, so this claim was
// an over-claim rather than a guard. Keep the two swept modules listed there in
// step with any third copy module.

/**
 * The label on the two controls that move a NUMBER: Statistics (checkbox) and
 * Calendar (switch).
 *
 * It replaced "Count spuh, slash & hybrids", which named a set that no longer
 * exists: under eBird's rule the excluded set newly includes named hybrids and
 * parenthetical spuhs and newly EXCLUDES subspecies-group slashes, so the three
 * nouns were not merely incomplete but wrong in both directions.
 *
 * Four properties, each of which rejected a candidate:
 *  1. It does not enumerate, so it survives the set moving again. That is the
 *     v0.5.87 lesson and it kills "Count spuhs and hybrids".
 *  2. It keeps the "Count <plural noun>" parallel with its stacked neighbour
 *     `ESCAPEE_TOGGLE_LABEL`, which `exoticCopy.ts` records was chosen FOR that
 *     parallel. Renaming this one without preserving the shape would retire the
 *     reason the sibling is named as it is.
 *  3. It is positive, not a negation: the control turns ON to include more, and
 *     the label says what turning it on does. This kills "Count non-countable
 *     forms" and the runner-up "Count uncountable forms", which pairs a positive
 *     verb with a negated noun and asks the reader to step over a paradox.
 *  4. It is short: 15 characters against the old 26, and it stacks under
 *     `Count escapees` in a header that wraps at every narrow width.
 */
export const COUNT_FORMS_TOGGLE_LABEL = 'Count all forms'

/**
 * The label on the two controls that move ROWS: Multimedia and Species Detail.
 *
 * Same noun, different verb, because these toggles reveal list entries rather
 * than change a number. It replaced "Show sp./slash", which named a strictly
 * narrower set than the control now governs (that predicate omitted hybrids, so
 * a hybrid row rendered while the same tab's "X of N species" count excluded it).
 *
 * Both tabs render this immediately beside `Show subspecies`, which is a
 * SEPARATE merge control on an independent axis. Keep `Show subspecies` first,
 * as it is today on both tabs, so the more specific control is read first and
 * "all forms" is less likely to be read as including subspecies.
 */
export const SHOW_FORMS_TOGGLE_LABEL = 'Show all forms'

/** Calendar, under its switch. The label may not enumerate, but a helper line
 *  may TEACH: "like a spuh or a hybrid" is open by construction, so it gives
 *  examples without claiming to be a complete list that could go stale. */
export const COUNT_FORMS_HELPER =
  "Forms that don't count toward a life list, like a spuh or a hybrid. Off by default."

/** Calendar day-popup note, shown when the toggle is on. */
export const COUNT_FORMS_POPUP_NOTE =
  'All forms included in the species and individual counts'

/** Calendar sub-header suffix, appended when the toggle is on. */
export const COUNT_FORMS_SUFFIX = ', all forms included'
