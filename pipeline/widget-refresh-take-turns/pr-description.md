## Widget refreshes take turns (widget-refresh-take-turns)

### What this does

When several placed widgets on the same Measure from choice refresh at once (WidgetKit does this after SnowRaven saves the eBird key or Default Location), they now make one eBird request between them instead of one each, which makes Help's "at most one eBird request in that time" true for overlapping refreshes. Each Measure from area now has at most one request in flight. A refresh for the same key and cell joins it and shows the same outcome, whether that is a list, a 429 hold or a failure. A refresh for a different key or cell waits for it and its write, then decides again from the area as written. The two areas never wait on each other, so a mixed home screen still makes at most two.

### How to test

1. On this Mac, with an iOS 17+ simulator (never a device):
   `cd src-tauri/gen/apple && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer PATH=/tmp/xcshim:$PATH xcodebuild test -project snowraven.xcodeproj -scheme snowraven_widgetsTests -destination 'platform=iOS Simulator,name=iPhone 17' -test-timeouts-enabled YES`
2. Expect `** TEST SUCCEEDED **` with 143 tests: 140 that existed before and 3 new ones in `WidgetCacheTests`.
3. To see the fix is real, put HEAD's engine back (`git show HEAD:src-tauri/gen/apple/snowraven_widgets/Sources/Logic/RefreshEngine.swift > <that path>`), run `-only-testing:snowraven_widgetsTests/WidgetCacheTests`, and the three new tests go red. Restore the file afterwards.
4. Frontend guards that read these Swift files: `cd frontend && npx vitest run src/lib/widgetsPublishedClaims.test.ts src/lib/iosWidgetManifest.test.ts src/lib/iosAlertsManifest.test.ts`.

### Notes for reviewer

**The change** is in `RefreshEngine.refresh` only (`snowraven_widgets/Sources/Logic/RefreshEngine.swift`), plus two corrected comments (its header and `Widget/Providers.swift`).

- **Where the turn is taken.** The check is at the request point, after the fresh check and both hold checks. Nothing awaits between the cache read and that point, so deciding and setting the marker happen in one step (`inFlight[measure] = Turn(...)`). This placement means a refresh that doesn't need a request (its own cell is fresh, or a hold is running) never waits on another's.
- **Same key and cell joins.** The refresh waits on a `CheckedContinuation` and gets the decoded `Fetched`, never the body (NFR-02). It then runs the same `switch` as the refresh that asked, except it writes nothing (`joined`). It uses the asking refresh's time (`Turn.at`) for the fetch time it shows and for where a 429 hold counts from, so its widget matches the stored area. Under the real clock the two times can differ by up to the request's length.
- **A different key or cell re-runs the whole refresh** after the turn ends (`return await refresh(...)`), rather than resuming with what it read before. This matters when the key changes mid-flight: the waiter picks up the new key instead of asking with the old one. Cost: a My location refresh that meets a different turn reads the location a second time. The recursion moves on only after a real request settles, so it is bounded by the refreshes in flight.
- **Write before wake.** The refresh that asked ends its turn in a `defer`, after the write. No case awaits today, so a resumed waiter couldn't run before the write anyway. No test can tell the two orderings apart, and the code comment says so rather than implying coverage.
- **Non-settlement.** A waiter waits at most as long as the request it joined. That is bounded by `EBirdRequest.timeoutSeconds` (20 s) and the resource timeout (25 s) in `EBirdClient`. A single refresh had the same exposure before.
- **Unchanged:** the cache document and `cache.json`, the hold-only document, the cross-area 429 hold, `RefreshEngine.decode` (still static; Alerts calls it), and everything in Alerts. A refresh that comes after a failure has settled still asks, as before.

**The tests** extend the existing etiquette suite (`WidgetCacheTests.swift`) and its fakes (`EngineFakes.swift`). There is no new file, so `project.pbxproj` is untouched.

- `testOverlappingRefreshesOfOneAreaMakeOneRequestWhateverItAnswers`: three overlapping refreshes, covering 4 outcomes (list, 429, offline, 401) × 2 areas × 2 starting states (empty, stale). Each makes 1 request, shows the expected state and mark, and equals what the same refresh shows alone (a structural expectation from the same engine). The area also ends up exactly as one refresh leaves it, written once.
- `testARefreshArrivingMidRequestJoinsItOrDecidesAfterItsWrite` covers four cases:
  - the same cell and key, a minute later: joins, with the stored fetch time;
  - another cell: asks only after the first write;
  - another key: asks with the new key, after the first write;
  - another cell after a 429: decides from the written hold and doesn't ask.
- `testAMixedHomeScreenRefreshingAtOnceMakesTwoRequestsInFlightTogether`: both areas' requests are held open at the same time, and the screen makes 2 requests in total.
- **Determinism, never a sleep.** `FakeTransport` holds each request at an `AlertsGate`. The test opens the gate only after an `EngineLog` (a continuation, not polling) has counted every refresh's cache reads. Those reads happen in the same actor section that ends at the join or the request, so the asking refresh can't resume until the last refresh has finished that section. A count taken inside a nonisolated fake's body would not work as this signal, because it may run after the actor is released.
- **`FakeTransport` is now locked**, because overlapping refreshes call `fetch` from several threads at once. Its API is unchanged apart from `requests` becoming get-only (nothing assigned it).
- `WidgetCacheTests` now sets `executionTimeAllowance = 60` in `setUp` for the whole class. This is the backstop for a wait that is never reached; the release skill's `-test-timeouts-enabled YES` arms it.
- Known limitation: `FakeLocator.calls` is not locked. No overlap test asserts on it.

**Red on HEAD** (HEAD's `RefreshEngine.swift` with these tests):

- All 16 combinations of the first test make 3 requests against 1.
- The mixed home screen makes 4 against 2.
- The same-cell joiner makes 2 against 1.
- The different-cell, different-key and after-a-429 cases fail "decides from the area as written", and the 429 case also asks 2 against 1.
- 38 assertion failures in total; the 16 pre-existing `WidgetCacheTests` stay green.

**Per-guard mutations** (each restored byte-identical):

| Mutation | Caught by |
|---|---|
| A joiner uses its own clock | The same-cell row's fetch time |
| Joiners write | "Written once" (list and 429 rows; offline and 401 write nothing either way) |
| Every refresh joins regardless of key or cell | The cell and key rows |
| A different key or cell asks at once | The cell, key and after-a-429 rows |
| One turn shared by both areas | Hangs the mixed home screen; the 60 s allowance fails it |

**Builds and suites:**

- Widget test target: 143 passed, 0 failed (DenseBodyTests 6, WidgetCacheTests 19, WidgetStateTests 8 among them).
- `snowraven_widgets` scheme (extension and `snowraven_iOS` app target), no-op `npm` first on `PATH`, `CODE_SIGNING_ALLOWED=NO`: `** BUILD SUCCEEDED **`. `RefreshEngine.swift` compiled in both targets. The link used the existing `Externals/arm64/debug/libapp.a`, so this proves the Swift compiles, not a runnable app.
- Frontend guards that read the widget sources: 8 files, 153 tests passed.

**Not changed:** `docs/HELP.md` (it already states the promise), and no published copy (`PRIVACY_POLICY.md`, `website/`, `README.md` and `appstore/` state no request count). No version bump or CHANGELOG entry in this build; the bundle owns those.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
