// Where a check measures from, and the first missing precondition (ios-alerts,
// FR-10, FR-16 to FR-18; schema.md 4.3 and 4.7), the twin of `resolvePoint` /
// `resolveBlocked` in frontend/src/lib/alerts/alertRules.ts. ONE function
// serves the check's refusal and the Settings status line, so the sentence the
// user reads and the reason a check did not run cannot disagree.
//
//   Fixed place: the hand-set place, else the hand-over's Default Location
//     (FR-09's "defaults to"), else blocked no-place.
//   My location: unless the permission is denied or restricted, the NEWER of
//     the app's own recorded position and the widget cache's cell (only a cell
//     the widget marked as read from the DEVICE: a Default Location fallback,
//     or an older cache that cannot say, is not the user's position, security
//     review L7), each only
//     inside 24 hours (OQ-04) and no more than 24 hours ahead (a time the
//     clock wrote while running ahead, security review L4), the app's own on
//     a tie, as an APPROXIMATE point (`AlertRules.approximate`, two decimals,
//     L6); else the fixed place as the fallback ("From your fixed place");
//     else blocked location-off (the permission said no) or no-position. A
//     fixed place keeps the precision the user gave it.
//   Preconditions in FR-18's order: a key, a backup, then a point. An absent
//     hand-over reads as no key (the revocation document has none).

import Foundation

enum LocationAuth: String, Codable, Sendable {
    case notDetermined = "not-determined"
    case granted
    case denied
    case restricted
}

enum NotificationAuth: String, Codable, Sendable {
    case notDetermined = "not-determined"
    case granted
    case denied
}

enum AlertBlocked: String, Codable, Sendable {
    case noKey = "no-key"
    case noBackup = "no-backup"
    case noPlace = "no-place"
    case locationOff = "location-off"
    case noPosition = "no-position"
}

struct HandoverFacts: Equatable, Sendable {
    let hasKey: Bool
    let hasBackup: Bool
    let defaultLocation: Coordinate?

    init(hasKey: Bool, hasBackup: Bool, defaultLocation: Coordinate?) {
        self.hasKey = hasKey; self.hasBackup = hasBackup; self.defaultLocation = defaultLocation
    }

    init(_ h: Handover) {
        hasKey = h.ebirdKey != nil
        hasBackup = h.hasEbirdBackup
        defaultLocation = h.defaultLocation.map { Coordinate(lat: $0.lat, lng: $0.lng) }
    }
}

struct TimedPosition: Equatable, Sendable {
    let lat: Double
    let lng: Double
    let at: Date
}

/// The widget cache's cell as a My location source, with where it came from
/// (`WidgetCache.cellSource`; nil for a cache written before it was recorded).
struct WidgetCellReading: Equatable, Sendable {
    let lat: Double
    let lng: Double
    let at: Date
    let source: CellSource?
}

struct PointInputs: Sendable {
    let model: AlertModel
    let fixedPlace: FixedPlace?
    let handover: HandoverFacts?
    let position: TimedPosition?
    let widgetCell: WidgetCellReading?
    let location: LocationAuth
    let now: Date
}

enum Resolved: Equatable, Sendable {
    case point(Coordinate, PlacePhrase, CheckFrom)
    case blocked(AlertBlocked)
}

enum ResolvePoint {
    private static func fixedPoint(_ i: PointInputs) -> (Coordinate, PlacePhrase)? {
        if let f = i.fixedPlace {
            if let n = f.name, !n.isEmpty { return (Coordinate(lat: f.lat, lng: f.lng), .name(n)) }
            return (Coordinate(lat: f.lat, lng: f.lng), .nearby)
        }
        if let d = i.handover?.defaultLocation { return (d, .nearby) }
        return nil
    }

    static func resolvePoint(_ i: PointInputs) -> Resolved {
        if i.model == .fixed {
            guard let (p, phrase) = fixedPoint(i) else { return .blocked(.noPlace) }
            return .point(p, phrase, .fixed)
        }
        let denied = i.location == .denied || i.location == .restricted
        if !denied {
            // L7: a cell is a reading of the device only when the widget says
            // so; one marked as the Default Location fallback, or unmarked, is
            // never "near you".
            let cell = i.widgetCell.flatMap { c in
                c.source == .device ? TimedPosition(lat: c.lat, lng: c.lng, at: c.at) : nil
            }
            let fresh = [i.position, cell].compactMap { $0 }
                .filter {
                    i.now.timeIntervalSince($0.at) <= AlertRules.positionMaxAgeSeconds
                        && $0.at.timeIntervalSince(i.now) <= AlertRules.futureSkewSeconds
                }
            if var pick = fresh.first {
                for p in fresh.dropFirst() where p.at > pick.at { pick = p }
                return .point(AlertRules.approximate(Coordinate(lat: pick.lat, lng: pick.lng)), .nearYou, .myLocation)
            }
        }
        if let (p, phrase) = fixedPoint(i) { return .point(p, phrase, .fixedFallback) }
        return .blocked(denied ? .locationOff : .noPosition)
    }

    static func resolveBlocked(_ i: PointInputs) -> AlertBlocked? {
        guard let h = i.handover, h.hasKey else { return .noKey }
        guard h.hasBackup else { return .noBackup }
        if case .blocked(let b) = resolvePoint(i) { return b }
        return nil
    }
}
