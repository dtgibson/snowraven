## Calendar Breeding opens By category (calendar-breeding-category-default)

### What this does
With the Calendar's Breeding overlay on, day tiles now start in **By category** instead of **Every code**. `DEFAULT_CALENDAR_OVERLAYS.codes` in `frontend/src/lib/calendarOverlays.ts` is now `'category'`. A saved 1.0.38/1.0.39 preference migrates when it is read, one field at a time, so devices that already have a saved value get the new default too. Every write now carries a version marker, so a deliberate Every code is still remembered across launches.

### How to test
1. Fresh state (no saved `calendarOverlays`): open the Calendar. Both switches are off and **By category** is pressed under the dimmed gate. Turn on **Breeding**: tiles show Conf / Prob / Poss rows with species counts, and the legend reads "one row per category that day · …".
2. Saved 1.0.38 shape `{ media: false, breeding: true, codes: 'every' }` (no marker): the Calendar opens with Breeding on and By category rows. Nothing is written back until you change a control.
3. Press **Every code** and relaunch (or reload). Every code is still pressed. The stored value is now `{ media, breeding, codes: 'every', v: 2 }`.
4. Saved By category, with or without the marker: kept.
5. Open Help, Calendar, "Overlays: media and breeding": it says "**By category** (the default)".

### Notes for reviewer
- **Migration as built**, in `normalizeCalendarOverlays`, after the existing strict own-property validation. `media` and `breeding` are read exactly as before. For `codes`:
  - A `'every'` with no marker becomes `'category'`, and the other fields are kept. An unmarked `{false, false, 'every'}` returns the frozen default by reference.
  - A `'every'` with the marker stays `'every'`.
  - A `'category'` stays `'category'`, with or without the marker.
  - A marker that is not an own property strictly equal to `CALENDAR_OVERLAYS_VERSION` counts as no marker. That covers a stringly `'2'`, a 1, a 3, an array, a boolean, null and an inherited value.
  - An invalid, absent or inherited `codes` gives the new default.
  - A value that is not a plain object still gives the frozen default, and so does the JSON.parse own-`__proto__` shape.
  - Nothing is written back on read. A migrated value is saved, with the marker, only on the user's next change.
- **The four parts of the CLAUDE.md shipped-default rule:**
  1. The previous default is a named constant, `PREVIOUS_DEFAULT_CODES_MODE = 'every'`, so the check is one equality.
  2. The comparison runs after validation.
  3. Nothing is written back.
  4. Exactly one generation migrates, and no older one exists.
- **The marker** is `CALENDAR_OVERLAYS_VERSION = 2` under the key `v`. Its literal lives only in `calendarOverlays.ts`, and tests read it through the constant. `storedCalendarOverlays()` is the one builder, and `useCalendarOverlays` `commit` writes through it. Rollback is safe: 1.0.39 ignores `v` and reads `codes` as stored.
- **Symmetric difference of the replaced `codes` read, both directions, measured.** A generated corpus test in `calendarOverlays.test.ts` compares the old read (kept verbatim) with the new one over 57,753 shapes. Each of `codes`, `v`, `media` and `breeding` is either absent, an own value or an inherited value. The counts are asserted from the axis sizes, so they cannot go stale.

  | Read | Widening: old `every`, new `category` | Narrowing: old `category`, new `every` | Agree |
  |---|---|---|---|
  | `codes` | 55,809 of 57,753. This is every shape except an own `'category'` and an own `'every'` with an own marker. It comes from the default change (absent, invalid or inherited `codes`) plus the migration (unmarked own `'every'`). | 0 of 57,753. This holds by structure: the new read gives `'every'` only for an own `'every'` with an own marker, and the old read gave `'category'` only for an own `'category'`. The two sets are disjoint. | 1,863 on `category` (exactly the own `'category'` shapes). 81 on `every` (exactly an own `'every'` with an own marker). |
  | Returning the frozen default by reference | Now by reference: both switches off with an own `'category'`. | No longer by reference: both switches off with an own `'every'` and an own marker. | No production code compares against it by reference. The hook uses `overlaysEqual`. |
- **Mutations. The file was restored after each, and its checksum was checked.**
  - Builder without the marker: 7 rows go red, including the new "deliberate Every code survives a remount" row.
  - Marker ignored: 7 red.
  - Migration removed: 18 unit and hook rows red, plus the Calendar 1.0.38 row.
  - Marker read through inheritance: 3 red.
  - Loose `==` marker comparison: 4 red.
  - Default put back to `'every'`: 5 Calendar rows red. The rows that name Every code through a stored value stay green.
  - The new HELP guard goes red against HEAD's HELP.
- **Tests updated to name their mode:**
  - **`calendarOverlays.test.ts` and `useCalendarOverlays.test.tsx`:** the default, invalid-value and payload rows (payloads now carry `v`). The `setCodes` no-op row is now a no-op on `'category'`, and the migration tables were added.
  - **`Calendar.test.tsx`:**
    - QA-01 now asserts By category pressed. It was extended with the default's visible rows and caption.
    - The QA-47 gate row presses Every code, the option that is not pressed.
    - The gate-lift row now writes Every code with the marker.
    - The Media write payload now carries the marker.
    - The 1.0.38 stored row asserts By category rows, with no write.
    - The failed-write, both-on and legend rows mount with a saved, marked Every code.
    - The flip row presses Every code, then By category.
    - Three more rows would have gone vacuous under the new default, so each now presses Every code: QA-07, the Large view row and the popup QA-30 row.
  - **`calendarOverlaysOff.test.tsx`:** the round trip presses Every code, so the codes choice still moves. The fixture itself is unchanged and green.
  - **`calendarOverlaysPublishedClaims.test.ts`:** a new row holds "(the default)" to `DEFAULT_CALENDAR_OVERLAYS.codes`, read through `CODES_OPTIONS`, with exactly one "(the default)" in the passage.
- **HELP (paragraph sweep):**
  - The Breeding bullet no longer says it lists codes.
  - The codes bullet names By category as the default and describes Every code second.
  - The compact-form clause of the tile bullet is reordered.
  - Two more sentences would have become untrue under the new default: Large view ("The rows and counts live in Compact view, and every code in the day popup") and Screen readers ("with every breeding code spelled out whichever way the rows are drawn").
  - No em dash.
- **Bundle:** the built CSS is byte-identical to HEAD, with the same content hash, `index-CxCK3QGh.css`. The comparison was made against HEAD with all changes stashed.
- **Not touched:** `Calendar.tsx`, `globals.css`, the settings key, the option order, README.md, website/, PRIVACY_POLICY.md and appstore/. There is no version bump or CHANGELOG line here, because the Spool bundle stamps once at the flush.
- **Accepted (brief):** a 1.0.38/1.0.39 user who deliberately chose Every code sees By category once. One press restores it, and it is remembered from then on. The store screenshots show Every code pressed under the gate. That state is still reachable but is no longer the starting one, and recapturing is the user's call.

## Seeing Calendar Breeding opens By category locally

1. Open a terminal in the project folder (`snowraven`).

2. Start the backend:
   `cd backend && .venv/bin/uvicorn main:app --reload --port 1620`

3. Open a second terminal in the project folder and start the app:
   `cd frontend && npm run dev`

4. In your browser, go to:
   http://localhost:5173

5. Click the **Calendar** tab. Your eBird backup needs to be loaded in Settings.

6. What to look for: under **Overlays**, **By category** is highlighted, dimmed, beside the Breeding switch. Turn on **Breeding**: birded days show rows like "Conf 2" and "Poss 5", each with its circle, and the legend explains Conf, Prob and Poss. Press **Every code** and the tiles show codes like "NB 1" and "S 3". Reload the page and Every code is still selected.

## Convention Flags
- A read-time default migration for a stored value that can equal the previous default by explicit choice needs a version marker on every write from the new build. Without it, a deliberate choice of the old default is indistinguishable from the default written through, and it is migrated away on every launch. The marker is an own property compared by strict equality, its literal lives only in the owning module, and anything else counts as no marker. `calendarOverlays.ts` (`CALENDAR_OVERLAYS_VERSION`, `storedCalendarOverlays`) is the reference. This extends the v1.0.19 tab-order rule.
- A generated-corpus symmetric-difference test asserts its tallies from the axis sizes, not as restated counts. Adding a row to an axis then cannot leave a figure stale (`calendarOverlays.test.ts`).
