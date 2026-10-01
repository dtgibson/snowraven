// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// Fakes for the alert engine's seams (ios-alerts, schema.md 8.4). The store
// holds BYTES, so a test can plant a malformed or oversized document and read
// back exactly what the engine wrote; the transport RECORDS every request and
// can be held open to prove the generation discard; the notifier records posts
// and holds pending identifiers the way the system replaces them.

import Foundation

final class AlertsFakeStore: AlertsStoreIO, @unchecked Sendable {
    var files: [AlertsFile: Data] = [:]
    var writes: [(AlertsFile, Data)] = []
    var removes: [AlertsFile] = []
    var tempSweeps = 0
    var handover: HandoverRead
    var cache: WidgetCache?
    var available = true

    init(handover: HandoverRead) { self.handover = handover }

    var containerAvailable: Bool { available }
    func read(_ file: AlertsFile) -> Data? { files[file] }
    func write(_ file: AlertsFile, _ data: Data) -> Bool {
        guard available else { return false }
        files[file] = data
        writes.append((file, data))
        return true
    }
    func remove(_ file: AlertsFile) -> Bool { files[file] = nil; removes.append(file); return true }
    func removeTemporaryFiles() { tempSweeps += 1 }
    func readHandover() -> HandoverRead { handover }
    func readWidgetCache() -> WidgetCache? { cache }

    func settings(_ now: Date) -> AlertsSettings { files[.settings].flatMap(AlertsSettings.decode) ?? .defaults(now: now) }
    func state() -> AlertsStateDoc { files[.state].flatMap(AlertsStateDoc.decode) ?? .fresh }
    func inbox(_ now: Date) -> [InboxRow] { files[.inbox].map { AlertsInbox.decode($0, now: now) } ?? [] }
    func put(_ s: AlertsSettings) { files[.settings] = s.encoded()! }
    func put(_ s: AlertsStateDoc) { files[.state] = s.encoded()! }
}

/// Resumes every waiter once opened.
actor AlertsGate {
    private var open = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if open { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func release() {
        open = true
        for w in waiters { w.resume() }
        waiters = []
    }
}

final class AlertsFakeTransport: WidgetTransport, @unchecked Sendable {
    var next: [FetchResult]
    var fallback: FetchResult
    var requests: [URLRequest] = []
    var gate: AlertsGate?
    init(_ next: [FetchResult] = [], fallback: FetchResult) { self.next = next; self.fallback = fallback }
    func fetch(_ r: URLRequest) async -> FetchResult {
        requests.append(r)
        if let g = gate { await g.wait() }
        return next.isEmpty ? fallback : next.removeFirst()
    }
}

final class AlertsFakeLocator: AlertsLocating, @unchecked Sendable {
    var auth: LocationAuth = .granted
    var position: Coordinate? = nil
    var positionCalls = 0
    func authorization() async -> LocationAuth { auth }
    func currentPosition() async -> Coordinate? { positionCalls += 1; return position }
}

final class AlertsFakeScheduler: AlertsScheduling, @unchecked Sendable {
    var submissions: [Date] = []
    var cancels = 0
    var statusValue: BackgroundRefresh = .available
    func submit(earliest: Date) async -> BackgroundRefresh { submissions.append(earliest); return statusValue }
    func cancel() async { cancels += 1 }
    func status() async -> BackgroundRefresh { statusValue }
}

final class AlertsFakeNotifier: AlertsNotifying, @unchecked Sendable {
    var auth: NotificationAuth = .granted
    var requested = 0
    var posts: [AlertNotification] = []
    var pending: [String] = []
    /// Immediate notifications on screen (Notification Center).
    var delivered: [String] = []
    var removed: [String] = []
    /// When set, `post` suspends here BEFORE the request is added, the window
    /// the real `post` has between its authorization read and `center.add`.
    var postGate: AlertsGate?
    var postsStarted = 0
    func authorization() async -> NotificationAuth { auth }
    func requestAuthorization() async { requested += 1 }
    func post(_ n: AlertNotification) async {
        postsStarted += 1
        if let g = postGate { await g.wait() }
        posts.append(n)
        if n.deliverAt != nil {
            pending.removeAll { $0 == n.identifier }
            pending.append(n.identifier)
        } else {
            delivered.append(n.identifier)
        }
    }
    func pendingIdentifiers() async -> [String] { pending }
    func removePending(_ identifiers: [String]) async {
        removed += identifiers
        pending.removeAll { identifiers.contains($0) }
    }
    func removeDelivered(_ identifiers: [String]) async {
        delivered.removeAll { identifiers.contains($0) }
    }
}

final class AlertsFakeApp: AlertsAppState, @unchecked Sendable {
    var foreground = true
    var pokes = 0
    func isForeground() async -> Bool { foreground }
    func poke() async { if foreground { pokes += 1 } }
}

final class AlertsFakeClock: @unchecked Sendable {
    var now: Date
    init(_ d: Date) { now = d }
}

final class AlertsIds: @unchecked Sendable {
    var n = 0
    func next() -> String { n += 1; return String(format: "00000000-0000-4000-8000-%012d", 5000 + n) }
}

struct AlertsHarness {
    static let key = "SENTINELKEY42"
    static let davis = FixedPlace(lat: 38.5449, lng: -121.7405, name: "Davis")

    let store: AlertsFakeStore
    let transport: AlertsFakeTransport
    let locator: AlertsFakeLocator
    let scheduler: AlertsFakeScheduler
    let notifier: AlertsFakeNotifier
    let app: AlertsFakeApp
    let clock: AlertsFakeClock
    let engine: AlertsEngine

    /// A hand-over carrying the key, the backup, QA-22's recorded set, a
    /// Default Location and (unless `lists` is false) the two exception lists.
    static func handover(key: String? = key, backup: Bool = true, lists: Bool = true) -> Handover {
        let c = AlertFixture.object("countability")
        return Handover(version: 1, writtenAt: "2026-09-30T00:00:00Z", appVersion: "1.0.41", ebirdKey: key,
                        hasEbirdBackup: backup, recorded: backup ? (AlertFixture.root["qa22Recorded"] as! [String]) : [],
                        hasMlExport: false, targetsMissingPhoto: [], targetsMissingAudio: [], targetsMissingVideo: [],
                        defaultLocation: DefaultLocation(lat: 38.5446, lng: -121.7405),
                        countableExceptions: lists ? (c["countable"] as! [String]) : nil,
                        nonCountableExceptions: lists ? (c["nonCountable"] as! [String]) : nil)
    }

    /// QA-22's body: Ruff and Sabine's Gull are the hits.
    static var qa22Body: Data {
        let qa22 = AlertFixture.family("candidates").first { $0["name"] as? String == "qa22" }!
        return AlertFixture.bodyData(qa22["body"]!)
    }

    static func body(_ records: [[String: Any]]) -> Data { try! JSONSerialization.data(withJSONObject: records) }

    init(handover: HandoverRead = .valid(AlertsHarness.handover()), fetch: FetchResult = .ok(AlertsHarness.qa22Body),
         now: Date = AlertFixture.date("2026-09-30T16:00:00Z"), tz: TimeZone = TimeZone(identifier: "America/Los_Angeles")!,
         enabled: Bool = true, configure: (inout AlertsSettings) -> Void = { _ in }) {
        let store = AlertsFakeStore(handover: handover)
        let transport = AlertsFakeTransport(fallback: fetch)
        let locator = AlertsFakeLocator()
        let scheduler = AlertsFakeScheduler()
        let notifier = AlertsFakeNotifier()
        let app = AlertsFakeApp()
        let clock = AlertsFakeClock(now)
        let ids = AlertsIds()
        var s = AlertsSettings.defaults(now: now)
        s.enabled = enabled
        s.fixedPlace = AlertsHarness.davis
        configure(&s)
        store.put(s)
        self.store = store
        self.transport = transport
        self.locator = locator
        self.scheduler = scheduler
        self.notifier = notifier
        self.app = app
        self.clock = clock
        self.engine = AlertsEngine(store: store, transport: transport, locator: locator, scheduler: scheduler,
                                   notifier: notifier, app: app, clock: { clock.now }, tz: { tz }, uuid: { ids.next() })
    }

    /// Everything the engine ever wrote, as text.
    var writtenText: [String] { store.writes.map { String(decoding: $0.1, as: UTF8.self) } }
}
