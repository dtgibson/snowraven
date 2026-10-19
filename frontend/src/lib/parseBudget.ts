// The eBird parse's silence budget (the parse watchdog in observationsCache.ts).
//
// How long a healthy parse is allowed to take before the worker is presumed dead.
//
// A worker that dies without dispatching `error` — an OOM kill, a crash — gives the
// main thread NO event to settle on, so the only remaining evidence of death is
// silence, and silence has to be bounded by a clock. The bound scales with the input
// because the thing being waited on does: a budget right for a 1 MB export would fire
// on a healthy 100 MB one, and firing on a slow-but-healthy parse would be a worse
// bug than the hang it replaces.
//
// Measured on the tracked demo export and multiples of it (Node 24 / V8, quiet
// machine): 57-75 million characters per second — 13 to 18 ms per megabyte, flat
// across 1.4 MB, 6.8 MB and 27 MB, so the parse is linear in the input and the
// allowance can be too. The allowance below is 4 SECONDS per megabyte, roughly 250x
// slower than measured. That clears the slowest device this app ships to (a Pi's
// browser, an older iPhone's WKWebView) by a wide margin even with the heap under GC
// pressure, and still turns an unbounded hang into a bounded failure: ~34 s for the
// demo export, ~56 s for the 6.6 MB reference export, ~10 min for a 148 MB one.
// The floor covers worker spawn, module evaluation and the structured clone of the
// request on a busy device — none of which scale with the file.
//
// big-old-life-lists re-measured it for the packed parse, which interns every
// string through a Map as it goes: 7.5 s for 277 Mchar in JavaScriptCore, about
// 0.027 us per character, so the allowance is still about 150x the slowest
// engine on this Mac. The formula is unchanged and moved here unchanged from
// observationsCache.ts, which arms the parse watchdog with it, so the stats
// budget's ceiling can be DERIVED from it at each platform's upload cap
// (`statsOffThread.ts`) instead of restating a number, without importing the
// parse cache's module state.
const PARSE_BUDGET_FLOOR_MS = 30_000
const PARSE_BUDGET_MS_PER_CHAR = 0.004

export function parseBudgetMs(chars: number): number {
  return PARSE_BUDGET_FLOOR_MS + chars * PARSE_BUDGET_MS_PER_CHAR
}
