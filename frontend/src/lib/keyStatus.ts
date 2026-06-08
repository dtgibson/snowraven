// The resolved API-key status App.tsx fetches on mount (each key is either the
// stored value or null when absent). Shared so the Weather tab, the comparer's
// Weather & Tide section, and the prop-plumbing in between all reference ONE
// definition instead of re-declaring it and inviting drift.
export type KeyStatus = { ebird: string | null; openweather: string | null }
