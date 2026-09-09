# Bug Brief — BirdingStats species-name taxon-code lookups

## What is broken

`BirdingStats.tsx` builds `normTaxon` as a plain `{}` and resolves codes with bare
species-name indexes:

```ts
const codeFor = (name: string) =>
  mlTaxonMap[name] ?? normTaxon[normalizeSpeciesName(name)]
```

Both keys originate in the user's CSV and are unvalidated. A missing name such
as `__proto__`, `constructor`, or `toString` therefore resolves through
`Object.prototype` instead of returning `undefined`. The normalized accumulator
also has an unsafe write side: assigning its `__proto__` key on `{}` invokes the
inherited setter rather than creating an own string property. This is
prototype-chain confusion and an unsafe accumulator, not demonstrated prototype
pollution or code injection.

This is pre-existing behavior, deliberately excluded from the v1.0.22 Weather
feature build. There are currently 14 direct shipped `codeFor(...)` invocations
in `BirdingStats.tsx` (plus four prop pass-throughs). Top Species and Frivolous
Lists reach the accessor whenever Statistics renders, so this is not merely a
latent helper defect.

## Minimal reproduction

The failing shape is executable without React:

```js
const normalizeSpeciesName = name => name
const emptyCodes = JSON.parse('{}')
const normTaxon = {}
const codeFor = name =>
  emptyCodes[name] ?? normTaxon[normalizeSpeciesName(name)]

codeFor('__proto__') === Object.prototype // true
/^[a-z0-9-]{2,16}$/.test(String(codeFor('__proto__'))) // false
```

The probe also confirmed that a storage-shaped hostile key must be constructed
with parsed JSON:

```js
Object.hasOwn(JSON.parse('{"__proto__":"own-code"}'), '__proto__') // true
Object.hasOwn({ __proto__: 'own-code' }, '__proto__')               // false
```

The object literal is not a valid substitute: JavaScript treats `__proto__`
specially there and creates no own property.

## Expected behavior and in-scope repair

A missing species name, including every `Object.prototype` member name, returns
`undefined`. A legitimate own raw or normalized key still returns its taxon
code.

Keep this repair confined to the `mlTaxonMap` / `normTaxon` code-resolution seam
in `BirdingStats.tsx`:

- construct `normTaxon` with `Object.create(null)` so external normalized names
  cannot collide on write;
- make `codeFor` use `Object.hasOwn` at both the raw `mlTaxonMap` read and the
  normalized `normTaxon` read, preserving raw-name-first resolution;
- make the existing `buildCoverIndex(... norm => normTaxon[norm])` read own-only
  as well (or route it through an equivalent own-only accessor). This is another
  read of the same in-scope table, not a provenance redesign.

Do not change taxonomy batching: the raw-name-plus-normalized-parent request
behavior pinned by `BirdingStatsTaxonomyBatch.test.tsx` must remain intact.

## User impact and blast radius

On the always-rendered Top Species and Frivolous Lists paths, the leaked object
or function is passed to `SpeciesLinks`. Its `SPECIES_CODE_RE` guard rejects the
coerced value, so the external eBird/Birds of the World icons disappear while
the bird text and internal Species Detail action remain. The observed outcome
is a missing link, not a tab crash.

Three conditional Media ranking links also pass `codeFor` to `mlCatalogUrl`,
which has no code-shape gate. If a hostile ML species name ranks, the inherited
value becomes a live but malformed Macaulay Library filter such as
`taxonCode=%5Bobject%20Object%5D`. The direct `normTaxon` read used to build the
exotic-provenance cover index can likewise admit an object/function as a runtime
Map key despite its TypeScript string type. Both effects share the same table
and are closed by the repair above; neither justifies changing URL construction
or provenance behavior in this run.

## Required hostile-key coverage

Extend `BirdingStatsPrototypeNames.test.tsx` or add a focused twin without
weakening its existing `sciByNorm` coverage. The fixture must include:

- missing `__proto__`, `constructor`, and `toString` names, proving raw and
  normalized reads return `undefined`, normal code lookup still works, and no
  malformed external link is rendered;
- an own `__proto__` taxon-code entry created with
  `JSON.parse('{"__proto__":"own-code"}')`, first asserting with
  `Object.hasOwn` that the fixture really owns the key, then proving that the
  legitimate code resolves;
- an own normalized hostile key flowing through the real accumulator, proving
  it is retained rather than swallowed by the inherited setter;
- an explicit pollution probe proving `Object.prototype` gains no property;
- source-level pins for the null-prototype accumulator and each deliberately
  redundant `Object.hasOwn` read, since removing only one protection can leave
  behavior tests green.

The existing taxonomy-batch test stays green and unchanged.

## Adjacent debt — explicitly out of scope

This run does **not** close the broader species-name lookup family. In
particular, do not absorb `normTaxonOrder` / `orderFor`, Species Detail, Named
Birds, Checklists, Life List, Map Explorer, Breeding Codes, List Comparer,
`useCountyCompleteness`, or their consumer-side taxonomy maps. Those bare-index
sites are separately tracked in `ROADMAP.md`; closing this brief must not claim
that roadmap sweep is complete.

## Version, docs, and release implications

This is a release-worthy shipped-behavior and production-bundle change, not a
test-only change. Because this is a Spool build, this per-feature checkpoint
must not bump a version, create a release, or deploy independently. The Spool
flush/deploy pass applies one shared patch stamp in parity across
`frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and
`website/index.html`, then releases the consolidated bundle once.

No HELP, README, product-documentation, or privacy-policy edit is warranted:
the fix restores missing/bad links for malformed hostile names, adds no feature,
does not change normal-data UI, and changes no provider, network schedule, or
privacy behavior.

## What done looks like

- Missing prototype-chain names resolve to `undefined` on raw, normalized, and
  cover-index reads; real own properties, including parsed-JSON `__proto__`,
  still resolve.
- `normTaxon` has no prototype, every in-scope external-string read is own-only,
  and `Object.prototype` remains unmodified.
- Top Species and Frivolous Lists render normally with hostile CSV names and do
  not expose inherited values; Media rankings cannot build a malformed
  `taxonCode` from one.
- Focused hostile-key coverage, existing `sciByNorm` prototype-name coverage,
  `BirdingStatsTaxonomyBatch.test.tsx`, typecheck, lint, and production build are
  green.
- The four release-parity files carry the same new patch version, while the
  adjacent taxonomy-lookup roadmap debt remains open and accurately described.
