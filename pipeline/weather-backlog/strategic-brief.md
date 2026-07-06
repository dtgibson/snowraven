# Strategic Brief — Weather Backlog

## What We're Building
A backlog view, reached from a link at the bottom of the Weather tab, that
lists a birder's recent complete checklists that don't yet have a SnowRaven
weather block — with per-row actions to open the checklist, jump to its
comment/edit page, and copy the weather for that checklist and land on the
comment page ready to paste. It turns SnowRaven's original one-at-a-time
weather lookup into a proactive "clear my missing-weather backlog" workflow.

## Why Now
Weather lookup is where SnowRaven began, and it still ships as the Weather
tab — but it's reactive: the user has to already know which checklist needs
weather, look it up one at a time, and paste. Meanwhile the loaded eBird
backup already knows *exactly* which of the user's checklists are missing a
weather block. Surfacing that list closes the loop the product was founded
on: instead of remembering what you skipped, you see the backlog and work it
down. Every dependency this needs — the backup, the weather-block detector,
the `/weather` lookup, the clipboard seam — already exists, so this is a
lean, frontend-first assembly of shipped parts.

## The User Problem
A birder who's been logging for years has a long tail of checklists they
never added weather to — some because they logged in a hurry, some from
before they started using SnowRaven at all. Today the only way to find and
fix them is to remember them or scroll eBird. There's no view that says
"here are your 100 most recent checklists with no weather block — here's
each one, one click to look it up, one click to go paste it." This feature
is that view.

## Success Criteria
- From the bottom of the Weather tab, one click opens a list of the 100 most
  recent complete, non-incidental checklists with no SnowRaven weather block,
  newest first, each showing enough at-a-glance info to recognize it.
- Each row offers three working actions: open the checklist on eBird, open
  the checklist's comment/edit page on eBird, and copy-weather-then-open-
  comments (copies the block to the clipboard, and on a successful lookup
  opens the comment page so the user can paste immediately).
- The list pages in 100s: after the first 100 the user can "Show next 100"
  or "Show all."
- A toggle expands the list to also include incomplete and incidental
  checklists; default view is complete, non-incidental only.
- The existing single-checklist Weather lookup on the same tab is unchanged.
- Works offline for building the list itself (it's computed from the already-
  loaded backup); only the per-row weather lookup needs the network, and its
  failure is surfaced clearly rather than silently swallowed.

## Scope
- A "List checklists with no weather blocks" entry point at the bottom of the
  Weather tab that reveals/opens the backlog list.
- Backlog list built entirely from the already-loaded eBird backup:
  - Detect "no weather block" per checklist via the existing weather-block
    detection over the checklist comment.
  - Default filter: complete (eBird "All observations reported") AND
    non-incidental checklists only.
  - Order newest first.
  - Per-row basic info so the user can identify the checklist (see Key
    Decisions for the field set the Designer finalizes).
- Per-row actions (three):
  1. Open the checklist on eBird (the existing checklist-link destination).
  2. Open the checklist's comment/edit page on eBird (the paste destination).
  3. Copy weather to clipboard via the `copyText()` seam, then on a
     successful lookup open the comment/edit page so the user can paste.
- Pagination: first 100, then "Show next 100" and "Show all."
- A toggle that adds incomplete + incidental checklists to the list.
- Reuse the existing `/weather` lookup path and the existing formatters for
  action #3 — no new weather formatting logic.

## Out of Scope
- Bulk or automatic posting of weather into eBird — impossible; eBird has no
  write API, so the user always pastes manually.
- Any change to the existing single-checklist Weather lookup behavior on the
  tab.
- New weather/tide data providers, or any change to how weather/tide is
  fetched or formatted.
- Tide-station backfill or any tide-coverage work as a goal of this feature
  (tide only rides along if action #3 copies the combined block — see Key
  Decisions).
- A new backend route is not anticipated; this is a frontend assembly of
  shipped parts. (If profiling later shows the per-row lookup needs
  server help, that's a Planner/Architect call, not a scope commitment here.)

## Key Decisions
Settled defaults (reuse existing mechanisms; don't reinvent):

- **"No weather block" = the existing detector.** Use the shipped
  weather-block detection over the checklist comment
  (`hasSnowravenWeatherBlock` / `hasWeatherBlock` in `lib/commentBlocks.ts`),
  the same logic that drives the Checklists tab's weather flag. Reuse it;
  do not write a second detector. **Open question for the Planner:** does the
  backlog target *any* weather block being absent (`!hasWeatherBlock`), or
  specifically *no SnowRaven* block (`!hasSnowravenWeatherBlock`, which would
  re-list a checklist that only carries a Raincrow block)? Default:
  `!hasWeatherBlock` — a checklist with *any* recognizable weather block is
  "handled" and stays off the backlog. Confirm at planning.
- **"Complete" and "Incidental" come straight from the backup.** "Complete" =
  eBird "All observations reported" (`allObsReported`); "Incidental" = the
  Incidental protocol. Default view lists complete AND non-incidental only.
  The toggle *adds* incomplete + incidental checklists to the list (it widens,
  it doesn't switch). A checklist with an unknown/absent complete flag is
  treated as not-complete and shown only when the toggle is on.
- **Ordering + pagination.** Most recent first; page in 100s — first 100,
  then "Show next 100" (append) and "Show all."
- **Per-row actions are the three specified**, reusing shipped seams:
  eBird checklist link + eBird comment/edit link (both id-shape-validated via
  `SUBMISSION_ID_RE`), and copy-via-`copyText()`-then-open-comments. Action #3
  opens the *same* comment/edit destination as action #2, after the copy —
  because there is no write API, "jump to the comment field" means landing the
  user on the eBird edit page with the block already on their clipboard.

Deferred to the Designer (each has a sensible default; each is a genuine UX
judgment):

- **(a) Does action #3 copy weather-only or weather+tide?** The user wrote
  "weather information," but the origin feature pairs both and the Weather tab
  already offers "Copy Weather and Tide Together." *Default:* mirror the
  Weather tab — copy the combined weather+tide block when tide is available,
  weather-only otherwise — so the backlog produces the same paste the user
  gets from the main lookup. Designer confirms whether the backlog should
  instead be strictly weather-only.
- **(b) Which "basic information" fields show per row?** *Default:* date,
  location, species count, protocol, and a completeness indicator — the same
  vocabulary the Checklists tab already shows per checklist. Designer decides
  the exact, scannable set and whether to distinguish complete vs.
  incomplete/incidental rows visually when the toggle is on.
- **(c) How do failures surface?** The list builds offline, but action #3's
  lookup can fail (offline, no/invalid OpenWeather key, lookup error).
  *Default:* the row's copy action reports the failure inline (a clear
  per-row error state) and does NOT open the comment page on failure — the
  user shouldn't land on an edit page with nothing (or stale content) on the
  clipboard. Designer owns the exact failure affordance and the missing-key
  case (e.g. point the user at settings).
