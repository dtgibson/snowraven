# SnowRaven Documentation

SnowRaven is a toolkit for birders who use eBird. It runs as a standalone desktop app on Mac or Windows, or as a self-hosted server on a Raspberry Pi or any computer on your local network. It gives you weather lookups, life list analytics, media coverage tracking, breeding code history, and more.

This documentation covers every tab, how to obtain the API keys the app requires, and how to download and upload the data files that unlock most features.

## Getting Started

When you first open SnowRaven, go to the Settings tab. That is where you enter your API keys and upload your data files. Once your keys and files are in place, every other tab works automatically on each visit. There is nothing to re-upload between sessions.

The recommended setup sequence is:

1. Enter your eBird API key in Settings. This is required for the Weather tab and the Map Explorer (including its Nearby Lifers section).
2. Enter your OpenWeather API key in Settings. This is required for the Weather tab.
3. Upload your eBird backup file (`MyEBirdData.csv`) in Settings. This powers the Species Detail, Statistics, Calendar, Map Explorer, Breeding Codes, Multimedia, Named Birds, Checklists, and List Comparer tabs.
4. Upload your ML export from Macaulay Library in Settings. This is optional but unlocks media-specific features in Multimedia, Species Detail, and Statistics.

---

## API Keys

An API key is a private code that identifies your account when the app contacts an external data service. Think of it like a password the app uses on your behalf. Both keys required by SnowRaven are free.

### eBird API key

The eBird API key lets SnowRaven fetch checklist metadata for weather lookups and retrieve recent bird sightings near your location for the Map Explorer's Nearby Lifers feature. The key is free and is tied to your standard eBird account.

To get your key:

1. Sign in to your eBird account at [ebird.org](https://ebird.org).
2. Go to [ebird.org/api/keygen](https://ebird.org/api/keygen).
3. Your key is displayed on that page. Copy it.
4. Open SnowRaven, go to Settings, and paste it into the eBird API Key field.

Keep your API key private. It is tied to your eBird account and should not be shared or published.

### OpenWeather API key

The OpenWeather API key lets SnowRaven retrieve historical weather for any eBird checklist you look up. The service is free for the first 1,000 requests per day, well above what a typical user needs.

**Important:** After creating your OpenWeather account, you must subscribe to the "One Call by Call" plan separately. The key is not activated for this plan automatically when you create an account. Go to your account's Billing plans page and subscribe to One Call by Call. The free tier covers 1,000 calls per day at no cost, but subscribing requires a payment card on file; you can set a usage cap in your OpenWeather account to avoid any charges. Without this step, weather lookups will return an error.

To get your key:

1. Create a free account at [openweathermap.org](https://openweathermap.org).
2. Go to API keys in your account dashboard. Copy the default key.
3. Go to Billing plans and subscribe to One Call by Call (this requires a payment card on file, even though the free tier is free).
4. Open SnowRaven, go to Settings, and paste the key into the OpenWeather API Key field.

---

## Default Files

SnowRaven works with two data files you export from your own eBird and Macaulay Library accounts. Once uploaded in Settings, they are stored for you (in the desktop app, in the app's local data directory; in web/Pi mode, on the server) and load automatically every time you open the app.

### eBird backup

Your eBird backup is a full export of all your eBird observations: every checklist, every species, every location. It is the primary data source for most of SnowRaven's features.

The file is called `MyEBirdData.csv`. To download it, sign in at [ebird.org](https://ebird.org) and go to [ebird.org/downloadMyData](https://ebird.org/downloadMyData). Click "Download My Data" and save the download; if it arrives as a `.zip`, unzip it to find `MyEBirdData.csv`. In SnowRaven, go to Settings and upload that CSV under Default Files.

The eBird backup is used by: Species Detail, Statistics, Calendar, Map Explorer, Breeding Codes, Multimedia, Named Birds, Checklists, and List Comparer.

eBird generates the export with all observations up to the download date. Re-upload the file whenever you want your tabs to reflect recent checklists.

### ML export

Your ML export is a spreadsheet of all the media you have uploaded to the Macaulay Library (photos, audio recordings, and videos), including catalog IDs, media types, and the species associated with each item.

To download it, sign in at [macaulaylibrary.org](https://macaulaylibrary.org) and go to My Media. Set the media-type filter to **All** rather than Birds, so the export includes every item you have uploaded, then click "Save Spreadsheet."

In SnowRaven, upload the file in Settings under Default Files, and **leave the filename unchanged**. The downloaded filename contains your Macaulay Library user ID, and SnowRaven reads that ID from the filename to link directly to your own media pages. If you rename the file, those links still work but are no longer personalized to your account.

The ML export is used by: Multimedia (media counts and species coverage), Species Detail (embedded recent media and media count indicators), Statistics (the Media card), and Named Birds (the media matched to each named individual). These features are not available from the eBird backup alone.

---

## Weather

The Weather tab retrieves historical weather data for any eBird checklist. Paste a checklist ID (for example, `S12345678`) or a full eBird checklist URL and click Get weather. The result is a formatted text block matching the output format used by raincrow.app, ready to paste directly into your eBird checklist comment field.

The weather summary includes temperature range, wind speed and direction with Beaufort description, humidity, dew point, precipitation, conditions, and sunrise and sunset times. On a night checklist (one where any sampled hour falls before sunrise or after sunset), the moon-phase emoji is added to the condition emoji on the first line (for example, `☁️🌔`), computed from the checklist's start time; in the Southern Hemisphere the moon appears mirrored, the way it looks there. The formatted result is copied to your clipboard automatically on a successful lookup (on the web, the Raspberry Pi server, and the macOS and Windows desktop apps alike), so you can paste it straight in. A Copy button is always available too. An "Edit checklist comment on eBird" link opens your checklist's comment field directly in a new tab.

Both your eBird API key and OpenWeather API key must be configured in Settings for this tab to work.

### Tides

Below the weather, a Tides box fills in at the same time from the same checklist, showing the historical tide for that location and time from the nearest NOAA tide station. It needs no extra key. NOAA's Tides & Currents service is free and keyless.

The box shows the water level across your checklist's duration, labeled **Observed** when a real gauge reading exists or **Predicted** when it doesn't, whether the tide was rising or falling, the surrounding high and low tides with their local times, and the station name with its distance from your checklist. If a high or low tide turns during your checklist, the box notes it. Heights are in feet relative to MLLW (the standard US tide-table reference).

If the nearest station is more than 25 miles away, or your checklist is outside the US (NOAA only covers the US and its territories), the box explains that and offers a one-tap option to show the nearest US station anyway. A **Copy Weather and Tide Together** button copies both blocks at once, with a single SnowRaven credit at the bottom.

### Current and Predict

At the bottom of the Weather tab, two buttons let you look up weather and tide directly, no checklist needed.

- **Current** fetches the live weather and tide for where you are right now, in one tap. Your browser or device will ask permission to share your location the first time.
- **Predict** lets you choose a place (type a place name to search, or tap the map to drop a pin and drag it to fine-tune) along with a date and time, then shows the forecast weather and the predicted tide for that moment.

Weather forecasts reach about eight days out. Within the first couple of days you get an hour-by-hour reading; further out, you get that day's forecast summary, clearly labeled as a daily summary. Tide runs much further ahead, because tides are astronomical and predictable, so if you pick a date beyond the weather window, SnowRaven still shows you the tide and simply notes that no weather forecast reaches that far. Each result is a readable summary, with the same copy-ready block as the checklist lookup tucked behind a "Copy-ready block" toggle.

### Weather backlog: checklists with no weather block

At the very bottom of the Weather tab, a **List checklists with no weather blocks** section lets you work down your backlog instead of looking checklists up one at a time. Open it to see your most-recent checklists whose comment carries no recognized weather block (SnowRaven's or Raincrow's), newest first. The list is built entirely from your loaded eBird backup, so it builds and pages with no lookups and works offline; only the per-row weather lookup (below) needs a connection.

Each row shows the checklist's date, location, species count, protocol, effort, and completeness, and offers three actions:

- **Open checklist:** opens the checklist on eBird in a new tab.
- **Open comment/edit page:** opens the checklist's comment/edit page on eBird in a new tab, ready for you to paste into.
- **Copy weather & go:** looks up that checklist's weather, copies the block to your clipboard (weather only), and, on a successful copy, opens the comment/edit page so you can paste right away. If the lookup can't complete, the row tells you exactly why: you're offline, an API key is missing (with a nudge to Settings), or a general error. The comment page is **not** opened, so you never land on eBird with nothing on your clipboard. Each row's state is its own, so you can work several in a row.

By default the list shows only your **complete, non-incidental** checklists. A toggle, **Also show incomplete & incidental**, widens the list to include those too; a widened row is marked with a small chip so the wider list is never ambiguous. The list shows the first 100 matches, with **Show next 100** and **Show all** controls when there are more. If no backup is loaded, the section explains that it needs your eBird backup first; if every recent checklist already has weather, it says so rather than showing an empty list.

Locations in this list are plain text in this version.

### SnowRaven Mini (browser extension)

SnowRaven Mini is a separate companion project: a small Chrome and Firefox extension that runs the same weather and tide lookup directly on an eBird checklist's Edit Comments page and copies the block for pasting, in the same format SnowRaven produces. It is independent of the app (nothing in SnowRaven requires or uses it) and it needs its own copies of the free eBird and OpenWeather keys. It is not yet on the extension stores; source, releases, and documentation live at [github.com/dtgibson/snowraven-mini](https://github.com/dtgibson/snowraven-mini).

---

## Species Detail

The Species Detail tab shows a complete history of your observations for any species. It requires your eBird backup loaded in Settings.

Select a species from the dropdown at the top: type to search by common name or scientific name. All sections update immediately when you select a species. Switching species is instant; all data is parsed client-side from the stored file.

**Clicking bird names anywhere.** Throughout the app, a bird's common name is rendered in a consistent format: the name is a link that opens that species here on Species Detail (for any species in your data), followed by small icons linking to its eBird and Birds of the World pages, with the scientific name shown where there's room. So you can click a species in the Statistics lists, the Map Explorer, the Multimedia, Breeding Codes, or the List Comparer to jump straight to its full history. For a bird you haven't recorded yet (such as a nearby lifer or map target species), the name appears with the eBird/Birds of the World icons but without a Species Detail link, since there's no entry to open.

The tab shows the following sections for each species:

- Summary: common name, scientific name, media coverage indicators (Photo, Audio, Video, filled when data is available from your ML export), and your highest breeding evidence category.
- Sightings: total checklist count, total individual count, personal best single-count observation, and first and last seen dates. Each date links to the original eBird checklist.
- Media: photo, audio, and video catalog counts, each linking to your personal Macaulay Library page filtered by species and media type. With "Show subspecies" on, the links narrow to the exact form you're viewing (e.g. just your Oregon Dark-eyed Juncos); with it off, they cover the whole species. Requires ML export.
- Breeding Codes: every breeding code you have recorded for the species, with tier color, abbreviation, full label, and count.
- Reported With: species most frequently appearing on the same checklists as the selected species, ranked by co-occurrence percentage.
- Top Locations: ranked list of locations where you have observed the species. A location that is a public eBird hotspot is a link to its hotspot page on eBird; a personal location stays as plain text.
- Sighting Locations map: an interactive map with a pin at every unique observation coordinate. Click any pin to see the dates and checklist links for that location. Toggle between Pins and Heatmap view; in Heatmap mode a Heatmap Intensity slider (1–10) lets you dial the coverage from tighter to broader and hotter, the same control as the Map Explorer's My Sightings map.
- Comments: all your per-species field notes from the eBird backup, sortable by date and filterable by keyword.
- Recent Media: the most recently uploaded photo, audio recording, and video from your Macaulay Library, embedded inline at a matching size. Beneath each one is its capture date, a link that opens that recording on the Macaulay Library, and the checklist it came from. If an embed is slow, cannot load, or you are offline, it shows a placeholder with that same link instead of a blank frame, and recovers on its own once you are back online. The same placeholder appears while the Cornell Lab's bot check is running: an embedded player cannot pass that check, because it needs a browser cookie that no site is allowed to set from inside another site's page. The link still opens the item on the Macaulay Library, where it plays normally, and players come back on their own once the check is lifted. Requires ML export and at least one item in the catalog for this species.

Toolbar options:

- Show subspecies: off by default. Merges subspecies variants (for example, Yellow-rumped Warbler (Myrtle) and Yellow-rumped Warbler (Audubon's)) into the parent species. Toggle on to see each subspecies as a separate entry with its own stats.
- Show all forms: off by default. Hides the forms that don't count toward a life list: a spuh (`Gull sp.`), a slash (`Greater/Lesser Scaup`), a hybrid (`Mallard x American Black Duck`), an undescribed form. Toggle on to include them in the species selector. A form that only leaves the subspecies in doubt, like `Redpoll (Common/Hoary)`, is not one of these: it counts as its parent species and is always in the selector.

Graph options control the Sightings Over Time and Media Over Time charts that appear when you have enough data:

- Interval: Weekly, Monthly, or Yearly.
- Per Period / Cumulative: switches between counts per period and a running total.

On a phone, a small one-time tip appears above the graphs: charts get more room in landscape, so you can rotate your device for a wider view, or open the desktop app if you have it. It is a suggestion only. Dismissing it hides it on this tab for good, and the choice is saved on your device, so it does not return after a relaunch. Tablets and desktops never show it.

County and date-range filters appear in the toolbar when your eBird backup contains county data. Active filters apply to all sections including the map, comments, breeding codes, and media counts.

A **Named Individuals** section appears when this species has birds you've named in your checklist comments with a `[name:…]` tag (see the Named Birds tab). Each individual lists its sightings with checklist links and the comment.

---

## Statistics

The Statistics tab shows a comprehensive analytics dashboard built from your eBird backup. A jump-nav at the top links to each section. The cards are described below. The eBird backup is required for all of them; the Media card additionally requires your ML export.

On a phone, a small one-time tip appears above the first chart: charts get more room in landscape, so you can rotate your device for a wider view, or open the desktop app if you have it. It is a suggestion only. Dismissing it hides it on this tab for good, and the choice is saved on your device, so it does not return after a relaunch. Tablets and desktops never show it.

A **Count all forms** checkbox in the tab header decides what counts as a species. It is off by default, so the numbers you see are countable life-list counts. SnowRaven follows eBird's own rule for what counts as a species. A form that leaves the species in doubt does not count: a spuh (`Gull sp.`), a slash (`Greater/Lesser Scaup`), a hybrid (`Mallard x American Black Duck`), an undescribed form. A form that only leaves the subspecies in doubt counts as its parent species, so `Redpoll (Common/Hoary)` counts as a Redpoll and `Dark-eyed Junco (Oregon)` counts as a Dark-eyed Junco. Turn the checkbox on to include those forms in the counts as well. It is the same rule, and the same wording, as the Calendar tab's switch.

The checkbox moves the Species tile and most of the cards, but not every figure on the tab. Media documentation coverage and the Frivolous Lists always use countable species, whichever way the checkbox is set, because both are questions about your life list rather than about everything you recorded. Each of those figures says so where it appears: "This figure always uses countable species, whichever way Count all forms is set." Nothing is ever removed from your data by either setting. The forms left out stay on your Life List; only the count changes.

A second checkbox, **Count escapees**, sits beneath it and is also off by default. eBird sorts exotic birds into three kinds: Naturalized and Provisional both count toward a life list, and Escapee does not. With this checkbox off, SnowRaven follows that rule, so the Species figure and the milestone series match the number eBird shows you. Turn it on to put escapees back and see the total you may be used to. Both checkboxes are per-session, resetting on relaunch.

To apply the escapee rule, SnowRaven has to ask eBird which of your birds are tagged as escapees, because your CSV export does not carry that information. It works out the smallest set of your checklists that covers every species you have recorded, then fetches just those. On a 21,000-observation export that was 73 checklists and about ten seconds. The answer is cached for 30 days, so a later visit re-checks only checklists it has not seen before. This needs your eBird API key and a connection; without either, the tab says so plainly and every species counts.

Under the Species figure, a line always reports what the check is doing: not checked yet, in progress with a definite count and a Stop button, complete, or partially resolved with a Check again button. A species is only ever removed once every checklist carrying it has been checked and every one came back Escapee, so the total settles downward and never wrongly drops a bird. When escapees are found, an expandable list names each one with the evidence behind it, and stays available with the checkbox on. These birds stay on your Life List either way; only the count changes.

The corrected rule also flows to the other places that headline a life-list count: Multimedia documentation coverage, county Completeness on the Map Explorer, the Calendar's species counts, and the Frivolous Lists. Those places read the cached answer and never fetch anything themselves, so the Calendar keeps working with no connection at all. Each of them says so where the count appears.

### Life List Totals

Your headline counts: total species, total checklists, total locations, years active, states and provinces, and countries. The accumulation chart shows how your life list grew over time. Use the interval toggle to switch between Weekly, Monthly, Yearly, and Total views. Total mode draws one step per new lifer in chronological order, with the species name shown in the tooltip at each step.

### Top Species

Two ranked top-10 lists: the species you've counted the most total **individuals** of, and the species you've reported on the most **checklists**. The individuals list excludes presence-only "X" records, which can't be summed. Each name links to its Species Detail entry.

### Firsts and Milestones

Milestone pills mark every threshold from 10 to 3,000 species, showing the species that hit each milestone and linking to the checklist where it was recorded. (Records like your biggest day and longest streak now live in Highlights & Records, below.)

### Temporal Stats

Checklist activity broken down by year, month, day of week, and start hour. Each breakdown shows count and percentage of total. The day-of-week view highlights weekend versus weekday birding patterns.

A **Checklist duration** histogram shows how long your outings run: 15-minute bins for the first three hours, then hourly bins beyond that. A caption below the bars gives your average duration. Only checklists with a usable duration are counted (eBird caps a checklist at 24 hours), and when some of your checklists lack one, the caption also notes how many of them the bars cover.

### Geographic Stats

A map of your most-visited locations alongside ranked lists of your top locations, counties, and states (shown by full name, e.g. Minnesota) by checklist count and species count. A top-location name that is a public eBird hotspot links to its hotspot page on eBird (personal locations stay plain); county and state entries link to their eBird region page. The map shows numbered markers for your top locations by checklists (green circles) and top locations by species (blue squares).

### Effort and Outings

How you bird, measured. **Totals** lead the section: total time afield (also spelled out as days / hours / minutes), total distance, and total area covered when your data has it. **Key metrics** cover average duration, average distance, average area, species per hour, and species per mile, plus a protocol distribution and an average-by-protocol table. An **observer summary** shows your percent solo, average observers, and largest group, and a **Lists by observer count** breakdown gives every distinct observer count its own bar, with the exact list count and share for each group size shown beside the chart (rare shares read "<1%" rather than rounding to zero). **Notable Outings** highlights your single checklists that were the longest (duration), farthest (distance), largest-area, biggest (most species), and most-individuals, each linking to eBird. Area-based stats appear only if your data includes area-covered checklists (the eBird "Area" protocol).

### Data Quality

The consistency and completeness of your data: the ratio of numeric counts to X/presence-only records, and your comment coverage (checklist and species comments). (Record counts and rarity lists moved to Highlights & Records.)

If any of your checklist comments contain a weather or tide block (the kind SnowRaven or Raincrow pastes in), a **Weather & tide blocks** breakdown also appears, showing the number and percentage of checklists that carry: **any weather** block (the total), **Raincrow weather**, **SnowRaven weather**, **SnowRaven tide**, and **weather + tide** (a SnowRaven weather block and a tide block on the same checklist). A weather block from either app counts toward "any weather"; Raincrow blocks are recognized by their raincrow.app credit and SnowRaven blocks by their SnowRaven credit. Tide blocks are SnowRaven-only. The breakdown is hidden if none of your checklists carry these blocks.

### Highlights & Records

Your notable stats in one place: biggest single day, longest consecutive streak of days with any report, longest dry spell between reports, Shannon diversity index (a measure of evenness across species, from your numeric counts), biggest single counts (your largest flocks), Single-Checklist Birds (species recorded on exactly one checklist, excluding one-and-done), and One-and-Done Birds (species with a total individual count of exactly 1). Where applicable, entries link to the relevant checklist.

### Breeding Stats

Confirmed, Probable, and Possible species totals from your eBird backup. A stacked bar chart shows breeding activity by month. Use the filter buttons to isolate Confirmed, Probable, or Possible entries.

### Media

A deep look at your Macaulay Library archive, built from your ML export. It opens with a chart of how your photo, audio, video, and total media counts have grown over time (view it per period or as a cumulative total), then breaks the collection down several ways:

- **At a glance:** total media, species documented, the photo/audio/video split, your busiest media day (its date links to that day's eBird checklist; if the day spans several, the one with the most media), your longest streak of consecutive days with media (with the dates the streak ran), and your archive span, how long your collection stretches, from first upload to most recent.
- **Documentation coverage:** how much of your life list you have captured with media: the share documented with any media, and separately with a photo, audio, and video. This is where the lopsidedness most birders have (lots of photos, little audio) becomes visible.
- **Photos Tagged With Age or Sex:** two donuts showing the age-class mix (adult / immature / juvenile / unknown) and the sex mix (male / female / unknown) across your media, counted per individual, with the unknown share shown honestly and a note of how many are tagged.
- **Age coverage by species:** the species you have documented as a juvenile or immature, each with a row of dots marking which age classes you have captured (adult, immature, juvenile). It shows the first ten with a "Show all" / "Show fewer" toggle and can be sorted by name (A–Z) or taxonomic order, and it ends with a note of how many species you have documented only as adults so far (which still appears even if you have no young birds tagged yet).
- **Behaviors documented:** how many distinct behaviors you have captured and which are most common (foraging, flying, singing, and so on), plus a tally of species for which you hold media showing breeding behavior, grouped into confirmed, probable, and possible. Each behavior's count is a link that opens your Macaulay Library media filtered to that behavior (your flying shots, your feeding-young shots, and so on), and each breeding behavior is listed and linked individually in its own group just below, so you can open just your feeding-young or nest-building media directly.
- **When you capture media:** the time-of-day distribution of your captures, split by photo, audio, and video, so the dawn-chorus audio and golden-hour photo patterns stand out.

Below all of that, ranked lists show your most-photographed, most-recorded, and most-filmed species, each linking to your personal Macaulay Library page filtered by species and media type. The whole card requires your ML export; the age, sex, behavior, and time-of-day sections fill in to the extent your export carries those annotations.

### Frivolous Lists

At the very bottom of the Statistics page is a section just for the fun of it: eight self-completing collections that fill in from your own life list:

- **Avian American:** every bird whose name starts with "American," from the American Avocet to the American Woodcock. Each one you've recorded gets a checkmark, with a running count and a badge once you've seen them all.
- **California Dreamer:** the same idea for the "California" birds: Condor, Gnatcatcher, Gull, Quail, Scrub-Jay, Thrasher, and Towhee.
- **Phoebe Phanatic:** the three phoebes: Eastern, Black, and Say's.
- **Scrub Jay All Day:** the four scrub-jays: California, Woodhouse's, Florida, and Island.
- **Crow Pro / Raven Maven:** the crows and ravens: American, Fish, Tamaulipas, and Sinaloa Crows, plus the Common and Chihuahuan Ravens.
- **Heron is Carin' (and Egrets too):** the true herons, egrets, night-herons, and bitterns, shown as those labeled sub-groups with a single badge for the whole set.
- **Best of the Crest:** a big "crested and crowned" collection spanning many families (cardinals, jays, titmice, kinglets, quail, mergansers, kingfishers, and more, down to the Crested Auklet and Tufted Puffin), shown by sub-group.
- **Rainbow Connection:** the first bird of each rainbow color you ever logged: red, orange, yellow, green, blue, indigo, violet. Each filled color shows that bird with the date and place you first saw it and a link to the checklist. A color counts only when it appears as a whole word in a name, so "Red-tailed Hawk" fills red but "Reddish Egret" doesn't; and one bird can fill two colors (a Violet-green Swallow counts for both violet and green). Colors you haven't found yet wait with a blank, and a badge appears once all seven are filled.

These lists are built entirely from your loaded eBird data, nothing new to set up.

---

## Calendar

The Calendar tab lays out a full year of your birding as twelve month grids, like a wall calendar's twelve pages, with a number on each day. It loads automatically from your stored eBird backup and works entirely offline, no network, no API key.

### Reading the calendar

- **Each day carries a count.** By default it's the number of **species** you saw that day; the **Show** toggle switches every day to the number of **checklists** you submitted that day, or the **total count** of individual birds you recorded that day (the eBird *Count* column, summed). Species tells you how *good* a day was; checklists, how *much* you went out; total count, how *many* birds you tallied. Presence-only records (an "X" or a blank count) add 0 to the total (the same rule as the Statistics tab's individual tally), so the two never disagree.
- **Days are shaded green** by their count relative to the year on screen; darker means busier. So the shape of your year reads at a glance: busy spring and fall migration darken, quiet mid-summer thins out, a big December count-day day goes near-black.
- **The metric count is the big number in the middle of a data day.** The big month grids (Compact view) are count-only at every width; the day-of-month date lives on the whole-year thumbnails (Large view, see below). In **All years** the weekday columns line up against the *current* year, so the combined grid matches the layout of this year's single-year view.
- **Three kinds of day:** a shaded **data day** showing its count (a real `<button>`, so click it); a faint outlined **no-birding day** (you logged nothing); and a light **"0"** day, meaning you birded but nothing you recorded that day counted toward the active metric (for example, only forms that don't count toward a life list under Species).
- **The legend** on the right names the unit ("Species / day", "Checklists / day", "Individuals / day", …) and shows the green ramp with the low and high counts of the current view, plus the "no birding" and "birded · 0 countable" keys.

### Moving through your data

- **Year navigation:** the ‹ and › buttons move to the previous or next year that has data (gap years are skipped, and the buttons disable at the ends of your range).
- **All years:** folds every year into one combined twelve-month grid, keyed by month-and-day. Here **species** is a *distinct-species union* across years ("how many different birds have I ever recorded on this date"), while **checklists** and **total count** are *sums* across years; February always keeps its Feb 29 cell. The legend and the day popup label which is which so the two are never confused.

### View: Compact or Large

The **View** toggle switches between two layouts (both show the whole year, only the cell size differs):

- **Compact** (default): the twelve big month grids, with a count on every birded day. The big cells are count-only at every width; they don't print a date, since the dates live on the Large-view thumbnails.
- **Large**: all twelve months as small thumbnails in a 3×4 grid, the whole year at a glance. Each cell is shaded by its count and carries a small day-of-month number in the corner (no count), so the overview reads as a dated heatmap. When a thumbnail is too small for the number to stay legible it tucks away and the cell shows shading only; the exact figures are always in the Compact view and the day popup. **Click any day in a thumbnail to open its detail popup**, the same day summary and checklist links as in the Compact view, opened right where you are (no view switch). The month cards themselves don't navigate; use the toggle to switch between Compact and Large.

The View toggle works at every width, including a phone: both layouts are available and distinct there. On a narrow screen each collapses to a single column, so Compact gives you comfortably tappable count cells and Large gives you the dated, shaded mini-months (with the date shown, since the single-column card is wide enough to keep the number legible). Whichever view you're in, tapping a day opens the same day popup.

### Focusing on one species

A searchable **Species** filter in the control row narrows the whole calendar to a single species. Start typing to filter the list (by common or scientific name), then click or press Enter; it's the same type-to-find picker as Species Detail. Leave it on **All species** (the first row, which clears the filter) for the normal view, or pick a bird to see the seasonal shape of just *when you record that species*: every day cell, the shading tiers, the legend, and the day popup redraw for that one species. Under a species filter the **Species** metric becomes a simple presence (1 on a day you recorded it, blank otherwise), the **Checklists** metric counts the checklists that recorded it that day, and **Total count** shows how many individuals of that one bird you recorded each day (the headline use case: "how many of this bird did I record across the year"); **All years** folds that one species across every year. Subspecies and form names fold into their parent (so picking "Dark-eyed Junco" includes "Dark-eyed Junco (Oregon)"), and the **Count all forms** toggle steps aside while a single species is chosen. The selection lasts for the session and makes no network calls.

### Textures (colorblind mode)

The **Use Textures** switch turns each shade tier into a crosshatch whose density rises with the count, so you can read a day's level from ink-density rather than from color or brightness. The exact number is always available in the day popup too, so color is never the only carrier of information.

### Counting all forms

A low-emphasis switch at the bottom of the controls, **off by default**, optionally includes the forms that don't count toward a life list in the **Species** count and the **Total count** individuals. SnowRaven follows eBird's own rule for what counts as a species. A form that leaves the species in doubt does not count: a spuh (`Gull sp.`), a slash (`Greater/Lesser Scaup`), a hybrid (`Mallard x American Black Duck`), an undescribed form. A form that only leaves the subspecies in doubt counts as its parent species, so `Redpoll (Common/Hoary)` counts as a Redpoll whichever way the switch is set. Turning the switch on raises some day counts and re-shades the grid, and a former "0" day becomes a real numbered day. It has no effect on the Checklists metric, so it's dimmed and inactive whenever Checklists is the active metric (and while a single species is chosen). The forms left out stay on your Life List; only the count changes.

### The day popup

Click any day to open a popup showing **all three** of that day's numbers (species, checklists, and total individuals, regardless of which metric the grid is on), plus a list of that day's checklists, each linking straight to eBird. Every checklist row also shows its **start time, location, and species count** (for example, "7:30 AM · Point Reyes NS--Bear Valley · 42 species"), so you can tell one outing from another at a glance and see how each contributed; a checklist with no recorded start time shows just the location and count. The per-checklist species count follows the **Count all forms** toggle the same way the day totals do (countable species by default, all forms when the toggle is on). In All-years mode the popup labels the union-vs-sum distinction and tags each checklist with its year. Close it with Escape, the Close button, or by clicking the backdrop.

---

## Map Explorer

The Map Explorer tab provides four views of your birding locations and nearby activity. An eBird API key is required for Hotspots, Nearby Lifers, and Media Targets.

**Base maps and layers.** A control in the top-right of the map switches the base map between **Map** (a clean, light street map), **Satellite** (aerial imagery), and **Topo (US)** (USGS topographic, United States only), and toggles a **Trails** overlay that draws hiking paths on top of whichever base is active. Your selection is remembered between sessions. The same control appears on the Species Detail and Statistics maps.

**The buttons in the map's bottom-right corner.** Every map shows the same row of three round buttons, all the same size, each carrying a small picture of the thing it acts on. (On My Sightings before your eBird backup is loaded there is no map yet, only the setup instructions, so the row is not there either.) Left to right: a **share button**, a **location button** (a target reticle), and a **fullscreen button**. On small or mobile screens a **Filters** button sits beside them to open the controls sidebar.

The **fullscreen button** expands the map to fill the entire window: the app header, tab selector, and mode tabs are hidden so you get the maximum map area. Click it again (the button becomes a minimize icon) to return to the normal layout.

**Centering on where you are.** A round **location button** (a small target reticle) sits in the middle of that row, on all four views. Press it to center the map on your current position and place a blue pin at the detected location. The Hotspots, Nearby Lifers, and Media Targets views also offer the same thing as a **Use my location** button in the filters sidebar, which does exactly the same job; on those three views, pressing either one also runs that view's search when you have not set a center yet. While it is finding you, the button shows a spinner and a second press does nothing until the first finishes.

The desktop app uses your operating system's native location service (macOS and Windows both supported). If location is off or denied, restore it in System Settings → Privacy & Security → Location Services on macOS, or Settings → Privacy & security → Location on Windows; in web/Pi mode, use your browser's site permissions. When a location request fails, the exact reason and the fix appear in a red note just above the map's buttons, where a screen reader announces it too. The note clears the next time detection succeeds, and when you switch views.

On My Sightings, the location button appears once your eBird backup is loaded. Until then that view shows the setup instructions instead of a map, so there is nothing to center.

**Drop a pin to set the center.** On the Hotspots, Nearby Lifers, and Media Targets views you can set the search center right on the map: **right-click** (desktop) or **long-press** (touch) anywhere to drop a center pin there, then **drag the pin** to fine-tune. Each placement re-runs that view's search for the new spot. This sets the center for the current session only. It doesn't change your saved Default Location (set that in Settings). The place-name search, **Use my location**, and typed coordinates all still work and drive the same center.

### Searching the area you are looking at

On the Hotspots, Nearby Lifers, and Media Targets views, a **Search this area** button appears on the map once you have moved or zoomed the map away from the last area you searched. Press it and that view's search runs again from the middle of the view, without opening the filters sidebar. It re-runs whichever view you are on, so there is one button to learn rather than three.

**Where it is.** Just above the round buttons in the map's bottom-right corner, as its own full-width row. It sits below the red location-failure note when there is one, so it never shifts under your finger as that note comes and goes. On a phone it is in the same place, and it is hidden while the Filters overlay is open, along with the rest of the map's buttons.

**When it appears.** Only when pressing it would search something different from last time, and only while there is still ground on screen the last search did not reach. Moving the map brings it back once you have gone more than a quarter of the radius you last searched: about a mile and a quarter after a 5 mile search, about six and a quarter after a 25 mile one. Zooming brings it back too, once you have zoomed far enough out that the search would need to grow to the next size up. Zooming back in does not, because everything you are looking at was already covered. The **Radius** control in the sidebar has no say in any of this: the button works out its own radius from the view, so turning that control neither summons the button nor sends it away. Panning and zooming on their own never search: nothing is sent until you press.

**After you press.** A second press cannot stack a second lookup on the first. Press the button from the keyboard and it stays exactly where it is, greyed out and doing nothing, while the search runs and after it succeeds, so focus is never dropped out from under you mid-search, and a screen reader hears that this area has already been searched. Click or tap it and, depending on the browser, it may simply leave the corner instead, which comes to the same thing. Either way it turns back into a live button the moment you move the map somewhere new. A search that fails is the exception: there the live button returns right away, because a retry is the thing you want next.

One more thing has to be true: the button has to fit. On the narrowest phones at the larger text sizes the map area can end up shorter than the round buttons already stacked in its bottom-right corner need, and there is nowhere to put another row above them without drawing it off the map or on top of the basemap switcher at the top of the map. Rather than cover a control you still have to be able to press, the button stays away in that case. On a phone this starts to bite at the larger text sizes, and the narrower the phone the sooner. Everything it does is still available the way it always was: open **Filters**, set the center and radius, and press **Find**. Going fullscreen gives the map more height and often brings the button back.

**What gets searched.** Everything you can see, and a little beyond it. The search center is the middle of the view, and the radius is worked out so that the circle reaches past the corners of your screen, which is what makes the whole view part of the search. Because a circle has to stretch to a rectangle's corners, it always takes in some ground past the top, bottom and sides as well: that is the price of covering everything, and a few extra results from just off screen are better than a gap in the middle.

That distance is then rounded **up** to the first of the sidebar's own four sizes (5, 10, 25, and 50 miles) that is big enough to hold it, so the button can never send a distance you could not have picked yourself, and it stops at **25 miles** even when the view is larger than that.

The center of the view is written into the sidebar's **Latitude** and **Longitude** boxes, so you can see where the search went and adjust it from there. Your **Radius** setting is left exactly as you set it: the button works out its own radius for the search, and it does not reach into your settings to change one. That means the size the button just searched and the size shown in the **Radius** control can be different, and the circle drawn on the map (below) is the one telling you the size that was actually used. Pressing **Find** afterwards runs a fresh search at whatever the sidebar currently says, which may be a smaller or larger circle than the button used. Setting the center this way lasts for the current session only, exactly like dropping a center pin. It does not change your saved Default Location.

The 25 mile limit is measured from the middle of the view out to its corner, not across the screen, so the shape of your map matters as well as its size: a wide desktop map reaches the limit at a greater width than a tall narrow phone one does.

**Seeing what was covered.** A search area is a circle and the map is a rectangle, so the two can never match exactly. After a search, the ground *outside* the searched circle is gently dimmed, with a dashed red-orange edge marking the boundary. Right after you press, nothing is dimmed and the dashed edge is off screen: the circle reaches past every corner, so everything you can see was searched, which is exactly what you would want it to say. Pan or zoom out afterwards and the ground the search never reached greys over, so you can tell at a glance whether the pins in front of you are the answer to what you are looking at now.

The one time you see dimming immediately is when the view was larger than the 25 mile limit. Then the circle really is smaller than the screen, and it is drawn that way on purpose rather than quietly pretending to cover the whole view: the dimming shows you which pins fall outside the answer. The circle is drawn at the center and radius the search used, and it stays where it was searched, so the map moves underneath it.

**What it found.** A short line appears at the top of the map naming what the search returned, for example "12 hotspots found in this area." It clears itself after a few seconds. If the search finds nothing it says so plainly, which is a result and not an error, and the circle is still drawn. If the search fails, the same line shows the reason and stays until the next search, and the button comes straight back so retry is one more press in the corner your thumb is already in.

### Copying a location from a map

When you want to tell another birder exactly where a spot is (the far end of the pond, the parking pullout, a stakeout on a levee road with no address), drop a share pin and copy it.

**Dropping a pin.** On the My Sightings view, **right-click** (desktop) or **long-press** (touch) anywhere on the map. A small red flag plants at the exact point you pressed, and a popup opens showing that spot's coordinates. Drag the flag to fine-tune it: the coordinates update as you go and the popup follows. Dropping again moves the same pin rather than adding a second one.

**Without a pointer.** Every map with a share pin also has a round button in its bottom-right corner carrying a small flag, matching the flag it plants. Press it and the pin plants at the center of the current view, so you can pan the map with the arrow keys, press the button, and copy without ever using a mouse gesture. The button tints green while that map is holding a pin. On the Map Explorer it sits next to the location button; the flag and the target reticle are deliberately different shapes so the two are easy to tell apart.

**On the Hotspots, Nearby Lifers, and Media Targets views** the same corner carries a **map pin button** instead, because right-click and long-press already belong to the search center there. It opens the same copy popup the search center pin itself opens, so there is never a second pin: press it and the popup appears at your search center, with the map bringing that center into view first if it has drifted off screen. It tints green while the popup is open, and pressing it again closes it. Until you have set a search center there is nothing to copy, so the button shows a dashed border and says what to do instead; it stays where it is and stays reachable, so the row never changes shape.

**Copying.** Press the copy button in the popup. By default you get three lines:

```
38.54321, -121.98765
Google Maps: https://maps.google.com/?q=38.54321,-121.98765
Apple Maps: https://maps.apple.com/?q=38.54321,-121.98765
```

Paste that into a text message and the two links are tappable, opening the exact spot in whichever maps app the person you sent it to prefers. The coordinate line on its own also works: paste it straight into a Google Maps or Apple Maps search box and it finds the spot. Settings under Sharing has a switch for each of the three lines, so you can send any combination you like: just the coordinates, just one map link, coordinates plus one link, and so on. The button says what it will copy before you press it, and a line underneath spells out the lines you will get. With all three switched off there is no copy button at all: the popup still shows the coordinates on screen and points you back to Settings.

If the clipboard write is refused (this can happen in some browsers), the popup says so and shows the full text with a **Select all** button, so you can copy it by hand. It never claims a copy that did not happen.

**Where it works.** Copying a location works on every map in the app. The share pin you drop yourself is on Map Explorer's My Sightings view, Species Detail's Sighting Locations map (both Pins and Heatmap), the Statistics Geographic Stats map, and the per-individual map on a Named Birds card. On Hotspots, Nearby Lifers, and Media Targets, right-click and long-press are already taken by the search center, so instead the **search center pin itself** is clickable: click it (or reach it with the keyboard) and the same copy popup opens. The map pin button in the corner opens that same popup, which is useful when the pin has scrolled off screen. Dropping and dragging that pin behaves exactly as it always has.

**Closing.** Press **Esc**, or the popup's close button, to remove the pin and the popup together. Switching to a different map view clears it too. The pin is not saved anywhere: it is per-session, resetting on relaunch, and nothing about it is written to disk.

**Nothing is sent anywhere.** The coordinates are already on your device and the two links are assembled locally as plain text. No shortener, no geocoder, no lookup of any kind, so the whole thing works with no connection.

### My Sightings

Shows all your personal observations on a map. Narrow what's shown with the panel filters: Species (a specific species), Breeding Code, Date Range, County (when your backup contains county data), and Media. The Radius control sets the map's starting zoom and the distance within which your saved personal locations appear.

Switch between Pins and Heatmap with the Map View toggle. In Heatmap mode, a Heatmap Intensity slider lets you dial the coverage from tighter to broader and hotter. Higher settings spread each sighting farther and make even sparse, low-count areas stand out, which also helps when reading density at different zoom levels.

In Pins mode, a **Point Size** control (Normal / Small / Off) sits just below the Map View toggle. Use it when you're studying a shaded breeding-code or county map and the sighting points get in the way: **Small** shrinks the points so the shading reads through, and **Off** hides them entirely (a hidden point can't be clicked, so its popup goes away with it). This works alongside the automatic fade the map already applies while shading is on, so Small plus an active shade both dims and shrinks the points. **Normal** is the default and looks exactly as before. The choice applies to Pins only (Heatmap is unaffected) and is per-session, resetting on relaunch.

A **Sightings in view** list in the panel mirrors the pins currently on screen: each row shows a location's name, observation count, and species count. In every Map Explorer panel this in-view list is the last section, below the map-overlay controls, so the controls stay near the top no matter how long the list gets. Each in-view list also has a chevron in its header that collapses or expands it (the count stays visible when collapsed), so you can tuck a long list away when you don't need it. Select a row (it is fully keyboard-operable: Tab to it, then Enter or Space) to open that location's details popup on the map and pan to it, exactly as clicking the pin would. The list updates as you pan or zoom, so it always reflects what's visible; on very dense views it shows the busiest locations first with a note to zoom in to narrow it. This is the keyboard path to the map markers, which are otherwise mouse-only.

### Hotspots

Fetches eBird hotspots near a location. Hotspots you have visited (matched against your eBird backup) appear as green pins. Unvisited hotspots appear as blue pins. Locations from your personal location history appear as orange pins. Click any legend row to hide or show that category. Enter a place name or coordinates to search, then click Fetch hotspots. While a search is running, a small chip at the top of the map shows its progress.

A **Hotspots in view** list in the panel mirrors the teardrops currently on screen: each row shows a hotspot's name and whether it's visited, unvisited, or a personal location. Select a row (fully keyboard-operable: Tab to it, then Enter or Space) to open that hotspot's details popup on the map and pan to it, exactly as clicking the teardrop would. The list updates as you pan or zoom and honors the legend's hidden categories. This is the keyboard path to the map markers, which are otherwise mouse-only.

**Color pins by.** A "Color pins by" control in the panel recolors the hotspot pins by what you want to know. The default, **Visited status**, is the coloring described above, and nothing changes until you pick another mode. The choice is per-session, resetting on relaunch.

- **My species** colors each hotspot by how many countable species you have personally reported there, from your loaded backup. Countable follows the app's usual rule: subspecies fold into their species, and spuhs, slashes, and hybrids do not count, so this number can honestly differ from the popup's raw "species recorded" line; both are shown, labeled. A hotspot you have never birded shows as a pale empty pin, and a visited hotspot whose records are all spuhs and slashes shows as a hollow pin with a zero, so "no data" never masquerades as a low count.
- **My checklists** colors each hotspot by how many checklists you have submitted there, all checklist types included.
- **Recent activity** colors each hotspot by how many species the whole eBird community has reported there recently, with a **Time window** choice of **Week** or **30 days**. This is the "where is the action" view: the busiest hotspots in your search stand out at a glance.

Values land on a five-class blue ramp, darkest for the highest values, with class breaks taken from the current search's own numbers; the legend shows each class's true range. My species and My checklists work fully offline and never make a network request. Recent activity asks eBird about each public hotspot in your current search, using your own eBird key, a few at a time and at most 200 per search, on your screen first, then nearest your search center. One lookup answers both windows, so flipping Week and 30 days never refetches, and answers are kept on your device for six hours, so re-running a search or coming back to the tab recolors from the cache without new requests. Pins color one by one as answers arrive, with a progress line in the panel. Requests are paced gently, and if eBird asks the app to slow down, the pass pauses briefly and resumes on its own; the progress line says so while it happens. The same courtesy covers every eBird lookup the Map Explorer makes (the hotspot search itself, Nearby Lifers, Media Targets, and county Completeness): they all share one pace, and a lookup that arrives while eBird is asking for a pause waits it out and then answers, instead of failing.

The pins always tell you honestly what is known: a **hollow** pin means the answer is zero (no countable species of yours, or no community reports in the window; the popup says which), a **dashed gray** pin means that hotspot has not been checked yet, and a **pale** pin means you have never birded it. If you are offline, have no eBird key, or eBird returns an error, the panel says exactly which it is; already-fetched values keep their colors (with a "fetched at" time when they came from the cache) and a **Retry** button re-asks only what is missing, without re-running the hotspot search. Personal locations always keep their orange star and never join a ramp. While a mode is active the legend explains the scale and offers the visited / unvisited / personal filters as glyph chips (the glyph on each pin carries its visited state, since color now carries the number), and the Hotspots in view list adds each hotspot's value or state to its row, so the full reading is available from the keyboard and without perceiving color.

Below the legend, the panel lists the ten closest hotspots you have not visited, ranked by distance from your center point. Selecting a row opens that hotspot's details popup on the map and pans to it; a small ↗ link beside each row still opens that hotspot's page on eBird.

**Atlas blocks overlay.** A **California atlas blocks** toggle overlays the official California Breeding Bird Atlas block boundaries on the map. The grid is drawn for the area you are looking at and appears once you zoom in; at very wide views a "Zoom in to see atlas blocks" hint appears instead, so the whole-state view stays uncluttered. Click any block to open a popup with its name, a link to its eBird California atlas page, and (when shading is on) your highest breeding code there plus how many of your breeding records fall inside it. The boundaries are generated from a compact bundled dataset, so the overlay works offline with no extra download, and outside California nothing is drawn. This overlay is available in the My Sightings, Hotspots, Nearby Lifers, and Media Targets panels.

When the overlay is on, a **Shade by My Highest Breeding Code** toggle appears. It tints each block by the strongest breeding code *you* have personally entered there: darkest for Confirmed, down through Probable to Possible. The shading reflects only your own records, never anyone else's, and requires your eBird backup to be loaded in Settings. When shading is on, any heatmap or pins automatically dim so the tier colors stay legible on top.

With shading on, a **Use Textures** toggle (off by default) adds a distinct hatch per breeding level (sparse dots for the lowest, dense cross-hatch for the highest), so the levels are distinguishable without relying on color. Turn it on for colorblind-friendly reading; leave it off for the cleanest view of the map beneath.

**County lines & shading.** A **County lines** toggle draws US county boundaries over the area you are looking at, recomputed as you pan and zoom, with a "Zoom in to see counties" hint at very wide views. With County lines on, a **Shade counties** toggle tints each county by the selected metric, with a **Species / Checklists / Completeness** switch choosing between distinct species per county, total checklists per county, and how complete your county list is (see below). For Species and Checklists the shading is drawn entirely from your loaded eBird backup, with a legend whose ranges are quantiles of your own county totals across a fine ten-step scale (so the breaks shift with your data and your well-birded counties stand apart from one another rather than all sharing the darkest shade); the legend and shading update together when you switch metrics. With shading on, a **Use Textures** toggle (off by default) paints each county as a crosshatch whose density rises with your count (an open lattice for your lightest counties through a tight crosshatch for your most-recorded ones), so you can rank counties without relying on the green color alone. Turn it on for colorblind-friendly reading; leave it off for the plain color ramp. The legend and the Counties in view list show the same density steps, the patterns follow light and dark themes, and they keep working across all three metrics. The choice is per-session and resets on relaunch. Counties with no records stay as plain outlines, clearly distinct from shaded ones. Click any county for a popup with its name, state, your species and checklist counts there (the counts are how many of *your* checklists reported each species in that county, not a tally of individual birds), a link to its eBird county page, and (depending on the metric) your most-recorded species, your top locations, or the completeness details in that county. A keyboard-accessible **Counties in view** panel (bottom-left) lists the in-view counties so the popups are reachable without a mouse. Only one shading ramp is active at a time: turning on the green county shading switches off the purple atlas breeding shading, and vice-versa (a tooltip on each shade toggle and a caption note the switch). The boundary *lines* can still both be shown. It is the color fills that are mutually exclusive, since the two ramps competed for the same map. The county *lines* are drawn straight from the map's own tiles, so they stay crisp and accurate at every zoom level instead of looking blocky up close (they trace the same boundary the basemap shows underneath), with no extra download and no new data source. The shading, the per-county popups, and the zoomed-out / offline fallback use a compact bundled dataset (US Census, public domain). The Species and Checklists metrics add no network calls of their own; outside the US, nothing is drawn. This overlay is available across all four Map Explorer views.

**County Completeness.** The third shading metric answers "how complete is my list in each county, and what am I missing?" Each county you've birded is shaded by your countable species recorded there divided by the total species ever reported to eBird for that county, on a fixed 0–100% scale of ten equal bands. Unlike the other metrics' quantile ranges, the same shade always means the same completeness, in every county. "Countable" follows eBird's own rule for what counts as a species: a form that leaves the species in doubt doesn't count (a spuh like "gull sp.", a slash, a hybrid, an undescribed form), while a form that only leaves the subspecies in doubt counts as its parent species, so subspecies and subspecies-group slashes fold into their species. The count on the eBird side is collapsed by the same eBird field, so the percentage compares like with like. Click a shaded county for a progress bar with "X of Y species (Z%)", a **Recently added** list of your five newest county species with the date each was first recorded there (this comes from your own backup, so it works offline and without a key), and a **Top targets** list of up to five countable species on the county's eBird list that aren't on yours yet, in taxonomic order (names on your life list link to Species Detail, others render plain). Counties you've never birded stay plain outlines; click one and press **Load completeness** to look it up with a single eBird request, on demand. **Unlike Species and Checklists, Completeness needs a network connection and your eBird API key**, and a note under the metric switch says so at the point of use. Lookups are strictly bounded: only the counties you've actually birded in the current view are fetched, a few at a time, never a bulk sweep, and every result is cached on your device for 30 days (county species lists change slowly), so revisiting a fetched county makes no new eBird call and previously fetched counties keep shading even offline. Without a key or a connection, the mode stays honest: cached counties still shade, your own X count and Recently added list still show, and the popup says plainly whether the missing piece is your key, your connection, or an eBird error (errors are never cached, so click the county again to retry). The Counties in view panel shows each county's "X/Y · Z%" or its honest state, so the keyboard route has full parity with the map.

**Basemap muting while shading is on.** When either shading is active, the basemap's green land fills turn grey so the shading ramp stands out. Water, roads, and labels keep their color, and Satellite or Topo imagery desaturates the same way. Turn the shading off and the basemap's colors come back. The Trails overlay stays colored (it's your overlay, not the basemap). In heatmap mode, the heatmap dims and sits beneath the county ramp just as it already did beneath the atlas ramp, so the tier colors stay readable on top. This muting reuses the tiles already loaded, with no new download and no network calls.

### Nearby Lifers

Maps where species you have never recorded were reported recently near a chosen point, not just which ones. It opens on your saved Default Location and offers the same controls as the other map sections: **Use my location**, a place-name search, and a Radius control, plus a **Time Range** filter to set the window to the last day, last week, or last 30 days.

Each spot is a labeled pin showing the lifer's name, or "{n} species" where several lifers were reported at one place. Every pin also carries a small **locator dot** at its exact coordinate so you always know precisely where a bird is. A **Marker Style** toggle switches between **Labels** (the name chips) and **Dots** (just the locator dots). Dots gives a clean overview of *where* the lifers are without the labels crowding each other, and the pins stay fully clickable. Pins are colored by how recently the bird was seen. Click a pin (or a row in the panel list) to see the lifers reported there, each with its date and a link to the eBird checklist. Lifer names appear with the eBird and Birds of the World icons but without a Species Detail link, since they are not in your recorded data.

Data comes from eBird's recent observations API for your location and radius. This view replaces the old flat Nearby Lifers list that lived on the Statistics tab.

### Media Targets

Shows recent sightings of species you are missing at least one media type for, within a search radius. Pins are color-coded by recency: bright green for the past 7 days, lighter for 8 to 15 days, and lightest for 16 to 30 days. Every pin carries a small **locator dot** at its exact coordinate, and a **Marker Style** toggle switches between **Labels** (the full name-and-media chips) and **Dots** (just the locator dots) for a clean overview of where the targets are; the pins stay clickable either way. A **Time Range** filter narrows the window to the last day, last week, or last 30 days. A **Targets in view** list in the sidebar mirrors the target pins currently on screen: each row shows the species, location, the most recent date, and (when you have a search center set) the distance, sorted nearest first. The list updates as you pan or zoom, so it always reflects what's visible; on very dense views it shows the closest first with a note to zoom in to narrow it. Selecting a row (via its keyboard-operable "show on map" button) opens that location's details popup on the map and pans to it. This is the keyboard path to the target chips, which are otherwise mouse-only.

---

## Multimedia

The Multimedia tab shows your complete life list with media coverage: which species you have photographed, audio-recorded, and video-recorded.

The tab loads automatically from your eBird backup and ML export saved in Settings. When both files are present, it enters Comprehensive mode, which builds the species list from your eBird observations so that every life-listed species appears even if it has no media yet. SnowRaven follows eBird's own rule for what counts as a species: a form that leaves the species in doubt does not count (a spuh, a slash, a hybrid, an undescribed form), while a form that only leaves the subspecies in doubt counts as its parent species. A Total column shows combined photo, audio, and video counts.

Each non-zero count in the Photo, Audio, and Video columns is a clickable link to your personal Macaulay Library page filtered by species and media type. With "Show subspecies" on, a form row's links narrow to that exact form's media; with it off, they cover the whole species.

Toolbar options:

- Filter pills: All, Has media, Is Target (missing at least one media type), No photo, No audio, No video, Has photo, Has audio, Has video. Multiple pills combine with AND logic.
- Sex and Age dropdowns: filter the media by **sex** (Male, Female) and **age** (Juvenile, Immature, Adult). They combine with the pills, with each other, and with the county/date filters. While a facet is active, each species' counts reflect only the matching media, species with none drop out of the list, and the Macaulay Library links open scoped to the same filter. Choosing both an age and a sex targets a single kind of bird (e.g. a juvenile female); a single dropdown stays broad (any female, or any juvenile).
- A-Z / Taxonomic: switch between alphabetical and eBird taxonomic sort order.
- Merge subspecies: on by default; combines subspecies variants under the parent species name.
- Show all forms: off by default; hides the forms that don't count toward a life list (a spuh, a slash, a hybrid, an undescribed form). It governs the same set the tab's "X of N species" count uses, so the rows you see and the number above them agree.
- Unbounded: removes the table's horizontal scroll constraint so the full row is visible on narrow screens.
- Pin column labels: keeps the row of column headings (Entries, Photo, Audio, Video, Total) visible at the top of the screen while you scroll down the list, so you can always tell which count a number is. It is off by default, and the choice is per-session, resetting on relaunch. Pinning uses the Unbounded view, so pressing it from the normal view switches to Unbounded and pins in one press. Pressing it again unpins and puts you back in the view you started from. Switching back to Normal yourself also clears the pin. While the headings are pinned, a short note above the table says so. This is the same control, and the same behavior, as Pin code labels on the Breeding Codes tab.

County and date-range filters appear in the toolbar when county data is available. These filters narrow which observations are counted for each species.

### Media Comments

Below the species table, a **Media Comments** section surfaces the notes you attached to your Macaulay Library uploads: the asset **Caption** and **Media notes**. It shows the most recent comments, with a keyword filter, a Newest/Oldest sort, and a "Show all" control, just like the comments box on Species Detail. Each entry shows the species, the media type (photo/audio/video), the date and place, the comment (with a small label for which field it came from), and a link to that asset on the Macaulay Library. The filter matches across both comment fields. The section only appears when your ML export actually contains media comments. (The eBird observation comment isn't included here. The export copies it onto every media item from an observation, so it would just repeat; it's the comment on the media itself that's shown.)

When you have media comments, a short note at the top of the tab tells you how many are searchable and offers a **Jump to comments** link, so you can reach this section without scrolling past the whole species table.

---

## Breeding Codes

The Breeding Codes tab shows every species you have recorded a breeding code for, displayed as a matrix with a column for each breeding code you have recorded (out of the 23 the app tracks).

The tab loads automatically from your eBird backup saved in Settings. SnowRaven follows eBird's own rule for what counts as a species: a form that leaves the species in doubt does not count (a spuh, a slash, a hybrid, an undescribed form), while a form that only leaves the subspecies in doubt counts as its parent species.

Each cell shows how many times you recorded that code for that species. Cells are color-coded by eBird's four-tier system: darkest for the highest Confirmed codes, medium for lower Confirmed codes, lighter for Probable, and lightest for Possible. Empty cells are blank.

A legend below the table spells out each code you've recorded with its full meaning (for example "NB Nest Building"), grouped by evidence tier, so you can read what a code stands for without hovering. The filter pills above the table show each code's meaning the same way. Nothing is shortened, abbreviated or hidden: every code keeps its full meaning, which is the point of the legend.

Click any column header to sort by that code's count. Click the species name column to sort alphabetically or by eBird taxonomic order using the A-Z / Taxonomic toggle.

The filter row above the table includes:

- All: shows all species.
- Confirmed, Probable, and Possible: selects all codes in that evidence category at once.
- Individual code pills: each limits the table to species with at least one observation for that specific code.

Multiple pills can be active simultaneously. The table shows only species that have at least one observation for every active selection.

The Unbounded toggle removes the table's horizontal scroll constraint for easier reading on narrow screens.

Pin code labels keeps the row of code headings (NB, FL, CF, and so on) visible at the top of the screen while you scroll down the species list, so you can always tell which column a circle sits in. It is off by default, and the choice is per-session, resetting on relaunch.

Pinning uses the Unbounded view, so pressing Pin code labels from the normal view switches to Unbounded and pins in one press. Pressing it again unpins and puts you back in the view you started from. Switching back to Normal yourself also clears the pin. While the labels are pinned, a short note above the table says so. Nothing else changes: the table keeps its full height and the page still scrolls as one, with the legend after the last species.

On a phone, in both the normal and Unbounded views, the code columns tighten to the width of their dots so far more of them fit on screen at once, thin vertical rules separate the columns so a row reads clearly across, and the species-name column stays fixed on the left as you scroll the codes sideways in the normal view. Long filter meanings wrap inside their pills, and a long bird name can wrap above its eBird and Birds of the World links. Every label remains complete, both links remain available with their full touch targets, and nothing escapes the name column. You can pinch to zoom in on any part of the matrix using your device's normal gesture. The table scrolls as part of the page, with the legend at the end after the last species; in the normal view its longer code meanings wrap onto a second line so they stay inside the card at the largest text sizes.

---

## Named Birds

The Named Birds tab tracks individual birds you've named in your eBird species comments. Tag a specific bird in a checklist's species comment with a `[name:…]` tag (for example `[name:Winky]` or `[name:one-leg-pete]`), and SnowRaven gathers every checklist where that name appears.

Each named bird shows its name, species, first- and last-seen dates, a small line noting how long you've followed it (the elapsed span between the first and last sighting, e.g. "2 yrs. 3 mos." or "5 days"), and total number of sightings, and expands to list every checklist it appears on: the date, the location (a link to the hotspot page on eBird when the location is a public hotspot), a link to that checklist on eBird, and the species comment, plus a small map of everywhere that individual has been seen. Cards open one at a time. Sort the list by **Name (Individual)**, **Alphabetical**, **Taxonomic**, or **Last Seen**.

**Media of a named bird.** If you've also saved your Macaulay Library export in Settings, a **Media of {name}** section appears below the map when you expand an individual, gathering that bird's own photos, audio, and video as inline players. A media asset belongs to a named bird when a matching `[name:…]` tag is found for it, scoped to the matching species. SnowRaven looks in two places, in order. The asset's *own* comment (its caption or media notes) wins, but only when it carries a `[name:…]` tag of its own: in that case that tag is the answer and nothing else is consulted for that asset. Otherwise SnowRaven falls back to the species comment on the checklist, which is where most birders write the tag in the first place. Note that "otherwise" includes an asset that has a caption with no name tag in it: an ordinary descriptive caption like "backlit, heavy crop" does not change which bird the asset is matched to. So the fallback attributes every photo, recording, and video from a tagged observation that doesn't carry its own name tag, which is what you want when you named one bird and photographed it. If a single observation names two individuals, its untagged assets are shown under both, since the data cannot say which bird each one shows. To correct either case, put a `[name:…]` tag in that asset's own caption or media note on the Macaulay Library: a name tag on the asset always overrides the species comment, and a caption without one does not. Each item is labeled with its capture date and a link to the checklist it came from, newest first. Players load only when you open the card, in an initial batch of six with a **Show more** control for birds with more; each mounts as it scrolls into view, so a well-documented individual stays responsive. If you're offline or an item can't load, that tile shows a **View on Macaulay Library** link instead of a broken frame, keeping its date and checklist link. The same happens while the Cornell Lab's bot check is running: an embedded player cannot pass that check, because it needs a browser cookie that no site is allowed to set from inside another site's page, so every tile shows that link instead. Players come back on their own once the check is lifted. A named bird with no matching media shows a short "No media matched to this bird." note; with no ML export saved, the media section doesn't appear at all.

A bird is identified by its name together with its species, so the same name used for two different species is tracked as two individuals, and name matching ignores case. This tab requires your eBird backup; the media section additionally requires your ML export. The same named-individual information for a single species also appears as a **Named Individuals** section on the Species Detail tab (without the media section).

---

## Checklists

The Checklists tab is the home for your checklists as whole outings: search every comment you've ever written, and browse or filter the full list of your checklists. It loads from your stored eBird backup; saving your ML export too adds media-type detail.

**Checklist Comments** lists every checklist-level comment, one entry per checklist, with its date (linking to that checklist on eBird) and location (a link to the hotspot page on eBird when the location is a public hotspot). The 10 most recent show first; expand to see all, switch **Newest/Oldest**, and type in the filter box to search within your comments.

**Species Comments** does the same for the observation notes you've written on individual sightings, across **all** species at once. Each entry leads with the species name; click it to open that species on the Species Detail tab.

**All Checklists** lists every checklist with its date (linking to eBird), location, protocol, effort (duration, distance, observers), species and individual counts, at-a-glance indicators (species comments, media, breeding codes), and the checklist comment. Filters combine: one pill per category cycles **any → has → doesn't have** for checklist comment, species comments, media, breeding codes, weather block, and tide block, plus a **Complete/Incomplete** pill, **photo/audio/video** pills (when your ML export is saved), and protocol, county, and date-range controls. The count label reads "N of M checklists" while anything is filtered, and **All** resets the pills.

**Show weather & tide blocks** (off by default) controls whether pasted SnowRaven weather/tide blocks appear anywhere on the tab. While hidden, block text is also excluded from search (so searching "Humidity" won't match every checklist you pasted a weather block into), and a comment that contains *only* a block counts as having no comment. Flip the toggle to see, and search, the blocks again. (The **Weather block** / **Tide block** filter pills work either way.)

---

## List Comparer

The List Comparer tab compares two lists and shows which species appear in both and which are unique to each. A toggle at the top switches between two modes: **Checklists** and **Life Lists**. Checklists opens first.

### Life Lists

Compares two full eBird life lists (CSV backups). If your eBird backup is saved in Settings, your list loads automatically as List A. You can also upload any eBird backup CSV file directly as List A. Drop a second eBird backup CSV file onto the List B slot, then click Compare Lists. SnowRaven follows eBird's own rule for what counts as a species: a form that leaves the species in doubt does not count (a spuh, a slash, a hybrid, an undescribed form), while a form that only leaves the subspecies in doubt counts as its parent species.

### Checklists mode

Compares two individual eBird checklists. Paste two checklist IDs or URLs (e.g. `S12345678` or `https://ebird.org/checklist/S12345678`), the same way you would in the Weather tab, then click Compare checklists. This mode uses your eBird API key (set in Settings) to fetch each checklist directly from eBird, so it works for any public checklist, not just your own.

Each checklist is identified by a card at the top showing its location, date, and ID, useful when comparing two visits to the same place. The card also shows the checklist's **effort and provenance**: type (Traveling, Stationary, Incidental, etc.), distance (in the unit you entered), duration, number of observers, and the app and version it was submitted from (e.g. "eBird iOS 3.6.5"). The **checklist ID links to the checklist on eBird**, and if the checklist has a checklist-level comment, a collapsible **Notes** disclosure shows it.

Each card also carries a **badge row** that summarizes the checklist at a glance: which media types were reported across all its species (**Photo**, **Audio**, **Video**), whether any **Breeding** codes were noted, and whether the checklist's comment already contains a SnowRaven **Weather** block and/or **Tide** block (handy for spotting which outing already has conditions pasted in). All six badges always show (filled when present, plain when absent), so the two cards line up side by side.

The "In Both" panel shows each species' details from both checklists side by side (A on the left, B on the right); the "Checklist A only" and "Checklist B only" panels appear below.

For each species on each checklist, you see:

- **Count:** the number recorded. Where one checklist recorded a higher number, that count is bolded with a ▲ marker. Presence-only entries (eBird's "X") show a dash and are never marked as higher.
- **Breeding code:** if a breeding-evidence code was entered, it appears as a small colored pill, colored by evidence tier (the same scheme as the Breeding Codes tab). Hover for the full code name.
- **Media icons:** small camera, microphone, and video icons indicate whether photos, audio, or video exist for that species on that checklist (across all observers). Hover for the counts on desktop; on phones the count appears as a small number next to each icon.
- **Comments:** when a species has an observation note, a 💬 icon appears on that checklist's side (A, B, or both); click it to read the note. Any links in comments are clickable.

All comments are also gathered into a **Comments table** at the bottom, with each checklist's note side by side for easy comparison. There, an empty side reads "no comment" (the bird was on that checklist but had no note) or "not reported" (the bird wasn't on that checklist).

Below the comments, a **Weather & Tide** section lets you pull a fresh weather and tide reading for each checklist and compare the conditions of the two outings side by side. Press **Load weather & tide**. Nothing is fetched until you ask, and unlike the Weather tab, **nothing is copied to your clipboard automatically**. Each side then shows its weather block and tide block (the same format the Weather tab produces), with its own **Copy weather**, **Copy tide**, and **Copy weather & tide together** buttons; copying only happens when you press a button. The two sides are independent. If one checklist can't be looked up, the other still shows its conditions. The same tide notices appear here as on the Weather tab (when the nearest station is far away or outside the US, with a one-tap option to show it anyway). If a checklist's comment already includes a weather block, a short note reminds you that OpenWeather revises its historical data over time, so a fresh lookup may differ from what's pasted in. If your eBird or OpenWeather API key isn't set, the species comparison and badges still work; only this section shows a nudge to add the missing key in Settings.

Birds reported as a sub-form (for example, a domestic Rock Pigeon) are matched and named by their parent species, so the same bird lines up across both checklists.

### Both modes

Three panels appear: species in both lists, species only in List A, and species only in List B. Each species name has icons linking to its eBird species account and Birds of the World page. Use the A-Z / Taxonomic toggle to switch sort order.

---

## Settings

The Settings tab is where you configure everything SnowRaven needs to function.

### Appearance

Set your color scheme: System (follows your operating system preference), Light, or Dark. Selecting Light or Dark shows a prompt to save your preference. Selecting System removes any saved preference.

**Text size.** Scale the app's text from 100% up to 200% (100% / 125% / 150% / 200%). This is in addition to your browser or device's own text-size setting, which SnowRaven already follows, handy in the desktop app, which has no separate browser zoom. Your choice is remembered across sessions. At the largest sizes, wide tables and the maps may scroll sideways, which is expected.

**Date format.** Choose how dates appear throughout the app: month-first (Jun 8, 2026), day-first (8 Jun 2026), or ISO (2026-06-08). The default is month-first. Your choice applies everywhere dates are shown and is remembered across sessions.

**Disable embedded media.** This option is off by default, so Species Detail and Named Birds normally show inline Macaulay Library players. Turn it on to prevent those players from loading anywhere in SnowRaven. Their space will say “Embedded media is disabled in Settings.” Dates, checklist links, media counts, comments, analytics, and direct links to each item on the Macaulay Library remain available. The choice takes effect immediately and is remembered across sessions.

### Sharing

**Copying a location.** Chooses what lands on the clipboard when you copy a location from a map pin (see "Copying a location from a map" under Map Explorer). Three independent switches, one per line of the copied block:

- **Coordinates**: the coordinate pair.
- **Google Maps link**: a link that opens the spot in Google Maps.
- **Apple Maps link**: a link that opens the spot in Apple Maps.

Any combination works, and each line keeps its place in the same order whichever ones you turn on, so a block never has a gap in it. Coordinates are decimal degrees to five places, latitude first, which is about a metre of precision and matches what eBird shows. An example of the exact text you will get is shown below the switches, along with a sentence naming the lines it contains.

If you turn all three off, nothing is left to copy: the example says so, and the map popup shows the coordinates on screen with a note pointing back here instead of a copy button. The pin still marks the spot, and you can select that coordinate text by hand.

Your choice is remembered across sessions and takes effect immediately, including for a share popup you already have open. If you had chosen "Copy coordinates only" in an earlier version, you will find Coordinates on and both map links off, which is the same thing said three ways.

### API Keys

Enter and manage your eBird and OpenWeather API keys. Keys are saved securely: in the desktop app, they are stored in the app's local data directory; in web/Pi mode, they are saved to the server's .env file. Changes take effect immediately without a restart. Saved keys are masked by default; use Show or Hide to reveal or re-mask them. Use Update to replace a key, or Clear to remove it.

### Default Files

Upload your eBird backup CSV and Macaulay Library export. Each file is stored for you: in the desktop app, in the local app data directory; in web/Pi mode, on the server. Files load automatically when you open the relevant tab. Use Upload new to replace a stored file, or Clear to remove it.

### Default Location

Set a home location used by the Map Explorer. Click **Use my location** to fill in your coordinates automatically (the same detection the Map Explorer offers), or enter latitude and longitude by hand. Set a search radius in miles, then click Save. The radius defaults to 5 miles. The Map Explorer uses these coordinates as its starting center and zoom level, including the starting point for the Nearby Lifers section.

### Tab Layout

Reorder and show or hide individual tabs. Drag rows to reorder, or use the **Move up** / **Move down** buttons on each row for a keyboard-only alternative to dragging. Click the eye icon to toggle a tab's visibility. At least one tab must remain visible at all times. The Settings tab is always last and cannot be hidden.

On narrow screens and mobile browsers the tab bar automatically collapses into a compact dropdown that follows the same order and visibility choices, so every tab stays reachable without horizontal scrolling. The rest of the interface is built to hold up on a phone too: controls and lists wrap rather than overflow, buttons and pills grow to a comfortable tap size, and a map popup that is taller than the screen (a shaded county's completeness card, a pin's sightings list, a target or nearby-lifer marker) scrolls inside itself so its content stays reachable. A few dense spots can still scroll sideways a little at the narrowest screen width combined with the largest text size.

### Troubleshooting (desktop app)

In the Mac and Windows desktop apps, the Settings tab includes a Troubleshooting section with a **Rebuild caches & restart** button. If the map or species lookups stop working, rebuilding the app's local caches usually fixes it; the app clears its cached taxonomy data and restarts. This section does not appear in the web/Pi version.

---

## Using SnowRaven offline

SnowRaven keeps working without a connection. Every analytical tab and every map **opens offline** once it has loaded online at least once, working entirely from your already-loaded, locally-stored data. Here's what's available offline, and what still needs a connection.

**What works offline:**

- **All your tabs and maps open.** Each analytical tab and map opens offline once you've visited it online at least once. The maps draw your sightings, the heatmap, the atlas blocks, and the county lines & shading, plus the base map's place labels.
- **Bird names stay complete from a cold start.** Even on a first-ever launch with no connection, bird names sort in taxonomic order and show their eBird and Birds of the World icons.
- **Previously-loaded weather and tide re-show.** A checklist's weather or tide reading you loaded online once re-appears when you reopen that checklist offline, marked as the last loaded result with the time it was loaded.
- **Honest messages when a live feature can't run.** When something needs the network and can't reach it, SnowRaven tells you plainly whether you're offline, missing an API key, or hit a server error, rather than failing silently.

**What still needs a connection:**

- **Full street detail on the map** comes from the network. An offline map still shows your data and the base map's place labels, and an area you have already panned over recently often redraws from the app's own cache, but street-level detail for somewhere new waits for a connection. Only the **Map** (vector) base works offline; Satellite, Topo, and Trails are disabled while you're offline.
- **Live weather and tide lookups** are online-only, but a reading you've loaded before re-shows offline (above).
- **County Completeness lookups** need a connection and your eBird API key. Counties you fetched in the last 30 days still shade from the on-device cache, and the popup's local pieces (your countable count and Recently added list) work fully offline; only new county lookups wait for a connection.
- **These features are online-only with no offline fallback**, and they show a clear "you're offline" message: place and address search, the Checklist Comparer, live nearby-bird overlays, and downloading an app update.

---

## Updating SnowRaven

In the Mac and Windows desktop apps, click **Check For Updates** in the footer. If a newer version is available, click **Install update**, and the app downloads and applies it, then prompts you to relaunch. Updates are cryptographically verified, so they are safe even though the Windows build is not yet code-signed.

In web/Pi installations, the footer also checks for updates; to apply one, run `./update.sh` in your SnowRaven directory (or `git pull` and rebuild), which pulls the latest code, rebuilds the frontend, updates dependencies, and restarts the service.

On iPhone and iPad, updates arrive through the App Store (or TestFlight for pre-release builds), like any other iOS app. There is nothing to do in SnowRaven itself: the app has no in-app update step on iOS.
