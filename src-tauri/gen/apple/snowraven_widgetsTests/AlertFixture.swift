// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// The alert rules parity fixture (ios-alerts, schema.md 8.3):
// frontend/src/lib/alerts/alertRules.fixture.json, GENERATED from the
// TypeScript twin by alertRules.fixtureGen.test.ts and bundled into this test
// target as a resource reference (not a copy). Every assertion against it is
// the cross-runtime parity claim.

import Foundation
import XCTest

enum AlertFixture {
    static let url: URL = {
        final class Anchor {}
        guard let u = Bundle(for: Anchor.self).url(forResource: "alertRules.fixture", withExtension: "json") else {
            fatalError("alertRules.fixture.json is not in the test bundle")
        }
        return u
    }()

    static let root: [String: Any] = {
        guard let obj = try? JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any] else {
            fatalError("could not read the alert parity fixture")
        }
        return obj
    }()

    static func family(_ name: String) -> [[String: Any]] { root[name] as! [[String: Any]] }
    static func object(_ name: String) -> [String: Any] { root[name] as! [String: Any] }

    /// Decode any fixture value through JSONDecoder.
    static func decode<T: Decodable>(_ any: Any, as: T.Type = T.self) -> T {
        let data = try! JSONSerialization.data(withJSONObject: any, options: [.fragmentsAllowed])
        return try! JSONDecoder().decode(T.self, from: data)
    }

    /// An eBird body exactly as the fixture carries it, re-serialized.
    static func bodyData(_ any: Any) -> Data {
        try! JSONSerialization.data(withJSONObject: any, options: [.fragmentsAllowed])
    }

    static func date(_ iso: String) -> Date { WidgetTime.parse(iso)! }

    static var now: Date { date(root["nowIso"] as! String) }
    static var timeZone: TimeZone { TimeZone(identifier: root["tz"] as! String)! }

    static var lists: CountabilityLists {
        let c = object("countability")
        return CountabilityLists(rejects: c["nonCountable"] as! [String], counts: c["countable"] as! [String])
    }

    static func coordinate(_ any: Any) -> Coordinate {
        let o = any as! [String: Any]
        return Coordinate(lat: (o["lat"] as! NSNumber).doubleValue, lng: (o["lng"] as! NSNumber).doubleValue)
    }

    static func phrase(_ any: Any) -> PlacePhrase { decode(any) }
}

/// Hits equal to the fixture's tolerance: distances to 1e-6 mi, the rest exact.
func assertHitsEqual(_ got: [AlertHit], _ want: [AlertHit], _ context: String, file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertEqual(got.map(\.speciesCode), want.map(\.speciesCode), "\(context): species order", file: file, line: line)
    for (g, w) in zip(got, want) {
        XCTAssertEqual(g.comName, w.comName, context, file: file, line: line)
        XCTAssertEqual(g.locId, w.locId, "\(context) \(w.speciesCode)", file: file, line: line)
        XCTAssertEqual(g.locName, w.locName, context, file: file, line: line)
        XCTAssertEqual(g.lat, w.lat, context, file: file, line: line)
        XCTAssertEqual(g.lng, w.lng, context, file: file, line: line)
        XCTAssertEqual(g.obsDt, w.obsDt, context, file: file, line: line)
        XCTAssertEqual(g.distanceMi, w.distanceMi, accuracy: 1e-6, "\(context) \(w.speciesCode)", file: file, line: line)
    }
}

/// Inbox rows equal to the fixture's tolerance.
func assertInboxRowsEqual(_ got: [InboxRow], _ want: [InboxRow], _ context: String, file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertEqual(got.map(\.id), want.map(\.id), "\(context): row ids and order", file: file, line: line)
    for (g, w) in zip(got, want) {
        var gg = g, ww = w
        XCTAssertEqual(g.distanceMi, w.distanceMi, accuracy: 1e-6, "\(context) \(w.speciesCode)", file: file, line: line)
        gg.distanceMi = 0; ww.distanceMi = 0
        XCTAssertEqual(gg, ww, "\(context) \(w.speciesCode)", file: file, line: line)
    }
}
