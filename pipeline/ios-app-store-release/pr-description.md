# PR — iOS App Store Release (Phase A), v1.0.0

## What this does

Takes SnowRaven's iOS app from invite-only TestFlight to ready-to-submit
public App Store distribution, as version **1.0.0** (the deliberate one-time
jump from 0.5.93; the incremental rhythm resumes upward from here). This is a
distribution and compliance feature: it ships the committed listing record
(`appstore/LISTING.md`), the App Review package (`appstore/REVIEW_NOTES.md` +
a hosted synthetic demo dataset at `website/demo/`), committed iPhone and
iPad screenshot sets with their capture tooling, the dedicated privacy policy
page (`website/privacy.html`) that becomes Apple's privacy policy URL, the
iOS additions to PRIVACY_POLICY.md, the one iOS updating sentence in
docs/HELP.md (the only bundled change, which is why this rides a full
release), and the App Store leg of the standing release rhythm in CLAUDE.md.
App behavior is unchanged on every platform.

## How to test

See `how-to-see.md` beside this file for the local walkthrough (privacy page,
screenshots, listing record, and how to re-run the capture).

Gates run, all green:

- `cd frontend && npm run build` (tsc -b + vite): pass.
- `npx vitest run`: 204 files, 3,014 tests, all pass (includes the new
  `privacyPageParity.test.ts`, the entry-chunk guard, and the FR-19 guards
  `platformGates.test.ts` / `UpdateFooter.test.tsx`).
- `npm run lint`: pass.
- Em-dash sweep over docs/HELP.md, README.md, PRIVACY_POLICY.md,
  ACCESSIBILITY.md, website/index.html, website/privacy.html,
  appstore/LISTING.md, appstore/REVIEW_NOTES.md: zero hits.
- Tailwind bundle check for the new test file: shipped CSS byte-identical to
  HEAD (sha256 `9ed4e573…`, 55,005 bytes) with a determinism control.
- Capture-lib extraction verified byte-identical against HEAD (`selectTab`
  body and the GL flags identical; `page()` identical modulo the declared
  browser/deviceScaleFactor parameters).
- Backend untouched; backend pytest not run (no backend change).

## Notes for reviewer

- **Apple screenshot sizes re-verified 2026-08-25** (the schema asked for
  this check at capture time): App Store Connect currently requires one size
  per family and accepts 1320x2868 / 1290x2796 / 1260x2736 for the 6.9-inch
  iPhone class and 2064x2752 / 2048x2732 for the 13-inch iPad class. The
  committed sets are exactly 1320x2868 and 2064x2752, dimension-verified by
  `capture-appstore.mjs` itself. (Sources: Apple's current spec as summarized
  by the 2026 size guides; re-check in ASC at submission per the standing
  note in the script.)
- **Screenshot content decisions** are logged in `decisions.md` (Stage 5
  section): the My-Sightings-not-live-Hotspots choice for shot 1 (QA-05), the
  removed web-only "Check For Updates" footer segment (the iOS build renders
  the footer without it), the eBird-manners stub for the Statistics escapee
  pass, and the `WEATHER_REPLAY` path for shot 3 (this rig's `.env`
  deliberately carries a fake OpenWeather key). **If you want the weather
  shot re-captured fully live**, put a real OpenWeather key in `backend/.env`
  and re-run the capture without `WEATHER_REPLAY=1`; the framed output is
  identical.
- **QA-05 has one logged exception**: shot 3's checklist header line shows
  the public hotspot name of the real public coastal checklist the capture
  pipeline has always used (`CHECKLIST` env). No personal data; reasoning in
  decisions.md.
- **Phase A / Phase B**: this change makes no App-Store-availability claims
  anywhere (README and the website homepage platform sections are untouched
  on that point). The exact on-approval edits are staged in
  `phase-b-availability.md`. The PRIVACY_POLICY.md iOS additions moved from
  Phase B to Phase A per the Designer's flag (Apple reads the privacy page
  during review); decisions.md records it.
- **ASC-side work stays with the account holder at submission time** (from
  the committed records): verify the "SnowRaven" name (FR-03), enter the
  listing fields from LISTING.md, the privacy label answers, age rating,
  content rights, upload the screenshot sets, paste REVIEW_NOTES.md's
  reviewer notes with a dedicated free eBird review key filled into its
  placeholder (never committed), and submit the already-uploaded TestFlight
  build. The privacy URL and demo URLs go live when this merge deploys the
  site, before submission.
- The version bump touches `frontend/package.json` + `src-tauri/tauri.conf.json`
  in lockstep; `website/index.html`'s version pill/footer follow to v1.0.0
  per the standing site rule.
- The only `frontend/src` change is the test-only parity guard (QA-19
  exception, justified in decisions.md). The only `src-tauri` change is the
  version.

## Known limitations

- The committed weather/tide screenshot derives from the app's replay path
  (see above); visually indistinguishable from a live success, re-capturable
  live in one command with a real OpenWeather key.
- The demo Macaulay catalog numbers are synthetic, so media embeds in the
  reviewer flow resolve to the app's honest placeholder state; REVIEW_NOTES
  says so to the reviewer explicitly.
- `appstore/screenshots/` adds ~4.4 MB of PNGs to the repo (committed by
  design per the schema, so the listing set is reviewable and regenerable).
