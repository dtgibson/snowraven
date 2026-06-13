===== HUMAN =====
Given an ebird data backup file, what statistics or useful information can be displayed or inferred about ther user's checklists? What data points about checklists specifically (i.e., number with media, number with or without photos, etc.) could be shown on a dashboard that takes an ebird data backup file as input?

===== ASSISTANT =====
The key structural thing to understand first: an eBird data backup (the `MyEBirdData.csv` you request from your account) is *observation-level*, not checklist-level. Every row is one species seen on one checklist. To get checklist statistics you group rows by the **Submission ID** column (the `S#######` checklist identifier). Once you do that, a single CSV gives you a surprisingly rich amount to work with.

Here's what's derivable, organized by what a dashboard could actually show.

**Counts and composition**

The obvious one is total unique checklists (count of distinct Submission IDs). From there the most eBird-meaningful breakdowns are by **protocol** (Traveling, Stationary, Incidental, Area, Banding, Nocturnal Flight Call, etc.) and by **complete vs. incomplete** checklists. That completeness flag comes from the `All Obs Reported` column (1/0) and is worth surfacing because complete checklists are the ones that contribute usable data to eBird's scientific models — it's a nice "data quality" metric for a user to see about their own habits.

**Effort metrics**

Each checklist carries effort fields you can total and distribute: `Duration (Min)`, `Distance Traveled (km)`, `Area Covered (ha)`, and `Number of Observers`. From these you can show total hours birded, total distance, average checklist length, the distribution of durations, and solo-vs-group birding (observer count of 1 vs. more). Note that Incidental and Stationary checklists legitimately have blank distance/duration, so you'll want to handle nulls rather than treat them as zeros that drag down averages.

**Richness per checklist**

Counting species rows per Submission ID gives species-per-checklist, which feeds a lot of fun stats: your average list size, your biggest checklist ever, the distribution, and efficiency measures like species-per-hour or species-per-km. Summing the `Count` column per checklist gives total individuals — with the caveat that eBird allows `X` (present, uncounted), so a chunk of counts aren't numeric and need to be excluded or flagged.

**Geography and time**

Latitude/longitude and Location ID are present, so you can map every checklist, count unique locations, and roll up to county / state / country counts. The `Date` and `Time` fields let you show checklists over time (per day/month/year), time-of-day patterns (are you a dawn or dusk birder), day-of-week habits, seasonality, and streaks of consecutive days with at least one checklist.

**Derived "highlight" stats**

Because you have the full observation history, you can compute things that aren't in any single column: which checklist added the most lifers (first appearance of a species in your data), your first-ever checklist, "big day" detection (unusually high species or checklist counts in a single date), most productive locations, and longest/largest outings.

**On the media question specifically**

This is the one area where I'd flag an important limitation. The relevant column is `ML Catalog Numbers`, which lists the Macaulay Library catalog numbers attached to each observation. From the backup file alone you *can* determine:

- Which observations (and therefore which checklists) have media attached — the field is non-empty
- How many media items per observation/checklist (count the catalog numbers)
- Checklists with media vs. without, total media uploaded, media-per-checklist distribution

What you **cannot** reliably get from the CSV is the photo-vs-audio-vs-video split. The catalog numbers are just IDs; they aren't tagged by type and aren't segregated by media type in any sequential way. So "number of checklists with photos" specifically (as opposed to "with any media") isn't determinable from the backup alone — you'd need to cross-reference each ML number against the Macaulay Library or the eBird API to learn its type. A dashboard reading only the file should present this as "checklists with media" rather than implying a photo count, unless you add an API enrichment step.

A couple of other honest caveats for anyone building this: a few fields (like whether a location is a hotspot vs. a personal location) aren't cleanly in the standard export, so verify against your own file rather than assuming; and shared checklists appear in your data as your own records, so counts reflect your account, not necessarily checklists you personally initiated.

If you tell me which direction you're leaning — a stats summary page, an interactive map, a "year in review" style recap — I can sketch out a concrete layout or even prototype the parsing/aggregation logic. Do you have a sample file you're working from?
