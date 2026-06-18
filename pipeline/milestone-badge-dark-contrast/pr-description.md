## milestone-badge-dark-contrast

### What this does
Fixes the Statistics tab's milestone badges, which rendered as bright white tiles with an
unreadable bird name in dark mode. The dark-theme `--sr-milestone-*` tokens were a verbatim
copy of the near-white light tiles, and the species name (the only badge element not bound to
a milestone token) inherited `--sr-text`, which is near-white in dark mode — so near-white text
on a near-white tile (~1:1). The dark tokens are now genuine dark tiles (deep green tiers 1–3,
deep amber tier 4) with the threshold number, name, date, and check mark all re-tuned to
WCAG 2.1 AA. The same tokens drive the Frivolous Lists "Complete!" badge, so it is fixed in the
same change. Light mode is untouched.

### How to test
1. Run the app and switch to dark mode.
2. Open Statistics → "Firsts & Milestones".
3. Confirm the badges are dark tiles and the threshold number, bird name, date, and ✓ are all legible.
4. Scroll to the Frivolous Lists section — the "Complete!" badges match.
5. Switch to light mode: badges are unchanged.

### Notes for reviewer
- Pure token change in the `[data-theme="dark"]` block of `frontend/src/globals.css`; no component code changed.
- Every text/graphic pair verified at AA against BOTH gradient stops. `frontend/src/lib/milestoneContrast.test.ts` parses the real shipped tokens and asserts AA, so reintroducing light tiles (or under-contrast text) fails the suite.
- Full CI mirror green: lint, typecheck, 1006 vitest tests (28 new), production build. Entry chunk unchanged (~218 KB); `vendor-maplibre` stays isolated.
- Frontend-only; the Python backend is untouched.
