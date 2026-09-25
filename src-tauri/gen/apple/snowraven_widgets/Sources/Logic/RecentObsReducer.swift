// The eBird body to widget records (ios-lifer-widgets, schema.md section 6.1),
// the twin of `reduceWidgetRecords` in frontend/src/lib/widgets/widgetRows.ts,
// which itself calls the app's shared reducer (frontend/src/lib/recentObsReduce.ts).
//
// In order, matching the TypeScript exactly:
//   1. Sanitize: skip a non-object element and a record with a string field
//      over 512 UTF-16 units; read a non-string string field as "".
//   2. Reduce, the app's rule: one record per (speciesCode, locId); the FIRST
//      record for a pair supplies its fields; a later record with a strictly
//      greater `obsDt` (UTF-16 comparison, chronological for eBird's shape)
//      replaces the date and the `subId`. Records whose `lat`/`lng` is not a
//      number are skipped (a JSON boolean is not a number, as in JS).
//   3. Drop a record with no species code, coordinates out of range, or a date
//      the strict parse refuses (FR-13).
// Linear: one pass, a dictionary keyed on the bounded code|locId string.

import Foundation

struct WidgetRecord: Codable, Equatable {
    let speciesCode: String
    let comName: String
    let locId: String
    let locName: String
    let lat: Double
    let lng: Double
    let obsDt: String
    let subId: String
}

enum RecentObsReducer {
    static let maxStringUnits = 512
    static let maxRecords = 20_000
    private static let stringFields = ["speciesCode", "comName", "locId", "locName", "obsDt", "subId"]

    /// nil when the bytes are not a JSON array (malformed body).
    static func reduce(body data: Data) -> [WidgetRecord]? {
        guard let any = try? JSONSerialization.jsonObject(with: data), let array = any as? [Any] else { return nil }
        return reduce(array)
    }

    private static func number(_ v: Any?) -> Double? {
        guard let n = v as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
        let d = n.doubleValue
        return d.isNaN ? nil : d
    }

    static func reduce(_ array: [Any]) -> [WidgetRecord] {
        var order: [String] = []
        var groups: [String: (rec: [String: String], lat: Double, lng: Double)] = [:]
        for element in array {
            guard let obj = element as? [String: Any] else { continue }
            var fields: [String: String] = [:]
            var tooLong = false
            for f in stringFields {
                let s = (obj[f] as? String) ?? ""
                if JSText.length(s) > maxStringUnits { tooLong = true; break }
                fields[f] = s
            }
            if tooLong { continue }
            guard let lat = number(obj["lat"]), let lng = number(obj["lng"]) else { continue }
            let key = "\(fields["speciesCode"]!)|\(fields["locId"]!)"
            if var g = groups[key] {
                if JSText.compare(fields["obsDt"]!, g.rec["obsDt"]!) > 0 {
                    g.rec["obsDt"] = fields["obsDt"]
                    g.rec["subId"] = fields["subId"]
                    groups[key] = g
                }
            } else {
                groups[key] = (fields, lat, lng)
                order.append(key)
            }
        }
        var out: [WidgetRecord] = []
        out.reserveCapacity(order.count)
        for key in order {
            let g = groups[key]!
            let code = g.rec["speciesCode"]!
            if code.isEmpty { continue }
            guard (-90...90).contains(g.lat), (-180...180).contains(g.lng) else { continue }
            guard ObsDate.parse(g.rec["obsDt"]!) != nil else { continue }
            out.append(WidgetRecord(
                speciesCode: code, comName: g.rec["comName"]!, locId: g.rec["locId"]!, locName: g.rec["locName"]!,
                lat: g.lat, lng: g.lng, obsDt: g.rec["obsDt"]!, subId: g.rec["subId"]!))
        }
        return out
    }
}
