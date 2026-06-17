## tab-order-and-load-optimization (0.5.42)

### What this does
Three independent Improve threads shipped together as 0.5.42:

1. **Default tab order** — Checklists now sits between Breeding Codes and List
   Comparer. Defaults/normalization only; any saved custom layout is preserved.
2. **Initial load** — maplibre-gl (~273 KB gzip) is no longer on the first-paint
   path. The sole eager edge was `NamedBirdRow` statically importing the per-row
   `SightingsMap`; that is now `React.lazy` + `Suspense`, and App idle-warms the
   chunk so opening a row stays instant. The List Comparer and Checklists tabs
   are lazy now too. Entry chunk dropped 331 KB → 218 KB (84.5 → 54 KB gzip), and
   `vendor-maplibre` is gone from `index.html`'s modulepreload. `vite`
   `chunkSizeWarningLimit` raised to 1100 (the only >500 KB chunk is the
   intentionally-isolated maplibre vendor, now off first paint).
3. **npm audit** — `npm audit fix` cleared the two dev-only advisories (vite,
   @babel/core via eslint-plugin-react-hooks) within existing ranges; both full
   and `--omit=dev` audits now report 0. README + `update.sh` note that the
   install-time count audits dev tooling that never ships.

### How to test
- `cd frontend && npm run dev`, open http://localhost:5173. The tab bar reads
  … Map Explorer, Multimedia, Breeding Codes, **Checklists, List Comparer**,
  Named Birds. A previously-saved custom layout is unchanged.
- `npm run build` → no chunk-size warning; `grep vendor-maplibre dist/index.html`
  returns nothing (off first paint).
- `npm audit` and `npm audit --omit=dev` both report 0 vulnerabilities.
- Named Birds tab → expand a named bird with coordinates → the per-row map still
  appears (now lazy-loaded, warmed at idle).

### Notes for reviewer
- The maplibre defer is the high-impact win and is a web / self-hosted benefit;
  on desktop (Tauri) modulepreload is local disk so the saving is marginal. No
  behavior change to any map.
- `NamedBirdRow` stays component-only (the warm importer lives in `App.tsx`) to
  satisfy `react-refresh/only-export-components`.
- One test updated: `NamedBirdsTable.test.tsx` awaits the lazy `SightingsMap`
  (`findAllByTestId`) in the two map-mount assertions.
- Single-WebGL-context accordion gating is unchanged (the Suspense boundary wraps
  the same on-open block).
