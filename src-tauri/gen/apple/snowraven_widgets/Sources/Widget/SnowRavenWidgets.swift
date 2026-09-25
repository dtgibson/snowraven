// The widget bundle (ios-lifer-widgets FR-01, FR-02): two kinds, named as
// Map Explorer names its views, each in the three home-screen families and
// nothing else (no lock-screen, StandBy, watch or Live Activity families).
// iOS 17 and later: the extension's deployment target; the app stays on 16.
// The system content margins are disabled and re-applied, capped at the
// mockup's insets, in WidgetRootView (see WidgetContent.insets).

import SwiftUI
import WidgetKit

@main
struct SnowRavenWidgets: WidgetBundle {
    var body: some Widget {
        NearbyLifersWidget()
        MediaTargetsWidget()
    }
}

struct NearbyLifersWidget: Widget {
    static let kind = "NearbyLifers"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: NearbyLifersWidget.kind, intent: NearbyLifersIntent.self,
                               provider: NearbyLifersProvider()) { entry in
            WidgetRootView(entry: entry)
        }
        .configurationDisplayName(WidgetCopy.title(.lifers))
        .description(WidgetCopy.liferDescription)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct MediaTargetsWidget: Widget {
    static let kind = "MediaTargets"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: MediaTargetsWidget.kind, intent: MediaTargetsIntent.self,
                               provider: MediaTargetsProvider()) { entry in
            WidgetRootView(entry: entry)
        }
        .configurationDisplayName(WidgetCopy.title(.targets))
        .description(WidgetCopy.targetDescription)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
