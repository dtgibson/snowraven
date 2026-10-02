# Bug Brief — Widget refreshes take turns (widget-refresh-take-turns)

## What is broken
When several placed widgets on the same Measure from choice refresh at the same moment, each sends its own eBird request, so Help's "at most one eBird request in that time" (`docs/HELP.md` "Keeping it current") is false for overlapping refreshes.
Cause: `RefreshEngine.refresh` (`snowraven_widgets/Sources/Logic/RefreshEngine.swift`) reads the area's cache (line 139), finds it not fresh and no hold, then suspends at `await transport.fetch` (line 197) before writing the result (line 204). Swift actors are reentrant at every `await`, so a second refresh of that area runs in that gap, reads the same unwritten cache, and fetches too.
The header's "The actor serializes refreshes, so two widgets refreshing at once make one request between them" (lines 29-30) and `Providers.swift:17` ("one serialized refresh path") are untrue. Every existing etiquette test awaits refreshes one after another with a fake that returns at once, so none ever overlaps.
This closes a recorded accepted gap: DECISIONS.md v1.0.44, "Overlapping refreshes can each ask eBird, and that is accepted as pre-existing (security L2)", and ROADMAP's Widget Measure from residual (1).

## Steps to reproduce
1. Compile `Sources/Logic/*.swift` with a scratch harness whose fake transport suspends 200 ms per request, as a real request does (done on this Mac, outside the repo).
2. Start three refreshes of one area together (`async let`: Nearby Lifers week, Media Targets photo, Nearby Lifers day) against an empty cache.
3. Measured: 3 eBird requests for My location and 3 for Default Location. The same three awaited one after another make 1 request.
On a device: with two or more widgets on one choice, saving the eBird key or Default Location in SnowRaven reloads all of them at once, and each one asks eBird.

## Expected behavior
Within one area, only one eBird request is ever in flight. A refresh that reaches the request point while its area already has a request in flight for the same key and cell sends nothing: it waits for that request and builds its own widget from the same outcome, whether a list, a 429 hold or a failure. N overlapping refreshes therefore make 1 request.
A refresh of the same area with a different key or cell (the key or Default Location changed mid-flight, or the device moved to another cell) waits for the request in flight to finish, then decides from the area as it then stands.
The in-flight marker is set in the same synchronous step as the cache read, with no `await` between them. What waiting refreshes share is the decoded `Fetched` (the reduced list), never the raw body (NFR-02, DenseBodyTests). The two areas do not wait on each other, so a mixed home screen can still send two at once, which is the bound Help states.

## Blast radius
The change is in `RefreshEngine` only. Both widget kinds, all three sizes and both Measure from areas go through `refresh`. `Providers.swift` changes only in its comment. `RefreshEngine.decode` stays static, because Alerts calls it.
The cache document's shape, `cache.json`, the hold-only document and the cross-area 429 hold are unchanged. Alerts runs in the app process, only reads `cache.json` and shares no state with this engine, so it is untouched.
Timeline latency: a refresh that joins waits at most for the one request in flight (20 s timeout). One with a different cell or key can wait for that request and then make its own.
Out of scope: Alerts' own request; anything across processes (the engine is per extension process); a refresh that comes after a failure has settled, which still asks as it does today.
Records to restate at close: DECISIONS v1.0.44's accepted gap, ROADMAP line 59, CLAUDE.md's pacing bullet ("refreshes that overlap can each ask"), `.claude/rules/testing.md` v1.0.44 (2), and the two code comments above. No published copy changes: Help already states the promise, and PRIVACY_POLICY.md, website/privacy.html and appstore/LISTING.md state no request count.

## What done looks like
A new Swift test in `snowraven_widgetsTests` starts overlapping refreshes (`async let`) through a SUSPENDING fake transport (a gate like `AlertsGate`), then counts requests. N overlapping refreshes of one area make 1 request, in each area, for each outcome (ok, 429, offline, 401), and each widget shows that outcome's state. A joiner with a different key or cell asks only after the first request settles, and a mixed home screen makes 2. The test is red on HEAD (3 against 1, measured) and green after.
Existing WidgetCacheTests, WidgetStateTests and DenseBodyTests stay green, run on this Mac's simulator.
