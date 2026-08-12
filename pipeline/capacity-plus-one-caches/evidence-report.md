# Capacity Plus One Cache Evidence

## Verdict

The root-cause sweep found one production defect: both process-lifetime
Nominatim coordinate caches grew without a bound. They now share a 4,096-entry,
fill-and-stop admission policy. The two durable FIFO stores remain FIFO because
their capacity+1 work is small, bounded, and attached to unavoidable external
I/O; changing them to admission would discard the newest offline data. No
eviction was invented in `storage.ts`, and persisted styles remain unchanged
because their shipped caller graph is finite even though the helper API accepts
arbitrary strings.

## Inventory

| Owner | Real caller | Key domain / bound | Miss cost | Evidence and decision |
|---|---|---:|---|---|
| `countyCompletenessCache.ts` | `useCountyCompleteness` → `dedupedFetch` → `/map/county-species` | Strict 250 entries; 4,000,000 `JSON.stringify(data).length` code-unit budget with one sole oversized newest entry allowed; 30-day TTL | One eBird county-species request, then one debounced whole-document settings write | Keep FIFO. At an actually full seeded 250-entry store, capacity+1 performs one loader, one 250-slot `indexOf`, one 250-slot `shift`, one eviction, and one 250-entry snapshot. The newcomer survives and is an immediate hit. Payload-length-budget+1 likewise evicts only the oldest. The length budget excludes keys, metadata, order, and document-envelope overhead; it is not a total retained-byte bound. |
| `replayStore.ts` | `CachedTransport.getReplayable` for weather, tide, and checklist GETs | Strict 300 entries; 3,000,000 `JSON.stringify(data).length` code-unit budget with one sole oversized newest entry allowed | The live network request has already completed before `put`; persistence is debounced and best-effort | Keep FIFO. At an actually full seeded 300-entry store, capacity+1 performs one 300-slot `indexOf`, one 300-slot `shift`, one eviction, and one 300-entry snapshot. FIFO is the product contract: preserve the newest last-loaded response for offline replay. The length budget excludes keys, metadata, order, and document-envelope overhead; it is not a total retained-byte bound. |
| `storage.ts` | The two stores above plus persisted-style I/O | No independent key set, `Map`, `Set`, count cap, byte cap, or eviction loop | Disk or `/settings/{key}` I/O only | Not a cache owner. Structural inventory coverage prevents it from being counted as a third evicting cache. |
| `persistedStyle.ts` | `SnowMap` | Helper API accepts arbitrary strings; shipped `VectorVariant` domain is `positron | liberty`, and the shipped caller currently requests only `positron` | One style-file/settings read per requested string and at most one background style fetch per requested string per session | No production change. Across the shipped caller graph, domain+1 is necessarily a repeat and performs only two seam reads. |
| `tauri/nominatimService.ts` | Tauri `transport.post('/nominatim/counties')`, reached by Life List ML county resolution | Was unbounded; now admits first 4,096 rounded coordinate keys | One serial Nominatim reverse call, rate-limited to at most one start per second | Bound with admission control. Existing hits and cached nulls remain hits after overflow; the overflow result is returned but not retained. |
| `backend/routers/nominatim.py` | Web/Pi `POST /nominatim/counties`, same Life List call | Same 4,096-entry policy | Same Nominatim reverse call under the shared one-second lock | Same admission policy and cap, guarded by source-parity coverage. |

## Why the FIFO stores did not change

The earlier memo-cache failure was CPU-only normalization: FIFO at capacity+1
turned every cheap lookup into a miss plus eviction. These two stores are not
that shape.

- County completeness misses are eBird requests. A single `Array.shift()` moves
  at most 250 slots; the whole-document snapshot is already a deliberate,
  debounced persistence contract. Admission would leave a newly viewed county
  uncached and make the expensive request recur.
- Replay `put` runs only after a successful live request. Its at-most-300-slot
  bookkeeping cannot amplify network work, while declining the newcomer would
  directly violate the “last loaded” purpose of the offline store.
- Both payload-length-budget probes start from seeded persisted state and assert
  exact `JSON.stringify(data).length` code-unit sums. They do not treat those
  sums as total document bytes. Tests use counters, not elapsed-time ceilings.

The diagnostic recorder is installed only by each module's existing test reset
seam. Normal app sessions keep no counter object or measurement history.

The debounced writes remain best-effort and off the blocking path. If one
storage write stalls across a later debounce window, the stores do not
serialize those two in-flight persistence calls; an older completion could
therefore overwrite the newer durable snapshot. The in-memory mirror stays
current, and this pre-existing slow-write ordering limitation is outside the
Nominatim repair in this retry.

## Why Nominatim uses admission control

Both twins retained one rounded coordinate and county string (including `null`)
for every distinct site ever seen by the process. Life List can submit every
unresolved coordinate in an ML export, and later exports can be disjoint, so the
retained set had no structural ceiling.

FIFO is the wrong bound here. At capacity+1, repeating the same ordered batch
would evict the next coordinate immediately and could reissue every one-second
provider request. Fill-and-stop instead gives these properties:

- retained size never exceeds 4,096;
- the admitted working set never churns;
- every result, admitted or not, is still returned in input order;
- repeated admitted coordinates and overlapping same-key reverse calls issue
  zero duplicate outbound calls;
- cached `null` remains distinguishable from a miss;
- a declined coordinate can retry on a later batch without evicting a hit;
- one shared desktop request-start queue spans forward and reverse calls, and
  the backend retains its shared lock/sleep; every adjacent start remains at
  least one second apart even when public calls overlap.

The committed synthetic ML export is 127,751 bytes with 515 data lines and 10
unique coordinates rounded to four decimals. The 4,096-entry ceiling is 409.6x
that observed working set, while still making process-lifetime retention finite.
This corpus is evidence of headroom, not a claim that user exports are capped.

## Deterministic probes

- Frontend Nominatim exercises the production cap plus one (4,097 distinct
  coordinates) through `reverseGeocodeCounties`, then repeats all 4,096 admitted
  keys, retries the declined key, and rechecks the first admitted key.
- Backend runs the same real exported API with a lowered test cap of four. The
  admission branch is identical; lowering the mutable module constant avoids
  manufacturing more than an hour of required one-second sleeps.
- Both twins cover rounded-coordinate deduplication, last-value/first-position
  result order, county hits, cached nulls from non-OK and thrown requests, and
  more-unique-than-cap behavior. Positive and negative half-step fixtures lock
  backend rounding to JavaScript `Math.round` semantics.
- The frontend overlaps three calls across forward and reverse public paths,
  records request starts under a fake clock, and proves every interval is at
  least 1,000 ms. It also proves a rejected request cannot poison the queue and
  two overlapping same-key reverse batches share one outbound call. A reset
  isolation test proves an older in-flight response cannot mutate fresh cache
  or limiter state. Backend asserts one `sleep(1.0)` per outbound reverse
  request.
- Reachability smokes lock the Tauri transport POST delegation and registered
  FastAPI POST route. A structural parity test extracts the Tauri cap, compares
  it with the backend constant, and requires the Tauri fill-and-stop condition.

## Focused verification

- Frontend inventory/capacity/parity suite: 7 files, 71 tests passed.
- Backend Nominatim suite: 9 tests passed with the established Starlette warning.
- Full backend regression: 197 tests passed with one existing Starlette warning.
- Frontend TypeScript project check: passed.
- Touched frontend ESLint: passed.
- Touched backend Ruff: passed.
- `git diff --check`: passed.

No public API, transport routing, response shape, persisted document shape,
TTL, durable-store cap, provider URL, or UI behavior changed.
