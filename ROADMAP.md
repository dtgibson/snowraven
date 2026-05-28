# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

36 versions shipped. Last shipped: **Windows desktop app (v0.4.0)** -- a native Windows build at full parity with the macOS and Pi/web clients, built by GitHub Actions and published to the same release with a multi-platform `latest.json`. Desktop clients now ship in parallel (Pi/web, macOS, Windows). Distributed unsigned for now; "Use my location" is deferred on Windows.

Previously: **Responsive tab navigation** -- the tab bar collapses into a dropdown when tabs would overflow; sets the navigation pattern the mobile app will inherit.

---

## Up Next

1. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen. Inherits the responsive navigation and the platform seams hardened during the Windows release.

2. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.

3. **Native Windows geolocation + Windows code signing** — Two deferred follow-ups from the Windows release: implement "Use my location" on Windows (currently shows a "coming later" note), and add Authenticode signing to remove the SmartScreen warning.
