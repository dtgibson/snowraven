# Held copy: widget-measure-from-choice

**APPROVED 2026-10-01 at the deploy gate ("approve all of it"), after the user
read every item rendered before and after on the tailnet review page.**
Sections 1, 2 and 3 were applied word for word in the 1.0.44 release, with
`PRIVACY_POLICY.md` and `website/privacy.html` kept identical. Section 5's
What's New line is approved as written and is NOT yet in App Store Connect:
the user chose to DEFER 1.0.44 behind 1.0.42 (which is `WAITING_FOR_REVIEW`),
so the line goes into 1.0.44's own version record once 1.0.42 is
`READY_FOR_SALE` and after the user's device check of build 1.0.44.1. The
user also directed no other change to `README.md` or `website/`: only the
version stamp in `website/index.html` and the approved `privacy.html` wording.

The text below is the record of what was proposed and approved. Before the
gate it read: NOT WRITTEN. Each edit below needs the user's express yes before
it lands (CLAUDE.md, "Published copy needs the user's approval first").

**No guard test waits on this copy.** Every phrase `widgetsPublishedClaims.test.ts`
pins in these files is kept word for word below, so the suite is green with or
without the patch, and stays green after it.

---

## 1. Your Location: the widget's location read

Files: `PRIVACY_POLICY.md` (section "Your Location", the paragraph beginning
"On iPhone and iPad, the first time you tap") and `website/privacy.html` (the
same paragraph, the `<p>` at line 154). The two sentences are identical in both
files (the paragraph's only HTML entities, `&rarr;` and `&amp;`, sit elsewhere
in it), so the same insertion applies to both.

**Why:** "the widget also reads your location each time iOS refreshes it" is
now true of a widget on My location only. A widget set to Default Location
reads no location and sends the saved point.

**Before:**

> It sends those coordinates to eBird with your own eBird key to find the nearest recent reports, the same kind of request the app's Nearby Lifers view makes, and nothing reaches the developer. The widget never asks for permission itself and never asks for Always access.

**After** (one sentence inserted, the Designer's wording):

> It sends those coordinates to eBird with your own eBird key to find the nearest recent reports, the same kind of request the app's Nearby Lifers view makes, and nothing reaches the developer. A widget you set to measure from your Default Location reads no location and sends that saved point instead. The widget never asks for permission itself and never asks for Always access.

The Alerts sentence later in the same paragraph needs no change: "the most
recent position ... that a widget refresh read from your device" already
excludes a widget set to Default Location, which reads nothing from the
device, and the code keeps it so (that widget writes its own cache file, which
Alerts never reads).

## 2. iOS App: what the widgets keep

Files: `PRIVACY_POLICY.md` (section "iOS App", the paragraph beginning "For its
home-screen widgets") and `website/privacy.html` (the same paragraph, the `<p>`
at line 167; byte-identical to the Markdown).

**Why:** the widgets now keep one saved result per Measure from choice
(`widgets/cache.json` for My location, `widgets/cache-default-location.json`
for Default Location). security.md: a published retention sentence describes
what is on disk.

**Before:**

> Beside the document, the widgets keep what their latest refresh fetched: the nearby eBird reports it found, the area it searched, rounded to about a kilometer, and a short fingerprint of your eBird key (not the key itself), which tells them when the key has changed. The next successful refresh replaces them.

**After:**

> Beside the document, the widgets keep what their latest refresh fetched: the nearby eBird reports it found, the area it searched, rounded to about a kilometer, and a short fingerprint of your eBird key (not the key itself), which tells them when the key has changed. They keep one such set for widgets that measure from your location and, once a widget measures from your Default Location, a second for that; a successful refresh replaces only the set for that widget's setting.

(Corrected after the security review, L3: a widget on My location that falls back to the Default Location still writes the My location set, so "the place it measured from" was inaccurate.)

The paragraph's next sentence ("Like the rest of the app's data, both are
included in device backups ... and neither is ever synced through iCloud
Sync.") stays as it is and stays true of both sets.

## 3. App Store listing record: the privacy-label rationale, widgets bullet

File: `appstore/LISTING.md`, "Compliance record" → "Privacy nutrition label",
the bullet "**Home-screen widgets (v1.0.36):**". This is a repo-side record,
not text pasted into App Store Connect.

**Before:**

```
  Screen. Each refresh, about every 30 minutes and as often as iOS allows,
  sends the device's coordinates (or, with location off, the saved Default
  Location) to eBird with the user's own key. This is the same nearby-sightings
```

**After** (the Designer's wording, rewrapped):

```
  Screen. Each refresh, about every 30 minutes and as often as iOS allows,
  sends the device's coordinates (or the saved Default Location, when
  location is off or the widget is set to measure from it) to eBird with the
  user's own key. This is the same nearby-sightings
```

(The rest of the bullet, from "request the app's Nearby Lifers view makes",
continues unchanged; reflow the paragraph's remaining lines to the file's
width when applying.)

## 4. Checked and needing no change

- `appstore/REVIEW_NOTES.md`, "ABOUT THE HOME-SCREEN WIDGETS": "They use
  location only under the app's When In Use permission, never prompt on their
  own, and send coordinates only to eBird, with the user's own key." Still true
  of both choices. No change, so the 3,898-character notes field is untouched.
- `README.md`, `website/index.html` and the App Store Description carry no
  widget sentence. Untouched.
- `ACCESSIBILITY.md`: "then any note about where it measured from" already
  covers the caption on a chosen Default Location. No change (not a gated
  surface, listed for completeness).

## 5. What's New, at ship

**Approved 2026-10-01 for 1.0.44, word for word (155 characters). Not yet
entered in App Store Connect: 1.0.44 is deferred behind 1.0.42 by the user's
choice at the deploy gate.** When 1.0.44's own record is created, this line is
its What's New; if that record also carries 1.0.43 (VALID build 1.0.43.1,
with no record of its own as of 2026-10-01), 1.0.43's approved line comes
first, each word for word. 1.0.43's App Store disposition belongs to its own run.

> Home-screen widgets can now measure from your Default Location instead of where you are: touch and hold a widget, choose Edit Widget, and set Measure from.
