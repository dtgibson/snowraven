// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// QA-12, QA-21, QA-22, QA-24 to QA-28, QA-51, QA-56: the shared cache and the
// request etiquette, counted on a recording transport over a fake clock.

import XCTest

final class WidgetCacheTests: XCTestCase {
    let f = Fixture.shared

    func testEveryRequestIsTheOneHostWithTheKey_AndNoKeyMeansNoRequest() async {
        let h = Harness()
        _ = await h.refresh()
        XCTAssertEqual(h.transport.requests.count, 1)
        let r = h.transport.requests[0]
        XCTAssertEqual(r.url?.absoluteString.hasPrefix("https://api.ebird.org/v2/data/obs/geo/recent?"), true)
        XCTAssertEqual(r.value(forHTTPHeaderField: "X-eBirdApiToken"), f.handover.ebirdKey)
        let none = Harness(handover: .valid(f.handover.with(key: .some(nil))))
        _ = await none.refresh()
        XCTAssertEqual(none.transport.requests.count, 0)
    }

    func testAFreshCacheServesEveryWindowAndMediaValueWithZeroRequests() async {
        let h = Harness()
        _ = await h.refresh(.lifers, .week)
        XCTAssertEqual(h.transport.requests.count, 1)
        for w in WidgetWindow.allCases {
            let m = await h.refresh(.lifers, w)
            assertRowsEqual(m.rows, f.expected.lifers[w.rawValue]!, "lifers/\(w) from cache")
            for media in WidgetMedia.allCases {
                let t = await h.refresh(.targets, w, media)
                assertRowsEqual(t.rows, f.expected.targets[media.rawValue]![w.rawValue]!, "targets/\(media)/\(w) from cache")
            }
        }
        XCTAssertEqual(h.transport.requests.count, 1, "window and media are local: one request served all 15 lists")
        XCTAssertEqual(h.store.cache?.cell, WidgetCache.cell(for: f.reference), "one cache key for every value")
    }

    func testCellsTheFifteenMinuteTTLAndRecomputedDistances() async {
        let h = Harness()
        _ = await h.refresh()
        // Five minutes later, 0.2 mi away inside the same cell: no request, new distances.
        h.clock.now = f.now.addingTimeInterval(5 * 60)
        let moved = Coordinate(lat: f.reference.lat + 0.0029, lng: f.reference.lng)
        XCTAssertEqual(WidgetCache.cell(for: moved), WidgetCache.cell(for: f.reference))
        h.locator.result = .located(moved)
        let m = await h.refresh(.lifers, .all)
        XCTAssertEqual(h.transport.requests.count, 1)
        XCTAssertNotEqual(m.rows[0].distanceMi, f.expected.lifers["all"]![0].distanceMi)
        // Sixteen minutes after the fetch: a second request.
        h.clock.now = f.now.addingTimeInterval(16 * 60)
        _ = await h.refresh()
        XCTAssertEqual(h.transport.requests.count, 2)
    }

    func testAKeyChangeDiscardsTheCache_ABackupChangeDoesNot() async {
        let h = Harness()
        _ = await h.refresh()
        h.store.handover = .valid(f.handover.with(backup: false).with(backup: true))
        _ = await h.refresh()
        XCTAssertEqual(h.transport.requests.count, 1, "a backup-only change with a fresh cache: zero requests")
        h.store.handover = .valid(f.handover.with(key: .some("otherKey999")))
        _ = await h.refresh()
        XCTAssertEqual(h.transport.requests.count, 2, "a different key: a request even with a fresh cache")
    }

    func testA429KeepsTheLastListMarksItBacksOffAndStoresNoResult() async {
        let h = Harness()
        _ = await h.refresh(.lifers, .all)
        let before = h.store.cache!
        h.clock.now = f.now.addingTimeInterval(20 * 60)
        h.transport.next = [.status(429, retryAfter: "999")]
        let m = await h.refresh(.lifers, .all)
        XCTAssertEqual(h.transport.requests.count, 2, "exactly one request in that refresh")
        XCTAssertEqual(m.state, .list)
        XCTAssertEqual(m.stale, .busy)
        XCTAssertEqual(m.updatedAt, f.date(before.fetchedAt), "marked with the previous fetch time")
        XCTAssertEqual(h.store.cache!.records, before.records, "a 429 is never stored as a result")
        XCTAssertEqual(h.store.cache!.fetchedAt, before.fetchedAt)
        XCTAssertEqual(h.store.cache!.lastFailure?.kind, .rateLimited)
        // Retry-After is capped at 60 s, below the cadence, so the next attempt is the cadence.
        XCTAssertEqual(m.nextRefresh, h.clock.now.addingTimeInterval(RefreshEngine.cadenceSeconds))
        // Inside the backoff window: no request at all.
        h.clock.now = h.clock.now.addingTimeInterval(10 * 60)
        let again = await h.refresh(.lifers, .all)
        XCTAssertEqual(h.transport.requests.count, 2)
        XCTAssertEqual(again.stale, .busy)
    }

    func testOtherFailuresKeepTheListMarkedOffline_OrS8After24Hours() async {
        let h = Harness()
        _ = await h.refresh(.lifers, .all)
        h.clock.now = f.now.addingTimeInterval(30 * 60)
        h.transport.fallback = .offline
        var m = await h.refresh(.lifers, .all)
        XCTAssertEqual(m.state, .list)
        XCTAssertEqual(m.stale, .offline)
        let marked = WidgetPresentation.make(m, family: .small, now: h.clock.now, tz: f.timeZone, locale: Locale(identifier: "en_US_POSIX"))
        XCTAssertTrue(marked.footer.contains("Offline"))
        XCTAssertTrue(marked.footer.contains { $0.hasPrefix("Updated ") }, "a stale small tile still shows its update time")
        // Recency is recomputed against the refresh's now, not frozen at the fetch.
        h.clock.now = f.now.addingTimeInterval(25 * 60 * 60)
        m = await h.refresh(.lifers, .all)
        XCTAssertEqual(m.state, .unreachable)
        XCTAssertEqual(m.lastSuccess, f.now)
        XCTAssertTrue(m.rows.isEmpty)
    }

    func testAnUnusableBodyIsAFailureNotAResult() async {
        let h = Harness(transport: FakeTransport(fallback: .ok(Data("{}".utf8))))
        let m = await h.refresh()
        XCTAssertEqual(m.state, .unreachable)
        XCTAssertNil(h.store.cache)
        let big = Harness(transport: FakeTransport(fallback: .tooLarge))
        let b = await big.refresh()
        XCTAssertEqual(b.state, .unreachable)
    }

    func testTheTimelineAsksAboutThirtyMinutesAhead() async {
        let h = Harness()
        let m = await h.refresh()
        XCTAssertEqual(m.nextRefresh, f.now.addingTimeInterval(30 * 60))
    }

    func testAnHourWithTwoWidgetsOfEachKindMakesAtMostFourRequests() async {
        let h = Harness()
        // Four placed widgets, each refreshing on the 30-minute cadence with a
        // stagger, plus reloads the app might trigger, over one hour.
        let placed: [(WidgetKind, WidgetWindow, WidgetMedia, TimeInterval)] = [
            (.lifers, .week, .any, 0), (.lifers, .day, .any, 7 * 60),
            (.targets, .all, .any, 3 * 60), (.targets, .week, .photo, 11 * 60),
        ]
        var t: TimeInterval = 0
        while t <= 60 * 60 {
            for (k, w, m, offset) in placed where Int(t - offset) % (30 * 60) == 0 && t >= offset {
                h.clock.now = f.now.addingTimeInterval(t)
                _ = await h.refresh(k, w, m)
            }
            t += 60
        }
        XCTAssertLessThanOrEqual(h.transport.requests.count, 4)
        XCTAssertGreaterThanOrEqual(h.transport.requests.count, 2)
    }

    func testTheCacheDocumentRoundTripsAndValidates() {
        let c = WidgetCache(version: 1, keyFingerprint: WidgetCache.fingerprint("fixtureKey123"), cell: WidgetCache.cell(for: f.reference),
                            fetchedAt: "2026-09-24T12:00:00Z", records: f.expectedReduced, backoff: nil, lastFailure: nil)
        XCTAssertEqual(WidgetCache.decode(c.encoded()!), c)
        XCTAssertEqual(c.keyFingerprint.count, 16)
        XCTAssertFalse(String(data: c.encoded()!, encoding: .utf8)!.contains("fixtureKey123"), "the key is never written")
        var bad = c
        bad = WidgetCache(version: 2, keyFingerprint: c.keyFingerprint, cell: c.cell, fetchedAt: c.fetchedAt, records: c.records,
                          backoff: nil, lastFailure: nil)
        XCTAssertNil(WidgetCache.decode(bad.encoded()!))
        XCTAssertEqual(WidgetCache.cell(for: Coordinate(lat: 37.405, lng: -122.005)), CacheCell(lat: 37.41, lng: -122.01, distKm: 40))
    }
}
