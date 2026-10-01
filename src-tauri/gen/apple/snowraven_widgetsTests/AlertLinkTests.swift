// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts schema.md 5.1, 5.2: the Swift builder emits the same bytes as the
// TypeScript builder for every fixture row (toFixed's tie rule and a negative
// zero included), degrades to the Day view link exactly where the TypeScript
// side does, never emits a link its own pattern (the parser's regex as text)
// rejects, and stays within the 128-unit bound. The pattern is the TS literal.

import XCTest

final class AlertLinkTests: XCTestCase {
    func testThePatternIsTheParsersPattern() {
        XCTAssertEqual(AlertLink.pattern, AlertFixture.object("constants")["alertLinkPattern"] as? String)
        XCTAssertEqual(DeepLink.maxLength, 128)
    }

    func testEveryLinkRowMatches() {
        let rows = AlertFixture.family("links")
        XCTAssertGreaterThanOrEqual(rows.count, 10)
        var degraded = 0
        for r in rows {
            let bird = r["bird"] as! [String: Any]
            let got = AlertLink.build(speciesCode: bird["speciesCode"] as! String, locId: bird["locId"] as! String,
                                      point: AlertFixture.coordinate(r["point"]!), radiusMi: r["radiusMi"] as! Int,
                                      show: AlertShow(rawValue: r["show"] as! String)!)
            XCTAssertEqual(got, r["expected"] as? String)
            XCTAssertLessThanOrEqual(got.utf16.count, DeepLink.maxLength)
            if got == AlertLink.viewLink { degraded += 1 } else { XCTAssertTrue(AlertLink.matches(got), got) }
        }
        XCTAssertGreaterThan(degraded, 0, "the degrade rows are present")
        XCTAssertLessThan(degraded, rows.count, "and so are the alert rows")
    }

    func testTheLongestInstanceIs117() {
        let s = AlertLink.build(speciesCode: "abcdefghijklmnop", locId: "L123456789012345",
                                point: Coordinate(lat: -12.34567, lng: -123.45678), radiusMi: 25, show: .all)
        XCTAssertEqual(s.utf16.count, 117)
    }

    func testTheMatcherRefusesATrailingNewlineAndReorderedParameters() {
        let ok = "snowraven://map/lifers?window=day&lat=38.54490&lng=-121.74050&r=25&sp=ruff&loc=L1&show=all"
        XCTAssertTrue(AlertLink.matches(ok))
        XCTAssertFalse(AlertLink.matches(ok + "\n"))
        XCTAssertFalse(AlertLink.matches(ok.replacingOccurrences(of: "show=all", with: "show=some")))
        XCTAssertFalse(AlertLink.matches("snowraven://map/lifers?window=day&lng=-121.74050&lat=38.54490&r=25&sp=ruff&loc=L1&show=all"))
    }
}
