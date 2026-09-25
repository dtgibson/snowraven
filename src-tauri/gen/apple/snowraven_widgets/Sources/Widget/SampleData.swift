// Sample rows for the placeholder and the widget gallery (S12): a Bay Area
// birder in late September, as in the approved mockup. Never shown as a real
// list: the placeholder is redacted, and the gallery is WidgetKit's preview.
// No request, no location read.

import Foundation

enum SampleData {
    private static func row(_ name: String, _ miles: Double, _ days: Int, _ place: String, _ missing: [MediaNeed],
                            showNeeds: Bool) -> WidgetRow {
        let recency = ObsDate.recencyLabel(days)
        return WidgetRow(comName: name, speciesCode: name, locId: place, locName: place, lat: 0, lng: 0,
                         distanceMi: miles, distanceText: Distance.format(miles), daysAgo: days, recency: recency,
                         obsDt: "", subId: "", missingMedia: missing,
                         label: WidgetRows.rowLabel(comName: name, distanceMi: miles, recency: recency, locName: place,
                                                    missing: missing, showNeeds: showNeeds))
    }

    static func model(kind: WidgetKind, window: WidgetWindow, media: WidgetMedia) -> WidgetModel {
        let rows: [WidgetRow]
        if kind == .lifers {
            rows = [
                row("Ruff", 3.2, 0, "Coyote Hills Regional Park", [], showNeeds: false),
                row("Baird's Sandpiper", 5.8, 1, "Hayward Regional Shoreline", [], showNeeds: false),
                row("Pectoral Sandpiper", 9.1, 1, "Don Edwards NWR, Alviso", [], showNeeds: false),
                row("Tropical Kingbird", 11.4, 2, "Alameda Point", [], showNeeds: false),
                row("Blackpoll Warbler", 14.0, 3, "Golden Gate Park, Middle Lake", [], showNeeds: false),
                row("Prothonotary Warbler", 15.6, 4, "Lake Merced", [], showNeeds: false),
                row("Sabine's Gull", 21.3, 5, "Pillar Point Harbor", [], showNeeds: false),
                row("Buff-breasted Sandpiper", 24.7, 6, "Bolinas Lagoon", [], showNeeds: false),
            ]
        } else {
            let any = media == .any
            let all: [(String, Double, Int, String, [MediaNeed])] = [
                ("Wrentit", 0.9, 0, "Sunol Regional Wilderness", [.audio]),
                ("Nuttall's Woodpecker", 2.4, 0, "Alum Rock Park", [.photo]),
                ("Hutton's Vireo", 4.6, 1, "Joseph D. Grant County Park", [.photo, .audio]),
                ("California Thrasher", 6.3, 1, "Ed R. Levin County Park", [.audio, .video]),
                ("Oak Titmouse", 7.7, 2, "Coyote Creek Trail", [.video]),
                ("Black-throated Gray Warbler", 12.5, 3, "Calero County Park", [.photo, .audio, .video]),
                ("Bell's Sparrow", 18.2, 5, "Henry W. Coe State Park", [.photo, .audio, .video]),
                ("Yellow-billed Magpie", 19.9, 6, "Mount Hamilton Road", [.photo, .video]),
            ]
            let need = MediaNeed(rawValue: media.rawValue)
            rows = all.filter { need == nil || $0.4.contains(need!) }
                .map { row($0.0, $0.1, $0.2, $0.3, any ? $0.4 : [need!], showNeeds: any) }
        }
        return WidgetModel(kind: kind, window: window, media: media, state: .list, rows: rows,
                           usedDefaultLocation: false, stale: nil, updatedAt: Date(), lastSuccess: Date(),
                           nextRefresh: Date().addingTimeInterval(RefreshEngine.cadenceSeconds))
    }
}
