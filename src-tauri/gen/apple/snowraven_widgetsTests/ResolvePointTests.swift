// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts FR-10, FR-16 to FR-18, QA-09, QA-15 to QA-17: where a check
// measures from and the first missing precondition, for every fixture row: a
// named, a coordinate and a followed fixed place; no place; the precondition
// order; the 24-hour limit at 23 h and 25 h; the newer of the two sources and
// the app's own on a tie; the denied and restricted permission; a widget cell
// more than 24 h ahead ignored (L4); My location's point rounded to two
// decimals, ties away from zero (L6); a widget cell used only when marked as
// read from the device, so a Default Location fallback or an unmarked (older)
// cell falls through to the app's own position, then the fixed place (L7).

import XCTest

final class ResolvePointTests: XCTestCase {
    private func timed(_ any: Any?) -> TimedPosition? {
        guard let o = any as? [String: Any] else { return nil }
        return TimedPosition(lat: (o["lat"] as! NSNumber).doubleValue, lng: (o["lng"] as! NSNumber).doubleValue,
                             at: Date(timeIntervalSince1970: (o["atMs"] as! NSNumber).doubleValue / 1000))
    }

    /// A cell row carries `source`: "device", "default-location" or null (a
    /// cache written before the widget recorded it).
    private func cell(_ any: Any?) -> WidgetCellReading? {
        guard let t = timed(any), let o = any as? [String: Any] else { return nil }
        return WidgetCellReading(lat: t.lat, lng: t.lng, at: t.at, source: (o["source"] as? String).flatMap(CellSource.init(rawValue:)))
    }

    private func inputs(_ r: [String: Any]) -> PointInputs {
        let i = r["inputs"] as! [String: Any]
        let fixed: FixedPlace? = i["fixedPlace"] is NSNull ? nil : AlertFixture.decode(i["fixedPlace"]!)
        var h: HandoverFacts? = nil
        if let o = i["handover"] as? [String: Any] {
            let d = o["defaultLocation"] is NSNull ? nil : AlertFixture.coordinate(o["defaultLocation"]!)
            h = HandoverFacts(hasKey: o["hasKey"] as! Bool, hasBackup: o["hasBackup"] as! Bool, defaultLocation: d)
        }
        return PointInputs(model: AlertModel(rawValue: i["model"] as! String)!, fixedPlace: fixed, handover: h,
                           position: timed(i["position"]), widgetCell: cell(i["widgetCell"]),
                           location: LocationAuth(rawValue: i["location"] as! String)!,
                           now: AlertFixture.date(r["nowIso"] as! String))
    }

    private func expected(_ any: Any) -> Resolved {
        let o = any as! [String: Any]
        if o["kind"] as! String == "blocked" { return .blocked(AlertBlocked(rawValue: o["blocked"] as! String)!) }
        return .point(AlertFixture.coordinate(o["point"]!), AlertFixture.phrase(o["phrase"]!),
                      CheckFrom(rawValue: o["from"] as! String)!)
    }

    func testEveryResolveRowMatches() {
        let rows = AlertFixture.family("resolve")
        XCTAssertGreaterThanOrEqual(rows.count, 15)
        // L7's three markers are each present (non-vacuity).
        let sources = Set(rows.compactMap { r -> String? in
            guard let c = (r["inputs"] as! [String: Any])["widgetCell"] as? [String: Any] else { return nil }
            return (c["source"] as? String) ?? "null"
        })
        XCTAssertEqual(sources, ["device", "default-location", "null"])
        for r in rows {
            let name = r["name"] as! String
            let want = r["expected"] as! [String: Any]
            let i = inputs(r)
            XCTAssertEqual(ResolvePoint.resolvePoint(i), expected(want["point"]!), name)
            let blocked = want["blocked"] as? String
            XCTAssertEqual(ResolvePoint.resolveBlocked(i)?.rawValue, blocked, name)
        }
    }
}
