// ubuntu-latest CI cannot compile Swift, so these tests run on the release machine (see the snowraven-release skill).
//
// ios-alerts schema.md 3.7: `Countability.isNonCountableForm` agrees with the
// app's `isNonCountableForm` on every name in both of eBird's exception lists,
// the hand-authored shape corpus, a synthetic non-ASCII pair of lists, and the
// generated single-position-edit corpus. The twin declares NO difference, so
// the corpus reports both directions' disagreement counts and asserts each is
// zero (testing.md's symmetric-difference rule).

import XCTest

final class CountabilityTests: XCTestCase {
    private let c = AlertFixture.object("countability")

    func testEveryListNameAndShapeRowAgrees() {
        let rows = c["rows"] as! [[String: Any]]
        XCTAssertGreaterThan(rows.count, 150, "both lists plus the shapes")
        for r in rows {
            let name = r["name"] as! String
            XCTAssertEqual(Countability.isNonCountableForm(name, lists: AlertFixture.lists), r["nonCountable"] as! Bool,
                           name)
        }
    }

    func testSyntheticNonASCIIListsAgree() {
        let s = c["synthetic"] as! [String: Any]
        let lists = CountabilityLists(rejects: s["rejects"] as! [String], counts: s["counts"] as! [String])
        for r in s["rows"] as! [[String: Any]] {
            let name = r["name"] as! String
            XCTAssertEqual(Countability.isNonCountableForm(name, lists: lists), r["nonCountable"] as! Bool, name)
        }
    }

    /// Every replace, insert and delete of one UTF-16 unit over the fixture's
    /// alphabet, built here in the TypeScript order, against the twin's verdicts.
    func testTheSinglePositionEditCorpusHasNoDisagreementInEitherDirection() {
        let corpus = c["corpus"] as! [String: Any]
        let base = Array((corpus["base"] as! String).utf16)
        let alphabet = Array((corpus["alphabet"] as! String).utf16)
        let verdicts = Array((corpus["verdicts"] as! String).utf8)
        XCTAssertEqual(alphabet.count, 96)
        var names: [String] = []
        for i in 0..<base.count {
            for ch in alphabet { var u = base; u[i] = ch; names.append(String(decoding: u, as: UTF16.self)) }
        }
        for i in 0...base.count {
            for ch in alphabet { var u = base; u.insert(ch, at: i); names.append(String(decoding: u, as: UTF16.self)) }
        }
        for i in 0..<base.count { var u = base; u.remove(at: i); names.append(String(decoding: u, as: UTF16.self)) }
        XCTAssertEqual(names.count, corpus["count"] as! Int)
        XCTAssertEqual(verdicts.count, names.count)
        var swiftOnly = 0, tsOnly = 0
        for (n, v) in zip(names, verdicts) {
            let swift = Countability.isNonCountableForm(n, lists: AlertFixture.lists)
            let ts = v == UInt8(ascii: "1")
            if swift && !ts { swiftOnly += 1 }
            if ts && !swift { tsOnly += 1 }
        }
        print("countability corpus: \(names.count) names; non-countable in Swift only: \(swiftOnly); in TypeScript only: \(tsOnly)")
        XCTAssertEqual(swiftOnly, 0)
        XCTAssertEqual(tsOnly, 0)
        // Non-vacuity: the corpus holds both verdicts.
        XCTAssertTrue(verdicts.contains(UInt8(ascii: "1")) && verdicts.contains(UInt8(ascii: "0")))
    }

    /// Code units, not grapheme clusters: a combining mark after "/" hides the
    /// slash from Swift's Character-based `contains`, never from JavaScript's
    /// `includes`, and the twin must read it as JavaScript does.
    func testTheShapeRuleReadsCodeUnits() {
        let lists = CountabilityLists(rejects: [], counts: [])
        XCTAssertTrue(Countability.isNonCountableForm("Greater/\u{0301}Lesser Scaup", lists: lists))
        XCTAssertTrue(Countability.isNonCountableForm("gull sp.", lists: lists))
        XCTAssertFalse(Countability.isNonCountableForm("gull sp.\u{0301}", lists: lists))
        // Canonically equivalent but different units: only the exact units are in the set.
        let composed = CountabilityLists(rejects: ["Caf\u{00E9} Bird"], counts: [])
        XCTAssertTrue(Countability.isNonCountableForm("Caf\u{00E9} Bird", lists: composed))
        XCTAssertFalse(Countability.isNonCountableForm("Cafe\u{0301} Bird", lists: composed))
    }
}
