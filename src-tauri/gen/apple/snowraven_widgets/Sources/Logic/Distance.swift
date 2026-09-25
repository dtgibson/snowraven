// The distance rule (ios-lifer-widgets, schema.md section 6.4), the twin of
// `distanceMiles` in frontend/src/lib/mapExplorerFormat.ts: haversine, R =
// 3958.8 mi, the same operation order as the JavaScript so the two agree to
// well within the fixture's 1e-6 mi tolerance (both are binary64; the
// transcendental functions may differ in the last ulp between engines).
//
// Display is one decimal plus " mi", reproducing JavaScript's `toFixed(1)`
// EXACTLY, including its tie rule (see `JSNumber`). C's `%.1f` rounds an exact
// binary tie to even where `toFixed` rounds it up, so `String(format:)` alone
// would print "0.2 mi" for 0.25 where the app prints "0.3 mi"; the fixture's
// format rows carry those ties.

import Foundation

enum Distance {
    static let earthRadiusMi = 3958.8

    static func miles(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
        let dLat = (lat2 - lat1) * Double.pi / 180
        let dLng = (lng2 - lng1) * Double.pi / 180
        let s1 = sin(dLat / 2)
        let s2 = sin(dLng / 2)
        let a = s1 * s1 + cos(lat1 * Double.pi / 180) * cos(lat2 * Double.pi / 180) * s2 * s2
        return earthRadiusMi * 2 * atan2(a.squareRoot(), (1 - a).squareRoot())
    }

    /// JavaScript `d.toFixed(1)`.
    static func toFixed1(_ d: Double) -> String { JSNumber.toFixed(d, 1) }

    static func format(_ d: Double) -> String { "\(toFixed1(d)) mi" }
}

/// JavaScript `Number.prototype.toFixed`, exactly (ECMA-262 21.1.3.3): the
/// integer n nearest to x * 10^f, and on a tie the LARGER n. Implemented on
/// the double's exact decimal expansion (Darwin's printf prints it exactly),
/// so it agrees with V8 on every input the widget formats, ties included.
enum JSNumber {
    static func toFixed(_ value: Double, _ digits: Int) -> String {
        guard value.isFinite else { return String(value) }
        var x = value
        var sign = ""
        if x < 0 { sign = "-"; x = -x }
        let exact = String(format: "%.120f", x)
        let parts = exact.split(separator: ".", maxSplits: 1)
        var intDigits = Array(parts[0])
        let frac = Array(parts.count > 1 ? parts[1] : "")
        var kept = Array(frac.prefix(digits))
        while kept.count < digits { kept.append("0") }
        let next = frac.count > digits ? frac[digits] : "0"
        if next >= "5" {
            // Increment the decimal string intDigits.kept by one unit in the last place.
            var all = intDigits + kept
            var i = all.count - 1
            var carry = true
            while carry && i >= 0 {
                if all[i] == "9" { all[i] = "0"; i -= 1 } else {
                    all[i] = Character(UnicodeScalar(all[i].asciiValue! + 1)); carry = false
                }
            }
            if carry { all.insert("1", at: 0) }
            intDigits = Array(all.prefix(all.count - digits))
            kept = Array(all.suffix(digits))
        }
        let body = digits > 0 ? String(intDigits) + "." + String(kept) : String(intDigits)
        return sign + body
    }
}
