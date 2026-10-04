# App Store What's New: 1.0.49 (Spool bundle 20261003)

**APPROVED at the gate, 2026-10-03: text (b), word for word.** Route:
**1.0.48 rolled into 1.0.49** (shape 2 below), after the user's own device
check of build 1.0.49.1 ("app launches and looks good"). It was written to
record `99e3f9ff-4e90-4df0-88c4-a9fe13827b01` (705 characters), read back byte
for byte, and submitted as `f8156470-27cf-4865-9d55-c50e7495f4e6`
(`WAITING_FOR_REVIEW`). The read-backs are in `release-plan.md` beside this
file. The proposal below is kept as it was written.

## What the iPhone and iPad app gets in 1.0.49

Two of the bundle's five builds change something a user can notice, and both
reach the iOS app:

- **hotspot-links-retry-after-429 (Fixed).** When eBird is rate limiting just
  as the app asks which places are public hotspots, those names used to stay
  plain text for the rest of the session. The app now asks again, up to three
  more times over about seven minutes.
- **desktop-csp-frame-protection (Changed).** The app's one window runs under a
  content security policy on the Mac, Windows, iPhone and iPad. Nothing on
  screen changes; it is in the What's New because it is a real change to the
  shipped app, stated as plainly as the CHANGELOG line.

The third built change, **sortable-list-links-own-dispatch**, moves where a
link's address is handed to the system browser. Nothing looks different, so it
gets at most one optional sentence. Builds 4 (targets-focus-scroll-room,
declined, no code) and 5 (weather-capture-test-height, dev-only) get nothing.

## The App Store situation this text is for

Live query, 2026-10-03, read-only (`pipeline/spool-bundle-20261003/release-plan.md`
has the full listing):

- Record `0d823282` (1.0.47, carrying 1.0.46 by rollup) is `READY_FOR_SALE` on
  build 1.0.47.1; submission `503d3481` is `COMPLETE`.
- 1.0.48 holds VALID build 1.0.48.1 (delivery `c0484168`) and no record of its
  own, deferred behind 1.0.47 at its gate. The condition that deferral named
  ("once `0d823282` is `READY_FOR_SALE`") is now met.
- No record is in preparation or in review, so nothing would be withdrawn under
  either shape below.

So the App Store leg has two shapes, chosen after the device check:

1. **1.0.48 first, then 1.0.49.** Create 1.0.48's own record on build 1.0.48.1
   with its approved text (`pipeline/upload-origin-table-wrap-copy/whats-new.md`),
   and give 1.0.49 its own record with text (a) once that one is
   `READY_FOR_SALE` (or roll 1.0.48 into 1.0.49 later, while it is still
   `WAITING_FOR_REVIEW`).
2. **Roll 1.0.48 into 1.0.49.** One record on build 1.0.49.1 carrying both,
   text (b). Precedent: 1.0.39 into 1.0.40 and 1.0.41 into 1.0.42, each decided
   before the older version had a record, so nothing was withdrawn. 1.0.48 then
   ends with a VALID build and no record by rollup, which CLAUDE.md's App Store
   list must say in the same ship.

Screenshots: no change under either shape. The policy changes nothing on
screen, and hotspot names render as before once eBird answers. Neither set
shows the Targets tab or Settings (relevant to 1.0.48's text under shape 2).
Read every listing field back on the new record, promotional text included: it
has arrived empty three times (1.0.35, 1.0.42, 1.0.46).

## (a) 1.0.49 on its own record (517 characters)

> If eBird is limiting requests when the app looks up which of your places are public hotspots, it now asks eBird again, up to three more times over about seven minutes, so those place names become hotspot links as soon as eBird answers instead of staying plain text until you restart the app.
>
> The app now runs under a content security policy: its window runs only SnowRaven's own code, and loads map tiles, link icons and Macaulay Library players only from the services it already used. Nothing you see or do changes.

Optional sentence for the link dispatch, appended to the second paragraph if
wanted (587 characters with it):

> Links in a list you have just sorted always open the row you clicked.

## (b) 1.0.48 rolled into 1.0.49 (705 characters)

1.0.48's approved text, word for word, followed by (a):

> On the Targets tab, long species names now wrap within their row instead of making the table scroll sideways. In Settings, Appearance now says correctly where your color scheme is saved.
>
> If eBird is limiting requests when the app looks up which of your places are public hotspots, it now asks eBird again, up to three more times over about seven minutes, so those place names become hotspot links as soon as eBird answers instead of staying plain text until you restart the app.
>
> The app now runs under a content security policy: its window runs only SnowRaven's own code, and loads map tiles, link icons and Macaulay Library players only from the services it already used. Nothing you see or do changes.

## Checks on the wording

- American spelling; no em dashes (checked by script); no counts beyond the
  retry schedule, which is the behavior itself and matches the CHANGELOG line.
- "only from the services it already used" is the CHANGELOG's own claim and
  names no host. It does not say the app "cannot send data anywhere else",
  which would be false: requests made over native networking are outside the
  page's policy (`pipeline/desktop-csp-frame-protection/changelog-line.md`).
- "until you restart the app" describes the iOS app's old behavior; the
  CHANGELOG's fuller "saved your eBird key or backup again, or restarted" is
  shortened for the store, and the third-try limit is left to Help.
- No Review Notes change is needed: `appstore/REVIEW_NOTES.md` mentions the
  nearby-hotspot lookups and the Macaulay Library embeds only in general terms
  (a keyed live lookup; the user's own media, a Settings toggle, a placeholder
  with a link out), and none of that changes. It says nothing about how links
  open or about the page's policy.
