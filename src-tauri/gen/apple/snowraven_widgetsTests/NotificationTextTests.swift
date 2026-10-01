// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts FR-29, FR-30, QA-28: the title counts and names the place, the
// body names up to three species nearest first and "and N more", a long name
// is kept whole, and no code, favicon or link reaches the text.

import XCTest

final class NotificationTextTests: XCTestCase {
    func testEveryNotificationRowMatches() {
        let rows = AlertFixture.family("notification")
        XCTAssertGreaterThanOrEqual(rows.count, 5)
        for r in rows {
            let phrase = AlertFixture.phrase(r["phrase"]!)
            XCTAssertEqual(NotificationText.title(count: r["count"] as! Int, phrase: phrase), r["title"] as? String)
            XCTAssertEqual(NotificationText.body(namesNearestFirst: r["names"] as! [String]), r["body"] as? String)
        }
    }

    func testTheSingularAndThePhrases() {
        XCTAssertEqual(NotificationText.title(count: 1, phrase: .name("Davis")), "1 lifer reported near Davis")
        XCTAssertEqual(NotificationText.title(count: 3, phrase: .nearYou), "3 lifers reported near you")
        XCTAssertEqual(NotificationText.title(count: 2, phrase: .nearby), "2 lifers reported nearby")
        XCTAssertEqual(NotificationText.body(namesNearestFirst: ["A", "B", "C", "D", "E"]), "A, B, C and 2 more")
        XCTAssertEqual(NotificationText.body(namesNearestFirst: ["A", "B", "C"]), "A, B, C")
    }

    func testNoTextCarriesAnEmDash() {
        for r in AlertFixture.family("notification") {
            for key in ["title", "body"] { XCTAssertFalse((r[key] as! String).contains("\u{2014}")) }
        }
    }
}
