// The alert link builder (ios-alerts, schema.md 5.1 and 5.2): the Swift
// author of the anchored form the app's `parseWidgetLink` accepts,
//
//   snowraven://map/lifers?window=day&lat=<lat>&lng=<lng>&r=<r>&sp=<code>&loc=<locId>&show=<all|one>
//
// The twin of `alertLinkFor` / `alertLinkString` in
// frontend/src/lib/alerts/alertRules.ts. `pattern` is the parser's regex as
// TEXT: widgetPaths.parity.test.ts compares it character for character to
// `ALERT_LINK_PATTERN` in frontend/src/lib/links/deepLink.ts, and the XCTest
// suite asserts it against the generated fixture.
//
// DEGRADE, never refuse: a hit whose species code or location id is outside
// its pattern, or whose point or radius is out of range, gets the plain Day
// view link (the widget's rule: the view-only landing is always correct).
// Coordinates print as JavaScript's `toFixed(5)` (the exact `JSNumber` twin,
// ties included), after the same five-decimal rounding the TS side does and
// with a negative zero read as zero, so both builders emit the same bytes.

import Foundation

enum AlertShow: String, Codable, Sendable { case all, one }

enum AlertLink {
    static let pattern = "^snowraven://map/lifers\\?window=day&lat=(-?[0-9]{1,2}(?:\\.[0-9]{1,5})?)&lng=(-?[0-9]{1,3}(?:\\.[0-9]{1,5})?)&r=([0-9]{1,2})&sp=([a-z0-9-]{2,16})&loc=(L[0-9]{1,15})&show=(all|one)$"
    static let viewLink = "\(DeepLink.scheme)://map/lifers?window=day"

    private static let re = try! NSRegularExpression(pattern: pattern)

    /// Whole-string match; the length check against the UTF-16 count refuses a
    /// trailing newline ICU's `$` would otherwise admit (security.md's anchor rule).
    static func matches(_ s: String) -> Bool {
        guard s.utf16.count <= DeepLink.maxLength else { return false }
        let range = NSRange(s.startIndex..., in: s)
        guard let m = re.firstMatch(in: s, options: [], range: range) else { return false }
        return m.range.location == 0 && m.range.length == range.length
    }

    /// `Number(x.toFixed(5))`, with -0 read as 0.
    static func coord(_ x: Double) -> Double? {
        guard x.isFinite, let v = Double(JSNumber.toFixed(x, 5)) else { return nil }
        return v == 0 ? 0 : v
    }

    static func build(speciesCode: String, locId: String, point: Coordinate, radiusMi: Int, show: AlertShow) -> String {
        guard AlertValidate.speciesCode(speciesCode), AlertValidate.locId(locId),
              let lat = coord(point.lat), let lng = coord(point.lng),
              AlertValidate.lat(lat), AlertValidate.lng(lng), AlertValidate.radius(radiusMi) else { return viewLink }
        let s = "\(viewLink)&lat=\(JSNumber.toFixed(lat, 5))&lng=\(JSNumber.toFixed(lng, 5))&r=\(radiusMi)"
            + "&sp=\(speciesCode)&loc=\(locId)&show=\(show.rawValue)"
        return matches(s) ? s : viewLink
    }
}
