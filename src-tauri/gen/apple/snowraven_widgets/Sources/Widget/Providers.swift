// The two timeline providers (ios-lifer-widgets FR-22, S12). The placeholder
// and the gallery preview use sample rows and never read location or touch
// the network; a real timeline runs one shared refresh through the engine and
// asks WidgetKit to come back at the planned cadence (or later, after a 429).

import WidgetKit

struct LiferEntry: TimelineEntry {
    let date: Date
    let model: WidgetModel
    /// True only for WidgetKit's placeholder, which the view redacts (S12).
    let redacted: Bool
}

enum WidgetService {
    /// One engine per extension process, so every placed widget shares one
    /// serialized refresh path and one cache (NFR-03).
    static let engine = RefreshEngine(store: AppGroupStore(), transport: EBirdClient(), locator: CoreLocationLocator())

    static func timeline(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia) async -> Timeline<LiferEntry> {
        let model = await engine.refresh(kind: kind, window: window, media: media)
        return Timeline(entries: [LiferEntry(date: Date(), model: model, redacted: false)], policy: .after(model.nextRefresh))
    }
}

struct NearbyLifersProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> LiferEntry {
        LiferEntry(date: Date(), model: SampleData.model(kind: .lifers, window: .week, media: .any), redacted: true)
    }

    func snapshot(for configuration: NearbyLifersIntent, in context: Context) async -> LiferEntry {
        LiferEntry(date: Date(), model: SampleData.model(kind: .lifers, window: configuration.range.window, media: .any),
                   redacted: false)
    }

    func timeline(for configuration: NearbyLifersIntent, in context: Context) async -> Timeline<LiferEntry> {
        await WidgetService.timeline(kind: .lifers, window: configuration.range.window, media: .any)
    }
}

struct MediaTargetsProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> LiferEntry {
        LiferEntry(date: Date(), model: SampleData.model(kind: .targets, window: .week, media: .any), redacted: true)
    }

    func snapshot(for configuration: MediaTargetsIntent, in context: Context) async -> LiferEntry {
        LiferEntry(date: Date(), model: SampleData.model(kind: .targets, window: configuration.range.window,
                                                         media: configuration.media.media), redacted: false)
    }

    func timeline(for configuration: MediaTargetsIntent, in context: Context) async -> Timeline<LiferEntry> {
        await WidgetService.timeline(kind: .targets, window: configuration.range.window, media: configuration.media.media)
    }
}
