// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// The side tables of the parity fixture (QA-06, QA-07, QA-34 and the name,
// Retry-After and needs-phrase rules): each one pins a Swift function to the
// TypeScript (and, for Retry-After, the Python) function that generated it.

import XCTest

final class SideTableTests: XCTestCase {
    let f = Fixture.shared

    func testDistances() {
        XCTAssertFalse(f.distanceRows.isEmpty)
        for r in f.distanceRows {
            let d = Distance.miles(r.lat1, r.lng1, r.lat2, r.lng2)
            XCTAssertEqual(d, r.miles, accuracy: 1e-6)
            XCTAssertEqual(Distance.format(d), r.text)
        }
    }

    func testOneDecimalFormattingIncludingExactBinaryTies() {
        XCTAssertTrue(f.formatRows.contains { $0.miles == 0.25 && $0.text == "0.3 mi" }, "the fixture must carry a tie row")
        XCTAssertTrue(f.formatRows.contains { $0.miles == 0.04 && $0.text == "0.0 mi" })
        for r in f.formatRows { XCTAssertEqual(Distance.format(r.miles), r.text, "\(r.miles)") }
    }

    func testTheStrictDateParse() {
        for r in f.dateRows {
            let got = ObsDate.parse(r.s)
            if r.valid {
                XCTAssertEqual(got, CivilDate(y: r.y!, m: r.m!, d: r.d!), r.s.debugDescription)
            } else {
                XCTAssertNil(got, r.s.debugDescription)
            }
        }
    }

    func testCalendarDaysOnTheDayAfterSpringForward() {
        let fam = f.dstFamily
        let today = ObsDate.civilDate(of: f.date(fam.nowIso), in: TimeZone(identifier: fam.tz)!)
        for r in fam.rows {
            let days = ObsDate.daysBetween(ObsDate.parse(r.obsDt)!, today)
            XCTAssertEqual(days, r.days, r.obsDt)
            XCTAssertEqual(days >= 0 && days <= WidgetWindow.week.days!, r.inWeek, r.obsDt)
            XCTAssertEqual(ObsDate.recencyLabel(days), r.recency)
        }
    }

    func testRecencyLabels() {
        for r in f.recencyRows { XCTAssertEqual(ObsDate.recencyLabel(r.days), r.label) }
    }

    func testRetryAfterMatchesTheAppAndTheBackend() {
        XCTAssertGreaterThan(f.retryAfterRows.count, 10)
        for r in f.retryAfterRows { XCTAssertEqual(RetryAfter.parseSeconds(r.header), r.seconds, String(describing: r.header)) }
    }

    func testTheNameFoldAndTheSharedNamePredicate() {
        for r in f.foldRows {
            let out = SpeciesName.fold(r.input)
            XCTAssertEqual(out, r.out, r.input.debugDescription)
            XCTAssertEqual(Handover.isValidName(out), r.validHandoverName, r.input.debugDescription)
        }
    }

    func testTheNeedsPhrase() {
        XCTAssertEqual(f.needsRows.count, 7)
        for r in f.needsRows { XCTAssertEqual(WidgetRows.needsPhrase(r.missing), r.phrase) }
    }

    func testTheFifteenLinksAreTheAppsAllowlist() {
        XCTAssertEqual(f.links.views.count, 15)
        var built = Set<String>()
        for k in WidgetKind.allCases {
            for w in WidgetWindow.allCases {
                for m in WidgetMedia.allCases { built.insert(DeepLink.string(kind: k, window: w, media: m)) }
            }
        }
        XCTAssertEqual(built, Set(f.links.views.map(\.raw)))
        for l in f.links.views {
            let e = l.expected!
            let s = DeepLink.string(kind: WidgetKind(rawValue: e.view)!, window: WidgetWindow(rawValue: e.window)!,
                                    media: e.media.flatMap(WidgetMedia.init(rawValue:)) ?? .any)
            XCTAssertEqual(s, l.raw)
            XCTAssertLessThanOrEqual(s.utf16.count, DeepLink.maxLength)
            XCTAssertNotNil(URL(string: s))
        }
    }

    func testTheRequestIsTheAppsRequest() {
        XCTAssertEqual(EBirdRequest.urlString(for: f.reference), f.request.url)
        XCTAssertEqual(WidgetCache.distKm, f.request.distKm)
        XCTAssertEqual(EBirdRequest.backDays, f.request.backDays)
        let r = EBirdRequest.make(for: f.reference, key: "fixtureKey123")!
        XCTAssertEqual(r.url?.host, "api.ebird.org")
        XCTAssertEqual(r.url?.scheme, "https")
        XCTAssertEqual(r.value(forHTTPHeaderField: "X-eBirdApiToken"), "fixtureKey123")
        XCTAssertNil(EBirdRequest.make(for: f.reference, key: "bad key\r\nX: 1"))
    }

    func testTheBoundsAreTheTypeScriptBounds() {
        XCTAssertEqual(AppGroup.handoverMaxBytes, f.constants.handoverMaxBytes)
        XCTAssertEqual(Handover.maxSetEntries, f.constants.maxSetEntries)
        XCTAssertEqual(Handover.maxNameUnits, f.constants.maxNameUnits)
        XCTAssertEqual(Handover.maxKeyLength, f.constants.maxKeyLen)
        XCTAssertEqual(RecentObsReducer.maxStringUnits, f.constants.recordMaxString)
    }
}
