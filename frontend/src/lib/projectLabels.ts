// The bundled eBird project / portal label table
// (county-shading-and-project-stats, FR-57, NFR-09), in the `PROTOCOL_NAMES`
// mould from lib/checklistMeta.ts.
//
// A PROJECT'S NAME IS NEVER INVENTED. No public eBird endpoint resolves project
// id 1050 to "California Breeding Bird Atlas", so this small table covers the
// identifiers the app knows and anything else renders its RAW identifier
// verbatim. Two unknown identifiers (9999 and FOO_BAR) are correctly separate
// keys: the app cannot know they name the same project and does not guess.
//
// TRUST BOUNDARY. This table is a BUNDLED BUILD-TIME ASSET, inlined at build:
// an attacker who could change it could already change the code that reads it,
// so it needs no runtime validation — its defenses are the type system and the
// test suite. (The persisted store is the opposite case and gets full per-entry
// validation on load.) What IS attacker-influenceable is the KEY, which arrives
// from the eBird response, and that is why every lookup goes through
// `Object.hasOwn`: a bare index on an object literal returns a TRUTHY INHERITED
// MEMBER for at least twelve strings, so `TABLE[raw] ?? raw` silently returns an
// inherited member instead of falling through to the raw input.
//
// NO IDENTIFIER EVER BECOMES A URL (FR-29). Every export here returns plain
// strings, and the Projects rows carry no link component.

export interface ProjectLabel {
  /** Canonical key. Both forms of one project collapse to it, so a checklist
   *  naming the same project by a CODE and by a NUMERIC ID counts once. */
  key: string
  label: string
}

/** Keyed by BOTH the string code and the numeric id (as a string), both pointing
 *  at the SAME canonical entry. Add a row only for an identifier whose name is
 *  actually known. */
const PROJECT_LABELS: Readonly<Record<string, ProjectLabel>> = {
  EBIRD_ATL_CA: { key: 'atl-ca', label: 'California Breeding Bird Atlas' },
  '1050': { key: 'atl-ca', label: 'California Breeding Bird Atlas' },
  // The two generic submission portals also need labels, or the "How you
  // submitted" block renders raw codes for its two commonest values.
  EBIRD: { key: 'EBIRD', label: 'eBird' },
  EBIRD_MERLIN: { key: 'EBIRD_MERLIN', label: 'Merlin' },
}

/**
 * `projId` values that are a SUBMISSION PORTAL rather than a project.
 *
 * "Submitted via Merlin" is not a project and this feature will not present it
 * as one. `projId` mixes a submission portal (EBIRD, EBIRD_MERLIN) with a
 * project portal (EBIRD_ATL_CA), while `projectIds` is the membership array —
 * so projects are driven by `projectIds` plus any NON-generic `projId`, which
 * means an unknown project portal is shown as a project rather than silently
 * dropped.
 *
 * A Set, so there is no prototype hazard at the lookup.
 */
const GENERIC_SUBMISSION_PORTALS: ReadonlySet<string> = new Set(['EBIRD', 'EBIRD_MERLIN'])

/** An identifier not in the table is its OWN canonical key and renders its raw
 *  value verbatim (FR-57). Read through `Object.hasOwn` because the key is an
 *  unvalidated string from an external API. */
export function canonicalProject(identifier: string): ProjectLabel {
  return Object.hasOwn(PROJECT_LABELS, identifier)
    ? PROJECT_LABELS[identifier]
    : { key: identifier, label: identifier }
}

/** True when this `projId` is a generic submission portal, not a project. */
export function isGenericPortal(projId: string): boolean {
  return GENERIC_SUBMISSION_PORTALS.has(projId)
}

/** True when the identifier has a published name in the bundled table. A row
 *  that is false renders in mono with the "no public endpoint names this"
 *  line, so the reader knows it is an identifier rather than a name. */
export function hasPublishedName(identifier: string): boolean {
  return Object.hasOwn(PROJECT_LABELS, identifier)
}
