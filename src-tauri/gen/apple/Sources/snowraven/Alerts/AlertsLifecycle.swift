// The app-state seam and the foreground trigger (ios-alerts, FR-21; schema.md
// 2.5 and 4.1).
//
// * `didBecomeActive` runs the SAME native check a background task runs, when
//   alerts are on and the interval has elapsed, so the two triggers share one
//   `running` flag and one `lastCheck` and cannot double-check.
// * The `snowraven-alerts` poke reaches the webview only while the app is not
//   in the background: in a background launch no webview runs and tao's loop is
//   parked, so a poke would only queue. The webview re-reads its snapshot on
//   `visibilitychange` regardless.

import Foundation
import UIKit

final class UIKitAlertsAppState: AlertsAppState, @unchecked Sendable {
    /// The Rust `changed` callback.
    var onPoke: (@Sendable () -> Void)?

    func isForeground() async -> Bool {
        await MainActor.run { UIApplication.shared.applicationState != .background }
    }

    func poke() async {
        guard await isForeground() else { return }
        onPoke?()
    }
}

enum AlertsLifecycle {
    private static var observer: NSObjectProtocol?

    static func install(engine: @escaping @Sendable () -> AlertsEngine?) {
        guard observer == nil else { return }
        observer = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in
            guard let e = engine() else { return }
            Task { _ = await e.appActivated() }
        }
    }
}
