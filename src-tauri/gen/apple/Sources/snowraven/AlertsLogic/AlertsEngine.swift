// The iOS alert check, end to end (ios-alerts, schema.md sections 2 and 4), as
// ONE actor over injected seams, so every rule is tested without UIKit,
// BackgroundTasks, UserNotifications, CoreLocation or the network
// (snowraven_widgetsTests, `AlertsEngineTests`). The Alerts/ layer supplies
// the real seams.
//
// ONE OWNER. Every reader and writer of the three alert documents is this
// actor: the five Tauri commands (through the C bridge), the BGAppRefreshTask
// handler, the didBecomeActive trigger and the clear-registry purge. A
// background launch and a foreground session are the same process at
// different times, so the actor's serialization is the whole protection; the
// webview cannot reach the App Group container at all.
//
// THE CHECK (schema.md 4.1), in order: one at a time (`running`); alerts on;
// no 429 hold running (no request, no lastCheck write); the preconditions in
// FR-18's order through `ResolvePoint` (no request, no lastCheck write); a
// hand-over without the two countability lists is "no-answer" with no request;
// then EXACTLY ONE request (NFR-02: no retry inside a check), the outcome, and
// the writes in the order inbox, state, notification, next BGAppRefreshTask
// request. A background trigger never reads location (FR-17).
//
// RETENTION (security review L2, L3). Every read of the inbox and the state
// that leaves something out (a row past 30 days or its future bound, a
// position past its 24 hours, an implausible time) writes the result back, so
// a bound holds on disk and not only in what is shown. The stored position is
// also removed when the model becomes Fixed place, alerts are turned off, the
// backup is cleared, or location access is found off.
//
// SUPERSESSION (schema.md 2.4). `generation` is bumped by disable, clear,
// purge and a background task's expiration. A check captures it at its start
// and compares after each await (the location read, the request, the
// authorization read before posting), and a stale check writes nothing, posts
// nothing and schedules nothing. The request itself, once sent, completes or
// times out (at most 20 s); the expiration handler cancels its task.

import Foundation

// MARK: - Seams

protocol AlertsStoreIO: Sendable {
    /// false when the build carries no App Group (every write then fails).
    var containerAvailable: Bool { get }
    /// The bounded bytes of one alert document, or nil (absent, not a regular
    /// file, over its bound).
    func read(_ file: AlertsFile) -> Data?
    /// Temp-then-rename; false on failure.
    func write(_ file: AlertsFile, _ data: Data) -> Bool
    /// Removes whatever is at the name (a link as a link); absent is success.
    func remove(_ file: AlertsFile) -> Bool
    /// Removes every `<name>.tmp-<pid>` a process killed between its write and
    /// its rename left in `alerts/` (one may hold rows), each as itself.
    func removeTemporaryFiles()
    /// The widget hand-over, read only.
    func readHandover() -> HandoverRead
    /// The widget extension's cache, read only (the position's second source).
    func readWidgetCache() -> WidgetCache?
}

protocol AlertsLocating: Sendable {
    /// The When In Use status, read; NEVER requested here.
    func authorization() async -> LocationAuth
    /// One position while the app is active, or nil (never prompts).
    func currentPosition() async -> Coordinate?
}

protocol AlertsScheduling: Sendable {
    /// Submit the one BGAppRefreshTask request; returns what the system said.
    func submit(earliest: Date) async -> BackgroundRefresh
    func cancel() async
    func status() async -> BackgroundRefresh
}

protocol AlertsNotifying: Sendable {
    func authorization() async -> NotificationAuth
    /// Asks the system once; only called while the status is not determined.
    func requestAuthorization() async
    func post(_ n: AlertNotification) async
    func pendingIdentifiers() async -> [String]
    func removePending(_ identifiers: [String]) async
    /// Withdraws already-shown notifications from Notification Center.
    func removeDelivered(_ identifiers: [String]) async
}

protocol AlertsAppState: Sendable {
    /// `UIApplication.shared.applicationState != .background`.
    func isForeground() async -> Bool
    /// The `snowraven-alerts` poke, delivered only while in the foreground.
    func poke() async
}

// MARK: - Results

enum CheckTrigger: Sendable { case background, foreground }

enum SkipReason: Equatable, Sendable {
    case running, off, held
    case blocked(AlertBlocked)
}

enum CheckResult: Equatable, Sendable {
    case ran(AlertOutcome)
    case skipped(SkipReason)
    case discarded
}

// MARK: - The snapshot the webview reads

struct AlertsPermissions: Encodable, Equatable, Sendable {
    let notifications: NotificationAuth
    let location: LocationAuth
}

struct AlertsSnapshot: Encodable, Sendable {
    let settings: AlertsSettings
    let state: AlertsStateDoc
    let inbox: [InboxRow]
    let blocked: AlertBlocked?
    let permissions: AlertsPermissions
    let defaultLocation: InboxPoint?
    let now: String

    private enum K: String, CodingKey { case settings, state, inbox, blocked, permissions, defaultLocation, now }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: K.self)
        try c.encode(settings, forKey: .settings)
        try c.encode(state, forKey: .state)
        try c.encode(inbox, forKey: .inbox)
        if let b = blocked { try c.encode(b, forKey: .blocked) } else { try c.encodeNil(forKey: .blocked) }
        try c.encode(permissions, forKey: .permissions)
        if let d = defaultLocation { try c.encode(d, forKey: .defaultLocation) } else { try c.encodeNil(forKey: .defaultLocation) }
        try c.encode(now, forKey: .now)
    }
}

/// The reply every bridge call returns: `{ "ok": true, "snapshot": S }` or
/// `{ "ok": false, "error": "<short stable string>" }`. No document body, no
/// key and no system error text ever reaches an error string.
enum AlertsEnvelope {
    private struct Ok: Encodable { let ok = true; let snapshot: AlertsSnapshot }
    private struct Err: Encodable { let ok = false; let error: String }

    static func ok(_ s: AlertsSnapshot) -> String {
        guard let d = try? JSONEncoder().encode(Ok(snapshot: s)), let t = String(data: d, encoding: .utf8) else {
            return error("unavailable")
        }
        return t
    }

    static func error(_ code: String) -> String {
        let d = (try? JSONEncoder().encode(Err(error: code))) ?? Data("{\"ok\":false,\"error\":\"unavailable\"}".utf8)
        return String(data: d, encoding: .utf8) ?? "{\"ok\":false,\"error\":\"unavailable\"}"
    }
}

// MARK: - The engine

actor AlertsEngine {
    private let store: AlertsStoreIO
    private let transport: WidgetTransport
    private let locator: AlertsLocating
    private let scheduler: AlertsScheduling
    private let notifier: AlertsNotifying
    private let app: AlertsAppState
    private let clock: @Sendable () -> Date
    private let tz: @Sendable () -> TimeZone
    private let uuid: @Sendable () -> String

    /// Bumped by disable, clear, purge and expiration (schema.md 2.4).
    private(set) var generation = 0
    /// Bumped, beside `generation`, by the two commands that REMOVE pending
    /// notifications (disable and purge): a post that was suspended while one
    /// ran is withdrawn after it lands (security review L1).
    private var removals = 0
    private var running = false
    /// The last check this actor started on its own (enable, a cadence change,
    /// activation), so a test can await it.
    private var spawned: Task<CheckResult, Never>?

    init(store: AlertsStoreIO, transport: WidgetTransport, locator: AlertsLocating, scheduler: AlertsScheduling,
         notifier: AlertsNotifying, app: AlertsAppState,
         clock: @escaping @Sendable () -> Date = { Date() },
         tz: @escaping @Sendable () -> TimeZone = { TimeZone.current },
         uuid: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() }) {
        self.store = store
        self.transport = transport
        self.locator = locator
        self.scheduler = scheduler
        self.notifier = notifier
        self.app = app
        self.clock = clock
        self.tz = tz
        self.uuid = uuid
    }

    // MARK: Documents

    private func loadSettings(_ now: Date) -> AlertsSettings {
        store.read(.settings).flatMap(AlertsSettings.decode) ?? .defaults(now: now)
    }

    /// The state as `normalized` leaves it; when that removed anything, the
    /// document is rewritten, so the removal is on disk and not only in this
    /// read (L3, L4).
    private func loadState() -> AlertsStateDoc {
        guard let raw = store.read(.state).flatMap(AlertsStateDoc.decode) else { return .fresh }
        let s = raw.normalized(now: clock())
        if s != raw { save(s) }
        return s
    }

    /// The inbox at `now`; when the read left anything out (a row past its 30
    /// days or its future bound, a malformed row, a refused document), the
    /// result is written back (L2).
    private func loadInbox(_ now: Date) -> [InboxRow] {
        guard let data = store.read(.inbox) else { return [] }
        let r = AlertsInbox.read(data, now: now)
        if r.leftOut { saveInbox(r.rows, now: now) }
        return r.rows
    }

    /// L3: the stored position goes (a no-op when there is none).
    private func forgetPosition() {
        var st = loadState()
        guard st.position != nil else { return }
        st.position = nil
        save(st)
    }

    /// L3: once location access is found off, the stored position goes.
    private func forgetPositionIfLocationOff(_ loc: LocationAuth) {
        if loc == .denied || loc == .restricted { forgetPosition() }
    }

    @discardableResult private func save(_ s: AlertsSettings) -> Bool {
        guard let d = s.encoded() else { return false }
        return store.write(.settings, d)
    }

    @discardableResult private func save(_ s: AlertsStateDoc) -> Bool {
        guard let d = s.encoded() else { return false }
        return store.write(.state, d)
    }

    @discardableResult private func saveInbox(_ rows: [InboxRow], now: Date) -> Bool {
        guard let d = AlertsInbox.encoded(rows, now: now) else { return false }
        return store.write(.inbox, d)
    }

    private func validHandover() -> Handover? {
        if case .valid(let h) = store.readHandover() { return h }
        return nil
    }

    private func pointInputs(_ s: AlertsSettings, _ h: Handover?, _ st: AlertsStateDoc, _ loc: LocationAuth,
                             _ now: Date) -> PointInputs {
        let own = st.position.flatMap { p in WidgetTime.parse(p.at).map { TimedPosition(lat: p.lat, lng: p.lng, at: $0) } }
        let cell = store.readWidgetCache().flatMap { c in
            WidgetTime.parse(c.fetchedAt).map { WidgetCellReading(lat: c.cell.lat, lng: c.cell.lng, at: $0, source: c.cellSource) }
        }
        return PointInputs(model: s.model, fixedPlace: s.fixedPlace, handover: h.map(HandoverFacts.init),
                           position: own, widgetCell: cell, location: loc, now: now)
    }

    // MARK: Scheduling

    private func scheduleNext(from base: Date, cadence: AlertCadence) async {
        let earliest = base.addingTimeInterval(AlertRules.interval(cadence))
        let status = await scheduler.submit(earliest: earliest)
        var st = loadState()
        st.scheduledEarliest = WidgetTime.string(earliest)
        st.backgroundRefresh = status
        save(st)
    }

    private func rescheduleIfEnabled() async {
        let now = clock()
        let s = loadSettings(now)
        guard s.enabled else { return }
        await scheduleNext(from: now, cadence: s.cadence)
    }

    /// A deferred summary whose window has passed and whose request iOS no
    /// longer holds has been delivered: forget it. One whose window end is more
    /// than 26 hours ahead was stamped while the clock ran ahead (I8): forget it
    /// AND withdraw its request, so it cannot hold every later quiet-hours hit
    /// until that date; the next deferred hit starts a new summary.
    private func clearStalePending(now: Date) async {
        guard let p = loadState().pending, let end = WidgetTime.parse(p.windowEndAt) else { return }
        if end.timeIntervalSince(now) > AlertRules.summaryMaxAheadSeconds {
            await notifier.removePending([AlertRules.deferredId])
            var st = loadState()
            guard st.pending == p else { return }
            st.pending = nil
            save(st)
            return
        }
        guard end <= now else { return }
        let held = await notifier.pendingIdentifiers()
        guard !held.contains(AlertRules.deferredId) else { return }
        var st = loadState()
        guard st.pending == p else { return }
        st.pending = nil
        save(st)
    }

    private func spawnForegroundCheck() {
        spawned = Task { await self.runCheck(.foreground) }
    }

    /// Test hook: await the check this actor last started on its own.
    func awaitSpawned() async -> CheckResult? {
        await spawned?.value
    }

    // MARK: The check

    func runCheck(_ trigger: CheckTrigger) async -> CheckResult {
        guard !running else { return .skipped(.running) }
        running = true
        defer { running = false }
        let gen = generation
        let now = clock()
        let settings = loadSettings(now)
        guard settings.enabled else { return .skipped(.off) }
        // Every check applies the inbox's 30-day bound on disk, whatever it
        // then finds: held, blocked and unanswered checks included (I10), and
        // removes a temp copy a write killed mid-check left behind (I9; safe:
        // every write is synchronous inside this actor).
        _ = loadInbox(now)
        store.removeTemporaryFiles()

        await clearStalePending(now: now)
        guard gen == generation else { return .discarded }

        // Read before the hold, so a held check also removes the stored
        // position once location access is off (L3: "at the next check").
        let locAuth = await locator.authorization()
        guard gen == generation else { return .discarded }
        forgetPositionIfLocationOff(locAuth)

        if let hold = loadState().holdUntil.flatMap(WidgetTime.parse), hold > now {
            if trigger == .background { await scheduleNext(from: now, cadence: settings.cadence) }
            return .skipped(.held)
        }

        let handover = validHandover()

        // FR-17: a fresh position only while the app is active, only under My
        // location, only when the permission already allows it.
        if trigger == .foreground, settings.model == .myLocation, locAuth == .granted {
            let fix = await locator.currentPosition()
            guard gen == generation else { return .discarded }
            if let c = fix {
                var st = loadState()
                st.position = StoredPosition(lat: c.lat, lng: c.lng, at: WidgetTime.string(clock()), source: .foreground)
                save(st)
            }
        }

        let inputs = pointInputs(settings, handover, loadState(), locAuth, now)
        if let b = ResolvePoint.resolveBlocked(inputs) {
            if trigger == .background { await scheduleNext(from: now, cadence: settings.cadence) }
            return .skipped(.blocked(b))
        }
        guard case .point(let point, let phrase, let from) = ResolvePoint.resolvePoint(inputs),
              let h = handover, let key = h.ebirdKey else { return .skipped(.blocked(.noKey)) }

        let checkId = uuid()
        guard let counts = h.countableExceptions, let rejects = h.nonCountableExceptions,
              let request = EBirdRequest.make(for: point, key: key, distKm: AlertRules.distKm(radiusMi: settings.radiusMi),
                                              backDays: 1) else {
            // A hand-over written before the countability lists existed (a
            // "stale" hand-over): the check cannot apply the app's rule, so it
            // makes no request and says eBird's answer was unusable.
            return await finish(outcome: .noAnswer, hits: 0, from: from, checkId: checkId, completedAt: now,
                                settings: settings, hold: nil)
        }

        let fetched = RefreshEngine.decode(await transport.fetch(request))
        guard gen == generation, !Task.isCancelled else {
            await rescheduleIfEnabled()
            return .discarded
        }
        let done = clock()

        switch fetched {
        case .records(let records):
            let lists = CountabilityLists(rejects: rejects, counts: counts)
            let candidates = Candidates.candidates(records: records, recorded: h.recorded, point: point, lists: lists)
            let before = loadInbox(done)
            let ids = candidates.map { _ in uuid() }
            let applied = AlertsInbox.applyCandidates(
                before, candidates,
                CheckContext(now: done, checkId: checkId, point: point, radiusMi: settings.radiusMi, place: phrase, ids: ids))
            if applied.rows != before { saveInbox(applied.rows, now: done) }
            let hits = applied.hits
            var st = loadState()
            st.holdUntil = nil
            st.lastCheck = LastCheck(completedAt: WidgetTime.string(done), outcome: hits.isEmpty ? .nothingNew : .hits,
                                     hits: hits.count, from: from, checkId: checkId)
            var notification: AlertNotification? = nil
            if !hits.isEmpty {
                let auth = await notifier.authorization()
                guard gen == generation else { return .discarded }
                st = loadState()
                st.holdUntil = nil
                st.lastCheck = LastCheck(completedAt: WidgetTime.string(done), outcome: .hits, hits: hits.count,
                                         from: from, checkId: checkId)
                if auth == .granted {
                    let pending = hits.map {
                        PendingHit(speciesCode: $0.speciesCode, comName: $0.comName, locId: $0.locId,
                                   distanceMi: $0.distanceMi,
                                   link: AlertLink.build(speciesCode: $0.speciesCode, locId: $0.locId, point: point,
                                                         radiusMi: settings.radiusMi, show: .all))
                    }
                    let zone = tz()
                    let q = settings.quietHours
                    if q.on, QuietHours.isQuiet(QuietHours.minuteOfDay(done, tz: zone), startMin: q.startMin, endMin: q.endMin) {
                        // A summary whose window already ended is not merged into:
                        // its trigger has fired (or can no longer fire).
                        var live: PendingSummary? = nil
                        if let p = st.pending, let e = WidgetTime.parse(p.windowEndAt), e > done { live = p }
                        let end = WidgetTime.string(QuietHours.windowEnd(done, endMin: q.endMin, tz: zone))
                        let merged = QuietHours.mergePending(live, hits: pending, firstWindowEndAt: end, firstPlace: phrase,
                                                             checkId: checkId)
                        st.pending = merged
                        notification = AlertNotification(
                            identifier: AlertRules.deferredId,
                            title: NotificationText.title(count: merged.hits.count, phrase: merged.place),
                            body: NotificationText.body(namesNearestFirst: merged.hits.map(\.comName)),
                            link: merged.hits[0].link, deliverAt: WidgetTime.parse(merged.windowEndAt))
                    } else {
                        notification = AlertNotification(
                            identifier: "\(AlertRules.notificationPrefix)check.\(checkId)",
                            title: NotificationText.title(count: hits.count, phrase: phrase),
                            body: NotificationText.body(namesNearestFirst: hits.map(\.comName)),
                            link: pending[0].link, deliverAt: nil)
                    }
                }
            }
            save(st)
            if let n = notification {
                guard gen == generation else { return .discarded }
                let removalsAtPost = removals
                await notifier.post(n)
                // `post` suspends before the system adds the request, and the
                // actor is reentrant: a disable or purge that ran in that
                // window removed pending requests BEFORE this one was added
                // (L1). Withdraw it, so turning alerts off or clearing the
                // backup leaves nothing waiting and nothing on screen. A Clear
                // or an expiration withdraws nothing: the rows this check wrote
                // would otherwise keep these species from ever alerting.
                if removals != removalsAtPost {
                    await notifier.removePending([n.identifier])
                    if n.deliverAt == nil { await notifier.removeDelivered([n.identifier]) }
                }
            }
            return await completed(.init(outcome: hits.isEmpty ? .nothingNew : .hits), gen: gen, settings: settings, done: done)
        default:
            // A 429 records the hold eBird asked for, bounded as the pacing
            // contract bounds it; nothing else is stored, and never as an answer.
            var hold: Date? = nil
            if case .status(429, let retryAfter) = fetched { hold = AlertRules.holdUntil(now: done, retryAfter: retryAfter) }
            return await finish(outcome: AlertRules.outcome(fetched) ?? .noAnswer, hits: 0, from: from, checkId: checkId,
                                completedAt: done, settings: settings, hold: hold)
        }
    }

    private struct Done { let outcome: AlertOutcome }

    /// A check that wrote no rows: the lastCheck (and a 429's hold), then the
    /// next request. Nothing is ever stored as an answer.
    private func finish(outcome: AlertOutcome, hits: Int, from: CheckFrom, checkId: String, completedAt: Date,
                        settings: AlertsSettings, hold: Date?) async -> CheckResult {
        var st = loadState()
        st.lastCheck = LastCheck(completedAt: WidgetTime.string(completedAt), outcome: outcome, hits: hits, from: from,
                                 checkId: checkId)
        if let h = hold { st.holdUntil = WidgetTime.string(h) }
        save(st)
        return await completed(Done(outcome: outcome), gen: generation, settings: settings, done: completedAt)
    }

    private func completed(_ d: Done, gen: Int, settings: AlertsSettings, done: Date) async -> CheckResult {
        guard gen == generation else { return .discarded }
        await scheduleNext(from: done, cadence: settings.cadence)
        await app.poke()
        return .ran(d.outcome)
    }

    /// The BGAppRefreshTask expiration handler: the running check is discarded.
    func expire() {
        generation += 1
    }

    // MARK: Commands

    func snapshot() async -> AlertsSnapshot {
        let now = clock()
        let s = loadSettings(now)
        let h = validHandover()
        let loc = await locator.authorization()
        forgetPositionIfLocationOff(loc)
        let notif = await notifier.authorization()
        let refresh = await scheduler.status()
        var st = loadState()
        let inbox = loadInbox(now)
        st.backgroundRefresh = refresh
        let blocked = ResolvePoint.resolveBlocked(pointInputs(s, h, st, loc, now))
        let d = h?.defaultLocation.map { InboxPoint(lat: $0.lat, lng: $0.lng) }
        return AlertsSnapshot(settings: s, state: st, inbox: inbox, blocked: blocked,
                              permissions: AlertsPermissions(notifications: notif, location: loc), defaultLocation: d,
                              now: WidgetTime.string(now))
    }

    enum CommandError: Error, Equatable { case invalid, unavailable, noAppGroup }

    func update(_ payload: Data) async -> Result<AlertsSnapshot, CommandError> {
        guard let patch = AlertsSettingsPatch.parse(payload) else { return .failure(.invalid) }
        guard store.containerAvailable else { return .failure(.noAppGroup) }
        let now = clock()
        let old = loadSettings(now)
        let next = patch.applied(to: old, now: now)
        guard save(next) else { return .failure(.unavailable) }
        if next.model == .fixed {
            // L3: Fixed place uses no position, so none is kept.
            forgetPosition()
        } else if let pos = patch.position {
            var st = loadState()
            st.position = StoredPosition(lat: pos.lat, lng: pos.lng, at: WidgetTime.string(now), source: .seed)
            save(st)
        }
        // FR-13: a cadence change replaces the schedule, measured from the last
        // completed check; a place, model or radius change never starts a check.
        if next.enabled, let c = patch.cadence, c != old.cadence {
            await scheduler.cancel()
            let last = loadState().lastCheck.flatMap { WidgetTime.parse($0.completedAt) }
            await scheduleNext(from: last ?? now, cadence: c)
            if await app.isForeground(), AlertRules.isDue(lastCompletedAt: last, cadence: c, now: now) {
                spawnForegroundCheck()
            }
        }
        return .success(await snapshot())
    }

    func setEnabled(_ on: Bool) async -> Result<AlertsSnapshot, CommandError> {
        guard store.containerAvailable else { return .failure(.noAppGroup) }
        let now = clock()
        if on {
            // FR-14: asked only here, only while undecided; never re-prompted.
            if await notifier.authorization() == .notDetermined { await notifier.requestAuthorization() }
            var s = loadSettings(clock())
            let wasOn = s.enabled
            s.enabled = true
            s.updatedAt = WidgetTime.string(clock())
            guard save(s) else { return .failure(.unavailable) }
            if !wasOn {
                // FR-43: as if from a fresh start, the first check is due at once.
                await scheduleNext(from: clock(), cadence: s.cadence)
                if await app.isForeground() { spawnForegroundCheck() }
            }
        } else {
            // FR-42: everything stops at once; no permission is touched.
            generation += 1
            removals += 1
            var s = loadSettings(now)
            s.enabled = false
            s.updatedAt = WidgetTime.string(now)
            guard save(s) else { return .failure(.unavailable) }
            await scheduler.cancel()
            let held = await notifier.pendingIdentifiers().filter { $0.hasPrefix(AlertRules.notificationPrefix) }
            await notifier.removePending(Array(Set(held + [AlertRules.deferredId])).sorted())
            var st = loadState()
            st.pending = nil
            st.scheduledEarliest = nil
            st.position = nil          // L3: nothing measures from it while off
            save(st)
        }
        return .success(await snapshot())
    }

    /// FR-39: every row, after the webview's confirmation; settings, the switch
    /// and a pending summary stay.
    func clearInbox() async -> Result<AlertsSnapshot, CommandError> {
        guard store.containerAvailable else { return .failure(.noAppGroup) }
        generation += 1
        guard saveInbox([], now: clock()) else { return .failure(.unavailable) }
        store.removeTemporaryFiles()   // I9: a temp copy a killed write left holds rows too
        return .success(await snapshot())
    }

    /// FR-40: the backup was cleared, so everything derived from it goes: the
    /// inbox (and any temp copy a killed write left beside it, I6) and the
    /// deferred summary; the stored position goes too (L3). Settings and the
    /// last check stay.
    func purgeInbox() async -> Result<AlertsSnapshot, CommandError> {
        guard store.containerAvailable else { return .failure(.noAppGroup) }
        generation += 1
        removals += 1
        guard store.remove(.inbox) else { return .failure(.unavailable) }
        store.removeTemporaryFiles()
        var st = loadState()
        if st.pending != nil || st.position != nil {
            st.pending = nil
            st.position = nil
            save(st)
        }
        await notifier.removePending([AlertRules.deferredId])
        await app.poke()
        return .success(await snapshot())
    }

    /// The didBecomeActive trigger (FR-21): the retention bounds are applied on
    /// disk whether alerts are on or off (L2, L3), a stale summary is
    /// forgotten, and a check runs when alerts are on and the interval has
    /// elapsed.
    func appActivated() async -> CheckResult? {
        let now = clock()
        // I9: a temp copy a killed write left (it may hold rows or a position)
        // goes at the next activation. Safe: every write is synchronous inside
        // this actor, so none is ever between its temp file and its rename here.
        store.removeTemporaryFiles()
        _ = loadInbox(now)
        _ = loadState()
        forgetPositionIfLocationOff(await locator.authorization())
        await clearStalePending(now: now)
        let s = loadSettings(now)
        guard s.enabled else { return nil }
        let last = loadState().lastCheck.flatMap { WidgetTime.parse($0.completedAt) }
        guard AlertRules.isDue(lastCompletedAt: last, cadence: s.cadence, now: now) else { return nil }
        return await runCheck(.foreground)
    }

    /// The bridge's op dispatch, returning the envelope text.
    func handle(op: String, payload: String) async -> String {
        func reply(_ r: Result<AlertsSnapshot, CommandError>) -> String {
            switch r {
            case .success(let s): return AlertsEnvelope.ok(s)
            case .failure(.invalid): return AlertsEnvelope.error("invalid")
            case .failure(.unavailable): return AlertsEnvelope.error("unavailable")
            case .failure(.noAppGroup): return AlertsEnvelope.error("no-app-group")
            }
        }
        switch op {
        case "snapshot": return AlertsEnvelope.ok(await snapshot())
        case "update": return reply(await update(Data(payload.utf8)))
        case "enable": return reply(await setEnabled(true))
        case "disable": return reply(await setEnabled(false))
        case "clear": return reply(await clearInbox())
        case "purge": return reply(await purgeInbox())
        default: return AlertsEnvelope.error("unknown-op")
        }
    }
}
