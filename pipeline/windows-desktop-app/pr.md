## Windows Desktop App

### What this does
Adds a native Windows build of the Tauri app at full feature parity, built by GitHub Actions and released alongside the macOS build with a working in-app updater. "Use my location" is gracefully degraded on Windows (a "coming later" note); everything else is unchanged on all platforms.

### What was built
- `.github/workflows/windows-build.yml` — `windows-latest` job. Builds the installer + updater archive. Uses a throwaway signing key just to make Tauri emit the `.nsis.zip`; uploads installer + archive as the `windows-build` artifact. No real secret in CI.
- `release.sh` — now the multi-platform assembler. After building/signing macOS, it fetches the CI Windows artifacts (`gh run download`), signs the Windows updater archive locally with the real key, writes one `latest.json` with both `darwin-aarch64` and `windows-x86_64` entries, and publishes one release. `SKIP_WINDOWS=1` escape hatch for macOS-only.
- `frontend/src/lib/platform.ts` — `isWindows()` (WebView2 userAgent; no new deps).
- `frontend/src/lib/location.ts` — `unsupported-platform` error code + a Windows guard in the Tauri branch.
- `frontend/src/components/MapExplorer.tsx` — on Windows, the "Use my location" button is replaced by the info note; coordinates + address search + radius all unchanged.
- Tests: `isWindows` unit tests (Windows / macOS / no-navigator).

### Release rhythm (new)
1. Bump version, commit, push to main.
2. Push the `vX.Y.Z` tag → triggers Windows Build CI.
3. Wait for CI to finish.
4. Run `./release.sh` locally → builds mac, fetches CI Windows artifacts, signs, assembles one release.

### How to test
- **Now (no regression):** `cd frontend && npm run dev` → Map Explorer still shows "Use my location" on web/Mac; radius selector present.
- **At deploy:** push a tag, confirm the Windows Build workflow produces installer + `.nsis.zip`; run `release.sh` and confirm `latest.json` has both platform entries.
- **Real hardware (QA-07):** on the Windows 11 machine, install the build, then publish a newer version and confirm the in-app updater updates. This validates the throwaway-key → local re-sign approach end to end.

### Notes for reviewer
- The throwaway-key trick (CI emits the archive, release.sh re-signs the same bytes) is the main risk; QA-07 confirms it. Fallback if it ever fails: have release.sh build the `.nsis.zip` itself from the CI installer.
- Confirm on first use: the exact `tauri signer generate`/`signer sign` flags (`-w`, `-f`, `-p ""`) behave non-interactively. If a flag differs in the installed CLI version, adjust in the workflow / release.sh.
- No Rust changes: macOS location code is already `cfg(target_os="macos")`; Windows compiles without it.

## Convention Flags
- Document the new multi-platform release rhythm (push tag → wait for Windows CI → run release.sh) in CLAUDE.md.
- `latest.json` is now multi-platform; the macOS local build and Windows CI build are assembled by release.sh into one manifest.
