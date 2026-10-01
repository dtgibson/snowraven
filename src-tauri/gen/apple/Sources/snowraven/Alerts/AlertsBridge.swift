// The C surface between Rust and the alert engine (ios-alerts, schema.md 10.2):
// three symbols in, two callbacks out, the `WidgetReload.swift` pattern (plain
// `@_cdecl` functions resolved when Xcode links libapp.a into the app; no
// bridging header, no new build setting).
//
//   snowraven_alerts_init(changed, open_link)
//     Called once from the Rust plugin's setup, BEFORE `UIApplicationMain`:
//     stores the two Rust callbacks, builds the engine over the real seams,
//     registers the BGAppRefreshTask (the deadline is "before the app finishes
//     launching"), sets the notification delegate, and installs the
//     didBecomeActive trigger.
//   snowraven_alerts_call(op, payload) -> strdup'd UTF-8 JSON envelope
//     `{"ok":true,"snapshot":S}` or `{"ok":false,"error":"<short string>"}`.
//     Called from a Rust blocking-pool thread, never the main thread: the call
//     blocks on a semaphore while the actor answers, and enabling may wait on
//     the system's notification prompt.
//   snowraven_alerts_free(p)  frees what `snowraven_alerts_call` returned.
//
// Nothing here logs, prints or formats a document or the key.

import Foundation
import UserNotifications

enum AlertsBridge {
    static var engine: AlertsEngine?
    static let notifier = AlertsNotifier()
    static let appState = UIKitAlertsAppState()
    private static var initialized = false

    fileprivate static func start(changed: @escaping @Sendable () -> Void, openLink: @escaping @Sendable (String) -> Void) {
        guard !initialized else { return }
        initialized = true
        appState.onPoke = changed
        notifier.onOpenLink = openLink
        let e = AlertsEngine(store: AppGroupAlertsStore(), transport: EBirdClient(), locator: AlertsLocator(),
                             scheduler: AlertsScheduler(), notifier: notifier, app: appState)
        engine = e
        AlertsScheduler.register(engine: { AlertsBridge.engine })
        UNUserNotificationCenter.current().delegate = notifier
        AlertsLifecycle.install(engine: { AlertsBridge.engine })
    }
}

/// A box the detached task writes and the waiting thread reads after the
/// semaphore, so the handoff is ordered by the semaphore itself.
private final class ReplyBox: @unchecked Sendable {
    var text = ""
}

@_cdecl("snowraven_alerts_init")
public func snowravenAlertsInit(_ changed: @escaping @convention(c) () -> Void,
                                _ openLink: @escaping @convention(c) (UnsafePointer<CChar>?) -> Void) {
    AlertsBridge.start(
        changed: { changed() },
        openLink: { link in link.withCString { openLink($0) } }
    )
}

@_cdecl("snowraven_alerts_call")
public func snowravenAlertsCall(_ op: UnsafePointer<CChar>?, _ payload: UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>? {
    #if DEBUG
    dispatchPrecondition(condition: .notOnQueue(.main))
    #endif
    let opText = op.map { String(cString: $0) } ?? ""
    let payloadText = payload.map { String(cString: $0) } ?? ""
    let reply: String
    if let e = AlertsBridge.engine {
        let box = ReplyBox()
        let done = DispatchSemaphore(value: 0)
        Task.detached {
            box.text = await e.handle(op: opText, payload: payloadText)
            done.signal()
        }
        done.wait()
        reply = box.text
    } else {
        reply = AlertsEnvelope.error("unavailable")
    }
    return strdup(reply)
}

@_cdecl("snowraven_alerts_free")
public func snowravenAlertsFree(_ p: UnsafeMutablePointer<CChar>?) {
    free(p)
}
