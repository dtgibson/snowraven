// The Edit Widget parameters (ios-lifer-widgets FR-10, FR-50;
// design-spec.md "Edit Widget sheet"). Nearby Lifers has exactly one
// parameter, Time range; Media Targets has Time range and Media. New widgets
// default to Week, and a new Media Targets widget to Any.

import AppIntents
import WidgetKit

enum TimeRangeOption: String, AppEnum {
    case day, week, all

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Time range"
    static var caseDisplayRepresentations: [TimeRangeOption: DisplayRepresentation] = [
        .day: "Day",
        .week: "Week",
        .all: "30 days",
    ]

    var window: WidgetWindow {
        switch self {
        case .day: return .day
        case .week: return .week
        case .all: return .all
        }
    }
}

enum MediaOption: String, AppEnum {
    case photo, audio, video, any

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Media"
    static var caseDisplayRepresentations: [MediaOption: DisplayRepresentation] = [
        .photo: DisplayRepresentation(title: "Photo", subtitle: "Species you have no photo of"),
        .audio: DisplayRepresentation(title: "Audio", subtitle: "Species you have no audio of"),
        .video: DisplayRepresentation(title: "Video", subtitle: "Species you have no video of"),
        .any: DisplayRepresentation(title: "Any", subtitle: "Missing a photo, audio, or video"),
    ]

    var media: WidgetMedia {
        switch self {
        case .photo: return .photo
        case .audio: return .audio
        case .video: return .video
        case .any: return .any
        }
    }
}

struct NearbyLifersIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Nearby Lifers"
    static var description = IntentDescription("Choose the time range the widget lists.")

    @Parameter(title: "Time range", default: .week)
    var range: TimeRangeOption
}

struct MediaTargetsIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Media Targets"
    static var description = IntentDescription("Choose the time range and the media the widget lists.")

    @Parameter(title: "Time range", default: .week)
    var range: TimeRangeOption

    @Parameter(title: "Media", default: .any)
    var media: MediaOption
}
