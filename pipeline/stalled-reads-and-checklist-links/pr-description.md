# Bound stored-file reads and preserve Missing Weather row identity (1.0.28)

## What this fixes

On web and Raspberry Pi installs, `WebStorage.readFile` previously used a bare
`fetch()` followed by `Response.text()`. A request that never delivered response
headers, or delivered headers and then stopped sending the body, could therefore
remain pending forever. The eBird and Macaulay Library cache owners share their
first in-flight load between consumers, so one silent connection left every
dependent view joined to the same pending promise until the service restarted.

Stored eBird and ML reads now have a 30-second inactivity watchdog over both
headers and body data. The response body is read as a stream and each non-empty
chunk restarts the watchdog, so the bound measures silence rather than total
transfer time. A healthy large export can take longer than 30 seconds as long as
bytes keep arriving. On timeout the explicit race rejects before the transport is
aborted, the reader is cancelled, timers and locks are cleaned up, and the cache
owner clears its in-flight promise so the next load starts a fresh request.

The Weather tab's Missing Weather list also now gives all three row actions one
validated, row-owned submission ID and derives immutable checklist/edit URL
strings from it. In a Tauri app, visible checklist and edit links prevent the
ordinary click only after matching the opener plugin's own click gate, then send
that URL directly to `plugin:opener|open_url`. Copy weather & go retains its
prederived edit URL across the asynchronous lookup and copy before opening it.
Web and Raspberry Pi links retain ordinary anchor behavior.

## Checklist-collapse evidence boundary

The reported production symptom was that distinct Missing Weather actions could
all open one checklist until restart. That symptom was not reproduced
deterministically in jsdom or isolated from the current source, and this change
does not claim a proven historical trigger.

The code-level failure boundary is concrete: before this change, visible native
links owned distinct `href` values but did not own their native dispatch. The
app-wide `tauri-plugin-opener` 2.5.4 window listener rediscovered an anchor from
`event.composedPath()`, constructed a URL from that live DOM node, and only then
invoked native code. Inspection confirms the listener reads synchronously and
the Rust command accepts an owned `String`; neither source exposes shared URL
state that explains the collapse. The new path removes DOM rediscovery from these
rows entirely: the clicked row's closure sends its already-derived string. The
regression suite proves the resulting invariant through rerender/reorder, the
widen toggle, and pagination, but it should not be cited as proof of the original
WebView or operating-system cause.

## Interaction details kept intact

- `SUBMISSION_ID_RE` remains the only submission-ID shape gate. A malformed ID
  renders no checklist/edit link and never reaches lookup, clipboard, or native
  opener code.
- Tauri ordinary, Control, and Shift activations are directly dispatched, matching
  the plugin listener. Already-prevented, non-primary, Command, and Alt clicks are
  left to native anchor behavior. Web and Raspberry Pi events are untouched.
- Copy weather & go still opens exactly once, and only after a successful lookup
  and clipboard write. All existing offline, missing-key, and other failure states
  remain unchanged.
- Non-OK stored-file responses still return `null`. Desktop and iOS file reads are
  unchanged; the transfer watchdog applies only to web and Raspberry Pi storage.

## Files

- `frontend/src/lib/storage.ts`: bounded header/body read, progress-aware streaming,
  abort/cancel, and cleanup.
- `frontend/src/lib/storage.readFileTimeout.test.ts`: eBird and ML header/body stalls,
  zero-byte non-progress, long healthy streams, cleanup, and real cache retries.
- `frontend/src/lib/openExternal.ts` and `openExternal.test.ts`: direct Tauri URL
  dispatch and opener-compatible click gating, with unchanged web anchor behavior.
- `frontend/src/components/ChecklistLink.tsx`: optional validated click seam.
- `frontend/src/components/WeatherBacklog.tsx`: row-owned checklist/edit/copy targets.
- `frontend/src/components/WeatherBacklogNativeActions.test.tsx`: native payloads for
  every action across initial render, reorder/widen, pagination, and malformed IDs.
- `.github/workflows/pipeline.yml`: isolates Playwright's dependency install from
  the hosted runner's unrelated Google Chrome apt source.
- `CHANGELOG.md`, `README.md`, `docs/HELP.md`, `website/index.html`,
  `frontend/package.json`, and `src-tauri/tauri.conf.json`: 1.0.28 release and
  published behavior updates.

## Verification

- Focused regression suite: 4 files, 45 tests passing.
- `npm run typecheck`: passing.
- `npm run lint`: passing.
- `npm run build`: passing.
- Full frontend suite: 322 files, 5,585 tests passing.
- `git diff --check`: passing.

Four mutation checks were rejected, then the production source was restored and
the focused suite passed again: removing the header timeout race timed out its
test; removing per-chunk rearming broke the healthy long stream; treating an
empty chunk as progress timed out the zero-byte test; and dropping the row-owned
native dispatch failed the first multi-row payload assertion.

GitHub Actions run `34315230788` passed the frontend test and production-build
steps on both bounded reruns, then failed while Playwright's `--with-deps` ran
`apt-get update`: the hosted runner's separate Google Chrome repository returned
a `Packages.gz` hash mismatch. The workflow now removes that unrelated source
before installing Playwright's system dependencies. The edited workflow passes
YAML parsing, actionlint 1.7.12, and `git diff --check`; the hosted result remains
pending until the unpushed workflow is run on GitHub.

## Local and platform verification

See `pipeline/stalled-reads-and-checklist-links/how-to-see.md` for the automated
stall reproduction and a manual checklist-action pass.

The modified native app compiles and launches under `tauri dev`. Computer-use
automation cannot uniquely attach to that development window because multiple
SnowRaven builds on this machine share the `com.snowraven` bundle identifier.
The iOS debugger workflow was also attempted, but this machine's active
developer toolchain cannot provide Simulator control: `xcrun` reports that
`simctl` is not available. Native payload behavior is covered with the real
Tauri invoke seam, but no live checklist activation or iPhone/iPad Simulator
claim is made from this environment.

## Convention flags

- `frontend/package-lock.json` already reports 1.0.26 while the application was
  at 1.0.27. The repository's ordinary release convention names the package
  manifest, Tauri config, changelog, and three website strings; this change does
  not silently rewrite the pre-existing stale lockfile version.
- A read deadline for a streamed export must be based on byte inactivity, not
  elapsed wall time. Zero-byte chunks are not progress.
- Native actions in a reorderable/paged list should carry an immutable row-owned
  primitive to the native boundary. A DOM `href` remains useful and accessible,
  but it is not the identity source for this list's Tauri dispatch.
