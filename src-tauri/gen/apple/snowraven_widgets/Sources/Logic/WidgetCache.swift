// The widget's own cache document (ios-lifer-widgets, schema.md section 3):
// `<App Group>/widgets/cache.json`, written and read by the extension only.
// Both kinds and every placed instance share it, so two placed widgets of any
// kind, window or media value make at most one eBird request per 15 minutes
// per device (FR-24, NFR-03). It holds the reduced records and the fetch time;
// distances, recency and window membership are recomputed on every refresh,
// never stored. The key itself is never written here, only a fingerprint, and
// a hand-over whose key fingerprint differs makes the cache invalid (FR-25).
//
// Validated on read like the hand-over: any failure means "no cache", never a
// partially used one.

import CryptoKit
import Foundation

struct CacheCell: Codable, Equatable {
    let lat: Double
    let lng: Double
    let distKm: Int
}

enum FailureKind: String, Codable {
    case offline, timeout, http, malformed
    case tooLarge = "too-large"
    case rateLimited = "429"
}

struct CacheBackoff: Codable, Equatable {
    let until: String
    let reason: String
}

struct CacheFailure: Codable, Equatable {
    let at: String
    let kind: FailureKind
}

struct WidgetCache: Codable, Equatable {
    let version: Int
    let keyFingerprint: String
    let cell: CacheCell
    let fetchedAt: String
    let records: [WidgetRecord]
    var backoff: CacheBackoff?
    var lastFailure: CacheFailure?

    static let currentVersion = 1
    /// eBird's `dist`, computed as the app's handlers compute it.
    static let distKm = Int((25 * 1.60934).rounded())
    static let freshSeconds: TimeInterval = 15 * 60
    static let staleLimitSeconds: TimeInterval = 24 * 60 * 60

    /// The cache key: the reference rounded half away from zero to two
    /// decimals (about 0.7 mi of latitude), plus the fixed radius. It decides
    /// only whether a request is made, never what a row says.
    static func cell(for c: Coordinate) -> CacheCell {
        func round2(_ x: Double) -> Double { (x * 100).rounded(.toNearestOrAwayFromZero) / 100 }
        return CacheCell(lat: round2(c.lat), lng: round2(c.lng), distKm: distKm)
    }

    /// First 16 hex characters of SHA-256 of the key.
    static func fingerprint(_ key: String) -> String {
        String(SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined().prefix(16))
    }

    var isValid: Bool {
        guard version == WidgetCache.currentVersion,
              keyFingerprint.utf8.count == 16,
              keyFingerprint.utf8.allSatisfy({ ($0 >= 0x30 && $0 <= 0x39) || ($0 >= 0x61 && $0 <= 0x66) }),
              cell.lat.isFinite, cell.lng.isFinite, (-90...90).contains(cell.lat), (-180...180).contains(cell.lng),
              cell.distKm == WidgetCache.distKm,
              WidgetTime.parse(fetchedAt) != nil,
              records.count <= RecentObsReducer.maxRecords else { return false }
        for r in records {
            for s in [r.speciesCode, r.comName, r.locId, r.locName, r.obsDt, r.subId]
            where JSText.length(s) > RecentObsReducer.maxStringUnits { return false }
            guard !r.speciesCode.isEmpty, r.lat.isFinite, r.lng.isFinite,
                  (-90...90).contains(r.lat), (-180...180).contains(r.lng),
                  ObsDate.parse(r.obsDt) != nil else { return false }
        }
        if let b = backoff, WidgetTime.parse(b.until) == nil || b.reason != "429" { return false }
        if let f = lastFailure, WidgetTime.parse(f.at) == nil { return false }
        return true
    }

    static func decode(_ data: Data) -> WidgetCache? {
        guard data.count <= AppGroup.cacheMaxBytes,
              let c = try? JSONDecoder().decode(WidgetCache.self, from: data), c.isValid else { return nil }
        return c
    }

    func encoded() -> Data? { try? JSONEncoder().encode(self) }
}
