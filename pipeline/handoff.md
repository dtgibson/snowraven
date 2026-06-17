# Handoff — Five new Frivolous Lists pushed (v0.5.39); awaiting Mac release.sh

## What We Accomplished

Shipped the **Frivolous Lists expansion (0.5.39)** off the VM, on top of the now-live
0.5.38. Five new self-completing collections at the bottom of the Statistics tab:
three flat (Phoebe Phanatic, Scrub Jay All Day, Crow Pro / Raven Maven) and two
grouped with labeled sub-categories shown in the card (Heron is Carin' — 12 species;
Best of the Crest — 38 across 16 sub-groups). Each checks off from the life list with a
count and a badge. Frontend-only; no new providers; privacy unchanged.

## What Has Been Saved

- Code: `lib/frivolousLists.ts` (data + `GroupedListResult` + `groupedList()`),
  `components/FrivolousListsSections.tsx` (shared `NameItems`/`ListHead` + `GroupedNameList`),
  `components/BirdingStats.tsx` (taxonomy batch) + 6 new tests.
- Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → `0.5.39`; `CHANGELOG.md`.
- Docs: `docs/HELP.md`; `website/index.html` (v0.5.39).
- Pipeline artifacts: `pipeline/frivolous-lists-expansion/` (change-brief, qa-report, security-report).
- Records: `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md` (Shipped → 74), `CLAUDE.md`.
- Names verified against the live `/taxonomy/codes`; 3 eBird renames applied
  (Western Cattle-Egret; Black-crowned / Yellow-crowned Night Heron).
- Committed to `main` and pushed; tag `v0.5.39` pushed (starts Windows CI).

## Where We Are

Pushed from the VM, on top of the live 0.5.38. **Next: on the Mac, once Windows CI is
green, run `zsh -lc './release.sh'`** (login shell — Apple signing creds live only in the
login profile). Verify the selected Windows CI run's `headSha == git rev-parse
v0.5.39^{commit}` (fresh single-push tag, no hazard expected). After `release.sh`, confirm
the assets return HTTP 200 and `/releases/latest` shows v0.5.39 as Latest, then mark
`releasedVersion` 0.5.39.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
