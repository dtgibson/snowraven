# Schema — iOS App Store Release
**Feature:** ios-app-store-release
**Date:** 2026-08-25
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md, pipeline.config.json

---

## Path

**Frontend Only — no data layer changes required.**

Hands-off run: this assessment is recorded here rather than gated in chat.
Classification basis, in one sentence: every deliverable in the PRD is App
Store Connect metadata, screenshots, published prose, hosted static files, or
documentation, and the only code surface the PRD touches (the iOS update
affordance, FR-19) is already verified compliant with existing regression
guards — so nothing creates, reads anew, updates, or deletes any persisted
app data, and the expected app-code diff is zero (NFR-04, QA-19).

## Confirmation

Checked every user story (US-01..06) and functional requirement (FR-01..25)
against the six data-operation categories from the frontend-only checklist:

- **New records / tables / columns / migrations:** none. There is no database
  in this app at all; the persistence layer is two user-imported CSVs plus
  JSON settings files behind the storage seam (see `pipeline/mobile-app/schema.md`,
  which documented this byte-identical for iOS).
- **New reads:** none. Screenshots and the hosted demo dataset are *generated
  outputs* of existing tooling (`website/tools/gen-demo-data.mjs`), not new
  app data paths.
- **New writes / deletes / relationships / derived-stored data:** none.
- **The one "data" deliverable — the hosted reviewer demo dataset (FR-17) —
  is static published content on the website**, downloaded and imported by a
  reviewer through the app's existing upload flow. The app treats it exactly
  like any user CSV. No app code is involved in hosting or fetching it.

This is in fact stricter than the usual frontend-only path: not only no data
layer changes, but (expected) **no app code changes at all** (NFR-04). The
"frontend" work is published-surface work: `website/`, `appstore/` (new),
`docs/`, and root prose files.

---

## Existing Data and Artifact Context (what the Engineer reads)

### App data model — unchanged, for the record

Per `pipeline/mobile-app/schema.md` (the standing reference): all persistent
data lives under `AppLocalData/data/` via `TauriStorage` — `api-keys.json`,
`settings.json`, `metadata.json`, `ebird-backup.csv`, `ml-export.csv`. On
web/Pi the same five live under `backend/datadir.py`'s `DATA_DIR`
(`SR_DATA_DIR`-overridable). Nothing in this feature touches any of them.

### Prior artifacts this feature builds on directly

| Artifact | What it already contains |
|---|---|
| `pipeline/mobile-app/privacy-labels.md` | **The prepared App Store privacy material from the mobile-app feature's Phase 1** — the "Data Not Collected" nutrition-label reasoning with its ground-truth table, and a "Prepared PRIVACY_POLICY.md additions" section explicitly written to ship publicly "in Phase 2, at App Store launch." This feature IS Phase 2. The Engineer starts from this file for FR-10 and FR-24 rather than drafting fresh — but must re-verify every claim against v0.5.93 shipped behavior (it was written 2026-07-05; e.g. the hotspot-activity and eBird-gate work landed since). |
| `pipeline/mobile-app/how-to-see.md` | The full iOS build + TestFlight upload recipe (also summarized in CLAUDE.md's iOS section). The submit-for-review step (FR-22) appends to this rhythm; the binary recipe itself is untouched. |
| `website/tools/` (`gen-demo-data.mjs`, `capture.mjs`, `process-img.mjs`, `README.md`) | The screenshot + demo-data pipeline (FR-08/09/17 foundation). Facts that matter: `gen-demo-data.mjs` is **deterministic** (fictional birder, public northeast-US hotspots); `demo-data/` and `shots/` are **gitignored** (generated outputs); `capture.mjs` drives Playwright Chromium with `deviceScaleFactor: 2`, desktop viewport 1600x900 (load-bearing against the TabNav collapse at ~1457px), and a `selectTab` that **throws** on a miss; `process-img.mjs` produces WebP for the website only. |
| `frontend/src/lib/platformGates.ts`, `platformGates.test.ts`, `UpdateFooter.test.tsx` | The existing FR-19 regression guards. Verification-only here (QA-09). |
| `src-tauri/Info.ios.plist` + `src-tauri/gen/apple/snowraven_iOS/Info.plist` | `ITSAppUsesNonExemptEncryption` = `false` in both (FR-13). Verification-only (QA-08). |

### Publishing infrastructure facts

- `.github/workflows/pages.yml` deploys on push to `main` touching
  `website/**`, and the Pages artifact is the **whole `website/` directory**
  (`path: website`). Anything committed under `website/` is published at
  `https://snowraven.dtgibson.com/<path>` (CNAME committed). This is the
  hosting mechanism for both the privacy page (FR-11) and the demo dataset
  (FR-17) — no new infrastructure.
- `website/index.html` has a `#privacy` summary section and footer links but
  **no dedicated policy page** (verified; matches the PRD finding).
- Current version: `frontend/package.json` = **0.5.93** (FR-04 lockstep
  reference; the actual submitted version is whatever release carries this
  feature's bundled prose change — see Sequencing).

---

## Structural Design — where every artifact lives and how it flows

No data layer exists to design, so this section is the architecture: the
committed home and flow of each deliverable, so Stage 4 writes copy into
known slots and Stage 5 implements without guessing.

### New top-level directory: `appstore/`

The App Store presence gets its own committed directory, parallel to
`website/` (which is the analogous "published surface" precedent — one
directory, one publishing destination). The pipeline folder is the wrong
home: pipeline archives are historical records, while the listing record is
a **living document** with the same standing weight as `PRIVACY_POLICY.md`
(FR-10: any future label-affecting feature updates it in the same release).
`pipeline/mobile-app/privacy-labels.md` was pipeline-scoped precisely
because it was "package only, NOT published"; this feature graduates that
content into the durable record.

| Artifact | Path | Satisfies |
|---|---|---|
| Listing record | `appstore/LISTING.md` | FR-01..05, FR-10, FR-12, FR-14 (QA-01/02/07/18) |
| Review notes | `appstore/REVIEW_NOTES.md` | FR-15..18 (QA-11/13) |
| iPhone screenshot set | `appstore/screenshots/iphone-6.9/*.png` | FR-06..09 (QA-04/05) |
| iPad screenshot set | `appstore/screenshots/ipad-13/*.png` | FR-06..09 (QA-04/05) |

**`appstore/LISTING.md` sections (all nine QA-01 fields, none placeholder):**
name, subtitle, description, keywords, primary + secondary category (default
Reference + Weather per PRD open question 2, with the reasoning recorded),
promotional text, support URL, marketing URL, copyright — plus the
**compliance record**: privacy nutrition label reasoning (start from
`privacy-labels.md`), age-rating questionnaire answers (FR-12), content-rights
answer (FR-14), and free-with-no-monetization (FR-05). Proposed defaults for
Stage 4 to confirm: marketing URL `https://snowraven.dtgibson.com`, support
URL the GitHub repository (its issues are the real support channel),
copyright `2026 Dave Gibson`.

**`appstore/REVIEW_NOTES.md`:** the step-by-step reviewer script (demo
download → import → eBird key entry → per-tab walkthrough, **keyless features
first** per FR-15), the three risk-area answers verbatim-ready for the ASC
review-notes field (FR-16), the demo dataset URLs, and an explicit statement
that the review eBird key lives **only** in the App Store Connect field
(FR-18, QA-13 — no key string ever appears in this file). PRD open question 3
default stands: no OpenWeather review key; the script shows the honest no-key
state deliberately.

### Screenshot capture: extend `website/tools/`, don't duplicate it

The App Store set is a **second consumer of the same capture pipeline**, not
a parallel one:

1. **Extract shared helpers** into `website/tools/capture-lib.mjs`:
   `page()` (context + theme init script), `selectTab()` (strip/dropdown
   aware, throws on miss), and the GL flags. `capture.mjs` imports them with
   behavior byte-identical (this is a relocation — diff the moved code
   against HEAD per the standing refactor rule).
2. **New `website/tools/capture-appstore.mjs`** drives the demo-data-backed
   app (same `SR_DATA_DIR` procedure, same `BASE` env) at App Store device
   dimensions and writes PNGs directly to `appstore/screenshots/`. PNG is the
   deliverable format — App Store Connect accepts PNG/JPEG, so
   `process-img.mjs` (WebP) is **not** in this path.
3. `website/tools/README.md` gains an "App Store screenshots" section (the
   committed capture configuration QA-05 requires).

**Device dimensions (the viewport math is exact):**

| Family | ASC size | Pixels (portrait) | Playwright viewport | deviceScaleFactor |
|---|---|---|---|---|
| iPhone | 6.9-inch | 1320 x 2868 | 440 x 956 | 3 |
| iPad | 13-inch | 2064 x 2752 | 1032 x 1376 | 2 |

As of 2025 App Store Connect requires only one size per family (6.9" iPhone,
13" iPad) and scales smaller devices from it. FR-06 says "sizes App Store
Connect accepts at submission time" — the Engineer verifies the accepted-size
list in ASC before capture and adjusts these constants if Apple has moved
them; the constants live in `capture-appstore.mjs` with this table's
reasoning as a comment.

**Rendering notes, recorded as design decisions:**
- The capture is Chromium rendering the same frontend the iOS WKWebView
  ships; that satisfies FR-07's "real app builds, not mockups" (the UI is the
  app), and it is the only *repeatable* path (FR-09). Simulator screenshots
  were rejected: manual, unrepeatable, and they add nothing the listing needs.
- `.sr-ios-app` (the safe-area class) is set only when `isIOS()` and is
  correctly **absent** in these captures — store screenshots carry no notch
  or status bar, so no safe-area inset should render.
- At 440 CSS px the TabNav is a dropdown and the ≤640 phone tier governs; at
  1032 CSS px the nav is also collapsed (strip needs ~1457px) — both match
  what the real devices show, so the screenshots are honest.
- Shot list (Stage 4 picks final copy/order; QA-04 minimums fixed here): map
  view and statistics view required; third-plus surfaces from the distinctive
  set (Calendar, Breeding Codes, Species Detail, Weather + Tide). Both themes
  available via the existing theme init script; light is the store default.

### Privacy policy page: `website/privacy.html`

- Hand-written static HTML in the website's existing idiom: reuses
  `styles.css`, relative asset paths, system fonts, zero third-party
  requests (NFR-05). Content is **section-for-section parity** with
  `PRIVACY_POLICY.md` (QA-06 checks exactly this): Overview, Your Data Stays
  on Your Device, No Data Collection, Connections to Bird and Weather
  Services, Your Location, Map Tiles, Embedded Bird Media and Link Icons,
  Software Updates, Children, Changes to This Policy, Contact.
- Stable URL: `https://snowraven.dtgibson.com/privacy.html` — this is the
  App Store Connect privacy policy URL (FR-11). It must be **live before
  submission** (Apple requires it at submission time; see Sequencing).
- `website/index.html`'s `#privacy` section and footer gain a "Read the full
  privacy policy" link to it.
- Sync mechanism (FR-11 "generated from or updated with the canonical file
  in the same change"): hand-maintained duplicate under the standing
  same-edit rule, **plus a recommended parity test**
  `frontend/src/lib/privacyPageParity.test.ts` asserting the `##` section
  set and order of `PRIVACY_POLICY.md` match the `<h2>` set and order of
  `website/privacy.html` (the `helpToc.test.ts` precedent: every
  hand-maintained mirror of a single-source document has drifted before and
  gets a parity test). See the QA-19 note below before adding it.

### Reviewer demo dataset hosting: `website/demo/`

- Commit the two generated CSVs as `website/demo/snowraven-demo-ebird-backup.csv`
  and `website/demo/snowraven-demo-ml-export.csv` (1.3 MB + 128 KB — trivial
  for Pages). URLs: `https://snowraven.dtgibson.com/demo/<file>` — stable,
  rides the existing deploy, no new infrastructure (PRD open question 4
  default adopted; GitHub release assets rejected because their URLs churn
  per release and would couple review notes to release tooling).
- Only the two CSVs are hosted — the reviewer imports them through the app's
  own upload flow, exactly as a user would (US-03). The generator's other
  outputs (`metadata.json`, `settings`, `taxonomy.json`) are capture-rig
  internals and stay out.
- The committed copies are regenerated from `gen-demo-data.mjs` in the same
  edit whenever the generator changes (determinism makes the pair
  reproducible; the gitignored `demo-data/` staging area is unchanged).
- These files are synthetic and public by design (NFR-01); no index/nav link
  is needed — the review notes carry the URLs.

### Documentation and prose deliverables (existing files)

| File | Change | FR |
|---|---|---|
| `CLAUDE.md` (iOS release section) | Add the App Store submission step: after `release.sh` + TestFlight upload, the same uploaded build is submitted for review in ASC; released immediately on approval; no phased rollout; rejection stalls the App Store leg alone (fix-forward, never a rollback of other platforms). Update the "a release goes to ALL available platforms" rule to name the App Store leg. Also extend the em-dash sweep list to include `appstore/LISTING.md`, `appstore/REVIEW_NOTES.md`, and `website/privacy.html` (they are published-prose surfaces now). | FR-22, FR-23 (QA-14) |
| `docs/HELP.md` ("Updating SnowRaven") | Add: on iPhone and iPad, updates arrive through the App Store. **Bundled via `?raw` → this is a shipped-app content change → version bump + changelog + full release** (see Sequencing). Accurate for the submitted build: the binary a reviewer reads it in is the App Store build. | FR-20 (QA-10) |
| `PRIVACY_POLICY.md` ("Software Updates" + Overview) | Describe the iOS update path (App Store handles updates; the in-app checker is desktop) alongside the desktop path. Start from `privacy-labels.md`'s prepared additions, re-verified against current behavior. `website/privacy.html` re-syncs in the same edit. | FR-24 (QA-15) |
| `README.md` | Platform list gains iOS App Store availability. | FR-24 (QA-15) |
| `website/index.html` | iOS presented as installable, App Store link once live; version pill rules unchanged. | FR-24 (QA-15) |
| `product-brief.md` | Distribution decision amended to include iOS via the App Store (conscious update, not drift). | FR-25 (QA-16) |
| `pipeline/ios-app-store-release/decisions.md` | Name-availability outcome (FR-03), category choice, and any compliance-forced code change justification (expected: none). | FR-03, NFR-04 |

### Sequencing — two phases, and why

The PRD's "in the same change that public availability ships" (FR-24) cannot
be literal for everything, because approval is asynchronous:

**Phase A — pre-submission (the bulk of this feature):** `appstore/`
directory, capture tooling + screenshot sets, `website/privacy.html` + demo
hosting (must deploy before the ASC submission so the privacy URL and demo
URLs resolve), CLAUDE.md rhythm, `docs/HELP.md` sentence. Because the
HELP.md edit changes the shipped bundle, Phase A rides a **version bump and
a normal full release** (desktop + web + TestFlight); that release's
TestFlight build is the one submitted for review, at that semver, build 1
(FR-04). ASC data entry (metadata, label, age rating, review notes, key)
happens from the committed records after this release.

**Phase B — on approval (availability prose):** `README.md` platform list,
`website/index.html` App Store presentation + link, `PRIVACY_POLICY.md`
update-path prose, `product-brief.md` amendment, and the privacy page
re-sync. None of these files are bundled into the app, so Phase B is a
website/prose-only push — no version bump, no release (the same class as any
website-only change).

### Zero-code-change confirmation (NFR-04, QA-19)

Verification-only items, no diff expected: `platformGates.test.ts` +
`UpdateFooter.test.tsx` green with `UpdateFooter` null on iOS; updater/
process plugins `#[cfg(desktop)]`-gated; both Info.plists keep
`ITSAppUsesNonExemptEncryption` = `false`; the FR-21 sweep of iOS-reachable
prose for desktop-only affordances (log findings, change only what
compliance forces). **One flagged exception:** the recommended
`privacyPageParity.test.ts` is a file under `frontend/src/` — it is
test-only, not app code, but QA-19's grep will see it, so the Engineer must
either record it in `decisions.md` as a test-only addition (with the
standing bundle byte-compare check, since any `frontend/` file is a Tailwind
source — avoid rare utility words in its comments) or place the parity check
elsewhere and accept weaker drift protection. Recommendation: add the test,
record the justification.

---

## No Data Layer Work Required

No migrations exist, none are needed, and no schema of any kind changes. The
Engineer proceeds directly to the deliverables above; The Designer (Stage 4)
drafts the listing copy, screenshot shot list, and privacy-page presentation
into the slots this document defines.
