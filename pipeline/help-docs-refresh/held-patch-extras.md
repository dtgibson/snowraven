# Held patch, part 2: the optional extras you chose

Extras 1, 2, 3, 4, 5 and 8 from `held-patch.md`, written out in full. **None of them has been
written yet.** They are applied only if you say yes.

- Every privacy policy change is made word for word on `website/privacy.html` too.
- The effective date stays October 2, 2026, which is today.
- Each sentence was checked against the app's code, and each gets a test that fails if the
  sentence is broken or the two pages drift apart.
- The ready-to-apply version is `held-patch-extras.diff` in this folder (`git apply` it from the
  repo root). It was built and tested in a separate copy; the files in this folder's repo are
  unchanged.

Extras 1 and 4 change the same point, so they are shown together.

## Extras 1 and 4. Deleting files, with and without sync

**Extra 4:** the point said nothing about what a delete does with iCloud Sync on. The new sentence says it also removes the file from iCloud, and that your other devices remove their copy only if they have sync on. It covers the eBird backup, the Macaulay Library export and, with Sync API keys on, a key as well as a bar-chart file, because saying it of bar-chart files alone would suggest the others stay in iCloud. **Extra 1:** the list of what clearing the backup removes now includes the position Alerts read, which the iOS App section of the same policy already says is removed.

**Now:**

> - You can delete your stored files and keys at any time from the Settings tab (a single county's bar-chart file, also from the Targets tab), or by removing the app's data directory. Clearing your eBird backup also removes what was worked out from it and saved on your device: the escapee and Projects answers for your checklists, the county species lists behind the map's Completeness shading, the day-by-day eBird reports behind the Targets tab's live counts (and, with iCloud Sync on, every device's copy of them in iCloud), the saved weather and tide readings for your checklists, and, on iPhone and iPad, the list of your species that the home-screen widgets compare against, and the Alerts inbox together with any alert waiting for the end of your quiet hours. Replacing a file with a newer export keeps those saved answers, which is what lets a newer export ask only about the checklists that have not been answered yet.

**Proposed:**

> - You can delete your stored files and keys at any time from the Settings tab (a single county's bar-chart file, also from the Targets tab), or by removing the app's data directory. With iCloud Sync on, clearing a data file or removing a bar-chart file also removes it from iCloud, and with Sync API keys on, clearing a key does the same; each of your other devices then removes its copy at its next check if it has the same switch on, and a device with it off keeps its own. Clearing your eBird backup also removes what was worked out from it and saved on your device: the escapee and Projects answers for your checklists, the county species lists behind the map's Completeness shading, the day-by-day eBird reports behind the Targets tab's live counts (and, with iCloud Sync on, every device's copy of them in iCloud), the saved weather and tide readings for your checklists, and, on iPhone and iPad, the list of your species that the home-screen widgets compare against, and the Alerts inbox together with any alert waiting for the end of your quiet hours and the position the app read for Alerts. Replacing a file with a newer export keeps those saved answers, which is what lets a newer export ask only about the checklists that have not been answered yet.

## Extra 3. When the Targets tab asks for the last 30 days

The eBird point said the 30-day check runs "when you open the Targets tab". It also runs when you choose another county, and again when your connection or key comes back or you press Retry. Each of those asks only about days not yet answered. Only the top of this point changes; its two sub-points stay as they are, apart from extra 5 below.

**Now:**

> - **eBird**: to look up checklist details, hotspots, recent nearby sightings (including, on iPhone and iPad, the same kind of nearby-sightings request made by a Nearby Lifers or Media Targets home-screen widget each time it refreshes, and by an alert check if you turn on Alerts, both described under Your Location, and, when you turn on the map's Recent activity hotspot coloring, the recent community sightings at each public hotspot in your current search, one request per hotspot, bounded and cached on your device for six hours), region info (including the species list ever reported for a county region, used by the map's county Completeness shading and by the Targets tab), a per-day list of the species reported in a county over the last 30 days, when you open the Targets tab (the answers are kept on your device, so a return visit asks again only about days whose answer was not yet final: the current day, an earlier day that was still in progress when it was last asked, and any day with no answer kept on your device), and species taxonomy. Uses your own eBird API key. See [eBird's terms](https://www.birds.cornell.edu/home/ebird-api-terms-of-use/).

**Proposed:**

> - **eBird**: to look up checklist details, hotspots, recent nearby sightings (including, on iPhone and iPad, the same kind of nearby-sightings request made by a Nearby Lifers or Media Targets home-screen widget each time it refreshes, and by an alert check if you turn on Alerts, both described under Your Location, and, when you turn on the map's Recent activity hotspot coloring, the recent community sightings at each public hotspot in your current search, one request per hotspot, bounded and cached on your device for six hours), region info (including the species list ever reported for a county region, used by the map's county Completeness shading and by the Targets tab), a per-day list of the species reported in a county over the last 30 days, when you open the Targets tab and whenever you choose another county there, and again when your connection or key comes back or you press Retry (the answers are kept on your device, so each of these asks again only about days whose answer was not yet final: the current day, an earlier day that was still in progress when it was last asked, and any day with no answer kept on your device), and species taxonomy. Uses your own eBird API key. See [eBird's terms](https://www.birds.cornell.edu/home/ebird-api-terms-of-use/).

## Extra 5. A number in the escapee sentence

"73 on a 21,000-observation export" is a count that will go stale. It becomes the property: a set of checklists that between them carry every species you have recorded. (The app builds that set itself, a good small set rather than a guaranteed smallest one, so the sentence does not say "smallest".)

**Now:**

>   - The Statistics tab also asks eBird about a set of your own checklists, in order to find out which of your birds eBird tags as exotic escapees. It sends only your own checklist IDs, and only a small covering subset of them (73 on a 21,000-observation export, worked out on your device before anything is sent), not your whole history. The answer is stored on your device for 30 days, so returning to the tab does not repeat the requests. If you have no eBird key or no connection, nothing is sent and the tab says so. What is new here is that a figure summarizing your own history now depends on a lookup: the Statistics tab's displayed numbers were previously worked out on your device. The tab itself has always made requests, which is a different thing, and worth stating plainly on this page: it matches your species names against the bird taxonomy, and it asks eBird which locations in the regions you have birded are public hotspots. The name matching happens against a copy of the taxonomy the app already holds, so your species list is not sent to eBird. Other parts of the app already show numbers that come from eBird, such as a county's completeness percentage on the map and a hotspot's species count. The Statistics tab's Projects section makes one further request per checklist, to find out which eBird projects your checklists were submitted to. It sends only your own checklist IDs, and only after you press one of that section's own controls: it is never started automatically, on tab open, or on relaunch. The answers are stored on your device, so stopping, quitting, or loading a newer export asks only about checklists that have not been answered yet, and an answer already given is not re-checked for a year unless you press Check again, which re-asks about all of them. With no eBird key or no connection, nothing is sent and the section says so.

**Proposed:**

>   - The Statistics tab also asks eBird about a set of your own checklists, in order to find out which of your birds eBird tags as exotic escapees. It sends only your own checklist IDs, and only a small covering subset of them (a set of checklists that between them carry every species you have recorded, worked out on your device before anything is sent), not your whole history. The answer is stored on your device for 30 days, so returning to the tab does not repeat the requests. If you have no eBird key or no connection, nothing is sent and the tab says so. What is new here is that a figure summarizing your own history now depends on a lookup: the Statistics tab's displayed numbers were previously worked out on your device. The tab itself has always made requests, which is a different thing, and worth stating plainly on this page: it matches your species names against the bird taxonomy, and it asks eBird which locations in the regions you have birded are public hotspots. The name matching happens against a copy of the taxonomy the app already holds, so your species list is not sent to eBird. Other parts of the app already show numbers that come from eBird, such as a county's completeness percentage on the map and a hotspot's species count. The Statistics tab's Projects section makes one further request per checklist, to find out which eBird projects your checklists were submitted to. It sends only your own checklist IDs, and only after you press one of that section's own controls: it is never started automatically, on tab open, or on relaunch. The answers are stored on your device, so stopping, quitting, or loading a newer export asks only about checklists that have not been answered yet, and an answer already given is not re-checked for a year unless you press Check again, which re-asks about all of them. With no eBird key or no connection, nothing is sent and the section says so.

## Extra 2. OpenWeather and the Planner

The OpenWeather point did not cover the Weather tab's Planner, which asks OpenWeather for the forecast across the days ahead. The NOAA point already covers the tide side in the same words.

**Now:**

> - **OpenWeather**: to fetch weather, either the historical weather for a checklist, or the current and forecast weather for a location and time you choose. Uses your own OpenWeather API key. See [OpenWeather's privacy policy](https://openweather.co.uk/privacy-policy).

**Proposed:**

> - **OpenWeather**: to fetch weather: the historical weather for a checklist, the current or forecast weather for a location and time you choose, or the forecast across the days ahead for a place you choose. Uses your own OpenWeather API key. See [OpenWeather's privacy policy](https://openweather.co.uk/privacy-policy).

## Extra 8. The summary band at the top of the privacy page

The band above the policy said "On your device only", which leaves out a self-hosted server and the optional iCloud copy. The new words fit the band: measured in Chrome's and Safari's engines at 320, 390, 768, 1024 and 1280 pixels wide, the band stays exactly as tall as it is now, and the tile never wraps onto more lines than its neighbors. "Your device or server, plus iCloud if you sync" took a third line on most widths and made the band taller, so the shorter form is proposed.

**Now:**

> Keys & data stay local: On your device only

**Proposed:**

> Keys & data stay local: Device or server, plus iCloud if you sync

## The tests that come with it

`frontend/src/lib/statementsPublishedClaims.test.ts` gains a row for each extra. Each row checks
the sentence on both pages, and checks it against the code: the iCloud clears and the
devices that apply them, the Alerts purge clearing the saved position, what makes the Targets
check run again, the covering set the escapee check builds, the Planner's one OpenWeather request,
and the band's exact words. Breaking each sentence (seven ways, on one page or the other) made
the tests fail every time.
