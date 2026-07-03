## What We Accomplished

Shipped **v0.5.57**, fixing the broken Macaulay Library media links you reported.
Any bird recorded under a subspecies, identifiable-form, or domestic-type name (a
trailing parenthetical, like "Scaly-breasted Munia (Scaled)") had bad "view my
media" links everywhere: Species Detail dropped the taxon code and showed *all*
your photos (on the old ML host), while Multimedia and Statistics built a broken
`taxaName=…(Scaled)` link. It was one root cause hitting four link builders across
three tabs, and it affected far more than one bird — every junco form, warbler
form, flicker, domestic mallard, and so on.

The fix resolves the code once, correctly, and every link now follows your **Show
subspecies** toggle: off links to the whole species (all your media), on links to
just that form. Statistics has no toggle, so it uses the species link. Everything
consolidated onto the current catalog host, and your favicons and taxonomic sort
are provably unchanged.

## What Has Been Saved

- **Release commit `e7afd06`, tag `v0.5.57`.** Binaries **LIVE** as a GitHub
  release marked *Latest*: notarized + stapled universal macOS DMG, updater bundle
  + signature, signed Windows installer + signature, `latest.json`
  (`darwin-aarch64` / `darwin-x86_64` / `windows-x86_64`). Windows CI run
  `28643591030` (headSha == tag) supplied the installer; release ran headless.
- **Records commit `7f97f0f`:** `DECISIONS.md` (the host/`taxonCode` consolidation,
  the additive `formCodes` map, the toggle-dependent link scope, the ON-case
  degrade seam), `CLAUDE.md` (the ML-catalog convention updated — consolidation is
  now done), `PRODUCT_CONTEXT.md` (four media-linking descriptions corrected).
  `ROADMAP.md` unchanged (this is a fix).
- Code: `frontend/src/lib/mlCatalog.ts` (+ `.test`), `lib/statsFormat.ts`,
  `components/{LifeListTable,LifeList,SpeciesDetail,BirdingStats}.tsx`,
  `backend/routers/taxonomy.py` + the Tauri twin `lib/tauri/taxonomyService.ts`
  (the additive `formCodes` map, parity-tested). Version 0.5.57 both files;
  `CHANGELOG.md`, `docs/HELP.md`. `PRIVACY_POLICY.md` unchanged.
- Verification: vitest **1282**, pytest **178**, lint / build / entry-chunk green;
  security review **28 checks, 0 findings** (a net hardening).

## Where We Are

Fix complete — all six Fix-lane stages done and shipped. Pipeline is idle.

**One thing to eyeball on the live app:** open a Show-subspecies-*on* link, e.g.
`https://media.ebird.org/catalog?taxonCode=scbmun2&userId=<you>`, and confirm it
filters to just the "(Scaled)" form. It follows eBird's own form-linking pattern,
so it should — but if the catalog turns out to filter at the species level only,
the toggle-on case falls back with a one-line change in
`frontend/src/lib/mlCatalog.ts` `resolveMediaLinkTaxonCode`. The toggle-off
(species) links are fully verified.

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project.
It reads saved state and picks up fresh.
