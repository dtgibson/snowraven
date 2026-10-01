// UserNotifications for the alert check (ios-alerts, FR-14, FR-29 to FR-36;
// schema.md 4.6). Local notifications only: no push, no `aps-environment`
// entitlement, nothing sent anywhere.
//
// * The permission is asked ONLY by `alerts_set_enabled(true)`, only while it
//   is undecided, and never again (FR-14). A denied permission leaves alerts on
//   and the inbox filling; `post` then attempts nothing.
// * One immediate request per check (`alerts.check.<checkId>`), or the ONE
//   replaceable deferred request (`alerts.deferred`) with a calendar trigger at
//   the end of the quiet window: re-adding an identifier that is already
//   pending replaces it, which is how several checks in one window leave one
//   summary (FR-35), and the trigger fires whether or not the app runs (FR-36).
// * The delegate shows a foreground check's banner (FR-32) for identifiers
//   with the `alerts.` prefix only, and hands a tapped alert's link to Rust,
//   which runs the same validator and link path the widget taps use (5.3).

import Foundation
import UserNotifications

final class AlertsNotifier: NSObject, AlertsNotifying, UNUserNotificationCenterDelegate, @unchecked Sendable {
    private let center = UNUserNotificationCenter.current()
    /// Called with a tapped notification's link (the Rust `open_link` callback).
    var onOpenLink: (@Sendable (String) -> Void)?

    func authorization() async -> NotificationAuth {
        let s = await center.notificationSettings()
        switch s.authorizationStatus {
        case .notDetermined: return .notDetermined
        case .denied: return .denied
        case .authorized, .provisional, .ephemeral: return .granted
        @unknown default: return .denied
        }
    }

    func requestAuthorization() async {
        guard await authorization() == .notDetermined else { return }
        _ = try? await center.requestAuthorization(options: [.alert, .sound])
    }

    func post(_ n: AlertNotification) async {
        guard await authorization() == .granted else { return }
        let content = UNMutableNotificationContent()
        content.title = n.title
        content.body = n.body
        content.sound = .default
        content.threadIdentifier = "alerts"
        content.userInfo = ["link": n.link]
        var trigger: UNNotificationTrigger? = nil
        if let at = n.deliverAt {
            let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: at)
            trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
        }
        let request = UNNotificationRequest(identifier: n.identifier, content: content, trigger: trigger)
        try? await center.add(request)
    }

    func pendingIdentifiers() async -> [String] {
        await center.pendingNotificationRequests().map(\.identifier)
    }

    func removePending(_ identifiers: [String]) async {
        center.removePendingNotificationRequests(withIdentifiers: identifiers)
    }

    func removeDelivered(_ identifiers: [String]) async {
        center.removeDeliveredNotifications(withIdentifiers: identifiers)
    }

    // MARK: UNUserNotificationCenterDelegate

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        if notification.request.identifier.hasPrefix(AlertRules.notificationPrefix) {
            completionHandler([.banner, .list, .sound])
        } else {
            completionHandler([])
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let request = response.notification.request
        // The link was built and validated by this app, and Rust and the
        // webview validate it again; it is still checked here against the
        // alert link's own pattern before it is parked (defense in depth).
        if request.identifier.hasPrefix(AlertRules.notificationPrefix),
           response.actionIdentifier == UNNotificationDefaultActionIdentifier,
           let link = request.content.userInfo["link"] as? String,
           AlertLink.matches(link) || link == AlertLink.viewLink {
            onOpenLink?(link)
        }
        completionHandler()
    }
}
