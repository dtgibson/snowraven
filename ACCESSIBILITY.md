# Accessibility — SnowRaven

SnowRaven is built to be usable by everyone. It runs in the browser and as a desktop app, and it follows standard web accessibility practices so it works with keyboards and screen readers. This describes what is in place today. Accessibility is treated as ongoing work, not a finished checkbox.

---

## Keyboard Navigation

Every part of SnowRaven is reachable and operable with the keyboard alone — no mouse required.

Every interactive control is in the tab order and can be activated with Enter or Space. The main tab bar follows the standard pattern for tabbed interfaces: Left and Right arrow keys move between tabs, and Tab moves you into the page content. The species selector behaves like a proper combobox — type to filter, ArrowUp and ArrowDown move through the matches (the highlighted one scrolls into view), Enter selects it, and Escape closes the list. On a narrow screen, when the tab bar collapses into a dropdown, that menu is fully keyboard-operable too.

---

## Screen Reader Support

SnowRaven uses semantic structure and ARIA attributes so assistive technology can describe the interface accurately. Tabs and their panels are linked with the correct tab/tabpanel roles and selected state. Filter pills announce whether they are pressed, toggles announce on/off as switches, and sortable table columns announce their sort direction. The species selector exposes its expanded state and current option. Information that is shown only with an icon or a color — breeding-code tiers, map recency dots — carries a hidden text label so it is never lost to a screen reader. Regions that update on their own, like the weather result and species counts, are announced politely as they change.

---

## A Visible Focus Indicator

Wherever keyboard focus lands, you can see it. Focused controls show a clear green outline (with a soft glow on buttons and tabs, and a border-hugging ring on inputs), so you always know where you are on the page.

---

## Color and Contrast

Color is never the only way information is conveyed. The current leader on a map, breeding-code evidence levels, and similar cues are always paired with text, a symbol, or a label in addition to color. Text and key UI colors are chosen to meet the WCAG 2.1 AA contrast standard (4.5:1) — for example, the highest breeding-code badge uses dark text for a 6.8:1 ratio. A full dark theme is included and can follow your operating system's light/dark preference.

---

## Resizing and Zoom

SnowRaven is a responsive web app. It reflows for narrow windows and mobile browsers — including collapsing the tab bar into a dropdown — and it works with browser zoom and larger text settings without clipping content or breaking the layout.

---

## Focus Management

Where focus matters, SnowRaven manages it deliberately. Opening the Map Explorer's filter panel on a small screen moves focus into the panel and keeps it there while open; Escape closes it and returns focus to the button that opened it.

---

## Feedback

If you run into an accessibility barrier in SnowRaven, please reach out at [developer@dtgibson.com](mailto:developer@dtgibson.com). Accessibility issues are treated as bugs and addressed as a priority.
