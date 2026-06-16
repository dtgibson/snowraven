# Handoff — Behavior ML links + coverage fix pushed (v0.5.38); awaiting Mac release.sh

## What We Accomplished

Shipped the **Statistics media-behavior links + coverage fix (0.5.38)** off the VM.
On the Statistics → Media card, each behavior count now links to that behavior
filtered to your own media in the Macaulay Library, each breeding behavior is listed
and linked on its own (and dropped from the top behaviors list so it isn't shown
twice), and the tab's catalog links were unified onto `media.ebird.org/catalog`.
Folded in with approval: the "documentation coverage" denominator was corrected to
stop counting `sp.`/slash/hybrid forms against the life list (it had pushed the total
above the real life list). Frontend-only; no new providers; privacy unchanged.

## What Has Been Saved

- Code: `lib/{mediaStats,statsFormat,speciesUtils}.ts`,
  `components/{statsPrimitives,MediaStatsSections,BirdingStats}.tsx` + tests.
- Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → `0.5.38`;
  `CHANGELOG.md` entry.
- Docs: `docs/HELP.md`; `website/index.html` (version pill + footer → v0.5.38, a
  Statistics copy line on the count→ML links).
- Pipeline artifacts: `pipeline/stats-behavior-ml-links/` (change-brief, qa-report,
  security-report).
- Records: `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md` (Shipped → 73),
  `CLAUDE.md` (two conventions + corrected the stale website-version note).
- Committed to `main` and pushed; tag `v0.5.38` pushed (starts Windows CI).

## Where We Are

Improvement complete and pushed from the VM. **Next: on the Mac, once Windows CI is
green, run `zsh -lc './release.sh'`** (login shell — the Apple signing creds live
only in the login profile; a bare `./release.sh` fails preflight with
`APPLE_SIGNING_IDENTITY is not set`). Before releasing, verify the selected Windows CI
run's `headSha == git rev-parse v0.5.38^{commit}` (tag-re-push guard; this is a fresh
single-push tag, so no hazard expected). After `release.sh`, confirm the assets return
HTTP 200 and `/releases/latest` shows v0.5.38 as Latest, then mark `releasedVersion`
0.5.38.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
