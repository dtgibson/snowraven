// BGTaskScheduler for the alert check (ios-alerts, schema.md 9.2).
//
// ONE task identifier, declared in the three iOS plist sources
// (`BGTaskSchedulerPermittedIdentifiers`) and pinned to `BG_TASK_ID` in
// frontend/src/lib/alerts/alertsState.ts and src-tauri/src/alerts.rs by
// alertsPaths.parity.test.ts. Registration happens from the Rust plugin's
// setup, before `UIApplicationMain` starts, which is before the app finishes
// launching (the deadline Apple states); a second registration would trap, so
// it is guarded. A submission is a REQUEST: iOS decides when a background
// check runs, which is what the Settings copy says (FR-06). A submit error
// (Background App Refresh off, too many requests, not permitted) is recorded,
// never thrown to the user.

import BackgroundTasks
import Foundation
import UIKit

final class AlertsScheduler: AlertsScheduling, @unchecked Sendable {
    static let taskId = "com.dtgibson.snowraven.alerts.refresh"

    private static var registered = false

    /// Register the launch handler once. The handler runs the check, lets the
    /// expiration handler cancel it (the running check is then discarded),
    /// and completes the task.
    static func register(engine: @escaping @Sendable () -> AlertsEngine?) {
        guard !registered else { return }
        registered = true
        _ = BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask, let e = engine() else {
                task.setTaskCompleted(success: false)
                return
            }
            let work = Task { await e.runCheck(.background) }
            refresh.expirationHandler = {
                work.cancel()
                Task { await e.expire() }
            }
            Task {
                let result = await work.value
                refresh.setTaskCompleted(success: result != .discarded)
            }
        }
    }

    func submit(earliest: Date) async -> BackgroundRefresh {
        let request = BGAppRefreshTaskRequest(identifier: AlertsScheduler.taskId)
        request.earliestBeginDate = earliest
        do {
            try BGTaskScheduler.shared.submit(request)
            return await status()
        } catch {
            let s = await status()
            return s == .available ? .denied : s
        }
    }

    func cancel() async {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: AlertsScheduler.taskId)
    }

    func status() async -> BackgroundRefresh {
        await MainActor.run {
            switch UIApplication.shared.backgroundRefreshStatus {
            case .available: return .available
            case .denied: return .denied
            case .restricted: return .restricted
            @unknown default: return .denied
            }
        }
    }
}
