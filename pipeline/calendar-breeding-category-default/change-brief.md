# Change Brief — calendar-breeding-category-default

## What is changing
With the Calendar's Breeding overlay on, day tiles start in **By category** instead of **Every code**. The seed (user, verbatim): "On the calendar tab, when the breeding code overlay is turned on, have the "by category" be the default instead of every code". The core change is `DEFAULT_CALENDAR_OVERLAYS.codes` in `frontend/src/lib/calendarOverlays.ts`, from `'every'` to `'category'`, plus the read-time migration below. Media and Breeding still default to off. Unchanged: both renderings, the Breeding rows control and its gate, the option order (Every code, By category), the popup, accessible names and Large view.

**Reading chosen:** "default" means what the control shows when the user has not chosen. **Rejected:** forcing By category every time Breeding is switched on. That would override a saved Every code, and it contradicts D4-10 ("so the user can choose") and HELP's "it keeps whatever you picked last for when Breeding comes back on".

## Why now
The user saved this idea after using the 1.0.38 overlays. The preference is device-local and never synced. Without a read-time migration the new default would reach fresh installs only, never the devices the user already has. That is the reason v1.0.19 gave for migrating the tab order.

## Persistence and migration (the crux)
- **It persists, so CLAUDE.md's shipped-default rule applies in full.** There is one `calendarOverlays` value, stored through the storage seam (`lib/useCalendarOverlays.ts`). It is written whole, all three fields, on any change of any control, and never on hydration. Both transports store it verbatim (web/Pi kv, `TauriStorage`).
- **Which saved documents carry no codes preference.** Every shipped document (1.0.38 and 1.0.39) has all three fields. `codes` shipped in the first commit, `ae47422`, tag v1.0.38, so no two-field document ever shipped. A Media or Breeding flip writes `codes` too. So a saved `'every'` is almost always the old default written through, and it looks exactly like a deliberate By category, then Every code round trip. A saved `'category'` can only come from a deliberate press. **Faithful behavior:** a saved `'every'` from those builds reads as no preference and becomes `'category'`. A saved `'category'` is kept.
- **Per field, not whole document.** Only `codes`'s default changed. Migrating only documents equal to `{false, false, 'every'}` would miss `{…, breeding: true, codes: 'every'}`, which is where the requester's own devices most likely sit.
- **A marker is load-bearing.** Without one, each launch would re-read a user's deliberate Every code as no preference. Every code could then never be remembered, which breaks FR-03 and HELP's guarded "**remembered across launches**". **Rule:** every write from this build on carries a version marker. `v: 2` is suggested; the Engineer names it, and its literal lives only in `calendarOverlays.ts`. The reads are:
  - no marker plus a strictly own `codes: 'every'`: `'category'`
  - marker plus `'every'`: `'every'`
  - a marker that is not exactly the own value: treated as no marker
  - invalid or absent `codes`: the new default.

  Under this build, `'every'` is written only by pressing Every code, because hydration writes nothing and a flip before hydration starts from the new default.
- **The rule's four parts:**
  1. Keep the previous default as a named constant (e.g. `PREVIOUS_DEFAULT_CODES_MODE = 'every'`), so the check is one equality.
  2. Run the check after the existing strict, own-property validation.
  3. Read `media` and `breeding` exactly as today.
  4. Write nothing back. A migrated value is saved, with the marker, only on the user's next change.

  Exactly one generation migrates, and no older one exists. Rollback is safe: 1.0.39 ignores the unknown marker and reads `codes` as stored.
- **Accepted cost:** a 1.0.38/1.0.39 user who deliberately chose Every code sees By category once after updating. One press restores it, and it is remembered from then on. The population is two days old.

## User-facing impact
- **Fresh installs, and devices with no saved value:** turning Breeding on shows By category rows (Conf / Prob / Poss, each with its circle and a species count). The legend caption reads "one row per category that day · …", with entries "Conf · Confirmed" and so on. While Breeding is off, the dimmed control shows By category pressed.
- **A saved 1.0.38/1.0.39 value with Every code:** shows By category after updating. **A saved By category:** unchanged.
- **Compact tiles:** a By category tile turns compact at a wider cell than an Every code tile (2.6, 3 or 3.4em by count digits, against 2.4em). So at a given width, more tiles show the compact form. That state was designed and measured (calendar-overlays E5-12); it is not new.
- **Unchanged:** the popup and accessible names (always every code), the Large-view marks, and Media.

## Design pass
Not needed. No visual change. Every state the new default shows already exists and was designed in D4-10 and D4-11: the By category rich and compact tiles, its legend, and the control pressed under the gate. Those states were swept in Chromium and WebKit at 100 to 200% text, in both orders (E5-12). Only the starting value changes.

## Decisions touched
- **Modified:** DECISIONS.md "Calendar overlays: two opt-in layers …" (2026-09-27, v1.0.38). "All three default to off / Every code" becomes off / By category. The rest of the entry holds.
- **Reversed in the pipeline record** (do not edit the shipped files; the Chronicler logs the reversal): calendar-overlays `decisions.md` D4-10, "Default and persistence: default 'Every code' … any other value reads as 'every'"; PRD FR-02, FR-04, QA-02, QA-04 and QA-47's "leave Every code pressed"; design-spec's "Every code (default)".
- **Applied, not changed:** DECISIONS.md v1.0.19, "a default's migration reaches only the default it replaced", and its CLAUDE.md bullet. The marker is the reusable addition, for a stored value that can equal the previous default by explicit choice. Worth recording in the Chronicler's entry.

## Scope
**Changes:**
- **`lib/calendarOverlays.ts`:** the default, the named previous-default constant, the marker, one exported builder for the stored document, `normalizeCalendarOverlays` per the rules above, and doc comments. It stays under `security.md`'s untrusted-input rules: own properties only, strict equality.
- **`lib/useCalendarOverlays.ts`:** `commit` writes through the builder. Hydration stays a pure read.
- **`lib/calendarOverlays.test.ts` and `lib/useCalendarOverlays.test.tsx`:**
  - Update the rows that encode the old default: the default rows, the invalid-value rows (now `'category'`), the exact `setSetting` payloads (now with the marker), and the `setCodes` no-op row (now a no-op on `'category'`).
  - Add a migration table. No marker, `'every'`: `'category'`, other fields kept. No marker, `{false, false, 'every'}`: the frozen default by reference. `'category'`, with or without a marker: kept. Marker, `'every'`: kept. Malformed or inherited marker: treated as no marker. Every hydration row asserts zero writes.
  - Add the non-vacuity row: press Every code, remount, still Every code. It must go red without the marker.
  - Fill a both-directions table for the old and new `codes` predicates by measurement (`testing.md`).
- **`components/Calendar.test.tsx`:** some rows turn Breeding on and assert code rows or the every-code caption without choosing a mode:
  - QA-01's pressed option
  - QA-47's gated row and its "pressing By category writes" row
  - the failed-write row's `NB1, S3`
  - the both-on row
  - the legend row
  - the flip row

  Each should name its mode explicitly, through a stored value or a press, rather than silently changing its expectations.
- **`lib/calendarOverlaysPublishedClaims.test.ts`:** add a row holding HELP's "(the default)" to `DEFAULT_CALENDAR_OVERLAYS.codes`, read through `CODES_OPTIONS`.
- **`docs/HELP.md`, Overlays passage, swept at paragraph scope:**
  - The codes bullet names **By category** as the default.
  - The Breeding bullet ("lists the eBird breeding codes … The number beside a code …") describes the Every code rendering as what Breeding does, so reword it to be true under the new default.
  - Reorder the tile bullet's compact-form clause to match.
  - No em dash.
- **CHANGELOG:** a "Changed" line at the bundle's stamp, per this spin's convention.

**Does not change:** `Calendar.tsx`, `globals.css`, the settings key, the option order, the popup, accessible names, `clearDerived.ts`, and `calendarOverlaysOff.fixture.json` (the controls are outside it; run its suite to confirm).

## Published surfaces
None becomes inaccurate, so there is no held patch:
- **README, website, App Store listing:** the Calendar sections of README.md and `website/index.html`, and the Calendar bullet in `appstore/LISTING.md`, never mention the overlays.
- **Privacy policy:** PRIVACY_POLICY.md and `website/privacy.html` say nothing about the overlays. The key is the same, the preference stays device-local, and no request is added.
- **Screenshots:** `appstore/screenshots/ipad-13/04-calendar.png` shows the Overlays row with Every code pressed under the gate (checked). The iPhone `04-calendar.png` and `website/assets/shots/calendar.webp` were captured for the same row and likely match (not checked). They now show a reachable state that is no longer the starting one, which is not a false claim. Recapturing is the user's call, goes through approval, and is outside this build.

## What done looks like
- A fresh state with Breeding on shows By category rows and caption. A 1.0.38-shaped saved `{ media, breeding: true, codes: 'every' }` hydrates to By category with zero writes. Pressing Every code, then remounting, keeps Every code.
- The `calendarOverlays`, `useCalendarOverlays`, `Calendar`, `calendarOverlaysOff` and `calendarOverlaysPublishedClaims` suites are green, and the migration table and round-trip row are non-vacuous. `npm run typecheck` passes.
- HELP names By category as the default, and a guard holds that sentence to the code.
