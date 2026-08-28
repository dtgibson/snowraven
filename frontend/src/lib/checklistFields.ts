// The `fields=` flag table for GET /checklists/{id}, shared by the desktop
// transport branch and the checklist service (county-shading-and-project-stats,
// FR-25/FR-26/FR-27).
//
// `fields` is SINGLE-VALUED WHOLE-STRING EQUALITY on both transports, and stays
// that way deliberately. There is no comma-splitting precedent anywhere in this
// seam, and inventing one would put FR-26's byte-identical guarantee for the
// shipped `provenance` caller at risk for no caller that wants it. The shared
// fixture's `fieldFlagRows` pin the whole table on both runtimes, including the
// case-sensitivity and comma rows.
//
// Dependency-free by extraction: `transport.ts` rides the entry chunk, so this
// module must stay importable there without new weight (the lib/rateLimit.ts
// discipline).

export interface ChecklistFieldFlags {
  /** Skip the second outbound eBird call that resolves a readable location
   *  name. `locName` then falls back to the locId, exactly as it already does
   *  when resolution fails. */
  skipLocName: boolean
  /** Skip the species resolution AND the per-observation projection, returning
   *  `species: []`. The projects sweep needs neither, so under `fields=projects`
   *  a checklist costs exactly ONE outbound eBird request. */
  skipSpecies: boolean
}

/** The one flag table per runtime. Its Python twin is
 *  `services.ebird.checklist_field_flags`; the shared fixture drives both. */
export function checklistFieldFlags(fields: string | undefined | null): ChecklistFieldFlags {
  if (fields === 'provenance') return { skipLocName: true, skipSpecies: false }
  if (fields === 'projects') return { skipLocName: true, skipSpecies: true }
  return { skipLocName: false, skipSpecies: false }
}
