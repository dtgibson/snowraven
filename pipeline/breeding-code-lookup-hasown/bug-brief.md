# Bug Brief: Breeding-code lookup hasOwn

## What is broken
`apiBreedingToDisplay` (`frontend/src/lib/breedingCodes.ts:59`) reads `API_BREEDING_TO_DISPLAY[apiCode] ?? apiCode` on an ordinary object literal, so all twelve inherited-member names return a function or `Object.prototype` instead of the raw string (measured 12 of 12).
`__proto__` crashes the app: `BreedingBadge` (`components/ChecklistComparer.tsx:43-57`) renders `def.code` as a child, React throws "Objects are not valid as a React child", and with no boundary below `RootErrorBoundary` the whole app becomes "Something went wrong" (Reload recovers).
The other eleven do not crash: the row renders an EMPTY Possible-colored pill whose accessible name and tooltip read as JavaScript source, e.g. "function toString() { [native code] }: function toString() { [native code] }".
Key source is the eBird API only (`obsAux` breeding_code, both transports). The CSV `Breeding Code` column never reaches this table. Premise held: one bare read, one table.

## Steps to reproduce
1. Serve the Checklist Comparer a checklist whose observation carries breeding code `__proto__` (in a test: mock `transport.get` with a `JSON.parse`d `ChecklistData` whose species `breedingCode` is `"__proto__"`).
2. Open List Comparer, Checklists mode, enter both checklist IDs, press Compare checklists.
3. The whole app falls to the root "Something went wrong" screen.
4. Repeat with `constructor` (or any of the other ten): the row renders, but its pill is blank and is announced as native-code source text.

## Expected behavior
Any code that is not an OWN key of the table passes through unchanged as a string and takes the existing unknown-code fallback (tier 1, label equal to the raw code), exactly as `ZZ` does today: pill reads the code, name reads `<code>: <code>`.
Known codes are untouched (measured controls: `S1` to `S`, `FY` to `CF` tier 4, `S7` to `S7` tier 2).

## Blast radius
One table, one read: `API_BREEDING_TO_DISPLAY` is read only at `breedingCodes.ts:59`; `resolveApiBreedingCode` and `strongerBreeding` (no production caller) inherit the fix, and the only shipped consumer is the comparer's `BreedingBadge`.
Every other breeding-code lookup is a `Map` (`BREEDING_CODE_MAP`, `BREEDING_RANK`, atlas `RANK`/`META`) or keyed by a fixed category literal; CSV codes are gated by `BREEDING_CODE_MAP.has` before any object write. No sibling table shares the defect.
Out of scope, measured harmless: `computeBreedingBreakdown`'s plain `counts = {}` accumulator (`lib/speciesStats.ts:96`) takes CSV codes, but all twelve names come out dropped (`[]`) because only `BREEDING_CODE_MAP` members survive. Write-side rule shape, no observable defect; its own idea if wanted.
Backend twin (`backend/services/ebird.py:311-314`) is a Python dict pass-through with no prototype hazard. Comparer results are never persisted, so nothing replays the bad code after Reload.

## What done looks like
`apiBreedingToDisplay` reads `Object.hasOwn(API_BREEDING_TO_DISPLAY, apiCode) ? API_BREEDING_TO_DISPLAY[apiCode] : apiCode` at the point of use, with a comment naming the house rule; the table stays an ordinary literal (no null-prototype rewrite).
`breedingCodes.test.ts`: all twelve names return themselves as strings through `apiBreedingToDisplay` and `resolveApiBreedingCode`, plus a `JSON.parse('{"__proto__":{"XX":"NY"}}')` probe asserting `XX` still passes through as `XX`.
`ChecklistComparer.test.tsx`: each of the twelve, served as a `JSON.parse`d payload under jsdom, renders the row with a pill reading the raw code and accessible name `<code>: <code>`, and nothing throws.
Mutation check: restore the bare `[apiCode] ?? apiCode` read and every new row goes red (`__proto__` by the render throw, the other eleven by type and name).
