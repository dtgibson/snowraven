# Change Brief: app-store-listing-polish

## What is changing
The two App Store screenshot sets (iPhone 6.9-inch and iPad 13-inch, six frames each) go from bare app captures to composed frames: each capture set on a SnowRaven-palette background with the raven mark and one short caption naming its tab. The aim is a store page that looks cared for to someone browsing, not a sales pitch.
- **Changes:** a reproducible composer that builds the frames from the committed raw captures (beside `website/tools/capture-appstore.mjs`, reusing its sharp and Playwright toolchain and its device table, or under a new `appstore/tools/`; The Engineer picks, noting everything under `website/` is published to Pages, v1.0.56). The raw captures stay committed (for example `appstore/screenshots/raw/{family}/`) so a recapture regenerates the set. Composed PNGs land where the upload set lives today. `appstore/LISTING.md` gains a Screenshots section recording order, captions and composition; `website/tools/README.md` documents the step.
- **Does not change:** `frontend/src`, `src-tauri`, the app icon, `website/` pages and shots, `README.md`, `PRIVACY_POLICY.md`, `docs/HELP.md`. The listing's text fields (name, subtitle, promotional text, description, keywords) stay as they are. The Designer may propose at most one sentence, and it goes through the approval gate.
- **Out of scope:** app preview videos, custom product pages and in-app events (new surfaces, and promotional by nature).
- **Added at the user's direction (2026-10-30, at the design review):** an iPhone Duo screenshot set in the same look. App Store Connect has one iPhone Duo slot per language, taking either the inner display (2007 x 2853) or the outer (1398 x 2034), scales nothing into it, and shows the "Made for iPhone Duo" badge once a set is submitted for an app on the iOS 27.1 SDK (SnowRaven since 1.0.58); the set is required from April 2027. The capture tool renders at viewport x scale, and the Duo inner screen (669 x 951 pt at 3x) and outer screen (466 x 678 pt at 3x) match those sizes exactly, so this is a new row in its device table plus six new captures, not a simulator job. The Designer picks the display.

## What the store lets us change
- Apple draws the product page: its chrome, colors, layout and type cannot be themed. "SnowRaven's colors and marks" can live only inside the screenshots (and app previews, out of scope). The icon comes from the shipped build, so it is a consistency check here, never a change.
- One set is shown in both the light and dark App Store, so a background has to sit well on a white page and a near-black one.
- Specs, as last verified in `capture-appstore.mjs` on 2026-08-25: iPhone 6.9-inch 1320x2868 (also 1290x2796, 1260x2736), iPad 13-inch 2064x2752 (also 2048x2732); one set per family, which Apple scales down for smaller devices; 1 to 10 images per set; PNG or JPEG.
- **To re-verify against Apple's current docs at The Deployer:** the accepted-size list, the RGB and no-transparency requirement for PNGs (the composer should flatten either way), and how many frames search results show (three portrait frames, from memory).
- Guideline 2.3.3 allows text overlays on frames that show the app in use. Drawing an Apple device bezel brings Apple's marketing-artwork terms into play; a plain rounded card avoids that.

## Why now
The user asked for it: the listing has shipped with bare captures since 1.0.0, and the page is what a birder browsing the store sees first. Nothing is broken. The capture tooling was last run at 1.0.58 and is current, so it is a good moment.

## User-facing impact
None in the app. Anyone browsing the App Store sees framed, captioned screenshots instead of bare captures. The text fields, the icon and every other surface are unchanged.

## Design pass
**Needed.** This is a purely visual change.
- **Surfaces being refined:** the iPhone 6.9-inch and iPad 13-inch screenshot sets; the app icon as a consistency check only (the frames' green and mark should agree with it).
- **What should feel better:** a calm, consistent set that reads as one family. Each frame says plainly which part of the app it shows, using the brand clover green and the RavenGlyph (the icon's raven, traced vector at `frontend/src/assets/snowraven-bird-glyph.svg`), in a quiet-utility register (`brand.md`).
- **Starting palette:** the `--sr-*` tokens in `frontend/src/globals.css` (light accent `#277448`, strong `#1A5C38`, tint `#E8F5EE`; dark accent `#34D399`), brand `#2D8653`, and the website's dark green band (`#0c1f17` with `#59d499`).
- **Captions:** informative, not promotional, in the listing's existing register. No em dashes, American spelling, "weather" lowercase in prose. Tab names exactly as in `TAB_LABELS`. No "eBird" or "Macaulay" in a caption (`LISTING.md` keeps those to the description and keywords). Readable at search-result thumbnail size, with WCAG AA contrast as the bar.

## Decisions touched
- **v1.0.0:** `LISTING.md` is the source of truth; informative-not-promotional; eBird and Macaulay only as compatibility statements. Captions are new store copy under the same rules.
- **v1.0.4:** screenshot sets are replaced whole and in order, because re-upload appends; capture fidelity rules (no Check For Updates, attribution markup unwrapped); the fail-closed demo-data guard. Composing must not undo any of these.
- **v1.0.19 / v1.0.20 / v1.0.29:** withdraw and resubmit to carry corrected shots; state an affected set by what each frame photographs; check a capture at the scale of its smallest detail; read the upload back by checksum.
- **v1.0.52:** the approved Wood Thrush Species Detail shot cannot be reproduced by the committed tools. The composer works from the committed captures; it does not re-run the capture.
- **v1.0.17 (ROADMAP, open):** the website and store Statistics shots show different key states. Adjacent; settle it here or leave it, but on purpose.
- **v0.5.93 / v1.0.3:** the icon and RavenGlyph unification. Used, not modified.
- **v1.0.56:** anything under `website/tools/` is published content.
- **CLAUDE.md:** the published-copy approval gate (store copy and App Store Connect), and the per-version disposition in `RELEASE_LEDGER.md`. **No decision is reversed.**

## Ship mechanics (open facts for The Deployer, not decisions)
- **No version bump, changelog entry or tag:** the shipped bundle does not change (CLAUDE.md, the dev-only rule). This holds only while the icon and the app stay untouched.
- **Screenshots live on a version record,** which must be in an editable state.
  - **1.0.60** was `WAITING_FOR_REVIEW` (record `c8841bbd`, submission `5e9ba5d3`) and is locked while in review. If review has not started, the sets can ride it by withdrawing, replacing both sets whole and in order, and resubmitting (the 1.0.19 and 1.0.20 play).
  - **1.0.59** (`a0511485`) is `READY_FOR_SALE` and cannot take new screenshots.
  - The other route is the next record, **1.0.61**, which the paused taxonomy run in the main checkout owns.
- **Re-read ASC first** (state can have moved since 2026-10-22). The choice is the user's, coordinated with that run.
- Whichever version carries the sets gets its sentence in `RELEASE_LEDGER.md` in the same ship.

## What done looks like
- **Re-runnable composer.** One command rebuilds both composed sets from the committed raw captures, producing the same output on every run. It checks each frame's pixel size, that no frame has transparency, and the count (10 or fewer) and order, failing loudly on any miss, with a `node --test` row beside the existing ones.
- **Captures checked.** The raw captures are confirmed current against 1.0.60, frame by frame, and the six iPhone Duo captures are new, taken by the same tool at the Duo family's viewport.
- **Records updated.** `LISTING.md` records the captions, order and composition.
- **User approval before any write to App Store Connect.** The user has seen both composed sets and every caption rendered on a tailnet page (never a file:// or localhost link) and said an explicit yes before anything is written to App Store Connect. The same applies to any proposed listing sentence.
- **Upload verified.** The Deployer replaced each set whole and in order, read back six `COMPLETE` per set with checksums matching the committed files, and wrote the version's disposition in `RELEASE_LEDGER.md`.
- **Nothing else moved.** `git diff --stat` touches nothing in `frontend/src`, `src-tauri`, `website/` pages or shots, `README.md`, or the privacy policy.

## Open questions for The Designer
1. **Which tabs and in what order?** Up to ten frames are allowed.
   - All eleven tabs, in `DEFAULT_TAB_ORDER`: Weather, Statistics, Map Explorer, Species Detail, Calendar, Targets, Multimedia, Breeding Codes, Checklists, List Comparer, Named Birds.
   - Shown today: Map Explorer, Statistics, Weather, Calendar, Species Detail, Breeding Codes.
   - Keep six, add some, or follow tab order? Any new frame needs a new capture, and Targets meets the keyed-capture gap.
2. **Background:** light, dark green band, or alternating? Which one holds up on both the white and the black store page?
3. **Dark-theme captures:** show any? `makePage` already takes a theme, so it is a capture option, not an app change.
4. **Mark placement:** RavenGlyph on every frame, or only the first?
5. **Caption wording:** reuse the already-approved description sentences, trimmed (less new copy to approve), or write fresh lines?
6. **Weather frame (iPhone `03`):** it opens mid-scroll with no tab header, and two tide lines clip at the right edge. Accept this under a caption, or recapture at a different scroll position?
7. **Statistics key state (ROADMAP v1.0.17):** settle it here or leave it?
