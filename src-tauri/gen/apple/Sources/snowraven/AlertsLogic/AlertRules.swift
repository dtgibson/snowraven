// The alert check's named constants and small shared rules (ios-alerts,
// schema.md 3.4, 4.1, 4.3, 4.4, 5.1). Every value is pinned to its TypeScript
// declaration in frontend/src/lib/alerts/alertsState.ts by
// alertsPaths.parity.test.ts, which compares the declarations to each other
// rather than restating a literal (testing.md), and the XCTest parity suite
// asserts them against the generated fixture's `constants`.
//
// Every string rule here is on UTF-16 CODE UNITS, never Swift Characters: the
// TypeScript twin compares code units, and Swift's `String ==`, `Set<String>`,
// `hasSuffix` and `contains` compare grapheme clusters under canonical
// equivalence, which disagree with JavaScript on combining marks.

import Foundation

enum AlertRules {
    static let dedupeDays = 7
    static let retentionDays = 30
    static let maxRows = 200
    static let positionMaxAgeHours = 24
    /// A time in an alert document more than this far ahead of now is
    /// implausible, since the device's own clock wrote it (security review L4;
    /// the iCloud records' `isWritableTime` window).
    static let futureSkewHours = 24
    static let radiusMin = 1
    static let radiusMax = 25
    static let radiusDefault = 25
    static let quietDefaultStart = 1320
    static let quietDefaultEnd = 420
    static let hourlySeconds = 3600
    static let dailySeconds = 86400
    static let pendingMax = 200
    static let notificationPrefix = "alerts."
    static let deferredId = "alerts.deferred"
    /// A fixed place's display name, in UTF-16 units (schema.md 3.2).
    static let placeNameMaxUnits = 120
    /// An eBird string field, as the reducer caps it.
    static let recordMaxUnits = RecentObsReducer.maxStringUnits

    static var dedupeSeconds: TimeInterval { TimeInterval(dedupeDays * 86_400) }
    static var retentionSeconds: TimeInterval { TimeInterval(retentionDays * 86_400) }
    static var positionMaxAgeSeconds: TimeInterval { TimeInterval(positionMaxAgeHours * 3_600) }
    static var futureSkewSeconds: TimeInterval { TimeInterval(futureSkewHours * 3_600) }
    /// A deferred summary's window end more than this far ahead is implausible
    /// (security review I8): the longest real one, a quiet window of nearly a
    /// day that crosses a daylight-saving change, ends about 25 hours ahead.
    static let summaryMaxAheadHours = 26
    static var summaryMaxAheadSeconds: TimeInterval { TimeInterval(summaryMaxAheadHours * 3_600) }

    /// The interval a cadence asks iOS for, no sooner than (FR-06).
    static func interval(_ cadence: AlertCadence) -> TimeInterval {
        cadence == .hourly ? TimeInterval(hourlySeconds) : TimeInterval(dailySeconds)
    }

    /// The point a My location check measures from (security review L6): the
    /// position rounded half away from zero to two decimals, the precision the
    /// widget's cache cell already has (`WidgetCache.cell`), so the request,
    /// every distance, the inbox rows and the links all carry a point within
    /// about half a mile of the device rather than the device's own position.
    /// The twin of `approximatePoint` in alertRules.ts.
    static func approximate(_ c: Coordinate) -> Coordinate {
        func round2(_ x: Double) -> Double { (x * 100).rounded(.toNearestOrAwayFromZero) / 100 }
        return Coordinate(lat: round2(c.lat), lng: round2(c.lng))
    }

    /// eBird's `dist` for a radius in miles, as the app's handlers compute it.
    static func distKm(radiusMi: Int) -> Int {
        Int((Double(radiusMi) * 1.60934).rounded())
    }

    /// FR-26: the hold after a 429, bounded exactly as the pacing contract
    /// bounds it (1 to 60 s), 60 s when the header is absent or unparseable.
    static func holdUntil(now: Date, retryAfter: String?) -> Date {
        now.addingTimeInterval(TimeInterval(RetryAfter.parseSeconds(retryAfter) ?? RetryAfter.capSeconds))
    }

    /// The outcome of the one request when it yielded no records (schema.md
    /// 4.4, design-spec section 4), or nil for a decoded body (which becomes
    /// `hits` or `nothing-new` once the rows are applied). The twin of
    /// `outcomeOf` in alertRules.ts.
    static func outcome(_ f: RefreshEngine.Fetched) -> AlertOutcome? {
        switch f {
        case .records: return nil
        case .status(429, _): return .busy
        case .status(let code, _) where code == 401 || code == 403: return .keyRejected
        case .offline, .timeout: return .unreachable
        case .status, .malformed, .tooLarge: return .noAnswer
        }
    }

    /// Whether `now` is due a check (schema.md 4.1).
    static func isDue(lastCompletedAt: Date?, cadence: AlertCadence, now: Date) -> Bool {
        guard let last = lastCompletedAt else { return true }
        return now.timeIntervalSince(last) >= interval(cadence)
    }
}

// MARK: - Code-unit string helpers

enum Units {
    static func of(_ s: String) -> [UInt16] { Array(s.utf16) }

    static func hasSuffix(_ s: String, _ suffix: String) -> Bool {
        let a = Array(s.utf16), b = Array(suffix.utf16)
        return a.count >= b.count && Array(a[(a.count - b.count)...]) == b
    }

    static func contains(_ s: String, _ needle: String) -> Bool {
        let a = Array(s.utf16), b = Array(needle.utf16)
        if b.isEmpty { return true }
        if a.count < b.count { return false }
        var i = 0
        while i + b.count <= a.count {
            if a[i] == b[0] && Array(a[i..<(i + b.count)]) == b { return true }
            i += 1
        }
        return false
    }

    static func equal(_ a: String, _ b: String) -> Bool { a.utf16.elementsEqual(b.utf16) }
}

// MARK: - Shared validators

enum AlertValidate {
    /// `^[a-z0-9-]{2,16}$` (the app's SPECIES_CODE_RE), byte-wise.
    static func speciesCode(_ s: String) -> Bool {
        let b = Array(s.utf8)
        return (2...16).contains(b.count) && b.allSatisfy { ($0 >= 0x61 && $0 <= 0x7A) || ($0 >= 0x30 && $0 <= 0x39) || $0 == 0x2D }
    }

    /// `^L[0-9]{1,15}$`, byte-wise.
    static func locId(_ s: String) -> Bool {
        let b = Array(s.utf8)
        guard (2...16).contains(b.count), b[0] == 0x4C else { return false }
        return b.dropFirst().allSatisfy { $0 >= 0x30 && $0 <= 0x39 }
    }

    /// A UUID v4 in lowercase: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
    static func uuid(_ s: String) -> Bool {
        let b = Array(s.utf8)
        guard b.count == 36 else { return false }
        func hex(_ c: UInt8) -> Bool { (c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x66) }
        for (i, c) in b.enumerated() {
            switch i {
            case 8, 13, 18, 23: if c != 0x2D { return false }
            case 14: if c != 0x34 { return false }
            case 19: if !(c == 0x38 || c == 0x39 || c == 0x61 || c == 0x62) { return false }
            default: if !hex(c) { return false }
            }
        }
        return true
    }

    /// No C0 control character or DEL anywhere.
    static func noControls(_ s: String) -> Bool {
        !s.utf16.contains(where: { $0 <= 0x1F || $0 == 0x7F })
    }

    /// A display name: 1 to `max` UTF-16 units, no controls, no JS-trim edge whitespace.
    static func displayName(_ s: String, max: Int) -> Bool {
        let u = Array(s.utf16)
        guard (1...max).contains(u.count), noControls(s) else { return false }
        return !JSText.isTrimSpace(u.first!) && !JSText.isTrimSpace(u.last!)
    }

    static func lat(_ x: Double) -> Bool { x.isFinite && (-90...90).contains(x) }
    static func lng(_ x: Double) -> Bool { x.isFinite && (-180...180).contains(x) }
    static func radius(_ r: Int) -> Bool { (AlertRules.radiusMin...AlertRules.radiusMax).contains(r) }
    static func minute(_ m: Int) -> Bool { (0...1439).contains(m) }
    static func time(_ s: String) -> Bool { WidgetTime.parse(s) != nil }
}

// MARK: - Strict JSON keys

/// A coding key that admits any name, so a decoder can see EVERY key present
/// and refuse the ones outside its table (a synthesized keyed container drops
/// unknown keys silently).
struct AnyCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init(_ s: String) { stringValue = s }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
}

enum StrictKeys {
    struct Refused: Error {}

    /// Throws when the object holds a key outside `allowed`.
    static func check(_ decoder: Decoder, _ allowed: Set<String>) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        for k in c.allKeys where !allowed.contains(k.stringValue) { throw Refused() }
    }
}
