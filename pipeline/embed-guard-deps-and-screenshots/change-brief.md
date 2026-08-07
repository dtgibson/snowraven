# Change Brief — Embed Guard, Dev Dependencies, and Website Screenshots

## What is changing

Three independent improvements, bundled into one run. (1) Both `MediaFrame` call sites
pass the JSX shorthand `embedAllowed`, which is a hardcoded `true`; each parent already
has the real boolean in scope under that same name, so each becomes
`embedAllowed={embedAllowed}`. (2) Three high-severity transitive advisories in
`frontend`'s dev tree (`brace-expansion`, `postcss`, `undici`) are cleared with a
non-breaking `npm audit fix`. (3) `website/assets/shots/*.webp` is regenerated from
synthetic demo data, replacing screenshots frozen at v0.5.23 while the app ships 0.5.76.
Pieces 1 and 2 are small and self-contained; piece 3 is the heavy one and carries real
toolchain risk (below). They are independent and should land in that order, since the
screenshots need a working build of the post-fix app.

## Why now

Piece 1 is a standing ROADMAP "On the Horizon" item, and the claim was verified rather
than taken on faith: `RecentMediaEmbed.tsx:48` and `NamedBirdMedia.tsx:236` both pass
bare `embedAllowed`. The prop's own doc comment calls itself "defense in depth… every
frame callsite must prove the hydrated global preference allows an iframe," so as
written that layer is a tautology. Piece 2 is a routine hygiene sweep with an exact
precedent. Piece 3 is the most visible: the site's version pill already reads 0.5.76
while the screenshots below it show v0.5.23, so the published page advertises a version
it does not depict — 53 versions of UI drift, including two tabs (Calendar, Named Birds)
that did not exist when the shots were taken.

## User-facing impact

**None for pieces 1 and 2.** Piece 1 changes no behavior today: both parents already
gate above the call (`RecentMediaEmbed.tsx:43`, `NamedBirdMedia.tsx:217` plus the
`wantEmbed` guard at :213), so `MediaFrame` is never reached when embeds are disabled.
This restores an intended second layer, it does not fix a live leak — worth stating
honestly rather than as a user-visible bug fix. The gain is a *static* property, not a
runtime one: because both parents gate above the call, `MediaFrame` is only ever
rendered with the preference already true, so its `useMlEmbedGate(embedAllowed ?
catalogId : '')` suppression branch remains unreachable after the fix exactly as it was
before. What changes is that the inner guard now answers the real preference instead of
a literal, so a future edit removing a parent's gate is caught there rather than sailing
through. (Corrected during the security review — an earlier draft of this section
claimed the suppression branch became reachable. It does not.) Piece 2 produces a
byte-identical app bundle.
Piece 3 changes only published marketing images, not the app.

## Design pass

**Not needed — no visual change.** Confirmed, not assumed. Piece 1 is prop threading
with identical rendered output. Piece 2 is build tooling. Piece 3 photographs existing
surfaces as they already look; it changes no app screen, token, or layout. No new or
refined surface is in scope, so The Designer has nothing to decide. If the Engineer
finds a captured screen looks wrong *in the app* (not in the capture), that is a
separate finding to raise, not a design pass to fold in here.

## Decisions touched

- **DECISIONS.md:75-79 (v0.5.72, embedded-media preference).** Piece 1 directly
  implements the defense-in-depth clause this entry specifies. Extends it, reverses
  nothing. The Chronicler should record that the guard was inert from that release
  until now.
- **DECISIONS.md:457 (`Dev Dependency Cleanup`, 2026-06-29).** Exact precedent for
  piece 2: non-breaking `npm audit fix` (no `--force`), dev-only, **no version bump**.
- **DECISIONS.md:633/639** (a prior Improve run bundling `npm audit fix` with unrelated
  threads) — precedent that this bundling shape is sanctioned.
- **DECISIONS.md:1992** — the lockfile must be committed in the same commit as any
  dependency change.

## What done looks like

Piece 1: both call sites pass `embedAllowed={embedAllowed}`, with a **separate test per
call site** (per CLAUDE.md's two-independent-paths rule, a single combined test passes
on a half-fix). Piece 2: `npm audit` in `frontend` reports 0, `npm audit --omit=dev`
still reports 0, `package-lock.json` committed, `npm run build` and the full suite
green. Piece 3: `website/assets/shots/*.webp` regenerated from synthetic demo data
only, the user's real `data/` verifiably restored, and the site reviewed before push.
Version: 0.5.76 → 0.5.77 in `frontend/package.json` **and** `src-tauri/tauri.conf.json`,
CHANGELOG entry, tag, `release.sh`.

---

## Scope — files in and out

**In:**
- `frontend/src/components/RecentMediaEmbed.tsx` (line 48), `NamedBirdMedia.tsx` (line 236)
- Their test files (one new/extended test per call site)
- `frontend/package-lock.json` (audit fix; `package.json` deps should be untouched)
- `website/assets/shots/*.webp`, and `website/index.html` if feature copy or the
  version pill/footer needs updating
- `frontend/package.json` + `src-tauri/tauri.conf.json` version, `CHANGELOG.md`

**Out:**
- `frontend/src/components/MediaEmbed.tsx` — `MediaFrame` itself is correct; the prop,
  its guards, and the `compact` contract all stay as-is. Do not widen this into a
  MediaFrame refactor.
- Root `package-lock.json` — already audits clean at 0; leave it alone.
- The `disableEmbeddedMedia` setting, the App-root hook, and the ML embed gate.
- Any app UI. Piece 3 must not "fix" a screen to make it photograph better.

## Versioning consequence (read this before committing)

Piece 1 changes the shipped bundle, so **this run does take a patch bump** — both
`frontend/package.json` and `src-tauri/tauri.conf.json` to the same version, plus a
CHANGELOG entry, tag, and `release.sh`. Pieces 2 and 3 would each have required none of
that alone (dev-only toolchain; `website/` is not in the app bundle). Because a bump
happens anyway, `website/index.html`'s version pill and footer must move to the new
version in lockstep. Note that pushing anything under `website/` triggers the Pages
workflow, so the site redeploys on merge — have the regenerated shots and any copy
correct before that push, not after.

## Screenshot toolchain — verified risks, name these before starting

1. **The real-data swap is the biggest risk in this run and is unmitigated.** The
   backend reads `DATA_DIR = <repo root>/data` (`backend/routers/settings.py:11`), and
   `website/tools/README.md` step 2 instructs `mv ../../data ../../data.real` — moving
   the user's real eBird export aside. `SR_DATA_DIR` **was never implemented**; a grep
   finds it only as a hypothetical in that README. A crash or an interrupted capture
   strands real data in `data.real`. Preferred fix: add the `SR_DATA_DIR` env override
   the README already anticipates (backend-only, dev ergonomics, no user-facing surface,
   still Improve territory) so no swap is needed. Otherwise script the swap with a shell
   `trap` guaranteeing restore on any exit path. Do not run the manual swap by hand.
2. **Capture tooling is not installed.** `website/tools/node_modules` is absent; needs
   `npm install playwright sharp` + `npx playwright install chromium`, and network.
3. **`capture.mjs` predates two tabs.** It captures Statistics, Map Explorer, Breeding
   Codes, Multimedia, Species Detail, Weather. `DEFAULT_TAB_ORDER` now has ten tabs
   including `calendar` and `named-birds`, both shipped after v0.5.23 and never
   photographed. Adding shots for them is still Improve (marketing content about
   existing surfaces), but it is a scope call the Engineer should make deliberately and
   it grows the work.
4. **`clickTab` fails silently.** It matches exact rendered tab text and just returns
   `false` on a miss, so a renamed label yields a screenshot of whatever tab was already
   open rather than an error. Verify each output image actually shows its intended tab;
   do not trust an exit code of 0.
5. **The Weather shot needs live network, API keys, and a live checklist.** It drives a
   real public coastal eBird checklist so a tide renders, needs `EBIRD_API_KEY` and
   `OPENWEATHER_API_KEY` in `backend/.env`, and the default checklist may have aged out
   (`CHECKLIST=...` override exists).
6. **Hard constraint:** synthetic demo data only, never the user's real eBird data. Any
   shot containing a real personal location is a privacy failure, not a cosmetic bug.
