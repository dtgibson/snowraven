// The widget tap-through URLs (ios-lifer-widgets, schema.md section 4.1, FR-34):
// a VIEW link, exactly one of the fifteen strings the app's allowlist accepts
// (frontend/src/lib/links/deepLink.ts), and for a bird tap (Stage 8) that view
// link followed by `&sp=<speciesCode>&loc=<locId>`. Nearby Lifers carries the
// window only; Media Targets carries the window, then the media value, in that
// fixed order. The window token `all` is "30 days"; the media value `any` lands
// on the in-app chip row labelled All.
//
// The bird suffix is appended ONLY when both ids match the app's own patterns,
// spelled here exactly as the app spells them (`lib/speciesCode.ts` and
// `LOC_ID_RE`; `widgetPaths.parity.test.ts` compares the text). Otherwise the
// builder returns the view link, so the extension never emits a link the app
// would have to degrade. The fixture's `links` rows pin this builder to the
// app's parser.

import Foundation

enum DeepLink {
    static let scheme = "snowraven"
    static let maxLength = 96
    static let speciesCodePattern = "^[a-z0-9-]{2,16}$"
    static let locIdPattern = "^L[0-9]{1,15}$"

    private static let speciesCodeRE = try! NSRegularExpression(pattern: speciesCodePattern)
    private static let locIdRE = try! NSRegularExpression(pattern: locIdPattern)

    /// Whole-string match with NSRegularExpression's anchors. `$` in ICU also
    /// matches before a final line terminator, so the length check against the
    /// UTF-16 count is what refuses a trailing newline (the JS `$` does not
    /// match there, security.md's anchor rule).
    private static func matches(_ re: NSRegularExpression, _ s: String) -> Bool {
        let range = NSRange(s.startIndex..., in: s)
        guard let m = re.firstMatch(in: s, options: [], range: range) else { return false }
        return m.range.location == 0 && m.range.length == range.length
    }

    static func isLinkable(speciesCode: String, locId: String) -> Bool {
        matches(speciesCodeRE, speciesCode) && matches(locIdRE, locId)
    }

    static func string(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia) -> String {
        let base = "\(scheme)://map/\(kind.rawValue)?window=\(window.rawValue)"
        return kind == .targets ? "\(base)&media=\(media.rawValue)" : base
    }

    /// The bird link for one row, or the view link when either id is outside
    /// its pattern.
    static func string(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia, speciesCode: String, locId: String) -> String {
        let view = string(kind: kind, window: window, media: media)
        guard isLinkable(speciesCode: speciesCode, locId: locId) else { return view }
        return "\(view)&sp=\(speciesCode)&loc=\(locId)"
    }

    static func url(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia) -> URL {
        URL(string: string(kind: kind, window: window, media: media))!
    }
}
