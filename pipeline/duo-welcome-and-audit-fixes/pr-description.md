## Duo Welcome and audit fixes (1.0.60)

### What this does
Three confirmed fixes in one patch release. The first-run Welcome screen now keeps
its card clear of a camera at the side of the screen (the iPhone Duo's outer
screen, an Android cutout in landscape) and of the status bar, by moving its
inline position and padding into a platform-gated class. On iOS the four window
monitor commands are denied, as defense in depth against tao's monitor-lookup
abort on the Duo's inner screen. And `npm audit` in `frontend/` reads 0 again,
from a lockfile move to Vite 8.1.6, Vitest 4.1.12 and source-map-js 1.2.2,
within the declared ranges.

### How to test
1. `cd frontend && npm audit` (with network): 0 vulnerabilities, and 0 with `--omit=dev`.
2. `npm run build`, `npx eslint .` and `npx vitest run`: green except the two
   `fastlaneMetadata.test.ts` rows that wait for the held 1.0.60 F-Droid
   changelogs (see Notes).
3. Build the iOS app for the simulator, erase and boot the iPhone Duo simulator,
   install and launch: the Welcome screen's card ends at x = 358 pt, left of the
   84 pt camera column (`evidence/duo-outer-welcome-clean.png`; the probe build's
   in-app readings are in `evidence/duo-outer-welcome-probe.png`).
4. On the Mac or in a browser, the Welcome screen looks exactly as in 1.0.59.

### Notes for reviewer
- **Welcome (`WelcomeScreen.tsx`, `globals.css` `.sr-welcome-panel`).** The base
  rule holds the old inline values; the `.sr-ios-app` rule pads the top and both
  sides by `calc(literal + inset)`, with an `.sr-android-app` twin. With every
  inset at 0 the render is identical to 1.0.59 (measured). The top is padded,
  the family's shape: on an upright iPhone the card moves down by half the
  status bar (31 pt on an iPhone 17 Pro), and at 200% text WebKit's scroll-up
  rest point clears the status bar instead of sitting inside it
  (`decisions.md`, A3, with the reversal).
- **A measured issue left alone on purpose:** in Chromium (Android, Windows) an
  overflowing Welcome screen cuts off its top at 200% text, as in 1.0.59. The
  exact fix and its place are in `decisions.md`, A5.
- **Capabilities (`src-tauri/capabilities/ios.json`).** Four
  `core:window:deny-*` monitor entries; a deny beats an allow in tauri 2.11.2.
  iOS-only; desktop and Android are unchanged.
- **Toolchain.** Vite 8.1.6 is the smallest fixed release (8.3.5 is what
  `npm audit fix` picks). It keeps lightningcss on 1.32.0, so the built
  stylesheet is byte-identical; the native binding entries per platform are
  unchanged, Pi included; `server.cors: false` behaves the same.
- **Version 1.0.60.** The six-file set except the three Fastlane changelogs,
  which are published copy held in `held-copy.md` for the user's yes;
  `fastlaneMetadata.test.ts` is red on exactly those two rows until they are
  written. The F-Droid recipe's `commit:` lines move after the tag, as at
  1.0.59. The iOS plists are stamped at release time.
- Partial: the Duo's inner screen and a real Duo; Android by mechanism only.

### Seeing it locally
1. Open a terminal in the project folder.
2. Start the backend: `cd backend && .venv/bin/uvicorn main:app --reload --port 1620`.
3. In a second terminal, start the frontend: `cd frontend && npm run dev`.
4. Open http://localhost:5173 in a browser. The Welcome screen shows only on a
   cold start (no API keys, no data files, never dismissed); on a fresh data
   folder it appears straight away.
5. What to look for: the Welcome screen looks exactly as before on a desktop or
   in a browser. The change shows only inside the iPhone, iPad and Android apps,
   where the screen now keeps clear of a side camera and the status bar.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
