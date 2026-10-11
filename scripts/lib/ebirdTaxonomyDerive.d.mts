// Types for ebirdTaxonomyDerive.mjs, so the frontend guards
// (alphaCodesAsset.test.ts, alphaCodesGenerator.test.ts) import the
// generator's pure core and its shared invariant checker with types.

export interface TaxonLike {
  speciesCode?: string
  comName?: string
  sciName?: string
  category?: string
  taxonOrder?: number | string | null
  reportAs?: string
  bandingCodes?: unknown
  comNameCodes?: unknown
  sciNameCodes?: unknown
}

export interface SnapshotMaps {
  bySci: Record<string, string>
  byCom: Record<string, string>
  byOrder: Record<string, number>
  byCode: Record<string, string>
  reportAs: Record<string, string>
}

export interface SnapshotBundle extends SnapshotMaps {
  version: string
  generated: string
}

export interface AlphaCodesAsset {
  v: number
  version: string
  generated: string
  codes: Record<string, string>
}

export const ALPHA_CODES_ASSET_VERSION: 1
export const ALPHA_CODE_RE: RegExp
export const PROTOTYPE_MEMBER_NAMES: readonly string[]
export const MIN_ALPHA_CODE_ENTRIES: number
export const MAX_HYPHENATED_TOKENS: number
export const ALPHA_CODES_GZIP_MAX_BYTES: number
export const REVISION_MESSAGE: string

export function deriveSnapshotMaps(taxonomy: readonly TaxonLike[]): SnapshotMaps
export function deriveBundle(taxonomy: readonly TaxonLike[], meta: { version: string; generated: string }): SnapshotBundle
export function hyphenatedTokenCount(displayedName: string): number
export function nameFormedCodes(displayedName: string): Set<string>
export function entryAlphaCodes(taxon: TaxonLike): string[]
export function deriveAlphaCodes(
  taxonomy: readonly TaxonLike[],
  options: { version: string; generated: string; entryCodes?: (taxon: TaxonLike) => string[] },
): AlphaCodesAsset
export function caseCollisions(taxonomy: readonly TaxonLike[]): string[]
export function hyphenShapeViolations(taxonomy: readonly TaxonLike[]): string[]
export function filterViolations(taxonomy: readonly TaxonLike[], codes: Record<string, string>): string[]
export function checkAlphaCodes(
  asset: unknown,
  options: {
    speciesNames: Iterable<string>
    publishedNames: Iterable<string>
    snapshotVersion: string
    minEntries?: number
  },
): string[]
export function sizeViolations(json: string): string[]
export function snapshotDrift(liveMaps: SnapshotMaps, committed: unknown): string[]

export type TaxonomyRunPlan =
  | { mode: 'stop'; messages: string[] }
  | { mode: 'codes-only' | 'all'; bundle: SnapshotBundle; alphaCodes: AlphaCodesAsset; alphaCodesJson: string }

export function planTaxonomyRun(input: {
  live: readonly TaxonLike[]
  /** The committed snapshot's file text, or null when the file is absent. */
  committed: string | null
  version: string
  generated: string
  minEntries?: number
  entryCodes?: (taxon: TaxonLike) => string[]
}): TaxonomyRunPlan
