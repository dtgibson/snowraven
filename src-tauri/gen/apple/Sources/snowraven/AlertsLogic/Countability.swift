// The app's countability rule on the native side (ios-alerts, schema.md 3.7):
// the twin of `isNonCountableForm` in frontend/src/lib/speciesUtils.ts. The
// DATA (eBird's two exception lists) arrives through the hand-over, exactly as
// the app's artifact holds it; only the three-clause SHAPE rule is twinned:
//
//   rejects.has(name)                      -> not countable
//   counts.has(name)                       -> countable
//   name ends with " sp."
//     || name contains "/"
//     || stripTrailingParenthetical(name) contains " x "   -> not countable
//
// Every comparison is on UTF-16 code units, as JavaScript's are: set
// membership by the unit array (a Swift `Set<String>` would equate canonically
// equivalent names JavaScript keeps apart), and the three string tests by
// units (`String.hasSuffix` / `contains` match grapheme clusters, so a
// combining mark after "/" would hide it from Swift and not from JavaScript).
// Linear: two hash lookups and three unit scans over a name the reducer caps
// at 512 units (schema.md section 13).

import Foundation

/// The two exception lists, keyed by their code units.
struct CountabilityLists: Sendable {
    let rejects: Set<[UInt16]>
    let counts: Set<[UInt16]>

    init(rejects: [String], counts: [String]) {
        self.rejects = Set(rejects.map(Units.of))
        self.counts = Set(counts.map(Units.of))
    }
}

enum Countability {
    static func isNonCountableForm(_ name: String, lists: CountabilityLists) -> Bool {
        let u = Units.of(name)
        if lists.rejects.contains(u) { return true }
        if lists.counts.contains(u) { return false }
        return isNonCountableNameShape(name)
    }

    /// eBird's naming convention, read off the name alone (the app's
    /// `isNonCountableNameShape`). The " x " test reads the name with its
    /// trailing parenthetical stripped, so an intergrade's "(Myrtle x Audubon's)"
    /// stays countable.
    static func isNonCountableNameShape(_ name: String) -> Bool {
        Units.hasSuffix(name, " sp.")
            || Units.contains(name, "/")
            || Units.contains(SpeciesName.stripTrailingParenthetical(name), " x ")
    }
}
