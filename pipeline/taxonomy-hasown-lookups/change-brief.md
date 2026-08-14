# Change Brief — taxonomy-hasown-lookups

## What is changing
`frontend/src/lib/tauri/taxonomyService.ts` gains `Object.hasOwn` guards at every bare
object-literal read keyed by an external string (house pattern: `shareCopyPreference.ts:84`).
Eight reads, re-derived from code: `cache.bySci[sciLower]` + `cache.byCom[comLower]` (L246),
`cache.byOrder[comLower]` (L248), `byComAll[comLower]` (L252) — lowercased CSV-derived names;
`cache.reportAs[c]` (L288 eBird region-species codes; L308 eBird checklist codes) and
`cache.byCode[norm]` / `cache.byCode[c]` (L309) — eBird-API-derived codes. Exempt, reasons
in-code: `cache.byCode[parent]` (L291 — key validated by `speciesSet.has`); map-construction
writes in `fetchTaxonomyOnline`/`byComAllFor` (keys are eBird's own published names/codes;
the bundled-snapshot path is a build-time trust boundary, v0.5.89). Secondary, same hostile-key
class: returned accumulators `codes`/`orders`/`formCodes` (L247/249/253) and `out` (L310) become
`Object.create(null)` + point-of-use comment — a `__proto__` key otherwise silently drops its
entry, and for `out` (object values) swaps the returned map's prototype. Guard rewrites must
preserve the exact `??` (L246) and `||` (L309 empty-comName fallthrough) semantics.

## Why now
Flagged by the v0.5.89 audit (ROADMAP.md "On the Horizon"): the exact class the v0.5.81 rule
exists to prevent — a CSV-derived name like `constructor` returns a truthy inherited
Object.prototype member and takes the wrong branch. Pre-existing, untouched by v0.5.89; flagged
mainly because v0.5.89's new code follows the rule correctly, so a reader would assume this
module already does. Picked from The Spool; ships in the 2026-08-14 bundle (build 4 of 4).

## User-facing impact
Default: none. Behavior changes only for the twelve `Object.prototype` member names, which are
not bird names, scientific names, or eBird codes; every real name resolves byte-identically
(the `codes`/`orders` byte-identity constraint holds — a guarded read returns the identical
value for every own key). The defect being fixed is low-impact: values are
`encodeURIComponent`-wrapped downstream, so the failure is a malformed favicon request or a
corrupted `resolveSpecies` entry on a hostile CSV, not injection. Invisible hardening — the
bundle release notes carry it only as such; no version bump or CHANGELOG in this build.
Out of scope: backend twin, bundled snapshot, `formCodes` semantics, all UI, and consumer-side
lookups over the returned maps (a separate sweep; the null-proto returns incidentally close
the desktop half, web-path `JSON.parse` responses do not).

## Design pass
Not needed — no visual change.

## Decisions touched
- v0.5.81 `Object.hasOwn` allowlist-lookup rule (CLAUDE.md, Security): applied, not changed.
- v0.5.89 audit item (ROADMAP.md "On the Horizon"): consumed by this task.
- `codes`/`orders` byte-identity for favicons/sort (media-catalog-taxon-links): preserved;
  proven by the existing parity tests plus the new discriminating cases.
- Shared-fixture twin convention ("extend `taxonomyCollapse.fixture.json`, not a per-transport
  ad-hoc test"): followed — one hostile-name row runs through BOTH twins.
- Backend twin `backend/routers/taxonomy.py`: NOT touched and needs no change — it reads via
  Python `dict.get()`, and Python dicts have no prototype chain, so the class does not exist
  there. The parity question is answered, not skipped.
- v0.5.89 build-time-asset trust boundary: grounds the snapshot-construction exemptions.

## What done looks like
This module's tests + `npm run typecheck` + both taxonomy parity tests
(`taxonomyCollapse.parity.test.ts`, `backend/tests/test_taxonomy_collapse_parity.py`) green;
full suite at bundle flush. New tests per v0.5.81: all twelve prototype-member names in the
malformed-input corpus (hostile `commonName` AND hostile `scientificName` separately through
`getTaxonomyCodes`, plus `resolveSpecies` and `collapseToSpeciesList`), a `JSON.parse`-built
`__proto__` pollution probe (never an object literal), and each guard pinned per consumer so
reverting any one bare index goes red — except `reportAs` at L288, where no prototype name
discriminates (`speciesSet.has` absorbs both branches): guard it for the module sweep, say so
in-code, and name the tests that do discriminate. Scaffolding exists in
`taxonomyService.floor.test.ts` (real snapshot) and the parity test (fixture snapshot).
