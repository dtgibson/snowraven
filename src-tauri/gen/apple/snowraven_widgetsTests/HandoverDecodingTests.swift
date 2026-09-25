// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// QA-33 and the Swift side of the three-sided bounds (schema.md section 1.2):
// the reader treats a truncated, wrong-version, wrong-typed, over-bound,
// unknown-field, symlinked or oversized document as ABSENT (S1), never as a
// partially usable one. Each row here goes red if this side's enforcement is
// deleted.

import XCTest

final class HandoverDecodingTests: XCTestCase {
    private func json(_ mutate: (inout [String: Any]) -> Void) -> Data {
        var obj = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(Fixture.shared.handover)) as! [String: Any]
        mutate(&obj)
        return try! JSONSerialization.data(withJSONObject: obj)
    }

    func testTheFixtureDocumentIsValid() {
        XCTAssertEqual(HandoverDecoder.decode(json { _ in }), .valid(Fixture.shared.handover))
    }

    func testMalformedDocumentsReadAsAbsent() {
        let good = json { _ in }
        let rows: [(String, Data)] = [
            ("truncated", good.prefix(good.count / 2)),
            ("not json", Data("hello".utf8)),
            ("an array", Data("[]".utf8)),
            ("wrong version", json { $0["version"] = 2 }),
            ("wrong type", json { $0["hasEbirdBackup"] = "yes" }),
            ("missing field", json { $0.removeValue(forKey: "recorded") }),
            ("unknown field", json { $0["observations"] = [] }),
            ("key with a space", json { $0["ebirdKey"] = "abc def" }),
            ("key too long", json { $0["ebirdKey"] = String(repeating: "a", count: 129) }),
            ("name over 200 units", json { $0["recorded"] = [String(repeating: "a", count: 201)] }),
            ("name with a control character", json { $0["recorded"] = ["mal\u{0009}lard"] }),
            ("name with edge whitespace", json { $0["recorded"] = [" mallard"] }),
            ("set over 20,000", json { $0["recorded"] = (0...20_000).map { "n\($0)" } }),
            ("backup flag false with names", json { $0["hasEbirdBackup"] = false }),
            ("export flag false with sets", json { $0["hasMlExport"] = false }),
            ("latitude out of range", json { $0["defaultLocation"] = ["lat": 91.0, "lng": 0.0] }),
            ("bad writtenAt", json { $0["writtenAt"] = "2026-09-23 18:04:11Z" }),
            ("bad appVersion", json { $0["appVersion"] = "1.0 beta" }),
        ]
        for (name, data) in rows { XCTAssertEqual(HandoverDecoder.decode(data), .absent, name) }
    }

    func testUtf16BoundsCountSurrogatePairsAsTwo() {
        let ok = String(repeating: "\u{1F426}", count: 100)
        let over = String(repeating: "\u{1F426}", count: 101)
        XCTAssertTrue(Handover.isValidName(ok))
        XCTAssertFalse(Handover.isValidName(over))
        XCTAssertTrue(Handover.isValidName("brant\u{0085}"), "U+0085 is not in JavaScript's trim set")
    }

    func testTheFileReadIsRegularFileOnlyAndBoundedBeforeReading() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let real = dir.appendingPathComponent("real.json")
        try json { _ in }.write(to: real)
        XCTAssertEqual(HandoverDecoder.read(at: real), .valid(Fixture.shared.handover))

        let link = dir.appendingPathComponent("link.json")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: real)
        XCTAssertEqual(HandoverDecoder.read(at: link), .absent, "a symlink is never followed")

        let sub = dir.appendingPathComponent("dir.json", isDirectory: true)
        try FileManager.default.createDirectory(at: sub, withIntermediateDirectories: true)
        XCTAssertEqual(HandoverDecoder.read(at: sub), .absent)

        let big = dir.appendingPathComponent("big.json")
        FileManager.default.createFile(atPath: big.path, contents: nil)
        let h = try FileHandle(forWritingTo: big)
        try h.truncate(atOffset: UInt64(AppGroup.handoverMaxBytes + 1))
        try h.close()
        XCTAssertEqual(HandoverDecoder.read(at: big), .absent, "over the bound by size, before any read")
        XCTAssertEqual(HandoverDecoder.read(at: dir.appendingPathComponent("missing.json")), .absent)
    }

    func testLogicNeverNamesTheAppsOwnDocuments() throws {
        // FR-33: the extension reads only the App Group. Its sources carry no
        // path to the app's sandbox documents.
        let logic = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("../snowraven_widgets/Sources").standardizedFileURL
        let files = FileManager.default.enumerator(at: logic, includingPropertiesForKeys: nil)!
            .compactMap { $0 as? URL }.filter { $0.pathExtension == "swift" }
        XCTAssertGreaterThan(files.count, 10)
        for f in files {
            let text = try String(contentsOf: f, encoding: .utf8)
            for banned in ["api-keys.json", "settings.json", "metadata.json", "replay.json", "AppLocalData"] {
                XCTAssertFalse(text.contains(banned), "\(f.lastPathComponent) names \(banned)")
            }
        }
    }

    /// Security review I2: every way Swift turns a value into text redacts the key.
    func testTheKeyNeverAppearsWhenAHandoverIsPrintedDumpedOrReflected() {
        let sentinel = "SENTINELkey0123456789"
        let h = Fixture.shared.handover.with(key: .some(sentinel))
        XCTAssertEqual(h.ebirdKey, sentinel, "the value itself is intact")
        var dumped = ""
        dump(h, to: &dumped)
        var dumpedRead = ""
        dump(HandoverRead.valid(h), to: &dumpedRead)
        let renderings = [
            String(describing: h), String(reflecting: h), "\(h)", dumped, dumpedRead,
            String(describing: HandoverRead.valid(h)), String(reflecting: HandoverRead.valid(h)),
            String(describing: [h]), String(reflecting: Optional(h)),
            Mirror(reflecting: h).children.map { "\($0.label ?? ""): \($0.value)" }.joined(separator: ", "),
        ]
        for (i, text) in renderings.enumerated() {
            XCTAssertFalse(text.contains(sentinel), "rendering \(i) carries the key")
            XCTAssertTrue(text.contains("<redacted>"), "rendering \(i) marks the key as present")
        }
        XCTAssertTrue(String(describing: Fixture.shared.handover.with(key: .some(nil))).contains("ebirdKey: nil"))
    }
}
