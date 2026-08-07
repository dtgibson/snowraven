## Embed guard, dev dependencies, and website screenshots (0.5.77)

### What this does

Three independent improvements bundled into one Improve-lane run.

**1. `MediaFrame` receives the real embed preference at both call sites.**
`RecentMediaEmbed.tsx` and `NamedBirdMedia.tsx` both passed the JSX shorthand
`embedAllowed`, which is a hardcoded `true`. Each now passes
`embedAllowed={embedAllowed}`.

This is **not** a user-facing bug fix and changes nothing that renders. Both
parents already gate above the call, so `MediaFrame` is only ever reached when
the preference is already true. What it restores is the second layer the prop's
own doc comment describes ("every frame callsite must prove the hydrated global
preference allows an iframe"), which as written was a tautology, and it makes
`MediaFrame`'s `useMlEmbedGate(embedAllowed ? catalogId : '')` suppression
branch reachable rather than dead code.

**2. Dev-dependency audit cleanup.** A non-breaking `npm audit fix` (no
`--force`) in `frontend/` clears three high-severity transitive advisories.
Dev tree only; the shipped bundle is byte-identical. `package.json` is
untouched — only `package-lock.json` moves, committed with the change per
DECISIONS.md:1992.

**3. Website screenshots regenerated.** `website/assets/shots/*.webp` was frozen
at v0.5.23 while the site's version pill read 0.5.76. All nine existing shots
retaken from the current app, plus two new ones for Calendar and Named Birds,
which shipped after the last capture and had never been photographed. All from
synthetic demo data.

Supporting the capture, `SR_DATA_DIR` was added to the backend so the screenshot
run can point at a throwaway demo dataset instead of moving the user's real
`data/` aside (see below).

### How to test

Nothing user-visible changed, so this is mostly a verification pass:

1. `cd frontend && npm run build` — passes (`tsc -b` + vite).
2. `cd frontend && npm test` — 131 files / 1613 tests pass.
3. `cd frontend && npm audit` — 0 vulnerabilities. `npm audit --omit=dev` — 0.
4. `cd backend && python -m pytest tests/ -v` — 193 pass. `ruff check .` clean.
5. Open the site (`cd website && python3 -m http.server`) and confirm the
   Calendar and Named Birds rows show real screenshots rather than the old CSS
   mocks, and that the version pill and footer read 0.5.77.
6. Named Birds media and Species Detail Recent Media still behave identically
   with "Disable embedded media" both off and on.

### Notes for reviewer

**The per-call-site tests are source-parsing, deliberately.** There is no runtime
difference to assert: both parents gate above the call, so at every reachable
moment the variable *is* `true` and the literal is indistinguishable from the
forwarded value. A rendering test would pass on both the fixed and the unfixed
code and guard nothing. The property the fix restores is a static one, so it is
asserted where it lives, following the existing parse-the-source guard
convention (`entryChunk.test.ts`, `milestoneContrast.test.ts`,
`helpToc.test.ts`). Independence was verified mechanically, not by inspection:
reverting each file individually was confirmed to fail only its own test.

**`SR_DATA_DIR` covers four modules, not one.** `settings.py`, `settingskv.py`,
`mapdefaults.py`, and `taxonomy.py` each derived
`Path(__file__).resolve().parent.parent.parent / "data"` independently. Fixing
only `settings.py` (the one the brief named) would have produced a *partial*
override — demo data on one route, real data on the next — which is worse than
no override at all. All four now import `DATA_DIR` from the new
`backend/datadir.py`, and `test_datadir.py` asserts that they share it, so a
future router that re-derives its own path fails the suite. The default is
unchanged, and the existing tests' `monkeypatch.setattr(module, "DATA_DIR", …)`
pattern still works untouched.

**The capture tooling had two silent-failure bugs, both hit during this run.**
`clickTab` returned `false` on a miss, so a wrong-tab screenshot came out with
exit code 0. It now throws. That immediately surfaced the second problem: the
app has grown to ten tabs, so the tab strip needs ~1409px and TabNav collapses
it to a dropdown below a ~1457px viewport — the old 1440px capture width now
lands on the wrong side of that line and would have photographed a dropdown on
every desktop shot. Desktop captures moved to 1600px, and tab selection now
handles both nav forms. This is real app behavior at 1440px, not a headless
artifact, and no app code was changed to accommodate the capture.

**No app UI was touched to make anything photograph better** (per the brief).
The only capture-side composition choices are viewport width, clip height, and
stepping the Calendar back one year — the demo dataset ends in May of the
current year, so the default view is a half-empty grid.

**The stale `width`/`height` attributes in `index.html` were corrected.** They
declared 1600x1000 for images that are 1600x900 (and similar for map, map-dark,
weather, and the `og:image`), which is a layout-shift bug independent of this
change. Declared and actual dimensions were verified to match for all 11 images.
