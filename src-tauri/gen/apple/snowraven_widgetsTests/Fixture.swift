// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// The shared parity fixture (ios-lifer-widgets, schema.md section 7):
// frontend/src/lib/widgets/widgetRows.fixture.json, GENERATED from the
// TypeScript twin by widgetRows.fixtureGen.test.ts and bundled into this test
// target as a resource reference (not a copy). Every Swift assertion that
// compares against it is the cross-runtime parity claim.

import Foundation
import XCTest

struct Fixture: Decodable {
    struct Request: Decodable { let radiusMi: Int; let distKm: Int; let backDays: Int; let url: String }
    struct Constants: Decodable {
        let handoverMaxBytes: Int; let maxSetEntries: Int; let maxNameUnits: Int; let maxKeyLen: Int; let recordMaxString: Int
    }
    struct Expected: Decodable {
        let lifers: [String: [WidgetRow]]
        let targets: [String: [String: [WidgetRow]]]
    }
    struct DistanceRow: Decodable { let lat1: Double; let lng1: Double; let lat2: Double; let lng2: Double; let miles: Double; let text: String }
    struct FormatRow: Decodable { let miles: Double; let text: String }
    struct DateRow: Decodable { let s: String; let valid: Bool; let y: Int?; let m: Int?; let d: Int? }
    struct DstRow: Decodable { let obsDt: String; let days: Int; let inWeek: Bool; let recency: String }
    struct DstFamily: Decodable { let tz: String; let nowIso: String; let rows: [DstRow] }
    struct RecencyRow: Decodable { let days: Int; let label: String }
    struct RetryRow: Decodable { let header: String?; let seconds: Int? }
    struct FoldRow: Decodable {
        let input: String; let out: String; let validHandoverName: Bool
        enum CodingKeys: String, CodingKey { case input = "in", out, validHandoverName }
    }
    struct NeedsRow: Decodable { let missing: [MediaNeed]; let phrase: String }
    struct LinkBird: Decodable, Equatable { let speciesCode: String; let locId: String }
    struct LinkParsed: Decodable { let view: String; let window: String; let media: String?; let bird: LinkBird? }
    struct LinkRow: Decodable { let raw: String; let expected: LinkParsed? }
    struct Links: Decodable {
        let views: [LinkRow]
        let birds: [LinkRow]
        let degraded: [LinkRow]
        let rejected: [LinkRow]
        let refusedPairs: [LinkBird]
    }

    let tz: String
    let nowIso: String
    let reference: Coordinate
    let request: Request
    let families: [String: Int]
    let constants: Constants
    let handover: Handover
    let expectedReduced: [WidgetRecord]
    let expected: Expected
    let distanceRows: [DistanceRow]
    let formatRows: [FormatRow]
    let dateRows: [DateRow]
    let dstFamily: DstFamily
    let recencyRows: [RecencyRow]
    let retryAfterRows: [RetryRow]
    let foldRows: [FoldRow]
    let needsRows: [NeedsRow]
    let links: Links

    static let url: URL = {
        final class Anchor {}
        guard let u = Bundle(for: Anchor.self).url(forResource: "widgetRows.fixture", withExtension: "json") else {
            fatalError("widgetRows.fixture.json is not in the test bundle")
        }
        return u
    }()

    static let shared: Fixture = {
        do { return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url)) } catch {
            fatalError("could not decode the parity fixture: \(error)")
        }
    }()

    /// The raw eBird body, re-serialized, exactly as the transport would hand it over.
    static let bodyData: Data = {
        let obj = try! JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        return try! JSONSerialization.data(withJSONObject: obj["body"]!)
    }()

    var now: Date { date(nowIso) }
    var timeZone: TimeZone { TimeZone(identifier: tz)! }

    func date(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)!
    }
}

/// Row equality to the fixture's tolerance: distances to 1e-6 mi (the two
/// runtimes' libm may differ in the last ulp), everything else exact.
func assertRowsEqual(_ got: [WidgetRow], _ want: [WidgetRow], _ context: String, file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertEqual(got.count, want.count, "\(context): row count", file: file, line: line)
    for (g, w) in zip(got, want) {
        XCTAssertEqual(g.speciesCode, w.speciesCode, "\(context)", file: file, line: line)
        XCTAssertEqual(g.comName, w.comName, "\(context)", file: file, line: line)
        XCTAssertEqual(g.locId, w.locId, "\(context) \(w.speciesCode)", file: file, line: line)
        XCTAssertEqual(g.locName, w.locName, file: file, line: line)
        XCTAssertEqual(g.distanceMi, w.distanceMi, accuracy: 1e-6, "\(context) \(w.speciesCode)", file: file, line: line)
        XCTAssertEqual(g.distanceText, w.distanceText, "\(context) \(w.speciesCode)", file: file, line: line)
        XCTAssertEqual(g.daysAgo, w.daysAgo, file: file, line: line)
        XCTAssertEqual(g.recency, w.recency, file: file, line: line)
        XCTAssertEqual(g.obsDt, w.obsDt, file: file, line: line)
        XCTAssertEqual(g.subId, w.subId, file: file, line: line)
        XCTAssertEqual(g.missingMedia, w.missingMedia, "\(context) \(w.speciesCode)", file: file, line: line)
        XCTAssertEqual(g.label, w.label, "\(context)", file: file, line: line)
    }
}
