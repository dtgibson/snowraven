// Medium and large: the first N rows of the ordered list, two lines each, on
// hairline separators (design-spec.md "Row"). Rows that do not fit at the
// rendered text size are dropped WHOLE, never clipped (FR-03): `WholeRows`
// places rows top-down while each fits in full and moves the first one that
// does not, and every row after it, outside the clipped frame, so a family
// always shows the first rows of the list and never a later subset. A long
// name truncates first; the distance and the media glyphs never do.

import SwiftUI
import WidgetKit

struct RowList: View {
    let rows: [WidgetRow]
    let showGlyphs: Bool
    let large: Bool
    let link: String

    var body: some View {
        WholeRows {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                VStack(alignment: .leading, spacing: 0) {
                    if index > 0 {
                        Rectangle().fill(Palette.separator).frame(height: 0.5)
                    }
                    Link(destination: URL(string: link)!) {
                        RowView(row: row, showGlyphs: showGlyphs)
                            .padding(.vertical, large ? 3 : 1)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .clipped()
    }
}

/// Places its children top to bottom while each fits whole; the first child
/// that would overflow, and every child after it, is placed outside the bounds
/// (and so outside the clip), never squeezed.
struct WholeRows: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        let natural = subviews.reduce(0) { $0 + $1.sizeThatFits(ProposedViewSize(width: width, height: nil)).height }
        return CGSize(width: width, height: proposal.height ?? natural)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        var overflowed = false
        for sv in subviews {
            let h = sv.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil)).height
            if !overflowed && y + h <= bounds.maxY + 0.5 {
                sv.place(at: CGPoint(x: bounds.minX, y: y), proposal: ProposedViewSize(width: bounds.width, height: h))
                y += h
            } else {
                overflowed = true
                sv.place(at: CGPoint(x: bounds.minX, y: bounds.maxY + 10_000),
                         proposal: ProposedViewSize(width: bounds.width, height: h))
            }
        }
    }
}

struct RowView: View {
    let row: WidgetRow
    let showGlyphs: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                HStack(spacing: 5) {
                    Text(row.comName)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .contentTransition(reduceMotion ? .identity : .opacity)
                    if showGlyphs { MediaGlyphs(missing: row.missingMedia).layoutPriority(1) }
                }
                Spacer(minLength: 0)
                Text(row.distanceText)
                    .monospacedDigit()
                    .foregroundStyle(Palette.accent)
                    .widgetAccentable()
                    .contentTransition(reduceMotion ? .identity : .numericText())
                    .layoutPriority(2)
            }
            // .footnote (13 pt at the default size) is the mockup's 13.5 pt row
            // name: the size at which three two-line rows, the header and the
            // footer fit a medium tile inside WidgetKit's default margins.
            .font(.footnote.weight(.semibold).leading(.tight))
            Text("\(row.recency) \u{00B7} \(row.locName)")
                .font(.caption2.leading(.tight))
                .foregroundStyle(Palette.muted)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }
}
