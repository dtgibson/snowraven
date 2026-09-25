// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// QA-18, QA-19, QA-27, QA-29: every state from its condition, and the FR-29
// precedence. Nothing before S6 reads location or makes a request.

import XCTest

final class WidgetStateTests: XCTestCase {
    let h = Fixture.shared.handover

    func testTheTableOfStates() async {
        let rows: [(String, Harness, WidgetKind, WidgetMedia, WidgetState)] = [
            ("S1 absent", Harness(handover: .absent), .lifers, .any, .noHandover),
            ("S2 no key", Harness(handover: .valid(h.with(key: .some(nil)))), .lifers, .any, .noKey),
            ("S3 no backup", Harness(handover: .valid(h.with(backup: false))), .lifers, .any, .noBackup),
            ("S4 no export", Harness(handover: .valid(h.with(export: false))), .targets, .any, .noExport),
            ("S5 nothing missing (Any)", Harness(handover: .valid(h.with(photo: [], audio: [], video: []))), .targets, .any, .nothingMissing),
            ("S5 nothing missing (Photo)", Harness(handover: .valid(h.with(photo: []))), .targets, .photo, .nothingMissing),
            ("S6 no location, no default", Harness(handover: .valid(h.with(defaultLocation: .some(nil))), location: .unavailable), .lifers, .any, .noLocation),
            ("S8 unreachable, no last good", Harness(transport: FakeTransport(fallback: .offline)), .lifers, .any, .unreachable),
            ("S11 key rejected (401)", Harness(transport: FakeTransport(fallback: .status(401, retryAfter: nil))), .lifers, .any, .keyRejected),
            ("S11 key rejected (403)", Harness(transport: FakeTransport(fallback: .status(403, retryAfter: nil))), .lifers, .any, .keyRejected),
            ("list", Harness(), .lifers, .any, .list),
        ]
        for (name, harness, kind, media, want) in rows {
            let m = await harness.refresh(kind, .week, media)
            XCTAssertEqual(m.state, want, name)
            if [.noHandover, .noKey, .noBackup, .noExport, .nothingMissing].contains(want) {
                XCTAssertEqual(harness.locator.calls, 0, "\(name): no location read")
            }
            if want != .list && want != .unreachable && want != .keyRejected {
                XCTAssertEqual(harness.transport.requests.count, 0, "\(name): no request")
            }
        }
    }

    func testS10ZeroRowsInTheWindow() async {
        // Every species in the body is recorded: nothing is a lifer.
        let all = RecentObsReducer.reduce(body: Fixture.bodyData)!.map { SpeciesName.fold($0.comName) }
        let everything = Handover(version: 1, writtenAt: h.writtenAt, appVersion: h.appVersion, ebirdKey: h.ebirdKey,
                                  hasEbirdBackup: true, recorded: Array(Set(all + h.recorded)).sorted(), hasMlExport: false,
                                  targetsMissingPhoto: [], targetsMissingAudio: [], targetsMissingVideo: [],
                                  defaultLocation: h.defaultLocation)
        let m = await Harness(handover: .valid(everything)).refresh(.lifers, .all, .any)
        XCTAssertEqual(m.state, .empty)
        XCTAssertTrue(m.rows.isEmpty)
    }

    func testPrecedence() async {
        // Missing key beats missing backup; missing backup beats no export; S6 beats any fetch.
        var m = await Harness(handover: .valid(h.with(key: .some(nil), backup: false))).refresh(.lifers)
        XCTAssertEqual(m.state, .noKey)
        m = await Harness(handover: .valid(h.with(backup: false, export: false))).refresh(.targets)
        XCTAssertEqual(m.state, .noBackup)
        let s6 = Harness(handover: .valid(h.with(defaultLocation: .some(nil))), location: .unavailable,
                         transport: FakeTransport(fallback: .status(401, retryAfter: nil)))
        m = await s6.refresh(.lifers)
        XCTAssertEqual(m.state, .noLocation)
        XCTAssertEqual(s6.transport.requests.count, 0, "S6 makes no request")
    }

    func testS7TheDefaultLocationCaptionComposesWithTheListAndItsDistances() async {
        let d = DefaultLocation(lat: 37.3, lng: -121.9)
        let harness = Harness(handover: .valid(h.with(defaultLocation: .some(d))), location: .unavailable)
        let m = await harness.refresh(.lifers, .all)
        XCTAssertEqual(m.state, .list)
        XCTAssertTrue(m.usedDefaultLocation)
        let first = m.rows[0]
        XCTAssertEqual(first.distanceMi, Distance.miles(d.lat, d.lng, first.lat, first.lng), accuracy: 1e-9)
        // The request is centred on the Default Location, at the widget's 25 mi, never the saved radius.
        let url = harness.transport.requests[0].url!.absoluteString
        XCTAssertTrue(url.contains("lat=37.30000&lng=-121.90000&dist=40&back=30"))
        let p = WidgetPresentation.make(m, family: .medium, now: Fixture.shared.now, tz: Fixture.shared.timeZone,
                                        locale: Locale(identifier: "en_US_POSIX"))
        XCTAssertEqual(p.footer.first, "From your default location")
    }

    func testS5NamesTheSingleType() {
        XCTAssertEqual(WidgetCopy.message(state: .nothingMissing, kind: .targets, window: .week, media: .photo, lastSuccess: nil),
                       "You already have a photo of every species in your backup.")
        XCTAssertEqual(WidgetCopy.message(state: .nothingMissing, kind: .targets, window: .week, media: .any, lastSuccess: nil),
                       "You already have media for every species in your backup.")
        XCTAssertEqual(WidgetCopy.message(state: .empty, kind: .targets, window: .day, media: .video, lastSuccess: nil),
                       "No species needing video reported within 25 miles today.")
        XCTAssertEqual(WidgetCopy.message(state: .empty, kind: .lifers, window: .all, media: .any, lastSuccess: nil),
                       "No lifers reported within 25 miles in the last 30 days.")
    }
}
