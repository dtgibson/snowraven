# taxonomy-hasown-lookups

## What this does

Invisible hardening of `frontend/src/lib/tauri/taxonomyService.ts` per the v0.5.81
allowlist-lookup rule (CLAUDE.md, Security; house reference `shareCopyPreference.ts`),
consuming the v0.5.89 audit item. Two changes, no user-visible behavior change for any
real bird name, scientific name, or eBird code:

1. **Eight untrusted-key reads gain `Object.hasOwn` guards at the point of use** —
   `bySci`/`byCom`/`byOrder`/`byComAll` (lowercased CSV-derived names in
   `getTaxonomyCodes`) and `reportAs`/`byCode` (eBird-API-derived codes in
   `collapseToSpeciesList` and `resolveSpecies`). Previously a name/code that is an
   `Object.prototype` member (e.g. `constructor`) returned a truthy inherited member
   and took the wrong branch (a function-valued "code" reaching favicon URLs, a
   corrupted `resolveSpecies` entry). The guard rewrites preserve the exact original
   fallthroughs: the `??` chain in `getTaxonomyCodes` and the deliberate `||` in
   `resolveSpecies` (an own `byCode` entry with an empty comName still falls through —
   pinned by a test). One read is deliberately left bare with its reason in code:
   `cache.byCode[parent]` in the collapse, whose key passed `speciesSet.has` and is
   therefore allowlist-validated by membership.

2. **The four returned accumulators become null-prototype objects**
   (`codes`/`orders`/`formCodes` in `getTaxonomyCodes`, `out` in `resolveSpecies`).
   On a plain `{}`, a key of `__proto__` hits the inherited setter: a string/number
   value is silently dropped, and `out`'s object value would silently swap the
   returned map's prototype. All consumers were verified to read these maps with
   bare indexing / `?? {}` / `Object.entries` / spread (zero `.hasOwnProperty`-style
   method calls on them repo-wide), so a null prototype is behaviorally invisible.

Out of scope, per the change brief: the backend twin (`routers/taxonomy.py` reads via
`dict.get()` — Python dicts have no prototype chain, so the class does not exist
there), the bundled snapshot and the `fetchTaxonomyOnline`/`byComAllFor` construction
writes (eBird-published keys; build-time trust boundary, v0.5.89), `formCodes`
semantics, all UI, and consumer-side lookups over the returned maps.

## How to test

Bundle-scope gates (all run green under `set -o pipefail`, statuses echoed):

```
cd frontend && npx vitest run \
  src/lib/tauri/taxonomyService.floor.test.ts \
  src/lib/tauri/taxonomyService.hostileKeys.test.ts \
  src/lib/tauri/taxonomyService.pollutionProbe.test.ts \
  src/lib/taxonomyCollapse.parity.test.ts        # 36 passed, exit 0
cd frontend && npm run typecheck                  # exit 0
cd backend && .venv/bin/python -m pytest tests/test_taxonomy_collapse_parity.py -q
                                                  # 9 passed, exit 0
```

**Hostile-name proof recipe** (reproduces the defect the guards close): revert one
guard to a bare index — e.g. change
`(Object.hasOwn(cache.byCom, comLower) ? cache.byCom[comLower] : undefined)` back to
`cache.byCom[comLower]` — and re-run the vitest command above. Expected: exit 1 with 7
failures across 3 files, including the `constructor` row in the shared parity fixture
(the TS twin mints a function-valued code; the Python twin, run on the same fixture,
stays green because it is immune by construction). Equivalent reverts were executed
and confirmed red for the `byOrder` guard (5 failures) and for the `out` accumulator
(`Object.create(null)` → `{}`: 4 failures, the prototype-swap class). Restore and the
suite returns to 36/36.

## Notes for reviewer

- **Test placement follows the shared-fixture convention**: the hostile-name row is
  ONE new entry in `taxonomyCollapse.fixture.json` (`formCodesCases.input`:
  `commonName`/`scientificName` both `constructor`, expected maps unchanged), so both
  parity twins exercise it with zero test-code changes on either side.
- **New test files**: `taxonomyService.hostileKeys.test.ts` (the twelve
  `Object.prototype` member names pinned member-by-member with a runtime coverage
  check, both name axes and both code paths, per-guard revert-discrimination cases,
  accumulator and `||`/`??` fallthrough pins) and
  `taxonomyService.pollutionProbe.test.ts` (a `JSON.parse`-built snapshot carrying
  real own `__proto__` data keys — never an object literal, which the language
  special-cases — proving the guards' hasOwn-true branch is byte-identical for
  genuine own keys, and uniquely pinning the `orders` accumulator).
  `taxonomyService.floor.test.ts` additionally runs the corpus against the REAL
  bundled snapshot.
- **One guard is documented as non-discriminable**: the collapse's `reportAs` read.
  A bare index there yields a truthy inherited member that `speciesSet.has` rejects
  exactly as it rejects the raw string, so both implementations drop the row; the
  in-code comment says so and names the tests that do discriminate (v0.5.89
  convention: state which surfaces are unguarded and why).
- **A lowercasing nuance worth knowing**: `getTaxonomyCodes` lowercases both name
  axes before its reads, and only `constructor` and `__proto__` are all-lowercase
  prototype members — so on the name paths those two (plus case variants like
  `Constructor`, covered by a test) are the discriminating rows; the other ten of
  the twelve still assert no-match. The code paths (`resolveSpecies`,
  `collapseToSpeciesList`) do not lowercase, so there all twelve discriminate.
- **`codes`/`orders` byte-identity holds**: guarded reads return the identical value
  for every own key; the pre-existing parity and floor tests plus the extended
  fixture prove it on both transports.
- Tailwind corpus check (CLAUDE.md v0.5.85): every bare utility-shaped word the new
  comments introduce (`lowercase`, `collapse`, `transparent`) already exists in the
  HEAD scan corpus, so no new CSS rule can be emitted by these test files.
- No version bump, no CHANGELOG: invisible hardening in the 2026-08-14 bundle
  (build 4 of 4), carried in the bundle release notes only.
