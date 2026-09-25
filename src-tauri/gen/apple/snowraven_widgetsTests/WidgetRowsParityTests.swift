// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// QA-03, QA-11, QA-13, QA-14, QA-15, QA-57, QA-59: the Swift Logic reproduces
// every list the TypeScript twin generated, from the same raw eBird body and
// the same hand-over, byte for byte (distances to 1e-6 mi).

import XCTest

final class WidgetRowsParityTests: XCTestCase {
    let f = Fixture.shared

    func testTheBodyReducesToTheSameRecords() {
        let got = RecentObsReducer.reduce(body: Fixture.bodyData)
        XCTAssertEqual(got, f.expectedReduced)
    }

    func testTheFixtureHandoverIsAValidDocument() {
        let data = try! JSONEncoder().encode(f.handover)
        XCTAssertEqual(HandoverDecoder.decode(data), .valid(f.handover))
    }

    private func rows(_ kind: WidgetKind, _ window: WidgetWindow, _ media: WidgetMedia) -> [WidgetRow] {
        WidgetRows.build(records: f.expectedReduced, handover: f.handover, kind: kind, window: window, media: media,
                         reference: f.reference, now: f.now, tz: f.timeZone)
    }

    func testEveryLifersListMatches() {
        for w in WidgetWindow.allCases {
            assertRowsEqual(rows(.lifers, w, .any), f.expected.lifers[w.rawValue]!, "lifers/\(w)")
        }
    }

    func testEveryTargetsListMatchesUnderEachMediaValue() {
        for m in WidgetMedia.allCases {
            for w in WidgetWindow.allCases {
                assertRowsEqual(rows(.targets, w, m), f.expected.targets[m.rawValue]![w.rawValue]!, "targets/\(m)/\(w)")
            }
        }
    }

    func testTheFamiliesShowTheFirstNRows() {
        XCTAssertEqual(f.families["small"], WidgetFamilySize.small.rowCount)
        XCTAssertEqual(f.families["medium"], WidgetFamilySize.medium.rowCount)
        XCTAssertEqual(f.families["large"], WidgetFamilySize.large.rowCount)
        let all = rows(.lifers, .all, .any)
        XCTAssertGreaterThanOrEqual(all.count, 12)
        let model = WidgetModel(kind: .lifers, window: .all, media: .any, state: .list, rows: all, usedDefaultLocation: false,
                                stale: nil, updatedAt: f.now, lastSuccess: f.now, nextRefresh: f.now)
        for size in WidgetFamilySize.allCases {
            let p = WidgetPresentation.make(model, family: size, now: f.now, tz: f.timeZone, locale: Locale(identifier: "en_US_POSIX"))
            XCTAssertEqual(p.rows.map(\.speciesCode), Array(all.prefix(size.rowCount)).map(\.speciesCode))
        }
    }

    func testAnyIsTheUnionAndItsGlyphsAreThatMembership() {
        for w in WidgetWindow.allCases {
            let any = rows(.targets, w, .any)
            var single: [MediaNeed: Set<String>] = [:]
            for n in MediaNeed.allCases {
                single[n] = Set(rows(.targets, w, WidgetMedia(rawValue: n.rawValue)!).map(\.speciesCode))
            }
            XCTAssertEqual(Set(any.map(\.speciesCode)), single.values.reduce(Set<String>()) { $0.union($1) })
            for r in any {
                XCTAssertEqual(r.missingMedia, MediaNeed.allCases.filter { single[$0]!.contains(r.speciesCode) })
            }
        }
    }

    func testMalformedRecordsChangeNothing() {
        let obj = try! JSONSerialization.jsonObject(with: Data(contentsOf: Fixture.url)) as! [String: Any]
        let body = obj["body"] as! [[String: Any]]
        let families: [(String, ([String: Any]) -> Bool)] = [
            ("no coordinates", { ($0["speciesCode"] as? String) != "rensti" }),
            ("non-numeric latitude", { ($0["speciesCode"] as? String) != "litsti" }),
            ("no species code", { $0["speciesCode"] != nil }),
            ("impossible date", { ($0["speciesCode"] as? String) != "bubsan" }),
        ]
        for (name, keep) in families {
            let with = RecentObsReducer.reduce(body)
            let without = RecentObsReducer.reduce(body.filter(keep))
            XCTAssertEqual(with, without, name)
        }
        // Hostile elements a real body never carries are skipped, not crashed on.
        let hostile: [Any] = body + [NSNull(), 7, "x", [Any](),
            ["speciesCode": "longo", "comName": String(repeating: "x", count: 513), "lat": 37.4, "lng": -122.0, "obsDt": "2026-09-24 08:00"],
            ["speciesCode": "farlat", "comName": "Far", "locId": "L9", "lat": 91, "lng": 0, "obsDt": "2026-09-24 08:00"],
            ["speciesCode": "boollat", "comName": "Bool", "locId": "L9", "lat": true, "lng": 0, "obsDt": "2026-09-24 08:00"]]
        XCTAssertEqual(RecentObsReducer.reduce(hostile), RecentObsReducer.reduce(body))
        XCTAssertNil(RecentObsReducer.reduce(body: Data("{\"not\":\"an array\"}".utf8)))
    }

    func testDistancesAreRecomputedFromTheReference() {
        let moved = Coordinate(lat: f.reference.lat + 0.01, lng: f.reference.lng)
        let a = WidgetRows.build(records: f.expectedReduced, handover: f.handover, kind: .lifers, window: .all, media: .any,
                                 reference: moved, now: f.now, tz: f.timeZone)
        let b = f.expected.lifers["all"]!
        let first = a[0]
        XCTAssertNotEqual(first.distanceMi, b.first { $0.speciesCode == first.speciesCode }!.distanceMi)
    }
}
