# Design Spec — iOS App Store Release (DRAFT, Stage 4 iteration in progress)

**Feature:** ios-app-store-release
**Date:** 2026-08-25
**Status:** DRAFT — becomes final only when the user approves the design direction.
This is a distribution feature: the "screens" are the App Store listing, the
screenshot set, and the website privacy page. Mockup: `design.html` beside this file.

## Visual Direction

Quiet utility carried onto the store shelf: informative, never promotional,
SnowRaven working alongside eBird and the Macaulay Library with gratitude
intact and no implied Cornell affiliation. The listing's second headline is
the privacy label: "Data Not Collected" is presented as part of the pitch,
because for this app it is. Screenshots are the real app over synthetic demo
data, light theme, unadorned. The privacy page is the existing website's
idiom exactly (styles.css, system fonts, no third-party requests) with a
dark lead band that puts the label's claim before the legal text.

## Screens / Views

### 1. App Store listing (appstore/LISTING.md → App Store Connect)

All copy final-quality draft; exact character counts verified.

- **Name:** `SnowRaven` (9/30). Availability verified in ASC before any other
  metadata work (FR-03); fallback "SnowRaven Birding Tools" only if forced,
  logged in decisions.md.
- **Subtitle:** `Your birding data, explored` (27/30). Alternates offered:
  "Explore your own birding data" (29), "Your birding records, explored" (30).
  No eBird/Macaulay in name or subtitle (FR-02).
- **Promotional text** (164/170):
  > Free and open source, with no account, no ads, and no tracking. Import
  > the exports you already have and see years of your own birding from new
  > angles, even offline.
  Deliberately names no third-party service (strict reading of FR-02: eBird
  and Macaulay live in the description and keywords only).
- **Description** (2,706/4,000): full text in `design.html` Section 2.
  Structure: what it is → device-local/no-account sentence → the ten tools as
  bullets → offline line → PRIVACY block (with the privacy URL) → WHAT YOU'LL
  NEED (honest about the two free keys and the keyless features) → closing:
  independent project, works alongside eBird and the Macaulay Library,
  explicit "not affiliated with, or endorsed by, the Cornell Lab of
  Ornithology", other platforms named. No em dashes.
- **Keywords** (97/100):
  `bird,life list,ebird,checklist,tide,weather,hotspot,species,birdwatching,lifer,bird list,macaulay`
  Skips words already indexed via name/subtitle (birding, data).
- **Categories:** primary **Reference**, secondary **Weather** (PRD open
  question 2 default, reasoning recorded; user may override at this gate).
- **URLs:** marketing `https://snowraven.dtgibson.com`; support
  `https://github.com/dtgibson/snowraven`; privacy
  `https://snowraven.dtgibson.com/privacy.html` (must be live pre-submission).
- **Copyright:** `2026 Dave Gibson`. **Price:** free, no monetization (FR-05).
- **Version:** 1.0.0 for the App Store debut, lockstep on every platform,
  build 1; the regular incremental rhythm resumes upward from 1.0.0 after this
  release (FR-04 as amended, user decision 2026-08-25).
- **Privacy label:** Data Not Collected, with the supporting reasoning from
  `pipeline/mobile-app/privacy-labels.md` re-verified against v0.5.93 behavior
  before it is entered (FR-10). Age rating: honest answers, expected 4+ (FR-12).

### 2. Screenshot set (appstore/screenshots/)

- **Order (both device families):**
  1. Map Explorer — sightings + hotspot pins around the demo birder's NY area,
     one hotspot popup open (Jamaica Bay Wildlife Refuge)
  2. Statistics — life list total, growth chart, top species
  3. Weather & Tide — formatted weather block + NOAA tide for a checklist
  4. Calendar — a year as twelve shaded month grids
  5. Species Detail — Northern Cardinal: stats, over-time graph, map, media
  6. Breeding Codes — the color-coded matrix with tier legend
  Rationale: shots 1+2 are the search-results pair ("your birding, mapped and
  measured"); 3 is the founding, unique feature on the first swipe; 4–6 add
  breadth then depth. Satisfies QA-04's required map + statistics views.
- **Sizes:** iPhone 6.9" 1320x2868 (viewport 440x956 @3x); iPad 13"
  2064x2752 (viewport 1032x1376 @2x). Six shots per family, same order,
  genuinely re-captured at tablet width (US-04). Engineer re-verifies ASC's
  accepted-size list at submission time per the schema.
- **Caption decision: clean frames, no caption text, no device bezels.**
  Reasons: (a) the voice is informative, not promotional, and caption bands
  are where promotional voice creeps in; (b) every tab opens with its own
  titled header, so each screen names itself; (c) clean captures regenerate
  byte-for-byte from the committed pipeline (FR-09) with no per-release
  caption artwork to drift.
- **Content rules:** light theme (store default); synthetic demo dataset only
  via `SR_DATA_DIR` (FR-08); every visible place/species name must exist in
  the generated demo data (QA-05).

### 3. Privacy policy page (website/privacy.html)

- Site idiom exactly: `styles.css` tokens, system fonts, relative paths, no
  third-party requests, light/dark via the site's existing theme mechanism.
- **Structure:** site header (brand + back-to-home) → compact hero (eyebrow
  "Privacy", h1 "SnowRaven Privacy Policy", effective date) → **dark lead
  band** (reusing the homepage privacy band treatment): shield icon, "App
  Store privacy label" chip, "Data Not Collected" headline, one supporting
  paragraph, the four point tiles (No accounts / No tracking / Keys & data
  stay local / No developer server) → prose: every `##` section of
  PRIVACY_POLICY.md as `<h2>`, identical text, reading measure ~780px →
  site footer.
- The lead band is presentation only; the h2 set and order mirror
  PRIVACY_POLICY.md exactly so `privacyPageParity.test.ts` (schema-recommended)
  has clean structure to assert.
- Homepage `#privacy` section + footer gain a "Read the full privacy policy"
  link; at launch the platforms section presents iPhone/iPad as installable
  with the App Store link (FR-24 Phase B).
- **Flagged recommendation (for Engineer + decisions.md, not a redesign):**
  ship the iOS policy additions (the "iOS App" section, the location-prompt
  paragraph, the App Store update path) in Phase A with the page, since Apple
  reviews the page before approval and the additions describe behavior
  already true on TestFlight. The schema currently sequences them in Phase B.

## Component Usage

- Privacy page reuses the website's shipped classes: `.container`, `.band`,
  `.eyebrow` (+ `.on-dark`), `.privacy-points` tile pattern, `.site-header` /
  `.site-footer`, buttons untouched. New page-scoped rules only for the hero
  and prose measure; no new components, no new scripts beyond the site's
  existing `app.js` theme toggle.
- The listing itself has no components; `design.html`'s store sketch is
  deliberately generic (labeled "not an Apple page") and exists only to let
  the copy be reviewed in situ.

## Design Tokens Applied

- Website tokens as shipped: `--accent` #2D8653 / `--accent-strong` #1A5C38,
  `--band-bg` #0C1F17 with `--band-accent` #59D499 for the lead band,
  text/border neutrals unchanged. No new tokens minted; both site themes
  already carry everything the page needs.
- App tokens appear only inside screenshots, which are the real app.

## Interaction Notes

- Privacy page is a static document: anchor links, the site's theme toggle,
  and standard focus-visible states. No JS beyond the site's existing script.
- Homepage additions are two links and (Phase B) the platforms/App Store
  presentation; no new interactive patterns.

## Motion Spec

- Privacy page: inherits the site's existing `.reveal` on-scroll fade
  (ease-out, 0.6s site standard) ONLY if applied sparingly to the lead band;
  body prose renders static. Site's `prefers-reduced-motion` block already
  neutralizes all motion; nothing new to add. No other motion: a policy page
  should hold still.
- Mockup-only motion (not shipped): section-nav highlight, details expander
  at 220ms ease-out, hover states <150ms; reduced-motion fallback present.

## Content Notes

- Voice: informative, not promotional; alongside eBird/Macaulay with
  gratitude; explicit non-affiliation sentence in the description; no em
  dashes in any shipped copy (NFR-06); "free public good" framing intact.
- Every published claim must be re-verified against shipped v0.5.93 behavior
  before entry into ASC (NFR-03) — the listing record carries the reasoning,
  not just the answers.
- Review notes (appstore/REVIEW_NOTES.md) are Stage 5 content per the schema,
  but their voice follows this spec: honest, keyless-features-first, the
  three risk areas answered plainly.
