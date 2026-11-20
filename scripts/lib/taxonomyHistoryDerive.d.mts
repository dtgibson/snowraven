// Types for taxonomyHistoryDerive.mjs, so the frontend guards
// (taxonomyHistoryAsset.test.ts, taxonomyHistoryGenerator.test.ts) import the
// generator's pure core and its shared invariant checker with types.

export class HistoryInputError extends Error {}

export interface PublishedRow {
  published: string
  mark: 'measured' | 'assumed'
  announced?: { gained: number; lost: number }
}

export const UPDATE_PUBLISHED: Readonly<Record<number, PublishedRow>>

/** One event a recount names: its kind and each side's codes. */
export interface RecountEvent { kind: 'split' | 'lump'; before: readonly string[]; after: readonly string[] }
/** A reorganization eBird's announced tally counts by its net change. */
export interface Recount {
  what: string
  events: readonly RecountEvent[]
  counted: { gained: number; lost: number }
}
export const ANNOUNCED_RECOUNTS: Readonly<Record<number, readonly Recount[]>>
/** Slash codes eBird dropped with no later event, each with its cited reason. */
export const SLASHES_DROPPED: Readonly<Record<string, string>>
export const YEARS_WITHOUT_UPDATE: readonly number[]
/** One rename a table names exactly: its code and both common names. */
export interface RenameRow { code: string; from: string; to: string; source?: string; mark?: 'measured' | 'assumed' }
/** Renames Cornell does not annotate, each cited from eBird's update page (R8). */
export const RENAMES_UNANNOTATED: Readonly<Record<number, readonly RenameRow[]>>
/** Unannotated renames left out and printed until a person cites them. */
export const RENAMES_AWAITING_SOURCE: Readonly<Record<number, readonly RenameRow[]>>
/** The rename cutoff (FR-03): two names are the same name when their keys are equal. */
export function renameKey(name: string): string
export const INTEGRATED_NAME_RE: RegExp
export const TAXONOMY_NAME_RE: RegExp

export interface SnapshotLike {
  version: string
  byCode: Record<string, string>
  byCom: Record<string, string>
  bySci: Record<string, string>
  reportAs?: Record<string, string>
}

export interface EntryLike { code: string; sci: string; com: string; retired?: boolean; form?: string }
export interface EventLike {
  kind: 'split' | 'lump'
  year: number
  published: string
  before: EntryLike[]
  after: EntryLike[]
  slashes: EntryLike[]
}
export interface HistoryLike {
  v: number
  snapshot: string
  generated: string
  inputs: string[]
  updates: { year: number; published: string }[]
  coverage: { earliest: { year: number; published: string }; latest: { year: number; published: string } } | null
  events: EventLike[]
  renames: RenameLike[]
}
export interface RenameLike {
  kind: 'rename'
  year: number
  published: string
  before: EntryLike[]
  after: EntryLike[]
  slashes: EntryLike[]
}
/** One covered update's rename printout (schema.md 4.5). */
export interface RenameReport {
  year: number
  kept: number
  leftOut: number
  excluded: number
  cited: RenameRow[]
  awaiting: RenameRow[]
  annotatedWithoutRename: { newCode: number; onEvent: number; equalUnderCutoff: number; nameUnchanged: number; joinsNoSpecies: number }
}
export interface HistoryReport {
  renames: RenameReport[]
  keptForms: { traced: number; survivor: number; noForm: number }
}

export function previousUpdate(year: number, withoutUpdate?: readonly number[]): number
export function parseCsv(text: string): string[][]
export function changeTokens(cell: string): string[]
export function splitSubject(text: string): string | null
export function binomials(text: string): Set<string>
export function sentenceNaming(text: string, sci: string): string | null
export function tally(events: readonly EventLike[]): { gained: number; lost: number }
export function recountedTally(events: readonly EventLike[], recounts?: readonly Recount[], label?: string): { gained: number; lost: number }
export function deriveHistory(input: {
  files: { name: string; text: string }[]
  snapshot: SnapshotLike
  generated: string
  published?: Record<number, PublishedRow>
  withoutUpdate?: readonly number[]
  recounts?: Readonly<Record<number, readonly Recount[]>>
  renamesUnannotated?: Readonly<Record<number, readonly RenameRow[]>>
  renamesAwaitingSource?: Readonly<Record<number, readonly RenameRow[]>>
}): { history: HistoryLike; report: HistoryReport }
export function keptFormFor(code: string, lumpedCode: string, snapshot: SnapshotLike, snapSpecies: ReadonlySet<string>): string | null
export function checkHistory(history: HistoryLike, snapshot: SnapshotLike): true
