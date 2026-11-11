# The read of PRIVACY_POLICY.md and ACCESSIBILITY.md against the Hotspot Reports tab

**Recorded for FR-60 and QA-58.** Read on 2026-11-10 against the working tree as built (`frontend/src/components/hotspotReports/`, `frontend/src/lib/hotspotReports*.ts`) and against `schema.md` sections 11 and 15. Neither file is edited by this build; a sentence the tab made false would have become a held proposal here.

**Conclusion: no sentence in either file is made false by the tab, so no change is required.** One optional sentence is offered for each file (section 3), each with the guard it would need, for the user to take or leave. One pre-existing question about ACCESSIBILITY.md's Known Exceptions, which the tab inherits but does not create, is recorded in section 2.4 for the orchestrator.

## 1. PRIVACY_POLICY.md

What the tab does that the policy could be about, from the schema's network section and the code:

- **No new stored document, no new setting, nothing in iCloud Sync, no `clearDerived.ts` row** (FR-58). The tab keeps its selection in component state for the session; `HotspotReportsTab.tsx` writes nothing through the `storage` seam.
- **No new host, endpoint or request moved between components** (NFR-01). What it reuses, each unchanged: the map tiles and style `<SnowMap>` already requests from OpenFreeMap; the existing `/map/hotspot-region` lookup behind the shared hotspot Set, with its existing 30-day store, which this tab may be the first surface in a session to trigger; the existing batched `/taxonomy/codes` post every `<BirdName>` surface makes; the bird-link favicons from ebird.org and birdsoftheworld.org.
- **The report's map has no layer switcher**, so it always shows the default "Map" base, OpenFreeMap's vector tiles, never Satellite, Topo or Trails (`SnowMap` reads the saved base only when `switcher` is set).

| Sentence or section | Could the tab touch it? | Verdict |
|---|---|---|
| "Your Data Stays on Your Device", the stored-items bullet (line 13) | It lists what is stored. The tab stores nothing new. | Stays true. |
| "All processing of your eBird and media files happens locally" (line 14) | Every figure on the tab is derived in the page from the two loaded files. | Stays true. |
| The "You can delete your stored files..." bullet, the list of what Clear removes (line 16) | A complete-reading list; a new `clearDerived.ts` row would owe a sentence (docs rule, v1.0.62). The tab adds no row. "the lists of public hotspots for the regions you have birded" already names the store the tab reads. | Stays true and complete. |
| "Connections to Bird and Weather Services", the opening paragraph (line 29: "only to get the data you ask for") | The hotspot lookup the tab can start is the existing one, made to classify places the user is looking at. | Stays true. |
| The eBird bullet (line 31: "hotspots ... species taxonomy") | Names the kinds of eBird request; the tab adds none. | Stays true. |
| The Statistics sub-bullet (line 33), including "it asks eBird which locations in the regions you have birded are public hotspots. Each region's answer is kept on your device until you clear your eBird backup, and a later launch asks again only about a region with no stored answer, or one whose stored answer is older than 30 days or is dated more than a day ahead of your device's clock." | It describes the shared lookup under Statistics. The sentence is not a closed list of the surfaces that start the lookup (the Checklists and Named Birds hotspot links already start it too), and the tab changes nothing about when it asks again (FR-17: no retry, no schedule change, no second classification). | Stays true. The "asks again only about" list gains no cause from this tab (docs rule, v1.0.66). |
| "Your Location" (lines 42 to 48) | The tab reads no device location and has no location control. Its map is centred on a place from the backup. | Stays true. |
| "Map Tiles" (line 52): "As you pan and zoom, your device requests the tiles for the area you are viewing directly from these providers ... You choose which base map is active with the layer switcher, and only the active layers' tiles are requested." | The report's map requests OpenFreeMap tiles for the area around the chosen place, the moment a place with coordinates is opened (the overview mounts no map). It has no switcher, so it shows the default Map base. The section already covers a map requesting the tiles for the area it shows, and only the active base's tiles are requested. The Named Birds card map already has no switcher, so "with the layer switcher" was never a claim that every map carries one. | Stays true. Offered precision in section 3.1. |
| The OpenFreeMap bullet (line 54) | The report's map loads the same style, tiles, and bundled glyphs and sprite. | Stays true. |
| "iOS App" and "Android App" (lines 61 and 79: "adds no service connections beyond those listed above") | No new connection. | Stays true. |
| "Embedded Bird Media and Link Icons" (line 86: icons "beside bird names throughout the app") | The life list draws `<BirdName>`, whose icons load from the two hosts named. The tab embeds no player and no iframe. | Stays true. |

## 2. ACCESSIBILITY.md

What the tab does that the statement could be about, from the components: the picker is a combobox of the house family (an `<input role="combobox">` and a chevron `Button`, two tab stops, options as `role="option"` divs with index-keyed ids, `aria-activedescendant`); a polite `role="status"` live region, always mounted while the tab is ready, holding only the sentence in a sequence-keyed child; ranked rows are `Button`s that move focus to the report's name heading; the jump row is a named `nav` of `Link`s that move focus to each section's heading; every bar (the count bar, the life list's share bars, the distribution rails) is `aria-hidden` beside its figure in text; the kind is a glyph with its word; the shared `TabLoadErrorAlert` is the first child of every branch; the report's map draws one `aria-hidden` pin on a presentational marker wrapper and no corner control.

| Sentence or section | Could the tab touch it? | Verdict |
|---|---|---|
| Keyboard Navigation, paragraph 2 (line 11): "every app-owned button and link goes through the same native control layer" | Every button and link the tab draws is the `Button` or `Link` primitive; `lib/tabOrderCoverage.test.ts` holds that over every shipped `.tsx` and is what makes the sentence true for the tab's files. | Stays true while that guard is green. |
| Line 13: "Every button, link, filter pill, toggle, sortable column header, and the species selector is a real control ... and each is a tab stop on every platform." and "A control is deliberately kept out of the tab order only when another tab stop already reaches the same interaction." | The picker's chevron, unlike the species selector's, is its own tab stop (FR-23), so it needs no exclusion; the headings that take focus are `tabIndex={-1}` targets, not buttons or links. | Stays true. |
| Line 13: "The species selector itself behaves like a proper combobox ..." | Describes the species selector, not a roster of comboboxes; the Life Lists Region picker and the Targets county picker are already outside it. | Stays true. Offered addition in section 3.2. |
| Line 23 (map markers): "Every control SnowRaven itself draws on or around a map is keyboard-operable on every platform, the base-layer switcher, the filters, fullscreen, the location button, the share button, the marker chips and those popup close buttons among them" | The report's map draws no control: its pin is decorative and its wrapper presentational, so nothing on it is a control. "Among them" gives examples, not a roster. | Stays true. |
| Line 23: "The map's own zoom answers the + and - keys while the map itself has focus." | The report's map keeps MapLibre's keyboard handler, which `SnowMap` does not turn off. | Stays true. |
| Line 23: "In the Map Explorer's bottom-right corner they are a single row ..." | Scoped to the Map Explorer. | Stays true. |
| Screen Reader Support (line 29): "Regions that update on their own (the weather result, species and result counts, loading states, inline errors, ...) are announced as they change." | The tab's selection announcement is one more such region; the list is examples. | Stays true. |
| Line 29: the load-failure paragraph: "on each tab that loads one of those files as it opens (Statistics, Targets and the Map Explorer among them) the message appears inside an alert region that is already present, and empty, from the moment the tab starts loading" | A universal claim over every tab that loads a file. The tab mounts `TabLoadErrorAlert` as the first child of its loading, setup, error and ready branches (`HotspotReportsTab.tsx`), so React keeps one region node across the phases; `TabLoadErrorAlert.test.tsx` and `honestLoadFailures.test.tsx` carry the tab's rows in this build. | Stays true. |
| Line 29: charts: "A chart drawn as ROWS OF TEXT does not [carry an image role] ... every value is already on its own row in words and numbers, so the bars beside them are marked decorative" | The protocol, weather, month and year figures are the shared distribution row (`WeatherDistRow.tsx`), text rows with decorative rails; the count bar and the life list's share bars are `aria-hidden` beside text. The examples named stay true; the tab follows the rule. | Stays true. |
| A Visible Focus Indicator (line 39): "in-page 'jump to' links move keyboard focus to the destination section rather than leaving it behind on the link." | The jump row's links move focus to the section's heading (FR-31). | Stays true. |
| Color and Contrast (line 45): "Color is never the only way information is conveyed." | The kind is a glyph and a word; a missing kind is no tag at all, never a color; the typical weather band is named in words. | Stays true. |
| Line 47: "Every shaded surface also offers an explicit Use Textures switch ..." | The sentence is about shade ramps (atlas blocks, the Calendar's grid, county shading). The tab draws no shade ramp: its bars are lengths beside figures in text, like the Statistics hotspot share bar it reuses. | Stays true. |
| Line 47: "Chart figures are read from a label beside the bar rather than printed inside it" | No figure is printed inside a bar on the tab. | Stays true. |
| Text Size and Zoom (lines 53 and 55) | Every size on the tab is in rem; NFR-07 holds the tab at 320px and 200% text, measured by the Engineer's built-app probe (QA-68). | Stays true, on that measurement. |
| Reduced Motion (line 63) | The view's entrance runs only when reduced motion is off (`prefersReducedMotion()` in `HotspotReportsTab.tsx`); the CSS animations sit under the global reduced-motion block. | Stays true. |
| Focus Management (line 77): "That holds on every map that has a fullscreen button: the Map Explorer, Species Detail's Sighting Locations map ..., the Statistics Geographic Stats map, and the per-individual map on a Named Birds card." | A closed list of the maps WITH a fullscreen button. The report's map has none, so the list stays complete. | Stays true. |
| Known Exceptions (line 101): "The map library draws a few controls for itself ... There is one kind left." and line 103 on the + and - zoom buttons | The report's map carries the library's zoom buttons, the kind named. | Stays as true as it was; see 2.4. |

### 2.4 One pre-existing question, not created by this tab

Every `<SnowMap>` also carries MapLibre's compact attribution control. In the installed maplibre-gl (6.8.0) its toggle is a `<summary>` inside a `<details>`, which WebKit's default tab mode does reach, so the toggle itself is not a gap. The attribution links inside it are the library's own `<a href>` elements, which WebKit's default tab mode skips, and Known Exceptions does not name them, while line 101 says "There is one kind left". This was true before this build on every map, and the tab adds one more map with the same control; it is not made false by the tab, so no proposal is held here. Recorded for the orchestrator to raise with the user, or to file in the idea inbox, rather than silently.

## 3. Offered, not required

Each would need, in the same change, a guard row of the published-claims shape (docs rule, v1.0.21: a sentence added to either file without a test that reads it is unguarded prose). The rows would go in `hotspotReportsSurfacesPublishedClaims.test.ts`.

### 3.1 PRIVACY_POLICY.md, "Map Tiles" (optional precision; also `website/privacy.html`, kept identical)

BEFORE:

> You choose which base map is active with the layer switcher, and only the active layers' tiles are requested.

AFTER:

> On a map with a layer switcher you choose which base map is active, and only the active layers' tiles are requested; a map without one, such as the one on a Hotspot Reports report, shows the default "Map" base.

Guard it would need: a row that reads `components/hotspotReports/HotspotReportMap.tsx` with comments stripped, asserts it passes no `switcher`, and asserts the sentence in both `PRIVACY_POLICY.md` and `website/privacy.html`.

### 3.2 ACCESSIBILITY.md, Keyboard Navigation (optional; a new paragraph after the Search paragraph)

> **Hotspot Reports.** The Location picker is a combobox of the same family as the species selector, with two tab stops whatever the size of your backup: the text box and the button beside it. The highlighted place is carried by the text box, so focus stays there while the arrow keys, Home and End move through the list, Enter chooses, and Escape closes it. Each change of place is announced through a polite status region that is present before its first message. Pressing a place in either overview list moves focus to the report's heading, and each link in the row of section links moves focus to its section's heading.

Guard it would need: rows that read the picker's source for the two tab stops and the `aria-activedescendant` wiring, the tab's source for the always-mounted `role="status"` region, and the paragraph's presence in `ACCESSIBILITY.md`.
