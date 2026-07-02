## What We Accomplished

Shipped **v0.5.55**, a pre-mobile-launch sweep with two halves. **Four
behind-the-scenes tidies** with no visible change: the self-hosted backend now
reuses one keep-alive HTTP connection for its outbound calls; Media Targets and
Nearby Lifers share a single recent-observations fetch when centered on the same
spot; a pair of tests now lock the desktop/web taxonomy twins together and the
county-completeness fetch gating; and an unused geolocation plugin was removed
from the desktop build. **A responsive/mobile-friendliness pass** driven by a
comprehensive audit (71 findings, each adversarially verified): 67 fixed — map
popups now scroll inside themselves on short phone screens, dense controls grow
to a comfortable tap size, tapping a form field no longer makes iOS zoom, and
control rows wrap instead of overflowing, all holding from a 320px phone up and
at 200% text size, with desktop unchanged.

## What Has Been Saved

- **Release commit/tag `v0.5.55` → `081a2588`** (you pushed finding #5, the
  comparer A/B cell labels, on top of the pipeline's release commit and moved the
  tag; the release ff-merged to it, re-ran the suite green, and verified the CI
  run's commit matched the tag before building). **Records commit `c4f1ca3`.**
  Binaries **LIVE** as a GitHub release marked *Latest*: notarized + stapled
  universal macOS DMG, updater bundle + signature, signed Windows installer +
  signature, `latest.json` (`darwin-aarch64` / `darwin-x86_64` / `windows-x86_64`).
  Windows CI run `28617130817` (headSha == tag) supplied the installer.
- Code: `backend/http_client.py` (new shared client), `backend/routers/map.py` +
  `frontend/src/lib/tauri/mapService.ts` (recent-obs cache), new test files
  (`taxonomyCollapse.fixture.json` + parity readers, `useCountyCompleteness.test.ts`,
  `mapService.recentObs.test.ts`), the geolocation removal (`src-tauri/*`,
  `package.json`), and responsive fixes across ~28 component files + four new
  shared classes in `frontend/src/globals.css`.
- Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.55;
  `CHANGELOG.md` (also corrected — County Completeness moved to its own 0.5.54
  block); `docs/HELP.md`, `website/index.html`. `PRIVACY_POLICY.md` unchanged.
- Records: `DECISIONS.md` (geolocation reversal, the http_client + recent-obs
  tidies, the two new responsive lenses + four classes, the out-of-band tag
  handling), `CLAUDE.md` (the http_client rule + the four classes + the two
  mobile checks), `ROADMAP.md` (shipped 90; four tidies removed from Horizon;
  three deferred mobile-a11y follow-ups added).
- Verification: vitest **1257**, pytest **172**, lint / build / cargo check /
  entry-chunk guard all green; security review **41 checks, 0 findings**.

## Where We Are

Improvement complete — all six Improve-lane stages done and shipped (source,
binaries, records). Pipeline is idle.

Three audit findings that cross into new rendered content or a scroll-model
change were tracked on the roadmap rather than folded in: breeding-code meanings
being hover-only on touch, the List Comparer's title-only badge/media counts, and
the Life List table's inert sticky header. A manual phone-width smoke of the map
popups and Weather tab is recommended but not blocking.

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project.
It reads saved state and picks up fresh.
