# Accessibility — SnowRaven

SnowRaven is built to be usable by everyone. It runs in the browser and as a desktop app, and it follows standard web accessibility practices so it works with keyboards and screen readers. This describes what is in place today. Accessibility is treated as ongoing work, not a finished checkbox.

---

## Keyboard Navigation

Nearly all of SnowRaven is reachable and operable with the keyboard alone.

Every button, link, tab, filter pill, toggle, sortable column header, and the species selector is in the tab order and can be activated with Enter or Space. The main tab bar follows the standard pattern for tabbed interfaces: Left and Right arrow keys move between tabs, and Tab moves you into the page content. The species selector behaves like a proper combobox — type to filter, ArrowUp and ArrowDown move through the matches (the highlighted one scrolls into view), Enter selects it, and Escape closes the list. On a narrow screen, when the tab bar collapses into a dropdown, that menu is fully keyboard-operable too.

**Known gap:** the clickable markers *on* the maps (sighting pins, hotspot teardrops) are currently operated by pointer — they are not yet individually in the keyboard tab order. The map controls around them (zoom, base-layer switcher, filters, fullscreen) are keyboard-operable, and much of the underlying data is also reachable through the keyboard-accessible lists, filters, and other tabs. Direct keyboard access to individual map markers is on the roadmap.

---

## Screen Reader Support

SnowRaven uses semantic structure and ARIA attributes so assistive technology can describe the interface accurately. Tabs and their panels are linked with the correct tab/tabpanel roles and selected state. Filter pills announce whether they are pressed, toggles announce on/off as switches, and sortable table columns announce their sort direction. The species selector exposes its expanded state and current option. Information that is shown only with an icon or a color — breeding-code tiers, map recency dots — carries a hidden text label so it is never lost to a screen reader. Regions that update on their own, like the weather result and species counts, are announced politely as they change.

---

## A Visible Focus Indicator

Wherever keyboard focus lands, you can see it. Focused controls show a clear green outline (with a soft glow on buttons and tabs, and a border-hugging ring on inputs), so you always know where you are on the page.

---

## Color and Contrast

Color is never the only way information is conveyed. The current leader on a map, breeding-code evidence levels, and similar cues are always paired with text, a symbol, or a label in addition to color. Body text and the primary interface colors — text, buttons, links, map popups, and form controls — are chosen to meet the WCAG 2.1 AA contrast standard (4.5:1) in both the light and dark themes; for example, the top breeding-code badge uses dark text on its light tier color. A full dark theme is included and can follow your operating system's light/dark preference. One known exception: a few dense data-visualization labels (percentage figures printed inside saturated chart bars) do not yet meet AA in every case, and are being tuned.

---

## Resizing and Zoom

SnowRaven is a responsive web app. It reflows for narrow windows and mobile browsers — including collapsing the tab bar into a dropdown — and it works with browser/page zoom (Ctrl/Cmd +/−) without clipping content or breaking the layout. Note that the interface is currently sized in fixed pixels, so a browser's *minimum font size* or operating-system *text-size* preference does not enlarge it on its own — use page zoom to scale the whole interface. A dedicated in-app text-size control is on the roadmap.

---

## Reduced Motion

If your operating system is set to reduce motion, SnowRaven honors it: loading spinners, transitions, and animated transitions are reduced to near-instant so the interface does not move or animate unnecessarily.

---

## Focus Management

Where focus matters, SnowRaven manages it deliberately. Opening the Map Explorer's filter panel on a small screen moves focus into the panel and keeps it there while open; Escape closes it and returns focus to the button that opened it.

---

## Feedback

If you run into an accessibility barrier in SnowRaven, please reach out at [developer@dtgibson.com](mailto:developer@dtgibson.com). Accessibility issues are treated as bugs and addressed as a priority.
