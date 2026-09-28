// The eBird COUNTY region-code shape, ONE definition (targets-tab, schema.md
// section 1.2): "US-CA-001" -- the country, the two-letter state, and the
// three-digit county FIPS.
//
// Before this module the same literal lived in three places
// (`countyCompletenessCache.ts`'s key guard, `tauri/mapService.ts`'s route
// guard, `countyBoundaries.ts`'s derivation) and this feature needs it in four
// more: a region code now becomes a FILE NAME on both transports
// (`data/barcharts/<regionCode>.txt`), a store key (`county-day-obs-v1`), a
// query parameter on the new `/map/county-day-obs` route, and a manifest key.
// Single-sourcing prevents the copies DRIFTING; it does nothing to prevent one
// being DROPPED, so every consumer keeps its own test (security.md, the v0.5.88
// per-consumer rule).
//
// Explicit `[0-9]`, never `\d` (JavaScript's `\d` is ASCII-only, but the
// Python twins spell the same class and pydantic's Rust engine reads `\d` as
// Unicode digits, v0.5.54). Anchored, and JavaScript's `$` never matches before
// a trailing newline, so `"US-CA-001\n"` is refused here by construction. The
// class cannot express a path separator, a dot, a percent sign or a scheme,
// which is what makes it safe as a path segment and in a URL.
//
// Dependency-free, so it is safe anywhere, the entry chunk included.

export const REGION_CODE_RE = /^US-[A-Z]{2}-[0-9]{3}$/

/** True when `code` is a US county region code in the one accepted shape. */
export function isRegionCode(code: unknown): code is string {
  return typeof code === 'string' && REGION_CODE_RE.test(code)
}
