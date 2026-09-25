// One widget, any family, any state (design-spec.md "Widget anatomy"):
// header (raven, title, window), body (one-bird card, rows, or one sentence),
// footer (caption, stale mark, update time). The whole widget is one
// VoiceOver element whose label is composed in Logic (WidgetPresentation), so
// it is complete even where the tile truncates or omits the location. A tap on
// a bird (a row on medium and large, the one-bird card on small) opens that
// bird in the matching Map Explorer view; any other tap opens the view
// (FR-34, Stage 8).
//
// THE PLACEHOLDER IS A STATE (S12), so the header survives it (FR-04, "The
// header stays in every state"): only the body and the footer are redacted,
// and the header is marked `.unredacted()`, which also overrides the redaction
// WidgetKit applies from outside to a placeholder entry. Its VoiceOver label
// is the header alone, so the sample birds are never read as real reports.

import SwiftUI
import WidgetKit

struct WidgetRootView: View {
    let entry: LiferEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetContentMargins) private var margins

    var body: some View {
        let size: WidgetFamilySize = {
            switch family {
            case .systemSmall: return .small
            case .systemLarge, .systemExtraLarge: return .large
            default: return .medium
            }
        }()
        let p = WidgetPresentation.make(entry.model, family: size, now: entry.date, tz: .current, locale: .current)
        WidgetContent(presentation: p, size: size, stale: entry.model.stale, redacted: entry.redacted)
            .padding(WidgetContent.insets(from: margins))
            .containerBackground(for: .widget) { Palette.background }
            .widgetURL(URL(string: p.widgetLink))
    }
}

/// The widget's content for one family, independent of WidgetKit's environment
/// so it can also be rendered directly (a preview or an offscreen render).
struct WidgetContent: View {
    /// The approved mockup's insets (12 top, 15 sides, 10 bottom), taken as a
    /// CAP on the system's own content margins rather than a replacement: with
    /// WidgetKit's default 16 pt margins a medium tile has no room for three
    /// two-line rows plus the header and the update time on a 158 pt tall
    /// iPhone medium widget (measured by rendering), which is what the design
    /// promises (FR-03). Where the system asks for less, the system wins.
    static func insets(from m: EdgeInsets) -> EdgeInsets {
        EdgeInsets(top: min(m.top, 12), leading: min(m.leading, 15), bottom: min(m.bottom, 10), trailing: min(m.trailing, 15))
    }

    let presentation: WidgetPresentation
    let size: WidgetFamilySize
    let stale: StaleReason?
    let redacted: Bool
    /// WidgetKit's own placeholder redaction, applied from outside this view.
    @Environment(\.redactionReasons) private var outerRedaction

    var body: some View {
        let p = presentation
        let placeholder = redacted || outerRedaction.contains(.placeholder)
        VStack(alignment: .leading, spacing: 0) {
            HeaderView(title: p.title, windowText: p.windowText, compact: size == .small)
                .unredacted()
            if let message = p.message {
                MessageView(text: message, compact: size == .small)
            } else if size == .small, let row = p.rows.first {
                OneBirdCard(row: row, showGlyphs: p.showsGlyphs)
            } else {
                RowList(rows: p.rows, showGlyphs: p.showsGlyphs, large: size == .large, links: p.rowLinks)
            }
            if !p.footer.isEmpty {
                FooterView(parts: p.footer, offline: stale == .offline)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(Palette.text)
        // The small family scales less than medium and large at the largest
        // sizes (design-spec.md "Dynamic Type": about 1.2x where the rows take
        // 1.3x): a two-line name, the distance line and a glyph line must fit a
        // small tile. Measured by rendering: at .xxLarge the header and the
        // glyph line were clipped on a 158 pt tile; at .xLarge everything fits.
        .dynamicTypeSize(size == .small ? DynamicTypeSize.xSmall...DynamicTypeSize.xLarge
                                        : DynamicTypeSize.xSmall...DynamicTypeSize.accessibility5)
        .redacted(reason: redacted ? .placeholder : [])
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(placeholder ? p.headerLabel : p.accessibilityLabel))
    }
}

struct HeaderView: View {
    let title: String
    let windowText: String
    let compact: Bool

    private var titleRow: some View {
        HStack(spacing: 6) {
            RavenGlyph()
                .fill(Palette.accent, style: FillStyle(eoFill: true))
                .frame(width: 13, height: 13)
                .widgetAccentable()
            Text(title)
                .font(compact ? .caption.weight(.semibold) : .footnote.weight(.semibold))
                .lineLimit(1)
        }
    }

    private var windowWord: some View {
        Text(windowText)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Palette.muted)
            .lineLimit(1)
    }

    var body: some View {
        // At large text sizes the window word drops under the title rather
        // than truncating either.
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) { titleRow; Spacer(minLength: 4); windowWord }
            VStack(alignment: .leading, spacing: 2) { titleRow; windowWord }
        }
        .padding(.bottom, 2)
    }
}

struct MessageView: View {
    let text: String
    let compact: Bool

    var body: some View {
        VStack(alignment: .leading) {
            Spacer(minLength: 0)
            Text(text)
                .font(compact ? .caption.weight(.medium) : .footnote.weight(.medium))
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct FooterView: View {
    let parts: [String]
    let offline: Bool

    var body: some View {
        HStack(spacing: 4) {
            if offline {
                Image(systemName: "icloud.slash").imageScale(.small).accessibilityHidden(true)
            }
            // Two lines at most: a stale mark plus its update time must never be
            // cut off on a small tile, where it is the only honesty signal.
            Text(parts.joined(separator: " \u{00B7} "))
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .font(.caption2)
        .foregroundStyle(Palette.muted)
        .padding(.top, 2)
    }
}

struct MediaGlyphs: View {
    let missing: [MediaNeed]

    private func symbol(_ m: MediaNeed) -> String {
        switch m {
        case .photo: return "camera.fill"
        case .audio: return "mic.fill"
        case .video: return "video.fill"
        }
    }

    var body: some View {
        HStack(spacing: 3) {
            ForEach(MediaNeed.allCases.filter { missing.contains($0) }, id: \.self) { m in
                Image(systemName: symbol(m))
            }
        }
        .font(.caption2)
        .foregroundStyle(Palette.muted)
        .fixedSize()
        .accessibilityHidden(true)
    }
}
