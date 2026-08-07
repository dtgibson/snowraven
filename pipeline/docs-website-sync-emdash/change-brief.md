# Change Brief — docs-website-sync-emdash

## What is changing
Bring the published docs current with builds 1-4 of this Spool bundle and
sweep em dashes (U+2014) out of every published surface. Four doc updates:
(1) `docs/HELP.md` Temporal Stats (~line 177) adds the new Checklist
duration histogram (15-min bins to 3h, hourly after, average + coverage
note); (2) `README.md` line 16 Multimedia entry adds the tab's
"↔ Unbounded" toggle (closes `ROADMAP.md:149`, the last v0.5.75 sweep
gap); (3) `README.md` line 3 description aligns with the new self-hosted
positioning (descriptive, no marketing); (4) `website/index.html`
`<title>` + `og:title` (lines 6, 14) adopt that same formulation — write
it once, propagate (v0.5.75 convention). Then the em-dash sweep below.

## Why now
User's saved idea: docs/README/website up to date + em-dash removal.
Builds 1-4 (heading rename, observer-count granularity, duration stat,
Rainbow Connection) changed what the docs describe. The v0.5.68 em-dash
convention covered only app copy + HELP.md; this extends it to README,
website, PRIVACY_POLICY.md, ACCESSIBILITY.md.

## User-facing impact
In-app: one new paragraph in Help (Temporal Stats) — HELP.md is bundled
via `?raw`, so this is an app-bundle change (version bump at bundle
flush, not here). Public: README/website copy reads with new punctuation;
title/og:title and README description carry self-hosted positioning.
Website version pill stays v0.5.77 — the flush sets it everywhere.

## Design pass
Not needed — no visual change. Copy-only edits to docs, README, website
text, and two published statements; no layout, tokens, or components.

## Decisions touched
- v0.5.68 em-dash sweep (DECISIONS/CLAUDE.md): scope EXTENDED to README,
  website prose, PRIVACY_POLICY.md, ACCESSIBILITY.md — Chronicler should
  log the extension and update CLAUDE.md's Documentation rule.
- v0.5.75 docs-parity conventions: propagate-once formulation applies to
  the README/website description; helpToc parity test constrains HELP.md
  (no new heading planned — new copy goes INSIDE Temporal Stats; any new
  `##`/`###` would fail `helpToc.test.ts` until its TOC array is updated).
- Build 1's "README line 3 out of scope" call is deliberately superseded.

## What done looks like
`grep -c '—'` = 0 on README.md, PRIVACY_POLICY.md, ACCESSIBILITY.md,
website/index.html prose (mock placeholder cells at lines 443-444 may
become en dashes); HELP.md stays 0 (new copy uses no em dash); app
rendered strings stay 0 actionable (Esri attribution untouched). HELP
Temporal Stats describes the duration histogram; README Multimedia names
the Unbounded toggle; README/website titles carry the aligned
description. `helpToc.test.ts` + vitest green; replacements per context,
never a blind delete.
