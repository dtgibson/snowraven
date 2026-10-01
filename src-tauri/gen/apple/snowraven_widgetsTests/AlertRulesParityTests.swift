// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts QA-22 to QA-28, QA-34, QA-25, QA-21: the Swift AlertsLogic
// reproduces every family the TypeScript twin generated into
// alertRules.fixture.json, from the same inputs (distances to 1e-6 mi). Plus
// the structural rules (CLAUDE.md, "an agreeing wrong number"): a body with a
// malformed record yields the candidates of the body without it, and a merge
// is order-independent as a set.

import XCTest

final class AlertRulesParityTests: XCTestCase {
    func testTheConstantsAreTheTwinsConstants() {
        let c = AlertFixture.object("constants")
        XCTAssertEqual(c["dedupeDays"] as? Int, AlertRules.dedupeDays)
        XCTAssertEqual(c["retentionDays"] as? Int, AlertRules.retentionDays)
        XCTAssertEqual(c["maxRows"] as? Int, AlertRules.maxRows)
        XCTAssertEqual(c["positionMaxAgeHours"] as? Int, AlertRules.positionMaxAgeHours)
        XCTAssertEqual(c["futureSkewHours"] as? Int, AlertRules.futureSkewHours)
        XCTAssertEqual(c["radiusMin"] as? Int, AlertRules.radiusMin)
        XCTAssertEqual(c["radiusMax"] as? Int, AlertRules.radiusMax)
        XCTAssertEqual(c["radiusDefault"] as? Int, AlertRules.radiusDefault)
        XCTAssertEqual(c["quietDefaultStart"] as? Int, AlertRules.quietDefaultStart)
        XCTAssertEqual(c["quietDefaultEnd"] as? Int, AlertRules.quietDefaultEnd)
        XCTAssertEqual(c["hourlySeconds"] as? Int, AlertRules.hourlySeconds)
        XCTAssertEqual(c["dailySeconds"] as? Int, AlertRules.dailySeconds)
        XCTAssertEqual(c["pendingMax"] as? Int, AlertRules.pendingMax)
        XCTAssertEqual(c["linkMaxLength"] as? Int, DeepLink.maxLength)
        XCTAssertEqual(c["alertLinkPattern"] as? String, AlertLink.pattern)
    }

    func testEveryCandidatesCaseMatches() {
        let rows = AlertFixture.family("candidates")
        XCTAssertGreaterThanOrEqual(rows.count, 4)
        for r in rows {
            let name = r["name"] as! String
            guard let records = RecentObsReducer.reduce(body: AlertFixture.bodyData(r["body"]!)) else {
                return XCTFail("\(name): the body did not reduce")
            }
            let got = Candidates.candidates(records: records, recorded: r["recorded"] as! [String],
                                            point: AlertFixture.coordinate(r["point"]!), lists: AlertFixture.lists)
            assertHitsEqual(got, AlertFixture.decode(r["expected"]!), name)
        }
    }

    func testQA22CandidatesAreExactlyCAndD() {
        let qa22 = AlertFixture.family("candidates").first { $0["name"] as? String == "qa22" }!
        let records = RecentObsReducer.reduce(body: AlertFixture.bodyData(qa22["body"]!))!
        let got = Candidates.candidates(records: records, recorded: qa22["recorded"] as! [String],
                                        point: AlertFixture.coordinate(qa22["point"]!), lists: AlertFixture.lists)
        XCTAssertEqual(Set(got.map(\.speciesCode)), ["ruff", "sabgul"])
    }

    /// Structural: each malformed record the reducer drops leaves QA-22's
    /// candidates exactly as they were.
    func testAMalformedRecordChangesNoCandidate() {
        let qa22 = AlertFixture.family("candidates").first { $0["name"] as? String == "qa22" }!
        let body = qa22["body"] as! [Any]
        let recorded = qa22["recorded"] as! [String]
        let point = AlertFixture.coordinate(qa22["point"]!)
        let baseRecords = RecentObsReducer.reduce(body: AlertFixture.bodyData(body))!
        let base = Candidates.candidates(records: baseRecords, recorded: recorded, point: point, lists: AlertFixture.lists)
        let malformed = AlertFixture.family("malformed")
        XCTAssertGreaterThanOrEqual(malformed.count, 5)
        var unrowable = 0
        for m in malformed {
            let name = m["name"] as! String
            let with = RecentObsReducer.reduce(body: AlertFixture.bodyData(body + [m["record"]!]))!
            // The `unrowable-` records survive the reducer, so the candidate
            // filter is what drops them (security review L5).
            if name.hasPrefix("unrowable-") {
                unrowable += 1
                XCTAssertEqual(with.count, baseRecords.count + 1, "\(name): the reducer keeps it")
            }
            let got = Candidates.candidates(records: with, recorded: recorded, point: point, lists: AlertFixture.lists)
            assertHitsEqual(got, base, name)
        }
        XCTAssertGreaterThanOrEqual(unrowable, 12)
    }

    func testEveryCheckPipelineMatches() {
        let rows = AlertFixture.family("checks")
        XCTAssertGreaterThanOrEqual(rows.count, 7)
        for r in rows {
            let name = r["name"] as! String
            let point = AlertFixture.coordinate(r["point"]!)
            let radius = r["radiusMi"] as! Int
            let place = AlertFixture.phrase(r["place"]!)
            let records = RecentObsReducer.reduce(body: AlertFixture.bodyData(r["body"]!))!
            let cands = Candidates.candidates(records: records, recorded: r["recorded"] as! [String], point: point,
                                              lists: AlertFixture.lists)
            let ctx = CheckContext(now: AlertFixture.date(r["nowIso"] as! String), checkId: r["checkId"] as! String,
                                   point: point, radiusMi: radius, place: place, ids: r["ids"] as! [String])
            let (outRows, hits) = AlertsInbox.applyCandidates(AlertFixture.decode(r["rows"]!), cands, ctx)
            let expected = r["expected"] as! [String: Any]
            XCTAssertEqual(hits.map(\.speciesCode), expected["hits"] as! [String], name)
            assertInboxRowsEqual(outRows, AlertFixture.decode(expected["rows"]!), name)
            if hits.isEmpty {
                XCTAssertTrue(expected["title"] is NSNull, name)
            } else {
                XCTAssertEqual(NotificationText.title(count: hits.count, phrase: place), expected["title"] as? String, name)
                XCTAssertEqual(NotificationText.body(namesNearestFirst: hits.map(\.comName)), expected["body"] as? String, name)
                XCTAssertEqual(AlertLink.build(speciesCode: hits[0].speciesCode, locId: hits[0].locId, point: point,
                                               radiusMi: radius, show: .all), expected["link"] as? String, name)
            }
            // Every row the pipeline wrote passes the document's own validator.
            XCTAssertTrue(outRows.allSatisfy(\.isValid), name)
        }
    }

    func testEveryMergeMatchesAndIsOrderIndependentAsASet() {
        for r in AlertFixture.family("merge") {
            let name = r["name"] as! String
            let pending: PendingSummary? = r["pending"] is NSNull ? nil : AlertFixture.decode(r["pending"]!)
            let hits: [PendingHit] = AlertFixture.decode(r["hits"]!)
            let first = r["first"] as! [String: Any]
            let got = QuietHours.mergePending(pending, hits: hits, firstWindowEndAt: first["windowEndAt"] as! String,
                                              firstPlace: AlertFixture.phrase(first["place"]!), checkId: r["checkId"] as! String)
            XCTAssertEqual(got, AlertFixture.decode(r["expected"]!) as PendingSummary, name)
            if let p = pending {
                // The union of species is the same whichever check came first.
                let swapped = QuietHours.mergePending(
                    PendingSummary(windowEndAt: p.windowEndAt, place: p.place, hits: hits, checkIds: []), hits: p.hits,
                    firstWindowEndAt: p.windowEndAt, firstPlace: p.place, checkId: r["checkId"] as! String)
                XCTAssertEqual(Set(swapped.hits.map(\.speciesCode)), Set(got.hits.map(\.speciesCode)), name)
            }
        }
    }

    func testTheHoldIsTheBoundedRetryAfter() {
        let rows = AlertFixture.family("retryAfter")
        XCTAssertGreaterThanOrEqual(rows.count, 10)
        for r in rows {
            let header = r["header"] as? String
            let now = AlertFixture.date(r["nowIso"] as! String)
            XCTAssertEqual(WidgetTime.string(AlertRules.holdUntil(now: now, retryAfter: header)), r["expected"] as? String,
                           "\(String(describing: header))")
        }
    }

    func testDistKmIsTheHandlersRounding() {
        let rows = AlertFixture.family("distKm")
        XCTAssertEqual(rows.count, AlertRules.radiusMax)
        for r in rows { XCTAssertEqual(AlertRules.distKm(radiusMi: r["radiusMi"] as! Int), r["distKm"] as! Int) }
        // The widget's own constant is the same computation at 25.
        XCTAssertEqual(AlertRules.distKm(radiusMi: 25), WidgetCache.distKm)
    }

    func testEveryFetchResultMapsToItsOutcome() {
        for r in AlertFixture.family("outcome") {
            let name = r["name"] as! String
            let fetch = r["fetch"] as! [String: Any]
            let result: FetchResult
            switch fetch["kind"] as! String {
            case "ok": result = .ok(AlertFixture.bodyData(fetch["body"]!))
            case "status": result = .status(fetch["code"] as! Int, retryAfter: fetch["retryAfter"] as? String)
            case "offline": result = .offline
            case "timeout": result = .timeout
            case "tooLarge": result = .tooLarge
            default: return XCTFail(name)
            }
            let got = AlertRules.outcome(RefreshEngine.decode(result))
            XCTAssertEqual(got?.rawValue ?? "ok-body", r["expected"] as? String, name)
        }
    }

    /// The request the check makes: the app's own URL shape, one day back,
    /// the chosen radius, and the widget's URL untouched by the new parameters.
    func testTheRequestIsTheAppsNearbySightingsRequest() {
        let c = Coordinate(lat: 38.5449, lng: -121.7405)
        XCTAssertEqual(EBirdRequest.urlString(for: c, distKm: 11, backDays: 1),
                       "https://api.ebird.org/v2/data/obs/geo/recent?lat=38.54490&lng=-121.74050&dist=11&back=1&fmt=json")
        XCTAssertEqual(EBirdRequest.urlString(for: c),
                       "https://api.ebird.org/v2/data/obs/geo/recent?lat=38.54490&lng=-121.74050&dist=40&back=30&fmt=json")
        let r = EBirdRequest.make(for: c, key: "abc123", distKm: 2, backDays: 1)!
        XCTAssertEqual(r.value(forHTTPHeaderField: "X-eBirdApiToken"), "abc123")
        XCTAssertEqual(r.httpMethod, "GET")
    }
}
