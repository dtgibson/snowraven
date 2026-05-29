# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

37 versions shipped. Last shipped: **Windows geolocation (v0.4.1)** -- native "Use my location" on Windows via the Windows Geolocation API, completing Windows parity with the macOS and Pi/web clients.

Previously: **Windows desktop app (v0.4.0)** -- a native Windows build built by GitHub Actions and published to the same release with a multi-platform `latest.json`; desktop clients now ship in parallel (Pi/web, macOS, Windows).

---

## Up Next

1. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen. Inherits the responsive navigation and the platform seams hardened during the Windows release.

2. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.

3. **Windows code signing** — Add Authenticode signing to the Windows build to remove the first-launch SmartScreen "unknown publisher" warning. (Native Windows geolocation, the other half of this item, shipped in v0.4.1.)
