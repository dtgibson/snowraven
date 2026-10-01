// `alerts/state.json`, version 1 (ios-alerts, schema.md 3.3): the last check,
// the 429 hold, the app's most recent known position (My location only), the
// deferred summary, and what was last asked of BGTaskScheduler.
//
// A document that fails validation reads as the fresh-install state, and the
// next check rewrites it. The key is never copied here: no field can hold it,
// so its absence is structural (the validator has no key field).

import Foundation

/// "near <name>", "near you", "nearby" (FR-29).
enum PlacePhrase: Codable, Equatable, Sendable {
    case name(String)
    case nearYou
    case nearby

    private enum K: String, CodingKey { case kind, name }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, ["kind", "name"])
        let c = try decoder.container(keyedBy: K.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "name": self = .name(try c.decode(String.self, forKey: .name))
        case "near-you":
            guard !c.contains(.name) else { throw StrictKeys.Refused() }
            self = .nearYou
        case "nearby":
            guard !c.contains(.name) else { throw StrictKeys.Refused() }
            self = .nearby
        default: throw StrictKeys.Refused()
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: K.self)
        switch self {
        case .name(let n): try c.encode("name", forKey: .kind); try c.encode(n, forKey: .name)
        case .nearYou: try c.encode("near-you", forKey: .kind)
        case .nearby: try c.encode("nearby", forKey: .kind)
        }
    }

    var isValid: Bool {
        if case .name(let n) = self { return AlertValidate.displayName(n, max: AlertRules.placeNameMaxUnits) }
        return true
    }
}

/// The six last-check outcomes (design-spec section 4): `unreachable` is a
/// request that got no answer (offline, timeout); `no-answer` is an answer
/// that came back unusable (any status but 200/429/401/403, an oversized or
/// malformed body, or a hand-over without the two countability lists).
enum AlertOutcome: String, Codable, Sendable, CaseIterable {
    case nothingNew = "nothing-new"
    case hits
    case unreachable
    case noAnswer = "no-answer"
    case busy
    case keyRejected = "key-rejected"
}

enum CheckFrom: String, Codable, Sendable {
    case fixed
    case myLocation = "my-location"
    case fixedFallback = "fixed-fallback"
}

struct LastCheck: Codable, Equatable, Sendable {
    var completedAt: String
    var outcome: AlertOutcome
    var hits: Int
    var from: CheckFrom
    var checkId: String

    static let fieldNames: Set<String> = ["completedAt", "outcome", "hits", "from", "checkId"]

    init(completedAt: String, outcome: AlertOutcome, hits: Int, from: CheckFrom, checkId: String) {
        self.completedAt = completedAt; self.outcome = outcome; self.hits = hits; self.from = from; self.checkId = checkId
    }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, LastCheck.fieldNames)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        completedAt = try c.decode(String.self, forKey: .completedAt)
        outcome = try c.decode(AlertOutcome.self, forKey: .outcome)
        hits = try c.decode(Int.self, forKey: .hits)
        from = try c.decode(CheckFrom.self, forKey: .from)
        checkId = try c.decode(String.self, forKey: .checkId)
    }

    var isValid: Bool {
        AlertValidate.time(completedAt) && hits >= 0 && hits <= AlertRules.pendingMax * 100 && AlertValidate.uuid(checkId)
            && (outcome == .hits ? hits > 0 : hits == 0)
    }
}

enum PositionSource: String, Codable, Sendable { case seed, foreground }

struct StoredPosition: Codable, Equatable, Sendable {
    var lat: Double
    var lng: Double
    var at: String
    var source: PositionSource

    init(lat: Double, lng: Double, at: String, source: PositionSource) {
        self.lat = lat; self.lng = lng; self.at = at; self.source = source
    }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, ["lat", "lng", "at", "source"])
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lat = try c.decode(Double.self, forKey: .lat)
        lng = try c.decode(Double.self, forKey: .lng)
        at = try c.decode(String.self, forKey: .at)
        source = try c.decode(PositionSource.self, forKey: .source)
    }

    var isValid: Bool { AlertValidate.lat(lat) && AlertValidate.lng(lng) && AlertValidate.time(at) }
}

struct PendingHit: Codable, Equatable, Sendable {
    var speciesCode: String
    var comName: String
    var locId: String
    var distanceMi: Double
    var link: String

    init(speciesCode: String, comName: String, locId: String, distanceMi: Double, link: String) {
        self.speciesCode = speciesCode; self.comName = comName; self.locId = locId; self.distanceMi = distanceMi
        self.link = link
    }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, ["speciesCode", "comName", "locId", "distanceMi", "link"])
        let c = try decoder.container(keyedBy: CodingKeys.self)
        speciesCode = try c.decode(String.self, forKey: .speciesCode)
        comName = try c.decode(String.self, forKey: .comName)
        locId = try c.decode(String.self, forKey: .locId)
        distanceMi = try c.decode(Double.self, forKey: .distanceMi)
        link = try c.decode(String.self, forKey: .link)
    }

    var isValid: Bool {
        AlertValidate.speciesCode(speciesCode)
            && JSText.length(comName) >= 1 && JSText.length(comName) <= AlertRules.recordMaxUnits
            && AlertValidate.noControls(comName)
            && (locId.isEmpty || AlertValidate.locId(locId))
            && distanceMi.isFinite && distanceMi >= 0
            && (link == AlertLink.viewLink || AlertLink.matches(link))
    }
}

struct PendingSummary: Codable, Equatable, Sendable {
    var windowEndAt: String
    var place: PlacePhrase
    var hits: [PendingHit]
    var checkIds: [String]

    init(windowEndAt: String, place: PlacePhrase, hits: [PendingHit], checkIds: [String]) {
        self.windowEndAt = windowEndAt; self.place = place; self.hits = hits; self.checkIds = checkIds
    }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, ["windowEndAt", "place", "hits", "checkIds"])
        let c = try decoder.container(keyedBy: CodingKeys.self)
        windowEndAt = try c.decode(String.self, forKey: .windowEndAt)
        place = try c.decode(PlacePhrase.self, forKey: .place)
        hits = try c.decode([PendingHit].self, forKey: .hits)
        checkIds = try c.decode([String].self, forKey: .checkIds)
    }

    var isValid: Bool {
        AlertValidate.time(windowEndAt) && place.isValid && !hits.isEmpty && hits.count <= AlertRules.pendingMax
            && hits.allSatisfy(\.isValid) && checkIds.count <= AlertRules.pendingMax && checkIds.allSatisfy(AlertValidate.uuid)
    }
}

enum BackgroundRefresh: String, Codable, Sendable { case available, denied, restricted }

struct AlertsStateDoc: Codable, Equatable, Sendable {
    var version: Int
    var lastCheck: LastCheck?
    var holdUntil: String?
    var position: StoredPosition?
    var pending: PendingSummary?
    var scheduledEarliest: String?
    var backgroundRefresh: BackgroundRefresh

    static let currentVersion = 1
    static let fieldNames: Set<String> = [
        "version", "lastCheck", "holdUntil", "position", "pending", "scheduledEarliest", "backgroundRefresh",
    ]
    private enum CodingKeys: String, CodingKey {
        case version, lastCheck, holdUntil, position, pending, scheduledEarliest, backgroundRefresh
    }

    static let fresh = AlertsStateDoc(version: currentVersion, lastCheck: nil, holdUntil: nil, position: nil,
                                      pending: nil, scheduledEarliest: nil, backgroundRefresh: .available)

    init(version: Int, lastCheck: LastCheck?, holdUntil: String?, position: StoredPosition?, pending: PendingSummary?,
         scheduledEarliest: String?, backgroundRefresh: BackgroundRefresh) {
        self.version = version; self.lastCheck = lastCheck; self.holdUntil = holdUntil; self.position = position
        self.pending = pending; self.scheduledEarliest = scheduledEarliest; self.backgroundRefresh = backgroundRefresh
    }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, AlertsStateDoc.fieldNames)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decode(Int.self, forKey: .version)
        lastCheck = try c.decodeIfPresent(LastCheck.self, forKey: .lastCheck)
        holdUntil = try c.decodeIfPresent(String.self, forKey: .holdUntil)
        position = try c.decodeIfPresent(StoredPosition.self, forKey: .position)
        pending = try c.decodeIfPresent(PendingSummary.self, forKey: .pending)
        scheduledEarliest = try c.decodeIfPresent(String.self, forKey: .scheduledEarliest)
        backgroundRefresh = try c.decode(BackgroundRefresh.self, forKey: .backgroundRefresh)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(version, forKey: .version)
        if let v = lastCheck { try c.encode(v, forKey: .lastCheck) } else { try c.encodeNil(forKey: .lastCheck) }
        if let v = holdUntil { try c.encode(v, forKey: .holdUntil) } else { try c.encodeNil(forKey: .holdUntil) }
        if let v = position { try c.encode(v, forKey: .position) } else { try c.encodeNil(forKey: .position) }
        if let v = pending { try c.encode(v, forKey: .pending) } else { try c.encodeNil(forKey: .pending) }
        if let v = scheduledEarliest { try c.encode(v, forKey: .scheduledEarliest) } else { try c.encodeNil(forKey: .scheduledEarliest) }
        try c.encode(backgroundRefresh, forKey: .backgroundRefresh)
    }

    var isValid: Bool {
        guard version == AlertsStateDoc.currentVersion else { return false }
        if let l = lastCheck, !l.isValid { return false }
        if let h = holdUntil, !AlertValidate.time(h) { return false }
        if let p = position, !p.isValid { return false }
        if let p = pending, !p.isValid { return false }
        if let s = scheduledEarliest, !AlertValidate.time(s) { return false }
        return true
    }

    /// The document as the engine may use it at `now` (security review L3,
    /// L4). The device's own clock wrote every time here, so a field that is
    /// implausible against that clock now, or past its use, reads as absent:
    /// * a 429 hold later than the pacing contract's cap from now (no hold is
    ///   ever written longer than `RetryAfter.capSeconds`), so a hold stamped
    ///   while the clock ran ahead cannot stop every check until that date;
    /// * a last check more than 24 hours ahead, which would keep a check from
    ///   ever falling due at activation;
    /// * a position more than 24 hours ahead, or older than the 24 hours after
    ///   which `ResolvePoint` can never use it (it is removed, not kept).
    /// Left alone here: the deferred summary's window end, which has a bound of
    /// its own (26 hours, I8) applied by the engine, because dropping it must
    /// also withdraw its pending request; and the scheduled time (it gates
    /// nothing and every schedule rewrites it).
    func normalized(now: Date) -> AlertsStateDoc {
        func ahead(_ t: String, by limit: TimeInterval) -> Bool {
            guard let d = WidgetTime.parse(t) else { return true }
            return d.timeIntervalSince(now) > limit
        }
        var s = self
        if let h = s.holdUntil, ahead(h, by: TimeInterval(RetryAfter.capSeconds)) { s.holdUntil = nil }
        if let l = s.lastCheck, ahead(l.completedAt, by: AlertRules.futureSkewSeconds) { s.lastCheck = nil }
        if let p = s.position {
            let at = WidgetTime.parse(p.at)
            if at.map({ now.timeIntervalSince($0) > AlertRules.positionMaxAgeSeconds }) ?? true
                || ahead(p.at, by: AlertRules.futureSkewSeconds) { s.position = nil }
        }
        return s
    }

    static func decode(_ data: Data) -> AlertsStateDoc? {
        guard data.count <= AlertsFiles.stateMaxBytes,
              let s = try? JSONDecoder().decode(AlertsStateDoc.self, from: data), s.isValid else { return nil }
        return s
    }

    func encoded() -> Data? {
        guard isValid, let d = try? JSONEncoder().encode(self), d.count <= AlertsFiles.stateMaxBytes else { return nil }
        return d
    }
}
