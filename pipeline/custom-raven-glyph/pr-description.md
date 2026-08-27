# PR — Custom Raven Glyph (v1.0.3)

## Custom Raven Glyph

### What this does
Replaces the generic lucide `Bird` outline with the SnowRaven raven
silhouette (the clean vector trace of the v0.5.93 app icon's raven) at its
only two render sites: the app header mark and the first-run welcome screen
mark. The glyph is a new dependency-free `RavenGlyph` component (inline
single-path SVG, `fill="currentColor"`, always `aria-hidden`), colored via
`var(--sr-accent)` exactly as before, at the exact approved sizes (20/30
header via `compactChrome()`, 34 welcome — 100% sizing approved, no optical
trim). The master SVG is committed in-repo at
`frontend/src/assets/snowraven-bird-glyph.svg` per the v0.5.93 asset
convention. Patch bump 1.0.2 → 1.0.3 in both version files, with a
CHANGELOG entry.

### How to test
1. `cd frontend && npx vitest run src/components/RavenGlyph.test.tsx src/components/WelcomeScreen.test.tsx src/lib/entryChunk.test.ts` — 24 tests: component contract (aria-hidden, single currentColor path, size prop drives width/height, no literal colors in source), both render sites at the approved sizes, and a repo-wide source-scan guard that no `lucide-react` `Bird` import remains (parser red-checked in-file; the whole guard was also proven red against a planted offender during the build).
2. `cd frontend && npm run build` — the pre-push gate (tsc -b + vite build).
3. Visually: header raven beside the wordmark in light and dark themes at desktop and compact sizes; welcome screen raven on a cold start (clear keys/data, or temporarily reset the seen flag).
4. `grep -rn "\bBird\b" frontend/src --include='*.tsx' --include='*.ts'` shows no lucide `Bird` (remaining matches are `BirdName`, `BirdingStats`, eBird prose, and test fixture strings).

### Notes for reviewer
- The welcome-screen site GAINS `aria-hidden` (the old lucide bird there lacked it; App.tsx had it). Deliberate, recorded in the design refinement — the mark is decorative at both sites, the wordmark carries the name.
- `strokeWidth` was dropped, not ported: meaningless on a filled silhouette (design refinement).
- The component strips the source SVG's baked `color="#2D8653"` and `<title>`/`<desc>`; no hex anywhere in the component (guarded by a test). The committed master asset keeps them verbatim — it is the standalone source of truth, not a component.
- `RavenGlyph` rides the App.tsx entry chunk by construction (zero imports beyond a React type); `entryChunk.test.ts` stays green, including its post-build modulepreload check.
- Motion: deliberately none (a brand mark animating on mount is anti-slop, per the design refinement Motion Spec). `weft-design-lint` reports zero findings on the changed files.
- No doc changes: `docs/HELP.md`, `README.md`, and `website/` never describe the lucide bird (grep-verified). Website/README screenshots showing the old header glyph may be slightly stale — known, not blocking (change brief).
- `package-lock.json` deliberately untouched (matches every prior bump; it still carries an old version string by repo convention).
- The v1.0.2 App Store "hold" precedent may apply at the deploy stage if a submission is still in Apple's review queue.

## Seeing Custom Raven Glyph locally

1. Open a terminal in your project folder.

2. Start the backend:
   `cd backend && uvicorn main:app --reload --port 1620`

3. In a second terminal, start the frontend:
   `cd frontend && npm run dev`

4. Open your browser and go to:
   `http://localhost:5173`

5. Look at the very top of the page. The bird beside the "SnowRaven"
   wordmark is now a solid raven silhouette (the same raven as the app
   icon) instead of the old thin outlined bird. It sits in the same spot,
   at the same size, in the same green.

6. Switch the theme (Settings tab, Appearance) and check the header again:
   the raven should be the light green on dark, deeper green on light —
   exactly like the old mark, just a solid raven now.

7. To see the welcome screen version: it only appears on a cold start
   (no API keys and no data files loaded), so on an installed setup you
   will not see it — that is expected. If you want to check it anyway,
   open the app in a private/incognito browser window at
   `http://localhost:5173`: the "Welcome, let's get you set up" screen
   shows the same raven beside the wordmark at the top. Close the window
   when done; nothing is saved.

8. For the desktop app: `cd frontend && npm run desktop:dev` and check
   the same header in the app window.
