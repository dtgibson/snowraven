// The check's candidates (ios-alerts, FR-23; schema.md 4.5 steps 1 to 3 and
// 5), the twin of `alertCandidates` in frontend/src/lib/alerts/alertRules.ts:
//
//   0. Rowable: drop a record no inbox row could hold (`isAlertable`, the
//      twin of `isAlertableRecord`; security review L5).
//   1. Subtract: drop a record whose folded name (`SpeciesName.fold`) is in
//      the hand-over's recorded set (already folded by the app).
//   2. Countability: drop a non-countable form (`Countability`).
//   3. One per species: the nearest to the point; on a distance tie the later
//      `obsDt`; on that tie too the smaller `locId` (the widget's row rule).
//   5. Nearest first: distance, then the later `obsDt`, then the folded name,
//      then the species code; every string comparison by UTF-16 code unit.
//
// Escapee exclusion is out of scope (PRD): a species eBird later tags an
// escapee may alert.

import Foundation

struct AlertHit: Codable, Equatable, Sendable {
    let speciesCode: String
    let comName: String
    let locId: String
    let locName: String
    let lat: Double
    let lng: Double
    let obsDt: String
    let distanceMi: Double
}

enum Candidates {
    static func candidates(records: [WidgetRecord], recorded: [String], point: Coordinate,
                           lists: CountabilityLists) -> [AlertHit] {
        let recordedSet = Set(recorded.map(Units.of))
        var best: [String: AlertHit] = [:]
        for r in records {
            guard isAlertable(r) else { continue }
            if recordedSet.contains(Units.of(SpeciesName.fold(r.comName))) { continue }
            if Countability.isNonCountableForm(r.comName, lists: lists) { continue }
            let d = Distance.miles(point.lat, point.lng, r.lat, r.lng)
            let hit = AlertHit(speciesCode: r.speciesCode, comName: r.comName, locId: r.locId, locName: r.locName,
                               lat: r.lat, lng: r.lng, obsDt: r.obsDt, distanceMi: d)
            guard let prev = best[r.speciesCode] else { best[r.speciesCode] = hit; continue }
            let dt = JSText.compare(r.obsDt, prev.obsDt)
            if d < prev.distanceMi
                || (d == prev.distanceMi && (dt > 0 || (dt == 0 && JSText.compare(r.locId, prev.locId) < 0))) {
                best[r.speciesCode] = hit
            }
        }
        return best.values.sorted(by: nearestFirst)
    }

    /// Whether the three fields a hit copies from eBird could be held by an
    /// inbox row (`InboxRow.isValid`'s own predicates): the code in its
    /// pattern, the name 1 to 512 UTF-16 units with no control character, the
    /// location id empty or in its pattern. A record that fails would be
    /// notified, then refused at the inbox's write (and, deferred, at the
    /// state's), leaving nothing to dedupe it, so it would alert on every
    /// check. The reducer admits such a record; only an empty code is dropped.
    static func isAlertable(_ r: WidgetRecord) -> Bool {
        AlertValidate.speciesCode(r.speciesCode)
            && JSText.length(r.comName) >= 1 && JSText.length(r.comName) <= AlertRules.recordMaxUnits
            && AlertValidate.noControls(r.comName)
            && (r.locId.isEmpty || AlertValidate.locId(r.locId))
    }

    static func nearestFirst(_ x: AlertHit, _ y: AlertHit) -> Bool {
        if x.distanceMi != y.distanceMi { return x.distanceMi < y.distanceMi }
        let t = JSText.compare(x.obsDt, y.obsDt)
        if t != 0 { return t > 0 }
        let f = JSText.compare(SpeciesName.fold(x.comName), SpeciesName.fold(y.comName))
        if f != 0 { return f < 0 }
        return JSText.compare(x.speciesCode, y.speciesCode) < 0
    }
}
