# Security Review — Named Birds Tab Upgrade

**Date:** 2026-06-10
**Feature:** named-birds-tab-upgrade
**Stack:** python-fastapi (backend) / react-vite-tailwind (frontend) — change is frontend-only
**Checklist:** reference/checklists/security-react-vite.md
**Outcome:** PASSED

---

## Summary

The Named Birds tab upgrade is a frontend-only React/TypeScript change: sort
options, in-row location text, a new shared `SightingsMap`, and the extraction of
`buildSightingMarkers`/`NamedBirdRow`. The change introduces no backend route, no
new dependency, no secret, and no new network egress. All user-derived strings
(location text, the named-bird display name, species comments) render as
React-escaped JSX children or escaped attributes; the only injected HTML on the
map is the unchanged static `SP_PIN_HTML` SVG constant; and the eBird checklist
`href` in the map popup remains gated by the `SUBMISSION_ID_RE` (`/^S\d+$/`)
allowlist. No security issues were found.

---

## Findings

No security issues found in this feature.

One informational observation (not a defect, no action required) is recorded
below for completeness.

### INFO-1: Row checklist link interpolates `submissionId` without the `SUBMISSION_ID_RE` gate

**Severity:** Informational
**Location:** `frontend/src/components/NamedBirdRow.tsx:90`
**Description:** The expanded report row builds the eBird link as
`href={`https://ebird.org/checklist/${s.submissionId}`}` where `s.submissionId`
is un-validated CSV data. Unlike the map popup (`SightingsMap.tsx:65`), the row
link does not first test `SUBMISSION_ID_RE`. This is **not** a new surface — it is
a faithful migration of the pre-existing `NamedBirdsTable` link (the old code used
the identical un-gated interpolation), and it is not exploitable: the URL scheme
and host are a fixed literal prefix (`https://ebird.org/checklist/`), so a
malicious CSV value can only append to the path component, never change the scheme
to `javascript:` or redirect the origin. React additionally neutralizes
`javascript:`/`data:` values placed in an `href` at render time. The link also
carries `rel="noreferrer"` and `target="_blank"`. No data flows off-device.
**Remediation:** None required. Optionally, for symmetry with the popup, the row
link could render as plain text (not an anchor) when `!SUBMISSION_ID_RE.test(s.submissionId)`;
this is a polish item, not a security fix.
**Status:** Resolved (post-review, at the user's request) — `NamedBirdRow.tsx` now
imports `SUBMISSION_ID_RE` from `./speciesDetail/ui` and gates the row link, rendering
the id as plain `<span>` text when it doesn't match `/^S\d+$/`, matching the popup and
the 0.5.25 convention. Covered by a regression test in `NamedBirdsTable.test.tsx`
("renders a malformed checklist id as plain text, not a link"). Suite now 692 green.

---

## Privacy / egress assessment

- **No new tile provider, no new network egress.** `SightingsMap` renders through
  the shared `<SnowMap>` wrapper, which sources every tile provider and style from
  the existing keyless set in `lib/mapStyle.ts` (OpenFreeMap / Esri / USGS /
  Waymarked). A scan of `SnowMap.tsx` found no tile URL, no `fetch`, no provider
  string, and no API key. `SightingsMap` adds only DOM `<Marker>`/`<Popup>`
  children and a `MapBoundsFitter` — no new outbound request.
- **Coordinates stay on-device.** The precise user coordinates rendered by the
  per-individual map come from the user's own parsed eBird CSV (`ObservationEntry.latitude/longitude`
  → `NamedSighting` → `buildSightingMarkers`) and are drawn locally to the user as
  pin positions. Nothing about the coordinates is transmitted off-device; the
  popup links out only to `ebird.org` by the user's own checklist id.
- **`PRIVACY_POLICY.md` requires no change.** Because no tile provider, third-party
  service, analytics, or telemetry was added, the privacy policy's "Map Tiles" and
  "collects nothing / runs no server" assertions remain true as written.

---

## Checks Performed

| Check | Result |
|---|---|
| User-generated content (location text) rendered as escaped JSX, not raw HTML | Pass — `{s.location}` JSX child + `title={s.location}` attribute, both React-escaped (`NamedBirdRow.tsx:75-88`) |
| User-generated content (species comment) rendered as escaped JSX | Pass — `{s.comment}` JSX child in the quoted block (`NamedBirdRow.tsx:108`) |
| User-generated content (named-bird name) rendered as escaped JSX | Pass — `{bird.name}` JSX children (`NamedBirdRow.tsx:46,125`) |
| `dangerouslySetInnerHTML` limited to static SVG constant | Pass — sole use is `SP_PIN_HTML` static constant (`SightingsMap.tsx:57`); no user/external text injected as HTML |
| Map popup shows date + checklist only; location text NOT raw-injected into popup | Pass — popup renders `formatDate(date)` + checklist link; location text never enters the popup (`SightingsMap.tsx:60-88`) |
| URLs from CSV data validated before use in `href` (popup) | Pass — popup link gated by `SUBMISSION_ID_RE` (`/^S\d+$/`) before interpolation (`SightingsMap.tsx:65`) |
| URLs from CSV data — row checklist link | Pass (with INFO-1) — fixed `https://ebird.org/checklist/` prefix; scheme/host not user-controllable; `rel="noreferrer"` |
| No `javascript:`/`data:` URL reachable from user input | Pass — fixed literal scheme + host on both links; React neutralizes scheme-bearing hrefs |
| No new tile provider / network egress introduced | Pass — `SightingsMap` reuses `<SnowMap>`; no new fetch/URL/key in the changed surface |
| Precise coordinates rendered locally only, not transmitted | Pass — coords flow CSV → `buildSightingMarkers` → marker positions; no off-device send |
| No API keys, tokens, or secrets in changed source | Pass — none present |
| No `VITE_`-exposed sensitive values added | Pass — no env access added |
| `.env` / `.env.local` git-ignored | Pass — unchanged; no env file touched |
| No credentials in `vite.config.ts` or config | Pass — config files unchanged by this feature |
| No new third-party API call from the client | Pass — only the existing `transport.post('/taxonomy/codes', …)`, now also reading `orders`; same endpoint, same trust boundary |
| Error responses handled gracefully, no raw error to user | Pass — `fetchTaxonCodes` swallows failure and degrades the taxonomic sort to name order; no error surfaced (`NamedBirds.tsx`) |
| No auth/token storage change | Pass — feature has no auth surface; no localStorage/token writes added |
| No new vulnerable / outdated dependency | Pass — `package.json` deps unchanged by this feature (no new import beyond existing `react-map-gl/maplibre`, `lucide-react`) |
| No unused dependency introduced | Pass |
| No console logging of sensitive data added | Pass — no `console.*` in any changed file |
| No source maps / dev-only code path added to prod build | Pass — no build config change |
| Colors via `var(--sr-*)` tokens (convention) | Pass — `--sr-quote-bg`/`--sr-quote-border` defined in both `:root` and `[data-theme="dark"]` (`globals.css:39-40,140-141`); consumed via `var(--sr-*)` in `NamedBirdRow.tsx:103-105` |
| Map popups remain escaped JSX (CLAUDE.md standing check) | Pass — migrated SpeciesDetail popup and the new card popup are both JSX; no `dangerouslySetInnerHTML` popup |
| Type-check + feature tests | Pass — `tsc --noEmit` clean; 30/30 tests across `NamedBirdsTable.test.tsx` + `namedBirds.test.ts` |

---

## Convention Flags

Nothing new to flag — the change already conforms to the existing CLAUDE.md
standing security check ("map popups stay escaped JSX; the pin sprite is the lone
static-SVG exception"), which the new `SightingsMap.tsx` cites in-line. No new
standing rule is warranted.
