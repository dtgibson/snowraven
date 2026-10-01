# Decisions: Widget measure-from choice

## Design pass (Stage 2, 2026-10-01)

### Deviation from `pipeline/design-system.md`: the widget footer caption rule

**The pattern as written.** The home-screen widget pattern describes the
muted footer as `Updated 9:41 AM`, "preceded by `From your default location`,
`Offline` or `eBird busy`", and the shipped v1.0.36 rule (WidgetPresentation,
S7) shows "From your default location" only when the Default Location was a
*fallback* for a device position the widget could not get.

**The deviation.** The caption now shows **whenever the list was measured
from the Default Location, chosen or fallback**, with the same string. The
Designer proposed it and asked the user directly; the user chose "Show it
whenever measured from Default Location" on 2026-10-01.

**Why.** A widget never shows its own settings on the tile, so on a home
screen that mixes a My location widget and a Default Location widget the
caption is the only visible difference between two tiles that otherwise look
the same. The sentence is true in both cases. Keeping one string rather than
two keeps `widgetsPublishedClaims.test.ts` and HELP's quoted caption intact.
Cost accepted: a birder who deliberately chose Default Location sees a
two-word muted footer they already know; on small it takes a footer line, as
the fallback case already does today.

**What it does not change.** My location rows and footers are byte-identical
to today, the fallback case included. Alerts' status caption ("From your
fixed place") keeps its own fallback-only rule, because there the setting is
visible beside the caption in Settings.

**Not written to `pipeline/design-system.md`** here; the Chronicler updates
the home-screen widget pattern at close with this sentence.

### Naming: "Default Location", not "Fixed place"

The second value is named **Default Location** because it *is* the saved
Default Location and nothing else (no per-widget place, no search). Alerts'
"Fixed place" can diverge from the Default Location once a place is hand-set,
so borrowing the name would promise a capability the widget does not have.
The pair "My location" / "Default Location" already exists in the Targets
tab's chooser, so no new vocabulary is introduced.

### The new sentence names the way back by the picker's own word

"Set a Default Location in SnowRaven's Settings, or switch this widget to My
location." mirrors the existing no-location sentence's shape (the one thing
in the way, two ways out) and spells the value as the Edit Widget picker
does, so a birder can find it. It is shown only on a widget set to Default
Location with none saved, and makes no request.

### The landing line reuses the alert link's form

"Finding {name}…" with no "near you" is `landingText(..., fromPoint = true)`,
already shipped for alert links. No new copy; the view-tap line "Finding
nearby lifers…" stays, being true from either point.

### Lint note, justified

`weft-design-lint` reports one `note` on the mockup: the landing chip's
continuous 900 ms spinner rotation. It is the shipped Map Explorer landing
chip's loading indicator, not a transition, and is static under
`prefers-reduced-motion`. Kept.

## Build (Stage 3, The Engineer, 2026-10-01)

### The cache: a second area, one file per Measure from choice

**Chosen:** keep a second cache area. My location keeps `widgets/cache.json`
exactly as shipped (same writer, same shape, same `cellSource` rule, and the
only file Alerts reads). Default Location gets its own document of the SAME
shape, bounds, validator and temp-then-rename writer,
`widgets/cache-default-location.json` (`AppGroup.cacheFileName(for:)`).

**Why not accept the refetch.** With one area, two widgets on different
choices invalidate each other on every refresh, so the bound degrades to "one
request per widget refresh": four mixed widgets refreshing in one quarter hour
make four requests, two of them for the same area. That cannot honestly be
stated as "one per area", and it is the shape CLAUDE.md's native-check
contract warns about (a native path whose request count is not bounded per
interval owes spacing of its own). With two areas, widgets on the same choice
make at most one request per 15 minutes between them, and a mixed home screen
at most one per area, so at most two. `testAMixedHomeScreenMakesAtMostOneRequestPerAreaEvery15Minutes`
measures it over two simulated hours.

**Why a second file and not a second area inside `cache.json`.** Alerts reads
`cache.json`'s top-level `cell` and `cellSource` and must not change (brief:
Alerts code is out of scope). A nested second area would either move My
location's fields or need a top-level shape for a home screen with only
Default Location widgets. A second file leaves `cache.json` byte-identical in
shape and meaning, and the Default Location area is invisible to Alerts by
construction, on top of carrying `cellSource: default-location` as the brief
requires. It is not new data: the same document type the extension already
writes, keyed by the choice the widget already has. The privacy retention
sentence for it is in `held-copy.md` (2).

**The 429 hold is the key's, not the area's.** Before a request, the engine
also honors a running 429 backoff recorded in the OTHER area for the same key
fingerprint (`otherAreaHold`), and records it in its own area as it does its
own hold. Without this, a 429 on one area would leave the other free to ask a
rate-limited key again inside the hold. The other area is read only at the
point a request would be made and released before the fetch, so it is never
held beside a body (NFR-02); a hold under a different key fingerprint is
ignored, as a key change discards the cache today (FR-25).
`testA429InOneAreaHoldsTheOther`.

**The hold persists even where the area has no document yet (security
review L1).** As first built, `failed` wrote the backoff only into an existing
document, so a 429 on an area's first fetch (most likely the Default Location
area the first time a widget is switched to it, or `cache.json` on its first
fetch or after a key change) was persisted nowhere and the other area never
saw it. A 429 with no usable document now writes a HOLD-ONLY document
(`WidgetCache.holdOnly`): the backoff, the refresh's cell and `cellSource`,
the key fingerprint, no records, and `fetchedAt` fixed at the epoch
(`holdOnlyFetchedAt`). The engine reads that time as no fetch at all, so the
widget shows exactly what it shows today for that failure ("Could not reach
eBird.", no "Last updated", never a list), and it is decades outside Alerts'
24-hour window, so Alerts' My location never takes its cell as a device
position. A later good fetch replaces it. One side effect, accepted: after a
key change, a 429 on the new key's first fetch replaces the old key's
`cache.json` with a hold-only one, so Alerts loses that old document's
device cell (at most 24 hours old) one refresh earlier than it otherwise
would, and falls back as it does with no cell.
`testA429InAnEmptyDefaultLocationAreaHoldsMyLocation`,
`testA429InAnEmptyMyLocationAreaHoldsDefaultLocation`,
`testAHoldOnlyDocumentIsNeverAListNorADevicePosition`.

**Accepted cost:** a My location widget that falls back to the Default
Location (location off) and a Default Location widget search the same cell
from two areas, so that one place can be asked twice per 15 minutes. Still
within "at most one for each, so at most two", which is the sentence HELP
states. Sharing a fresh cell across areas would make it one, but would let a
My location widget be served without refreshing `cache.json`, whose fetch
time Alerts reads as the device position's age, so it was not taken.

### The link marker: `&from=default`, last, fixed literal

- Appended LAST, after the view link and any bird suffix, whenever the model's
  `usedDefaultLocation` is true (a chosen Default Location, or My location's
  fallback, per the brief and the user's caption decision). One rule drives
  the caption and the marker, so the tile and the tap cannot disagree.
- The parser strips it with `endsWith` (no pattern) after the alert form and
  before the cut, so steps 2 to 4 see exactly the shipped grammar. Anywhere
  else, or spelled otherwise, it is stray text and the link is rejected whole
  (eight rows added to `LINK_REJECTED`); on an alert link it is rejected, and
  the TS builder refuses it.
- Compatibility: a link without the marker lands exactly as today (an older
  timeline entry tapped after the update). The reverse skew (a marked link
  reaching an older app) degrades a bird link to its view link, and rejects a
  marked view link whole, so the app opens without a landing. That direction
  is not reachable in practice: the extension ships inside the app bundle, so a
  marked link only ever reaches an app at least as new.
- Longest widget link: 101 characters (was 88), under the 128 bound. Rust's
  filter (scheme and 512 bytes) is unchanged.
- State sentences keep the view link without the marker, except where the
  model already measured from the Default Location (S8 and S11 after a
  Default Location refresh), where the tap then searches the same place.

### The landing: the saved Default Location, else today's landing

Map Explorer reads `map-defaults` through `readDefaultLocation` (the
hand-over's own shape rule, so the map's point is the widget's point) and
searches from it with no location read, no device dot, the widget's 25 miles,
session radius only. No Default Location saved, an out-of-range one, or a read
that fails: the link lands as a link without the marker always has (Use my
location). That is the house degrade rule (a link the app cannot honor lands
as the view link), and the tap is an in-use action, so a location read there
is the app's ordinary behavior, not the widget's. The landing line takes the
alert link's `fromPoint` form ("Finding {name}…", no "near you") whenever the
marker is present.

### S13 and the tap

S13 (Default Location chosen, none saved) is a state of its own with the
Designer's sentence, no request and no location read. Its tap opens the view
link with no marker, like every state sentence, so it lands as today.

### Not done here

- **The previous-build widget in the simulator** (brief, "What done looks
  like"). A widget cannot be placed on a simulator Home Screen from the command
  line, and the run is hands-off, so this was not driven. What makes it hold:
  a configuration stored before the parameter existed has no value for it, and
  App Intents supplies the declared default, `.myLocation`, which maps to the
  engine's unchanged path (`testMyLocationIsTheShippedPath` pins that the
  default and an explicit My location give the same model, rows equal to the
  fixture, no caption and no marker). Left for the Tester, or the user's
  device pass, as a named check.

### Lint note, justified (build)

`weft-design-lint check frontend/src/components/MapExplorer.tsx` reports one
`note` (reduced-motion: motion present, no fallback in the file). The HEAD
version of the file reports the same note: the fallback is the global
`@media (prefers-reduced-motion: reduce)` block in `globals.css`, and this
change adds no motion. Kept.

## Help wording correction (Guide, after QA, 2026-10-01)

The Tester found that "Tapping a widget" in `docs/HELP.md` still said the loading map "finds your location", which is untrue for a Default Location tap (it reads no location). Changed to "finds where to search from". In-app Help, so no approval stop; `widgetsPublishedClaims.test.ts` still passes (16/16).

## Deploy gate (2026-10-01)

- **Version 1.0.44, not 1.0.43.** While this run was in its later stages, the parallel `alerts-inbox-mark-read` run released 1.0.43 (desktop, Windows, website, and TestFlight build 1.0.43.1). This build was rebased onto that release (`origin/main` `449b462`, then `7b8983b`, a docs-only commit recording the 1.0.43 rollup). The only file both changed was `docs/HELP.md`, in different paragraphs, so the merge was clean.
- **App Store: DEFERRED behind the record in review, by the user's choice.** At the gate, 1.0.42's record `73b6e8ac` was `WAITING_FOR_REVIEW` (submission `ffe1ed1d`). The user chose to defer 1.0.44 behind it, create or withdraw no record, and leave 1.0.43's disposition to its own run. Before this build was pushed, that run rolled 1.0.42 into 1.0.43: the same record `73b6e8ac` is now 1.0.43 on build 1.0.43.1, resubmitted as `dc1ce5dd` (`WAITING_FOR_REVIEW`). The deferral is unchanged in substance. 1.0.44 ships to TestFlight only and gets its OWN record once `73b6e8ac` (1.0.43, carrying 1.0.42) is `READY_FOR_SALE` and after the user's device check of build 1.0.44.1, with the approved What's New (held-copy.md section 5).
- **Published copy approved in full** ("approve all of it"), after the user read it rendered before and after: held copy (1) and (2) in `PRIVACY_POLICY.md` and `website/privacy.html` (kept identical), (3) the `appstore/LISTING.md` widgets privacy-label bullet, and the 1.0.44 What's New line. Applying (2) closes the security review's L3 deploy-gate condition. The user directed no other change to `README.md` or `website/` beyond the version stamp.
- **Screenshots: none recaptured.** No App Store or website screenshot shows a widget, the Edit Widget sheet or a widget-tap landing.
- **Cosmetic:** the Auditor's over-width comment line in `RefreshEngine.swift`'s ETIQUETTE paragraph was rewrapped to 78 columns. The words are unchanged.
