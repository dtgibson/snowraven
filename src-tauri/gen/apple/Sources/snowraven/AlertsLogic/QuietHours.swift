// Quiet hours (ios-alerts, FR-33 to FR-36; schema.md 4.6), the twin of
// `isQuiet`, `windowEnd` and `mergePending` in
// frontend/src/lib/alerts/alertRules.ts.
//
// Quiet hours DEFER delivery; they never hide a find. A check inside the
// window writes its rows at once and merges its hits into ONE deferred summary
// whose delivery time is the end of the window in force when the FIRST hit was
// deferred (FR-13): a later quiet-hours edit does not move it. The window end
// is found by the device calendar (`Calendar.nextDate(after:matching:)`), so a
// DST transition inside the window lands on the right instant.

import Foundation

enum QuietHours {
    /// True inside the window; equal start and end is no quiet period (FR-34);
    /// an end before the start spans midnight.
    static func isQuiet(_ minuteOfDay: Int, startMin: Int, endMin: Int) -> Bool {
        if startMin == endMin { return false }
        if startMin < endMin { return minuteOfDay >= startMin && minuteOfDay < endMin }
        return minuteOfDay >= startMin || minuteOfDay < endMin
    }

    static func calendar(_ tz: TimeZone) -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = tz
        return c
    }

    /// The local minute of the day at an instant.
    static func minuteOfDay(_ now: Date, tz: TimeZone) -> Int {
        let c = calendar(tz).dateComponents([.hour, .minute], from: now)
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }

    /// The next instant strictly after `now` whose local wall time is `endMin`:00.
    static func windowEnd(_ now: Date, endMin: Int, tz: TimeZone) -> Date {
        let cal = calendar(tz)
        let match = DateComponents(hour: endMin / 60, minute: endMin % 60, second: 0)
        return cal.nextDate(after: now, matching: match, matchingPolicy: .nextTime) ?? now.addingTimeInterval(86_400)
    }

    /// Merge one check's hits into the deferred summary (FR-35): one entry per
    /// species (the nearer sighting kept, the existing one on a tie), the union
    /// nearest first (ties by species code), at most 200; the window end and
    /// the place stay those of the first deferred check.
    static func mergePending(_ pending: PendingSummary?, hits: [PendingHit], firstWindowEndAt: String,
                             firstPlace: PlacePhrase, checkId: String) -> PendingSummary {
        let base = pending ?? PendingSummary(windowEndAt: firstWindowEndAt, place: firstPlace, hits: [], checkIds: [])
        var order: [String] = []
        var by: [String: PendingHit] = [:]
        for h in base.hits where by[h.speciesCode] == nil { by[h.speciesCode] = h; order.append(h.speciesCode) }
        for h in hits {
            if let prev = by[h.speciesCode] {
                if h.distanceMi < prev.distanceMi { by[h.speciesCode] = h }
            } else {
                by[h.speciesCode] = h
                order.append(h.speciesCode)
            }
        }
        let merged = order.compactMap { by[$0] }.sorted { a, b in
            if a.distanceMi != b.distanceMi { return a.distanceMi < b.distanceMi }
            return JSText.compare(a.speciesCode, b.speciesCode) < 0
        }
        let checkIds = Array((base.checkIds + [checkId]).suffix(AlertRules.pendingMax))
        return PendingSummary(windowEndAt: base.windowEndAt, place: base.place,
                              hits: Array(merged.prefix(AlertRules.pendingMax)), checkIds: checkIds)
    }
}
