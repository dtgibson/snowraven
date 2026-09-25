// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// QA-50 [Swift], NFR-02, schema.md section 6.5: a dense eBird body (at least
// 5,000 records, just under the 2 MB cap) goes through the real refresh engine
// once, and
//   1. the growth in the process's physical footprint (the figure iOS holds an
//      extension to) stays inside the extension limit less the at-rest cost of
//      a SwiftUI extension, read from the kernel's own footprint peak and
//      cross-checked by a sampled allocation counter;
//   2. one payload is held at a time: the body is released before the cache is
//      written or a row is built, and a second refresh never holds two;
//   3. the body cap refuses an oversized body without holding it.
//
// Bounded by construction: every loop here runs a fixed count (records built,
// bytes yielded) or is capped (the sampler), so a regression fails an
// assertion rather than hanging. `executionTimeAllowance` is the backstop, and
// takes effect when xcodebuild runs with `-test-timeouts-enabled YES`, as the
// snowraven-release skill's command does.

import Foundation
import XCTest

// MARK: - Counters

enum MemoryCounter {
    /// Live bytes across every malloc zone: the allocation counter.
    static func mallocInUse() -> Int {
        var s = malloc_statistics_t()
        malloc_zone_statistics(nil, &s)
        return Int(s.size_in_use)
    }

    /// The task's physical footprint and the kernel's lifetime peak of it.
    static func footprint() -> (now: UInt64, peak: UInt64) {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
        let kr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
            }
        }
        guard kr == KERN_SUCCESS else { return (0, 0) }
        return (info.phys_footprint, UInt64(max(0, info.ledger_phys_footprint_peak)))
    }
}

/// Samples both counters on its own thread while the work runs. The loop is
/// CAPPED (a replica bound, not a timeout): it stops at `maxSamples` whether or
/// not it is told to, so a test that never calls `finish` cannot hang on it.
final class PeakSampler: @unchecked Sendable {
    static let maxSamples = 400_000
    private let lock = NSLock()
    private var stopRequested = false
    private let done = DispatchSemaphore(value: 0)
    private(set) var peakMalloc = 0
    private(set) var peakFootprint: UInt64 = 0
    private(set) var samples = 0

    func start() {
        Thread.detachNewThread { [self] in
            while samples < PeakSampler.maxSamples {
                lock.lock()
                let stop = stopRequested
                lock.unlock()
                if stop { break }
                peakMalloc = max(peakMalloc, MemoryCounter.mallocInUse())
                peakFootprint = max(peakFootprint, MemoryCounter.footprint().now)
                samples += 1
                usleep(50)
            }
            done.signal()
        }
    }

    /// Stops the loop and waits for it; the fields are safe to read after.
    func finish() {
        lock.lock()
        stopRequested = true
        lock.unlock()
        done.wait()
    }
}

// MARK: - The dense body and the seams that watch it

enum DenseBody {
    static let records = 5_400

    /// eBird's documented record shape, 5,400 distinct (species, location)
    /// pairs so the reducer keeps every one (the worst case for memory),
    /// dated inside the last week of the fixture's clock.
    static let bytes: [UInt8] = {
        let f = Fixture.shared
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = f.timeZone
        fmt.dateFormat = "yyyy-MM-dd HH:mm"
        var out = "["
        out.reserveCapacity(records * 380)
        for i in 0..<records {
            let species = i / 5
            let obsDt = fmt.string(from: f.now.addingTimeInterval(-Double(1 + i % 6) * 86_400))
            let lat = f.reference.lat + Double(i % 97) * 0.003 - 0.14
            let lng = f.reference.lng + Double(i % 89) * 0.003 - 0.13
            if i > 0 { out += "," }
            out += "{\"speciesCode\":\"syn\(String(format: "%05d", species))\","
                + "\"comName\":\"Synthetic Species \(String(format: "%05d", species))\","
                + "\"sciName\":\"Syntheticus exemplaris \(String(format: "%05d", species))\","
                + "\"locId\":\"L\(String(format: "%07d", i))\","
                + "\"locName\":\"Synthetic Hotspot \(String(format: "%07d", i)), Example County, California, US\","
                + "\"obsDt\":\"\(obsDt)\",\"howMany\":\(1 + i % 7),"
                + "\"lat\":\(String(format: "%.5f", lat)),\"lng\":\(String(format: "%.5f", lng)),"
                + "\"obsValid\":true,\"obsReviewed\":false,\"locationPrivate\":false,"
                + "\"subId\":\"S\(String(format: "%09d", 100_000_000 + i))\"}"
        }
        out += "]"
        return Array(out.utf8)
    }()
}

/// Hands out a fresh copy of the dense body per request, as the network would,
/// and keeps no reference to it. The copy's storage reports its own release,
/// so the test sees exactly how many payloads are alive at any moment.
final class DenseTransport: WidgetTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var _live = 0
    private(set) var made = 0
    private(set) var maxLive = 0
    var live: Int { lock.lock(); defer { lock.unlock() }; return _live }

    func fetch(_ request: URLRequest) async -> FetchResult {
        let n = DenseBody.bytes.count
        let p = UnsafeMutableRawPointer.allocate(byteCount: n, alignment: 1)
        DenseBody.bytes.withUnsafeBytes { p.copyMemory(from: $0.baseAddress!, byteCount: n) }
        lock.lock()
        _live += 1
        made += 1
        maxLive = max(maxLive, _live)
        lock.unlock()
        let data = Data(bytesNoCopy: p, count: n, deallocator: .custom { [weak self] ptr, _ in
            ptr.deallocate()
            self?.released()
        })
        return .ok(data)
    }

    private func released() {
        lock.lock()
        _live -= 1
        lock.unlock()
    }
}

/// A store that notes how many payloads are alive at each cache write, the
/// step that follows the decode and precedes the rows.
final class ProbeStore: WidgetStore, @unchecked Sendable {
    let transport: DenseTransport
    var cache: WidgetCache?
    var liveAtWrite: [Int] = []
    init(transport: DenseTransport) { self.transport = transport }
    func readHandover() -> HandoverRead { .valid(Fixture.shared.handover) }
    func readCache() -> WidgetCache? { cache }
    func writeCache(_ c: WidgetCache) { liveAtWrite.append(transport.live); cache = c }
}

/// A byte sequence that yields `count` bytes lazily and counts how many were
/// pulled, so a test can show an oversized body was never read in full.
final class CountingBytes: AsyncSequence, @unchecked Sendable {
    typealias Element = UInt8
    let count: Int
    private(set) var pulled = 0
    init(count: Int) { self.count = count }

    struct AsyncIterator: AsyncIteratorProtocol {
        let owner: CountingBytes
        mutating func next() async throws -> UInt8? {
            guard owner.pulled < owner.count else { return nil }
            owner.pulled += 1
            return UInt8(truncatingIfNeeded: owner.pulled)
        }
    }

    func makeAsyncIterator() -> AsyncIterator { AsyncIterator(owner: self) }
}

// MARK: - Tests

final class DenseBodyTests: XCTestCase {
    /// WidgetKit's extension memory limit (30 MB) less the upper figure for a
    /// SwiftUI extension process at rest (15 MB), schema.md section 6.5.
    static let growthBudget: UInt64 = 15 * 1_048_576

    override func setUp() {
        super.setUp()
        executionTimeAllowance = 60
    }

    private func engine(_ transport: DenseTransport, _ store: ProbeStore, clock: FakeClock) -> RefreshEngine {
        let tz = Fixture.shared.timeZone
        return RefreshEngine(store: store, transport: transport, locator: FakeLocator(.located(Fixture.shared.reference)),
                             clock: { clock.now }, tz: { tz })
    }

    func testTheDenseFixtureIsDenseAndUnderTheCap() {
        XCTAssertGreaterThanOrEqual(DenseBody.records, 5_000)
        XCTAssertLessThanOrEqual(DenseBody.bytes.count, EBirdRequest.bodyCapBytes)
        XCTAssertGreaterThan(DenseBody.bytes.count, EBirdRequest.bodyCapBytes * 9 / 10, "dense means near the cap")
        let reduced = RecentObsReducer.reduce(body: Data(DenseBody.bytes))
        XCTAssertEqual(reduced?.count, DenseBody.records, "every record is a distinct (species, location) pair and kept")
    }

    /// One payload at a time: released before the cache write (and so before
    /// the rows), and never two alive across back-to-back refreshes.
    func testTheBodyIsReleasedBeforeAnythingIsBuiltFromIt() async {
        let transport = DenseTransport()
        let store = ProbeStore(transport: transport)
        let clock = FakeClock(Fixture.shared.now)
        let e = engine(transport, store, clock: clock)

        let first = await e.refresh(kind: .lifers, window: .all, media: .any)
        XCTAssertEqual(first.state, .list)
        XCTAssertFalse(first.rows.isEmpty)
        // Past the 15 minute freshness window, so the second refresh fetches.
        clock.now = clock.now.addingTimeInterval(16 * 60)
        let second = await e.refresh(kind: .lifers, window: .all, media: .any)
        XCTAssertEqual(second.state, .list)

        XCTAssertEqual(transport.made, 2, "two refreshes, two requests")
        XCTAssertEqual(store.liveAtWrite, [0, 0], "the body is released before the cache is written and the rows built")
        XCTAssertEqual(transport.maxLive, 1, "never two payloads at once")
        XCTAssertEqual(transport.live, 0)
    }

    /// The memory bound, measured in-process with the dense body through the
    /// real engine: the load (the copy the transport makes), the decode, the
    /// reduce, the cache write and the rows.
    func testADenseRefreshStaysInsideTheExtensionMemoryLimit() async {
        let bodyBytes = DenseBody.bytes.count  // built before the baseline, so not counted
        let transport = DenseTransport()
        let store = ProbeStore(transport: transport)
        let e = engine(transport, store, clock: FakeClock(Fixture.shared.now))

        let before = MemoryCounter.footprint()
        let mallocBefore = MemoryCounter.mallocInUse()
        let sampler = PeakSampler()
        sampler.start()
        let model = await e.refresh(kind: .lifers, window: .all, media: .any)
        sampler.finish()
        let after = MemoryCounter.footprint()
        XCTAssertEqual(model.state, .list)

        // The kernel's own peak is exact when this refresh set it; otherwise
        // an earlier test in the process set a higher one, and the sampled
        // footprint peak is the reading (a lower bound, cross-checked below).
        let kernelSetPeak = after.peak > before.peak
        let footprintGrowth = (kernelSetPeak ? after.peak : max(sampler.peakFootprint, after.now)) &- before.now
        let mallocGrowth = UInt64(max(0, sampler.peakMalloc - mallocBefore))
        let mb = { (b: UInt64) in String(format: "%.1f MB", Double(b) / 1_048_576) }
        let report = "body \(mb(UInt64(bodyBytes))) (\(DenseBody.records) records); footprint growth \(mb(footprintGrowth))"
            + " (\(kernelSetPeak ? "kernel peak" : "sampled")); allocation-counter growth \(mb(mallocGrowth))"
            + " over \(sampler.samples) samples; budget \(mb(Self.growthBudget))"
        print("QA-50 dense refresh: \(report)")

        XCTAssertGreaterThan(sampler.samples, 10, "the sampler ran during the refresh")
        XCTAssertGreaterThan(mallocGrowth, UInt64(bodyBytes), "the counter saw at least the payload itself")
        XCTAssertLessThan(footprintGrowth, Self.growthBudget, report)
        XCTAssertLessThan(mallocGrowth, Self.growthBudget, report)
        XCTAssertEqual(transport.live, 0, "the payload is gone once the refresh returns")
    }

    // The cap, through the same function `EBirdClient` runs on URLSession's bytes.

    func testABodyThatDeclaresMoreThanTheCapIsRefusedUnread() async throws {
        let bytes = CountingBytes(count: 10)
        let out = try await EBirdBody.collect(bytes, declaredLength: Int64(EBirdRequest.bodyCapBytes) + 1)
        XCTAssertEqual(out, .tooLarge)
        XCTAssertEqual(bytes.pulled, 0, "refused on the declared length before a byte is read")
    }

    func testAnUndeclaredBodyPastTheCapIsRefusedAtTheFirstByteOver() async throws {
        // The real constant: 2,000,000 bytes pass, the 2,000,001st is refused,
        // and the remaining half megabyte is never read.
        let over = CountingBytes(count: EBirdRequest.bodyCapBytes + 500_000)
        let out = try await EBirdBody.collect(over, declaredLength: -1)
        XCTAssertEqual(out, .tooLarge)
        XCTAssertEqual(over.pulled, EBirdRequest.bodyCapBytes + 1)

        // An understated length is caught the same way.
        let lying = CountingBytes(count: 1_000)
        let lied = try await EBirdBody.collect(lying, declaredLength: 10, cap: 100)
        XCTAssertEqual(lied, .tooLarge)
        XCTAssertEqual(lying.pulled, 101)
    }

    func testABodyAtExactlyTheCapIsKeptWhole() async throws {
        let exact = CountingBytes(count: 100)
        guard case .ok(let data) = try await EBirdBody.collect(exact, declaredLength: 100, cap: 100) else {
            return XCTFail("a body at the cap is accepted")
        }
        XCTAssertEqual(data.count, 100)
        XCTAssertEqual(Array(data.prefix(3)), [1, 2, 3])
        let small = CountingBytes(count: 5)
        let got = try await EBirdBody.collect(small, declaredLength: -1)
        XCTAssertEqual(got, .ok(Data([1, 2, 3, 4, 5])))
    }
}
