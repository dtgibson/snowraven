# Share Format Toggles

## What this does

The Settings › Sharing "Copying a location" preference becomes **three
independent switches** (Coordinates, Google Maps link, Apple Maps link) in place
of the v0.5.80 two-way radio group, so all eight combinations are reachable
instead of two. The copied block keeps its fixed coordinates / Google / Apple
order whichever parts are on, with no blank line where one is elided and no
trailing newline.

The eight button labels and eight mode lines are **generated**, not written. One
ordered `SHARE_PARTS` table in `lib/shareLocation.ts` is the single source for
the payload lines, the switch labels, their accessible names, the popup button
and the manifest sentence. Adding a fourth destination is one row and no new
copy, which the suite asserts by actually adding one.

All three off is permitted, and is a structural state rather than a ninth
string: in Settings the example block is replaced by a sentence, and in the popup
the copy control is replaced by a sentence. No control that looks pressable can
put an empty string on the clipboard.

## How to test

1. Open **Settings › Sharing › Copying a location**. Three switches, all on.
   The example shows the exact three-line block, captioned "Three lines:
   coordinates, Google Maps link, Apple Maps link."
2. Turn **Google Maps link** off. The example loses that line with no gap left
   behind, and the caption becomes "Two lines: coordinates, Apple Maps link."
3. Turn **Coordinates** off too. One line remains; the caption reads "One line:
   Apple Maps link."
4. Turn the last one off. The example block is replaced by "Nothing to copy. The
   share pin will still show the coordinates on the map."
5. Go to **Map Explorer › My Sightings**, right-click the map to drop a share
   pin. With everything off the popup still shows the coordinate on screen, and
   where the copy button was there is "Nothing is selected to copy. Choose what
   to copy in Settings under Sharing."
6. Turn switches back on and re-open the popup (or leave it open: a change in
   Settings reaches an already-open popup). Check the button label tracks the
   selection, in particular that both links on collapses to **"Copy coordinates
   and map links"** while exactly one link on names that provider.
7. Copy and paste into a text editor to confirm the block matches the Settings
   example byte for byte.

## Notes for reviewer

**The generating rule is the point of the change.** `shareCopyLabel` and
`shareModeLine` in `frontend/src/lib/shareLocation.ts` produce every string from
the table. Two traps the design pass had already hit and fixed are preserved
deliberately and each has a test that fails without it:

- `label` and `noun` are **separate columns**. The tempting one-column version
  plus `.toLowerCase()` reads correctly on today's three and silently produces
  "Bing maps link" on a fourth.
- `countWord` runs to six, so a fourth destination says "Four lines:" rather
  than mixing a digit into a sentence of word forms.

The button is allowed to collapse a complete family to "map links" (37
characters, which is what keeps it inside the 224px compact popup; the
enumerated serial list is 55 and wraps to three lines). That collapse is only
safe because the mode line directly below always spells out which links, so the
two functions are not redundant.

**Migration is the defect risk and is where to look hardest.** The storage key
`shareCopyMode` is unchanged and the value widened from a string literal to
`{coords, google, apple}`. `normalizeShareCopySelection` branches on **both**
legacy literals explicitly: `'coords-only'` → coordinates on, both links off;
`'coords-and-links'` → all three on. Letting `'coords-only'` fall through to the
default would silently hand links back to someone who deliberately turned them
off. Objects are read per key so a partial write keeps what it recorded, and
**all-false round-trips** rather than being treated as malformed.

**Verified by mutation, not by assertion.** Ten wrong implementations were
introduced one at a time and the suite rejected every one: dropping the
`coords-only` legacy branch (2 failures), lowercasing the label for the noun
(10), truncating `countWord` to three (1), never collapsing a complete family
(4), a fixed three-slot payload template that leaves a blank line (13), a
`getSnapshot` that returns a fresh object (13), an all-off disabled button
instead of the sentence (3), dropping the live region's keyed child (1),
announcing the payload instead of the manifest (13), and rendering the empty
payload into the `<pre>` instead of the sentence (5).

**One audit fix (Low).** `normalizeShareCopySelection`'s string branch used a
bare `LEGACY[raw]` index on an ordinary object literal, so it inherited
`Object.prototype`: the eight strings `'constructor'`, `'__proto__'`,
`'toString'`, `'valueOf'`, `'hasOwnProperty'`, `'isPrototypeOf'`,
`'toLocaleString'` and `'propertyIsEnumerable'` each resolved to a truthy
inherited member, took the legacy arm, and spread to `{}` (every switch off)
instead of the default FR-35 promises. It failed **closed** and polluted
nothing, so it was never a crash or an escalation; it was the stated behaviour
and the real behaviour disagreeing. The lookup is now allowlist driven via
`Object.hasOwn`, the same property that already made the object branch inert.
All eight strings are in the test corpus, plus a pollution probe over
`__proto__`/`constructor` as both a value and a stored key.

**Two incidental fixes worth a glance:**

- `Settings.test.tsx` used a bare `getByRole('status')`, which was unambiguous
  only by accident. Settings hosts several live regions and the Sharing row adds
  another, so that query now targets the region carrying the message.
- `toggleShareCopyPart` returns the resulting selection, so the Settings row
  announces from the flip that took effect rather than recomputing it against
  its own rendered copy.

**Unchanged on purpose:** `SharePin.tsx`, all five host maps, `lib/storage.ts`,
the backend, `RadioGroup` (three other Settings rows use it), `PRIVACY_POLICY.md`
and `ACCESSIBILITY.md` (both re-checked: no new host, no new request, no
coordinate persisted, and the only share-adjacent accessibility sentence is
about the search-center pin's pointer-only gesture, which is untouched). The
example-to-sentence swap is animated at **zero** deliberately: the safety
argument for permitting all three off is that the consequence appears at the
instant the last switch flips.

**No version bump, no `CHANGELOG.md` entry, no commit** — build 4 of a 5-build
bundled release, which takes one bump and one combined entry at the end.

## Verification

- `npm run typecheck` clean.
- Full suite **1848/1848 across 140 files**, including `entryChunk.test.ts`
  unchanged and green (both lib modules stay map-free and on App's static
  graph) and `helpToc.test.ts`.
- `npm run build` clean.
- `eslint` clean on every changed file.
- `weft-design-lint check frontend/src`: **zero warn, zero error**. The advisory
  `reduced-motion` notes are covered by the global
  `@media (prefers-reduced-motion: reduce)` block in `globals.css` (line 1821),
  whose `!important` universal rules beat the inline transitions; the lint's
  per-file heuristic cannot see it. The remaining notes are on map files this
  change does not touch.

## Docs updated in the same change

`docs/HELP.md` (both the Map Explorer copy passage and the Settings › Sharing
section), `README.md` (the share-a-location bullet and the Settings bullet), and
`website/index.html`. Each rewritten sentence was checked against the shipped
code rather than against the design intent, including that the popup's
coordinate readout really does carry `user-select: text` before claiming it can
be selected by hand.
