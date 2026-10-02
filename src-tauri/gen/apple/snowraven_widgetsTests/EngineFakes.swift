// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// Fakes for the refresh engine's three seams. The transport RECORDS every
// request, which is what the etiquette rows count.

import Foundation

final class FakeStore: WidgetStore, @unchecked Sendable {
    var handover: HandoverRead
    /// My location's area (`cache.json`, the file Alerts reads).
    var cache: WidgetCache?
    /// Default Location's area (widget-measure-from-choice).
    var defaultCache: WidgetCache?
    var cacheWrites = 0
    /// When set, every cache read and write is logged in order.
    var log: EngineLog?
    init(handover: HandoverRead, cache: WidgetCache? = nil) { self.handover = handover; self.cache = cache }
    func readHandover() -> HandoverRead { handover }
    func readCache(_ area: WidgetMeasure) -> WidgetCache? {
        log?.append(.read(area))
        return area == .myLocation ? cache : defaultCache
    }
    func writeCache(_ c: WidgetCache, _ area: WidgetMeasure) {
        if area == .myLocation { cache = c } else { defaultCache = c }
        cacheWrites += 1
        log?.append(.write(area))
    }
}

/// Locked, because refreshes that overlap call `fetch` from several threads.
final class FakeTransport: WidgetTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var _next: [FetchResult]
    private var _fallback: FetchResult
    private var _requests: [URLRequest] = []
    var next: [FetchResult] { get { lock.withLock { _next } } set { lock.withLock { _next = newValue } } }
    var fallback: FetchResult { get { lock.withLock { _fallback } } set { lock.withLock { _fallback = newValue } } }
    var requests: [URLRequest] { lock.withLock { _requests } }
    /// When set, a request waits here after it is recorded, as a real one is
    /// in flight, and answers once the test opens it (never a sleep).
    var gate: AlertsGate?
    var log: EngineLog?
    init(_ next: [FetchResult] = [], fallback: FetchResult = .ok(Fixture.bodyData)) { _next = next; _fallback = fallback }
    func fetch(_ r: URLRequest) async -> FetchResult {
        lock.withLock { _requests.append(r) }
        log?.append(.request(r))
        if let g = gate { await g.wait() }
        return lock.withLock { _next.isEmpty ? _fallback : _next.removeFirst() }
    }
}

/// What the engine did, in order, across the store and the transport, so a
/// test can say what came before what (widget-refresh-take-turns). `until`
/// waits for a count to be reached; it never sleeps or polls.
final class EngineLog: @unchecked Sendable {
    enum Event: Equatable {
        case read(WidgetMeasure)
        case write(WidgetMeasure)
        case request(URLRequest)
        var isRequest: Bool { if case .request = self { return true } else { return false } }
        var isRead: Bool { if case .read = self { return true } else { return false } }
    }

    private let lock = NSLock()
    private var _events: [Event] = []
    private var waiting: [(reads: Int, requests: Int, waiter: CheckedContinuation<Void, Never>)] = []
    var events: [Event] { lock.withLock { _events } }
    var requestCount: Int { events.filter(\.isRequest).count }

    private func reached(_ reads: Int, _ requests: Int) -> Bool {
        _events.filter(\.isRead).count >= reads && _events.filter(\.isRequest).count >= requests
    }

    func append(_ e: Event) {
        let ready: [CheckedContinuation<Void, Never>] = lock.withLock {
            _events.append(e)
            let met = waiting.filter { reached($0.reads, $0.requests) }
            waiting.removeAll { reached($0.reads, $0.requests) }
            return met.map(\.waiter)
        }
        for w in ready { w.resume() }
    }

    /// Returns once at least `reads` cache reads and `requests` requests have
    /// been logged. A count that is never reached is caught by the test's
    /// `executionTimeAllowance` (`-test-timeouts-enabled YES`).
    func until(reads: Int = 0, requests: Int = 0) async {
        await withCheckedContinuation { (waiter: CheckedContinuation<Void, Never>) in
            let met = lock.withLock { () -> Bool in
                if reached(reads, requests) { return true }
                waiting.append((reads, requests, waiter))
                return false
            }
            if met { waiter.resume() }
        }
    }
}

final class FakeLocator: WidgetLocator, @unchecked Sendable {
    var result: LocationResult
    var calls = 0
    private let lock = NSLock()   // overlapping refreshes call it from several threads
    init(_ r: LocationResult) { result = r }
    func currentLocation() async -> LocationResult { lock.withLock { calls += 1 }; return result }
}

final class FakeClock: @unchecked Sendable {
    var now: Date
    init(_ d: Date) { now = d }
}

struct Harness {
    let store: FakeStore
    let transport: FakeTransport
    let locator: FakeLocator
    let clock: FakeClock
    let engine: RefreshEngine

    init(handover: HandoverRead = .valid(Fixture.shared.handover), location: LocationResult = .located(Fixture.shared.reference),
         transport: FakeTransport = FakeTransport(), cache: WidgetCache? = nil, now: Date = Fixture.shared.now) {
        let store = FakeStore(handover: handover, cache: cache)
        let locator = FakeLocator(location)
        let clock = FakeClock(now)
        let tz = Fixture.shared.timeZone
        self.store = store
        self.transport = transport
        self.locator = locator
        self.clock = clock
        self.engine = RefreshEngine(store: store, transport: transport, locator: locator, clock: { clock.now }, tz: { tz })
    }

    func refresh(_ kind: WidgetKind = .lifers, _ window: WidgetWindow = .week, _ media: WidgetMedia = .any,
                 _ measure: WidgetMeasure = .myLocation) async -> WidgetModel {
        await engine.refresh(kind: kind, window: window, media: media, measure: measure)
    }
}

extension Handover {
    func with(key: String?? = nil, backup: Bool? = nil, export: Bool? = nil, photo: [String]? = nil, audio: [String]? = nil,
              video: [String]? = nil, defaultLocation: DefaultLocation?? = nil) -> Handover {
        let hasBackup = backup ?? hasEbirdBackup
        let hasExport = export ?? hasMlExport
        return Handover(version: version, writtenAt: writtenAt, appVersion: appVersion,
                        ebirdKey: key ?? ebirdKey, hasEbirdBackup: hasBackup, recorded: hasBackup ? recorded : [],
                        hasMlExport: hasExport,
                        targetsMissingPhoto: hasExport ? (photo ?? targetsMissingPhoto) : [],
                        targetsMissingAudio: hasExport ? (audio ?? targetsMissingAudio) : [],
                        targetsMissingVideo: hasExport ? (video ?? targetsMissingVideo) : [],
                        defaultLocation: defaultLocation ?? self.defaultLocation)
    }
}
