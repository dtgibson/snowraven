// The widget's colors (design-spec.md "Design Tokens Applied"): one Color Set
// per role in the extension's asset catalog, light and dark taken from the
// app's --sr-* tokens in frontend/src/globals.css (pinned by
// frontend/src/lib/widgetPaths.parity.test.ts). The tinted and clear home-screen
// modes are the system's; the raven and every distance figure are
// `widgetAccentable` so they take the user's tint there.

import SwiftUI

enum Palette {
    /// The bundle that holds the asset catalog: the extension's own, never
    /// `Bundle.main`, so the colors resolve wherever these views are compiled.
    private final class Token {}
    private static let bundle = Bundle(for: Token.self)

    static let background = Color("WidgetBackground", bundle: bundle)
    static let text = Color("WidgetText", bundle: bundle)
    static let muted = Color("WidgetMuted", bundle: bundle)
    static let accent = Color("WidgetAccent", bundle: bundle)
    static let separator = Color("WidgetSeparator", bundle: bundle)
}
