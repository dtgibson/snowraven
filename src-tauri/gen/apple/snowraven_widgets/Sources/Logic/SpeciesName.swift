// The name rule (ios-lifer-widgets, schema.md section 6.3): the twin of the
// app's `normalizeSpeciesName` (frontend/src/lib/speciesUtils.ts,
// `stripTrailingParenthetical`) followed by the default case mapping. The
// hand-over's names were folded by the app at write time, so the extension
// folds only eBird's `comName`.
//
// The algorithm, exactly the app's, on UTF-16 code units: trim; if the result
// does not end with ")" return it; find the last ")" BEFORE the final one;
// find the first "(" AFTER that; none means return the trimmed string; else
// return the prefix before that "(", trimmed. "(" and ")" are single code
// units, so cutting there never splits a surrogate pair.
//
// Stated limit: Swift's `lowercased()` and JS's `toLowerCase()` apply the same
// locale-independent Unicode mapping for every name eBird ships (the fixture
// carries a non-ASCII row), but JS applies the Greek final-sigma rule in
// context and Swift may not. No eBird common name contains a Greek capital
// sigma.

import Foundation

enum SpeciesName {
    static func stripTrailingParenthetical(_ name: String) -> String {
        let all = Array(name.utf16)
        let t = JSText.trim(all[...])
        guard let last = t.last, last == 0x29 else { return JSText.string(t) }
        let closeIdx = t.endIndex - 1
        var prevClose = t.startIndex - 1
        var i = closeIdx - 1
        while i >= t.startIndex {
            if t[i] == 0x29 { prevClose = i; break }
            i -= 1
        }
        var openIdx: Int? = nil
        var j = prevClose + 1
        while j < t.endIndex {
            if t[j] == 0x28 { openIdx = j; break }
            j += 1
        }
        guard let open = openIdx else { return JSText.string(t) }
        return JSText.string(JSText.trim(t[t.startIndex..<open]))
    }

    static func fold(_ name: String) -> String {
        stripTrailingParenthetical(name).lowercased()
    }
}
