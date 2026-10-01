// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts: the check through the actor over protocol fakes (schema.md 8.4).
// QA-20 (one at a time), QA-21 (exactly one request, back=1, the radius),
// QA-25 (429 hold: no request 10 s after a Retry-After of 30, one at 31 s),
// QA-13 (notifications denied: inbox filled, nothing posted), QA-16 (no
// location read from a background check), QA-32 / QA-34 (quiet hours defer to
// ONE replaceable request; two checks merge), QA-42 (off stops everything, the
// in-flight check writes and posts nothing), QA-43, QA-39, QA-40, the stale
// hand-over, the seam failure rows, and the key never reaching a document or
// an error. Since the security review: a post suspended while alerts turn off
// or the backup clears is withdrawn (L1), retention holds on disk (L2), the
// stored position goes when it can no longer be used (L3), implausible future
// times read as absent (L4); and QA-12's quiet-hours edit and QA-41's off,
// which each had no row until QA wrote a temporary one. From the re-review: My
// location measures from an approximate point (L6), every check evicts (I10),
// a summary more than 26 h ahead is dropped with its request (I8), and Clear
// and activation sweep temp files too (I9). Round 3: under My location only a
// widget cell the widget marked as read from the device counts (L7).

import XCTest

final class AlertsEngineTests: XCTestCase {
    private let la = TimeZone(identifier: "America/Los_Angeles")!

    func testOneCheckMakesExactlyOneRequestWritesTheRowsAndPostsOneNotification() async {
        let h = AlertsHarness()
        let result = await h.engine.runCheck(.background)
        XCTAssertEqual(result, .ran(.hits))
        XCTAssertEqual(h.transport.requests.count, 1)
        let url = h.transport.requests[0].url!.absoluteString
        XCTAssertTrue(url.contains("&dist=40&back=1&fmt=json"), url)
        XCTAssertTrue(url.hasPrefix("https://api.ebird.org/v2/data/obs/geo/recent?lat=38.54490&lng=-121.74050"), url)
        let rows = h.store.inbox(h.clock.now)
        XCTAssertEqual(Set(rows.map(\.speciesCode)), ["ruff", "sabgul"])
        XCTAssertEqual(h.notifier.posts.count, 1)
        let n = h.notifier.posts[0]
        XCTAssertTrue(n.identifier.hasPrefix("alerts.check."))
        XCTAssertNil(n.deliverAt)
        XCTAssertEqual(n.title, "2 lifers reported near Davis")
        XCTAssertEqual(n.body, "Ruff, Sabine's Gull")
        XCTAssertEqual(n.link, "snowraven://map/lifers?window=day&lat=38.54490&lng=-121.74050&r=25&sp=ruff&loc=L1000001&show=all")
        let st = h.store.state()
        XCTAssertEqual(st.lastCheck?.outcome, .hits)
        XCTAssertEqual(st.lastCheck?.hits, 2)
        XCTAssertEqual(st.lastCheck?.from, .fixed)
        XCTAssertEqual(h.scheduler.submissions, [h.clock.now.addingTimeInterval(3600)])
        XCTAssertEqual(h.store.tempSweeps, 1, "a check sweeps a temp copy a write killed mid-check left (I9)")
        // Write order: the inbox before the state.
        let order = h.store.writes.map(\.0)
        XCTAssertLessThan(order.firstIndex(of: .inbox)!, order.lastIndex(of: .state)!)
    }

    func testTheSameSpeciesDoesNotAlertAgainInsideSevenDays() async {
        let h = AlertsHarness()
        _ = await h.engine.runCheck(.background)
        h.clock.now = h.clock.now.addingTimeInterval(2 * 3600)
        let _a1 = await h.engine.runCheck(.background)
        XCTAssertEqual(_a1, .ran(.nothingNew))
        XCTAssertEqual(h.transport.requests.count, 2)
        XCTAssertEqual(h.notifier.posts.count, 1, "no second notification")
        XCTAssertEqual(h.store.inbox(h.clock.now).count, 2, "rows updated, not duplicated")
    }

    func testTheRadiusSetsTheRequestDistance() async {
        let h = AlertsHarness { $0.radiusMi = 7 }
        _ = await h.engine.runCheck(.background)
        XCTAssertTrue(h.transport.requests[0].url!.absoluteString.contains("&dist=11&back=1"))
    }

    func testABackgroundCheckNeverReadsLocation() async {
        let h = AlertsHarness { $0.model = .myLocation }
        var st = AlertsStateDoc.fresh
        st.position = StoredPosition(lat: 38.6, lng: -121.5, at: WidgetTime.string(h.clock.now.addingTimeInterval(-3600)), source: .seed)
        h.store.put(st)
        h.locator.position = Coordinate(lat: 1, lng: 1)
        let _a2 = await h.engine.runCheck(.background)
        XCTAssertEqual(_a2, .ran(.hits))
        XCTAssertEqual(h.locator.positionCalls, 0)
        XCTAssertTrue(h.transport.requests[0].url!.absoluteString.contains("lat=38.60000&lng=-121.50000"))
        XCTAssertEqual(h.notifier.posts.first?.title, "2 lifers reported near you")
        // A foreground check under My location reads one fresh position.
        h.clock.now = h.clock.now.addingTimeInterval(7200)
        _ = await h.engine.runCheck(.foreground)
        XCTAssertEqual(h.locator.positionCalls, 1)
        XCTAssertTrue(h.transport.requests[1].url!.absoluteString.contains("lat=1.00000&lng=1.00000"))
    }

    func testLocatorFailureFallsBackToTheFixedPlace() async {
        let h = AlertsHarness { $0.model = .myLocation }
        h.locator.position = nil
        let _a3 = await h.engine.runCheck(.foreground)
        XCTAssertEqual(_a3, .ran(.hits))
        XCTAssertEqual(h.store.state().lastCheck?.from, .fixedFallback)
        XCTAssertEqual(h.notifier.posts.first?.title, "2 lifers reported near Davis")
    }

    func testLocationDeniedWithNoPlaceIsBlockedWithoutARequest() async {
        let h = AlertsHarness(handover: .valid(AlertsHarness.handover())) { $0.model = .myLocation; $0.fixedPlace = nil }
        h.store.handover = .valid(Handover(version: 1, writtenAt: "2026-09-30T00:00:00Z", appVersion: "1", ebirdKey: "abc",
                                           hasEbirdBackup: true, recorded: [], hasMlExport: false, targetsMissingPhoto: [],
                                           targetsMissingAudio: [], targetsMissingVideo: [], defaultLocation: nil,
                                           countableExceptions: [], nonCountableExceptions: []))
        h.locator.auth = .denied
        let _a4 = await h.engine.runCheck(.foreground)
        XCTAssertEqual(_a4, .skipped(.blocked(.locationOff)))
        XCTAssertEqual(h.locator.positionCalls, 0)
        XCTAssertEqual(h.transport.requests.count, 0)
        XCTAssertNil(h.store.state().lastCheck)
    }

    func testQA25TheHoldAfterA429() async {
        let h = AlertsHarness(fetch: .status(429, retryAfter: "30"))
        let t0 = h.clock.now
        let _a5 = await h.engine.runCheck(.background)
        XCTAssertEqual(_a5, .ran(.busy))
        XCTAssertEqual(h.store.state().holdUntil, WidgetTime.string(t0.addingTimeInterval(30)))
        XCTAssertNil(h.store.files[.inbox])
        h.clock.now = t0.addingTimeInterval(10)
        let _a6 = await h.engine.runCheck(.background)
        XCTAssertEqual(_a6, .skipped(.held))
        XCTAssertEqual(h.transport.requests.count, 1, "no request 10 s after")
        h.clock.now = t0.addingTimeInterval(31)
        h.transport.fallback = .ok(AlertsHarness.qa22Body)
        let _a7 = await h.engine.runCheck(.background)
        XCTAssertEqual(_a7, .ran(.hits))
        XCTAssertEqual(h.transport.requests.count, 2, "one at 31 s")
        XCTAssertNil(h.store.state().holdUntil, "a good answer clears the hold")
    }

    func testA429WithoutAHeaderHoldsSixtySeconds() async {
        let h = AlertsHarness(fetch: .status(429, retryAfter: nil))
        _ = await h.engine.runCheck(.background)
        XCTAssertEqual(h.store.state().holdUntil, WidgetTime.string(h.clock.now.addingTimeInterval(60)))
    }

    func testEveryFailureRecordsItsOutcomeAndWritesNoRowAndPostsNothing() async {
        let rows: [(FetchResult, AlertOutcome)] = [
            (.offline, .unreachable), (.timeout, .unreachable), (.status(500, retryAfter: nil), .noAnswer),
            (.status(401, retryAfter: nil), .keyRejected), (.status(403, retryAfter: nil), .keyRejected),
            (.tooLarge, .noAnswer), (.ok(Data("{\"error\":1}".utf8)), .noAnswer), (.ok(Data("nope".utf8)), .noAnswer),
        ]
        for (fetch, outcome) in rows {
            let h = AlertsHarness(fetch: fetch)
            let _a8 = await h.engine.runCheck(.background)
            XCTAssertEqual(_a8, .ran(outcome), "\(fetch)")
            XCTAssertEqual(h.transport.requests.count, 1, "no retry inside a check")
            XCTAssertNil(h.store.files[.inbox], "\(fetch)")
            XCTAssertTrue(h.notifier.posts.isEmpty)
            XCTAssertEqual(h.store.state().lastCheck?.outcome, outcome)
            XCTAssertNil(h.store.state().holdUntil)
        }
    }

    func testAStaleHandoverIsNoAnswerWithNoRequest() async {
        let h = AlertsHarness(handover: .valid(AlertsHarness.handover(lists: false)))
        let _a9 = await h.engine.runCheck(.background)
        XCTAssertEqual(_a9, .ran(.noAnswer))
        XCTAssertEqual(h.transport.requests.count, 0)
        XCTAssertEqual(h.store.state().lastCheck?.outcome, .noAnswer)
    }

    func testMissingPreconditionsMakeNoRequestInFR18Order() async {
        let cases: [(HandoverRead, AlertBlocked)] = [
            (.absent, .noKey), (.valid(AlertsHarness.handover(key: nil)), .noKey),
            (.valid(AlertsHarness.handover(backup: false)), .noBackup),
        ]
        for (handover, blocked) in cases {
            let h = AlertsHarness(handover: handover)
            let _a10 = await h.engine.runCheck(.background)
            XCTAssertEqual(_a10, .skipped(.blocked(blocked)))
            XCTAssertEqual(h.transport.requests.count, 0)
            XCTAssertNil(h.store.state().lastCheck)
        }
        let off = AlertsHarness(enabled: false)
        let _a11 = await off.engine.runCheck(.background)
        XCTAssertEqual(_a11, .skipped(.off))
        XCTAssertEqual(off.transport.requests.count, 0)
        XCTAssertTrue(off.scheduler.submissions.isEmpty)
    }

    func testNotificationsDeniedFillTheInboxAndAttemptNothing() async {
        let h = AlertsHarness()
        h.notifier.auth = .denied
        let _a12 = await h.engine.runCheck(.background)
        XCTAssertEqual(_a12, .ran(.hits))
        XCTAssertEqual(h.store.inbox(h.clock.now).count, 2)
        XCTAssertTrue(h.notifier.posts.isEmpty)
        XCTAssertNil(h.store.state().pending)
    }

    func testQuietHoursDeferToOneReplaceableRequestAndTwoChecksMerge() async {
        // 23:30 in Los Angeles, inside 10:00 PM to 7:00 AM.
        let h = AlertsHarness(now: AlertFixture.date("2026-09-30T06:30:00Z"), tz: la) {
            $0.quietHours = QuietHoursSetting(on: true, startMin: 1320, endMin: 420)
        }
        _ = await h.engine.runCheck(.background)
        XCTAssertEqual(h.store.inbox(h.clock.now).count, 2, "the finds are in the inbox at once")
        XCTAssertEqual(h.notifier.posts.count, 1)
        XCTAssertEqual(h.notifier.posts[0].identifier, "alerts.deferred")
        XCTAssertEqual(h.notifier.posts[0].deliverAt, AlertFixture.date("2026-09-30T14:00:00Z"))
        XCTAssertEqual(h.store.state().pending?.hits.count, 2)

        // A second check an hour later finds a third species: one summary of 3.
        h.clock.now = h.clock.now.addingTimeInterval(3600)
        h.transport.fallback = .ok(AlertsHarness.body([[
            "speciesCode": "bawsan", "comName": "Baird's Sandpiper", "locId": "L2000005", "locName": "Near Pond",
            "lat": 38.56, "lng": -121.70, "obsDt": "2026-09-29 18:00", "subId": "S1",
        ]]))
        _ = await h.engine.runCheck(.background)
        XCTAssertEqual(h.notifier.pending, ["alerts.deferred"], "one pending request, replaced")
        XCTAssertEqual(h.notifier.posts.last?.title, "3 lifers reported near Davis")
        XCTAssertEqual(h.notifier.posts.last?.deliverAt, AlertFixture.date("2026-09-30T14:00:00Z"), "the first window end holds")
        XCTAssertEqual(h.store.state().pending?.checkIds.count, 2)
    }

    func testTwoTriggersDuringOneCheckStartNoSecondCheck() async {
        let h = AlertsHarness()
        let gate = AlertsGate()
        h.transport.gate = gate
        let first = Task { await h.engine.runCheck(.background) }
        while h.transport.requests.isEmpty { try? await Task.sleep(nanoseconds: 1_000_000) }
        let _a13 = await h.engine.runCheck(.foreground)
        XCTAssertEqual(_a13, .skipped(.running))
        await gate.release()
        let _a14 = await first.value
        XCTAssertEqual(_a14, .ran(.hits))
        XCTAssertEqual(h.transport.requests.count, 1)
    }

    func testTurningOffDuringACheckDiscardsItAndStopsEverything() async {
        let h = AlertsHarness()
        let gate = AlertsGate()
        h.transport.gate = gate
        h.notifier.pending = ["alerts.deferred", "alerts.check.old"]
        var st = AlertsStateDoc.fresh
        st.pending = PendingSummary(windowEndAt: "2026-10-01T14:00:00Z", place: .nearby,
                                    hits: [PendingHit(speciesCode: "ruff", comName: "Ruff", locId: "L1", distanceMi: 1, link: AlertLink.viewLink)],
                                    checkIds: ["00000000-0000-4000-8000-000000000001"])
        h.store.put(st)
        let check = Task { await h.engine.runCheck(.background) }
        while h.transport.requests.isEmpty { try? await Task.sleep(nanoseconds: 1_000_000) }
        let writesBefore = h.store.writes.count
        _ = await h.engine.setEnabled(false)
        await gate.release()
        let _a15 = await check.value
        XCTAssertEqual(_a15, .discarded)
        XCTAssertNil(h.store.files[.inbox], "the in-flight check wrote no row")
        XCTAssertTrue(h.notifier.posts.isEmpty, "and posted nothing")
        XCTAssertEqual(h.scheduler.cancels, 1)
        XCTAssertTrue(h.notifier.pending.isEmpty, "every pending alert request removed, the deferred one included")
        XCTAssertNil(h.store.state().pending)
        XCTAssertFalse(h.store.settings(h.clock.now).enabled)
        XCTAssertEqual(h.notifier.requested, 0, "no permission touched")
        // Only the disable's own writes happened after the discard point.
        XCTAssertTrue(h.store.writes[writesBefore...].allSatisfy { $0.0 != .inbox })
        XCTAssertTrue(h.scheduler.submissions.isEmpty, "nothing scheduled after off")
    }

    func testTurningOnAsksOnlyWhenUndecidedAndChecksAtOnce() async {
        let h = AlertsHarness(enabled: false)
        h.notifier.auth = .notDetermined
        _ = await h.engine.setEnabled(true)
        XCTAssertEqual(h.notifier.requested, 1)
        let _a16 = await h.engine.awaitSpawned()
        XCTAssertEqual(_a16, .ran(.hits), "the first check is due at once (FR-43)")
        XCTAssertTrue(h.store.settings(h.clock.now).enabled)

        let decided = AlertsHarness(enabled: false)
        decided.notifier.auth = .denied
        decided.app.foreground = false
        _ = await decided.engine.setEnabled(true)
        XCTAssertEqual(decided.notifier.requested, 0, "a decided permission is never re-asked")
        let _a17 = await decided.engine.awaitSpawned()
        XCTAssertNil(_a17, "no foreground check from the background")
        XCTAssertEqual(decided.scheduler.submissions.count, 1)
    }

    func testACadenceChangeReschedulesFromTheLastCheck() async {
        let h = AlertsHarness { $0.cadence = .daily }
        var st = AlertsStateDoc.fresh
        let last = h.clock.now.addingTimeInterval(-3 * 3600)
        st.lastCheck = LastCheck(completedAt: WidgetTime.string(last), outcome: .nothingNew, hits: 0, from: .fixed,
                                 checkId: "00000000-0000-4000-8000-000000000009")
        h.store.put(st)
        _ = await h.engine.update(Data(#"{"cadence":"hourly"}"#.utf8))
        XCTAssertEqual(h.scheduler.cancels, 1)
        XCTAssertEqual(h.scheduler.submissions.first, last.addingTimeInterval(3600))
        let _a18 = await h.engine.awaitSpawned()
        XCTAssertEqual(_a18, .ran(.hits), "Daily to Hourly 3 h after: due now")

        let w = AlertsHarness { $0.cadence = .hourly }
        var st2 = AlertsStateDoc.fresh
        let recent = w.clock.now.addingTimeInterval(-600)
        st2.lastCheck = LastCheck(completedAt: WidgetTime.string(recent), outcome: .nothingNew, hits: 0, from: .fixed,
                                  checkId: "00000000-0000-4000-8000-000000000009")
        w.store.put(st2)
        _ = await w.engine.update(Data(#"{"cadence":"daily"}"#.utf8))
        XCTAssertEqual(w.scheduler.submissions.first, recent.addingTimeInterval(86400))
        let _a19 = await w.engine.awaitSpawned()
        XCTAssertNil(_a19, "Hourly to Daily 10 min after: waits")
        _ = await w.engine.update(Data(#"{"radiusMi":5}"#.utf8))
        XCTAssertEqual(w.transport.requests.count, 0, "a radius change never starts a check")
    }

    func testAnInvalidPatchChangesNothing() async {
        let h = AlertsHarness()
        let before = h.store.files[.settings]
        let r = await h.engine.update(Data(#"{"radiusMi":26}"#.utf8))
        XCTAssertEqual(r.failureValue, .invalid)
        XCTAssertEqual(h.store.files[.settings], before)
        let _a20 = await h.engine.handle(op: "update", payload: #"{"enabled":true}"#).contains(#""error":"invalid""#)
        XCTAssertTrue(_a20)
        let _a21 = await h.engine.handle(op: "nope", payload: "").contains(#""error":"unknown-op""#)
        XCTAssertTrue(_a21)
    }

    func testAPositionSeedIsStored() async {
        let h = AlertsHarness()
        _ = await h.engine.update(Data(#"{"model":"my-location","position":{"lat":38.6,"lng":-121.5}}"#.utf8))
        XCTAssertEqual(h.store.state().position?.source, .seed)
        XCTAssertEqual(h.store.settings(h.clock.now).model, .myLocation)
    }

    func testClearEmptiesTheInboxAndKeepsSettingsAndPending() async {
        let h = AlertsHarness()
        _ = await h.engine.runCheck(.background)
        var st = h.store.state()
        st.pending = PendingSummary(windowEndAt: "2026-10-01T14:00:00Z", place: .nearby,
                                    hits: [PendingHit(speciesCode: "ruff", comName: "Ruff", locId: "L1", distanceMi: 1, link: AlertLink.viewLink)],
                                    checkIds: [])
        h.store.put(st)
        let g = await h.engine.generation
        let sweeps = h.store.tempSweeps
        _ = await h.engine.clearInbox()
        XCTAssertTrue(h.store.inbox(h.clock.now).isEmpty)
        XCTAssertEqual(h.store.tempSweeps, sweeps + 1, "a temp copy of the inbox goes with Clear (I9)")
        XCTAssertNotNil(h.store.state().pending, "Clear names rows and nothing else (FR-39)")
        XCTAssertTrue(h.store.settings(h.clock.now).enabled, "alerts stay on")
        let _a22 = await h.engine.generation
        XCTAssertEqual(_a22, g + 1)
        // After Clear a species alerted before may alert again (FR-27).
        h.clock.now = h.clock.now.addingTimeInterval(7200)
        let _a23 = await h.engine.runCheck(.background)
        XCTAssertEqual(_a23, .ran(.hits))
    }

    func testPurgeRemovesTheInboxAndTheDeferredSummaryAndKeepsTheRest() async {
        let h = AlertsHarness()
        _ = await h.engine.runCheck(.background)
        h.notifier.pending = ["alerts.deferred"]
        var st = h.store.state()
        st.pending = PendingSummary(windowEndAt: "2026-10-01T14:00:00Z", place: .nearby,
                                    hits: [PendingHit(speciesCode: "ruff", comName: "Ruff", locId: "L1", distanceMi: 1, link: AlertLink.viewLink)],
                                    checkIds: [])
        h.store.put(st)
        let pokes = h.app.pokes
        let sweeps = h.store.tempSweeps
        _ = await h.engine.purgeInbox()
        XCTAssertNil(h.store.files[.inbox])
        XCTAssertNil(h.store.state().pending)
        XCTAssertNotNil(h.store.state().lastCheck, "the last check is history the next check overwrites")
        XCTAssertTrue(h.notifier.pending.isEmpty)
        XCTAssertTrue(h.store.settings(h.clock.now).enabled)
        XCTAssertEqual(h.app.pokes, pokes + 1)
        XCTAssertEqual(h.store.tempSweeps, sweeps + 1, "a temp copy a killed write left beside the inbox goes too (I6)")
    }

    func testActivationClearsADeliveredSummaryAndChecksWhenDue() async {
        let h = AlertsHarness()
        var st = AlertsStateDoc.fresh
        st.pending = PendingSummary(windowEndAt: WidgetTime.string(h.clock.now.addingTimeInterval(-60)), place: .nearby,
                                    hits: [PendingHit(speciesCode: "ruff", comName: "Ruff", locId: "L1", distanceMi: 1, link: AlertLink.viewLink)],
                                    checkIds: [])
        h.store.put(st)
        let _a24 = await h.engine.appActivated()
        XCTAssertEqual(_a24, .ran(.hits))
        XCTAssertNil(h.store.state().pending)
        let sweeps = h.store.tempSweeps
        let _a25 = await h.engine.appActivated()
        XCTAssertNil(_a25, "not due again right away")
        XCTAssertEqual(h.store.tempSweeps, sweeps + 1, "activation alone sweeps a killed write's temp copy (I9)")
    }

    func testTheKeyNeverReachesADocumentOrAReply() async {
        let h = AlertsHarness()
        _ = await h.engine.runCheck(.background)
        _ = await h.engine.update(Data(#"{"radiusMi":10,"position":{"lat":1,"lng":2}}"#.utf8))
        let replies = [
            await h.engine.handle(op: "snapshot", payload: ""),
            await h.engine.handle(op: "update", payload: "garbage"),
            await h.engine.handle(op: "disable", payload: ""),
            await h.engine.handle(op: "enable", payload: ""),
            await h.engine.handle(op: "purge", payload: ""),
        ]
        for text in h.writtenText + replies { XCTAssertFalse(text.contains(AlertsHarness.key)) }
        XCTAssertFalse(h.writtenText.isEmpty)
    }

    func testTheSnapshotCarriesTheLiveBlockedStateAndPermissions() async {
        let h = AlertsHarness { $0.fixedPlace = nil }
        h.store.handover = .valid(Handover(version: 1, writtenAt: "2026-09-30T00:00:00Z", appVersion: "1", ebirdKey: "abc",
                                           hasEbirdBackup: true, recorded: [], hasMlExport: false, targetsMissingPhoto: [],
                                           targetsMissingAudio: [], targetsMissingVideo: [], defaultLocation: nil,
                                           countableExceptions: [], nonCountableExceptions: []))
        h.notifier.auth = .denied
        h.scheduler.statusValue = .denied
        let s = await h.engine.snapshot()
        XCTAssertEqual(s.blocked, .noPlace)
        XCTAssertEqual(s.permissions, AlertsPermissions(notifications: .denied, location: .granted))
        XCTAssertEqual(s.state.backgroundRefresh, .denied)
        XCTAssertNil(s.defaultLocation)
        let json = await h.engine.handle(op: "snapshot", payload: "")
        XCTAssertTrue(json.hasPrefix(#"{"#) && json.contains(#""ok":true"#) && json.contains(#""blocked":"no-place""#))
        XCTAssertTrue(json.contains(#""defaultLocation":null"#))
    }

    // MARK: Security review L1 to L4, QA-12, QA-41

    private static let quiet: (inout AlertsSettings) -> Void = {
        $0.quietHours = QuietHoursSetting(on: true, startMin: 1320, endMin: 420)
    }
    /// 23:30 in Los Angeles (inside the default quiet hours) and 09:00.
    private static let lateNight = AlertFixture.date("2026-09-30T06:30:00Z")
    private static let morning = AlertFixture.date("2026-09-30T16:00:00Z")

    func testAPostSuspendedWhileAlertsTurnOffOrTheBackupClearsIsWithdrawn() async {
        // L1: `post` suspends before the system adds the request and the actor
        // is reentrant, so a remover can run first; what the post then adds
        // must not stay behind it, deferred or on screen.
        enum Remover { case disable, purge, clear, expire }
        let cases: [(String, Date, (inout AlertsSettings) -> Void, Remover)] = [
            ("deferred, then off", Self.lateNight, Self.quiet, .disable),
            ("deferred, then the backup cleared", Self.lateNight, Self.quiet, .purge),
            ("immediate, then off", Self.morning, { _ in }, .disable),
            ("immediate, then the backup cleared", Self.morning, { _ in }, .purge),
            // A Clear or an expiration withdraws nothing: the rows the check
            // wrote would otherwise keep these species from alerting.
            ("deferred, then Clear", Self.lateNight, Self.quiet, .clear),
            ("immediate, then expiration", Self.morning, { _ in }, .expire),
        ]
        for (name, now, configure, remover) in cases {
            let h = AlertsHarness(now: now, tz: la, configure: configure)
            let gate = AlertsGate()
            h.notifier.postGate = gate
            let check = Task { await h.engine.runCheck(.background) }
            while h.notifier.postsStarted == 0 { try? await Task.sleep(nanoseconds: 1_000_000) }
            switch remover {
            case .disable: _ = await h.engine.setEnabled(false)
            case .purge: _ = await h.engine.purgeInbox()
            case .clear: _ = await h.engine.clearInbox()
            case .expire: await h.engine.expire()
            }
            await gate.release()
            let result = await check.value
            XCTAssertEqual(result, .discarded, name)
            XCTAssertEqual(h.notifier.posts.count, 1, "\(name): the post did land")
            switch remover {
            case .disable, .purge:
                XCTAssertTrue(h.notifier.pending.isEmpty, "\(name): nothing waits")
                XCTAssertTrue(h.notifier.delivered.isEmpty, "\(name): nothing on screen")
            case .clear:
                XCTAssertEqual(h.notifier.pending, [AlertRules.deferredId], name)
            case .expire:
                XCTAssertEqual(h.notifier.delivered.count, 1, name)
            }
        }
    }

    private func rawInbox(_ rows: [InboxRow]) -> Data {
        struct Doc: Encodable { let version = 1; let rows: [InboxRow] }
        return try! JSONEncoder().encode(Doc(rows: rows))
    }

    private func rawRowIds(_ data: Data?) -> [String] {
        guard let d = data, let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              let rows = obj["rows"] as? [[String: Any]] else { return ["<unreadable>"] }
        return rows.map { $0["id"] as! String }
    }

    private func inboxRow(_ n: Int, _ code: String, at: String) -> InboxRow {
        InboxRow(id: String(format: "00000000-0000-4000-8000-%012d", n), checkId: "00000000-0000-4000-8000-000000000001",
                 speciesCode: code, comName: "Name \(n)", locId: "L1", locName: "Place", lat: 38.5, lng: -121.7,
                 obsDt: "2026-09-29 07:00", distanceMi: 1.5, point: InboxPoint(lat: 38.5, lng: -121.7), radiusMi: 25,
                 place: .nearby, alertedAt: at, updatedAt: at)
    }

    func testAnAlertPastThirtyDaysLeavesTheDiskAtTheNextReadWithAlertsOnOrOff() async {
        // L2: a read that drops a row writes the document back, so the bound
        // holds on disk: at activation with alerts OFF, and on a check that
        // finds nothing new (and so writes no row of its own).
        for enabled in [false, true] {
            let h = AlertsHarness(fetch: .ok(Data("[]".utf8)), enabled: enabled)
            let old = WidgetTime.string(h.clock.now.addingTimeInterval(-31 * 86_400))
            let recent = WidgetTime.string(h.clock.now.addingTimeInterval(-2 * 86_400))
            h.store.files[.inbox] = rawInbox([inboxRow(1, "ruff", at: old), inboxRow(2, "sabgul", at: recent)])
            if enabled {
                let r = await h.engine.runCheck(.background)
                XCTAssertEqual(r, .ran(.nothingNew))
            } else {
                let r = await h.engine.appActivated()
                XCTAssertNil(r)
            }
            XCTAssertEqual(rawRowIds(h.store.files[.inbox]), ["00000000-0000-4000-8000-000000000002"], "enabled: \(enabled)")
        }
    }

    func testTheStoredPositionIsRemovedOnceItCanNoLongerBeUsed() async {
        // L3: Fixed place, off, a backup clear and location found off each
        // remove it; past its 24 hours it leaves the document at the next read.
        let seed = Data(#"{"model":"my-location","position":{"lat":38.6,"lng":-121.5}}"#.utf8)
        let actions: [(String, (AlertsHarness) async -> Void)] = [
            ("Fixed place", { _ = await $0.engine.update(Data(#"{"model":"fixed"}"#.utf8)) }),
            ("off", { _ = await $0.engine.setEnabled(false) }),
            ("backup cleared", { _ = await $0.engine.purgeInbox() }),
            ("location off", { $0.locator.auth = .denied; _ = await $0.engine.snapshot() }),
            ("location off, found by a check eBird is holding", { h in
                var st = h.store.state()
                st.holdUntil = WidgetTime.string(h.clock.now.addingTimeInterval(30))
                h.store.put(st)
                h.locator.auth = .denied
                let r = await h.engine.runCheck(.background)
                XCTAssertEqual(r, .skipped(.held))
            }),
        ]
        for (name, act) in actions {
            let h = AlertsHarness()
            _ = await h.engine.update(seed)
            XCTAssertNotNil(h.store.state().position, name)
            await act(h)
            XCTAssertNil(h.store.state().position, name)
        }
        // A radius change under My location keeps it.
        let k = AlertsHarness()
        _ = await k.engine.update(seed)
        _ = await k.engine.update(Data(#"{"radiusMi":5}"#.utf8))
        XCTAssertNotNil(k.store.state().position)

        let h = AlertsHarness { $0.model = .myLocation }
        var st = AlertsStateDoc.fresh
        st.position = StoredPosition(lat: 38.6, lng: -121.5, at: WidgetTime.string(h.clock.now.addingTimeInterval(-23 * 3600)),
                                     source: .foreground)
        h.store.put(st)
        _ = await h.engine.snapshot()
        XCTAssertNotNil(h.store.state().position, "inside 24 hours it stays")
        h.clock.now = h.clock.now.addingTimeInterval(3600 + 1)
        _ = await h.engine.snapshot()
        XCTAssertNil(h.store.state().position, "past 24 hours it is removed from the document")
    }

    func testImplausibleFutureTimesReadAsAbsent() async {
        // L4: a hold past the 60-second cap from now is expired; the cap holds.
        for (ahead, want) in [(61.0, CheckResult.ran(.hits)), (60.0, .skipped(.held))] {
            let h = AlertsHarness()
            var st = AlertsStateDoc.fresh
            st.holdUntil = WidgetTime.string(h.clock.now.addingTimeInterval(ahead))
            h.store.put(st)
            let r = await h.engine.runCheck(.background)
            XCTAssertEqual(r, want, "hold \(ahead) s ahead")
        }
        // A last check more than 24 hours ahead is forgotten, so one falls due.
        for (ahead, due) in [(24.0 * 3600 + 1, true), (24.0 * 3600, false)] {
            let h = AlertsHarness()
            var st = AlertsStateDoc.fresh
            st.lastCheck = LastCheck(completedAt: WidgetTime.string(h.clock.now.addingTimeInterval(ahead)), outcome: .nothingNew,
                                     hits: 0, from: .fixed, checkId: "00000000-0000-4000-8000-000000000009")
            h.store.put(st)
            let r = await h.engine.appActivated()
            XCTAssertEqual(r != nil, due, "last check \(ahead) s ahead")
        }
        // A position more than 24 hours ahead goes.
        let h = AlertsHarness { $0.model = .myLocation }
        var st = AlertsStateDoc.fresh
        st.position = StoredPosition(lat: 38.6, lng: -121.5, at: WidgetTime.string(h.clock.now.addingTimeInterval(25 * 3600)),
                                     source: .seed)
        h.store.put(st)
        _ = await h.engine.snapshot()
        XCTAssertNil(h.store.state().position)
    }

    func testAQuietHoursEditLeavesADeferredSummaryAlone() async {
        // QA-12's third clause (FR-13): editing quiet hours, or turning them
        // off, neither cancels nor moves a summary already deferred.
        let h = AlertsHarness(now: Self.lateNight, tz: la, configure: Self.quiet)
        _ = await h.engine.runCheck(.background)
        let pending = h.store.state().pending
        XCTAssertNotNil(pending)
        XCTAssertEqual(h.notifier.pending, [AlertRules.deferredId])
        for patch in [#"{"quietHours":{"on":true,"startMin":1380,"endMin":360}}"#,
                      #"{"quietHours":{"on":false,"startMin":1320,"endMin":420}}"#] {
            _ = await h.engine.update(Data(patch.utf8))
            XCTAssertEqual(h.notifier.pending, [AlertRules.deferredId], patch)
            XCTAssertEqual(h.store.state().pending, pending, patch)
        }
        XCTAssertFalse(h.notifier.removed.contains(AlertRules.deferredId))
    }

    func testTurningOffKeepsTheInboxAndEverySetting() async {
        // QA-41 (FR-41): off stops checks and keeps the inbox and the settings.
        let h = AlertsHarness(now: Self.morning, tz: la) {
            $0.cadence = .daily
            $0.radiusMi = 7
            $0.quietHours = QuietHoursSetting(on: true, startMin: 1380, endMin: 360)
        }
        _ = await h.engine.runCheck(.background)
        let rows = h.store.inbox(h.clock.now)
        XCTAssertEqual(rows.count, 2)
        var before = h.store.settings(h.clock.now)
        h.clock.now = h.clock.now.addingTimeInterval(60)
        _ = await h.engine.setEnabled(false)
        XCTAssertEqual(h.store.inbox(h.clock.now), rows, "the inbox stays")
        XCTAssertFalse(h.store.removes.contains(.inbox))
        let after = h.store.settings(h.clock.now)
        XCTAssertFalse(after.enabled)
        before.enabled = false
        before.updatedAt = after.updatedAt
        XCTAssertEqual(after, before, "every other setting stays")
    }

    // MARK: Re-review: L6, I10, I8

    func testUnderMyLocationACheckMeasuresFromAnApproximatePoint() async {
        // L6: the request, the inbox rows and the notification's link all carry
        // the position rounded to two decimals, never the device's own; a Fixed
        // place keeps the precision the user gave it.
        let h = AlertsHarness { $0.model = .myLocation }
        var st = AlertsStateDoc.fresh
        st.position = StoredPosition(lat: 38.61234567, lng: -121.51234567,
                                     at: WidgetTime.string(h.clock.now.addingTimeInterval(-3600)), source: .seed)
        h.store.put(st)
        let r = await h.engine.runCheck(.background)
        XCTAssertEqual(r, .ran(.hits))
        XCTAssertTrue(h.transport.requests[0].url!.absoluteString.contains("lat=38.61000&lng=-121.51000"))
        let rows = h.store.inbox(h.clock.now)
        XCTAssertEqual(rows.count, 2)
        XCTAssertTrue(rows.allSatisfy { $0.point == InboxPoint(lat: 38.61, lng: -121.51) })
        XCTAssertTrue(h.notifier.posts[0].link.contains("&lat=38.61000&lng=-121.51000&"))
        for text in h.writtenText where !text.contains("\"position\"") {
            XCTAssertFalse(text.contains("38.6123"), "only the state's own position holds the full reading")
        }

        let f = AlertsHarness()
        _ = await f.engine.runCheck(.background)
        XCTAssertTrue(f.store.inbox(f.clock.now).allSatisfy { $0.point == InboxPoint(lat: 38.5449, lng: -121.7405) })
    }

    func testEveryCheckAppliesTheThirtyDayBoundOnDisk() async {
        // I10: a check that is held or blocked (no request, no answer) still
        // removes an alert past its 30 days from the document.
        let blockedHandover = HandoverRead.valid(AlertsHarness.handover(key: nil))
        let cases: [(String, HandoverRead, Bool, CheckResult)] = [
            ("held", .valid(AlertsHarness.handover()), true, .skipped(.held)),
            ("blocked", blockedHandover, false, .skipped(.blocked(.noKey))),
        ]
        for (name, handover, held, want) in cases {
            let h = AlertsHarness(handover: handover)
            if held {
                var st = AlertsStateDoc.fresh
                st.holdUntil = WidgetTime.string(h.clock.now.addingTimeInterval(30))
                h.store.put(st)
            }
            let old = WidgetTime.string(h.clock.now.addingTimeInterval(-31 * 86_400))
            let recent = WidgetTime.string(h.clock.now.addingTimeInterval(-2 * 86_400))
            h.store.files[.inbox] = rawInbox([inboxRow(1, "ruff", at: old), inboxRow(2, "sabgul", at: recent)])
            let r = await h.engine.runCheck(.background)
            XCTAssertEqual(r, want, name)
            XCTAssertEqual(h.transport.requests.count, 0, name)
            XCTAssertEqual(rawRowIds(h.store.files[.inbox]), ["00000000-0000-4000-8000-000000000002"], name)
        }
    }

    func testASummaryMoreThan26HoursAheadIsDroppedWithItsRequest() async {
        // I8: a summary deferred while the clock ran ahead would otherwise hold
        // every later quiet-hours hit until that date. 26 h ahead stays (a
        // quiet window across a daylight-saving change can end about 25 h out).
        for (ahead, dropped) in [(26.0 * 3600 + 1, true), (26.0 * 3600, false)] {
            let h = AlertsHarness(enabled: false)
            var st = AlertsStateDoc.fresh
            st.pending = PendingSummary(windowEndAt: WidgetTime.string(h.clock.now.addingTimeInterval(ahead)), place: .nearby,
                                        hits: [PendingHit(speciesCode: "ruff", comName: "Ruff", locId: "L1", distanceMi: 1,
                                                          link: AlertLink.viewLink)],
                                        checkIds: [])
            h.store.put(st)
            h.notifier.pending = [AlertRules.deferredId]
            _ = await h.engine.appActivated()
            XCTAssertEqual(h.store.state().pending == nil, dropped, "\(ahead) s ahead")
            XCTAssertEqual(h.notifier.pending.isEmpty, dropped, "\(ahead) s ahead: its request")
        }
    }

    func testUnderMyLocationOnlyAWidgetCellReadFromTheDeviceCounts() async {
        // L7, the QA probe's scenario: My location, a hand-set fixed place, no
        // position of the app's own, and the widget's newest cell (built from
        // the hand-over's Default Location) 10 minutes old. A cell the widget
        // built from that fallback, or one an older widget left unmarked, is not
        // the user's position: the check measures from the fixed place and its
        // status says so. Only a cell read from the device is "near you".
        let cell = WidgetCache.cell(for: Coordinate(lat: 38.5446, lng: -121.7405))
        let cases: [(CellSource?, Bool)] = [(.defaultLocation, false), (nil, false), (.device, true)]
        for (marker, used) in cases {
            let name = marker.map(\.rawValue) ?? "unmarked"
            let h = AlertsHarness {
                $0.model = .myLocation
                $0.fixedPlace = FixedPlace(lat: 40.0, lng: -120.0, name: nil)
            }
            h.store.cache = WidgetCache(version: 1, keyFingerprint: WidgetCache.fingerprint(AlertsHarness.key), cell: cell,
                                        fetchedAt: WidgetTime.string(h.clock.now.addingTimeInterval(-600)), records: [],
                                        backoff: nil, lastFailure: nil, cellSource: marker)
            let r = await h.engine.runCheck(.background)
            XCTAssertEqual(r, .ran(.hits), name)
            let url = h.transport.requests[0].url!.absoluteString
            let rows = h.store.inbox(h.clock.now)
            let title = h.notifier.posts.first?.title ?? ""
            XCTAssertEqual(rows.count, 2, name)
            if used {
                XCTAssertTrue(url.contains("lat=38.54000&lng=-121.74000"), "\(name): \(url)")
                XCTAssertEqual(h.store.state().lastCheck?.from, .myLocation, name)
                XCTAssertEqual(title, "2 lifers reported near you", name)
                XCTAssertTrue(rows.allSatisfy { $0.place == .nearYou }, name)
            } else {
                XCTAssertTrue(url.contains("lat=40.00000&lng=-120.00000"), "\(name): \(url)")
                XCTAssertEqual(h.store.state().lastCheck?.from, .fixedFallback, "\(name): From your fixed place")
                XCTAssertFalse(title.contains("near you"), "\(name): \(title)")
                XCTAssertTrue(rows.allSatisfy { $0.place != .nearYou && $0.point == InboxPoint(lat: 40.0, lng: -120.0) }, name)
            }
        }
    }

    func testNoAppGroupIsReportedAsSuch() async {
        let h = AlertsHarness()
        h.store.available = false
        let _a26 = await h.engine.handle(op: "enable", payload: "").contains(#""error":"no-app-group""#)
        XCTAssertTrue(_a26)
    }
}

private extension Result {
    var failureValue: Failure? { if case .failure(let f) = self { return f }; return nil }
}
