// Every word the widget shows or speaks (ios-lifer-widgets, design-spec.md
// "Content Notes"). One file, so frontend/src/lib/widgets/widgetCopy.test.ts can
// scan it for em dashes and British spellings on every CI run, and so the view
// and the VoiceOver label cannot say different things. American spelling; no
// em dash anywhere; views name the surfaces as the app does (Map Explorer's
// view labels, not component names).

import Foundation

enum WidgetCopy {
    static func title(_ kind: WidgetKind) -> String {
        switch kind {
        case .lifers: return "Nearby Lifers"
        case .targets: return "Media Targets"
        }
    }

    static func windowWord(_ w: WidgetWindow) -> String {
        switch w {
        case .day: return "Day"
        case .week: return "Week"
        case .all: return "30 days"
        }
    }

    static func mediaWord(_ m: WidgetMedia) -> String {
        switch m {
        case .photo: return "Photo"
        case .audio: return "Audio"
        case .video: return "Video"
        case .any: return "Any"
        }
    }

    static let mediaSubtitles: [WidgetMedia: String] = [
        .photo: "Species you have no photo of",
        .audio: "Species you have no audio of",
        .video: "Species you have no video of",
        .any: "Missing a photo, audio, or video",
    ]

    static let liferDescription =
        "Recent eBird reports of species you still need, within 25 miles of where you are, nearest first. Tap to open them in Map Explorer."
    static let targetDescription =
        "Recent eBird reports of species you have recorded but still need a photo, audio or video of, within 25 miles of where you are, nearest first. Tap to open them in Map Explorer."

    /// The header's trailing words: the window, and the media type when it is a single type.
    static func windowText(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia) -> String {
        if kind == .targets && media != .any { return "\(windowWord(window)) \u{00B7} \(mediaWord(media))" }
        return windowWord(window)
    }

    private static func windowPhrase(_ w: WidgetWindow) -> String {
        switch w {
        case .day: return "today"
        case .week: return "this week"
        case .all: return "in the last 30 days"
        }
    }

    private static func needing(_ m: WidgetMedia) -> String {
        switch m {
        case .photo: return "a photo"
        case .audio: return "audio"
        case .video: return "video"
        case .any: return "media"
        }
    }

    static let footerDefaultLocation = "From your default location"
    static let footerOffline = "Offline"
    static let footerBusy = "eBird busy"

    static func updated(_ when: String) -> String { "Updated \(when)" }

    /// The state sentence (FR-29), or nil for a list.
    static func message(state: WidgetState, kind: WidgetKind, window: WidgetWindow, media: WidgetMedia,
                        lastSuccess: String?) -> String? {
        switch state {
        case .noHandover: return "Open SnowRaven once to set up widgets."
        case .noKey: return "Add your eBird API key in SnowRaven's Settings."
        case .noBackup: return "Load your eBird backup in SnowRaven's Settings."
        case .noExport: return "Load your Macaulay Library export in SnowRaven's Settings."
        case .nothingMissing:
            if media == .any { return "You already have media for every species in your backup." }
            return "You already have \(needing(media)) of every species in your backup."
        case .noLocation: return "Open SnowRaven to allow location, or set a Default Location in Settings."
        case .unreachable:
            if let when = lastSuccess { return "Could not reach eBird. Last updated \(when)." }
            return "Could not reach eBird."
        case .empty:
            if kind == .lifers { return "No lifers reported within 25 miles \(windowPhrase(window))." }
            if media == .any { return "No media targets reported within 25 miles \(windowPhrase(window))." }
            return "No species needing \(needing(media)) reported within 25 miles \(windowPhrase(window))."
        case .keyRejected: return "eBird did not accept your key. Check it in SnowRaven's Settings."
        case .placeholder, .list: return nil
        }
    }
}
