// ISO-8601 UTC to the second, the one time format the hand-over and the
// cache carry ("2026-09-23T18:04:11Z").

import Foundation

enum WidgetTime {
    private static func formatter() -> ISO8601DateFormatter {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }

    static func string(_ d: Date) -> String { formatter().string(from: d) }

    static func parse(_ s: String) -> Date? {
        guard Handover.isValidWrittenAt(s) else { return nil }
        return formatter().date(from: s)
    }
}
