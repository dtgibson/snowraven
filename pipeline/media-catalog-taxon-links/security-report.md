# Security Review — Media Catalog Taxon Links (subspecies/form fix)

**Date:** 2026-07-03
**Feature:** media-catalog-taxon-links (Fix lane)
**Stack:** python-fastapi + react-vite (full-stack; frontend builders + backend/Tauri lookup)
**Checklists:** `reference/checklists/security-fastapi.md`, `reference/checklists/security-react-vite.md`
**Outcome:** PASSED

---

## Summary

This fix repoints four Macaulay Library "view my media" link builders onto one host
(`media.ebird.org/catalog`) with a `taxonCode` filter, and adds an additive `formCodes`
map to `/taxonomy/codes` (plus its Tauri twin) so subspecies/form names resolve to their
own eBird code. The security-relevant surface is narrow: URL string construction and one
additive, read-only response field derived from bundled public taxonomy. All interpolated
values are `encodeURIComponent`-wrapped and provably URL-safe, the change removes a
data-derived-string-into-URL path (the old `?taxaName=<name>` fallback) rather than adding
one, and it introduces no secrets, no dependencies, and no new external provider. Clean
pass — no findings.

---

## Findings

No security issues found in this fix. Two incidental hardenings were observed (recorded
in Checks Performed, not fixes required by this review):

- `LifeListTable`'s `mlUrl`/`mlUrlAll` now `encodeURIComponent`-wrap `userId` and
  `taxonCode`, where the pre-fix `taxaName`/`taxonCode` branches wrapped only `taxaName`
  and passed `userId`/`taxonCode` raw. Net improvement.
- The `?taxaName=<raw display name>` fallback — the one path that placed a
  user/data-derived string into a media-catalog URL — is deleted from all four builders.
  The only interpolated identifiers now are taxon codes (bundled, alphanumeric) and the
  regex-constrained `userId`. Net reduction in surface.

---

## Primary review targets

### 1. New URL construction (the four ML builders)

- **taxonCode is encoded AND provably safe.** Every builder wraps the code in
  `encodeURIComponent`: `mlCatalog.ts` `mlCatalogLink` (`&taxonCode=${encodeURIComponent(taxonCode)}`),
  `statsFormat.ts` `mlCatalogUrl` (`&taxonCode=${encodeURIComponent(taxonCode)}`),
  `LifeListTable.tsx` `mlUrl` + `mlUrlAll` (both `encodeURIComponent(taxonCode)`).
  Independently, the values are constrained: all 17,891 codes in the bundled
  `ebird-taxonomy.json` `byCode` are alphanumeric (17,890 match `^[A-Za-z0-9]+$`; the lone
  outlier `bird-o1` adds only a hyphen), and **zero** contain any URL-sensitive character
  (`& ? = # / space % < > ' "`). Codes are not user free-text — they come from the bundled
  snapshot via `formCodes`/`codes`, keyed by name. Belt-and-braces (encode + constrained
  source).
- **`?taxaName=<raw name>` is removed** from `statsFormat.ts`, `LifeListTable.tsx`, and
  (as the legacy host) `mlCatalog.ts`. That branch interpolated a user/data-derived display
  string; deleting it removes the only data-string-into-URL path. When no code resolves,
  the builders emit no taxon filter (rare last resort) rather than a broken/data-derived one.
- **userId unchanged in exposure, better encoded.** Same value as before (extracted from the
  ML export filename by `extractUserId`, regex-constrained to `[A-Za-z0-9]+`), same
  user-clicked navigation, no new surface. `mlCatalog.ts` and `statsFormat.ts` already
  encoded it; `LifeListTable.tsx` now does too.
- **Links stay escaped-JSX / OutboundLink; no `dangerouslySetInnerHTML`.** Statistics uses
  `OutboundLink`; Species Detail and LifeListTable use plain `<a target="_blank"
  rel="noreferrer">` with the URL as an escaped attribute. No raw-HTML sink added anywhere
  in the diff.

### 2. Backend + Tauri lookup change (`formCodes`)

- **Bundled/trusted data only.** `_by_com_all` (`taxonomy.py`) and `byComAllFor`
  (`taxonomyService.ts`) invert the bundled `_by_code` / `cache.byCode` — public eBird
  taxonomy. No secrets, no user data, no new upstream/network call (the offline-floor test
  proves resolution with the network blocked).
- **Additive; weakens no validation.** `codes`/`orders` derivation is unchanged and asserted
  byte-identical (`test_species_codes_byte_identical_with_form_map_added`,
  `test_species_only_codes_miss_form_names`, and both twins' parity tests). Request bodies
  are still Pydantic-validated (`CodesRequest`/`SpeciesItem`); the empty-taxonomy path returns
  `{codes:{}, orders:{}, formCodes:{}}`.
- **No injection / DoS vector.** The inversion is bounded to the ~18k-entry bundled snapshot
  and rebuilt only on snapshot (re)apply / cache change — never driven by request input. Per
  request it is O(n) dict lookups over the caller's species list; no unbounded work, no
  regex over untrusted input, no string-built query.

### 3. Secrets / dependencies / provider

- **No secrets in the diff;** `.env`, `.env.local`, `.env.*.local` are gitignored (verified)
  and no `.env` file is tracked.
- **No new dependencies** (frontend `package.json` change is the version bump only; no backend
  requirements change).
- **No new external provider.** `media.ebird.org/catalog` was already used by Statistics and
  Multimedia; Species Detail only **moved** onto it off the legacy `search.macaulaylibrary.org`.
  Both are ebird.org / Cornell Lab hosts, and these are user-clicked navigations, not embeds.
  **`PRIVACY_POLICY.md` remains accurate and is correctly unchanged** — no tiles/embeds/new
  host disclosure is triggered.

---

## Checks Performed

### React + Vite checklist

| Check | Result |
|---|---|
| No API keys / secrets in source | Pass |
| Only `VITE_`-prefixed vars client-side; no sensitive VITE vars | Pass (n/a — none added) |
| `.env` / `.env.local` gitignored | Pass (verified) |
| No credentials in `vite.config.ts` / committed config | Pass |
| API calls go through configured backend / seams (no client-side key exposure) | Pass (transport seam; no keys) |
| API base URLs not hardcoded secrets | Pass (public catalog host constant) |
| Error responses handled gracefully (no raw detail to users) | Pass (taxonomy failure → silent code-omit fallback) |
| Auth tokens not in localStorage | Pass (n/a — no auth in this fix) |
| User-generated HTML uses sanitization; no `dangerouslySetInnerHTML` w/ unsanitized input | Pass (no raw-HTML sink added) |
| URLs from data validated before `href`; no `javascript:` URLs | Pass (codes alphanumeric + encoded; userId regex-constrained + encoded) |
| No known vulnerable packages / no new deps | Pass (no dep changes) |
| Source maps / debug code not shipped | Pass (n/a — no build-config change) |
| Console logs with sensitive data removed | Pass (none added) |

### Python / FastAPI checklist

| Check | Result |
|---|---|
| Protected endpoints verify auth | Pass (n/a — `/taxonomy/codes` is a public, keyless, read-only taxonomy lookup; posture unchanged) |
| No string-formatted / f-string queries (injection) | Pass (no DB; dict lookups only) |
| User input never passed to `eval`/`exec`/`subprocess`/`os.system` | Pass |
| File paths from user input sanitized (no traversal) | Pass (n/a — no user-driven paths; snapshot path is fixed) |
| Request bodies validated with Pydantic | Pass (`CodesRequest`/`SpeciesItem`, unchanged) |
| Query/path params typed & validated | Pass (n/a — POST body only) |
| Unhandled exceptions → generic response, no stack traces | Pass (taxonomy-load failure returns empty maps, no detail) |
| No credentials in committed files | Pass |
| No new vulnerable / unpinned dependency | Pass (no requirements change) |
| Compute-heavy / external-call surface bounded | Pass (inversion bounded to bundled snapshot; no new upstream call; not request-driven) |

**Fix-lane focus checks (does the fix add risk or weaken a control?):**

| Check | Result |
|---|---|
| No new trust boundary / attack surface | Pass (one additive read-only field from bundled data; no new provider/dep/network) |
| Existing security controls not removed or weakened | Pass (Pydantic validation intact; `codes`/`orders` byte-identical; id shape-validation + encode preserved and extended to userId) |
| Fix does not bypass an existing control to resolve the bug | Pass (fix removes the `taxaName` data-string path; keeps escaped-JSX/OutboundLink and `encodeURIComponent`) |
| `PRIVACY_POLICY.md` still accurate | Pass (no new provider/embed; correctly unchanged) |
| No secrets committed | Pass |

---

## Convention Flags

None. The Engineer already flagged the durable rules (the shared `ML_CATALOG_BASE` host +
`taxonCode` pattern for every media-catalog link, and the additive all-category `formCodes`
map with its centralized `resolveMediaLinkTaxonCode` toggle and shared-fixture parity test)
in `implementation-notes.md`. The security-relevant standing check — *ML catalog links carry
an encoded, shape-safe `taxonCode` and never a raw `?taxaName=` data string* — is a direct
strengthening of the existing CLAUDE.md "id shape-validation + `encodeURIComponent` before
URL interpolation" convention, already covered there; nothing new to codify.

---

## Deploy-gate carry-forward (from QA, not a security finding)

The ON-case live behavior — whether `media.ebird.org/catalog?taxonCode=<issf code>` (e.g.
`scbmun2`) actually filters to the form's media — is a deploy-smoke verification item, not a
security matter. If the catalog is species-only, the documented degrade is a one-line change
in `resolveMediaLinkTaxonCode`. No security impact either way (the URL is well-formed and
encoded regardless).
