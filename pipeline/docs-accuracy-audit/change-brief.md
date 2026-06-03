# Change Brief — Documentation Accuracy & Completeness Audit

**Lane:** Improve
**Date:** 2026-06-02

## Goal
Deep-dive `docs/HELP.md` (the in-app Help, also on GitHub) and
`README.md` for correctness and completeness against the current app
(v0.5.4), and fix every drift found. Trigger: the Help intro still says
the app runs on "Mac, or … Raspberry Pi" and omits the Windows desktop
app (shipped v0.4.0).

## Method
Read both docs in full; cross-checked against `PRODUCT_CONTEXT.md`, the
components (`MapExplorer.tsx`, `Settings.tsx`, `breedingCodes.ts`), the
published release assets, and `release.sh`.

## Findings & fixes

### HELP.md — accuracy
- **A1 (the flagged one). Intro omits Windows.** Line 3: "standalone
  desktop app on Mac, or … Raspberry Pi". → "…on **Mac or Windows**, or
  as a self-hosted server on a Raspberry Pi or any computer on your
  local network."
- **A2. "Observed" is not a breeding tier.** The atlas-shade bullet says
  shading runs "darkest for Confirmed, down through Probable, Possible,
  **and Observed**." `breedingCodes.ts` has four tiers whose lowest is
  **Possible** (tier 1); there is no "Observed". → drop "and Observed":
  "darkest for Confirmed, down through Probable to Possible."
- **A3. "stored on the server" is web/Pi-only language.** Default Files
  intro (line 54) says files "are stored on the server". On the desktop
  app they're in the local app-data directory. → make platform-neutral
  (the Settings section already states both correctly; align this line).
- **A4. Appearance wording is web-centric.** "save your preference to
  this browser's local storage" → neutral "saves your preference"
  (works on desktop and web).

### HELP.md — completeness
- **C1. My Sightings filters are under-described.** Line 182 lists only
  species + breeding status + date range. The panel also has **County**
  and **Media** filters and a **Radius** control (which sets the map
  zoom and the distance within which personal locations appear). → add
  these.
- **C2. No Troubleshooting / Rebuild Caches.** Settings has a desktop-
  only "Troubleshooting → Rebuild caches & restart" button
  (`Settings.tsx`). → add a short desktop-only subsection under Settings.
- **C3. In-app updates undocumented.** The "Check For Updates" footer +
  Install update flow (all platforms) isn't in HELP. → add a brief
  "Updating SnowRaven" note.

### README.md — accuracy
- **R1. Intel Mac download doesn't exist.** Mac install step 1 (line
  147) tells Intel users to download `SnowRaven_x.x.x_x64.dmg`. The
  build/`release.sh`/`latest.json` ship **Apple Silicon only**
  (`darwin-aarch64`); no Intel DMG is produced. → state Apple Silicon
  required (Intel not currently provided). *(Whether to add an Intel/
  universal build is a separate engineering decision, out of scope for a
  doc fix — noted, not actioned here.)*

- **R2. Security note implies it applies to everyone.** The "Security
  note" (reverse proxy / HTTPS / port 1620) only applies to the
  **self-hosted server mode** (Raspberry Pi / Linux / any-computer web
  install). The Mac and Windows desktop apps run no server and expose
  no port, so the note is irrelevant to them. → scope the note
  explicitly to the Raspberry Pi / self-hosted install so desktop users
  don't think they need a reverse proxy.

### README.md — otherwise current
README already covers Windows install, Windows geolocation, mobile
fullscreen, atlas shading, and desktop clipboard auto-copy. No other
drift found. (Optional: cross-link Rebuild Caches — low value, skip.)

## Acceptance
- Every fix above applied; HELP and README accurate vs. v0.5.4.
- No platform omitted where all three (Mac/Windows/Pi-web) apply.
- Breeding-tier language matches `breedingCodes.ts` (Confirmed/Probable/
  Possible, four shades, no "Observed").
- README Mac download instructions match the actually-published assets.
- `HELP.md` remains the single source of truth (CLAUDE.md), `?raw`-
  imported by `HelpDocs.tsx` — content-only edits, no code changes.

## Out of scope
- Building an Intel/universal Mac binary (separate decision).
- PRIVACY_POLICY.md / ACCESSIBILITY.md (no behavior change; still accurate).
- Restructuring/rewriting docs — accuracy & completeness only.

## Feature Check
Documentation-only Improve work. No code, no user-facing capability
change. **Stays in the Improve lane.**
