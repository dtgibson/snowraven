// Types for gen-demo-data.mjs, so the frontend guard
// (frontend/src/lib/hotspotReportsDemoData.test.ts) imports the generator's
// pure core with types.

export interface DemoLocation {
  readonly name: string
  readonly locId: string
  readonly lat: number
  readonly lng: number
  readonly county: string
  readonly state: string
  readonly coastal: boolean
}

/** The ten public hotspots the demo birder visits. */
export const LOCS: readonly DemoLocation[]
/** The location whose checklists carry the weather blocks. */
export const FRAMED_LOCATION_ID: string
export const FRAMED_LOCATION: DemoLocation
/** The post-pass gives every this-many-th checklist at the framed location a block. */
export const WEATHER_BLOCK_EVERY: number

/** Region code -> the demo location ids in it, sorted. */
export function demoHotspotIdsByRegion(): Record<string, string[]>

export interface DemoDataOptions {
  /** Append weather blocks at the framed location. Default true. */
  weather?: boolean
  /** Default FRAMED_LOCATION_ID. */
  framedLocationId?: string
}

export interface DemoData {
  ebirdCsv: string
  mlCsv: string
  summary: {
    ebirdRows: number
    species: number
    checklists: number
    mlRows: number
    weatherBlocks: number
    framedLocation: string
  }
}

export function buildDemoData(options?: DemoDataOptions): DemoData
