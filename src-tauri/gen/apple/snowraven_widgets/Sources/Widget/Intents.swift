// The Edit Widget parameters (ios-lifer-widgets FR-10, FR-50;
// design-spec.md "Edit Widget sheet"; widget-measure-from-choice). Nearby
// Lifers has Time range then Measure from; Media Targets has Time range, Media,
// then Measure from. New widgets default to Week, a new Media Targets widget
// to Any, and every widget to My location, which is also what a widget placed
// before Measure from existed reads (its stored configuration has no value
// for it), so its behavior does not change.

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

enum MeasureFromOption: String, AppEnum {
    case myLocation, defaultLocation

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Measure from"
    static var caseDisplayRepresentations: [MeasureFromOption: DisplayRepresentation] = [
        .myLocation: DisplayRepresentation(title: "My location", subtitle: "Where you are when the widget refreshes"),
        .defaultLocation: DisplayRepresentation(title: "Default Location", subtitle: "The one saved in SnowRaven's Settings"),
    ]

    var measure: WidgetMeasure {
        switch self {
        case .myLocation: return .myLocation
        case .defaultLocation: return .defaultLocation
        }
    }
}

struct NearbyLifersIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Nearby Lifers"
    static var description = IntentDescription("Choose the time range the widget lists and where it measures from.")

    @Parameter(title: "Time range", default: .week)
    var range: TimeRangeOption

    @Parameter(title: "Measure from", default: .myLocation)
    var measureFrom: MeasureFromOption
}

struct MediaTargetsIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Media Targets"
    static var description = IntentDescription("Choose the time range and the media the widget lists, and where it measures from.")

    @Parameter(title: "Time range", default: .week)
    var range: TimeRangeOption

    @Parameter(title: "Media", default: .any)
    var media: MediaOption

    @Parameter(title: "Measure from", default: .myLocation)
    var measureFrom: MeasureFromOption
}
