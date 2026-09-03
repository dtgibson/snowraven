## Website and README acknowledgements tone

### What this does
Trims three sentences of over-written copy from the two published surfaces that are not
part of the app bundle, and fixes a stale version string in the same file.

On `website/index.html`: the closing CTA paragraph loses its last sentence, which narrated
what the app's own Acknowledgments panel says and re-listed its two credits; the Offline
section loses the "It is honest about the edges:" lead-in, keeping every fact that
followed it (the sentence now opens on "Live lookups (...)"). In `README.md`: the Settings
bullet keeps "an Acknowledgments section" and drops the enumeration of who it credits.

The version pill and footer move from 1.0.13 to 1.0.14 to match `frontend/package.json`.
That string is what `frontend/src/lib/icloudKeysPublishedClaims.test.ts:184` asserts on,
and it was red on `main` before this change.

The credits themselves are untouched. They still render in Settings on every platform and
keep their full text in `docs/HELP.md`, which is where the v1.0.10 decision put the
authority for them. Nothing is un-credited, only un-repeated.

### How to test
1. Serve `website/` and load `index.html`. The header pill and the footer line both read
   v1.0.14.
2. Scroll to the Offline support feature. The second paragraph starts "Live lookups
   (current weather and tide, place search, the Checklist Comparer, nearby-bird overlays,
   and app updates) still need a connection..." and lists exactly the same facts as before.
3. Scroll to the "A personal project, shared freely" closing band. The paragraph ends on
   "There's nothing to sign up for, and nothing to buy." Both CTA buttons still point at
   the releases page and the GitHub repo.
4. Open `README.md` and read the Settings bullet. It ends "...plus an Acknowledgments
   section."
5. Open the app's Settings tab and press "View acknowledgments". Both entries are
   unchanged.
6. `cd frontend && npx vitest run src/lib/icloudKeysPublishedClaims.test.ts
   src/lib/projectsPublishedClaims.test.ts src/lib/privacyPageParity.test.ts` (61 tests,
   green). These are the only three suites that read `README.md` or the website HTML.

### Notes for reviewer
- **No version bump, no CHANGELOG entry, no release.** The app bundle is byte-identical:
  neither `website/` nor `README.md` ships in it, and `docs/HELP.md` (which does, via the
  `?raw` import in `HelpDocs.tsx`) is deliberately untouched. This matches the `f02b063`
  docs-only precedent and CLAUDE.md's dev-only/no-bump carve-out. `frontend/package.json`
  and `src-tauri/tauri.conf.json` were not touched.
- **`docs/HELP.md` is out of scope on purpose.** The v1.0.10 decision states HELP.md
  "remains the untouched full documentation" and that exhaustive detail belongs there, so
  its Acknowledgments entry keeps the full credit text. That exclusion is also what keeps
  this change out of the shipped bundle.
- **No link target moved.** The diff contains no `href` change; the only attribute edited
  is the version pill's `aria-label`, which was updated in lockstep with its visible text
  so the accessible name still matches what is on screen.
- HTML tag balance was verified over the whole file after the edits (no unclosed or
  mismatched tags, no empty or dangling paragraph).
- The em-dash sweep over all eight published surfaces is clean, and `grep -rn '1\.0\.13'
  website/` returns nothing.
