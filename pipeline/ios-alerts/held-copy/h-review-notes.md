# Held proposal (h): App Review notes, the background mode

NOT APPLIED. The schema planned to write this in-build, but the notes are pasted into App Store Connect's App Review Information field, which CLAUDE.md holds ("what is written into App Store Connect"), so it is prepared here instead. It explains the one new capability App Review may ask about: an app whose policy says it uses location only while in use now declares a background mode.

**Insert** in `appstore/REVIEW_NOTES.md` under "Notes for the reviewer", after the "ABOUT THE HOME-SCREEN WIDGETS" block:

> ABOUT ALERTS AND THE BACKGROUND MODE
>
> On iPhone and iPad, Settings has an Alerts section, off by default. When the user turns it on, SnowRaven checks about hourly or about daily for species the user has never recorded near a place they choose, and posts one local notification per check. The declared background mode is fetch (a BGAppRefreshTask), not location: a check measures from a fixed place, or under My location from the most recent position the app recorded while in use or a placed widget read from the device on its own refresh. The check itself never reads location in the background or asks for Always. Each check is the same eBird request the app's Nearby Lifers view makes, with the user's own key; notifications are local, with no push. With no key, as in review, the section says which key it needs and makes no request.

The pasted field is limited to 4,000 characters; the Deployer re-measures the pasted part with this block in before entering it.
