# SnowRaven Accessibility

SnowRaven is built to be usable by everyone. It runs in the browser and as a desktop app, and it follows standard web accessibility practices so it works with keyboards and screen readers. This describes what is in place today. Accessibility is treated as ongoing work, not a finished checkbox, and the few known gaps are listed honestly at the end.

---

## Keyboard Navigation

Nearly all of SnowRaven is reachable and operable with the keyboard alone.

Every button, link, tab, filter pill, toggle, sortable column header, and the species selector is in the tab order and can be activated with Enter or Space. A "Skip to main content" link is the first thing in the tab order, so keyboard users can jump straight past the header. The main tab bar follows the standard pattern for tabbed interfaces: Left and Right arrow keys move between tabs, and Tab moves you into the page content. The species selector behaves like a proper combobox: type to filter, ArrowUp and ArrowDown move through the matches (the highlighted one scrolls into view), Enter selects it, and Escape closes the list. On a narrow screen, when the tab bar collapses into a dropdown, that menu is fully keyboard-operable too.

Settings groups that use a row of choices (color theme, text size, and date format) are arrow-key radio groups, so you Tab to the group and use the arrow keys to change the selection. The **Tab Layout** list, which lets you reorder your tabs, offers **Move up** and **Move down** buttons on every row as a full keyboard alternative to dragging.

**The Calendar:** every day cell in the year grid is a real button in the tab order, not a coloured tile. Its accessible name gives the date, that day's figure for the metric you have selected, and what activating it does ("Mar 14, 2025: 3. Open day details"), so the shading is never the only way to read a day. A day you birded without recording anything for that metric names the metric outright, so it reads as a genuine zero rather than as an empty cell: "Jun 1, 2025: birded, 0 countable species. Open day details", or "0 checklists" or "0 individuals" as the Species / Checklists / Total count switch dictates. Activating a cell opens that day's details dialog, which carries all three of the day's figures regardless of the metric on the grid; focus moves into the dialog, stays there while it is open, and returns to the day you came from when it closes with Escape, the Close button, or the backdrop.

**Map markers (Map Explorer):** the markers drawn *on* the map (sighting pins, hotspot teardrops, and media-target chips) are rendered on the GPU canvas or as pointer-only chips, so they cannot themselves be tab stops. Instead, the Map Explorer sidebar provides a focusable, screen-reader-labelled list of the markers in the current map view: a "Sightings in view" list in My Sightings mode, a "Hotspots in view" list in Hotspots mode, a "Targets in view" list in Media Targets mode, and a "Nearby lifers in view" list in Nearby Lifers mode. Every item is a real button in the tab order; activating one with Enter or Space opens the same details popup a mouse click on the marker would open and pans the map to it, and activating it again closes the popup, so the marker's information is reachable, operable, and dismissable without a pointer. When the breeding-atlas overlay is on, an "Atlas blocks in view" panel on the map gives the same keyboard path to each block: a focusable list whose rows open the block's breeding summary and eBird atlas link and pan the map to it. When the county overlay is on, a "Counties in view" panel gives the same keyboard path to each county: a focusable list whose rows open the county's popup and pan the map to it, since the county fill is drawn on the GPU canvas and is pointer-only. The panel keeps parity with whichever shading metric is active: your species and checklist counts and the county's eBird link, or, under the Completeness metric, that county's "X/Y · Z%" progress. When a completeness figure cannot be produced, the row says plainly why (not yet looked up, no API key, offline, or an eBird error) rather than showing a blank, so the keyboard route never hides a state the map is showing. These lists are scoped to the current map view and update as you pan or zoom (very dense views are capped, with a "zoom in to narrow the list" hint), so the keyboard path tracks what's on screen rather than listing every marker at once. The map controls (zoom, base-layer switcher, filters, fullscreen, the location button, and the share button) are keyboard-operable as well. In the Map Explorer's bottom-right corner they are a single row in DOM order, so tab order and reading order are the same: the share button, then the location button, then fullscreen, then Filters where it applies. No two of them ever carry the same accessible name, in any state. The share slot's occupant depends on the view. On My Sightings it is the drop button, whose "Drop a pin at the map center" becomes "Move the pin to the map center" once a pin exists, and which reports `aria-pressed` because the map is holding something. On Hotspots, Nearby Lifers, and Media Targets it is a button that opens the existing search center pin's copy popup: "Copy the search center location", becoming "Close the location popup" while the popup is open, and it reports `aria-expanded` rather than `aria-pressed` because it discloses a popup rather than holding a pin. Closing the popup returns focus to whichever control opened it, and pressing that button to close never moves focus off the button just pressed. Before a search center has been set there is nothing to copy: the button stays in place and stays focusable, marked with `aria-disabled` and named "Set a search center to copy its location", and it carries a dashed border so the state does not rest on color alone. The location button tells you what it is doing through its accessible name, which is "Center the map on my location" at rest and "Finding your location" while a request is in flight; the glyph changes shape at the same time, so the state does not depend on the spinner's motion and survives a reduced-motion setting. While it works, the button marks itself unavailable with `aria-disabled` and ignores further presses, rather than being switched off with the native `disabled` attribute. That distinction is deliberate: a natively disabled control drops out of the tab order and loses focus, which would strand a keyboard user on the page body at the exact moment the result arrives, so the button stays focused and focusable across the whole press-to-result cycle. When a location request fails, the reason and the fix are announced from a live region on the map surface. That region is the only thing that announces the failure, and it is present in the accessibility tree from first render rather than appearing along with its first message, so the announcement is not missed. On the Hotspots, Nearby Lifers, and Media Targets views the same sentence is also shown, silently, in the filters sidebar beside the sidebar's own location button; it is not a second announcement, so the failure is read once rather than twice.

---

## Screen Reader Support

SnowRaven uses semantic structure and ARIA attributes so assistive technology can describe the interface accurately. Tabs and their panels are linked with the correct tab/tabpanel roles and selected state. Filter pills announce whether they are pressed, toggles announce on/off as switches, and sortable table columns announce their sort direction. The species selector exposes its expanded state and current option. The in-view marker lists use real list semantics, and collapsed filter panels are made inert so their hidden controls never become stray tab stops. Information that is shown only with an icon or a color (breeding-code tiers, map recency dots) carries a hidden text label so it is never lost to a screen reader. Charts (life-list growth, checklists by month and weekday, temporal and media trends, sightings over time, and the like) expose a concise text summary via an image role, so their content isn't lost to a screen reader, and purely decorative chart flourishes are hidden from assistive tech. Regions that update on their own (the weather result, species and result counts, loading states, inline errors, and a keyboard tab move in the Tab Layout list) are announced as they change.

---

## A Visible Focus Indicator

Wherever keyboard focus lands, you can see it. Focused controls show a clear green outline (with a soft glow on buttons and tabs, and a border-hugging ring on inputs), so you always know where you are on the page. This includes bird-name links, and in-page "jump to" links move keyboard focus to the destination section rather than leaving it behind on the link.

---

## Color and Contrast

Color is never the only way information is conveyed. The current leader on a map, breeding-code evidence levels, and similar cues are always paired with text, a symbol, or a label in addition to color.

Three shaded surfaces also offer an explicit **Use Textures** switch, **off by default**, for reading a shade ramp without relying on hue at all: the map's breeding-atlas blocks, the map's county shading, and the Calendar's day grid. With it on, each tier is drawn as a hatch or crosshatch whose ink density rises with the tier (an open lattice at the low end through a tight crosshatch at the high end), so the levels stay distinguishable to a colorblind reader. The legend shows the same density steps as the surface itself, and the patterns follow the light and dark themes. The underlying figure is always available as text as well (in the popup on the map, and in the day popup on the Calendar), so the textures are an additional channel rather than the only alternative to color. Body text and the primary interface colors (text, buttons, links, map popups, map pins, milestone and rank markers, and form controls) are chosen to meet the WCAG 2.1 AA contrast standard (4.5:1 for text, 3:1 for non-text UI) in both the light and dark themes; the breeding-tier badges and pills and the map target chips use dedicated text colors that pass on their own fills and tints. Chart figures are read from a label beside the bar rather than printed inside it; in the one place a percentage does sit inside a bar (the complete-checklists meter), its text color is chosen to meet AA against that fill in both themes. A full dark theme is included and can follow your operating system's light/dark preference.

---

## Text Size and Zoom

SnowRaven's text is sized in relative units, so it **honors your browser's or operating system's default text size** automatically. On top of that, a built-in **Text Size** control (Settings → Appearance) scales all text from 100% up to **200%**, meeting WCAG 2.1 SC 1.4.4 (Resize Text), and especially useful in the desktop app. Statistics chart labels, the help layout, and map popup text all grow with this control rather than clipping. Your choice is remembered across sessions.

Browser/page zoom (Ctrl/Cmd +/−) works too, and the desktop app enables the same zoom hotkeys. The layout reflows for narrow windows and at large sizes (including collapsing the tab bar into a dropdown and the help into a single column) without clipping content. At the largest sizes, wide data tables and the maps may scroll horizontally; this is expected and permitted by WCAG 2.1 SC 1.4.10 (Reflow), which exempts tables and maps.

**The Breeding Codes matrix on a phone.** This is the app's widest table, and on a narrow screen its code columns tighten to the width of their dots so far more of them fit at once, with thin vertical rules separating the columns and the species-name column held fixed on the left as you scroll the codes sideways, so a row stays identifiable no matter how far across you are. Long filter meanings wrap inside their pills, and a long bird name can wrap above its eBird and Birds of the World links. Every label remains complete, both links remain available with their full touch targets, and nothing escapes the name column. To read the matrix more closely you use your device's ordinary **pinch-to-zoom**. That is deliberate: the app sets no `maximum-scale` viewport clamp and applies no CSS scaling of its own, so the browser's native zoom is never disabled (WCAG 2.1 SC 1.4.4). Each column's terse code keeps a fuller spoken name on its sort control, and every count badge carries its breeding category as hidden text, so the tier colour is not the only carrier. The matrix scrolls with the page rather than inside a fixed-height box, so page zoom and the Text Size control both keep working on it. The tier legend beneath it spells every code out in full as visible text, and in the normal view a meaning too long for the line wraps onto a second line at phone widths instead of running past the edge of the card, so raising the Text Size never costs you the wording.

---

## Reduced Motion

If your operating system is set to reduce motion, SnowRaven honors it: loading spinners, transitions, and animated scrolling are reduced to near-instant so the interface does not move or animate unnecessarily.

---

## Turning Off Embedded Media

Species Detail and Named Birds can embed your Macaulay Library photos, recordings, and video inline. Those players are third-party content, so how they behave (autoplay, focusable controls inside the frame, motion in a video) is not something SnowRaven can style or restrain from the outside.

A **Disable embedded media** switch in Settings (**off by default**) turns them all off. With it on, no player is constructed at all: each one is replaced by a short neutral note, "Embedded media is disabled in Settings.", announced through a status role rather than as an error, since it is a preference you chose and not something that went wrong. Nothing else is lost. The item's own information (its capture date, its eBird checklist link, and a direct link to the asset on the Macaulay Library) is drawn from your own export, sits outside the player, and stays exactly where it was, so every piece of media is still identifiable and still reachable in one click. The choice is remembered across sessions.

---

## Focus Management

Where focus matters, SnowRaven manages it deliberately. Opening the Map Explorer's filter panel on a small screen moves focus into the panel and keeps it there while open; closing it (with Escape, the Close button, or by tapping the backdrop) returns focus to the button that opened it. Escape also exits map fullscreen and returns focus to the fullscreen toggle, so a keyboard user is never dropped to the page body.

---

## Offline States

The offline-support features added in v0.5.45 follow the same WCAG 2.1 AA bar as the rest of the app, in both the light and dark themes.

Offline and error states are conveyed by an icon paired with text, never by color alone. The three offline messages (you're offline, no API key, and server error) and the "last loaded result" staleness cue announce themselves through an appropriate live role: a status role for informational states and an alert role for genuine errors. When you are offline, the Satellite, Topo, and Trails base-map controls are disabled with a visible text reason that is also exposed to assistive technology: the disabled control is removed from the tab order, and its reason is referenced from the control, so the unavailable state is not signalled by color alone.

These offline surfaces are responsive from roughly 320-pixel phones up to large desktops and hold at 200% text scale without leaking horizontal page-scroll.

The Statistics tab's exotic-status check reports itself the same way. Its status line is a live region with `role="status"` and `aria-live="polite"`, rendered from first paint and never hidden while idle, so a message is announced rather than arriving with the region itself. Each message is placed in a child element keyed to its own sequence number, so pressing "Check again" twice announces twice even when the resulting sentence is identical. Every state's meaning is in its sentence: the muted Species figure while the check runs, and the tinted status icon, are supporting cues only and every icon in that region is hidden from assistive technology. While a check is running, its progress is a `progressbar` with real `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` values, and the same figure is written out beside it as text.

---

## Known Exceptions

The cross-cutting items previously tracked here are now addressed: the "open checklist on eBird" links are unified under one shared component with a single consistent accessible name (v0.5.31–v0.5.32), every external link announces that it opens in a new tab (v0.5.32), and the weather block names the correct moon phase for Southern-Hemisphere checklists (shipped v0.5.28). The Map Explorer's drop-a-pin gesture for setting the search center is pointer-only (right-click or long-press), but the search center is fully settable by keyboard through the place-name search, "Use my location", and the coordinate inputs, so it is an enhancement, not the only path. The placed pin is a presentational marker that visually echoes the search center, whose value is shown in the labeled coordinate inputs. No cross-cutting accessibility exceptions are outstanding at this time.

---

## Feedback

If you run into an accessibility barrier in SnowRaven, please reach out at [developer@dtgibson.com](mailto:developer@dtgibson.com). Accessibility issues are treated as bugs and addressed as a priority.
