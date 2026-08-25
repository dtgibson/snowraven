# PRD — iOS App Store Release
**Feature:** ios-app-store-release
**Date:** 2026-08-25
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

The public App Store listing, compliance record, App Review package, and release-rhythm documentation that take SnowRaven's iOS build from invite-only TestFlight to public App Store distribution. This is a distribution and compliance feature: the deliverables are App Store Connect metadata, screenshots, published prose, and documentation; the only permitted code changes are those App Store compliance forces (currently expected: none — see FR-19).

### Findings verified from the repository (Planner, 2026-08-25)

These resolve three of the strategic brief's five open questions by inspection rather than assumption:

1. **Device family: iPhone AND iPad.** `src-tauri/gen/apple/snowraven.xcodeproj/project.pbxproj` sets `TARGETED_DEVICE_FAMILY = "1,2"` in both build configurations. iPad screenshots are therefore required alongside iPhone screenshots (FR-07).
2. **The iOS update surface is already compliant.** `frontend/src/components/UpdateFooter.tsx` returns `null` on iOS via `showUpdaterFooter()` in `frontend/src/lib/platformGates.ts` (FR-14 of the shipped mobile-app feature): no check button, no live region, no dynamic import of `updateManager` ever runs there, and the updater/process Tauri plugins are compiled desktop-only (`#[cfg(desktop)]`). Existing guards: `platformGates.test.ts` and `UpdateFooter.test.tsx`. No code change is needed; the requirement here is verification and regression protection (FR-19).
3. **Export compliance is already declared.** `ITSAppUsesNonExemptEncryption` is `false` in both `src-tauri/Info.ios.plist` and the committed `src-tauri/gen/apple/snowraven_iOS/Info.plist` (standard HTTPS only). The compliance task is to confirm, not to add (FR-13).

Also verified: the website (`website/`, published at `snowraven.dtgibson.com` per its CNAME) has a `#privacy` summary section but **no dedicated privacy policy page** — Apple's privacy policy URL field needs one (FR-11). Neither `README.md` nor `website/index.html` currently mentions iOS, TestFlight, or the App Store — the prose sync is a real deliverable, not a touch-up (FR-24). `docs/HELP.md`'s "Updating SnowRaven" section covers desktop and web/Pi only and says nothing about how iPhone/iPad users get updates (FR-20). The screenshot capture pipeline (`website/tools/`: `gen-demo-data.mjs`, `capture.mjs`, `process-img.mjs`, driven with `SR_DATA_DIR`) exists and is the required foundation for listing screenshots (FR-08).

## User Stories

> **US-01** — As a birder with years of eBird data and an iPhone in my pocket, I want to search the App Store for SnowRaven and install it free, so that I can explore my own data in the field without asking anyone for a TestFlight invite.

> **US-02** — As a privacy-conscious birder, I want the listing's privacy label to read "Data Not Collected" and link to a real privacy policy, so that I can verify the privacy promise before installing.

> **US-03** — As an App Reviewer with no eBird account, I want review notes with a step-by-step script, downloadable demo data, and a working eBird key, so that I can exercise the app end to end and evaluate it fairly.

> **US-04** — As an iPad user, I want the listing to show real iPad screenshots, so that I know the app genuinely supports my device before I install it.

> **US-05** — As an iPhone user, I want app updates to arrive through the App Store with no in-app update prompts, so that updating works the way every other iOS app does.

> **US-06** — As the developer, I want the App Store submission documented as a standing leg of every release, so that shipping to the store is routine, repeatable, and never blocks the desktop, web, or TestFlight legs.

## Functional Requirements

### A. App Store Connect listing

> **FR-01** — The app shall have a complete App Store Connect listing: app name, subtitle, description, keywords, primary and secondary category, promotional text, support URL, marketing URL (the GitHub Pages website), and copyright. The full listing content shall be recorded in a committed repository file before it is entered into App Store Connect, so the listing is reviewable, diffable, and re-enterable.

> **FR-02** — Listing copy shall follow the house voice rules: informative not promotional; SnowRaven working *alongside* eBird and the Macaulay Library with gratitude intact; no implied affiliation with or endorsement by the Cornell Lab. "eBird" and "Macaulay Library" shall appear only in the description and keywords as compatibility statements ("explore your own eBird data"), never in the app name or subtitle.

> **FR-03** — The app name shall be "SnowRaven". Name availability shall be verified in App Store Connect before any other metadata work; only if the bare name is taken shall a qualified fallback form (e.g. "SnowRaven Birding Tools") be used, and that decision shall be logged in the feature's decisions record.

> **FR-04** — The first App Store release shall ship as version **1.0.0**, in lockstep across every platform (`frontend/package.json` and `tauri.conf.json` bumped together, build 1, the standing TestFlight rule) — a deliberate one-time jump from 0.5.x for the public debut (user decision, 2026-08-25, superseding the brief's original "no artificial 1.0" position). Subsequent releases shall resume the standing incremental rhythm continuing upward from 1.0.0 (1.0.1, 1.0.2, …); no release shall ever carry a version lower than one already shipped (App Store submissions and the desktop updater's latest.json comparison both require monotonically increasing versions).

> **FR-05** — The app shall be listed free with no monetization of any kind: no in-app purchase, no ads, no donations, no Paid Applications agreement.

### B. Screenshots

> **FR-06** — The listing shall include screenshots for both targeted device families — iPhone and iPad (verified: `TARGETED_DEVICE_FAMILY = "1,2"`) — at pixel dimensions App Store Connect accepts for each family at submission time.

> **FR-07** — Screenshot content shall show the current app UI on representative screens (at minimum: a map view, a statistics view, and one more distinctive surface), rendered from real app builds, not mockups or composites.

> **FR-08** — Every screenshot shall be captured from the synthetic demo dataset via the `SR_DATA_DIR` pipeline (the same rule as the website's screenshots). No screenshot shall contain any real sighting location, real export data, or personal information. The real `data/` directory shall never be moved or copied during capture.

> **FR-09** — Screenshot capture shall be repeatable: the capture configuration (device sizes, screens captured) shall be committed alongside the existing `website/tools/` capture tooling so the set can be regenerated when the UI changes.

### C. Compliance record

> **FR-10** — The privacy nutrition label shall be "Data Not Collected". The supporting reasoning shall be documented in the committed listing record: no analytics, no telemetry, no accounts, no third-party SDKs, and all outbound requests are user-initiated, serviced in real time with the user's own keys, and retained by no one — which is why Apple's definition of "collected" is not met. Any future feature that would change the label is a listing change in the same release, with the same standing weight as PRIVACY_POLICY.md.

> **FR-11** — PRIVACY_POLICY.md's content shall be published at a stable URL on the website (`snowraven.dtgibson.com`), and that URL entered as the App Store Connect privacy policy URL. The page shall stay in sync with the repository file (the site redeploys on every push to `main` that touches `website/`, so sync means the page is generated from or updated with the canonical file in the same change).

> **FR-12** — The age rating questionnaire shall be completed honestly. Expected outcome: the lowest age band (no objectionable content, no user-generated content shared between users, no gambling, no unrestricted web access — external links open in the system browser). The answers given shall be recorded in the committed listing record.

> **FR-13** — Export compliance shall be declared via `ITSAppUsesNonExemptEncryption` = `false` (standard HTTPS only). Verified already present in both `src-tauri/Info.ios.plist` and the committed `gen/apple` Info.plist; the requirement is that both remain in place so no per-upload compliance question appears.

> **FR-14** — The content-rights declaration shall be answered honestly and the answer recorded: the app displays the user's own eBird and Macaulay Library data; embedded Macaulay media are the user's own uploads served by Cornell's embed endpoint; bundled reference datasets (eBird taxonomy snapshot, atlas blocks, county boundaries) are used within their license terms.

### D. App Review package

> **FR-15** — Review notes shall contain a step-by-step script an App Reviewer with no eBird account can follow: download and import the hosted demo eBird backup and ML export, enter the review eBird key, then walk each major tab. The script shall order the walkthrough so keyless features (tide, maps, all offline analytics over the imported demo data) demonstrate value before any keyed feature.

> **FR-16** — The review notes shall answer the three known review-risk areas honestly and in advance: (a) minimum functionality / external-data dependence — the demo dataset plus the import walkthrough show the app full, and the first-class no-key/offline/failure states mean nothing a reviewer hits without credentials looks broken; (b) Macaulay embeds — they show the user's own media, a Settings toggle disables them entirely, and when Cornell's bot check blocks players the app shows its own honest placeholder with a link out; (c) user-supplied keys and sign-in-less design — no account exists by design, keys are the user's own, and there is no login to demo.

> **FR-17** — The synthetic demo dataset (eBird backup CSV + ML export CSV) shall be hosted at a stable public URL a reviewer can download on-device, generated by the existing `gen-demo-data.mjs` tooling (deterministic, fictional birder, public hotspots only).

> **FR-18** — A dedicated free eBird API key for review shall be supplied in the App Store Connect review-notes field only. No API key of any kind shall be committed to the repository.

> **FR-19** — The iOS build shall expose no self-update or update-download affordance (App Store rule: apps must not self-update). Verified already true: `UpdateFooter` renders nothing on iOS via `showUpdaterFooter()`, and the updater/process plugins are not compiled into the mobile binary. The requirement is that this stays true and its existing regression guards (`platformGates.test.ts`, `UpdateFooter.test.tsx`) stay green; no code change is expected.

> **FR-20** — In-app prose reachable on iOS shall not instruct iOS users to self-update. `docs/HELP.md`'s "Updating SnowRaven" section shall gain a sentence stating that on iPhone and iPad updates arrive through the App Store; its desktop and web/Pi instructions may remain (describing other platforms is accurate, instructing iOS self-update would not be).

> **FR-21** — A compliance sweep of the iOS build shall check for any other desktop-only affordance a reviewer would flag (references to desktop-only flows presented as actions on iOS). Anything found shall be logged; only what compliance requires shall be changed.

### E. Release rhythm

> **FR-22** — CLAUDE.md's iOS release section shall gain the App Store submission step: after `release.sh` and the TestFlight upload of a version, the same uploaded build is submitted for App Store review, released immediately on approval (no phased rollout). The standing rule "a release goes to ALL available platforms, every time" shall be updated to name the App Store leg.

> **FR-23** — The documentation shall state the rejection path: a rejection stalls only the App Store leg and becomes a fix-forward item; desktop, web, and TestFlight are never rolled back or delayed by Apple's review latency.

### F. Published-prose sync

> **FR-24** — In the same change that public availability ships: PRIVACY_POLICY.md's "Software Updates" section shall describe the iOS update path (App Store) alongside the desktop path; README.md shall name iOS App Store availability in its platform list; and the website shall present iOS as an installable platform (with the App Store link once live). Each restatement shall be checked against the shipped behavior it describes, per the standing accuracy rule.

> **FR-25** — `product-brief.md`'s founding distribution decision shall be amended to include iOS — the conscious update the strategic brief calls for, not silent drift.

## Non-Functional Requirements

> **NFR-01 — Privacy:** No published artifact of this feature (screenshots, hosted demo dataset, review notes, listing copy) shall contain any real sighting location or personal data. The demo dataset is synthetic only.

> **NFR-02 — Secrets:** No API key, credential, or App Store Connect secret shall be committed to the repository. The review eBird key lives only in App Store Connect fields; Apple signing credentials stay local per the existing release rules.

> **NFR-03 — Truthfulness:** Every published claim — the privacy label, the listing description, the policy page, the review notes — shall be accurate against shipped behavior, with the same standing weight as PRIVACY_POLICY.md. An inaccurate compliance statement is a liability, not a doc bug.

> **NFR-04 — Zero unforced code change:** Desktop, web/Pi, and the iOS app's behavior shall be unchanged by this feature. Expected app-code diff: none. If compliance forces a change, it shall be minimal, platform-gated through the existing seams (`platformGates.ts` pattern), and individually justified in the decisions record.

> **NFR-05 — Website constraints:** The privacy policy page and any new site assets shall follow the website's standing rules: static, dependency-free, no third-party requests, relative asset paths, system fonts.

> **NFR-06 — Copy conventions:** Listing copy, the privacy page, and all new or edited prose on the published surfaces shall contain no em dashes (the standing sweep rule) and shall follow the house voice (informative, not promotional; no implied Cornell affiliation).

## Out of Scope

- **Android** — the roadmap says "to follow"; nothing here anticipates it.
- **Any new app feature or UI change** beyond what compliance forces (expected: none).
- **Mac App Store distribution** — desktop stays direct-download with its own signed updater.
- **Paid tiers, in-app purchase, ads, donations** — free, full stop.
- **App Store optimization tooling or marketing campaigns** — the listing informs in the website's voice.
- **Any analytics or telemetry**, including App Store-adjacent SDKs. Apple's own opt-in App Analytics lives outside the app and does not touch the privacy label.
- **Submission automation** (App Store Connect API integration) — the submit step is documented as a manual App Store Connect action; automating it is future work.
- **Phased rollout configuration** — releases go live immediately on approval.
- **Changes to the TestFlight build recipe itself** — the binary pipeline is done and untouched.

## Open Questions

1. **Is "SnowRaven" available as an App Store app name?** Not verifiable from the repository. **Default if unanswered before Stage 5:** assume available and verify in App Store Connect as the first metadata action; if taken, use a qualified fallback ("SnowRaven Birding Tools" or similar) and log the decision (FR-03).
2. **Category.** **Default:** primary **Reference**, secondary **Weather**. Justification: the app is a reference companion over the user's own birding records (life list, species history, breeding codes, taxonomy), and the founding feature is a weather-and-tide lookup. The user may override at the design/build stage; the choice and reasoning land in the decisions record (FR-01, FR-12 record).
3. **OpenWeather key for review.** **Default:** no OpenWeather review key. The review script scopes to keyless features (tide, maps, all offline analytics over the demo data) plus the dedicated free eBird review key, and deliberately shows the honest no-key state as evidence of the app's first-class degraded states. A temporary OpenWeather key may be substituted at build time if judged worth the cost (FR-15, FR-16).
4. **Where the reviewer demo dataset is hosted.** **Default:** as static files on the website (rides the existing GitHub Pages deploy, no new infrastructure, stable URL under `snowraven.dtgibson.com`). The Architect may choose a GitHub release asset instead; either satisfies FR-17.

## Success Metrics

Verification surface per row: **[repo]** = checkable in the repository or built site files; **[live]** = checkable against the deployed website or App Store; **[ASC]** = checkable only inside App Store Connect (The Tester verifies via the developer's confirmation or a screenshot of the ASC state).

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | [repo] Listing record completeness (FR-01) | A committed listing record contains all nine fields: name, subtitle, description, keywords, primary + secondary category, promotional text, support URL, marketing URL, copyright — none empty or placeholder. |
| QA-02 | [repo] No implied affiliation (FR-02, FR-03) | In the listing record, the name and subtitle fields contain neither "eBird" nor "Macaulay"; every description mention of eBird / Macaulay Library is a compatibility statement about the user's own data. |
| QA-03 | [repo] Copy hygiene (NFR-06) | `grep '—'` over the listing record, the privacy page source, and the new/edited prose in README.md, website/, and docs/HELP.md returns no hits in this feature's additions. |
| QA-04 | [repo] Screenshot matrix (FR-06, FR-07) | Screenshot files exist for both an iPhone set and an iPad set; each file's pixel dimensions match a size App Store Connect accepts for that family; the set includes a map view and a statistics view. |
| QA-05 | [repo] Screenshots are demo-data only (FR-08) | Every location and species name visible in every screenshot appears in the generated demo dataset (`gen-demo-data.mjs` output); capture was run with `SR_DATA_DIR` pointed at demo data (capture config committed, FR-09). |
| QA-06 | [live] Privacy policy URL (FR-11) | A stable URL on `snowraven.dtgibson.com` serves the full content of PRIVACY_POLICY.md (section-for-section parity with the repo file), with no third-party requests on the page. |
| QA-07 | [ASC] Privacy nutrition label (FR-10) | The App Store Connect privacy section reads "Data Not Collected", and the committed record contains the supporting reasoning. |
| QA-08 | [repo] Export compliance (FR-13) | `ITSAppUsesNonExemptEncryption` is `false` in both `src-tauri/Info.ios.plist` and `src-tauri/gen/apple/snowraven_iOS/Info.plist`. |
| QA-09 | [repo] No update affordance on iOS (FR-19) | `platformGates.test.ts` and `UpdateFooter.test.tsx` pass; `UpdateFooter` returns null with `isIOS()` mocked true; the updater/process plugins remain desktop-gated in `src-tauri` (`#[cfg(desktop)]`). |
| QA-10 | [repo] iOS update prose (FR-20) | `docs/HELP.md`'s "Updating SnowRaven" section states that iPhone/iPad updates arrive through the App Store and contains no instruction for iOS users to self-update. |
| QA-11 | [repo] Review notes script (FR-15, FR-16) | The committed review notes contain: the demo-data download + import walkthrough, eBird key entry, a per-tab walkthrough ordered keyless-first, and explicit answers to all three risk areas (minimum functionality, Macaulay embeds, user-supplied keys). |
| QA-12 | [live] Demo dataset hosted (FR-17) | The eBird backup CSV and ML export CSV download successfully from the URL stated in the review notes, and both import cleanly into the app. |
| QA-13 | [repo] No committed secrets (FR-18, NFR-02) | No API key or credential appears anywhere in the feature's diff; the review key is referenced only as living in App Store Connect. |
| QA-14 | [repo] Release rhythm documented (FR-22, FR-23) | CLAUDE.md's iOS section documents the post-TestFlight submit step, immediate release on approval, no phased rollout, and the rejection path (App Store leg stalls alone, fix-forward, no rollback of other platforms). |
| QA-15 | [repo] Published-prose sync (FR-24) | In the availability-shipping change: PRIVACY_POLICY.md "Software Updates" covers the iOS App Store path; README.md's platform list names the iOS App Store; the website presents iOS as installable. Each sentence checked against shipped behavior. |
| QA-16 | [repo] Founding brief amended (FR-25) | `product-brief.md`'s distribution decision names iOS distribution via the App Store. |
| QA-17 | [ASC] Version lockstep (FR-04) | The App Store version string equals `frontend/package.json`'s version, build 1; no renumbering. |
| QA-18 | [ASC] Compliance record entered (FR-12, FR-14, FR-05) | Age rating, category, content-rights answer, and free pricing in App Store Connect each match the committed record. |
| QA-19 | [repo] Zero unforced code change (NFR-04) | The feature's diff contains no changes under `frontend/src/` or `src-tauri/` app code, except changes individually justified as compliance-forced in the decisions record (expected count: zero). |
| QA-20 | [live] End state (US-01) | SnowRaven is findable by search on the App Store, installs free with no invite and no account, and loads the demo eBird backup + ML export end to end on a physical device or simulator. |
