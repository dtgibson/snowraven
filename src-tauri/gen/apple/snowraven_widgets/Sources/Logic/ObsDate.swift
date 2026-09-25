// The date rule (ios-lifer-widgets, schema.md section 6.2), the twin of
// `parseObsDateStrict` / `daysBetween` in frontend/src/lib/widgets/widgetRows.ts.
//
// * The parse accepts exactly `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`, ASCII digits
//   only, and a real proleptic Gregorian day. Written as a byte check rather
//   than a regex on purpose: ICU's `$` matches before a trailing newline, where
//   the TypeScript twin's does not, and a hand-written check has no anchor to
//   get wrong.
// * Day counts are CALENDAR days: days-from-civil arithmetic on the report's
//   date and the device's local date, exact on every day of the year including
//   the DST transitions. This deliberately differs from the app's
//   `isWithinWindow`, whose floor over local midnights is one day short on the
//   day after a spring-forward transition; that difference is declared in the
//   schema and asserted by the parity suite.

import Foundation

struct CivilDate: Equatable, Codable {
    let y: Int
    let m: Int
    let d: Int
}

enum ObsDate {
    private static func digit(_ b: UInt8) -> Int? {
        (b >= 0x30 && b <= 0x39) ? Int(b - 0x30) : nil
    }

    static func isLeap(_ y: Int) -> Bool {
        (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
    }

    static func daysInMonth(_ y: Int, _ m: Int) -> Int {
        [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    }

    static func parse(_ s: String) -> CivilDate? {
        let b = Array(s.utf8)
        guard b.count == 10 || b.count == 16 else { return nil }
        for (i, c) in b.enumerated() {
            switch i {
            case 4, 7: if c != 0x2D { return nil }          // "-"
            case 10: if c != 0x20 { return nil }             // " "
            case 13: if c != 0x3A { return nil }             // ":"
            default: if digit(c) == nil { return nil }
            }
        }
        func num(_ r: Range<Int>) -> Int { r.reduce(0) { $0 * 10 + digit(b[$1])! } }
        let y = num(0..<4), m = num(5..<7), d = num(8..<10)
        guard m >= 1, m <= 12, d >= 1, d <= daysInMonth(y, m) else { return nil }
        return CivilDate(y: y, m: m, d: d)
    }

    private static func floorDiv(_ a: Int, _ b: Int) -> Int {
        let q = a / b
        return (a % b != 0 && (a < 0) != (b < 0)) ? q - 1 : q
    }

    /// Days from 1970-01-01 (H. Hinnant's days_from_civil), identical to the TS twin.
    static func daysFromCivil(_ c: CivilDate) -> Int {
        let yy = c.m <= 2 ? c.y - 1 : c.y
        let era = floorDiv(yy, 400)
        let yoe = yy - era * 400
        let mp = c.m > 2 ? c.m - 3 : c.m + 9
        let doy = (153 * mp + 2) / 5 + c.d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    static func civilDate(of instant: Date, in tz: TimeZone) -> CivilDate {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        let c = cal.dateComponents([.year, .month, .day], from: instant)
        return CivilDate(y: c.year!, m: c.month!, d: c.day!)
    }

    static func daysBetween(_ obs: CivilDate, _ today: CivilDate) -> Int {
        daysFromCivil(today) - daysFromCivil(obs)
    }

    /// "Today", "Yesterday", "N days ago"; a future-dated report reads "Today".
    static func recencyLabel(_ days: Int) -> String {
        if days <= 0 { return "Today" }
        if days == 1 { return "Yesterday" }
        return "\(days) days ago"
    }
}
