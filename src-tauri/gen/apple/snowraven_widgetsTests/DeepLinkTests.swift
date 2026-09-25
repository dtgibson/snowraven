// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// The bird link (ios-lifer-widgets Stage 8; QA-34): the extension's builder
// against the app's parser table in the shared fixture. Every valid bird row is
// built byte for byte; every pair the app's patterns refuse yields the VIEW link
// (never an out-of-pattern link); rows and the small card carry the bird link,
// and the header and every state carry the view link.

import XCTest

final class DeepLinkTests: XCTestCase {
    let f = Fixture.shared
    let posix = Locale(identifier: "en_US_POSIX")

    private func kind(_ e: Fixture.LinkParsed) -> WidgetKind { WidgetKind(rawValue: e.view)! }
    private func window(_ e: Fixture.LinkParsed) -> WidgetWindow { WidgetWindow(rawValue: e.window)! }
    private func media(_ e: Fixture.LinkParsed) -> WidgetMedia { e.media.flatMap(WidgetMedia.init(rawValue:)) ?? .any }

    func testEveryValidBirdRowIsBuiltExactly() {
        XCTAssertEqual(f.links.birds.count, 18)
        for r in f.links.birds {
            let e = r.expected!
            let bird = e.bird!
            let s = DeepLink.string(kind: kind(e), window: window(e), media: media(e),
                                    speciesCode: bird.speciesCode, locId: bird.locId)
            XCTAssertEqual(s, r.raw)
            XCTAssertLessThanOrEqual(s.utf16.count, DeepLink.maxLength)
            XCTAssertNotNil(URL(string: s))
        }
    }

    /// The enforcement on this side: delete the pattern check and these go red.
    func testEveryRefusedPairYieldsTheViewLinkNeverAnOutOfPatternLink() {
        XCTAssertEqual(f.links.refusedPairs.count, 9)
        for p in f.links.refusedPairs {
            XCTAssertFalse(DeepLink.isLinkable(speciesCode: p.speciesCode, locId: p.locId), "\(p)")
            for k in WidgetKind.allCases {
                let view = DeepLink.string(kind: k, window: .week, media: .video)
                XCTAssertEqual(DeepLink.string(kind: k, window: .week, media: .video, speciesCode: p.speciesCode, locId: p.locId),
                               view, "\(p)")
            }
        }
        // ICU's `$` also matches before a final newline; the whole-length check refuses it.
        XCTAssertFalse(DeepLink.isLinkable(speciesCode: "norcar\n", locId: "L1"))
        XCTAssertFalse(DeepLink.isLinkable(speciesCode: "norcar", locId: "L1\n"))
        XCTAssertFalse(DeepLink.isLinkable(speciesCode: "norcar", locId: "L\u{0661}"))
    }

    /// Whatever this builder emits is one of the fixture's rows the app parses
    /// with the same bird (the degraded family never comes out of this builder).
    func testTheBuilderNeverEmitsADegradedOrRejectedRow() {
        let bad = Set(f.links.degraded.map(\.raw) + f.links.rejected.map(\.raw))
        let codes = ["ab", "norcar", "x-00001", String(repeating: "a", count: 16)]
        let locs = ["L1", "L123456", "L" + String(repeating: "9", count: 15)]
        for k in WidgetKind.allCases { for w in WidgetWindow.allCases { for m in WidgetMedia.allCases {
            for c in codes { for l in locs {
                let s = DeepLink.string(kind: k, window: w, media: m, speciesCode: c, locId: l)
                XCTAssertFalse(bad.contains(s))
                XCTAssertTrue(s.hasSuffix("&sp=\(c)&loc=\(l)"))
                XCTAssertLessThanOrEqual(s.utf16.count, DeepLink.maxLength)
            } }
        } } }
    }

    private func model(_ kind: WidgetKind, _ window: WidgetWindow, _ media: WidgetMedia) -> WidgetModel {
        let rows = kind == .lifers ? f.expected.lifers[window.rawValue]! : f.expected.targets[media.rawValue]![window.rawValue]!
        return WidgetModel(kind: kind, window: window, media: media, state: .list, rows: rows, usedDefaultLocation: false,
                           stale: nil, updatedAt: f.now, lastSuccess: f.now, nextRefresh: f.now)
    }

    func testRowsCarryTheirOwnBirdAndTheHeaderCarriesTheView() {
        for family in WidgetFamilySize.allCases {
            let p = WidgetPresentation.make(model(.targets, .week, .any), family: family, now: f.now, tz: f.timeZone, locale: posix)
            XCTAssertEqual(p.rowLinks.count, p.rows.count)
            for (row, link) in zip(p.rows, p.rowLinks) {
                XCTAssertEqual(link, "\(p.link)&sp=\(row.speciesCode)&loc=\(row.locId)")
            }
            XCTAssertEqual(p.link, "snowraven://map/targets?window=week&media=any")
            // Small's one card is the bird link; medium and large keep the view for the header.
            XCTAssertEqual(p.widgetLink, family == .small ? p.rowLinks.first! : p.link)
        }
    }

    func testEveryStateWidgetOpensTheViewOnly() {
        for state in [WidgetState.noHandover, .noKey, .noBackup, .noLocation, .unreachable, .empty, .keyRejected] {
            let m = WidgetModel.message(kind: .lifers, window: .day, media: .any, state: state, now: f.now)
            for family in WidgetFamilySize.allCases {
                let p = WidgetPresentation.make(m, family: family, now: f.now, tz: f.timeZone, locale: posix)
                XCTAssertTrue(p.rowLinks.isEmpty)
                XCTAssertEqual(p.widgetLink, "snowraven://map/lifers?window=day")
            }
        }
    }

    func testARowWithAnIdOutsideItsPatternOpensTheView() {
        let rows = f.expected.lifers["week"]!
        let r = rows[0]
        let odd = WidgetRow(comName: r.comName, speciesCode: "BAD CODE", locId: r.locId, locName: r.locName, lat: r.lat, lng: r.lng,
                            distanceMi: r.distanceMi, distanceText: r.distanceText, daysAgo: r.daysAgo, recency: r.recency,
                            obsDt: r.obsDt, subId: r.subId, missingMedia: r.missingMedia, label: r.label)
        let m = WidgetModel(kind: .lifers, window: .week, media: .any, state: .list, rows: [odd], usedDefaultLocation: false,
                            stale: nil, updatedAt: f.now, lastSuccess: f.now, nextRefresh: f.now)
        let p = WidgetPresentation.make(m, family: .small, now: f.now, tz: f.timeZone, locale: posix)
        XCTAssertEqual(p.rowLinks, ["snowraven://map/lifers?window=week"])
        XCTAssertEqual(p.widgetLink, "snowraven://map/lifers?window=week")
    }
}
