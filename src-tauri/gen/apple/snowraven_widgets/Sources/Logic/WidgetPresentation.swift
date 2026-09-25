// What one family of one widget shows and says, derived from a model
// (ios-lifer-widgets, design-spec.md "Widget anatomy" and "Accessibility
// label"). Pure, with the calendar, zone and locale injected, so the footer
// rules and the whole-widget VoiceOver label are tested exactly.
//
// Footer: on a list (and on S10, which S7 and S9 compose with), the Default
// Location caption when it applies, the stale reason when the latest attempt
// failed, then the update time; medium and large always show the update time,
// small only when the list is marked stale. Joined with middle dots on screen
// and read as sentences.

import Foundation

enum WidgetFamilySize: String, CaseIterable {
    case small, medium, large

    var rowCount: Int {
        switch self {
        case .small: return 1
        case .medium: return 3
        case .large: return 8
        }
    }
}

struct WidgetPresentation: Equatable {
    let title: String
    let windowText: String
    let rows: [WidgetRow]
    let message: String?
    let footer: [String]
    let showsGlyphs: Bool
    let accessibilityLabel: String
    /// The header alone as a sentence ("Nearby Lifers, Week."): the whole
    /// label while the widget is WidgetKit's placeholder (S12), whose sample
    /// rows are redacted on screen and must not be read as real reports.
    let headerLabel: String
    let link: String

    /// "today, 7:05 AM", "yesterday, 4:12 PM", or "Sep 20, 4:12 PM".
    static func relativeTime(_ d: Date, now: Date, tz: TimeZone, locale: Locale) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        let time = DateFormatter()
        time.locale = locale
        time.timeZone = tz
        time.dateStyle = .none
        time.timeStyle = .short
        let t = time.string(from: d)
        if cal.isDate(d, inSameDayAs: now) { return "today, \(t)" }
        if let y = cal.date(byAdding: .day, value: -1, to: now), cal.isDate(d, inSameDayAs: y) { return "yesterday, \(t)" }
        let day = DateFormatter()
        day.locale = locale
        day.timeZone = tz
        day.setLocalizedDateFormatFromTemplate("MMMd")
        return "\(day.string(from: d)), \(t)"
    }

    /// The footer's update time: the short time alone when it is today.
    static func updatedTime(_ d: Date, now: Date, tz: TimeZone, locale: Locale) -> String {
        let rel = relativeTime(d, now: now, tz: tz, locale: locale)
        return rel.hasPrefix("today, ") ? String(rel.dropFirst("today, ".count)) : rel
    }

    static func make(_ m: WidgetModel, family: WidgetFamilySize, now: Date, tz: TimeZone, locale: Locale) -> WidgetPresentation {
        let title = WidgetCopy.title(m.kind)
        let windowText = WidgetCopy.windowText(kind: m.kind, window: m.window, media: m.media)
        let isList = m.state == .list || m.state == .empty
        let rows = m.state == .list ? Array(m.rows.prefix(family.rowCount)) : []
        let lastSuccess = m.lastSuccess.map { relativeTime($0, now: now, tz: tz, locale: locale) }
        let message = WidgetCopy.message(state: m.state, kind: m.kind, window: m.window, media: m.media,
                                         lastSuccess: m.state == .unreachable ? lastSuccess : nil)
        var footer: [String] = []
        if isList {
            if m.usedDefaultLocation { footer.append(WidgetCopy.footerDefaultLocation) }
            if let s = m.stale { footer.append(s == .offline ? WidgetCopy.footerOffline : WidgetCopy.footerBusy) }
            if let u = m.updatedAt, family != .small || m.stale != nil {
                footer.append(WidgetCopy.updated(updatedTime(u, now: now, tz: tz, locale: locale)))
            }
        }
        let singleMedia = m.kind == .targets && m.media != .any
        let headerLabel = "\(title), \(WidgetCopy.windowWord(m.window))\(singleMedia ? ", \(WidgetCopy.mediaWord(m.media))" : "")."
        var label = headerLabel
        if let msg = message { label += " \(msg)" }
        for r in rows { label += " \(r.label)" }
        if !footer.isEmpty { label += " \(footer.joined(separator: ". "))." }
        return WidgetPresentation(
            title: title, windowText: windowText, rows: rows, message: message, footer: footer,
            showsGlyphs: m.kind == .targets && m.media == .any, accessibilityLabel: label,
            headerLabel: headerLabel,
            link: DeepLink.string(kind: m.kind, window: m.window, media: m.media))
    }
}
