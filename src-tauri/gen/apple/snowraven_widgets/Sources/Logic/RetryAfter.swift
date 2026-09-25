// The Retry-After parse (ios-lifer-widgets, schema.md section 3.3), the twin of
// `parseRetryAfterSeconds` in frontend/src/lib/rateLimit.ts and
// `_parse_retry_after_seconds` in backend/routers/map.py: exactly 1 to 3 ASCII
// digits, at least 1, capped at 60 seconds; anything else is absent. The
// fixture pins all three to the same table.

import Foundation

enum RetryAfter {
    static let capSeconds = 60

    static func parseSeconds(_ value: String?) -> Int? {
        guard let v = value else { return nil }
        let b = Array(v.utf8)
        guard (1...3).contains(b.count), b.allSatisfy({ $0 >= 0x30 && $0 <= 0x39 }) else { return nil }
        let n = b.reduce(0) { $0 * 10 + Int($1 - 0x30) }
        guard n >= 1 else { return nil }
        return min(n, capSeconds)
    }
}
