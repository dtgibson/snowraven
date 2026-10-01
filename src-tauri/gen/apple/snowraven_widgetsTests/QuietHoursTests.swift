// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts FR-33, FR-34, QA-33: the quiet predicate over the fixture's
// instants (the midnight span, a daytime window, equal times), the equal-times
// rule over the WHOLE minute domain rather than a sample, and the window end
// through the device calendar, including both US DST nights, London's spring
// forward and Lord Howe's half-hour shift.

import XCTest

final class QuietHoursTests: XCTestCase {
    private let quiet = AlertFixture.object("quiet")

    func testEveryIsQuietRowMatches() {
        let rows = quiet["isQuiet"] as! [[String: Any]]
        XCTAssertGreaterThanOrEqual(rows.count, 10)
        for r in rows {
            let m = r["m"] as! Int, s = r["s"] as! Int, e = r["e"] as! Int
            XCTAssertEqual(QuietHours.isQuiet(m, startMin: s, endMin: e), r["quiet"] as! Bool, "\(m) in \(s)-\(e)")
        }
    }

    func testQA33Instants() {
        XCTAssertTrue(QuietHours.isQuiet(23 * 60 + 30, startMin: 1320, endMin: 420))
        XCTAssertTrue(QuietHours.isQuiet(6 * 60 + 59, startMin: 1320, endMin: 420))
        XCTAssertFalse(QuietHours.isQuiet(7 * 60, startMin: 1320, endMin: 420))
        XCTAssertFalse(QuietHours.isQuiet(21 * 60, startMin: 1320, endMin: 420))
    }

    func testEqualStartAndEndIsNeverQuietAcrossTheWholeDomain() {
        for s in stride(from: 0, through: 1439, by: 7) {
            for m in 0...1439 { XCTAssertFalse(QuietHours.isQuiet(m, startMin: s, endMin: s)) }
        }
    }

    func testEveryWindowEndMatches() {
        let rows = quiet["windowEnd"] as! [[String: Any]]
        XCTAssertGreaterThanOrEqual(rows.count, 8)
        for r in rows {
            let tz = TimeZone(identifier: r["tz"] as! String)!
            let now = AlertFixture.date(r["nowIso"] as! String)
            let got = QuietHours.windowEnd(now, endMin: r["endMin"] as! Int, tz: tz)
            XCTAssertEqual(WidgetTime.string(got), r["expected"] as? String, "\(r["tz"]!) \(r["nowIso"]!)")
            XCTAssertGreaterThan(got, now)
        }
    }

    func testMinuteOfDayIsLocal() {
        let la = TimeZone(identifier: "America/Los_Angeles")!
        XCTAssertEqual(QuietHours.minuteOfDay(AlertFixture.date("2026-09-30T06:30:00Z"), tz: la), 23 * 60 + 30)
        XCTAssertEqual(QuietHours.minuteOfDay(AlertFixture.date("2026-09-30T14:00:00Z"), tz: la), 7 * 60)
    }
}
