// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// QA-53, QA-57, NFR-05: the whole-widget VoiceOver label, composed the way
// design-spec.md specifies it: title and window (and the media type when not
// Any), then each shown row as one sentence with "miles" in full and, under
// Any, what the bird still needs, then the footer parts as sentences.

import XCTest

final class AccessibilityLabelTests: XCTestCase {
    let f = Fixture.shared
    let posix = Locale(identifier: "en_US_POSIX")

    /// The system's short time style puts a narrow no-break space (U+202F)
    /// before AM/PM, which keeps the two on one line; compare with a plain space.
    private func plain(_ s: String?) -> String? { s?.replacingOccurrences(of: "\u{202F}", with: " ") }

    private func model(_ kind: WidgetKind, _ window: WidgetWindow, _ media: WidgetMedia) -> WidgetModel {
        let rows = kind == .lifers ? f.expected.lifers[window.rawValue]! : f.expected.targets[media.rawValue]![window.rawValue]!
        return WidgetModel(kind: kind, window: window, media: media, state: .list, rows: rows, usedDefaultLocation: false,
                           stale: nil, updatedAt: f.now, lastSuccess: f.now, nextRefresh: f.now)
    }

    func testAnAnyMediumLabelReadsEveryRowWithWhatItNeeds() {
        let p = WidgetPresentation.make(model(.targets, .week, .any), family: .medium, now: f.now, tz: f.timeZone, locale: posix)
        let rows = f.expected.targets["any"]!["week"]!.prefix(3)
        let want = "Media Targets, Week. " + rows.map(\.label).joined(separator: " ") + " Updated 5:00 AM."
        XCTAssertEqual(plain(p.accessibilityLabel), want)
        XCTAssertTrue(p.accessibilityLabel.contains("needs photo and audio"))
        XCTAssertTrue(p.accessibilityLabel.contains(" miles, "))
        XCTAssertTrue(p.showsGlyphs)
    }

    func testASingleTypeLabelNamesTheTypeAndAppendsNoPhrase() {
        let p = WidgetPresentation.make(model(.targets, .week, .photo), family: .large, now: f.now, tz: f.timeZone, locale: posix)
        XCTAssertTrue(p.accessibilityLabel.hasPrefix("Media Targets, Week, Photo. "))
        XCTAssertFalse(p.accessibilityLabel.contains("needs "))
        XCTAssertFalse(p.showsGlyphs)
        XCTAssertEqual(p.windowText, "Week \u{00B7} Photo")
    }

    func testTheSmallLabelKeepsTheLocationTheTileOmits() {
        let p = WidgetPresentation.make(model(.lifers, .week, .any), family: .small, now: f.now, tz: f.timeZone, locale: posix)
        let first = f.expected.lifers["week"]![0]
        XCTAssertEqual(p.accessibilityLabel, "Nearby Lifers, Week. \(first.label)")
        XCTAssertTrue(p.accessibilityLabel.contains(first.locName))
        XCTAssertTrue(p.footer.isEmpty, "small shows no footer on a successful refresh")
    }

    func testAStateLabelIsTitleWindowAndTheSentence() {
        let m = WidgetModel.message(kind: .lifers, window: .day, media: .any, state: .noKey, now: f.now)
        let p = WidgetPresentation.make(m, family: .medium, now: f.now, tz: f.timeZone, locale: posix)
        XCTAssertEqual(p.accessibilityLabel, "Nearby Lifers, Day. Add your eBird API key in SnowRaven's Settings.")
    }

    func testS8NamesTheLastSuccessfulFetch() {
        let yesterday = f.now.addingTimeInterval(-20 * 60 * 60)
        let m = WidgetModel.message(kind: .lifers, window: .week, media: .any, state: .unreachable, now: f.now, lastSuccess: yesterday)
        let p = WidgetPresentation.make(m, family: .medium, now: f.now, tz: f.timeZone, locale: posix)
        XCTAssertEqual(plain(p.message), "Could not reach eBird. Last updated yesterday, 9:00 AM.")
        let never = WidgetModel.message(kind: .lifers, window: .week, media: .any, state: .unreachable, now: f.now)
        XCTAssertEqual(WidgetPresentation.make(never, family: .medium, now: f.now, tz: f.timeZone, locale: posix).message,
                       "Could not reach eBird.")
    }

    func testTheLinkIsTheWidgetsOwnSetting() {
        let p = WidgetPresentation.make(model(.targets, .day, .video), family: .medium, now: f.now, tz: f.timeZone, locale: posix)
        XCTAssertEqual(p.link, "snowraven://map/targets?window=day&media=video")
        let l = WidgetPresentation.make(model(.lifers, .all, .any), family: .medium, now: f.now, tz: f.timeZone, locale: posix)
        XCTAssertEqual(l.link, "snowraven://map/lifers?window=all")
    }

    /// S12 (QA-04, QA-29): the placeholder's sample rows are redacted on screen,
    /// so VoiceOver reads the header alone and never a sample bird as a report.
    func testThePlaceholderLabelIsTheHeaderAloneAndNamesNoBird() {
        for family in WidgetFamilySize.allCases {
            let p = WidgetPresentation.make(model(.lifers, .week, .any), family: family, now: f.now, tz: f.timeZone, locale: posix)
            XCTAssertEqual(p.headerLabel, "Nearby Lifers, Week.")
            XCTAssertTrue(p.accessibilityLabel.hasPrefix(p.headerLabel), "the full label opens with the same header sentence")
            for r in p.rows { XCTAssertFalse(p.headerLabel.contains(r.comName)) }
            XCTAssertFalse(p.headerLabel.contains(" miles"))
        }
        let photo = WidgetPresentation.make(model(.targets, .all, .photo), family: .small, now: f.now, tz: f.timeZone, locale: posix)
        XCTAssertEqual(photo.headerLabel, "Media Targets, 30 days, Photo.")
    }
}
