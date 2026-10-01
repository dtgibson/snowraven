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
export const YEARS_WITHOUT_UPDATE: readonly number[]
export const INTEGRATED_NAME_RE: RegExp
export const TAXONOMY_NAME_RE: RegExp

export interface SnapshotLike {
  version: string
  byCode: Record<string, string>
  byCom: Record<string, string>
  bySci: Record<string, string>
}

export interface EntryLike { code: string; sci: string; com: string; retired?: boolean }
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
}

export function previousUpdate(year: number, withoutUpdate?: readonly number[]): number
export function parseCsv(text: string): string[][]
export function changeTokens(cell: string): string[]
export function splitSubject(text: string): string | null
export function binomials(text: string): Set<string>
export function tally(events: readonly EventLike[]): { gained: number; lost: number }
export function deriveHistory(input: {
  files: { name: string; text: string }[]
  snapshot: SnapshotLike
  generated: string
  published?: Record<number, PublishedRow>
  withoutUpdate?: readonly number[]
}): { history: HistoryLike }
export function checkHistory(history: HistoryLike, snapshot: SnapshotLike): true
