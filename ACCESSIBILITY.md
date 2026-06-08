# Accessibility — SnowRaven

SnowRaven is built to be usable by everyone. It runs in the browser and as a desktop app, and it follows standard web accessibility practices so it works with keyboards and screen readers. This describes what is in place today. Accessibility is treated as ongoing work, not a finished checkbox.

---

## Keyboard Navigation

Nearly all of SnowRaven is reachable and operable with the keyboard alone.

Every button, link, tab, filter pill, toggle, sortable column header, and the species selector is in the tab order and can be activated with Enter or Space. The main tab bar follows the standard pattern for tabbed interfaces: Left and Right arrow keys move between tabs, and Tab moves you into the page content. The species selector behaves like a proper combobox — type to filter, ArrowUp and ArrowDown move through the matches (the highlighted one scrolls into view), Enter selects it, and Escape closes the list. On a narrow screen, when the tab bar collapses into a dropdown, that menu is fully keyboard-operable too.

**Map markers (Map Explorer):** the markers drawn *on* the map — sighting pins and hotspot teardrops — are rendered on the GPU canvas, so they cannot themselves be tab stops. Instead, the Map Explorer sidebar provides a focusable, screen-reader-labelled list of the markers in the current map view: a "Sightings in view" list in My Sightings mode and a "Hotspots in view" list in Hotspots mode. Every item is a real button in the tab order; activating one with Enter or Space opens the same details popup a mouse click on the marker would open and pans the map to it, so the marker's information is reachable and operable without a pointer. The Media Targets mode's "Nearest Targets" list works the same way. These lists are scoped to the current map view and update as you pan or zoom (very dense views are capped, with a "zoom in to narrow the list" hint), so the keyboard path tracks what's on screen rather than listing every marker at once. The map controls (zoom, base-layer switcher, filters, fullscreen) are keyboard-operable as well.

---

## Screen Reader Support

SnowRaven uses semantic structure and ARIA attributes so assistive technology can describe the interface accurately. Tabs and their panels are linked with the correct tab/tabpanel roles and selected state. Filter pills announce whether they are pressed, toggles announce on/off as switches, and sortable table columns announce their sort direction. The species selector exposes its expanded state and current option. Information that is shown only with an icon or a color — breeding-code tiers, map recency dots — carries a hidden text label so it is never lost to a screen reader. Charts (life-list growth, temporal and media trends, sightings over time, and the like) expose a concise text summary via an image role, so their content isn't lost to a screen reader, and purely decorative chart flourishes are hidden from assistive tech. Regions that update on their own, like the weather result and species counts, are announced politely as they change.

---

## A Visible Focus Indicator

Wherever keyboard focus lands, you can see it. Focused controls show a clear green outline (with a soft glow on buttons and tabs, and a border-hugging ring on inputs), so you always know where you are on the page.

---

## Color and Contrast

Color is never the only way information is conveyed. The current leader on a map, breeding-code evidence levels, and similar cues are always paired with text, a symbol, or a label in addition to color. Body text and the primary interface colors — text, buttons, links, map popups, and form controls — are chosen to meet the WCAG 2.1 AA contrast standard (4.5:1) in both the light and dark themes; for example, the top breeding-code badge uses dark text on its light tier color. A full dark theme is included and can follow your operating system's light/dark preference. One known exception: a few dense data-visualization labels (percentage figures printed inside saturated chart bars) do not yet meet AA in every case, and are being tuned.

---

## Text Size and Zoom

SnowRaven's text is sized in relative units, so it **honors your browser's or operating system's default text size** automatically. On top of that, a built-in **Text Size** control (Settings → Appearance) scales all text from 100% up to **200%** — meeting WCAG 2.1 SC 1.4.4 (Resize Text), and especially useful in the desktop app, which has no browser zoom of its own. Your choice is remembered across sessions.

Browser/page zoom (Ctrl/Cmd +/−) works too. The layout reflows for narrow windows and at large sizes — including collapsing the tab bar into a dropdown — without clipping content. At the largest sizes, wide data tables and the maps may scroll horizontally; this is expected and permitted by WCAG 2.1 SC 1.4.10 (Reflow), which exempts tables and maps.

---

## Reduced Motion

If your operating system is set to reduce motion, SnowRaven honors it: loading spinners, transitions, and animated transitions are reduced to near-instant so the interface does not move or animate unnecessarily.

---

## Focus Management

Where focus matters, SnowRaven manages it deliberately. Opening the Map Explorer's filter panel on a small screen moves focus into the panel and keeps it there while open; Escape closes it and returns focus to the button that opened it.

---

## Feedback

If you run into an accessibility barrier in SnowRaven, please reach out at [developer@dtgibson.com](mailto:developer@dtgibson.com). Accessibility issues are treated as bugs and addressed as a priority.
