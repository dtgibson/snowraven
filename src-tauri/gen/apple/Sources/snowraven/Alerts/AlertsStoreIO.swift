// The App Group side of the alert documents (ios-alerts, schema.md 3.1).
//
// `<container>/alerts/` holds the three documents this app process owns; the
// widget extension never opens it, and the webview cannot reach the container
// (its `fs` grant is `$APPLOCALDATA/**`). Every native read of a file outside
// the sealed bundle is a REGULAR FILE no larger than its bound, checked from
// the attributes before a byte is read (`BoundedFile`, .claude/rules/security.md);
// `alerts/` itself is a real directory, never a followed link, and a file or
// link planted at that name is removed as such before a write; each write is a
// temp file beside the target and a rename, with a link or directory planted
// at either name removed as such, so a crash mid-write leaves the previous
// document. The hand-over and the widget cache are READ here, never written.

import Foundation

struct AppGroupAlertsStore: AlertsStoreIO {
    private var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: AppGroup.id)
    }

    var containerAvailable: Bool { container != nil }

    private static func type(_ url: URL) -> FileAttributeType? {
        (try? FileManager.default.attributesOfItem(atPath: url.path))?[.type] as? FileAttributeType
    }

    /// `alerts/` for reading: nil when absent or when anything but a real
    /// directory sits at the name (a planted link is never traversed).
    private var alertsDirForReading: URL? {
        guard let c = container else { return nil }
        let dir = c.appendingPathComponent(AlertsFiles.dir, isDirectory: true)
        return AppGroupAlertsStore.type(dir) == .typeDirectory ? dir : nil
    }

    /// `alerts/` for writing: anything that is not a real directory is removed
    /// as itself, then the directory is created.
    private func alertsDirForWriting() -> URL? {
        guard let c = container else { return nil }
        let fm = FileManager.default
        let dir = c.appendingPathComponent(AlertsFiles.dir, isDirectory: true)
        if let t = AppGroupAlertsStore.type(dir), t != .typeDirectory { try? fm.removeItem(at: dir) }
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        return AppGroupAlertsStore.type(dir) == .typeDirectory ? dir : nil
    }

    func read(_ file: AlertsFile) -> Data? {
        guard let dir = alertsDirForReading else { return nil }
        return BoundedFile.read(dir.appendingPathComponent(file.name), maxBytes: file.maxBytes)
    }

    func write(_ file: AlertsFile, _ data: Data) -> Bool {
        guard data.count <= file.maxBytes, let dir = alertsDirForWriting() else { return false }
        let fm = FileManager.default
        let target = dir.appendingPathComponent(file.name)
        let tmp = dir.appendingPathComponent("\(file.name)\(AlertsFiles.tempInfix)\(ProcessInfo.processInfo.processIdentifier)")
        for url in [tmp, target] {
            if let t = AppGroupAlertsStore.type(url), t == .typeSymbolicLink || t == .typeDirectory {
                try? fm.removeItem(at: url)
            }
        }
        do {
            try data.write(to: tmp)
            if rename(tmp.path, target.path) != 0 {
                try? fm.removeItem(at: tmp)
                return false
            }
            return true
        } catch {
            try? fm.removeItem(at: tmp)
            return false
        }
    }

    func remove(_ file: AlertsFile) -> Bool {
        guard let c = container else { return false }
        let dir = c.appendingPathComponent(AlertsFiles.dir, isDirectory: true)
        guard let dt = AppGroupAlertsStore.type(dir) else { return true }          // no directory: nothing to remove
        guard dt == .typeDirectory else { return (try? FileManager.default.removeItem(at: dir)) != nil }
        let target = dir.appendingPathComponent(file.name)
        guard AppGroupAlertsStore.type(target) != nil else { return true }          // absent is already removed
        return (try? FileManager.default.removeItem(at: target)) != nil             // a link as the link, never its target
    }

    func removeTemporaryFiles() {
        guard let dir = alertsDirForReading,
              let names = try? FileManager.default.contentsOfDirectory(atPath: dir.path) else { return }
        for name in names where Units.contains(name, AlertsFiles.tempInfix) {
            try? FileManager.default.removeItem(at: dir.appendingPathComponent(name))   // a link as the link
        }
    }

    private var widgetsDir: URL? {
        guard let c = container else { return nil }
        let dir = c.appendingPathComponent(AppGroup.widgetsDir, isDirectory: true)
        return AppGroupAlertsStore.type(dir) == .typeDirectory ? dir : nil
    }

    func readHandover() -> HandoverRead {
        guard let dir = widgetsDir else { return .absent }
        return HandoverDecoder.read(at: dir.appendingPathComponent(AppGroup.handoverFile))
    }

    func readWidgetCache() -> WidgetCache? {
        guard let dir = widgetsDir,
              let data = BoundedFile.read(dir.appendingPathComponent(AppGroup.cacheFile), maxBytes: AppGroup.cacheMaxBytes)
        else { return nil }
        return WidgetCache.decode(data)
    }
}
