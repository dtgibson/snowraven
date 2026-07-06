## Weather Backlog

### What this does
Adds a "List checklists with no weather blocks" section at the bottom of the
Weather tab. It builds — entirely from the already-loaded eBird backup, with no
network — a list of the user's most-recent checklists whose comment carries no
recognized weather block (SnowRaven **or** RainCrow), newest first. Each row
shows date, location, species count, protocol, effort, and completeness, and
offers three actions: open the checklist on eBird, open its comment/edit page,
and **Copy weather & go** — a one-click "look up this checklist's weather, copy
it, and open the comment page ready to paste." The default view lists only
complete, non-incidental checklists; a toggle widens it to a superset that also
includes incomplete and incidental checklists (marked with a chip). The list
pages in 100s. The existing single-checklist Weather lookup, Current, and
Predict controls are unchanged.

### How to test
1. Load an eBird backup (Settings → import your MyEBirdData export) and set your
   eBird + OpenWeather API keys.
2. Open the **Weather** tab and scroll to the bottom. Click **List checklists
   with no weather blocks**. The section expands in place; the header names the
   count and filter context.
3. Confirm every listed checklist is complete and non-incidental, ordered
   newest-first, and that none already carry a weather block.
4. Toggle **Also show incomplete & incidental**. The list widens (nothing is
   removed), incomplete/incidental rows get a chip + faint tint, and pagination
   resets to the first 100.
5. On any row, click **Copy weather & go**. On success it copies the weather
   block to your clipboard (weather only — no tide) and opens
   `https://ebird.org/edit/effort?subID=<id>` in a new tab, once. Paste to
   confirm.
6. Force failures: disconnect the network (offline state), remove a key
   (missing-key state with a Settings nudge), or hit a server error — the row
   shows the honest inline state and the comment page is **not** opened.
7. With >100 matches, use **Show next 100** / **Show all**. With no backup
   loaded, the section shows a needs-data state; with a backup but no matches, a
   filter-aware "no matching checklists" state.
8. Automated: `cd frontend && npm run build && npm run lint`, and
   `npx vitest run src/lib/weatherBacklog.test.ts src/components/WeatherBacklog.test.tsx`.

### Notes for reviewer
- **Weather-only copy (user decision, OQ-3).** `buildBacklogCopyText` returns
  the weather block and does not fetch or append tide. The Architect isolated
  this to one function; a combined variant would be a one-line change.
- **Incidental = protocol code `P20`** (verified in `checklistMeta.ts`;
  `ChecklistEntry.protocol` stores the raw eBird code, and `P22` is *Traveling*,
  not incidental). Fixtures use `P##` codes, matching real exports.
- **State-free lookup wrapper (NFR-10).** The backlog does **not** call App's
  `loadWeather`/`loadTide` (which mutate the single-lookup UI state). The Weather
  tab passes `lookupBacklogWeather`, which makes the same
  `transport.getReplayable('/weather/<id>')` call and returns the string (or
  rethrows), touching no single-lookup state. The single lookup / Current /
  Predict are byte-behavior-unchanged; the byte-golden `weatherFormatter` tests
  and the existing weather-tab tests stay green.
- **Presentational component.** `WeatherBacklog` receives already-built
  `ChecklistRowData[]` (or `null`/`undefined`), the lookup wrapper, `copyText`,
  and navigation callbacks as props. App builds the rows **lazily** — only on the
  first expand (`onFirstExpand` → `backlogRequested`) — so the default Weather
  tab paint stays free of a backup parse; rows rebuild when the backup changes
  (`filesVersion`).
- **Action #3 state machine** is per-row (independent `useState`): idle →
  looking-up (in-flight guard ignores re-clicks) → copying → success. The edit
  page opens **exactly once**, only on the copy-success edge; every failure edge
  (offline / no-key / error / copy===false / bad id) surfaces inline and never
  opens the page (FR-19).
- **Locations render as plain text** (the approved FR-15 fallback). The Weather
  tab is the app's default (non-deferred) tab, and `HotspotLink` needs
  `useHotspotSet()`, whose region fetch fires on mount — wiring it here would add
  a network call to first paint of the default tab. The component accepts an
  optional `isHotspot` prop, so linked hotspots can be added later without a core
  change.
- **No new backend route, provider, or formatter.** Reuses `/weather/<id>` via
  the transport seam; `PRIVACY_POLICY.md` needs no change.
- **Entry-chunk guard.** `WeatherBacklog` pulls in no maplibre/recharts; a fresh
  build keeps `vendor-maplibre` off `dist/index.html`'s modulepreload and
  `entryChunk.test.ts` stays green.

### Files
- `frontend/src/lib/weatherBacklog.ts` — pure core (predicates, ordering,
  pagination). React-free, no `Date.now()`.
- `frontend/src/lib/weatherBacklog.test.ts` — 17 core tests.
- `frontend/src/components/WeatherBacklog.tsx` — presentational component +
  per-row action-#3 state machine + states.
- `frontend/src/components/WeatherBacklog.test.tsx` — 27 component tests (jsdom).
- `frontend/src/App.tsx` — mounts `<WeatherBacklog>` below
  `<WeatherForecastPanel>`; adds `lookupBacklogWeather` (state-free wrapper) and
  the lazy row-build effect.
- `frontend/package.json`, `src-tauri/tauri.conf.json` — 0.5.66 → 0.5.67.
- `CHANGELOG.md` — 0.5.67 entry.
