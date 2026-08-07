# Docs sync + published-surface em-dash sweep

## What this does

Brings the published docs current with builds 1-4 of this Spool bundle and
removes every em dash (U+2014) from the five published surfaces, per the
v0.5.68 punctuation convention now extended beyond app copy + HELP.md.

**Docs sync:**
- `docs/HELP.md` Temporal Stats gains a paragraph describing the new
  Checklist duration histogram (15-minute bins to 3 hours, hourly after,
  average-duration caption, usable-duration coverage note), and the Effort
  and Outings observer summary now mentions the Lists by observer count
  breakdown's every-distinct-count granularity. No new headings, so the
  `helpToc.test.ts` TOC parity holds without touching the TOC array.
- `README.md` line 3 adopts the self-hosted positioning ("Self-hosted
  birding tools and data explorer..."), and the Multimedia entry gains the
  tab's Unbounded toggle (closes the last v0.5.75 sweep gap tracked at
  `ROADMAP.md:149`; wording verified against `LifeListTable.tsx`'s
  wideMode: `width: max-content` page scroll vs. the `overflowX: auto`
  scroll box).
- `website/index.html` `<title>` and `og:title` adopt the same positioning
  formulation (written once, propagated: README line 3, title, og:title,
  plus the pre-existing footer line). The Multimedia feature card gains a
  matching one-sentence Unbounded mention (README-website sync rule).
  Version pill untouched at 0.5.77; hero h1/lede untouched per the brief.

**Em-dash sweep (before → after occurrence counts):**
- `README.md`: 46 → 0
- `ACCESSIBILITY.md`: 32 → 0
- `PRIVACY_POLICY.md`: 20 → 0
- `website/index.html`: 26 → 0 (24 prose replaced per context; the 2 List
  Comparer mock placeholder cells became en dashes, not deletions)
- `docs/HELP.md`: 0 → 0 (new copy written em-dash-free)

Every replacement is per-context (period between independent clauses,
comma for a light aside, colon before a list/definition, parentheses for a
true parenthetical); no blind deletes, surrounding spaces collapsed to
match. En dashes (ranges like 0–100%, A–Z) untouched. Frontend code
untouched: `mapStyle.ts` Esri attribution is the standing exclusion, and
the brief verified zero actionable rendered-string hits.

## How to test

1. `grep -c '—' README.md ACCESSIBILITY.md PRIVACY_POLICY.md website/index.html docs/HELP.md`
   should print 0 for all five.
2. `cd frontend && npx vitest run src/lib/helpToc.test.ts` (TOC parity)
   and `npm run typecheck` (HELP.md is bundled via `?raw`).
3. Open the Help tab in the app: Statistics section → Temporal Stats now
   describes the duration histogram; Effort and Outings mentions the
   observer-count granularity.
4. Read `README.md` top-to-bottom: the feature bullets now use a
   "**Label**: description" separator consistently.

## Notes for reviewer

- Bullet-label separators across README and the privacy-policy provider
  lists standardized on a colon after the bold label (the natural
  markdown definition-list form once the em dash is banned).
- The two published statements were retitled "SnowRaven Privacy Policy" /
  "SnowRaven Accessibility" (their old "X — SnowRaven" titles carried the
  em dash).
- "USGS — The National Map" became "USGS The National Map" in the privacy
  policy's tile-provider list; the host and meaning are unchanged.
- Accuracy stance on the two statements: punctuation only. No behavior
  restatements were altered beyond punctuation, and no drift was found in
  the passages touched.
- No version bump, no CHANGELOG entry: this run's HELP.md change is an
  app-bundle change, and the bundle-flush build sets the version and
  changelog for the whole Spool bundle.
