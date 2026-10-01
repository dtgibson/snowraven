// The one notification a check produces (ios-alerts, FR-29, FR-30;
// design-spec section 9), the twin of `notificationTitle`,
// `notificationBody` and `phraseText` in frontend/src/lib/alerts/alertRules.ts.
//
// Title: "<n> lifer reported <phrase>" / "<n> lifers reported <phrase>", with
// the phrase "near <name>" | "near you" | "nearby". Body: up to three names
// nearest first joined by ", ", then " and <n - 3> more". The names are
// eBird's display names verbatim (no code, favicon or link); the place name is
// the only user text in the title, bounded at 120 units. The system renders
// both as plain text; nothing interprets them.

import Foundation

enum NotificationText {
    static func phrase(_ p: PlacePhrase) -> String {
        switch p {
        case .name(let n): return "near \(n)"
        case .nearYou: return "near you"
        case .nearby: return "nearby"
        }
    }

    static func title(count: Int, phrase p: PlacePhrase) -> String {
        "\(count) \(count == 1 ? "lifer" : "lifers") reported \(phrase(p))"
    }

    static func body(namesNearestFirst names: [String]) -> String {
        let shown = names.prefix(3).joined(separator: ", ")
        let more = names.count - 3
        return more > 0 ? "\(shown) and \(more) more" : shown
    }
}

/// What the notifier posts: one immediate request, or the one replaceable
/// deferred request at the end of the quiet window.
struct AlertNotification: Equatable, Sendable {
    let identifier: String
    let title: String
    let body: String
    let link: String
    /// nil = deliver now; else the local wall time of this instant.
    let deliverAt: Date?
}
