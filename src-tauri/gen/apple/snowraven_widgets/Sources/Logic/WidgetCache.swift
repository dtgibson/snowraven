// The widget's own cache document (ios-lifer-widgets, schema.md section 3):
// `<App Group>/widgets/cache.json`, written by the extension only (Alerts reads
// its cell). Both kinds and every placed instance share it, so two placed
// widgets of any kind, window or media value make at most one eBird request
// per 15 minutes per device (FR-24, NFR-03). Since widget-measure-from-choice
// that holds per Measure from choice: widgets set to Default Location keep a
// second document of this same shape, `cache-default-location.json`, so a
// home screen that mixes the two makes at most one request per 15 minutes for
// each (`AppGroup.cacheFileName(for:)`). It holds the reduced records and the
// fetch time; distances, recency and window membership are recomputed on every
// refresh, never stored. The key itself is never written here, only a fingerprint, and
// a hand-over whose key fingerprint differs makes the cache invalid (FR-25).
//
// Validated on read like the hand-over: any failure means "no cache", never a
// partially used one.

import CryptoKit
import Foundation

/// Where a cache cell's search area came from (ios-alerts, security review
/// L7): a position the widget read from the device, or the saved Default
/// Location, as My location's fallback or because the widget is set to
/// measure from it (widget-measure-from-choice). Data provenance only:
/// the widget writes it and never reads it, and nothing it shows changes.
/// Alerts, which can measure My location from the cell, accepts only `device`.
enum CellSource: String, Codable, Equatable, Sendable {
    case device
    case defaultLocation = "default-location"
}

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
    /// Where `cell` came from. Absent in a cache written before ios-alerts,
    /// which still decodes (as unmarked); an unknown value refuses the cache
    /// like any other malformed field. Not part of the freshness comparison.
    var cellSource: CellSource? = nil

    static let currentVersion = 1
    /// eBird's `dist`, computed as the app's handlers compute it.
    static let distKm = Int((25 * 1.60934).rounded())
    static let freshSeconds: TimeInterval = 15 * 60
    static let staleLimitSeconds: TimeInterval = 24 * 60 * 60

    /// A HOLD-ONLY document's fetch time (widget-measure-from-choice, security
    /// review L1). A 429 in an area with no usable document writes one, so the
    /// hold persists and the other area sees it. The epoch is a time no
    /// refresh ever fetched at: the engine reads it as no fetch at all (never a
    /// fresh or stale list, no "Last updated"), and it is far older than
    /// `staleLimitSeconds` and Alerts' 24-hour window, so Alerts' My location
    /// never takes its cell as a device position.
    static let holdOnlyFetchedAt = "1970-01-01T00:00:00Z"

    var isHoldOnly: Bool { fetchedAt == WidgetCache.holdOnlyFetchedAt }

    /// The hold-only document: the hold, the refresh's cell and where it came
    /// from, the key as a fingerprint only, and no records.
    static func holdOnly(keyFingerprint: String, cell: CacheCell, cellSource: CellSource, until: Date, at: Date) -> WidgetCache {
        WidgetCache(version: currentVersion, keyFingerprint: keyFingerprint, cell: cell, fetchedAt: holdOnlyFetchedAt,
                    records: [], backoff: CacheBackoff(until: WidgetTime.string(until), reason: "429"),
                    lastFailure: CacheFailure(at: WidgetTime.string(at), kind: .rateLimited), cellSource: cellSource)
    }

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
