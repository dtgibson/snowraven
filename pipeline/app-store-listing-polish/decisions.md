# Decisions: app-store-listing-polish

## Design stage (2026-10-30)

### D1. The frame palette is the website's band, not the app's dark theme

`pipeline/design-system.md` lists the app's tokens; it does not list the
website's band values (`#0c1f17`, `#59d499`, `#9fb3a7`, `#e8efe9`,
`--band-border`). The composed frames use the band. Reason: the band is
already SnowRaven's published treatment for a light screenshot on a dark
ground (every feature shot on the website sits on it), so a visitor who
has seen the site recognizes the store page; and the app's own dark
surface `#09090B` is a near-black that would vanish on the black App Store
page, which is the one surface the design has to hold on. The change brief
named the band as part of the starting palette. Not a new token: the
values are read from `website/styles.css` and recorded by hex in the spec.

### D2. Two derived values, neither minted as a token

- `#132c20`: the band lifted one step for the top of the frame gradient.
  Derived from `#0c1f17`, used only in the composer.
- `#293A33`: `--band-border` (`rgba(255,255,255,.12)`) pre-flattened over
  `#0c1f17`, so the composer draws a flat hairline rather than an alpha
  stroke. Derived, used only in the composer.

Both live in the composer beside the band values they derive from, with
this note as their reason. If the website's band ever changes, these two
change with it.

### D3. The caption face is SF Pro, the system font

The Weft design doctrine says not to default to `system-ui` for a display
face. The frames do. Reason, in order: the caption sits 72px above a
screenshot of the app set in SF (the app's `system-ui` on iPhone and iPad,
per the design system's type rule), and a second face would make one frame
read as two products; `pipeline/design-system.md` names Inter / system-ui
as the type and wins on specifics; and the brief forbids a CDN font and
prefers a font already in use over a new asset, and no font file is
committed in the repo. The doctrine's rule is for product chrome; here the
product's own face is the right one. `weft-design-lint` is clean because
the stack is written as `-apple-system, BlinkMacSystemFont, "SF Pro
Display", ...`, which is the same font by its platform names, not an
evasion of the rule: the choice is deliberate and recorded here.

### D4. The raven mark's fill on the band is `#59d499`, not the icon's `#2D8653`

The icon's green on `#0c1f17` measures 2.8:1 and fails the 3:1 non-text
bar; the website's `--band-accent` `#59d499` measures 9.2:1 on the same
ground and is the color the site already draws its accents in on this
band. The icon is unchanged. The mockup's icon section shows both side by
side as the consistency check.

### D6. iPhone Duo family added, inner display (user request, 2026-10-30)

After approving the first direction the user asked for an iPhone Duo set
in the same look, so the product page carries the "Made for iPhone Duo"
badge. App Store Connect has one Duo slot per language and accepts either
the outer display (1398 x 2034) or the inner (2007 x 2853); nothing scales
into it. **Inner, portrait.** Reasons: it is the device's signature screen;
at 669pt the app ships its icon-rail layout, so each frame shows more of
its tab than the 6.9-inch set, whereas the outer display at 466pt would
photograph the same phone-bar layout the 6.9-inch set already shows; and a
7:10 frame beside the 6.9-inch set is visibly a different device on the
product page, which is what the badge promises. The recipe is re-derived
for the squarer canvas (card 80.9% of the width, type 120/50) rather than
scaled from the phone. The six captures are new and are taken at build
(viewport 669 x 951 at 3x, the rail tier, `phone: false`), so they come
back for approval before upload; the mockup shows the Duo geometry over the
6.9-inch captures, letterboxed and labelled as a preview, and fakes no Duo
layout. Same six tabs, same order, same captions.

### D5. Scope held: no new screens, no app change

The design pass found one app behavior (the Weather tab's tide block does
not wrap at 440pt, so two lines run off the right edge of the phone
capture) and left it alone: it is flagged in the spec as a follow-up, and
the recommended remedy inside this run is a capture position, not a code
change. The Statistics key-state question (ROADMAP v1.0.17) is left open on
purpose, with the store's state recorded in `LISTING.md` so the next
website regeneration has a target.


## Scope addition at the design review (2026-10-30, Case 1 cascade by The Guide)

The user approved the design direction as presented and asked that the store page also become "Made for iPhone Duo" by adding an iPhone Duo screenshot set in the same look. Verified against Apple's App Store Connect screenshot specifications (one iPhone Duo slot: inner 2007 x 2853 or outer 1398 x 2034; nothing scales into it; required from April 2027 for apps on the iOS 27.1 SDK; submitting the set earns the badge) and the repo's own Duo measurements (DECISIONS.md v1.0.59: inner 669 x 951 pt, outer 466 x 678 pt, both at 3x), so the addition is a device-table row in `website/tools/capture-appstore.mjs` plus six new captures. The change brief's out-of-scope line was edited accordingly; the Designer is adding the family to the spec and mockup. Still on the Improve lane: a third frame family for an existing published surface, no app change.


## Orientation (2026-10-30, the user at the design review)

All three sets stay portrait. A landscape frame in a portrait set is scaled to the row height on the store page and breaks the three-up rhythm; the one landscape shot with a story (the Duo inner screen sideways, where the app earns its sidebar) is deferred, and if it ever comes it goes last, never in the first three.


## Approval of the composed sets and the published copy (2026-10-30, the user, in chat)

The user approved all three composed sets, the six captions, the held `appstore/LISTING.md` Screenshots section and the `website/tools/README.md` paragraph from the review page, and kept the page-top iPhone Weather frame (the half-height checklist field at phone width is an app quirk outside this brief; the mid-page frame clipped two tide lines). One caption change, applied as a Case 1 cascade to the composer, its test, the held section and patch, the review page, the mockup and the spec, then recomposed: Calendar reads "Each day shaded by species, checklists, media, etc." (51 characters; the composer measured it inside its box on all three families). Nothing is written to App Store Connect until the Deployer.


## After QA (2026-10-30, The Guide, Case 1)

The Tester flagged the Calendar caption measurements left behind by the caption change (the review page row and two spec sentences still read 43 characters and the old widths). Corrected to 51 characters and the composer-measured widths (978 of 1080, 1065 of 1680, 1108 of 1623). Convention noted for the Chronicler: when a caption changes, sweep its recorded measurements with the text.


## Security dispositions (2026-10-30, The Guide, at the Auditor hand-back)

F1 (Low, pre-existing): sharp 0.35.4 in website/tools carries an SVG-decoder advisory this toolchain cannot reach (sharp never receives an SVG; the raven glyph is read as text). DEFERRED to the idea inbox: bump to 0.35.5 as a dev-only change after this upload, re-checking the frames stay byte-identical. F2 (Informational): the Weather frames show the real public checklist S354229002 (Jamaica Bay, East Pond, 2026-06-07), as the website Weather shot has since v1.0.4; no observer name or key appears. ACCEPTED, with one line to the user at the deploy sign-off so they can say if it is not theirs to publish.


## Deployment (2026-10-30, The Deployer, after the production sign-off)

The user answered the sign-off gate "Confirm: prepare for 1.0.61", because App Store Connect, read on 2026-10-30, showed 1.0.60 already approved and on sale (record `c8841bbd` READY_FOR_SALE on build 1.0.60.1, submission `5e9ba5d3` COMPLETE with its item APPROVED), and an approved record takes no new screenshots. The user also approved the held Screenshots section's closing words changing from "and read back by checksum" to "and read back against the committed files", since the iPhone Duo set can only be read back by pixels.

**Pushed to `origin/main` as fast-forwards from `2eb88ed9`:** `d1470f2e` (the twelve raw captures moved under `appstore/screenshots/raw/`), `c3bdcd7b` (the composer, the iPhone Duo capture row, the eighteen composed frames and this run's records), and `7fee7d4e` (the approved Screenshots section in `appstore/LISTING.md`, the `RELEASE_LEDGER.md` entry, and the upload tooling in `asc/`). The full frontend suite passed before the third push, which edits text the published-claims suites read. The Pages deploy for `c3bdcd7b` succeeded; no site page changed.

**Ledger disposition:** `RELEASE_LEDGER.md`, "App Store screenshot sets (app-store-listing-polish), 2026-10-30": 1.0.60 RESOLVED (READY_FOR_SALE), no record in review, no 1.0.61 record yet, and the three composed sets ship on the next record, 1.0.61, which the paused taxonomy run owns.

**Nothing was written to App Store Connect.** The upload is deferred to 1.0.61, and this run stays open at the Deployer to perform it after the 1.0.61 record exists and before it is submitted, by the sequence in `asc/README.md`: the iPhone 6.9-inch and iPad 13-inch sets replaced whole and in order through the legacy `appScreenshots` API with an md5 read-back, and the iPhone Duo set created through the App Asset Library (`IPHONE_DUO_PROFILE`, spec `i2007x2853a0`), with every frame also read back by the decoded pixels of Apple's processed image.

**App Store Connect API 4.5.1 changes the release skill's screenshot recipe.** It deprecated `appScreenshotSets` and `appScreenshots` in favor of the App Asset Library, and the iPhone Duo slot exists only there. The library path carries no `sourceFileChecksum`, so the pixel read-back stands in for it; it was measured exact against 1.0.60's twelve live shots, and a negative control with the new frames failed every check. The `snowraven-release` skill's screenshot bullet should gain this at closeout.

**Follow-ups this decision moves:** security F1 (sharp 0.35.5) now waits until after the 1.0.61 upload, or re-proves the eighteen frames byte-identical first, or the read-back fails. The paused taxonomy run must fast-forward its local `main` past `7fee7d4e` before its own push; this run's third commit edits `appstore/LISTING.md` and `RELEASE_LEDGER.md`, which that run's release also edits.


## Coordination with the taxonomy run (2026-11-03)

The taxonomy-2026-readiness session confirmed: its local main is fast-forwarded to 09f10dba with no conflicts; 1.0.61 has no date yet (Cornell has not posted the 2026 taxonomy files; eBird API on 2026.0 since 27 Oct). Agreed protocol: at the 1.0.61 ship it creates the version record, sends this session its id before the review submission, and holds the submission until this run reports the three sets replaced and read back. Fallback if this session is gone: it runs the sequence in pipeline/app-store-listing-polish/asc/README.md itself as a ship step, writes the disposition in the 1.0.61 ledger entry, and says so in its close so this run can be closed from the ledger.


## Upload onto 1.0.61 (2026-11-03)

The taxonomy session created the 1.0.61 record (`1ff37081-0999-4eb7-8dbd-d44771e04b1c`, en-US localization `4ea321c5-5568-45f0-bb73-72f19312e97e`, build 1.0.61.1) and held its review submission. This run replaced the iPhone 6.9-inch set (`6773c54e`) and the iPad 13-inch set (`04fa1697`) whole and in order through the legacy route and created the iPhone Duo set through the App Asset Library (`IPHONE_DUO_PROFILE`, six ACTIVE placements, spec `i2007x2853a0`). `readback` ended ALL MATCH, eighteen of eighteen frames, md5 and pixels on the two legacy sets, pixels on the Duo set; the log is `asc/readback-1.0.61.txt`. The hold was released with that result, and the 1.0.61 ledger entry, written by the taxonomy session, names this upload.

**Three things the first pass through Apple's side taught, each now in `asc-screens.mjs`.** Processing took three to six minutes per frame that evening, so the per-frame wait is fifteen minutes, not six. On the library route Apple reports an image's state as past processing a little before it fills in the matched image spec, so the wait covers both, or a correct image reads as a spec mismatch. Library images outlive their placements and reference names are unique per library, so a re-run reuses an image a previous run uploaded (same reference name, matched spec, same byte size, past processing) rather than failing on the duplicate name; the pixel read-back checks every placed image regardless. Four Duo images from the first attempt were reused this way, two were uploaded fresh.
