// One refresh, end to end (ios-lifer-widgets, FR-17 to FR-29, NFR-03), as a
// pure actor over injected seams, so every rule is tested without WidgetKit,
// CoreLocation or the network (snowraven_widgetsTests). The Widget/ layer
// supplies the real seams.
//
// THE STATE PRECEDENCE (FR-29): S1 no hand-over, S2 no key, S3 no backup, then
// for Media Targets S4 no export and S5 nothing missing for the media value,
// then S6 no location and no Default Location (no request), then the fetch
// outcome (S11 key rejected, S8 unreachable with no usable last good list, S9
// the last good list marked), then S10 zero rows. S7 composes with a list, S9
// and S10. Nothing before S6 reads location or touches the network.
//
// ETIQUETTE (NFR-03): at most one request per refresh, none while the shared
// cache is fresh (same cell, same key, under 15 minutes), none while a 429
// backoff is running. The actor serializes refreshes, so two widgets refreshing
// at once make one request between them. A 429 or a failure is never stored as
// a result: the records and fetch time stay as they were, and only the failure
// (and a 429's backoff) is written beside them.

import Foundation

enum FetchResult: Equatable {
    case ok(Data)
    case status(Int, retryAfter: String?)
    case offline
    case timeout
    case tooLarge
}

enum LocationResult: Equatable {
    case located(Coordinate)
    case unavailable
}

protocol WidgetTransport: Sendable {
    func fetch(_ request: URLRequest) async -> FetchResult
}

protocol WidgetLocator: Sendable {
    func currentLocation() async -> LocationResult
}

protocol WidgetStore: Sendable {
    func readHandover() -> HandoverRead
    func readCache() -> WidgetCache?
    func writeCache(_ cache: WidgetCache)
}

actor RefreshEngine {
    /// The planned timeline cadence (FR-22). WidgetKit's budget decides what
    /// actually happens; the footer's update time is the honesty mechanism.
    static let cadenceSeconds: TimeInterval = 30 * 60

    private let store: WidgetStore
    private let transport: WidgetTransport
    private let locator: WidgetLocator
    private let clock: @Sendable () -> Date
    private let tz: @Sendable () -> TimeZone

    init(store: WidgetStore, transport: WidgetTransport, locator: WidgetLocator,
         clock: @escaping @Sendable () -> Date = { Date() },
         tz: @escaping @Sendable () -> TimeZone = { TimeZone.current }) {
        self.store = store
        self.transport = transport
        self.locator = locator
        self.clock = clock
        self.tz = tz
    }

    static func targetSetEmpty(_ h: Handover, _ media: WidgetMedia) -> Bool {
        switch media {
        case .photo: return h.targetsMissingPhoto.isEmpty
        case .audio: return h.targetsMissingAudio.isEmpty
        case .video: return h.targetsMissingVideo.isEmpty
        case .any: return h.targetsMissingPhoto.isEmpty && h.targetsMissingAudio.isEmpty && h.targetsMissingVideo.isEmpty
        }
    }

    func refresh(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia) async -> WidgetModel {
        let now = clock()
        func message(_ s: WidgetState, lastSuccess: Date? = nil, usedDefault: Bool = false) -> WidgetModel {
            .message(kind: kind, window: window, media: media, state: s, now: now, lastSuccess: lastSuccess, usedDefault: usedDefault)
        }

        guard case .valid(let h) = store.readHandover() else { return message(.noHandover) }
        guard let key = h.ebirdKey else { return message(.noKey) }
        guard h.hasEbirdBackup else { return message(.noBackup) }
        if kind == .targets {
            guard h.hasMlExport else { return message(.noExport) }
            if RefreshEngine.targetSetEmpty(h, media) { return message(.nothingMissing) }
        }

        var reference: Coordinate
        var usedDefault = false
        switch await locator.currentLocation() {
        case .located(let c):
            reference = c
        case .unavailable:
            guard let d = h.defaultLocation else { return message(.noLocation) }
            reference = Coordinate(lat: d.lat, lng: d.lng)
            usedDefault = true
        }

        let now2 = clock()
        let cell = WidgetCache.cell(for: reference)
        let fp = WidgetCache.fingerprint(key)
        var cache = store.readCache()
        if let c = cache, c.keyFingerprint != fp { cache = nil }            // FR-25
        let fetchedAt = cache.flatMap { WidgetTime.parse($0.fetchedAt) }

        func list(_ records: [WidgetRecord], fetched: Date, stale: StaleReason?, next: Date) -> WidgetModel {
            let rows = WidgetRows.build(records: records, handover: h, kind: kind, window: window, media: media,
                                        reference: reference, now: now2, tz: tz())
            return WidgetModel(kind: kind, window: window, media: media, state: rows.isEmpty ? .empty : .list,
                               rows: rows, usedDefaultLocation: usedDefault, stale: stale, updatedAt: fetched,
                               lastSuccess: fetched, nextRefresh: next)
        }
        let cadenceNext = now2.addingTimeInterval(RefreshEngine.cadenceSeconds)

        // Fresh: zero requests (FR-22, FR-24).
        if let c = cache, let f = fetchedAt, c.cell == cell, now2 >= f,
           now2.timeIntervalSince(f) < WidgetCache.freshSeconds {
            return list(c.records, fetched: f, stale: nil, next: cadenceNext)
        }

        func failed(_ failure: FailureKind, backoffUntil: Date? = nil) -> WidgetModel {
            if var c = cache {
                c.lastFailure = CacheFailure(at: WidgetTime.string(now2), kind: failure)
                if let until = backoffUntil { c.backoff = CacheBackoff(until: WidgetTime.string(until), reason: "429") }
                store.writeCache(c)
            }
            let next = max(cadenceNext, backoffUntil ?? cadenceNext)
            if let c = cache, let f = fetchedAt, now2 >= f, now2.timeIntervalSince(f) < WidgetCache.staleLimitSeconds {
                let reason: StaleReason = (failure == .offline || failure == .timeout) ? .offline : .busy
                return list(c.records, fetched: f, stale: reason, next: next)
            }
            return WidgetModel(kind: kind, window: window, media: media, state: .unreachable, rows: [],
                               usedDefaultLocation: usedDefault, stale: nil, updatedAt: nil,
                               lastSuccess: fetchedAt, nextRefresh: next)
        }

        // A 429 backoff still running: no request this refresh (FR-26).
        if let b = cache?.backoff, let until = WidgetTime.parse(b.until), until > now2 {
            return failed(.rateLimited, backoffUntil: until)
        }

        guard let request = EBirdRequest.make(for: reference, key: key) else { return message(.noHandover) }
        // One payload at a time (NFR-02, schema.md 6.5): the body's last
        // reference is `decode`'s argument, so it is released when that call
        // returns, before the cache is written or a row is built. A `switch`
        // over the fetch itself would keep the body alive to the end of the
        // case, beside everything built from it (measured: DenseBodyTests).
        switch RefreshEngine.decode(await transport.fetch(request)) {
        case .malformed:
            return failed(.malformed)
        case .records(let records):
            let fresh = WidgetCache(version: WidgetCache.currentVersion, keyFingerprint: fp, cell: cell,
                                    fetchedAt: WidgetTime.string(now2), records: records, backoff: nil, lastFailure: nil)
            store.writeCache(fresh)
            return list(records, fetched: WidgetTime.parse(fresh.fetchedAt) ?? now2, stale: nil, next: cadenceNext)
        case .status(let code, _) where code == 401 || code == 403:
            return message(.keyRejected, usedDefault: usedDefault)
        case .status(429, let retryAfter):
            let seconds = TimeInterval(RetryAfter.parseSeconds(retryAfter) ?? 0)
            let until = now2.addingTimeInterval(max(RefreshEngine.cadenceSeconds, seconds))
            return failed(.rateLimited, backoffUntil: until)
        case .status:
            return failed(.http)
        case .offline:
            return failed(.offline)
        case .timeout:
            return failed(.timeout)
        case .tooLarge:
            return failed(.tooLarge)
        }
    }

    /// A fetch outcome with the body already reduced, so it holds no payload.
    enum Fetched: Equatable {
        case records([WidgetRecord])
        case malformed
        case status(Int, retryAfter: String?)
        case offline
        case timeout
        case tooLarge
    }

    /// The body decoded once, here, and nowhere else.
    static func decode(_ result: FetchResult) -> Fetched {
        switch result {
        case .ok(let data):
            guard let records = RecentObsReducer.reduce(body: data), records.count <= RecentObsReducer.maxRecords else {
                return .malformed
            }
            return .records(records)
        case .status(let code, let retryAfter): return .status(code, retryAfter: retryAfter)
        case .offline: return .offline
        case .timeout: return .timeout
        case .tooLarge: return .tooLarge
        }
    }
}
