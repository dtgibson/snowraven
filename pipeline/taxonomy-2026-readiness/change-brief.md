# Change Brief: Taxonomy 2026 Readiness

## What is changing
Two legs. **Leg 1, ready to ingest (now):** fix the web/Pi backend's saved taxonomy copy (`data/taxonomy.json`). Today it is written once, never rewritten, and always preferred over the bundled snapshot. Have a long-running web/Pi server re-fetch at the desktop's seven-day age. Add guards so a regenerated snapshot fails CI on a hardcoded Frivolous Lists name eBird no longer publishes, and on a species code outside the shape the app's code guards accept (the generator also fails closed on it). Correct the comments that call the snapshot `VERSION` "the Clements year": "2027" is a cache counter holding eBird's 2025 taxonomy, so the ingest bumps it to "2028". Write one ordered annual runbook. **Leg 2, ingest 2026 (blocked on outside data):** bump `VERSION` and `CACHE_KEY`, regenerate the snapshot twins, countability and alpha codes, add Cornell's two 2026 files and a 2026 `UPDATE_PUBLISHED` row, regenerate the history, and re-derive every pin measured on the 2025 snapshot. Full inventory and steps are in `decisions.md`.

## Why now
eBird's 2026 update is scheduled for 27 October 2026, two days out. It is the first since Cornell began aligning with AviList, so the file and column layout may change. Measured today: eBird's `ref/taxonomy/versions` still reports 2025 as latest, and no 2026 input files are on this Mac. **The user must supply**, after eBird publishes them, `scripts/taxonomy-history-input/clements-integrated-v2026.csv` and `scripts/taxonomy-history-input/ebird-taxonomy-v2026.csv`, downloaded in a browser, plus eBird's announced tally (species gained through splits and lost through lumps). The web/Pi defect was latent until a taxonomy change, and this update is when it will first bite.

## User-facing impact
Leg 1: no visible change on Mac, Windows, iPhone, iPad or Android. On web/Pi, an offline start after the update stops serving a frozen copy. Leg 2: the Splits and lumps coverage line reads "2019 to 2026" on its own (it is derived from the asset, so no copy edit), and the offline floor's favicons, sort and countability are current again. A Frivolous Lists entry may change if eBird renames it ("Great Egret" is listed, and Great Egret is among the reported 2026 splits). No published surface names the taxonomy year: README, website, App Store listing, privacy policy and F-Droid metadata were all checked. The only held copy is the usual F-Droid changelogs and App Store "What's New" for the release that carries this.

## Design pass
Not needed, no visual change.

## Decisions touched
- **v0.5.45 Offline support: MODIFIED.** The web/Pi disk twin rule ("persist only when an online fetch advances the version"; disk twin preferred over the bundled snapshot) never refreshes, because a fetched bundle's version is always "". The VERSION and CACHE_KEY lockstep stands.
- **v0.5.89 Countability from `reportAs`:** the asset is regenerated at Leg 2. The build-time trust boundary is unchanged: no runtime validation of the inlined asset.
- **v1.0.41 Splits and lumps** and **v1.0.58 taxonomy-history-2019:** the refresh follows their rules. A 2026 year without its announced tally cannot ship, and recounts stay cited and net-preserving.
- **v1.0.55 Species codes:** the alpha-code asset refreshes with the snapshot, with VERSION and CACHE_KEY bumped first. The key is read from the app's own store and never printed.
- **v0.5.39 Frivolous Lists:** the manual "verify names against the live taxonomy" step becomes a guard.

## What done looks like
Leg 1: backend rows show three things: a live fetch that differs from the saved copy rewrites it, a newer bundled snapshot beats an older saved copy, and a server older than seven days re-fetches. The new guards are green on the 2025 snapshot and have each been seen red on an injected defect. Full vitest, backend pytest, `npm run build` and eslint are green. Leg 2: both generators run clean, with 2026 reproducing eBird's announced tally; CI is green; and the snapshot's source year equals `ref/taxonomy/versions`' latest.
