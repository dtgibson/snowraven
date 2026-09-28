# Targets tab: proposed published copy

Nothing in this file has been written to `PRIVACY_POLICY.md`, `website/` or `README.md`. Each item is a proposal for the user to read and approve before it lands (CLAUDE.md, user direction 2026-09-21; PRD FR-61). `docs/HELP.md` already carries its `## Targets` section in this change, as the brief directs.

No proposed sentence contains an em dash (U+2014).

---

## 1. PRIVACY_POLICY.md (FR-61): two sentences, both in the eBird bullet

The change touches one bullet: the **eBird** bullet under the third-party services list (currently line 31). Sentence 1 extends the bullet's list of what is asked of eBird. Sentence 2 is a new sub-bullet directly beneath it, in the same position as the existing Statistics sub-bullet.

### Before (line 31, unchanged text in full)

> - **eBird**: to look up checklist details, hotspots, recent nearby sightings (including, on iPhone and iPad, the same kind of nearby-sightings request made by a Nearby Lifers or Media Targets home-screen widget each time it refreshes, described under Your Location, and, when you turn on the map's Recent activity hotspot coloring, the recent community sightings at each public hotspot in your current search, one request per hotspot, bounded and cached on your device for six hours), region info (including the species list ever reported for a county region, used by the map's county Completeness shading), and species taxonomy. Uses your own eBird API key. See [eBird's terms](https://www.birds.cornell.edu/home/ebird-api-terms-of-use/).

### After

> - **eBird**: to look up checklist details, hotspots, recent nearby sightings (including, on iPhone and iPad, the same kind of nearby-sightings request made by a Nearby Lifers or Media Targets home-screen widget each time it refreshes, described under Your Location, and, when you turn on the map's Recent activity hotspot coloring, the recent community sightings at each public hotspot in your current search, one request per hotspot, bounded and cached on your device for six hours), region info (including the species list ever reported for a county region, used by the map's county Completeness shading and by the Targets tab), a per-day list of the species reported in a county over the last 30 days, when you open the Targets tab (the answers are kept on your device, so a return visit asks again only about days whose answer was not yet final: the current day, an earlier day that was still in progress when it was last asked, and any day with no answer kept on your device), and species taxonomy. Uses your own eBird API key. See [eBird's terms](https://www.birds.cornell.edu/home/ebird-api-terms-of-use/).
>   - An eBird bar-chart file you add on the Targets tab, which you download yourself from ebird.org, is stored only on your device, is read only to show eBird's frequencies for its county, and is not part of iCloud Sync.

What changed, word for word:

1. `used by the map's county Completeness shading)` becomes `used by the map's county Completeness shading and by the Targets tab)`. The Targets tab reads the same stored county species list; no new request kind.
2. Inserted before `and species taxonomy`: `a per-day list of the species reported in a county over the last 30 days, when you open the Targets tab (the answers are kept on your device, so a return visit asks again only about days whose answer was not yet final: the current day, an earlier day that was still in progress when it was last asked, and any day with no answer kept on your device),`
3. New sub-bullet (sentence 2, above).

Why each is true of the shipped code:

- The per-day query is `GET /map/county-day-obs` (desktop: straight to eBird's `data/obs/{region}/historic/{y}/{m}/{d}` with the user's key; web/Pi: the backend does the same). It runs only from `useCountyDaySweep`, which the Targets tab mounts, only with a key and a connection, and it goes through the same shared eBird gate as every map lookup.
- "a return visit asks again only about days whose answer was not yet final: the current day, an earlier day that was still in progress when it was last asked, and any day with no answer kept on your device": an answer is stored with `complete` decided at write time as "its day is before today" (`countyDayObsCache.ts`), so an answer fetched after its day ended is final and never re-asked; today is incomplete and re-asked at most once per session; a day answered while it was still today is stored incomplete and asked once more on the next visit, then stored final (`useCountyDaySweep.ts`); a failed day is never cached. Measured in `useCountyDaySweep.test.ts` (30 calls on a first visit, 1 on a same-day revisit, 2 the next day: the new day and the day before). Corrected before review from "only about the current day and any day with no answer kept on your device", which left out the day before (security review L3).
- Sentence 2: the file lives under `AppLocalData/data/barcharts/` (desktop) or the backend data directory (web/Pi); it is parsed on the device only to compute frequencies; `icloudPaths.parity.test.ts` asserts the iCloud slot set is exactly the two data files and that no iCloud source mentions bar charts.

### Optional third edit, for the user to decide (not required by FR-61)

Line 16 lists what clearing the eBird backup also removes. This change adds one more such store: the day-by-day county answers are keyed on counties from the backup and are registered with the same teardown (`clearDerived.ts`), so clearing the backup removes them too. The line does not say "only", so it is not false without the addition, but it is an enumeration and would be one item short. Proposed insertion, after `the county species lists behind the map's Completeness shading,`:

> the day-by-day eBird reports behind the Targets tab's live counts,

If declined, the line stays as it is.

---

## 2. website/index.html: one proposed sentence

Placement: a new feature row between **Calendar** (row 5) and **Multimedia** (row 6), which is where Targets sits in `DEFAULT_TAB_ORDER` and `TAB_LABELS`.

> **Targets**
>
> One county's target list over your own record: the lifers there, the species you have yet to photograph, record or film, and the ones you have never given a breeding code, with eBird's frequencies and recent reports beside each.

Decisions this placement carries, for the user (none are made here):

- A feature row on the site carries a screenshot slot (`data-shot`). No Targets screenshot exists yet; the row would need one captured from the demo dataset, or the row would ship without media.
- Inserting a row shifts the alternating `reverse` layout for every row after it (Multimedia onward), a markup change to those rows but not to their words.

## 3. README.md: one proposed sentence

Placement: a new `### Targets` section between `### Calendar` and `### Multimedia`, the same order as the tabs.

> ### Targets
>
> One county's target list over your own record: the lifers there, the species you have yet to photograph, record or film, and the ones you have never given a breeding code, with eBird's frequencies and recent reports beside each.

The same sentence on both surfaces, in the register of the neighboring sections: what the tab does and what a birder gets, no operating detail, no offline mention.
