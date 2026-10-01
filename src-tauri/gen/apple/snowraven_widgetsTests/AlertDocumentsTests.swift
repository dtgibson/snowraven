// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts schema.md 3.1 to 3.4, NFR-04, QA-38: each alert document round
// trips; a planted extra key, a wrong type and every field bound are refused
// (settings then read as the defaults with alerts OFF, state as fresh); the
// inbox is validated PER ROW (a malformed row is dropped and the rest kept),
// and re-sorted and re-capped at read; the settings patch is refused whole on
// any unknown key or bad value.

import XCTest

final class AlertDocumentsTests: XCTestCase {
    private let now = AlertFixture.date("2026-09-30T16:00:00Z")

    private func settingsJSON(_ mutate: (inout [String: Any]) -> Void) -> Data {
        var s = AlertsSettings.defaults(now: now)
        s.enabled = true
        s.fixedPlace = FixedPlace(lat: 38.5449, lng: -121.7405, name: "Davis, CA")
        var obj = try! JSONSerialization.jsonObject(with: s.encoded()!) as! [String: Any]
        mutate(&obj)
        return try! JSONSerialization.data(withJSONObject: obj)
    }

    func testSettingsRoundTripAndExplicitNulls() {
        var s = AlertsSettings.defaults(now: now)
        XCTAssertFalse(s.enabled, "off by default (FR-02)")
        XCTAssertEqual(s.cadence, .hourly)
        XCTAssertEqual(s.radiusMi, 25)
        XCTAssertEqual(s.quietHours, QuietHoursSetting(on: false, startMin: 1320, endMin: 420))
        XCTAssertEqual(s.model, .fixed)
        let data = s.encoded()!
        XCTAssertTrue(String(data: data, encoding: .utf8)!.contains("\"fixedPlace\":null"))
        XCTAssertEqual(AlertsSettings.decode(data), s)
        s.fixedPlace = FixedPlace(lat: 1, lng: 2, name: nil)
        XCTAssertEqual(AlertsSettings.decode(s.encoded()!), s)
    }

    func testEverySettingsRefusalReadsAsAbsent() {
        let rows: [(String, Data)] = [
            ("extra key", settingsJSON { $0["observations"] = [] }),
            ("version 2", settingsJSON { $0["version"] = 2 }),
            ("enabled as a string", settingsJSON { $0["enabled"] = "yes" }),
            ("unknown cadence", settingsJSON { $0["cadence"] = "minutely" }),
            ("radius 0", settingsJSON { $0["radiusMi"] = 0 }),
            ("radius 26", settingsJSON { $0["radiusMi"] = 26 }),
            ("radius decimal", settingsJSON { $0["radiusMi"] = 5.5 }),
            ("start minute 1440", settingsJSON { $0["quietHours"] = ["on": true, "startMin": 1440, "endMin": 420] }),
            ("quiet extra key", settingsJSON { $0["quietHours"] = ["on": true, "startMin": 1, "endMin": 2, "x": 1] }),
            ("latitude 91", settingsJSON { $0["fixedPlace"] = ["lat": 91.0, "lng": 0.0, "name": NSNull()] }),
            ("name over 120 units", settingsJSON { $0["fixedPlace"] = ["lat": 1.0, "lng": 1.0, "name": String(repeating: "a", count: 121)] }),
            ("name with a control", settingsJSON { $0["fixedPlace"] = ["lat": 1.0, "lng": 1.0, "name": "Da\u{0009}vis"] }),
            ("name with edge space", settingsJSON { $0["fixedPlace"] = ["lat": 1.0, "lng": 1.0, "name": " Davis"] }),
            ("place extra key", settingsJSON { $0["fixedPlace"] = ["lat": 1.0, "lng": 1.0, "name": NSNull(), "key": "k"] }),
            ("bad time", settingsJSON { $0["updatedAt"] = "yesterday" }),
            ("oversized", Data(repeating: 0x20, count: AlertsFiles.settingsMaxBytes + 1)),
            ("not json", Data("hello".utf8)),
        ]
        for (name, data) in rows { XCTAssertNil(AlertsSettings.decode(data), name) }
        XCTAssertNotNil(AlertsSettings.decode(settingsJSON { _ in }), "the control document is valid")
        XCTAssertNotNil(AlertsSettings.decode(settingsJSON { $0["fixedPlace"] = ["lat": 1.0, "lng": 1.0, "name": String(repeating: "a", count: 120)] }))
    }

    func testStateRoundTripAndRefusals() {
        var st = AlertsStateDoc.fresh
        st.lastCheck = LastCheck(completedAt: "2026-09-30T16:00:00Z", outcome: .hits, hits: 2, from: .fixed,
                                 checkId: "00000000-0000-4000-8000-000000000100")
        st.holdUntil = "2026-09-30T16:01:00Z"
        st.position = StoredPosition(lat: 38.5, lng: -121.7, at: "2026-09-30T15:00:00Z", source: .seed)
        st.pending = PendingSummary(windowEndAt: "2026-10-01T14:00:00Z", place: .name("Davis"),
                                    hits: [PendingHit(speciesCode: "ruff", comName: "Ruff", locId: "L1", distanceMi: 5.9,
                                                      link: AlertLink.viewLink)],
                                    checkIds: ["00000000-0000-4000-8000-000000000100"])
        XCTAssertEqual(AlertsStateDoc.decode(st.encoded()!), st)
        XCTAssertEqual(AlertsStateDoc.decode(AlertsStateDoc.fresh.encoded()!), .fresh)

        func mutated(_ m: (inout [String: Any]) -> Void) -> Data {
            var o = try! JSONSerialization.jsonObject(with: st.encoded()!) as! [String: Any]
            m(&o)
            return try! JSONSerialization.data(withJSONObject: o)
        }
        let rows: [(String, Data)] = [
            ("extra key", mutated { $0["ebirdKey"] = "abc" }),
            ("unknown outcome", mutated { var l = $0["lastCheck"] as! [String: Any]; l["outcome"] = "offline"; $0["lastCheck"] = l }),
            ("uppercase check id", mutated { var l = $0["lastCheck"] as! [String: Any]; l["checkId"] = "00000000-0000-4000-8000-00000000010A"; $0["lastCheck"] = l }),
            ("hits with no hits", mutated { var l = $0["lastCheck"] as! [String: Any]; l["hits"] = 0; $0["lastCheck"] = l }),
            ("bad hold", mutated { $0["holdUntil"] = "soon" }),
            ("position out of range", mutated { $0["position"] = ["lat": 95.0, "lng": 0.0, "at": "2026-09-30T15:00:00Z", "source": "seed"] }),
            ("pending link not ours", mutated {
                var p = $0["pending"] as! [String: Any]
                p["hits"] = [["speciesCode": "ruff", "comName": "Ruff", "locId": "L1", "distanceMi": 1.0, "link": "https://example.com"]]
                $0["pending"] = p
            }),
            ("unknown refresh", mutated { $0["backgroundRefresh"] = "maybe" }),
        ]
        for (name, data) in rows { XCTAssertNil(AlertsStateDoc.decode(data), name) }
    }

    private func row(_ id: Int, _ code: String, daysAgo: Double) -> InboxRow {
        let at = WidgetTime.string(now.addingTimeInterval(-daysAgo * 86_400))
        return InboxRow(id: String(format: "00000000-0000-4000-8000-%012d", id), checkId: "00000000-0000-4000-8000-000000000001",
                        speciesCode: code, comName: "Name \(id)", locId: "L1", locName: "Place", lat: 38.5, lng: -121.7,
                        obsDt: "2026-09-29 07:00", distanceMi: 1.5, point: InboxPoint(lat: 38.5, lng: -121.7), radiusMi: 25,
                        place: .nearby, alertedAt: at, updatedAt: at)
    }

    func testInboxRoundTripsAndDropsOnlyTheMalformedRow() {
        let good = [row(1, "ruff", daysAgo: 1), row(2, "sabgul", daysAgo: 2)]
        let data = AlertsInbox.encoded(good, now: now)!
        XCTAssertEqual(AlertsInbox.decode(data, now: now), good)

        var obj = try! JSONSerialization.jsonObject(with: data) as! [String: Any]
        var raw = obj["rows"] as! [[String: Any]]
        var bad = raw[0]; bad["speciesCode"] = "Ruff Sp"                       // outside the code class
        var planted = raw[1]; planted["ebirdKey"] = "abc"                      // an extra key
        var typed = raw[1]; typed["radiusMi"] = "25"                           // a wrong type
        raw += [bad, planted, typed, ["not": "a row"]]
        obj["rows"] = raw + ["a string"]
        let d = try! JSONSerialization.data(withJSONObject: obj)
        XCTAssertEqual(AlertsInbox.decode(d, now: now).map(\.id), good.map(\.id), "the rest are kept")
    }

    func testTheInboxIsRecappedAndAgedAtRead() {
        var rows = (0..<250).map { row($0, "sp\($0)", daysAgo: Double($0) * 0.01) }
        rows.append(row(900, "old", daysAgo: 31))
        struct Doc: Encodable { let version = 1; let rows: [InboxRow] }
        let d = try! JSONEncoder().encode(Doc(rows: rows))
        let got = AlertsInbox.decode(d, now: now)
        XCTAssertEqual(got.count, AlertRules.maxRows)
        XCTAssertFalse(got.contains { $0.speciesCode == "old" })
        XCTAssertEqual(got.first?.speciesCode, "sp0", "newest first")
        XCTAssertTrue(AlertsInbox.decode(Data(repeating: 0x20, count: AlertsFiles.inboxMaxBytes + 1), now: now).isEmpty)
    }

    func testThePatchIsAllOrNothing() {
        func p(_ s: String) -> AlertsSettingsPatch? { AlertsSettingsPatch.parse(Data(s.utf8)) }
        XCTAssertEqual(p(#"{"radiusMi":10}"#)?.radiusMi, 10)
        XCTAssertEqual(p(#"{"cadence":"daily","model":"my-location"}"#)?.model, .myLocation)
        XCTAssertEqual(p(#"{"fixedPlace":null}"#)?.fixedPlace, .some(nil))
        XCTAssertEqual(p(#"{"fixedPlace":{"lat":1,"lng":2,"name":"Davis"}}"#)?.fixedPlace, .some(FixedPlace(lat: 1, lng: 2, name: "Davis")))
        XCTAssertEqual(p(#"{"position":{"lat":38.5,"lng":-121.7}}"#)?.position, Coordinate(lat: 38.5, lng: -121.7))
        XCTAssertEqual(p(#"{"quietHours":{"on":true,"startMin":1320,"endMin":420}}"#)?.quietHours,
                       QuietHoursSetting(on: true, startMin: 1320, endMin: 420))
        for bad in [
            #"{"enabled":true}"#, #"{"radiusMi":0}"#, #"{"radiusMi":26}"#, #"{"radiusMi":5.5}"#, #"{"radiusMi":true}"#,
            #"{"radiusMi":"5"}"#, #"{"cadence":"weekly"}"#, #"{"quietHours":{"on":1,"startMin":1,"endMin":2}}"#,
            #"{"quietHours":{"on":true,"startMin":-1,"endMin":2}}"#, #"{"fixedPlace":{"lat":91,"lng":0}}"#,
            #"{"position":{"lat":1}}"#, #"{"radiusMi":10,"extra":1}"#, "[]", "not json", #""radius""#,
        ] {
            XCTAssertNil(p(bad), bad)
        }
    }
}
