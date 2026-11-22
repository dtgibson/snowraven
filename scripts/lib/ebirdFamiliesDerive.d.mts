// Types for ebirdFamiliesDerive.mjs, so the frontend guards
// (familiesAsset.test.ts, familiesGenerator.test.ts) import the generator's
// pure core and its shared checker with types.

import type { SnapshotBundle, TaxonLike } from './ebirdTaxonomyDerive.mjs'

/** [genusName, [lcName, epithet, ...]] or [genusName, [...], genusCommonName]. */
export type GenusTuple = [string, string[]] | [string, string[], string]
/** [familyCode, familyComName, familySciName, living, genera]. */
export type FamilyTuple = [string, string, string, number, GenusTuple[]]
/** [orderName, orderCommonName, families]. */
export type OrderTuple = [string, string, FamilyTuple[]]

export interface FamiliesAsset {
  v: number
  version: string
  orders: OrderTuple[]
  extinct: string[]
}

export interface FamilyFloors { families: number; orders: number; genera: number }

export interface FamilyOptions {
  orderNames?: Readonly<Record<string, string>>
  leftUnnamed?: readonly string[]
  floors?: FamilyFloors
}

export type SnapshotLike = Pick<SnapshotBundle, 'version' | 'byCom' | 'bySci' | 'byOrder' | 'byCode'>

export type FamilyPlan =
  | { violations: string[]; asset?: undefined; json?: undefined }
  | { violations: []; asset: FamiliesAsset; json: string }

export const FAMILIES_ASSET_VERSION: 2
export const FAMILIES_GZIP_MAX_BYTES: number
export const FAMILY_CODE_SHAPE_RE: RegExp
export const FAMILY_COM_MAX: number
export const FAMILY_SCI_MAX: number
export const ORDER_MAX: number
export const GENUS_MAX: number
export const EPITHET_MAX: number
export const SPECIES_NAME_MAX: number
export const ORDER_COMMON_MAX: number
export const GENUS_COMMON_MAX: number
export const MIN_FAMILIES: number
export const MIN_ORDERS: number
export const MIN_GENERA: number
export const FAMILY_FLOORS: Readonly<FamilyFloors>
export const ORDER_COMMON_NAMES: Readonly<Record<string, string>>
export const GENUS_PLURAL_EXCEPTIONS: readonly { readonly suffix: string; readonly plural: string; readonly firstWord?: boolean }[]
export const GENUS_LEFT_UNNAMED: readonly string[]

export function pluralOfGroupWord(word: string): string
export function genusCommonName(genus: string, speciesCommonNames: readonly string[], leftUnnamed?: readonly string[]): string
export function liveFamilyViolations(taxonomy: readonly TaxonLike[], options?: FamilyOptions): string[]
export function deriveFamilies(taxonomy: readonly TaxonLike[], options: FamilyOptions & { version: string }): FamiliesAsset
export function familyTallyViolations(taxonomy: readonly TaxonLike[], asset: FamiliesAsset): string[]
export function checkFamilies(asset: unknown, snapshot: SnapshotLike, options?: FamilyOptions & { json?: string }): string[]
export function genusNames(asset: unknown): Map<string, string>
export function genusNameReport(asset: FamiliesAsset, committedText: string | null): string[]
export function planFamilies(taxonomy: readonly TaxonLike[], snapshot: SnapshotLike, options?: FamilyOptions): FamilyPlan
