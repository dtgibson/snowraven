# App Store What's New: 1.0.51 (Spool bundle 20261004)

**APPROVED by the user, 2026-10-04, relayed by the coordinator: text (a),
word for word.** Route: **1.0.51 on its own record** on build 1.0.51.1, after
the user's own device check of that build (it opens; Map Explorer and
Statistics work). Written by script to record
`c98d6dc5-274f-412c-851f-15359fd06f43` (674 characters), read back byte for
byte, and submitted as `ba562487-985f-4aaf-8cbe-b455101692ba`
(`WAITING_FOR_REVIEW`). 1.0.52 follows on its own record, in its own
session's store leg. The read-backs are in `deployment.md` section 8. The
draft below is kept as it was written, including the route discussion from
before the decision.

## What the iPhone and iPad app gets in 1.0.51

All five of the bundle's builds reach the iOS app, and three of them change
something a user could notice:

- **map-recency-dst-colors (Fixed).** Media Targets and Nearby Lifers reports
  on the Map Explorer take the right recency color in the weeks after clocks
  spring forward; the screen-reader tier labels name the same day ranges as
  the popups and Help.
- **icloud-remove-all-continues (Fixed).** Remove synced files from iCloud no
  longer stops at the first file iCloud refuses; Copy iCloud details names any
  file that stayed.
- **breeding-code-lookup-hasown (Fixed).** An unrecognized breeding code in
  the List Comparer's Checklists mode always shows as the code itself. eBird
  does not send the codes that misbehaved, so this is one clause.

The other two tighten the app's security policies, change nothing on screen,
and are stated plainly because they are real changes to the shipped app:

- **http-permit-narrowed (Changed).** The app's permission to reach web
  services admits only the services it already used, at the addresses it calls.
- **worker-csp (Changed).** The content security policy now also covers the
  scripts the app runs in the background, such as the one that draws the map.

## The App Store situation this text is for

**The situation changed during this ship.** At the start (2026-10-04, about
06:30 Pacific) record `99e3f9ff` was 1.0.50, `WAITING_FOR_REVIEW` (review
submission `7118f6a7`). At the last live query (16:2x Pacific the same day,
read-only; `deployment.md` section 6 has the listing):

- Record `99e3f9ff` is **1.0.50, `READY_FOR_SALE`** on build 1.0.50.1. It
  was approved and released, so rolling 1.0.50 into 1.0.51 is no longer
  possible, and nothing is in review.
- Build **1.0.51.1** (`38d5d395`) is `VALID`, with no version record.
- Build **1.0.52.1** (`b3410c78`) is also `VALID`, with no version record.
  Another session (the species-first-of-year build) shipped 1.0.52 on top of
  this release while it was finishing; its tree contains every change in
  1.0.51 (both 1.0.51 commits are ancestors of its release commit), and its
  deploy plan left the App Store leg for the user to decide, naming this
  spin's 1.0.51 as a store leg another session may be handling.

So the App Store leg now has two shapes, chosen after the user's own device
check of the build that would be submitted:

1. **1.0.51 on its own record, then 1.0.52.** Create a 1.0.51 record on
   build 1.0.51.1 with text (a) and submit it; 1.0.52 then gets its own
   record once 1.0.51 is `READY_FOR_SALE`, or is folded in by withdrawing and
   retargeting while 1.0.51 is still `WAITING_FOR_REVIEW`. Device check: build
   1.0.51.1.
2. **Roll 1.0.51 into 1.0.52.** One record on build 1.0.52.1 whose What's New
   is text (a) followed by 1.0.52's own paragraph (that paragraph is the
   species-first-of-year build's to propose, and needs its own yes). Nothing
   is withdrawn, since no 1.0.51 record exists; 1.0.51 then ends with a VALID
   build and no record by rollup, which CLAUDE.md's App Store list must say in
   the same ship. Precedent: 1.0.39 into 1.0.40, 1.0.41 into 1.0.42 and 1.0.48
   into 1.0.49, each decided before the older version had a record. Device
   check: build 1.0.52.1, which carries this bundle too.

Whichever is chosen is written into CLAUDE.md's App Store list in the same
ship.

Screenshots: this bundle changes none (1.0.52's Species Detail card is noted
under (b) below). Map Explorer 01 shows My Sightings,
not the Media Targets or Nearby Lifers recency colors, and 06 is the Breeding
Codes tab (codes from the CSV), not the List Comparer. No shot shows Settings.
Read every listing field back on the record after any write, promotional text
included (it arrived empty on new records at 1.0.35, 1.0.42, 1.0.46 and 1.0.49).

## (a) 1.0.51 on its own record (674 characters)

> On the Map Explorer, reports now take the right recency color in the weeks after clocks spring forward for daylight saving time, and in the List Comparer a breeding code the app does not recognize now always shows as the code itself.
>
> In Settings, Remove synced files from iCloud no longer stops at the first file iCloud will not delete. It removes everything it can, and Copy iCloud details names any file that stayed.
>
> The app now reaches only the web services it already used, each at the addresses it calls, and its content security policy now also covers the scripts it runs in the background, such as the one that draws the map. Neither changes anything you see or do.

## (b) 1.0.50 rolled into 1.0.51: no longer available

An earlier draft of this file carried a text (b), 1.0.50's four approved
paragraphs followed by (a), for withdrawing 1.0.50 from review and rolling it
into 1.0.51. 1.0.50 was approved and went `READY_FOR_SALE` during this ship,
so that route is gone and the text is removed. Under shape 2 above, the
combined What's New is (a) followed by 1.0.52's paragraph, in that order.

Screenshots under shape 2: this bundle changes no published screenshot, but
1.0.52 adds a First of Year card to Species Detail, and both sets carry a
Species Detail shot (05). Whether that shot needs a recapture is the
species-first-of-year build's call, and is settled before any record is
submitted on build 1.0.52.1.

## Checks on the wording

- American spelling; no em dashes (checked by script); no counts.
- "only the web services it already used" matches the CHANGELOG line and
  `PRIVACY_POLICY.md`, which already names the same services; it names no
  host. It does not claim the app "cannot send data anywhere else": map tiles
  are loaded by the page under the content security policy, not through this
  permission, and both stay limited to the hosts the app already used.
- "the scripts it runs in the background" is the plain form of the worker
  scripts; the map's tile worker is the one a user would recognize.
- The breeding-code clause says what the user now gets (the code itself)
  and leaves the misbehaving names to the CHANGELOG.
- No Review Notes change is needed: `appstore/REVIEW_NOTES.md` says nothing
  about the http permit, the policy, recency colors, the List Comparer's
  breeding badges, or how Remove synced files from iCloud proceeds.
- No listing change is needed: `appstore/LISTING.md`'s "the app talks
  directly to the service that has it" stays true and is now enforced more
  narrowly.
