# Bug Brief — mac-release-build-blocked

**Lane:** Fix · **Stage 1 (The Evaluator)** · **Date:** 2026-06-27

## Symptom

SnowRaven **v0.5.45** is built, committed, tagged (`v0.5.45` @ `ac2ba49`), and
green on Windows CI — but the **macOS binary release has never shipped**. On the
Mac (the only machine with the Apple signing/notarization credentials), the
release step fails: `npm ci` aborts with npm's internal error
**`Exit handler never called!`**, repeatedly. The release never gets past
dependency install, so `release.sh` never builds or signs anything. Stuck for
days.

## Impact

- v0.5.45 (offline support) is unavailable to users on every platform — the
  GitHub release does not exist, so the in-app updater (which reads
  `latest.json` from the release) sees nothing. Windows users are blocked too,
  even though their installer was built by CI, because `release.sh` is the
  single assembler that publishes the release and writes `latest.json`.

## Evidence / reproduction

| Machine | Node | `npm ci` + frontend build | Result |
|---|---|---|---|
| Windows CI (`windows-build.yml`) | 20 (LTS) | `npm ci` | **green** at the tag commit |
| This build VM (Linux) | 24.16.0 / npm 11.16.0 | `npm run build` (deps present) | **green** — exit 0, all chunks, `dist/mapassets` = 55 files |
| **Mac (release machine)** | **25.9.0** | `npm ci` | **`Exit handler never called!`** |

- Same committed `package-lock.json` on all three. The Mac-architecture
  optional dependencies are fully present in the lockfile (`@rolldown/binding-darwin-{arm64,x64}`,
  `lightningcss-darwin-*`, `@tailwindcss/oxide-darwin-*`, and root
  `@tauri-apps/cli-darwin-*`). Darwin coverage is **not** the problem.
- `Exit handler never called!` is a **known npm runtime crash**, tracked
  upstream for exactly this combination — Node 25.x with npm 11.x
  (npm/cli#8766). It is npm panicking, not a SnowRaven defect.

## Root cause

**Primary — confirmed.** The Mac runs **Node v25.9.0**, a bleeding-edge,
**non-LTS** release. Its bundled npm hits the upstream `Exit handler never
called!` crash on `npm ci`. The VM (Node 24 LTS) and Windows CI (Node 20 LTS)
do not, because their npm/Node combinations are stable. Nothing in the repo
pins a Node version, so the release machine silently drifted onto an
unsupported Node.

**Secondary — latent, would block next.** The release instructions
(`handoff.md` Resume Prompt, `release-runbook.md`, `glyph-bundle-handoff.md`)
tell the operator to run only `cd frontend && npm ci`. But `release.sh`'s
`npm run desktop:build` resolves the **`tauri` CLI from the *root*
`node_modules/.bin`** — `@tauri-apps/cli` is a root-only devDependency, absent
from `frontend`'s lockfile. With the Mac's packages wiped, a frontend-only
install leaves no `tauri` binary and the build would die with
`tauri: command not found` (exit 127) — the *next* failure waiting behind the
npm crash.

**Contributing.** The Mac's job is a fragile, multi-step manual sequence
(`npm ci`, then `git` sync, then `release.sh`) on a machine that isn't the
primary dev box; any drift (Node version, partial deps, missed step) blocks the
release with an opaque error. This is the "the Mac was told to do a bunch of
stuff and it failed" complaint, and it is partly justified — the instructions
were incomplete (root deps) and unpinned (Node).

**Owner mental-model corrections (verified against the files):**
- The Mac genuinely **must build**, not "sign only." `release.sh` runs the
  frontend build, the universal Rust compile (aarch64 + x86_64), `codesign`,
  `xcrun notarytool submit`, and `xcrun stapler` — all macOS-only. There is no
  prebuilt macOS app to fetch; CI builds Windows only.
- There is **no "PMTiles download"** in the release. Downloadable PMTiles
  regions are deferred out of 0.5.45. `pmtiles@4.4.0` is a pure-JS npm library;
  the ~3.9 MB of offline map labels are committed to git. `npm ci` is required
  and correct.

## Fix plan (release tooling only — no app/runtime code changes)

**A. Harden `release.sh` into one self-healing command.**
- Run `npm ci` itself, at **both** the repo root and `frontend/`, before the
  build (fixes the secondary/latent root-deps trap; removes the forgettable
  manual step). Keep it deterministic (lockfile-driven); any `npm install`
  fallback stays opt-in behind a flag so it can't drift from Windows CI.
- Add fast, **loud** preflights that run before the slow build: required tools
  present (`node`, `npm`, `npx`, `git`, `curl`, `gh` + `gh auth status`,
  `rustup`, `cargo`, `xcrun`), Node is a supported/pinned LTS (reject the Node-25
  class), npm registry + GitHub reachable, working tree clean (`ALLOW_DIRTY=1`
  escape). Each failure dies with the exact remedy.
- `SKIP_NPM_INSTALL=1` for fast re-runs; optional `CHECK_ONLY=1` to dry-run the
  whole portable preflight + install on the Linux VM.
- **Do not touch** the signing / notarization / `latest.json` / Windows-fetch
  logic.

**B. Pin the Node version in the repo.** Add `.nvmrc` (Node **24**, matching
the VM) and an `engines.node` floor, so the release machine can't drift onto
Node 25 again, and `release.sh` can check the running Node against it.

**C. Correct the docs.** `handoff.md`, `release-runbook.md`,
`glyph-bundle-handoff.md` — drop the incomplete standalone `cd frontend && npm
ci`; state that `zsh -lc ./release.sh` is now self-healing (installs root +
frontend deps, preflights everything). Keep the `zsh -lc` note (login profile
holds the Apple creds) and the tag-re-push guard.

**D. Mac-side operator action (this release).** Switch the Mac off Node 25 to
the pinned LTS — `nvm install 24 && nvm use 24` — then run the single hardened
command. This is the only step that must happen on the Mac and is not
push-fixable (the script can detect a bad Node, but can't install one).

## Scope / out of scope

- **In scope:** `release.sh`, a new `.nvmrc`, `frontend/package.json` engines,
  and the three release docs. Pure release-pipeline hardening.
- **Out of scope:** the v0.5.45 app binary (unchanged — already built/committed),
  the signing/notarization mechanics, and the deferred PMTiles regions.
- **No version bump** — this fix is release tooling, not shipped app behavior.
  (Confirm with the Chronicler at closeout.)

## Verification plan

- **On the VM:** `bash -n release.sh` (syntax), `shellcheck` if available, and a
  `CHECK_ONLY=1` dry-run that exercises the new preflight + both `npm ci`
  installs end-to-end without the Apple toolchain.
- **On the Mac:** after switching to Node 24, a real `zsh -lc ./release.sh`
  producing the notarized DMG + updater bundle + Windows installer + `latest.json`
  — the true end-to-end test, owned by the operator (The Deployer stage).
