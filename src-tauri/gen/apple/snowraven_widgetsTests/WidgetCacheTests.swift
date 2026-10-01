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

    // widget-measure-from-choice: one cache AREA per Measure from choice.
    // My location's is the file Alerts reads; Default Location's is its own.
    func testEachChoiceHasItsOwnAreaSoAlternatingDoesNotRefetch() async {
        XCTAssertEqual(AppGroup.cacheFileName(for: .myLocation), AppGroup.cacheFile)
        XCTAssertEqual(AppGroup.cacheFile, "cache.json")
        XCTAssertNotEqual(AppGroup.cacheFileName(for: .defaultLocation), AppGroup.cacheFile)
        let h = Harness()   // the device at the fixture reference, the Default Location elsewhere
        XCTAssertNotEqual(WidgetCache.cell(for: f.reference),
                          WidgetCache.cell(for: Coordinate(lat: f.handover.defaultLocation!.lat, lng: f.handover.defaultLocation!.lng)))
        _ = await h.refresh(.lifers, .week, .any, .myLocation)
        _ = await h.refresh(.lifers, .week, .any, .defaultLocation)
        XCTAssertEqual(h.transport.requests.count, 2, "one request per area")
        for minute in [2, 5, 9, 14] {
            h.clock.now = f.now.addingTimeInterval(TimeInterval(minute * 60))
            let mine = await h.refresh(.targets, .all, .any, .myLocation)
            let home = await h.refresh(.lifers, .day, .any, .defaultLocation)
            XCTAssertFalse(mine.usedDefaultLocation)
            XCTAssertTrue(home.usedDefaultLocation)
        }
        XCTAssertEqual(h.transport.requests.count, 2, "alternating inside 15 minutes asks eBird again for neither")
        h.clock.now = f.now.addingTimeInterval(16 * 60)
        _ = await h.refresh(.lifers, .week, .any, .myLocation)
        _ = await h.refresh(.lifers, .week, .any, .defaultLocation)
        XCTAssertEqual(h.transport.requests.count, 4)
        XCTAssertEqual(h.store.cache?.cellSource, .device)
        XCTAssertEqual(h.store.defaultCache?.cellSource, .defaultLocation)
    }

    func testAMixedHomeScreenMakesAtMostOneRequestPerAreaEvery15Minutes() async {
        let h = Harness()
        let placed: [(WidgetKind, WidgetWindow, WidgetMedia, WidgetMeasure, TimeInterval)] = [
            (.lifers, .week, .any, .myLocation, 0), (.lifers, .day, .any, .defaultLocation, 2 * 60),
            (.targets, .all, .any, .myLocation, 7 * 60), (.targets, .week, .photo, .defaultLocation, 11 * 60),
        ]
        var times: [String: [TimeInterval]] = [:]
        var t: TimeInterval = 0
        while t <= 2 * 60 * 60 {
            for (k, w, m, measure, offset) in placed where t >= offset && Int(t - offset) % (30 * 60) == 0 {
                h.clock.now = f.now.addingTimeInterval(t)
                let before = h.transport.requests.count
                _ = await h.refresh(k, w, m, measure)
                if h.transport.requests.count > before {
                    let url = h.transport.requests.last!.url!.absoluteString
                    times[url.contains("lat=37.30000") ? "home" : "here", default: []].append(t)
                }
            }
            t += 60
        }
        XCTAssertEqual(Set(times.keys), ["home", "here"])
        for (area, ts) in times {
            for (a, b) in zip(ts, ts.dropFirst()) { XCTAssertGreaterThanOrEqual(b - a, 15 * 60, "\(area): \(ts)") }
        }
    }

    /// A 429 holds the KEY, so the other area makes no request either until it ends.
    func testA429InOneAreaHoldsTheOther() async {
        let h = Harness()
        _ = await h.refresh(.lifers, .all, .any, .myLocation)
        _ = await h.refresh(.lifers, .all, .any, .defaultLocation)
        h.clock.now = f.now.addingTimeInterval(20 * 60)
        h.transport.next = [.status(429, retryAfter: nil)]
        _ = await h.refresh(.lifers, .all, .any, .myLocation)
        XCTAssertEqual(h.transport.requests.count, 3)
        h.clock.now = f.now.addingTimeInterval(25 * 60)
        let held = await h.refresh(.lifers, .all, .any, .defaultLocation)
        XCTAssertEqual(h.transport.requests.count, 3, "no request from the other area inside the hold")
        XCTAssertEqual(held.state, .list)
        XCTAssertEqual(held.stale, .busy)
        XCTAssertEqual(h.store.defaultCache?.lastFailure?.kind, .rateLimited)
        XCTAssertEqual(h.store.defaultCache?.fetchedAt, WidgetTime.string(f.now), "the held area keeps its last good list")
        // The hold ends with the cadence, and each area asks once again.
        h.clock.now = f.now.addingTimeInterval(51 * 60)
        _ = await h.refresh(.lifers, .all, .any, .defaultLocation)
        _ = await h.refresh(.lifers, .all, .any, .myLocation)
        XCTAssertEqual(h.transport.requests.count, 5)
        // A hold recorded under a different key does not hold this one.
        let other = Harness()
        _ = await other.refresh(.lifers, .all, .any, .myLocation)
        other.clock.now = f.now.addingTimeInterval(20 * 60)
        other.transport.next = [.status(429, retryAfter: nil)]
        _ = await other.refresh(.lifers, .all, .any, .myLocation)
        other.store.handover = .valid(f.handover.with(key: .some("otherKey999")))
        _ = await other.refresh(.lifers, .all, .any, .defaultLocation)
        XCTAssertEqual(other.transport.requests.count, 3)
    }

    // Security review L1: the hold must persist when the area that got the
    // 429 had no document yet, or the other area never sees it.
    /// (a) The empty Default Location area gets the 429; My location holds.
    func testA429InAnEmptyDefaultLocationAreaHoldsMyLocation() async {
        let h = Harness()
        _ = await h.refresh(.lifers, .all, .any, .myLocation)
        XCTAssertNil(h.store.defaultCache)
        h.clock.now = f.now.addingTimeInterval(20 * 60)
        h.transport.next = [.status(429, retryAfter: nil)]
        let first = await h.refresh(.lifers, .all, .any, .defaultLocation)
        XCTAssertEqual(h.transport.requests.count, 2)
        XCTAssertEqual(first.state, .unreachable)
        XCTAssertNil(first.lastSuccess)
        let hold = h.store.defaultCache
        XCTAssertEqual(hold?.isHoldOnly, true, "the hold persists in a hold-only document")
        XCTAssertEqual(hold?.cellSource, .defaultLocation)
        XCTAssertEqual(hold?.backoff?.until, WidgetTime.string(h.clock.now.addingTimeInterval(RefreshEngine.cadenceSeconds)))
        h.clock.now = f.now.addingTimeInterval(25 * 60)
        let mine = await h.refresh(.lifers, .all, .any, .myLocation)
        XCTAssertEqual(h.transport.requests.count, 2, "no request from My location inside the hold")
        XCTAssertEqual(mine.stale, .busy)
    }

    /// (b) The mirror: the empty `cache.json` area gets the 429 on its first fetch.
    func testA429InAnEmptyMyLocationAreaHoldsDefaultLocation() async {
        let h = Harness(transport: FakeTransport([.status(429, retryAfter: nil)]))
        let first = await h.refresh(.lifers, .week, .any, .myLocation)
        XCTAssertEqual(h.transport.requests.count, 1)
        XCTAssertEqual(first.state, .unreachable)
        XCTAssertEqual(h.store.cache?.isHoldOnly, true)
        XCTAssertEqual(h.store.cache?.cellSource, .device)
        h.clock.now = f.now.addingTimeInterval(5 * 60)
        let home = await h.refresh(.lifers, .week, .any, .defaultLocation)
        XCTAssertEqual(h.transport.requests.count, 1, "no request from Default Location inside the hold")
        XCTAssertEqual(home.state, .unreachable)
        // The hold ends with the cadence; each area then asks once.
        h.clock.now = f.now.addingTimeInterval(31 * 60)
        _ = await h.refresh(.lifers, .week, .any, .defaultLocation)
        let mine = await h.refresh(.lifers, .week, .any, .myLocation)
        XCTAssertEqual(h.transport.requests.count, 3)
        XCTAssertEqual(mine.state, .list)
        XCTAssertEqual(h.store.cache?.isHoldOnly, false, "a good fetch replaces the hold-only document")
    }

    /// (c) A hold-only document is never a list, never a "Last updated", and
    /// never a device position to Alerts' My location.
    func testAHoldOnlyDocumentIsNeverAListNorADevicePosition() async {
        let h = Harness(transport: FakeTransport([.status(429, retryAfter: nil)], fallback: .offline))
        _ = await h.refresh(.lifers, .week, .any, .myLocation)
        guard let hold = h.store.cache else { return XCTFail("the 429 wrote no document") }
        XCTAssertTrue(hold.isHoldOnly)
        XCTAssertTrue(hold.records.isEmpty)
        XCTAssertEqual(hold.keyFingerprint, WidgetCache.fingerprint(f.handover.ebirdKey!))
        XCTAssertEqual(WidgetCache.decode(hold.encoded()!), hold, "a valid document, read back whole")
        XCTAssertFalse(String(data: hold.encoded()!, encoding: .utf8)!.contains(f.handover.ebirdKey!), "the key is never written")
        let posix = Locale(identifier: "en_US_POSIX")
        // Inside the hold, then past it with eBird unreachable, then a day on:
        // the same "Could not reach eBird." a refresh with no document shows.
        for minutes: Double in [10, 40, 25 * 60] {
            h.clock.now = f.now.addingTimeInterval(minutes * 60)
            let m = await h.refresh(.lifers, .week, .any, .myLocation)
            XCTAssertEqual(m.state, .unreachable, "\(minutes)")
            XCTAssertTrue(m.rows.isEmpty)
            XCTAssertNil(m.lastSuccess)
            XCTAssertNil(m.updatedAt)
            let p = WidgetPresentation.make(m, family: .medium, now: h.clock.now, tz: f.timeZone, locale: posix)
            XCTAssertEqual(p.message, "Could not reach eBird.", "\(minutes)")
            XCTAssertTrue(p.footer.isEmpty)
        }
        let none = await Harness(transport: FakeTransport(fallback: .offline)).refresh(.lifers, .week, .any, .myLocation)
        XCTAssertEqual(none.state, .unreachable)
        XCTAssertNil(none.lastSuccess)
        // Alerts reads `cache.json` exactly this way (AlertsEngine.pointInputs).
        func resolve(_ c: WidgetCache) -> Resolved {
            let cell = WidgetTime.parse(c.fetchedAt).map { WidgetCellReading(lat: c.cell.lat, lng: c.cell.lng, at: $0, source: c.cellSource) }
            return ResolvePoint.resolvePoint(PointInputs(
                model: .myLocation, fixedPlace: nil,
                handover: HandoverFacts(hasKey: true, hasBackup: true, defaultLocation: nil),
                position: nil, widgetCell: cell, location: .granted, now: f.now))
        }
        XCTAssertEqual(resolve(hold), .blocked(.noPosition), "a hold-only cell is never a device position")
        // Non-vacuity: the same cell with a real fetch time an hour ago IS one.
        let read = WidgetCache(version: 1, keyFingerprint: hold.keyFingerprint, cell: hold.cell,
                               fetchedAt: WidgetTime.string(f.now.addingTimeInterval(-3600)), records: [], backoff: nil,
                               lastFailure: nil, cellSource: .device)
        guard case .point(_, _, .myLocation) = resolve(read) else { return XCTFail("the control reading should resolve") }
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

        // ios-alerts L7: where the cell came from. A cache written before the
        // marker existed has no such key and still decodes, unmarked; a marked
        // one round-trips; an unknown value refuses the cache like any other
        // malformed field.
        let legacy = String(data: c.encoded()!, encoding: .utf8)!
        XCTAssertFalse(legacy.contains("cellSource"))
        XCTAssertNotNil(WidgetCache.decode(Data(legacy.utf8)))
        XCTAssertNil(WidgetCache.decode(Data(legacy.utf8))?.cellSource)
        var marked = c
        marked.cellSource = .defaultLocation
        let text = String(data: marked.encoded()!, encoding: .utf8)!
        XCTAssertTrue(text.contains(#""cellSource":"default-location""#), text)
        XCTAssertEqual(WidgetCache.decode(marked.encoded()!), marked)
        XCTAssertNil(WidgetCache.decode(Data(text.replacingOccurrences(of: "default-location", with: "elsewhere").utf8)))
    }
}
