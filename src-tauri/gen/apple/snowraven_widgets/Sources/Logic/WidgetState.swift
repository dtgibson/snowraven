// The widget's states and the model a view renders (ios-lifer-widgets, FR-29).
// S7 (from the Default Location) and S9 (a marked last good list) are not
// states of their own: they decorate a list, or S10, through
// `usedDefaultLocation` and `stale`, which is how the design composes them.

import Foundation

enum WidgetState: String, Codable, Equatable {
    case noHandover = "S1"
    case noKey = "S2"
    case noBackup = "S3"
    case noExport = "S4"
    case nothingMissing = "S5"
    case noLocation = "S6"
    case unreachable = "S8"
    case empty = "S10"
    case keyRejected = "S11"
    case placeholder = "S12"
    case list
}

enum StaleReason: String, Codable, Equatable {
    case offline
    case busy
}

struct WidgetModel: Equatable {
    let kind: WidgetKind
    let window: WidgetWindow
    let media: WidgetMedia
    let state: WidgetState
    /// The whole ordered list; a family shows the first 1, 3 or 8.
    let rows: [WidgetRow]
    /// S7: the reference point is the saved Default Location.
    let usedDefaultLocation: Bool
    /// S9: the latest attempt failed and this is the last good list.
    let stale: StaleReason?
    /// When the data shown was fetched (the footer's "Updated").
    let updatedAt: Date?
    /// S8: the last successful fetch, if there ever was one.
    let lastSuccess: Date?
    /// When WidgetKit should ask again.
    let nextRefresh: Date

    static func message(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia, state: WidgetState,
                        now: Date, lastSuccess: Date? = nil, usedDefault: Bool = false) -> WidgetModel {
        WidgetModel(kind: kind, window: window, media: media, state: state, rows: [], usedDefaultLocation: usedDefault,
                    stale: nil, updatedAt: nil, lastSuccess: lastSuccess,
                    nextRefresh: now.addingTimeInterval(RefreshEngine.cadenceSeconds))
    }
}
