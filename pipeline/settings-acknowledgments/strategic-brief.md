# Strategic Brief — Settings Acknowledgments

## What We're Building
A button in the Settings tab that shows the app's Acknowledgments section: a short, permanent thank-you naming The Cornell Lab of Ornithology and the Macaulay Library, and Deven Simonson.

## Why Now
This comes from the user's saved-idea inbox, not the roadmap's Up Next (which is Windows code signing) - a deliberate pick, and that's fine for a small self-contained feature. SnowRaven is now a shipped 1.0.x product on every platform including the App Store, and the founding brief already frames it as "a personal project shared as a free public good, with gratitude to the free services it builds on." A shipped product that owes its existence to a freely-given platform and to early access to its build tooling should say so, in the product itself.

## The User Problem
Honestly stated: this is not a user pain point. It is gratitude and credit-where-due - the hygiene of a shipped product acknowledging the people and institutions behind it. The Cornell Lab and the Macaulay Library created the platform whose data the entire app exists to explore, and made it freely available; Deven Simonson provided early access to Weft, which built the app. The value to the user of the product brief is indirect: an app that credits its foundations reads as the trustworthy, personal, alongside-eBird tool the founding brief promises.

## Success Criteria
- A user browsing Settings can find and press an Acknowledgments affordance on every platform (macOS, Windows, web/Pi, iOS) and see the acknowledgments content.
- The content includes exactly the two acknowledgments: (1) The Cornell Lab of Ornithology and the Macaulay Library, for creating a wonderful platform for tracking birding data and for making it freely available; (2) Deven Simonson, for providing early access to Weft to help build the SnowRaven app.
- The section renders correctly in both themes, at 320px width and 200% in-app text scale, and meets the app's WCAG 2.1 AA posture (dismissal/focus behavior included, if presented as an overlay).
- The content is fully offline - no network call, no API key, no new persisted state required to view it.
- Existing Settings sections and behavior are unchanged when the button is not pressed.
- docs/HELP.md, README.md, and website/ are updated in the same change; CHANGELOG.md carries the entry under a patch version bump.

## Scope
- One new entry point in the Settings tab (`frontend/src/components/Settings.tsx`), following the tab's established section vocabulary - a `SectionHeader` plus a single action row with a button is already precedented by "Help & Documentation" / "Open documentation."
- The Acknowledgments content itself: the two entries named above, written as user-facing copy (plain prose, no em dashes per the repo copy rule).
- How the content is presented when the button is pressed (inline disclosure vs. overlay like the Help docs) is The Designer's and The Planner's call; whichever form is chosen must satisfy the accessibility criteria above.
- If any entry links out (e.g. to the Cornell Lab or Macaulay Library sites), the link goes through the shared `OutboundLink` component per the app's external-link convention; links are optional, not required content.
- Same-change documentation updates: docs/HELP.md, README.md, website/, CHANGELOG.md, patch version bump. Ships to all platforms in the normal release rhythm.

## Out of Scope
- Third-party data/software credits (OpenWeather, NOAA, OpenStreetMap/Nominatim, MapLibre, tile hosts) - decided against here because the user's idea is a personal-gratitude section with exactly two named acknowledgees, and provider attribution already lives where it is owed (the map's attribution control and PRIVACY_POLICY.md's provider disclosure); a full credits/licenses inventory would be its own feature with its own accuracy obligations.
- An open-source license inventory or legal-notices screen.
- Any change to existing attribution surfaces (map attribution control, PRIVACY_POLICY.md, ACCESSIBILITY.md).
- Any new network call, API usage, or persisted setting.
- Platform-specific variants: the Settings surface is shared across desktop, web/Pi, and iOS, and this section is identical everywhere (no `isTauri` branch).

## Key Decisions
- The acknowledgments content is fixed by the user's idea: the Cornell Lab of Ornithology and the Macaulay Library entry, and the Deven Simonson entry, in that spirit and substance. Do not add acknowledgees.
- Third-party service credits are explicitly excluded (reason recorded in Out of Scope); if the user later wants them, that is a separate follow-on.
- One shared surface for all platforms - no platform branching, no network, no new persisted state.
- Presentation follows the Settings tab's existing section vocabulary (SectionHeader + action row precedent); the reveal mechanism is a design decision downstream, bounded by the AA / 320px / 200% criteria.
- User-facing copy obeys the repo copy rules: no em dashes (U+2014), external links via `OutboundLink`, and the docs trio (HELP.md, README.md, website/) updates in the same change.
- This is a patch-version feature under the repo's versioning rule, released to all platforms per the standing release rhythm.
