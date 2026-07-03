# Implementation Notes — Media Catalog Taxon Links (subspecies/form fix)

Version: 0.5.56 → **0.5.57** · Fix lane · frontend + backend + Tauri twin

---

## PR description

### Media Catalog Taxon Links — subspecies/form birds

#### What this does
Fixes the root cause of broken Macaulay Library "view my media" links for any bird
recorded under a subspecies/form name (a trailing parenthetical — e.g. *Scaly-breasted
Munia (Scaled)*, *Dark-eyed Junco (Oregon)*, *Rock Pigeon (Feral Pigeon)*). The eBird
taxon-code lookup resolved only `category=="species"` names, so a form name resolved to
no code — Species Detail then dropped the code (linking to **all** the user's media, on
the legacy `search.macaulaylibrary.org` host) and Multimedia + Statistics fell back to a
malformed `?taxaName=…(Scaled)` filter.

Now every media link across **Species Detail**, **Multimedia**, and **Statistics**
filters correctly:
- **Default / no toggle** → the **species** code (all the species' media), resolved by
  normalizing the name *before* the code lookup.
- **"Show subspecies" ON** (Species Detail + Multimedia only) → the **form's own issf
  code** (e.g. `scbmun2`), filtering to just that form's media.
- **Statistics** has no toggle → always the species code.
- The species code is the **universal fallback** when a form code can't be resolved
  (offline gap / unmapped name). A link **never** emits `?taxaName=` and **never** goes
  out bare (no filter) for a resolvable species.

Species Detail's builder was also consolidated off the legacy
`search.macaulaylibrary.org` onto the shared `media.ebird.org/catalog` host + one
`taxonCode`-preferring pattern (shared `ML_CATALOG_BASE`).

#### How the ON-case code is resolved
`/taxonomy/codes` gained an **additive** `formCodes` map (all-category name→code,
derived by inverting the snapshot's `byCode`). The bundled taxonomy snapshot is
unchanged — the codes already ship in `byCode` (17,891 entries, **zero** name
collisions, so the inversion is lossless). The existing species-only `codes`/`orders`
are **byte-identical** for current callers (favicons/sort), so nothing there shifts.

#### How to test
1. Load an eBird backup + ML export containing a form name (e.g. *Scaly-breasted Munia
   (Scaled)*).
2. **Species Detail** → select that species → Media card → click a photo/audio/video
   count → should open `media.ebird.org/catalog?...&taxonCode=nutman&userId=…` (all
   Scaly-breasted Munia). Turn on **Show subspecies**, select the *(Scaled)* form, click
   again → `…&taxonCode=scbmun2&userId=…` (just that form).
3. **Multimedia** → same species row → any count link → `taxonCode=nutman` (merged) /
   `taxonCode=scbmun2` (Show subspecies on). Never `taxaName`.
4. **Statistics** → Most photographed/recorded/filmed → the species' link →
   `taxonCode=nutman` (species; no toggle here).

#### Notes for reviewer
- **ON-case live check (see caveat below):** the form-code links must be eyeballed at
  the deploy smoke — I can't verify headlessly that `media.ebird.org/catalog` honors an
  issf code in `?taxonCode=`.
- The species-only `codes` path is untouched — verified byte-identical by new parity
  tests on both transports.

---

## Seeing the fix locally

1. Open a terminal in your project folder.
2. Start the backend:
   `cd backend && uvicorn main:app --reload --port 1620`
3. In a second terminal, start the frontend:
   `cd frontend && npm run dev`
4. Open your browser to `http://localhost:5173`.
5. In **Settings**, make sure your eBird backup and ML export are loaded (they auto-load
   if already saved). Your ML export filename must be unchanged so the userId is read.
6. Go to **Species Detail**, choose a bird you recorded as a subspecies/form (e.g.
   *Scaly-breasted Munia*). In the **Media** card, click a photo/audio/video count — it
   opens the Macaulay Library filtered to that species. Toggle **Show subspecies**, pick
   the *(Scaled)* form, and the same click now filters to just that form.
7. Cross-check **Multimedia** (same links, same toggle) and **Statistics → Most
   photographed** (always species-level).

---

## Per-surface before → after URLs — *Scaly-breasted Munia (Scaled)*

Species code `nutman`; form issf code `scbmun2`; `userId=USER123`; photo example.

| Surface | Toggle | Before (bug) | After (fix) |
|---|---|---|---|
| **Species Detail** | OFF | `https://search.macaulaylibrary.org/catalog?mediaType=photo&userId=USER123` (no taxonCode → **all** media) | `https://media.ebird.org/catalog?mediaType=photo&taxonCode=nutman&userId=USER123` |
| **Species Detail** | ON | *(same broken link — no form scope)* | `https://media.ebird.org/catalog?mediaType=photo&taxonCode=scbmun2&userId=USER123` |
| **Multimedia** | OFF | `https://media.ebird.org/catalog?taxaName=Scaly-breasted%20Munia%20(Scaled)&mediaType=photo&userId=USER123` (malformed) | `https://media.ebird.org/catalog?mediaType=photo&taxonCode=nutman&userId=USER123` |
| **Multimedia** | ON | *(same malformed `taxaName` link)* | `https://media.ebird.org/catalog?mediaType=photo&taxonCode=scbmun2&userId=USER123` |
| **Statistics** | n/a (always species) | `https://media.ebird.org/catalog?taxaName=Scaly-breasted%20Munia%20(Scaled)&mediaType=photo&userId=USER123` (malformed) | `https://media.ebird.org/catalog?mediaType=photo&taxonCode=nutman&userId=USER123` |

Fallback (form code unresolved, offline gap): all surfaces degrade to the **species**
code (`taxonCode=nutman`) — never `taxaName`, never bare.

---

## ON-case live-check caveat (MUST eyeball at deploy smoke)

The ON-case (form-code) links are implemented per eBird's own form-linking pattern —
`media.ebird.org/catalog?taxonCode=<issf code>` — which the catalog accepts in practice.
This **cannot be verified headlessly** in this environment. At the deploy smoke, open one
ON-case link (e.g. `https://media.ebird.org/catalog?taxonCode=scbmun2&userId=<you>`) and
confirm it filters to the *(Scaled)* form's media.

**If the catalog turns out to be species-only** (ignores or rejects the issf code), the
ON case should degrade to the **species** code. That degrade is a **one-line change**:
in `frontend/src/lib/mlCatalog.ts`, `resolveMediaLinkTaxonCode(...)` — change the ON
branch `if (showSubspecies) return formCode ?? speciesCode` to `return speciesCode` (drop
the `formCode` preference). Both call sites (SpeciesDetail `mediaLinkTaxonCode`,
LifeListTable `linkTaxonCode`) route through that one helper, so nothing else changes.
The backend/Tauri `formCodes` map can stay (harmless additive field) or be removed
separately.

---

## Files changed

**Frontend builders (OFF fix + ON toggle + consolidation)**
- `frontend/src/lib/statsFormat.ts` — export `ML_CATALOG_BASE`; `mlCatalogUrl` drops the
  `?taxaName=` branch (always taxonCode-or-nothing on the media host).
- `frontend/src/lib/mlCatalog.ts` — `mlCatalogLink` moved off `search.macaulaylibrary.org`
  onto the shared `ML_CATALOG_BASE`, always `taxonCode`, encoded params; new shared
  `resolveMediaLinkTaxonCode(showSubspecies, formCode, speciesCode)` toggle helper.
- `frontend/src/components/LifeListTable.tsx` — `mlUrl`/`mlUrlAll` drop `taxaName`, build
  on `ML_CATALOG_BASE`; new `formTaxonMap`/`showSubspecies` props; per-entry
  `linkTaxonCode` via the shared helper (normalizes before the species lookup).
- `frontend/src/components/LifeList.tsx` — captures `formCodes`; requests codes for both
  merged (species) and un-merged (form) names; passes `formTaxonMap` +
  `showSubspecies={!mergeSubspecies}` to the table.
- `frontend/src/components/SpeciesDetail.tsx` — captures `formCodes`; requests the
  normalized name too (so `codes` carries the species code even for a form-only species);
  splits `speciesTaxonCode` (favicons, species-only, **unchanged**) from the new
  toggle-aware `mediaLinkTaxonCode` (feeds the ML link); ML link uses the latter.
- `frontend/src/components/BirdingStats.tsx` — the three most-photographed/recorded/filmed
  links use `codeFor(entry.name)` (which normalizes) instead of the raw
  `mlTaxonMap[entry.name]`; stale `taxaName` comment corrected.

**Backend + Tauri twin (the lookup change — dual-transport parity)**
- `backend/routers/taxonomy.py` — additive `_by_com_all` (inverted `byCode`, rebuilt in
  `_apply_snapshot`); `/taxonomy/codes` returns an additive `formCodes` map; `codes`/
  `orders` unchanged.
- `frontend/src/lib/tauri/taxonomyService.ts` — memoized `byComAllFor(cache)`;
  `getTaxonomyCodes` returns `formCodes`; species maps unchanged.

**Tests (scoped to this fix)**
- `backend/tests/test_taxonomy_router.py` — form-code tests (issf → own code; species →
  species; species `codes` byte-identical; offline floor); `_reset_cache` clears the new
  map; `_FAKE_TAXONOMY` gains nutman/scbmun2.
- `backend/tests/test_taxonomy_collapse_parity.py` — `formCodes` parity on the shared
  fixture (Python twin); fixture snapshot/restore covers `_by_com_all`.
- `frontend/src/lib/taxonomyCollapse.parity.test.ts` — `formCodes` parity (TS twin) on
  the same shared fixture.
- `frontend/src/lib/taxonomyCollapse.fixture.json` — added `formCodesCases` block.
- `frontend/src/lib/statsFormat.test.ts` — `mlCatalogUrl` (host, taxonCode-not-taxaName,
  encoding, no-code fallback).
- `frontend/src/lib/mlCatalog.test.ts` (new) — `mlCatalogLink` (host consolidation, ON/OFF
  codes, no taxaName) + `resolveMediaLinkTaxonCode` toggle decision.
- `frontend/src/components/LifeListTable.test.tsx` — subspecies-toggle link tests (OFF
  species, ON form, ON→species fallback, no-code no-taxaName); `renderTable` forwards the
  two new props.

**Docs + version**
- `frontend/package.json` + `src-tauri/tauri.conf.json` → `0.5.57` (both).
- `CHANGELOG.md` — 0.5.57 Fixed entry (user voice).
- `docs/HELP.md` — Species Detail Media + Multimedia link descriptions note the
  "Show subspecies" scoping (light touch).
- `PRIVACY_POLICY.md` — **unchanged** (no new provider; `media.ebird.org` is an
  ebird.org / Cornell Lab host already disclosed, and these are user-clicked navigations,
  not embeds).

---

## How the species-lookup behavior was kept byte-identical (favicons/sort)

- The `formCodes` map is **purely additive**. The existing `codes` and `orders` maps are
  built exactly as before (species-category `bySci`/`byCom`/`byOrder`); no line in their
  derivation changed. New parity/router tests assert `codes`/`orders` are unchanged for a
  species request and that form names still **miss** `codes`.
- On Species Detail, favicons keep reading `speciesTaxonCode` (species-only, unchanged
  resolution). Only the ML **media** link switched to the new `mediaLinkTaxonCode`. So
  the header eBird/BoW favicons point at the same species page as before, even with
  "Show subspecies" on.
- The bundled taxonomy snapshot and build script are **untouched** — the form codes were
  already present in `byCode`; no regeneration, no `CACHE_KEY` bump.

---

## Convention flags

- **The ML catalog link builders now share ONE host + ONE taxonCode pattern.**
  `ML_CATALOG_BASE` (`lib/statsFormat.ts`) is the single source of truth, imported by
  `mlCatalog.ts` (Species Detail) and `LifeListTable.tsx` (Multimedia); Statistics
  already used it. No builder emits `?taxaName=` or the legacy `search.macaulaylibrary.org`
  host. Any new media-catalog link must build on `ML_CATALOG_BASE` with a `taxonCode`
  (resolved from the **normalized** name for the species code, or `formCodes` for a
  form).
- **`/taxonomy/codes` now returns an additive `formCodes` map (all-category name→code).**
  It is the ON-case ("Show subspecies") lookup; `codes`/`orders` stay species-only. The
  toggle decision is centralized in `resolveMediaLinkTaxonCode(showSubspecies, formCode,
  speciesCode)` — reuse it rather than re-deriving the branch. The two transports
  (`routers/taxonomy.py` `_by_com_all` ↔ `taxonomyService.ts` `byComAllFor`) are twins,
  locked by a `formCodes` parity test on the shared fixture — extend that fixture, not a
  per-transport ad-hoc test, when the map changes.
