# Held copy: taxonomy-2026-readiness

`CHANGELOG.md` entries are written at the release commit (the last six release commits each add their version's section there and nothing earlier does), so the proposed entry waits here for the release that carries Leg 1. It is not published copy, but it feeds the F-Droid changelogs and the App Store "What's New", which wait for the user's yes.

## Proposed CHANGELOG.md entry

### Fixed
- **A self-hosted SnowRaven keeps up with eBird's taxonomy.** On the web and Raspberry Pi version, the server's saved copy of eBird's taxonomy is now refreshed whenever eBird changes it, a server left running fetches it again once a week, as the apps do, and an offline start no longer prefers an old saved copy to the newer one built into the release. The Mac, Windows, iPhone, iPad, and Android apps are unchanged.

### Internal
- Two new checks fail the tests if a Frivolous Lists name or a species code in the bundled eBird taxonomy stops fitting what the app expects, the taxonomy generator refuses a code outside that shape before writing anything, and `scripts/taxonomy-history-input/README.md` holds the annual taxonomy refresh as one ordered runbook.
