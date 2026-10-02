// One refresh, end to end (ios-lifer-widgets, FR-17 to FR-29, NFR-03), as a
// pure actor over injected seams, so every rule is tested without WidgetKit,
// CoreLocation or the network (snowraven_widgetsTests). The Widget/ layer
// supplies the real seams.
//
// THE STATE PRECEDENCE (FR-29): S1 no hand-over, S2 no key, S3 no backup, then
// for Media Targets S4 no export and S5 nothing missing for the media value,
// then the reference point: under My location S6 no location and no Default
// Location, under Default Location S13 no Default Location (neither makes a
// request), then the fetch outcome (S11 key rejected, S8 unreachable with no
// usable last good list, S9 the last good list marked), then S10 zero rows. S7
// composes with a list, S9 and S10. Nothing before S6 / S13 reads location or
// touches the network, and Default Location never reads location at all.
//
// MEASURE FROM (widget-measure-from-choice): the Edit Widget sheet's choice.
// My location is the shipped path to the letter: the device at refresh, else
// the saved Default Location (S7), else S6. Default Location is the saved
// Default Location on every refresh and never calls the locator. Each choice
// has its OWN cache area (`WidgetStore`), so a home screen that mixes the two
// does not refetch every time they alternate.
//
// ETIQUETTE (NFR-03): at most one request per refresh, none while the cache
// area for this choice is fresh (same cell, same key, under 15 minutes), none
// while a 429 backoff is running in EITHER area (the key is over the limit,
// not the area). A 429 in an area with no usable document yet still persists,
// in a hold-only document (`WidgetCache.holdOnly`), so the hold reaches the
// other area in that case too. So widgets on one choice make at most one
// request per 15 minutes between them, and a mixed home screen at most one
// per area. A 429 or a failure is never stored as a result: the records and
// fetch time stay as they were, and only the failure (and a 429's backoff) is
// written beside them.
//
// TAKING TURNS (widget-refresh-take-turns): the actor does NOT serialize
// refreshes. Swift actors are reentrant at every `await`, and WidgetKit can
// run several placed widgets' timelines at once (after a hand-over write, for
// one), so two refreshes of one area can both find it stale. Each area
// therefore has at most one request in flight (`inFlight`), marked in the
// same synchronous step as the cache read that decided to make it. A refresh
// that reaches the request point while its area has a request in flight for
// the same key and cell sends nothing: it waits for that request and builds
// its own widget from the same outcome (a list, a 429 hold or a failure), and
// only the refresh that asked writes the area. One with a different key or
// cell waits for that request and its write, then decides again from the area
// as it then stands. So N overlapping refreshes of one area make one request.
// The two areas never wait on each other, so a mixed home screen can have two
// in flight at once. Waiters share the decoded `Fetched`, never the body
// (NFR-02). The engine is one per extension process, where every placed
// widget refreshes, so that is the scope of the bound.

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

/// Where a widget measures from: the Edit Widget sheet's Measure from
/// (`MeasureFromOption` in Widget/Intents.swift maps onto it).
enum WidgetMeasure: String, CaseIterable, Sendable {
    case myLocation, defaultLocation
}

/// The cache is one AREA per Measure from choice: My location's is
/// `widgets/cache.json` exactly as shipped (Alerts reads it for a device
/// cell), Default Location's is its own file, which only the extension reads.
protocol WidgetStore: Sendable {
    func readHandover() -> HandoverRead
    func readCache(_ area: WidgetMeasure) -> WidgetCache?
    func writeCache(_ cache: WidgetCache, _ area: WidgetMeasure)
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

    /// The request in flight for one area (widget-refresh-take-turns): what it
    /// asks for, and the refreshes waiting on it.
    private struct Turn {
        let keyFingerprint: String
        let cell: CacheCell
        /// The asking refresh's time: what it stores as the fetch time and
        /// where a 429's hold counts from, so a joiner shows exactly that.
        let at: Date
        var waiters: [CheckedContinuation<Fetched?, Never>] = []
    }
    private var inFlight: [WidgetMeasure: Turn] = [:]

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

    func refresh(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia,
                 measure: WidgetMeasure = .myLocation) async -> WidgetModel {
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
        switch measure {
        case .defaultLocation:
            // Never the locator: a widget set to Default Location reads no location.
            guard let d = h.defaultLocation else { return message(.noDefaultLocation) }
            reference = Coordinate(lat: d.lat, lng: d.lng)
            usedDefault = true
        case .myLocation:
            switch await locator.currentLocation() {
            case .located(let c):
                reference = c
            case .unavailable:
                guard let d = h.defaultLocation else { return message(.noLocation) }
                reference = Coordinate(lat: d.lat, lng: d.lng)
                usedDefault = true
            }
        }

        let now2 = clock()
        let cell = WidgetCache.cell(for: reference)
        let fp = WidgetCache.fingerprint(key)
        var cache = store.readCache(measure)
        if let c = cache, c.keyFingerprint != fp { cache = nil }            // FR-25
        // A hold-only document carries a hold and no fetch (WidgetCache.holdOnly).
        let fetchedAt = cache.flatMap { $0.isHoldOnly ? nil : WidgetTime.parse($0.fetchedAt) }

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

        // True when this refresh joined another's request: it shows the same
        // outcome and writes nothing, since the refresh that asked writes it.
        var joined = false
        func failed(_ failure: FailureKind, backoffUntil: Date? = nil) -> WidgetModel {
            if !joined, var c = cache {
                c.lastFailure = CacheFailure(at: WidgetTime.string(now2), kind: failure)
                if let until = backoffUntil { c.backoff = CacheBackoff(until: WidgetTime.string(until), reason: "429") }
                store.writeCache(c, measure)
            } else if !joined, let until = backoffUntil {
                // No usable document in this area (never fetched, or a new
                // key): the hold still persists, in a hold-only one (L1).
                store.writeCache(WidgetCache.holdOnly(keyFingerprint: fp, cell: cell,
                                                      cellSource: usedDefault ? .defaultLocation : .device,
                                                      until: until, at: now2), measure)
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
        // The hold is the KEY's, not the area's: one the other choice's area
        // recorded for this same key stops this request too.
        if let until = otherAreaHold(measure, keyFingerprint: fp, now: now2) {
            return failed(.rateLimited, backoffUntil: until)
        }

        guard let request = EBirdRequest.make(for: reference, key: key) else { return message(.noHandover) }
        // Taking turns (header). Nothing has awaited since the cache read, so
        // the decision above and this check are one step.
        let fetched: Fetched
        let at: Date
        if let turn = inFlight[measure] {
            let shared = await waitForTurn(measure)   // resumes after that request's write
            guard turn.keyFingerprint == fp, turn.cell == cell, let shared else {
                // A different key or cell: decide again, from the area as written.
                return await refresh(kind: kind, window: window, media: media, measure: measure)
            }
            fetched = shared
            at = turn.at
            joined = true
        } else {
            inFlight[measure] = Turn(keyFingerprint: fp, cell: cell, at: now2)
            // One payload at a time (NFR-02, schema.md 6.5): the body's last
            // reference is `decode`'s argument, so it is released when that
            // call returns, before the cache is written or a row is built. A
            // `switch` over the fetch itself would keep the body alive to the
            // end of the case, beside everything built from it (measured:
            // DenseBodyTests). Waiters get this decoded value, never the body.
            fetched = RefreshEngine.decode(await transport.fetch(request))
            at = now2
        }
        // The refresh that asked ends its turn AFTER the write in the case
        // below (a `defer` runs once the returned model is built), so a waiter
        // that decides again reads the area as written, a 429's hold included.
        // No case awaits today, so a resumed waiter could not run before the
        // write anyway; the `defer` keeps that true if one ever does.
        defer { if !joined { endTurn(measure, fetched) } }
        switch fetched {
        case .malformed:
            return failed(.malformed)
        case .records(let records):
            let fresh = WidgetCache(version: WidgetCache.currentVersion, keyFingerprint: fp, cell: cell,
                                    fetchedAt: WidgetTime.string(at), records: records, backoff: nil, lastFailure: nil,
                                    cellSource: usedDefault ? .defaultLocation : .device)
            if !joined { store.writeCache(fresh, measure) }
            return list(records, fetched: WidgetTime.parse(fresh.fetchedAt) ?? at, stale: nil, next: cadenceNext)
        case .status(let code, _) where code == 401 || code == 403:
            return message(.keyRejected, usedDefault: usedDefault)
        case .status(429, let retryAfter):
            let seconds = TimeInterval(RetryAfter.parseSeconds(retryAfter) ?? 0)
            let until = at.addingTimeInterval(max(RefreshEngine.cadenceSeconds, seconds))
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

    /// A 429 hold the OTHER cache area records for this key, still running.
    /// Read only where a request would otherwise be made, and released when
    /// this returns, so it is never held beside a body (NFR-02).
    private func otherAreaHold(_ measure: WidgetMeasure, keyFingerprint fp: String, now: Date) -> Date? {
        let other: WidgetMeasure = measure == .myLocation ? .defaultLocation : .myLocation
        guard let o = store.readCache(other), o.keyFingerprint == fp, let b = o.backoff,
              let until = WidgetTime.parse(b.until), until > now else { return nil }
        return until
    }

    /// Waits for the request in flight for `measure` and returns its outcome.
    /// The waiter is added before this suspends, so in the same step as the
    /// caller's check; nil only if there was no request to wait for.
    private func waitForTurn(_ measure: WidgetMeasure) async -> Fetched? {
        await withCheckedContinuation { waiter in
            if inFlight[measure] == nil { waiter.resume(returning: nil) } else { inFlight[measure]!.waiters.append(waiter) }
        }
    }

    /// Ends the area's turn: every refresh waiting on it resumes with the
    /// outcome. Called after the request's write, never before.
    private func endTurn(_ measure: WidgetMeasure, _ fetched: Fetched) {
        for waiter in inFlight.removeValue(forKey: measure)?.waiters ?? [] { waiter.resume(returning: fetched) }
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
