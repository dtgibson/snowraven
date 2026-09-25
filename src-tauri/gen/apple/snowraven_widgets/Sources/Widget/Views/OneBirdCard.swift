// Small: the single nearest bird, bottom-anchored under the header
// (design-spec.md "One-bird card"). The name at up to two lines, then the
// distance in the accent with the recency beside it, and under Any the
// missing-media glyphs at the end of that line, right-aligned, wrapping
// beneath it only when there is no room. The location name is not drawn here
// and stays in the accessibility label. One text-style step smaller than the
// rows would give, because a two-line name, the distance and a glyph line must
// fit a small tile.
//
// THE GLYPH LINE, measured by rendering on the 158 pt iPhone tile (128 pt of
// content): the distance, the recency and two or three glyphs do not fit one
// line at the default text size for an ordinary row ("8.4 mi", "4 days ago",
// camera and microphone need about 150 pt). Of the spec's two placements the
// glyph rule wins, so the forms are tried in this order: everything on one
// line; the glyphs kept at the end of the distance line with the recency
// under the distance; the distance and recency on one line with the glyphs
// wrapped under it, right-aligned (the mockup's flex-wrap); and last, at the
// largest sizes, each on its own line. No figure ever breaks mid-figure.

import SwiftUI
import WidgetKit

struct OneBirdCard: View {
    let row: WidgetRow
    let showGlyphs: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var distance: some View {
        Text(row.distanceText)
            .font(.title2.weight(.bold))
            .monospacedDigit()
            .foregroundStyle(Palette.accent)
            .widgetAccentable()
            .contentTransition(reduceMotion ? .identity : .numericText())
            .fixedSize()
    }

    private var recency: some View {
        Text(row.recency)
            .font(.caption2.weight(.medium))
            .foregroundStyle(Palette.muted)
            .fixedSize()
    }

    private func name(lines: Int) -> some View {
        Text(row.comName)
            .font(.headline.weight(.bold))
            .lineLimit(lines)
            .truncationMode(.tail)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// The distance and the recency on one line where they fit, stacked where
    /// they do not: neither figure ever breaks mid-figure.
    private var figures: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 6) { distance; recency }
            VStack(alignment: .leading, spacing: 0) { distance; recency }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Spacer(minLength: 0)
            // Two lines where the tile has room, one (with an ellipsis; the
            // label keeps the full name) where it does not.
            ViewThatFits(in: .vertical) {
                name(lines: 2)
                name(lines: 1)
            }
            if showGlyphs {
                let glyphs = MediaGlyphs(missing: row.missingMedia)
                // Spacing 0 with explicit gaps: a stack's spacing is added on
                // BOTH sides of a Spacer, which made the gap 16 pt and pushed
                // rows that fit (measured by rendering) into the next form.
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: 0) {
                        distance; recency.padding(.leading, 6); Spacer(minLength: 8); glyphs
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .firstTextBaseline, spacing: 0) { distance; Spacer(minLength: 8); glyphs }
                        recency
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { distance; recency }
                        HStack(spacing: 0) { Spacer(minLength: 0); glyphs }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        distance; recency
                        HStack(spacing: 0) { Spacer(minLength: 0); glyphs }
                    }
                }
            } else {
                figures
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
    }
}
