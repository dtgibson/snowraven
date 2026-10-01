// `alerts/inbox.json`, version 1 (ios-alerts, schema.md 3.4): the inbox, and
// the seven-day dedupe DERIVED from it (there is no second dedupe document).
// The twin of `evictInbox` / `applyCandidates` in
// frontend/src/lib/alerts/alertRules.ts; the parity fixture pins both.
//
// Validated PER ROW: a malformed row is dropped and the rest are kept, then
// the survivors are re-sorted and re-capped, so the 30-day / 200-row bound
// holds on load as well as on every write (NFR-04).

import Foundation

struct InboxPoint: Codable, Equatable, Sendable {
    var lat: Double
    var lng: Double

    init(lat: Double, lng: Double) { self.lat = lat; self.lng = lng }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, ["lat", "lng"])
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lat = try c.decode(Double.self, forKey: .lat)
        lng = try c.decode(Double.self, forKey: .lng)
    }

    var isValid: Bool { AlertValidate.lat(lat) && AlertValidate.lng(lng) }
}

struct InboxRow: Codable, Equatable, Sendable {
    var id: String
    var checkId: String
    var speciesCode: String
    var comName: String
    var locId: String
    var locName: String
    var lat: Double
    var lng: Double
    var obsDt: String
    var distanceMi: Double
    var point: InboxPoint
    var radiusMi: Int
    var place: PlacePhrase
    var alertedAt: String
    var updatedAt: String

    static let fieldNames: Set<String> = [
        "id", "checkId", "speciesCode", "comName", "locId", "locName", "lat", "lng", "obsDt", "distanceMi",
        "point", "radiusMi", "place", "alertedAt", "updatedAt",
    ]

    init(id: String, checkId: String, speciesCode: String, comName: String, locId: String, locName: String,
         lat: Double, lng: Double, obsDt: String, distanceMi: Double, point: InboxPoint, radiusMi: Int,
         place: PlacePhrase, alertedAt: String, updatedAt: String) {
        self.id = id; self.checkId = checkId; self.speciesCode = speciesCode; self.comName = comName
        self.locId = locId; self.locName = locName; self.lat = lat; self.lng = lng; self.obsDt = obsDt
        self.distanceMi = distanceMi; self.point = point; self.radiusMi = radiusMi; self.place = place
        self.alertedAt = alertedAt; self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, InboxRow.fieldNames)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        checkId = try c.decode(String.self, forKey: .checkId)
        speciesCode = try c.decode(String.self, forKey: .speciesCode)
        comName = try c.decode(String.self, forKey: .comName)
        locId = try c.decode(String.self, forKey: .locId)
        locName = try c.decode(String.self, forKey: .locName)
        lat = try c.decode(Double.self, forKey: .lat)
        lng = try c.decode(Double.self, forKey: .lng)
        obsDt = try c.decode(String.self, forKey: .obsDt)
        distanceMi = try c.decode(Double.self, forKey: .distanceMi)
        point = try c.decode(InboxPoint.self, forKey: .point)
        radiusMi = try c.decode(Int.self, forKey: .radiusMi)
        place = try c.decode(PlacePhrase.self, forKey: .place)
        alertedAt = try c.decode(String.self, forKey: .alertedAt)
        updatedAt = try c.decode(String.self, forKey: .updatedAt)
    }

    var isValid: Bool {
        AlertValidate.uuid(id) && AlertValidate.uuid(checkId) && AlertValidate.speciesCode(speciesCode)
            && JSText.length(comName) >= 1 && JSText.length(comName) <= AlertRules.recordMaxUnits
            && AlertValidate.noControls(comName)
            && (locId.isEmpty || AlertValidate.locId(locId))
            && JSText.length(locName) <= AlertRules.recordMaxUnits
            && AlertValidate.lat(lat) && AlertValidate.lng(lng)
            && ObsDate.parse(obsDt) != nil
            && distanceMi.isFinite && distanceMi >= 0
            && point.isValid && AlertValidate.radius(radiusMi) && place.isValid
            && AlertValidate.time(alertedAt) && AlertValidate.time(updatedAt)
    }
}

/// One check's context for the inbox (the TS `CheckContext`).
struct CheckContext: Sendable {
    let now: Date
    let checkId: String
    let point: Coordinate
    let radiusMi: Int
    let place: PlacePhrase
    /// Fresh row ids, taken in order for each new row.
    let ids: [String]
}

enum AlertsInbox {
    static let currentVersion = 1

    /// Newest alerted first; ties by species code, then id (code units).
    static func inboxOrder(_ a: InboxRow, _ b: InboxRow) -> Bool {
        let t = JSText.compare(a.alertedAt, b.alertedAt)
        if t != 0 { return t > 0 }
        let s = JSText.compare(a.speciesCode, b.speciesCode)
        if s != 0 { return s < 0 }
        return JSText.compare(a.id, b.id) < 0
    }

    /// The bound: drop rows 30 days past their alerted time, and rows whose
    /// alerted or updated time is more than 24 hours ahead (the device clock
    /// wrote them, so such a time is implausible; kept, a future alerted time
    /// would never age out and would hold back the species' next alert), then
    /// keep the newest 200 in inbox order. Idempotent. A row whose times do not
    /// parse is dropped (it could never pass the row validator anyway).
    static func evict(_ rows: [InboxRow], now: Date) -> [InboxRow] {
        let kept = rows.filter { r in
            guard let at = WidgetTime.parse(r.alertedAt), let up = WidgetTime.parse(r.updatedAt) else { return false }
            return now.timeIntervalSince(at) < AlertRules.retentionSeconds
                && at.timeIntervalSince(now) <= AlertRules.futureSkewSeconds
                && up.timeIntervalSince(now) <= AlertRules.futureSkewSeconds
        }
        return Array(kept.sorted(by: inboxOrder).prefix(AlertRules.maxRows))
    }

    /// The rows at these bytes: each row validated on its own (a malformed row
    /// is dropped, the rest kept), then evicted and ordered. An absent,
    /// oversized or non-document file reads as an empty inbox.
    static func decode(_ data: Data, now: Date) -> [InboxRow] {
        read(data, now: now).rows
    }

    /// `decode`, and whether the read LEFT OUT anything the bytes held: a
    /// refused document, a malformed row, a row past its 30 days or its future
    /// bound, a row past the 200. The engine then writes the result back, so
    /// the bound holds on disk and not only in what is shown (security review
    /// L2). A read that only re-orders reports nothing.
    static func read(_ data: Data, now: Date) -> (rows: [InboxRow], leftOut: Bool) {
        guard data.count <= AlertsFiles.inboxMaxBytes,
              let any = try? JSONSerialization.jsonObject(with: data), let obj = any as? [String: Any],
              Set(obj.keys) == ["version", "rows"],
              let v = obj["version"] as? NSNumber, CFGetTypeID(v) != CFBooleanGetTypeID(), v.intValue == currentVersion,
              v.doubleValue == Double(currentVersion),
              let raw = obj["rows"] as? [Any] else { return ([], true) }
        var rows: [InboxRow] = []
        rows.reserveCapacity(min(raw.count, AlertRules.maxRows))
        let decoder = JSONDecoder()
        for element in raw {
            guard element is [String: Any],
                  let d = try? JSONSerialization.data(withJSONObject: element),
                  let r = try? decoder.decode(InboxRow.self, from: d), r.isValid else { continue }
            rows.append(r)
        }
        let kept = evict(rows, now: now)
        return (kept, kept.count != raw.count)
    }

    private struct Doc: Encodable { let version: Int; let rows: [InboxRow] }

    /// The bytes to write: every row validated (the write chokepoint), then
    /// evicted, so no out-of-bound row can exist in the document.
    static func encoded(_ rows: [InboxRow], now: Date) -> Data? {
        let valid = evict(rows.filter(\.isValid), now: now)
        guard let d = try? JSONEncoder().encode(Doc(version: currentVersion, rows: valid)),
              d.count <= AlertsFiles.inboxMaxBytes else { return nil }
        return d
    }

    /// Apply one check's candidates (FR-24, FR-27): a species whose most recent
    /// row is inside seven days updates THAT row's sighting fields and is not a
    /// hit; any other candidate is a hit and gets a new row.
    static func applyCandidates(_ rows: [InboxRow], _ candidates: [AlertHit], _ ctx: CheckContext)
        -> (rows: [InboxRow], hits: [AlertHit]) {
        let now = WidgetTime.string(ctx.now)
        var out = rows
        var latest: [String: Int] = [:]
        for (i, r) in out.enumerated() {
            if let p = latest[r.speciesCode] {
                if JSText.compare(r.alertedAt, out[p].alertedAt) > 0 { latest[r.speciesCode] = i }
            } else {
                latest[r.speciesCode] = i
            }
        }
        var hits: [AlertHit] = []
        var next = 0
        for c in candidates {
            if let i = latest[c.speciesCode], let at = WidgetTime.parse(out[i].alertedAt),
               ctx.now.timeIntervalSince(at) < AlertRules.dedupeSeconds {
                out[i].locId = c.locId
                out[i].locName = c.locName
                out[i].lat = c.lat
                out[i].lng = c.lng
                out[i].obsDt = c.obsDt
                out[i].distanceMi = c.distanceMi
                out[i].point = InboxPoint(lat: ctx.point.lat, lng: ctx.point.lng)
                out[i].radiusMi = ctx.radiusMi
                out[i].place = ctx.place
                out[i].updatedAt = now
                continue
            }
            hits.append(c)
            let id = next < ctx.ids.count ? ctx.ids[next] : ""
            next += 1
            out.append(InboxRow(
                id: id, checkId: ctx.checkId, speciesCode: c.speciesCode, comName: c.comName, locId: c.locId,
                locName: c.locName, lat: c.lat, lng: c.lng, obsDt: c.obsDt, distanceMi: c.distanceMi,
                point: InboxPoint(lat: ctx.point.lat, lng: ctx.point.lng), radiusMi: ctx.radiusMi, place: ctx.place,
                alertedAt: now, updatedAt: now))
        }
        return (evict(out, now: ctx.now), hits)
    }
}
