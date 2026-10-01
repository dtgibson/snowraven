// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts FR-38, QA-38: row 201 evicts the oldest by alerted time, a row
// 30 days past its alerted time is gone (29 stays), ties order by species code
// then id, and the bound is idempotent (evict(evict(x)) == evict(x)).

import XCTest

final class InboxEvictTests: XCTestCase {
    func testEveryEvictRowMatches() {
        let rows = AlertFixture.family("evict")
        XCTAssertGreaterThanOrEqual(rows.count, 3)
        for r in rows {
            let now = AlertFixture.date(r["nowIso"] as! String)
            let got = AlertsInbox.evict(AlertFixture.decode(r["rows"]!), now: now)
            XCTAssertEqual(got.map(\.id), r["expected"] as! [String], r["name"] as! String)
        }
    }

    func testEvictIsIdempotent() {
        for r in AlertFixture.family("evict") {
            let now = AlertFixture.date(r["nowIso"] as! String)
            let once = AlertsInbox.evict(AlertFixture.decode(r["rows"]!), now: now)
            XCTAssertEqual(AlertsInbox.evict(once, now: now), once)
        }
    }

    func testTheCapIsTwoHundred() {
        let r = AlertFixture.family("evict").first { $0["name"] as? String == "row-201-evicts-oldest" }!
        let rows: [InboxRow] = AlertFixture.decode(r["rows"]!)
        XCTAssertEqual(rows.count, 201)
        let got = AlertsInbox.evict(rows, now: AlertFixture.date(r["nowIso"] as! String))
        XCTAssertEqual(got.count, AlertRules.maxRows)
        let oldest = rows.min { JSText.compare($0.alertedAt, $1.alertedAt) < 0 }!
        XCTAssertFalse(got.contains { $0.id == oldest.id })
    }
}
