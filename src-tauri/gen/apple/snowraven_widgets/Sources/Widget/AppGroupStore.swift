// The widget's side of the App Group container (ios-lifer-widgets, schema.md
// sections 1 and 3). It reads the hand-over the app writes and owns
// `widgets/cache.json`. It never opens the app's own sandbox documents (FR-33):
// the extension is a separate process with its own sandbox, and the App Group
// is the only shared place.
//
// Reads are bounded and regular-file only (BoundedFile). The cache write is
// temp-then-rename in the same directory, so a reader never sees half a file;
// a symlink or directory planted at the fixed name is removed, never followed,
// and a link planted at `widgets/` itself is never traversed.

import Foundation

struct AppGroupStore: WidgetStore {
    /// `widgets/` itself is never a followed link (security review I1): a link
    /// planted there reads as no directory at all (S1, no cache), and the app
    /// removes it as a link on its next hand-over write (`unplant_dir`).
    private var widgetsDir: URL? {
        guard let dir = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: AppGroup.id)?
            .appendingPathComponent(AppGroup.widgetsDir, isDirectory: true) else { return nil }
        if (try? FileManager.default.attributesOfItem(atPath: dir.path)[.type] as? FileAttributeType) == .typeSymbolicLink { return nil }
        return dir
    }

    func readHandover() -> HandoverRead {
        guard let dir = widgetsDir else { return .absent }
        return HandoverDecoder.read(at: dir.appendingPathComponent(AppGroup.handoverFile))
    }

    func readCache() -> WidgetCache? {
        guard let dir = widgetsDir,
              let data = BoundedFile.read(dir.appendingPathComponent(AppGroup.cacheFile), maxBytes: AppGroup.cacheMaxBytes)
        else { return nil }
        return WidgetCache.decode(data)
    }

    func writeCache(_ cache: WidgetCache) {
        guard let dir = widgetsDir, let data = cache.encoded(), data.count <= AppGroup.cacheMaxBytes else { return }
        let fm = FileManager.default
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let target = dir.appendingPathComponent(AppGroup.cacheFile)
        let tmp = dir.appendingPathComponent("\(AppGroup.cacheFile).tmp-\(ProcessInfo.processInfo.processIdentifier)")
        for url in [tmp, target] {
            if let attrs = try? fm.attributesOfItem(atPath: url.path),
               let type = attrs[.type] as? FileAttributeType, type == .typeSymbolicLink || type == .typeDirectory {
                try? fm.removeItem(at: url)
            }
        }
        do {
            try data.write(to: tmp)
            if rename(tmp.path, target.path) != 0 { try? fm.removeItem(at: tmp) }
        } catch {
            try? fm.removeItem(at: tmp)
        }
    }
}
