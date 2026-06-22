# Accessibility — SnowRaven

SnowRaven is built to be usable by everyone. It runs in the browser and as a desktop app, and it follows standard web accessibility practices so it works with keyboards and screen readers. This describes what is in place today. Accessibility is treated as ongoing work, not a finished checkbox, and the few known gaps are listed honestly at the end.

---

## Keyboard Navigation

Nearly all of SnowRaven is reachable and operable with the keyboard alone.

Every button, link, tab, filter pill, toggle, sortable column header, and the species selector is in the tab order and can be activated with Enter or Space. A "Skip to main content" link is the first thing in the tab order, so keyboard users can jump straight past the header. The main tab bar follows the standard pattern for tabbed interfaces: Left and Right arrow keys move between tabs, and Tab moves you into the page content. The species selector behaves like a proper combobox — type to filter, ArrowUp and ArrowDown move through the matches (the highlighted one scrolls into view), Enter selects it, and Escape closes the list. On a narrow screen, when the tab bar collapses into a dropdown, that menu is fully keyboard-operable too.

Settings groups that use a row of choices — color theme, text size, and date format — are arrow-key radio groups, so you Tab to the group and use the arrow keys to change the selection. The **Tab Layout** list, which lets you reorder your tabs, offers **Move up** and **Move down** buttons on every row as a full keyboard alternative to dragging.

**Map markers (Map Explorer):** the markers drawn *on* the map — sighting pins, hotspot teardrops, and media-target chips — are rendered on the GPU canvas or as pointer-only chips, so they cannot themselves be tab stops. Instead, the Map Explorer sidebar provides a focusable, screen-reader-labelled list of the markers in the current map view: a "Sightings in view" list in My Sightings mode, a "Hotspots in view" list in Hotspots mode, a "Targets in view" list in Media Targets mode, and a "Nearby lifers in view" list in Nearby Lifers mode. Every item is a real button in the tab order; activating one with Enter or Space opens the same details popup a mouse click on the marker would open and pans the map to it, and activating it again closes the popup — so the marker's information is reachable, operable, and dismissable without a pointer. When the breeding-atlas overlay is on, an "Atlas blocks in view" panel on the map gives the same keyboard path to each block: a focusable list whose rows open the block's breeding summary and eBird atlas link and pan the map to it. These lists are scoped to the current map view and update as you pan or zoom (very dense views are capped, with a "zoom in to narrow the list" hint), so the keyboard path tracks what's on screen rather than listing every marker at once. The map controls (zoom, base-layer switcher, filters, fullscreen) are keyboard-operable as well.

---

## Screen Reader Support

SnowRaven uses semantic structure and ARIA attributes so assistive technology can describe the interface accurately. Tabs and their panels are linked with the correct tab/tabpanel roles and selected state. Filter pills announce whether they are pressed, toggles announce on/off as switches, and sortable table columns announce their sort direction. The species selector exposes its expanded state and current option. The in-view marker lists use real list semantics, and collapsed filter panels are made inert so their hidden controls never become stray tab stops. Information that is shown only with an icon or a color — breeding-code tiers, map recency dots — carries a hidden text label so it is never lost to a screen reader. Charts (life-list growth, checklists by month and weekday, temporal and media trends, sightings over time, and the like) expose a concise text summary via an image role, so their content isn't lost to a screen reader, and purely decorative chart flourishes are hidden from assistive tech. Regions that update on their own — the weather result, species and result counts, loading states, inline errors, and a keyboard tab move in the Tab Layout list — are announced as they change.

---

## A Visible Focus Indicator

Wherever keyboard focus lands, you can see it. Focused controls show a clear green outline (with a soft glow on buttons and tabs, and a border-hugging ring on inputs), so you always know where you are on the page. This includes bird-name links, and in-page "jump to" links move keyboard focus to the destination section rather than leaving it behind on the link.

---

## Color and Contrast

Color is never the only way information is conveyed. The current leader on a map, breeding-code evidence levels, and similar cues are always paired with text, a symbol, or a label in addition to color. Body text and the primary interface colors — text, buttons, links, map popups, map pins, milestone and rank markers, and form controls — are chosen to meet the WCAG 2.1 AA contrast standard (4.5:1 for text, 3:1 for non-text UI) in both the light and dark themes; the breeding-tier badges and pills and the map target chips use dedicated text colors that pass on their own fills and tints. Chart figures are read from a label beside the bar rather than printed inside it; in the one place a percentage does sit inside a bar (the complete-checklists meter), its text color is chosen to meet AA against that fill in both themes. A full dark theme is included and can follow your operating system's light/dark preference.

---

## Text Size and Zoom

SnowRaven's text is sized in relative units, so it **honors your browser's or operating system's default text size** automatically. On top of that, a built-in **Text Size** control (Settings → Appearance) scales all text from 100% up to **200%** — meeting WCAG 2.1 SC 1.4.4 (Resize Text), and especially useful in the desktop app. Statistics chart labels, the help layout, and map popup text all grow with this control rather than clipping. Your choice is remembered across sessions.

Browser/page zoom (Ctrl/Cmd +/−) works too, and the desktop app enables the same zoom hotkeys. The layout reflows for narrow windows and at large sizes — including collapsing the tab bar into a dropdown and the help into a single column — without clipping content. At the largest sizes, wide data tables and the maps may scroll horizontally; this is expected and permitted by WCAG 2.1 SC 1.4.10 (Reflow), which exempts tables and maps.

---

## Reduced Motion

If your operating system is set to reduce motion, SnowRaven honors it: loading spinners, transitions, and animated scrolling are reduced to near-instant so the interface does not move or animate unnecessarily.

---

## Focus Management

Where focus matters, SnowRaven manages it deliberately. Opening the Map Explorer's filter panel on a small screen moves focus into the panel and keeps it there while open; closing it — with Escape, the Close button, or by tapping the backdrop — returns focus to the button that opened it. Escape also exits map fullscreen and returns focus to the fullscreen toggle, so a keyboard user is never dropped to the page body.

---

## Offline Maps and Offline States

The offline-support features added in v0.5.45 follow the same WCAG 2.1 AA bar as the rest of the app, in both the light and dark themes.

The Settings **Offline maps** section is turned on or off with an **Enable offline maps** switch that announces as a switch with its current on/off state to assistive technology. The region manager below it gives each region row an accessible name; while a region downloads, its progress bar carries the progressbar role with the matching ARIA value attributes and an announced "X MB of Y MB" status, alongside a visible percentage — progress is never conveyed by color or animation alone — and the **Download**, **Cancel**, **Remove**, and **Update** controls each have an explicit accessible name.

Offline and error states are conveyed by an icon paired with text, never by color alone. The three offline messages — you're offline, no API key, and server error — and the "last loaded result" staleness cue announce themselves through an appropriate live role: a status role for informational states and an alert role for genuine errors. When you are offline, the Satellite, Topo, and Trails base-map controls are disabled with a visible text reason that is also exposed to assistive technology — the disabled control is removed from the tab order, and its reason is referenced from the control, so the unavailable state is not signalled by color alone.

This new interface is responsive from roughly 320-pixel phones up to large desktops and holds at 200% text scale without leaking horizontal page-scroll.

---

## Known Exceptions

The cross-cutting items previously tracked here are now addressed: the "open checklist on eBird" links are unified under one shared component with a single consistent accessible name (v0.5.31–v0.5.32), every external link announces that it opens in a new tab (v0.5.32), and the weather block names the correct moon phase for Southern-Hemisphere checklists (shipped v0.5.28). The Map Explorer's drop-a-pin gesture for setting the search center is pointer-only (right-click or long-press), but the search center is fully settable by keyboard through the place-name search, "Use my location", and the coordinate inputs — so it is an enhancement, not the only path. The placed pin is a presentational marker that visually echoes the search center, whose value is shown in the labeled coordinate inputs. No cross-cutting accessibility exceptions are outstanding at this time.

---

## Feedback

If you run into an accessibility barrier in SnowRaven, please reach out at [developer@dtgibson.com](mailto:developer@dtgibson.com). Accessibility issues are treated as bugs and addressed as a priority.
