# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

40 versions shipped. Last shipped: **Map Explorer heatmap improvement (v0.5.1)** -- the My Sightings heatmap now spreads into a readable density gradient with a Heatmap Intensity slider that scales coverage, saturation, and per-point weight so even sparse areas stand out.

Previously: **Map Explorer — California atlas blocks + nearest unvisited hotspots (v0.5.0)** -- a toggle overlays official California Breeding Bird Atlas block boundaries (generated at runtime from a compact bundled gazetteer), and the Hotspots panel auto-lists the ten closest unvisited hotspots as eBird links.

---

## Up Next

1. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen. Inherits the responsive navigation and the platform seams hardened during the Windows release.

2. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.

3. **Windows code signing** — Add Authenticode signing to the Windows build to remove the first-launch SmartScreen "unknown publisher" warning. (Native Windows geolocation, the other half of this item, shipped in v0.4.1.)
