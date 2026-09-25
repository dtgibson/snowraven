// The widget's list (ios-lifer-widgets, schema.md section 6.6), the twin of
// `buildWidgetRows` in frontend/src/lib/widgets/widgetRows.ts, which the parity
// fixture is generated from. In order:
//   1. Kind: Nearby Lifers keeps a record whose folded name is NOT in the
//      hand-over's recorded set; Media Targets keeps it by the media value
//      against the three per-type sets (Any is their union, which is the
//      in-app Media Targets definition).
//   2. Window: Day and Week keep 0...1 / 0...7 calendar days; 30 days applies
//      no filter at all (FR-11).
//   3. One row per species: the nearest record, ties to the most recent
//      `obsDt`, then the smaller `locId` (FR-08).
//   4. Order: distance ascending, then most recent `obsDt`, then the folded
//      name, then the species code, every string comparison by UTF-16 code
//      unit (FR-09).
// Distances are computed from the CURRENT reference point every time and
// never taken from the cache (FR-24).

import Foundation

enum WidgetKind: String, Codable, CaseIterable { case lifers, targets }
enum WidgetWindow: String, Codable, CaseIterable { case day, week, all }
enum WidgetMedia: String, Codable, CaseIterable { case photo, audio, video, any }
enum MediaNeed: String, Codable, CaseIterable { case photo, audio, video }

extension WidgetWindow {
    /// The inclusive day bound, or nil for 30 days (no filter).
    var days: Int? {
        switch self {
        case .day: return 1
        case .week: return 7
        case .all: return nil
        }
    }
}

struct Coordinate: Codable, Equatable {
    let lat: Double
    let lng: Double
}

struct WidgetRow: Codable, Equatable {
    let comName: String
    let speciesCode: String
    let locId: String
    let locName: String
    let lat: Double
    let lng: Double
    let distanceMi: Double
    let distanceText: String
    let daysAgo: Int
    let recency: String
    let obsDt: String
    let subId: String
    let missingMedia: [MediaNeed]
    let label: String
}

enum WidgetRows {
    /// "needs photo", "needs photo and video", "needs photo, audio and video".
    static func needsPhrase(_ missing: [MediaNeed]) -> String {
        let o = MediaNeed.allCases.filter { missing.contains($0) }.map(\.rawValue)
        switch o.count {
        case 0: return ""
        case 1: return "needs \(o[0])"
        case 2: return "needs \(o[0]) and \(o[1])"
        default: return "needs \(o[0]), \(o[1]) and \(o[2])"
        }
    }

    /// One row as VoiceOver reads it (NFR-05): name, the needs phrase under
    /// Any only, the distance with "miles" in full, recency, location name.
    static func rowLabel(comName: String, distanceMi: Double, recency: String, locName: String,
                         missing: [MediaNeed], showNeeds: Bool) -> String {
        let needs = showNeeds ? needsPhrase(missing) : ""
        return "\(comName)\(needs.isEmpty ? "" : ", \(needs)"), \(Distance.toFixed1(distanceMi)) miles, \(recency), \(locName)."
    }

    static func build(records: [WidgetRecord], handover: Handover, kind: WidgetKind, window: WidgetWindow,
                      media: WidgetMedia, reference: Coordinate, now: Date, tz: TimeZone) -> [WidgetRow] {
        let recorded = Set(handover.recorded)
        let sets: [MediaNeed: Set<String>] = [
            .photo: Set(handover.targetsMissingPhoto),
            .audio: Set(handover.targetsMissingAudio),
            .video: Set(handover.targetsMissingVideo),
        ]
        let today = ObsDate.civilDate(of: now, in: tz)

        struct Candidate { let rec: WidgetRecord; let fold: String; let dist: Double; let days: Int; let missing: [MediaNeed] }
        var best: [String: Candidate] = [:]

        for rec in records {
            let fold = SpeciesName.fold(rec.comName)
            var missing: [MediaNeed] = []
            switch kind {
            case .lifers:
                if recorded.contains(fold) { continue }
            case .targets:
                if media == .any {
                    missing = MediaNeed.allCases.filter { sets[$0]!.contains(fold) }
                    if missing.isEmpty { continue }
                } else {
                    let need = MediaNeed(rawValue: media.rawValue)!
                    if !sets[need]!.contains(fold) { continue }
                    missing = [need]
                }
            }
            guard let date = ObsDate.parse(rec.obsDt) else { continue }
            let days = ObsDate.daysBetween(date, today)
            if let bound = window.days, !(days >= 0 && days <= bound) { continue }
            let dist = Distance.miles(reference.lat, reference.lng, rec.lat, rec.lng)
            let cand = Candidate(rec: rec, fold: fold, dist: dist, days: days, missing: missing)
            if let prev = best[rec.speciesCode] {
                let better = dist < prev.dist
                    || (dist == prev.dist && (JSText.compare(rec.obsDt, prev.rec.obsDt) > 0
                        || (rec.obsDt == prev.rec.obsDt && JSText.compare(rec.locId, prev.rec.locId) < 0)))
                if better { best[rec.speciesCode] = cand }
            } else {
                best[rec.speciesCode] = cand
            }
        }

        let ordered = best.values.sorted { x, y in
            if x.dist != y.dist { return x.dist < y.dist }
            let byDate = JSText.compare(x.rec.obsDt, y.rec.obsDt)
            if byDate != 0 { return byDate > 0 }
            let byName = JSText.compare(x.fold, y.fold)
            if byName != 0 { return byName < 0 }
            return JSText.compare(x.rec.speciesCode, y.rec.speciesCode) < 0
        }

        let showNeeds = kind == .targets && media == .any
        return ordered.map { c in
            let recency = ObsDate.recencyLabel(c.days)
            return WidgetRow(
                comName: c.rec.comName, speciesCode: c.rec.speciesCode, locId: c.rec.locId, locName: c.rec.locName,
                lat: c.rec.lat, lng: c.rec.lng, distanceMi: c.dist, distanceText: Distance.format(c.dist),
                daysAgo: c.days, recency: recency, obsDt: c.rec.obsDt, subId: c.rec.subId, missingMedia: c.missing,
                label: rowLabel(comName: c.rec.comName, distanceMi: c.dist, recency: recency, locName: c.rec.locName,
                                missing: c.missing, showNeeds: showNeeds))
        }
    }
}
