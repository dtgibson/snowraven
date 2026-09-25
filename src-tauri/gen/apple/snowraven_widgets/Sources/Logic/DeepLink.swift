// The widget tap-through URLs (ios-lifer-widgets, schema.md section 4.1, FR-34):
// exactly the fifteen strings the app's allowlist accepts
// (frontend/src/lib/links/deepLink.ts). Nearby Lifers carries the window only;
// Media Targets carries the window, then the media value, in that fixed order.
// The window token `all` is "30 days"; the media value `any` lands on the
// in-app chip row labelled All. The fixture's `links` rows pin this builder to
// the app's parser.

import Foundation

enum DeepLink {
    static let scheme = "snowraven"
    static let maxLength = 64

    static func string(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia) -> String {
        let base = "\(scheme)://map/\(kind.rawValue)?window=\(window.rawValue)"
        return kind == .targets ? "\(base)&media=\(media.rawValue)" : base
    }

    static func url(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia) -> URL {
        URL(string: string(kind: kind, window: window, media: media))!
    }
}
