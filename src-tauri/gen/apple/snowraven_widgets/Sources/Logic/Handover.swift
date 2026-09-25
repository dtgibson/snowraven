// The hand-over reader (ios-lifer-widgets, schema.md section 1, FR-33): the
// document the app writes whole into the App Group and the widget reads on
// every refresh. Validated on EVERY read, with the same bounds the TypeScript
// builder and the Rust writer enforce; any failure is `.absent`, which the
// widget shows as S1 ("Open SnowRaven once to set up widgets"), never a
// partially used document. The key is held in memory only, and nothing here
// logs, prints or formats it.

import Foundation

struct DefaultLocation: Codable, Equatable {
    let lat: Double
    let lng: Double
}

struct Handover: Codable, Equatable {
    let version: Int
    let writtenAt: String
    let appVersion: String
    let ebirdKey: String?
    let hasEbirdBackup: Bool
    let recorded: [String]
    let hasMlExport: Bool
    let targetsMissingPhoto: [String]
    let targetsMissingAudio: [String]
    let targetsMissingVideo: [String]
    let defaultLocation: DefaultLocation?

    static let currentVersion = 1
    static let maxSetEntries = 20_000
    static let maxNameUnits = 200
    static let maxKeyLength = 128
    static let maxAppVersionLength = 32

    /// The exact field set, so a document carrying anything else is refused
    /// (the Rust writer's `deny_unknown_fields`, read side).
    static let fieldNames: Set<String> = [
        "version", "writtenAt", "appVersion", "ebirdKey", "hasEbirdBackup", "recorded", "hasMlExport",
        "targetsMissingPhoto", "targetsMissingAudio", "targetsMissingVideo", "defaultLocation",
    ]

    static func isValidName(_ s: String) -> Bool {
        let u = Array(s.utf16)
        guard (1...maxNameUnits).contains(u.count) else { return false }
        if u.contains(where: { $0 <= 0x1F || $0 == 0x7F }) { return false }
        return !JSText.isTrimSpace(u.first!) && !JSText.isTrimSpace(u.last!)
    }

    static func isValidKey(_ k: String) -> Bool {
        let b = Array(k.utf8)
        guard (1...maxKeyLength).contains(b.count) else { return false }
        return b.allSatisfy { ($0 >= 0x30 && $0 <= 0x39) || ($0 >= 0x41 && $0 <= 0x5A) || ($0 >= 0x61 && $0 <= 0x7A) }
    }

    static func isValidWrittenAt(_ t: String) -> Bool {
        let b = Array(t.utf8)
        guard b.count == 20 else { return false }
        for (i, c) in b.enumerated() {
            switch i {
            case 4, 7: if c != 0x2D { return false }
            case 10: if c != 0x54 { return false }       // T
            case 13, 16: if c != 0x3A { return false }
            case 19: if c != 0x5A { return false }       // Z
            default: if !(c >= 0x30 && c <= 0x39) { return false }
            }
        }
        return true
    }

    static func isValidAppVersion(_ v: String) -> Bool {
        let b = Array(v.utf8)
        guard (1...maxAppVersionLength).contains(b.count) else { return false }
        return b.allSatisfy {
            ($0 >= 0x30 && $0 <= 0x39) || ($0 >= 0x41 && $0 <= 0x5A) || ($0 >= 0x61 && $0 <= 0x7A)
                || $0 == 0x2E || $0 == 0x2B || $0 == 0x2D
        }
    }

    var isValid: Bool {
        guard version == Handover.currentVersion,
              Handover.isValidWrittenAt(writtenAt),
              Handover.isValidAppVersion(appVersion) else { return false }
        if let k = ebirdKey, !Handover.isValidKey(k) { return false }
        for set in [recorded, targetsMissingPhoto, targetsMissingAudio, targetsMissingVideo] {
            guard set.count <= Handover.maxSetEntries, set.allSatisfy(Handover.isValidName) else { return false }
        }
        if !hasEbirdBackup && !recorded.isEmpty { return false }
        if !hasMlExport && !(targetsMissingPhoto.isEmpty && targetsMissingAudio.isEmpty && targetsMissingVideo.isEmpty) {
            return false
        }
        if let loc = defaultLocation {
            guard loc.lat.isFinite, loc.lng.isFinite, (-90...90).contains(loc.lat), (-180...180).contains(loc.lng) else {
                return false
            }
        }
        return true
    }
}

/// The key never appears when a hand-over is printed, interpolated, dumped or
/// reflected (security review I2): the Swift half of the rule the Rust writer
/// keeps by deriving no `Debug` for the struct that carries it. A future
/// `print(h)`, or an XCTest failure message comparing two `HandoverRead`
/// values, shows `<redacted>`. The name sets and the Default Location are
/// summarized too, since none of it is needed to read a message.
extension Handover: CustomStringConvertible, CustomDebugStringConvertible, CustomReflectable {
    private var redactedKey: String { ebirdKey == nil ? "nil" : "<redacted>" }

    var description: String {
        "Handover(version: \(version), writtenAt: \(writtenAt), appVersion: \(appVersion), ebirdKey: \(redactedKey), "
            + "hasEbirdBackup: \(hasEbirdBackup), recorded: \(recorded.count) names, hasMlExport: \(hasMlExport), "
            + "targetsMissing: \(targetsMissingPhoto.count)/\(targetsMissingAudio.count)/\(targetsMissingVideo.count), "
            + "defaultLocation: \(defaultLocation == nil ? "nil" : "set"))"
    }

    var debugDescription: String { description }

    var customMirror: Mirror {
        Mirror(self, children: [
            "version": version, "writtenAt": writtenAt, "appVersion": appVersion, "ebirdKey": redactedKey,
            "hasEbirdBackup": hasEbirdBackup, "recorded": recorded.count, "hasMlExport": hasMlExport,
            "targetsMissingPhoto": targetsMissingPhoto.count, "targetsMissingAudio": targetsMissingAudio.count,
            "targetsMissingVideo": targetsMissingVideo.count, "defaultLocation": defaultLocation == nil ? "nil" : "set",
        ], displayStyle: .struct)
    }
}

enum HandoverRead: Equatable {
    case absent
    case valid(Handover)
}

enum HandoverDecoder {
    /// Decode and validate bytes already bounded by the caller.
    static func decode(_ data: Data) -> HandoverRead {
        guard data.count <= AppGroup.handoverMaxBytes else { return .absent }
        guard let any = try? JSONSerialization.jsonObject(with: data),
              let obj = any as? [String: Any],
              Set(obj.keys).isSubset(of: Handover.fieldNames) else { return .absent }
        guard let doc = try? JSONDecoder().decode(Handover.self, from: data), doc.isValid else { return .absent }
        return .valid(doc)
    }

    /// Read the document at `url`: a regular file (never a symlink or a
    /// directory, checked without following links) no larger than the bound,
    /// measured BEFORE the bytes are loaded (.claude/rules/security.md).
    static func read(at url: URL) -> HandoverRead {
        guard let data = BoundedFile.read(url, maxBytes: AppGroup.handoverMaxBytes) else { return .absent }
        return decode(data)
    }
}

enum BoundedFile {
    /// The bytes of a regular file of at most `maxBytes`, or nil. Uses
    /// `attributesOfItem`, which does not traverse a final symlink, so a
    /// planted link reads as absent.
    static func read(_ url: URL, maxBytes: Int) -> Data? {
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
              (attrs[.type] as? FileAttributeType) == .typeRegular,
              let size = (attrs[.size] as? NSNumber)?.intValue, size <= maxBytes else { return nil }
        guard let data = try? Data(contentsOf: url, options: [.uncached]), data.count <= maxBytes else { return nil }
        return data
    }
}
