# Held proposal (d): the listing's privacy answers and compliance record

NOT APPLIED. `appstore/LISTING.md` and the App Store Connect privacy questionnaire change only on the user's express yes.

## The App Privacy questionnaire: no change

Every answer stays **No** and the label stays **Data Not Collected**. The alert check is device-to-provider (the existing eBird nearby-sightings request, with the user's own key); the notifications are local notifications made on the device (no push, no `aps-environment` entitlement, no notification server); the alert settings, the last check and the inbox stay in the App Group container on the device, never synced and never sent anywhere. Nothing reaches the developer, so there is nothing to declare. Do not defensively declare Location: under My location a check measures from a position the app recorded on the device, which leaves the device only as the coordinates of the eBird request itself, exactly as with the widgets.

## The compliance record: one new bullet under "Privacy nutrition label"

**Insert after** the "Home-screen widgets (v1.0.36)" bullet:

> - **Alerts (v1.0.42):** an optional iPhone and iPad feature, off until the user turns it on in Settings, that checks about hourly or about daily (a `BGAppRefreshTask`, the `fetch` background mode, as iOS allows) and when the app is opened after the interval, for species the user has never recorded near a place they choose. Each check is the same eBird nearby-sightings request the app's Nearby Lifers view makes, with the user's own key, from a fixed place or, under My location, from the most recent position the app recorded while in use or a placed widget read from the device on its own refresh, within 24 hours (the check itself never reads location in the background and never asks for Always). The one summary notification per check is a local notification made on the device; there is no push and no `aps-environment` entitlement. The settings, the last check and the inbox stay in the App Group container on the device, never synced. Device-to-provider, and nothing reaches the developer, so "Data Not Collected" holds.

## Export compliance: no change

`ITSAppUsesNonExemptEncryption` stays `false` in both plists (the project regeneration's attempt to drop it was reverted in the build).
