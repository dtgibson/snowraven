// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// Fakes for the refresh engine's three seams. The transport RECORDS every
// request, which is what the etiquette rows count.

import Foundation

final class FakeStore: WidgetStore, @unchecked Sendable {
    var handover: HandoverRead
    var cache: WidgetCache?
    var cacheWrites = 0
    init(handover: HandoverRead, cache: WidgetCache? = nil) { self.handover = handover; self.cache = cache }
    func readHandover() -> HandoverRead { handover }
    func readCache() -> WidgetCache? { cache }
    func writeCache(_ c: WidgetCache) { cache = c; cacheWrites += 1 }
}

final class FakeTransport: WidgetTransport, @unchecked Sendable {
    var next: [FetchResult]
    var fallback: FetchResult
    var requests: [URLRequest] = []
    init(_ next: [FetchResult] = [], fallback: FetchResult = .ok(Fixture.bodyData)) { self.next = next; self.fallback = fallback }
    func fetch(_ r: URLRequest) async -> FetchResult {
        requests.append(r)
        return next.isEmpty ? fallback : next.removeFirst()
    }
}

final class FakeLocator: WidgetLocator, @unchecked Sendable {
    var result: LocationResult
    var calls = 0
    init(_ r: LocationResult) { result = r }
    func currentLocation() async -> LocationResult { calls += 1; return result }
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

    func refresh(_ kind: WidgetKind = .lifers, _ window: WidgetWindow = .week, _ media: WidgetMedia = .any) async -> WidgetModel {
        await engine.refresh(kind: kind, window: window, media: media)
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
